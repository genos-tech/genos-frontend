# LP Blog (`src/lp/blog/`)

English-only public blog for genosai.dev. Its posts live in
`genos-docs/marketing/blog/`. The platform drafts beside that folder are **not**
synced here.

A post is picture first: a real app screenshot (from the demo workspace) or a
` ```flow ` block (one box per line) comes first. Then it says why the feature
matters: a real situation, why it is hard today, how the feature helps, what the
reader gets and how to start. Short paragraphs under `##` headings, about 300 to
600 words. Check every product claim against the code and the app; no invented
customers, numbers or quotes.

## Add a post

1. Write the English draft under `genos-docs/marketing/blog/`.
2. Append one object to [`articles.json`](./articles.json):
    - `slug` — URL segment (`/blog/<slug>`)
    - `source` — path under genos-docs/marketing, e.g. `blog/<slug>.md`
    - `bodyHeading` — markdown heading that starts the publishable body
      (e.g. `## Article body`)
    - optional `stopHeading` — cut the body before this heading
    - `title`, `excerpt`, `category`, `publishedAt` (`YYYY-MM-DD`)
    - `language` must be `"en"`
    - `cover` (a picture under `public/`) or `coverFlow` (2-4 short labels)
3. From `genos-frontend/` (with sibling `genos-docs` present):

```bash
npm run blog:sync
```

4. Commit `articles.json` and the new `articles/<slug>.md`.

`npm run blog:check` fails if generated snapshots are stale.
The sync script formats generated Markdown with the frontend's Prettier config,
so `blog:sync` and the repository-wide `prettier --check .` stay compatible.

Deploy never reads `genos-docs`; only the snapshots in this folder ship.
