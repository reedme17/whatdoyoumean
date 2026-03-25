# Bug Report: Font Loading in Electron

Date: 2026-03-25

## Summary

Multiple attempts to load custom fonts (Merriweather, Mulish, Lora, Nunito Sans, etc.) in the Electron app failed or partially worked. Root causes were CSP restrictions, Tailwind v4 utility misinterpretation, and Electron's file:// protocol limitations.

---

## Bug 1: Google Fonts Blocked by CSP

**Symptom**: Fonts from Google Fonts CDN didn't load. No visible change from system fonts.

**Root Cause**: The Content-Security-Policy meta tag in `index.html` had `default-src 'self'` but no `font-src` or `style-src` allowing Google domains. Electron's Chromium silently blocked the font CSS and woff2 downloads.

**Fix**: Updated CSP to include `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com`.

**Lesson**: When using external font CDNs in Electron, CSP must explicitly allow both the CSS source (googleapis.com) and the font file source (gstatic.com).

---

## Bug 2: Local @fontsource Fonts Not Loading

**Symptom**: Installed `@fontsource/merriweather`, `@fontsource/mulish`, `@fontsource/source-code-pro` via npm. Tailwind CLI inlined the `@font-face` declarations into the output CSS. Font files were copied to `dist/renderer/files/`. But fonts still showed as `unloaded` in `document.fonts`.

**Root Cause**: Unclear — the `@font-face` `src: url(./files/...)` paths should have been relative to the CSS file in `dist/renderer/`. The files existed at the correct paths. Possibly an Electron `file://` protocol issue with relative URL resolution in CSS, or a CSP issue with `font-src 'self'` not matching `file://` URLs.

**Fix**: Abandoned local approach, switched to Google Fonts CDN which works reliably.

**Lesson**: Local font loading in Electron with Tailwind CSS is unreliable. Google Fonts CDN is simpler and works if CSP is configured correctly.

---

## Bug 3: Tailwind v4 `font-[var(--font-display)]` Parsed as font-weight

**Symptom**: `font-[var(--font-display)]` class had no effect on font-family. Elements still used the default body font.

**Root Cause**: Tailwind v4's `font-` prefix maps to `font-weight` by default, not `font-family`. The arbitrary value `[var(--font-display)]` was interpreted as `font-weight: var(--font-display)` which is invalid and ignored.

**Fix**: Registered custom font families as Tailwind theme variables (`--font-serif`, `--font-sans`) in `@theme`. Used Tailwind's built-in `font-serif` and `font-sans` utilities which correctly map to `font-family`.

**Lesson**: In Tailwind v4, use `--font-serif` / `--font-sans` / `--font-mono` theme variables for font families. Don't use arbitrary values like `font-[var(...)]` for font-family — they get misinterpreted as font-weight.

---

## Bug 4: Tailwind v4 `[--color-editorial-red]` Parsed as Custom State

**Symptom**: `text-[--color-editorial-red]` triggered Chromium deprecation warnings about custom state pseudo classes.

**Root Cause**: Tailwind v4 interpreted `[--color-editorial-red]` as a CSS custom state selector, not a CSS variable reference.

**Fix**: Changed to `[var(--color-editorial-red)]` — wrapping in `var()` tells Tailwind it's a CSS variable value.

**Lesson**: In Tailwind v4 arbitrary values, always use `var()` to reference CSS custom properties. Bare `--property-name` syntax is ambiguous.

---

## Changed Files Summary

| File | Changes |
|------|---------|
| `index.html` | CSP updated for Google Fonts; font link tags added/changed multiple times |
| `globals.css` | Font variables changed 4 times (Playfair → Merriweather → Plus Jakarta Sans → Lora); @fontsource imports added then removed |
| `build-renderer.mjs` | Added font file copy step for @fontsource approach |
| All component `.tsx` files | `font-[var(--font-display)]` → `font-serif`, `font-[var(--font-body)]` → `font-sans` |
| All component `.tsx` files | `[--color-editorial-red]` → `[var(--color-editorial-red)]` |
