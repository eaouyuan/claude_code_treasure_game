# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev     # Vite dev server on http://localhost:3000 (opens browser automatically)
npm run server  # Auth/score API on http://localhost:3001 with `node --watch` (run alongside `dev`; Vite proxies /api to it)
npm run build   # Production build into ./build (not ./dist)
```

There is no test runner, linter, or `tsconfig.json` in this project — TypeScript is transpiled by SWC (`@vitejs/plugin-react-swc`) without type checking. `npm run build` is the only correctness check available.

## Architecture

A single-page React 18 + Vite treasure-hunt game, originally exported from Figma Make (hence `src/components/figma/`, `src/guidelines/Guidelines.md`, and the full shadcn/ui kit in `src/components/ui/`, most of which is unused).

- **All game logic and UI live in `src/App.tsx`.** State is `boxes` (3 boxes, one randomly holds treasure), `score` (+150 for treasure, −50 for skeleton), and `gameEnded` (set when treasure is found or all boxes are open). `initializeGame()` runs on mount and on "Play Again". Opening a chest plays `chest_open.mp3` (treasure) or `chest_open_with_evil_laugh.mp3` (skeleton) via `new Audio(...)`; once the game ends, a Win/Tie/Loss badge shows next to the score (`score > 0` / `=== 0` / `< 0`). The key cursor over closed chests is an inline `cursor: url(...)` style, not a CSS class.
- **Animations** use `motion/react` (Framer Motion's successor package), not `framer-motion`.
- **Assets** (`src/assets/*.png`, `src/audios/*.mp3`) are imported as ES modules and resolved by Vite to URLs.
- **Styling is precompiled.** `src/index.css` is a static Tailwind v4 build output; Tailwind itself is *not* installed and there is no Tailwind/PostCSS config. Only utility classes already present in `index.css` will work — a new class (e.g. `text-purple-600`) silently has no effect. Check `index.css` before relying on a class, or use inline styles / add the CSS rule manually. `src/styles/globals.css` (shadcn theme tokens) is not imported anywhere.
- **Import aliases** in `vite.config.ts`: `@` → `src/`, plus version-suffixed aliases (e.g. `'@radix-ui/react-slot@1.1.2'`) that the generated `components/ui/*` files import from. Keep these aliases when adding/upgrading those packages.
- **Screen flow in `App.tsx`:** `player` is `{ username }`, `'guest'`, or `null`. On load, if a token exists, `fetchMe()` restores the session (render is blank while `checkingSession`); `player === null` renders `AuthScreen`, otherwise the game. A `useEffect` on `gameEnded` calls `saveScore` → `fetchScores` for signed-in players only, and the Game Over panel shows best/games/recent from that result.
- **Backend:** `server/index.mjs` is a dependency-free Node server (`node:http` + built-in `node:sqlite`, needs Node >= 22.5) with tables `users`, `sessions`, `scores` in `server/data/game.db` (gitignored, created on startup); port is `PORT` env or 3001. Routes live in a `"METHOD /path"` → handler map: `POST /api/signup|signin|signout`, `GET /api/me`, `POST|GET /api/scores`. Passwords are scrypt `salt:hash`; sessions are random bearer tokens with no expiry. `src/api.ts` is the client (token in `localStorage` under `treasure-game-token`); a network failure surfaces as "Is `npm run server` running?". Guest mode skips the API entirely. Static hosts (GitHub Pages) can't run this server.
- `src/components/ui/utils.ts` provides the `cn()` class-merging helper used by the UI components.

## Context

`README.md` is a tutorial script for learning Claude Code on this repo (adding sound effects, win/tie/loss results, a key-cursor on hover over closed chests, an SQLite sign-up/sign-in flow with guest mode, and Vercel/GitHub Pages deploy commands as `.claude/commands/deploy_vercel.md` / `deploy_github_page.md`, which don't exist yet; the tutorial creates them). Most of those features are already implemented in this snapshot. Sound/icon source credits are in `Attributions.md` — add new asset credits there.
