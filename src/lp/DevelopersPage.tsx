import { ArrowLeft, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * `/developers` — the public API, webhook and WebSocket reference.
 *
 * Public and auth-free, same shell as `/legal` and `/privacy`: an
 * integrator evaluating Genos has no account yet, so anything they need
 * in order to decide has to be readable without one.
 *
 * **Every example on this page is a real request against a real shape.**
 * The REST responses are the exact key sets asserted by
 * `test_api_contract.py`; the socket required-fields are quoted from the
 * handlers' own validation messages. That matters because a docs page is
 * the one artifact nothing else depends on, so nothing else catches it
 * being wrong — this file has already shipped a `gen_live_` key prefix
 * that does not exist, and a socket event list missing two events.
 *
 * Hand-rendered rather than a bundled Swagger UI: the explorer is ~1MB
 * and this sits in the marketing bundle, which has a documented entry
 * critical-path budget. The machine-readable spec is published from the
 * API itself so there is no second copy to drift.
 *
 * Keep in sync with:
 *   - `genos-api/origin/views/public/openapi.py`   (REST — drift-tested)
 *   - `genos-api/origin/tests/test_api_contract.py` (the key sets)
 *   - `genos-sockets/WEBSOCKET_EVENTS.md`          (extracted from handlers)
 */

const API_BASE = import.meta.env.VITE_DJANGO_URL || "https://api.genosai.dev";
const WS_BASE = import.meta.env.VITE_WS_BASE_URL || "wss://ws.genosai.dev";
const SPEC_URL = `${API_BASE}/api/public/v1/openapi.json`;

// Consistent throughout so an example can be followed end to end.
const TEAM_ID = "7f3a91c2-4d5e-4a1b-9c8d-2e6f0b4a7d13";
const PROJECT_ID = 42;
const TASK_ID = 4821;
const CHANNEL_ID = "c0f39cee-051b-4137-a13a-2aa9fdf0f279";

type Row = { name: string; type?: string; meaning: React.ReactNode };

const Section = ({
    id,
    title,
    subtitle,
    children,
}: {
    id: string;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
}) => (
    <section className="mt-14 scroll-mt-6" id={id}>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        <div className="mt-4">{children}</div>
    </section>
);

const Endpoint = ({
    method,
    path,
    children,
}: {
    method: string;
    path: string;
    children: React.ReactNode;
}) => (
    <div className="mt-8 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-violet-600 px-2 py-0.5 font-mono text-xs font-bold text-white">
                {method}
            </span>
            <span className="font-mono text-sm break-all text-slate-800 dark:text-slate-100">
                {path}
            </span>
        </div>
        <div className="mt-3">{children}</div>
    </div>
);

const Code = ({ children }: { children: React.ReactNode }) => (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.8125rem] text-violet-700 dark:bg-slate-800 dark:text-violet-300">
        {children}
    </code>
);

const Pre = ({ children, label }: { children: string; label?: string }) => (
    <div className="mt-3">
        {label && (
            <div className="mb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">
                {label}
            </div>
        )}
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 font-mono text-[0.8125rem] leading-6 text-slate-100 dark:bg-black/60">
            {children}
        </pre>
    </div>
);

