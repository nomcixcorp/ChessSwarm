## Cursor Cloud specific instructions

### Project overview

Chess Swarm is a TypeScript monorepo (npm workspaces) for a chess analytics dashboard. See `package.json` for the workspace layout (`apps/*`, `packages/*`).

### Key build dependency

`@chess-swarm/shared-types` must be built **before** any other package can typecheck or build. The root `build` and `typecheck` scripts already handle this ordering automatically.

### Running the frontend

```
npm run dev -w @chess-swarm/web   # Next.js dev server on port 3000
```

### Lint / typecheck / build / format

All commands are defined in the root `package.json`:

- `npm run lint` — ESLint across all workspaces
- `npm run typecheck` — TypeScript check (builds shared-types first)
- `npm run build` — full production build
- `npm run format:check` — Prettier check

### Other packages

`@chess-swarm/server`, `@chess-swarm/chess-core`, and `@chess-swarm/ai-insights` are stubs (`export {}`). They typecheck and lint but have no runnable entry points yet.

### No external services required

No database, Docker, or external API keys are needed for the current scaffold. The Chess.com API is public and does not require authentication.
