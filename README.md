# genos-frontend

The Genos web client: a React + TypeScript single-page app (Vite) for chat,
tasks, projects, and collaborative notes. It talks to
[genos-api](https://github.com/genos-tech/genos-api) over REST, to
[genos-sockets](https://github.com/genos-tech/genos-sockets) over Socket.IO for
real-time messaging, and to [genos-collab](https://github.com/genos-tech/genos-collab)
over Yjs/Hocuspocus for collaborative BlockNote editing.

-   **Stack:** React 19, TypeScript, Vite 7 (SWC), Tailwind CSS 4
-   **UI:** MUI (Material / Joy) + Mantine, BlockNote editor, XYFlow
-   **Realtime / offline:** `socket.io-client`, `yjs` + `y-indexeddb`, `idb`
-   **Tests:** Vitest + Testing Library; lint via ESLint, format via Prettier

## Scripts

| Command            | What it does                            |
| ------------------ | --------------------------------------- |
| `npm run dev`      | Vite dev server on `--host --port 3000` |
| `npm run build`    | `tsc -b && vite build` → `dist/`        |
| `npm run preview`  | Serve the production build locally      |
| `npm test`         | Vitest (watch)                          |
| `npm run test:run` | Vitest (single run, used in CI)         |
| `npm run lint`     | ESLint                                  |
| `npm run format`   | Prettier `--write`                      |
| `npm run fix:all`  | Format + lint-fix in one shot           |

## Running locally

```bash
npm install
npm run dev      # http://localhost:3000
```

Configure the backend endpoints and other build-time settings via a
`.env.local` file (Vite `VITE_*` variables, e.g. the API/socket URLs and
`VITE_VAPID_PUBLIC_KEY` for web push). See
`genos-platform/docker/docker-compose.yml` for the values used in local dev.

## Deployment (Railway)

Configured by `railway.toml`:

-   **Build:** `npm install --no-audit --no-fund && npm run build`
-   **Start:** `npx serve -s dist -l $PORT` (static serve of the built SPA)
-   **Restart policy:** `ON_FAILURE`

The build is memory-hungry; CI raises Node's heap (`NODE_OPTIONS=--max-old-space-size=4096`)
and Railway's Nixpacks Node major should be 22 to match.

## CI

`.github/workflows/ci.yml` runs three jobs on push / PR:

-   **frontend-test** (required) — `vitest run --coverage`.
-   **frontend-build** (report-only) — `npm run build` (mirrors Railway's build).
-   **frontend-quality** (report-only) — `eslint .` and `prettier --check .`.

> Prettier and ESLint are wired to the repo config (`.prettierrc`,
> `eslint.config.js`). Note `.prettierrc` sets `tabWidth: 4`, which applies to
> YAML and JSON too — run `npm run format` before committing.
