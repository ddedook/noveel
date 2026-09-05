# Noveel

Electron desktop AI novel editor.

## Stack

- Electron + electron-vite + React 19 + TypeScript
- HeroUI v3 (`@heroui/react` + `@heroui/styles`) + Tailwind CSS 4
- PGlite (registry + per-novel databases)
- DeepSeek Harness (vendored DSH runtime, in-process Host boot)

## Development

```bash
pnpm sync:vendor # first time / after vendor update
pnpm install
pnpm dev
```

## Architecture

- **Left sidebar**: novel/session tree (collapsible 56px rail / 280px expanded, resizable)
- **Center**: novel feature pages (HeroUI)
- **Right**: native AI chat panel (collapsible, resizable)
- **Main process**: PGlite, IPC, DSH in-process boot, noveel tools

## Data

- Registry DB: `{userData}/registry/pglite`
- Per-novel DB: `{userData}/novels/{novelId}/pglite`

## Keyboard shortcuts

- `Cmd/Ctrl + \` — toggle sidebar
- `Cmd/Ctrl + Shift + \` — toggle AI chat panel
