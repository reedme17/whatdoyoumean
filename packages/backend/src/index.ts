import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from project root
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

import { buildApp, setGateway } from "./app.js";
import { LLMGateway } from "./llm/gateway.js";
import { CerebrasAdapter } from "./llm/providers/cerebras.js";
import { OpenAIAdapter } from "./llm/providers/openai.js";
import { Server as SocketIOServer } from "socket.io";
import { setupWebSocketHandlers } from "./ws/handler.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

async function main() {
  // Initialize LLM Gateway
  const gateway = new LLMGateway();
  gateway.registerProvider(new CerebrasAdapter());
  gateway.registerProvider(new OpenAIAdapter());
  setGateway(gateway);

  console.log("LLM providers registered:", 
    process.env.CEREBRAS_API_KEY ? "✅ Cerebras" : "❌ Cerebras (no key)",
    process.env.OPENAI_API_KEY ? "✅ OpenAI" : "❌ OpenAI (no key)",
  );

  // Start Fastify REST API
  const app = await buildApp();
  const address = await app.listen({ port: PORT, host: HOST });
  console.log(`🚀 REST API listening at ${address}`);

  // Attach Socket.IO to the same HTTP server
  const io = new SocketIOServer(app.server, {
    cors: { origin: "*" },
  });
  setupWebSocketHandlers(io, { llmGateway: gateway });
  console.log(`🔌 WebSocket server attached on same port ${PORT}`);
}

main();