const Params = ({ rows, title }: { rows: Row[]; title: string }) => (
    <div className="mt-4">
        <div className="text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">
            {title}
        </div>
        <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                <tbody>
                    {rows.map((r) => (
                        <tr
                            key={r.name}
                            className="border-b border-slate-100 dark:border-slate-800"
                        >
                            <td className="py-2 pr-3 align-top whitespace-nowrap">
                                <Code>{r.name}</Code>
                            </td>
                            <td className="py-2 pr-3 align-top font-mono text-xs whitespace-nowrap text-slate-400">
                                {r.type}
                            </td>
                            <td className="py-2 align-top text-slate-600 dark:text-slate-300">
                                {r.meaning}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

const TASK_JSON = `{
  "id": ${TASK_ID},
  "display_id": "ENG-42",
  "title": "Ship the public API",
  "status": "Open",
  "priority": "High",
  "project_id": ${PROJECT_ID},
  "team_id": "${TEAM_ID}",
  "assignee_id": "c54505c5-d24a-4f1a-bf23-ddd135645b88",
  "reporter_id": "f0610fcf-38bb-4c32-a646-34f55238899c",
  "due_date": "2026-08-09",
  "start_date": "2026-08-02",
  "created_at": "2026-08-02T01:00:00+00:00",
  "updated_at": "2026-08-02T04:31:00+00:00"
}`;

export default function DevelopersPage() {
    return (
        <main className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#faf7ff_44%,#ffffff_100%)] px-4 py-10 text-slate-950 sm:px-6 lg:px-8 dark:bg-[linear-gradient(180deg,#020617_0%,#111827_48%,#020617_100%)] dark:text-white">
            <div className="mx-auto max-w-3xl">
                <Link
                    className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-violet-700 dark:text-slate-400 dark:hover:text-white"
                    to="/home"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Genos
                </Link>

                <h1 className="mt-6 text-2xl font-black sm:text-3xl">Developers</h1>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    REST API, MCP, outbound webhooks, and the realtime event stream.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                    <a
                        className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-3.5 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 dark:border-violet-500/40 dark:bg-slate-900 dark:text-violet-300 dark:hover:bg-slate-800"
                        href={SPEC_URL}
                        rel="noreferrer"
                        target="_blank"
                    >
                        openapi.json
                        <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                </div>
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    Served by the API itself and drift-tested against the routes, so it cannot fall
                    behind this page. Import it into Postman, Insomnia, or a client generator.
                </p>

                <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-violet-700 dark:text-violet-300">
                    {[
                        ["auth", "Authentication"],
                        ["mcp", "MCP"],
                        ["rest", "REST"],
                        ["errors", "Errors & limits"],
                        ["webhooks", "Webhooks"],
                        ["realtime", "Realtime"],
                        ["stability", "Stability"],
                    ].map(([id, label]) => (
                        <a key={id} className="hover:underline" href={`#${id}`}>
                            {label}
                        </a>
                    ))}
                </nav>

                {/* ── auth ─────────────────────────────────────────── */}
                <Section
                    id="auth"
                    subtitle="Create a key in Settings → Developer. It is shown once and cannot be recovered."
                    title="Authentication"
                >
                    <Pre label="every request">{`curl ${API_BASE}/api/public/v1/me/ \\
  -H "Authorization: ApiKey gnos_xxxxxxxxxxxxxxxxxxxxxxxx"`}</Pre>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        The scheme is <Code>ApiKey</Code>, not <Code>Bearer</Code> — a key must
                        never be mistaken for a session token by anything that only looks for{" "}
                        <Code>Bearer</Code>.
                    </p>

                    <Params
                        rows={[
                            {
                                name: "personal access token",
                                type: "team_id required",
                                meaning: (
                                    <>
                                        Acts as you, across <b>every</b> team you belong to.
                                        Because it spans teams, any endpoint that needs a team must
                                        be told which one — pass <Code>team_id</Code>.
                                    </>
                                ),
                            },
                            {
                                name: "team-scoped key",
                                type: "team_id ignored",
                                meaning: (
                                    <>
                                        Bound to one team, which is then implied. Passing a
                                        different <Code>team_id</Code> does not widen it.
                                    </>
                                ),
                            },
                            {
                                name: "read scope",
                                type: "GET only",
                                meaning: (
                                    <>
                                        Writes answer <Code>403</Code> — never a silent no-op.
                                    </>
                                ),
                            },
                            {
                                name: "write scope",
                                type: "GET/POST/PATCH",
                                meaning: "Required for anything that changes data.",
                            },
                        ]}
                        title="Key kinds"
                    />

                    <Pre label="start here — confirms the key is live and says what it can do">{`GET /api/public/v1/me/

{
  "user_id": "c54505c5-d24a-4f1a-bf23-ddd135645b88",
  "username": "kentaro",
  "email": "kentaro@example.com",
  "key": {
    "id": "9b2e1f04-7c3a-4d88-a1e5-6f2b0c9d4a71",
    "name": "CI deploy bot",
    "scope": "write",
    "team_id": null          // null = personal access token
  }
}`}</Pre>
                </Section>

                {/* ── mcp ──────────────────────────────────────────── */}
                <Section
                    id="mcp"
                    subtitle="One endpoint. An MCP client reads and updates your tasks with an API key."
                    title="MCP"
                >
                    <p className="mb-4 inline-flex rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-violet-200">
                        Available on the Pro plan and above. The REST API below is on every plan.
                    </p>
                    <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                        With this endpoint an agent works the task itself, instead of you pasting
                        the description into it and pasting the result back. Point Claude Code — or
                        any MCP client — at it with an API key and it can find a task, read its
                        description and its blockers, search the workspace, and, with a write key,
                        update the task or leave a comment.
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        There is no model on this side of the connection. The endpoint is a
                        JSON-RPC dispatcher over the same tools the in-app agent uses — your client
                        does the reasoning, Genos answers questions about the workspace and writes
                        what it is told to.
                    </p>

                    <Pre label="the whole setup">{`claude mcp add --transport http genos \\
  "${API_BASE}/api/public/v1/mcp?team_id=${TEAM_ID}" \\
  --header "Authorization: ApiKey gnos_…"`}</Pre>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        Every message is one <Code>POST</Code> and one JSON object back — a
                        notification, which carries no id, gets an empty <Code>202</Code>. No SSE
                        stream, no session to keep alive, no batching. Four protocol revisions are
                        supported: a legacy client settles on one at <Code>initialize</Code>, a
                        2026-07-28 client names it on every request, so there is nothing to
                        configure.
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        A personal access token spans every team you belong to, so it has to be
                        told which one — append <Code>?team_id=&lt;uuid&gt;</Code> to the server
                        URL, as the setup above does. A team-scoped key carries its own team and
                        needs no parameter. With neither, everything past the handshake —{" "}
                        <Code>tools/list</Code> included — answers <Code>-32602</Code> and says so.
                    </p>

                    <Endpoint method="POST" path="/api/public/v1/mcp">
                        <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                            No trailing slash, unlike the REST routes below. This URL is pasted
                            into a client config by hand, and Django&apos;s append-slash rescue is
                            no help on a <Code>POST</Code> — the redirect drops the body — so a
                            wrong one fails as a broken message rather than being fixed for you.
                        </p>
                        <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                            Only <Code>POST</Code> and <Code>OPTIONS</Code> are answered. Claude
                            Code opens by asking for an event stream with a <Code>GET</Code>, takes
                            the <Code>405</Code> and carries on — that line in your proxy log is
                            not a fault.
                        </p>
                        <Pre label="request — one message, without a client">{`curl -X POST "${API_BASE}/api/public/v1/mcp?team_id=${TEAM_ID}" \\
  -H "Authorization: ApiKey gnos_…" \\
  -H "Content-Type: application/json" \\
  -d '{
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
          "name": "get_task",
          "arguments": { "task_id": "ENG-42" }
        }
      }'`}</Pre>
                        <Pre label="200">{`{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "…a one-line summary, then the task as JSON" }],
    "structuredContent": { "task_id": ${TASK_ID}, "display_id": "ENG-42", "content_markdown": "…", … },
    "isError": false
  }
}`}</Pre>
                        <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                            <Code>structuredContent</Code> is the same payload already parsed, so a
                            client that understands it does not have to re-read ours.
                        </p>
                    </Endpoint>

                    <Params
                        rows={[
                            {
                                name: "get_task",
                                type: "read",
                                meaning: (
                                    <>
                                        One task in full. Read <Code>content_markdown</Code> for
                                        the description — it keeps headings, checklists and code
                                        fences.
                                    </>
                                ),
                            },
                            {
                                name: "list_my_tasks",
                                type: "read",
                                meaning:
                                    "What is on your plate. Where an agent starts when no task is named.",
                            },
                            {
                                name: "list_tasks",
                                type: "read",
                                meaning:
                                    "Tasks you can see — your projects, plus anything you are assignee or reporter on — by project, milestone, status, priority, assignee or overdue.",
                            },
                            {
                                name: "list_projects",
                                type: "read",
                                meaning: "The projects you belong to.",
                            },
                            {
                                name: "list_milestones",
                                type: "read",
                                meaning: "Milestones in the projects you belong to.",
                            },
                            {
                                name: "get_milestone_summary",
                                type: "read",
                                meaning: "A milestone and the tasks under it.",
                            },
                            {
                                name: "get_task_blockers",
                                type: "read",
                                meaning: "What a task is waiting on.",
                            },
                            {
                                name: "search_workspace",
                                type: "read",
                                meaning: "Search across tasks, notes, chat and todos.",
                            },
                            { name: "get_note", type: "read", meaning: "A note's body." },
                            {
                                name: "get_current_user",
                                type: "read",
                                meaning: "Who the key acts as.",
                            },
                            {
                                name: "get_team_members",
                                type: "read",
                                meaning: "Who is in the team, for assigning.",
                            },
                            {
                                name: "update_task",
                                type: "write",
                                meaning:
                                    "Status, title, description, priority, effort or due date. Reassigning is not exposed.",
                            },
                            {
                                name: "add_comment",
                                type: "write",
                                meaning: "A comment on a task.",
                            },
                            {
                                name: "create_task",
                                type: "write",
                                meaning: (
                                    <>
                                        Needs a project id from <Code>list_projects</Code>.
                                    </>
                                ),
                            },
                        ]}
                        title="Tools · scope"
                    />
                    <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        Fourteen, out of the 57 the in-app agent has — the ones worth a round trip
                        from outside, rather than the whole surface. A read-scoped key&apos;s{" "}
                        <Code>tools/list</Code> returns the eleven reads only: the three writes are
                        not listed at all, so an agent never plans around a tool it would be
                        refused.
                    </p>

                    <h3 className="mt-8 text-base font-bold text-slate-800 dark:text-slate-100">
                        What the agent can see
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        A key acts as the person who created it, and every tool re-checks that
                        person&apos;s permissions on the call. The agent sees exactly what you see
                        — a private project you are not in does not exist as far as it is concerned
                        — and anything it writes is attributed to you in the task&apos;s activity
                        feed.
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        A team-scoped key is the same principal pinned to one team: it still acts
                        as its creator. Membership is re-checked on every request rather than
                        trusted from the key, because a key goes on naming its team after its owner
                        has been removed from that team.
                    </p>

                    <h3 className="mt-8 text-base font-bold text-slate-800 dark:text-slate-100">
                        Naming a task
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        A person names a task in whichever form is in front of them, so all of them
                        resolve:
                    </p>
                    <Pre>{`display id   ENG-42
raw id       #${TASK_ID}  /  ${TASK_ID}
pasted url   https://app.genosai.dev/workspace/tasks/project/${PROJECT_ID}/task/${TASK_ID}`}</Pre>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        Resolved before the tool runs, and only on the four tools that take a task:{" "}
                        <Code>get_task</Code>, <Code>get_task_blockers</Code>,{" "}
                        <Code>update_task</Code> and <Code>add_comment</Code>. The rest take
                        ordinary arguments — <Code>list_tasks</Code> does not accept a display id.
                        A reference that does not resolve comes back as a tool error saying what to
                        try instead, so the agent retries rather than stops.
                    </p>

                    <h3 className="mt-8 text-base font-bold text-slate-800 dark:text-slate-100">
                        Read keys, and what a refusal looks like
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        Scope is not read off the HTTP method here, because every MCP message is a{" "}
                        <Code>POST</Code> — <Code>tools/list</Code> and a read-only{" "}
                        <Code>tools/call</Code> included. Going by the method would refuse a read
                        key on every request it ever makes, so scope is enforced per tool instead:{" "}
                        <Code>update_task</Code>, <Code>add_comment</Code> and{" "}
                        <Code>create_task</Code> need a write key, and nothing else does.
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        This is the one place the endpoint differs from the REST routes below,
                        where a read key attempting a write is a <Code>403</Code>. If a read key
                        calls a write tool here — off a tool list it cached before the key changed,
                        say — the call succeeds and the <i>result</i> reports the refusal, in a
                        sentence naming the scope it needs and confirming that reads still work.
                    </p>
                    <Pre label="200 — a successful call whose result carries the refusal">{`"result": {
  "content": [{ "type": "text", "text": "\`update_task\` writes to the workspace, and this API key is read-only. …" }],
  "isError": true
}`}</Pre>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        That is the general rule. Anything the caller could fix by trying
                        differently — a task reference that does not resolve, a permission it does
                        not hold, the wrong key scope — arrives as a result carrying{" "}
                        <Code>isError</Code>, because a model can read that and do something else.
                        Only a disagreement about what exists, an unknown tool name, is a protocol
                        error.
                    </p>
                </Section>

                {/* ── rest ─────────────────────────────────────────── */}
                <Section id="rest" subtitle="Base URL for every route below." title="REST">
                    <Pre>{`${API_BASE}/api/public/v1`}</Pre>

                    <Endpoint method="GET" path="/projects/">
                        <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                            Projects you belong to — not every project in the team.
                        </p>
                        <Params
                            rows={[
                                {
                                    name: "team_id",
                                    type: "uuid",
                                    meaning: "Required for a personal access token.",
                                },
                            ]}
                            title="Query"
                        />
                        <Pre label="request">{`curl "${API_BASE}/api/public/v1/projects/?team_id=${TEAM_ID}" \\
  -H "Authorization: ApiKey gnos_…"`}</Pre>
                        <Pre label="200">{`{
  "projects": [
    {
      "id": ${PROJECT_ID},
      "name": "Engineering",
      "code": "ENG",
      "team_id": "${TEAM_ID}",
      "is_private": false,
      "created_at": "2026-05-01T09:00:00+00:00"
    }
  ]
}`}</Pre>
                    </Endpoint>

                    <Endpoint method="GET" path="/tasks/">
                        <Params
                            rows={[
                                {
                                    name: "team_id",
                                    type: "uuid",
                                    meaning: "Required for a personal access token.",
                                },
                                {
                                    name: "project_id",
                                    type: "integer",
                                    meaning: (
                                        <>
                                            Narrow to one project you belong to. A project you are
                                            not in answers <Code>404</Code>.
                                        </>
                                    ),
                                },
                                {
                                    name: "limit",
                                    type: "integer",
                                    meaning:
                                        "Default 50, max 100. Out-of-range values are clamped.",
                                },
                                {
                                    name: "offset",
                                    type: "integer",
                                    meaning: (
                                        <>
                                            Default 0, max 1,000,000. Beyond that is a{" "}
                                            <Code>400</Code> rather than an empty page — it is
                                            almost always a paging-loop bug.
                                        </>
                                    ),
                                },
                            ]}
                            title="Query"
                        />
                        <Pre label="request">{`curl "${API_BASE}/api/public/v1/tasks/?team_id=${TEAM_ID}&project_id=${PROJECT_ID}&limit=2" \\
  -H "Authorization: ApiKey gnos_…"`}</Pre>
                        <Pre label="200 — page through with offset until offset + limit >= total">{`{
  "tasks": [ ${TASK_JSON.split("\n").join("\n    ")} ],
  "total": 137,
  "limit": 2,
  "offset": 0
}`}</Pre>
                    </Endpoint>

                    <Endpoint method="POST" path="/tasks/">
                        <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                            Requires a <Code>write</Code> key.
                        </p>
                        <Params
                            rows={[
                                {
                                    name: "title",
                                    type: "string",
                                    meaning: "Required. Trimmed, max 255.",
                                },
                                {
                                    name: "project_id",
                                    type: "integer",
                                    meaning: "Required. Must be a project you belong to.",
                                },
                                {
                                    name: "team_id",
                                    type: "uuid",
                                    meaning: "Required for a personal access token.",
                                },
                                { name: "status", type: "string", meaning: 'Defaults to "Open".' },
                                { name: "priority", type: "string", meaning: "Optional." },
                                { name: "assignee_id", type: "uuid", meaning: "Optional." },
                                {
                                    name: "due_date",
                                    type: "date",
                                    meaning: "Optional, YYYY-MM-DD.",
                                },
                            ]}
                            title="Body"
                        />
                        <Pre label="request">{`curl -X POST ${API_BASE}/api/public/v1/tasks/ \\
  -H "Authorization: ApiKey gnos_…" \\
  -H "Content-Type: application/json" \\
  -d '{
        "team_id": "${TEAM_ID}",
        "project_id": ${PROJECT_ID},
        "title": "Ship the public API",
        "priority": "High",
        "due_date": "2026-08-09"
      }'`}</Pre>
                        <Pre label="201 — the created task, same shape a GET returns">
                            {TASK_JSON}
                        </Pre>
                    </Endpoint>

                    <Endpoint method="GET · PATCH" path={`/tasks/{task_id}/`}>
                        <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                            <Code>PATCH</Code> requires a <Code>write</Code> key and accepts an{" "}
                            <b>allowlist</b> — <Code>title</Code>, <Code>status</Code>,{" "}
                            <Code>priority</Code>. Anything else is ignored, so a new column never
                            joins the public API by accident. Sending none of them is a{" "}
                            <Code>400</Code>.
                        </p>
                        <Pre label="request">{`curl -X PATCH ${API_BASE}/api/public/v1/tasks/${TASK_ID}/ \\
  -H "Authorization: ApiKey gnos_…" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "Closed"}'`}</Pre>
                        <Pre label="200 — the updated task">
                            {TASK_JSON.replace('"Open"', '"Closed"')}
                        </Pre>
                    </Endpoint>
                </Section>

                {/* ── errors ───────────────────────────────────────── */}
                <Section
                    id="errors"
                    subtitle={'Every error body is { "error": "…" }.'}
                    title="Errors and limits"
                >
                    <Params
                        rows={[
                            {
                                name: "400",
                                meaning: "Malformed input — the message names the field.",
                            },
                            { name: "401", meaning: "Missing, unknown, revoked or expired key." },
                            {
                                name: "403",
                                meaning: (
                                    <>
                                        A <Code>read</Code> key attempted a write, or a session JWT
                                        was used instead of a key.
                                    </>
                                ),
                            },
                            {
                                name: "404",
                                meaning: (
                                    <>
                                        Not found <b>or</b> not yours — deliberately the same
                                        answer, so ids cannot be probed for existence.
                                    </>
                                ),
                            },
                            { name: "429", meaning: "Rate limited. Back off and retry." },
                        ]}
                        title="Status codes"
                    />
                    <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        Bad input is always a <Code>4xx</Code>, never a <Code>5xx</Code> — every
                        documented parameter is swept with wrong-type, negative and oversized
                        values in the test suite, because a 500 tells an integrator nothing about
                        what they got wrong.
                    </p>
                </Section>

                {/* ── webhooks ─────────────────────────────────────── */}
                <Section
                    id="webhooks"
                    subtitle="Genos POSTs to your URL when something happens. Configure in Settings → Developer."
                    title="Webhooks"
                >
                    <Params
                        rows={[
                            {
                                name: "task.created",
                                type: "project",
                                meaning: "A task was created.",
                            },
                            {
                                name: "task.updated",
                                type: "project",
                                meaning:
                                    "One event per task per action, not one per changed field.",
                            },
                            {
                                name: "task.completed",
                                type: "project",
                                meaning: "A task moved into a closed status.",
                            },
                            {
                                name: "task.comment_created",
                                type: "project",
                                meaning: "Carries the comment body.",
                            },
                            {
                                name: "message.created",
                                type: "channel",
                                meaning: (
                                    <>
                                        Carries <Code>body_text</Code>. Requires an explicit
                                        channel list — see below.
                                    </>
                                ),
                            },
                        ]}
                        title="Events · scoped by"
                    />

                    <h3 className="mt-8 text-base font-bold text-slate-800 dark:text-slate-100">
                        Scope — which objects you hear about
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        Subscribing to an event type does not have to mean the whole team. The two
                        filters deliberately behave differently when empty:
                    </p>
                    <Pre>{`project_ids: []                  → every project    (a filter, unset)
project_ids: [${PROJECT_ID}]                → only that project

channel_ids: []                  → NO channel       (an allow-list, empty)
channel_ids: ["${CHANNEL_ID.slice(0, 8)}…"]  → only that channel`}</Pre>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        Task events default to the whole team. <b>Chat does not.</b> A chat payload
                        carries what people actually wrote, and a webhook is configured by one
                        admin on behalf of everyone who talks in that channel — so{" "}
                        <Code>message.created</Code> requires you to name the channels. There is no
                        subscribe-to-all-chat, and{" "}
                        <b>direct messages can never be subscribed to</b>.
                    </p>

                    <Pre label="creating an endpoint (session JWT, owner/editor only)">{`curl -X POST ${API_BASE}/api/v2/webhooks/ \\
  -H "Authorization: Bearer <session JWT>" \\
  -H "Content-Type: application/json" \\
  -d '{
        "team_id": "${TEAM_ID}",
        "url": "https://your.app/genos",
        "events": ["task.created", "task.comment_created"],
        "project_ids": [${PROJECT_ID}],
        "channel_ids": []
      }'

// 201 — "secret" is returned ONCE and never again
{ "id": "…", "url": "https://your.app/genos", "secret": "whsec_…", … }`}</Pre>

                    <h3 className="mt-8 text-base font-bold text-slate-800 dark:text-slate-100">
                        What you receive
                    </h3>
                    <Pre label="POST to your URL">{`X-Genos-Event:     task.created
X-Genos-Delivery:  8f14e45f-ceea-467a-9f6b-1c2d3e4f5a6b
X-Genos-Timestamp: 1785638400
X-Genos-Signature: sha256=9d8c7b6a…

{
  "event": "task.created",
  "data": ${TASK_JSON.split("\n").join("\n  ")}
}`}</Pre>
                    <Pre label="message.created data">{`{
  "id": 8412,
  "channel_id": "${CHANNEL_ID}",
  "channel_kind": 2,
  "channel_title": "Engineering",
  "team_id": "${TEAM_ID}",
  "author_id": "c54505c5-d24a-4f1a-bf23-ddd135645b88",
  "body_text": "Deploy is green, shipping it",
  "thread_root_id": null,
  "is_thread_reply": false,
  "created_at": "2026-08-02T04:31:00+00:00"
}`}</Pre>

                    <h3 className="mt-8 text-base font-bold text-slate-800 dark:text-slate-100">
                        Verifying a delivery
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        The timestamp is <b>inside</b> the signed string, so a captured delivery
                        cannot be replayed later. <Code>X-Genos-Delivery</Code> is stable across
                        retries — key your idempotency off it.
                    </p>
                    <Pre>{`signed   = f"{timestamp}.".encode() + raw_body
expected = "sha256=" + hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
hmac.compare_digest(expected, request.headers["X-Genos-Signature"])`}</Pre>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        Reply <Code>2xx</Code> quickly and do your work afterwards. Failures retry
                        with exponential backoff; an endpoint that keeps failing is disabled and
                        shown as such in Settings.
                    </p>
                </Section>

                {/* ── realtime ─────────────────────────────────────── */}
                <Section
                    id="realtime"
                    subtitle="Socket.IO on the /v3 namespace. Use webhooks for server-to-server; use this for a live UI."
                    title="Realtime"
                >
                    <Pre label="connect">{`const socket = io("${WS_BASE}/v3", {
  extraHeaders: { Authorization: "Bearer <access token>" },
});`}</Pre>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        The server resolves the user <b>from the token</b> and disconnects on
                        mismatch — a client-supplied user id is never trusted. Room membership is
                        derived from your actual channels and teams, not from connect arguments.
                    </p>

                    <h3 className="mt-8 text-base font-bold text-slate-800 dark:text-slate-100">
                        Every emit is acknowledged
                    </h3>
                    <Pre>{`socket.emit("message.send", {
  channel_id: "${CHANNEL_ID}",
  body: [{ type: "paragraph", content: "Deploy is green" }],
  body_text: "Deploy is green",
  correlation_id: "local-7",          // echoed back on the ack AND the broadcast
}, (ack) => {
  if (!ack.ok) console.error(ack.code, ack.message);
});

// success  { ok: true,  data: { … }, correlation_id: "local-7" }
// failure  { ok: false, code: "VALIDATION_FAILED",
//            message: "channel_id is required.", correlation_id: "local-7" }`}</Pre>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        Key your handling off <Code>code</Code>, never <Code>message</Code> — the
                        text is for a human reading a log. Codes: <Code>UNAUTHENTICATED</Code>,{" "}
                        <Code>VALIDATION_FAILED</Code>, <Code>FORBIDDEN</Code>,{" "}
                        <Code>BACKEND_ERROR</Code>.
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        <Code>correlation_id</Code> comes back on the ack <i>and</i> the resulting
                        broadcast, which is how a sender matches the server-confirmed message to
                        its own optimistic copy instead of rendering it twice.
                    </p>

                    <h3 className="mt-8 text-base font-bold text-slate-800 dark:text-slate-100">
                        What you send
                    </h3>
                    <Params
                        rows={[
                            {
                                name: "message.send",
                                type: "channel_id",
                                meaning: "+ body, body_text, parent_id, metadata",
                            },
                            {
                                name: "message.edit",
                                type: "message_id",
                                meaning: "+ body, body_text",
                            },
                            {
                                name: "message.delete",
                                type: "message_id, channel_id, channel_kind",
                                meaning: "+ parent_id",
                            },
                            {
                                name: "reaction.add / .remove",
                                type: "message_id, channel_id, channel_kind, emoji",
                                meaning: "All four required.",
                            },
                            {
                                name: "read.advance",
                                type: "channel_id, last_read_message_id",
                                meaning: "+ thread_root_id",
                            },
                            {
                                name: "channel.subscribe",
                                type: "channel_id",
                                meaning: "Start receiving that channel's room.",
                            },
                            {
                                name: "channel.unsubscribe",
                                type: "channel_id, kind",
                                meaning: "Stop receiving it.",
                            },
                            {
                                name: "typing",
                                type: "channel_id, channel_kind",
                                meaning: "Transient.",
                            },
                            {
                                name: "pin.add / .remove",
                                type: "channel_id, message_id",
                                meaning: "—",
                            },
                            {
                                name: "flag.add / .remove / .complete / .uncomplete",
                                type: "message_id",
                                meaning: "—",
                            },
                            {
                                name: "resync",
                                type: "—",
                                meaning: "+ channel_ids (list), since. Use after a reconnect.",
                            },
                        ]}
                        title="Emit · required fields"
                    />

                    <h3 className="mt-8 text-base font-bold text-slate-800 dark:text-slate-100">
                        What you receive, and who else receives it
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        Events arrive in <b>rooms</b>, and the room is the audience. This is the
                        same idea as webhook scope, one layer down.
                    </p>
                    <Params
                        rows={[
                            {
                                name: "message.created",
                                type: "channel",
                                meaning:
                                    "New message. Also .updated, .deleted, .reply_count_changed",
                            },
                            {
                                name: "reaction.added / .removed",
                                type: "channel",
                                meaning: "Reactions.",
                            },
                            {
                                name: "channel.updated",
                                type: "channel",
                                meaning: "Also .member_added, .member_removed",
                            },
                            {
                                name: "typing",
                                type: "channel",
                                meaning: "Transient, safe to drop.",
                            },
                            {
                                name: "activity.created",
                                type: "user",
                                meaning: (
                                    <>
                                        A notification for you. <b>Per-recipient</b> — which is why
                                        it is realtime-only and not a webhook.
                                    </>
                                ),
                            },
                            {
                                name: "channel.created",
                                type: "user",
                                meaning: "You were added to a channel.",
                            },
                            {
                                name: "read.advanced",
                                type: "user",
                                meaning: "Your cursor moved on another device.",
                            },
                            {
                                name: "pin.added / .removed",
                                type: "user",
                                meaning: "—",
                            },
                            {
                                name: "flag.added / .removed / .completed / .uncompleted",
                                type: "user",
                                meaning: "—",
                            },
                            {
                                name: "presence.changed",
                                type: "team",
                                meaning: "A teammate came online or went offline.",
                            },
                            {
                                name: "resync.batch / .error",
                                type: "direct",
                                meaning: (
                                    <>
                                        Answer to <Code>resync</Code>. On <Code>.error</Code> the
                                        checkpoint was too old — do a full reload rather than
                                        assuming the gap was empty.
                                    </>
                                ),
                            },
                        ]}
                        title="Event · room"
                    />
                </Section>

                {/* ── stability ────────────────────────────────────── */}
                <Section id="stability" subtitle="What we promise not to break." title="Stability">
                    <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                        Everything under <Code>/api/public/</Code> is a contract, and so are event
                        names — an integrator writes{" "}
                        <Code>if event == &quot;task.created&quot;</Code>, so renaming one is a
                        breaking change and will not happen inside a version. New fields may be
                        added to a payload; treat unknown fields as ignorable.
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        <Code>/api/v2/</Code> and <Code>/api/v3/</Code> are internal surfaces that
                        change whenever the app needs them to. They are not part of this contract
                        and building on them is not supported — the two exceptions above (creating
                        webhooks and API keys) are there because they need a session, and will move
                        under <Code>/api/public/</Code> when they get key-based management.
                    </p>
                </Section>

                <p className="mt-14 text-xs text-slate-400 dark:text-slate-500">
                    © {new Date().getFullYear()} Genos
                </p>
            </div>
        </main>
    );
}
