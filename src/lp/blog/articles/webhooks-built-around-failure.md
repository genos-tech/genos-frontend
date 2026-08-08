<!-- Generated from genos-docs/marketing/REDDIT_WEBDEV_WEBHOOK_FAILURES.md. Run npm run blog:sync; do not edit this copy directly. -->

Disclosure: this is from Genos, the product I am building. I recently added API
keys, a public projects/tasks API, and outbound webhooks.

The web app now has a Developer settings panel for creating and revoking keys and
webhook endpoints. Each plaintext key or signing secret is shown once, and there is
also a public developer reference. That made the backend behavior an external
contract rather than just an internal endpoint.

The first webhook checklist looked solid:

- write a delivery row instead of POSTing in the request path;
- start delivery only after the triggering transaction commits;
- sign `timestamp + "." + raw_body` with HMAC-SHA256;
- keep a stable delivery ID across retries;
- retry failed deliveries up to five attempts with 1, 2, 4, and 8 minute delays;
- disable an endpoint after 10 consecutive failed attempts;
- require HTTPS, reject credentials and non-public DNS results, resolve again
  before sending, and never follow redirects.

The DNS checks matter because this is the first feature in the codebase that lets a
customer choose where the server makes an outbound request. Without them, a webhook
URL is an SSRF proxy into private services or a cloud metadata address.

Events are stored in a database-backed outbox and drained by a minutely job. Rows
are claimed with a conditional update so overlapping jobs do not intentionally take
the same pending row, and a stale claim can be revived after a worker dies.

There is an important limitation: the delivery row is created from a Django
`on_commit` callback. That prevents publishing rolled-back state, but the outbox
insert is not atomic with the business transaction. If that insert fails after the
commit, the task write survives and the event is logged and lost. Calling this a
"transactional outbox" without that qualification would be inaccurate.

The part that changed my confidence was testing the public contract separately from
the implementation. Exact key-set tests and bad-input sweeps later found eight
request shapes that could crash instead of returning a 4xx. They also found that
`created_at` was silently `null` on message and task-comment webhook payloads: the
models use `ts_sent_at`, while defensive attribute lookup hid the wrong field name.

The task payload and public task API now have an exact shared key set in tests, and
message/comment timestamps are asserted non-null. That still does not prove
delivery semantics.

My question for people operating webhook systems:

**Would you accept this best-effort post-commit outbox for an MVP, or require the
outbox row in the same database transaction before exposing webhooks at all?**

I am also interested in what you test beyond signatures and happy-path retries:
DNS rebinding, redirect SSRF, duplicate delivery, stale worker claims, schema drift,
or something else I am still missing?

If the subreddit permits one project link, the public demo is
<https://genosai.dev>. I am looking for criticism of the failure model, not webhook
signups.
