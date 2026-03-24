/**
 * Shared inline styles — black & white, shadcn/ui aesthetic.
 * System font, clean, minimal.
 */

import type { CSSProperties } from "react";

const fontFamily =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

export const colors = {
  bg: "#ffffff",
  fg: "#000000",
  muted: "#71717a",
  border: "#e4e4e7",
  accent: "#f4f4f5",
  hoverBg: "#f4f4f5",
} as const;

export const base: Record<string, CSSProperties> = {
  screen: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    fontFamily,
    background: colors.bg,
    color: colors.fg,
  },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  btn: {
    fontFamily,
    fontSize: 14,
    fontWeight: 500,
    padding: "10px 24px",
    border: `1px solid ${colors.fg}`,
    borderRadius: 6,
    background: colors.fg,
    color: colors.bg,
    cursor: "pointer",
    outline: "none",
  },
  btnOutline: {
    fontFamily,
    fontSize: 14,
    fontWeight: 500,
    padding: "10px 24px",
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    background: "transparent",
    color: colors.fg,
    cursor: "pointer",
    outline: "none",
  },
  btnGhost: {
    fontFamily,
    fontSize: 13,
    fontWeight: 400,
    padding: "6px 12px",
    border: "none",
    borderRadius: 6,
    background: "transparent",
    color: colors.muted,
    cursor: "pointer",
    outline: "none",
  },
  badge: {
    fontFamily,
    fontSize: 12,
    fontWeight: 500,
    padding: "4px 12px",
    border: `1px solid ${colors.border}`,
    borderRadius: 9999,
    background: colors.bg,
    color: colors.fg,
    cursor: "pointer",
    outline: "none",
    whiteSpace: "nowrap",
  },
  input: {
    fontFamily,
    fontSize: 14,
    padding: "10px 12px",
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    background: colors.bg,
    color: colors.fg,
    outline: "none",
    width: "100%",
  },
  textarea: {
    fontFamily,
    fontSize: 14,
    padding: "12px",
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    background: colors.bg,
    color: colors.fg,
    outline: "none",
    width: "100%",
    resize: "vertical" as const,
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    borderBottom: `1px solid ${colors.border}`,
  },
  heading: {
    fontSize: 16,
    fontWeight: 600,
    fontFamily,
  },
};
