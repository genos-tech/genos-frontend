# genos-frontend

The Genos web client: a React + TypeScript single-page app (Vite) for chat,
tasks, projects, and collaborative notes. It talks to
[genos-api](https://github.com/genos-tech/genos-api) over REST, to
[genos-sockets](https://github.com/genos-tech/genos-sockets) over Socket.IO for
real-time messaging, and to [genos-collab](https://github.com/genos-tech/genos-collab)
over Yjs/Hocuspocus for collaborative BlockNote editing.

- **Stack:** React 19, TypeScript, Vite 7 (SWC), Tailwind CSS 4
- **UI:** MUI (Material / Joy) + Mantine, BlockNote editor, XYFlow
- **Realtime / offline:** `socket.io-client`, `yjs` + `y-indexeddb`, `idb`
- **Tests:** Vitest + Testing Library; lint via ESLint, format via Prettier

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

- **Build:** `npm install --no-audit --no-fund && npm run build`
- **Start:** `npx serve -s dist -l $PORT` (static serve of the built SPA)
- **Restart policy:** `ON_FAILURE`

The build is memory-hungry; CI raises Node's heap (`NODE_OPTIONS=--max-old-space-size=4096`)
and Railway's Nixpacks Node major should be 22 to match.

## CI

`.github/workflows/ci.yml` runs three jobs on push / PR:

- **frontend-test** (required) — `vitest run --coverage`.
- **frontend-build** (report-only) — `npm run build` (mirrors Railway's build).
- **frontend-quality** (report-only) — `eslint .` and `prettier --check .`.

> Prettier and ESLint are wired to the repo config (`.prettierrc`,
> `eslint.config.js`). Note `.prettierrc` sets `tabWidth: 4`, which applies to
> YAML and JSON too — run `npm run format` before committing.

## Conventions

### Tooltips: `AppTooltip`, always

Every hover hint goes through `src/components/ui/AppTooltip.tsx`. Neither Joy's
raw `Tooltip` nor a native `title=` attribute used as a hint is allowed.

`AppTooltip` owns the design-system surface, so the look is decided in one
place, and it sets no `z-index`: the theme gives tooltips 13300, above every
modal in the app (`theme/purplePalette.ts`), which is higher than any of the
hand-rolled values that used to be copied around. It also renders safely with
no `CssVarsProvider` above it, so a component under test doesn't have to know
it contains a tooltip.

Needs a look the props don't cover? Add the prop to `AppTooltip` — that's what
`maxWidth`, `surface` (`"none"` for a `title` that paints its own hover card)
and `arrowColor` are. Don't reach past it with `sx`.

ESLint fails the raw import (`no-restricted-imports`), with `AppTooltip.tsx`
itself the one exemption. A native `title` can't be linted — `title` is a real
prop on `ModalDialog`, `Section` and friends — so that half is on review. On an
icon, prefer MUI's `titleAccess`: it puts the name in the accessibility tree
rather than only in a popper.

### Picking a person: `PersonPicker`

Any "add somebody" control uses `src/components/ui/PersonPicker.tsx` — type to
filter, one pick at a time, self first, avatar beside "Name - email". A roster
rendered as a row of buttons or behind a bare search box works for four
colleagues and not for forty, and the app already answered this question in the
assignee and reporter fields.

It resolves avatars from `AvatarContext` (via `UserAvatar`) rather than taking
the four hooks `AvatarWithStatus` needs, so a modal can use it without that
plumbing. A task's own pickers stay on `ACTeamUsers` / `MultiMemberPicker`,
which show live presence.

Feed it `ownTeamOnly(...)` (`utils/teamRoster.ts`) unless you have a specific
reason not to: the roster deliberately includes people from teams you share work
with, and offering them is offering an action the server refuses.

### One team at a time

A person can belong to several teams, and the workspace shows exactly one. So
"mine" is never a sufficient scope for a list: every user-scoped list is also
team-scoped, or it shows another team's data in this team's shell. The chat list
(`?team_id=` on `GET /api/v3/channels/`) and the activity feed (`?team_id=` on
`GET /api/v3/activities/`) were each fixed for this, in that order.

Two things make it easy to get wrong:

- **User socket rooms carry every team.** `activity.created`, `read.advanced`,
  `pin.*` and `flag.*` are pushed to `user:{id}`, which the client is in
  regardless of which team is on screen. A handler that writes the payload
  straight to IndexedDB has just imported another team's row — see the team
  check in `features/chat/services/handleV3Activity.ts`.
- **A cached row can outlive its scope.** Switching teams wipes the team-scoped
  stores (`useAppInitialization` → `DatabaseUtils.clearTeamScopedStores`), but a
  row already in a store keeps whatever fields it was written with. Adding a
  team to a stored shape means bumping that store's `syncWithCheckpoint` key too,
  or an incremental sync will never re-fetch the rows that lack it.
