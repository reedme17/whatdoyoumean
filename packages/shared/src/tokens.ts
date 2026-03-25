/**
 * Design tokens — single source of truth for 啥意思 design system.
 * Consumed by:
 *   - Electron: globals.css @theme (via build script or manual sync)
 *   - iOS: SwiftUI Color/Font extensions (future)
 */

// ── Colors ──

export const colors = {
  // Semantic
  background: "#ffffff",
  foreground: "#09090b",
  muted: "#71717a",
  mutedForeground: "#a1a1aa",
  border: "#e4e4e7",
  input: "#e4e4e7",
  ring: "#18181b",

  // Primary (buttons, links)
  primary: "#18181b",
  primaryForeground: "#fafafa",

  // Secondary (subtle backgrounds)
  secondary: "#f4f4f5",
  secondaryForeground: "#18181b",

  // Destructive (errors, warnings)
  destructive: "#ef4444",
  destructiveForeground: "#fafafa",

  // Accent (hover states)
  accent: "#f4f4f5",
  accentForeground: "#18181b",

  // Card
  card: "#ffffff",
  cardForeground: "#09090b",
} as const;

// ── Typography ──

export const fontFamily = {
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
  "6xl": 60,
} as const;

export const fontWeight = {
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const lineHeight = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.625,
} as const;

// ── Spacing (4px base) ──

export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

// ── Radius ──

export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  full: 9999,
} as const;

// ── Animation ──

export const duration = {
  fast: 150,
  normal: 200,
  slow: 300,
} as const;

// ── Shadows ──

export const shadow = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
} as const;

// ── Aggregate export for platform consumers ──

export const tokens = {
  colors,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  spacing,
  radius,
  duration,
  shadow,
} as const;

export type DesignTokens = typeof tokens;
