# Bug Report: WebSocket + LLM Integration Issues

Date: 2026-03-24

## Summary

Text Mode 的 Analyze 功能从前端到 LLM 真正返回结果，经历了多个层面的问题。整个调试过程暴露了 5 个独立的 bug，它们叠加在一起导致了"按 Analyze 没反应"的表象。

## Bug 1: Electron renderer 空白页

**症状**: Electron 窗口打开后一片空白
**原因**: TypeScript 编译 JSX 后生成 ES module import 语句，但 HTML 里的 `<script>` 标签不支持 ES modules。React、react-dom 等 npm 包无法被浏览器直接解析。
**修复**: 引入 esbuild 作为 bundler，将所有 renderer 代码打包成单个 IIFE 格式的 JS 文件。
**教训**: Electron renderer 进程本质上是浏览器环境，需要 bundler 处理 npm 依赖。

## Bug 2: WebSocket 连接失败 (Fastify + Socket.IO 冲突)

**症状**: socket.io-client 连接超时，`Connect error: timeout`
**原因**: Fastify 5 内部管理自己的 HTTP server，Socket.IO 绑定到 `app.server` 后，Fastify 拦截了所有 HTTP 请求（包括 Socket.IO 的 `/socket.io/` polling 端点），返回 404。Socket.IO 的握手请求永远无法完成。
**尝试过的方案**:
1. 在 `app.listen()` 之前调用 `setupWebSocket()` — 失败，server 还没准备好
2. 在 `app.listen()` 之后调用 — 失败，Fastify 已经接管了 HTTP server
3. 用 `serverFactory` 共享 HTTP server — 失败，Fastify 的 request handler 拦截了 Socket.IO 的请求
4. 在 `serverFactory` 里过滤 `/socket.io` 路径 — 失败，Socket.IO 的 listener 也被跳过了
**最终修复**: 让 Fastify REST API 和 Socket.IO 跑在不同端口（3000 和 3001），完全独立，互不干扰。
**教训**: Fastify 5 和 Socket.IO 共享同一个 HTTP server 非常困难。分端口是最简单可靠的方案。

## Bug 3: WebSocket 连接到旧进程

**症状**: 客户端显示 `[WS] Connected!` 但后端没有打印 `[WS] Client connected:`
**原因**: 之前的后端进程没有被完全杀掉，客户端连到了旧的 Socket.IO 进程（端口还被占用）。
**修复**: `lsof -ti:3000 | xargs kill -9` 和 `lsof -ti:3001 | xargs kill -9` 彻底清理。
**教训**: 调试网络问题时，先确认没有僵尸进程占用端口。

## Bug 4: Cerebras API 404 — 模型名错误

**症状**: `NotFoundError: 404 status code (no body)` from `api.cerebras.ai`
**原因**: CerebrasAdapter 里配置的模型名 `llama-4-scout-17b-16e-instruct` 不存在于 Cerebras 的模型列表中。这是代码生成时的错误假设。
**修复**: 改为 Cerebras 实际支持的模型 `llama3.1-8b`（从 Cerebras API 文档确认）。
**教训**: 第三方 API 的模型名必须从官方文档确认，不能凭记忆或猜测。

## Bug 5: GPT-OSS-120B 免费层暂时不可用

**症状**: 改为 `gpt-oss-120b` 后仍然 404
**原因**: Cerebras 官网显示 "Temporary reduction in GLM4.7 and GPT-OSS rate limits for free tier in place"，GPT-OSS 模型暂时对免费用户限制访问。
**修复**: 暂时使用 `llama3.1-8b` 作为替代，等 GPT-OSS 恢复后切回。
**教训**: 依赖第三方免费层服务时，需要有 fallback 方案。LLM_Gateway 的多 provider fallback 设计在这里体现了价值。

## 架构改动总结

| 改动 | 之前 | 之后 |
|------|------|------|
| Renderer bundling | 无（裸 tsc 输出） | esbuild IIFE bundle |
| REST API 端口 | 3000 | 3000（不变） |
| WebSocket 端口 | 3000（共享） | 3001（独立） |
| Cerebras 模型 | llama-4-scout-17b-16e-instruct | llama3.1-8b（临时），gpt-oss-120b（目标） |
| DevTools | 手动打开 | 自动打开（开发模式） |
