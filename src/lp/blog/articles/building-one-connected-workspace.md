<!-- Generated from genos-docs/marketing/REDDIT_SIDEPROJECT.md. Run npm run blog:sync; do not edit this copy directly. -->

Solo dev here. This started as a personal itch that got completely out of hand.

Every project I worked on looked the same: the discussion happened in Slack,
the decision got written down in Notion (sometimes), and the work got tracked
in Jira. Three subscriptions, and somehow the answer to "why are we even doing
this task?" lived in none of them. It lived in whoever remembered the thread.

The thing that finally broke me: I'd scroll Slack search results for 20
minutes looking for a decision I *knew* existed, find half of it, and realize
the other half was in a doc that had been out of date for a month.

And here's the part that surprised me — connecting AI to these tools doesn't
really fix it. I tried. The AI can fetch your messages, your docs, your
tickets. But it can't know *which discussion created which task*, or *which
decision made which doc obsolete*. Those links only exist in people's heads.
Retrieval isn't understanding.

So I built Genos: chat, docs, and tasks in one workspace, where everything
belongs to the same project and links to each other. Because the connections
actually exist in the data, the built-in AI can answer stuff like "why are we
building this feature?" with links to the original discussion, the spec, and
the task — instead of guessing.

Honest status: it's an MVP. I built it alone, the AI is still improving, and
it's web-only for now. There's a demo you can poke at without signing up, and
a free plan with no credit card: https://genosai.dev

I'd genuinely love brutal feedback — especially from anyone whose team also
plays "where was that discussed again?" every week. What would make something
like this actually replace your current stack, and what would stop you?
