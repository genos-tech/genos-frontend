# LP Blog (`src/lp/blog/`)

English-only public blog for genosai.dev. Japanese marketing drafts in
`genos-docs/marketing` (note / Zenn) stay platform-specific and are **not**
synced here.

## Add a post

1. Write the English draft under `genos-docs/marketing/`.
2. Append one object to [`articles.json`](./articles.json):
    - `slug` — URL segment (`/blog/<slug>`)
    - `source` — filename in genos-docs/marketing
    - `bodyHeading` — markdown heading that starts the publishable body
      (e.g. `## Article body`)
    - optional `stopHeading` — cut the body before this heading
    - `title`, `excerpt`, `category`, `publishedAt` (`YYYY-MM-DD`)
    - `language` must be `"en"`
    - optional `featured: true` for the index highlight grid
3. From `genos-frontend/` (with sibling `genos-docs` present):

```bash
npm run blog:sync
```

4. Commit `articles.json` and the new `articles/<slug>.md`.

`npm run blog:check` fails if generated snapshots are stale.
The sync script formats generated Markdown with the frontend's Prettier config,
so `blog:sync` and the repository-wide `prettier --check .` stay compatible.

Deploy never reads `genos-docs`; only the snapshots in this folder ship.
