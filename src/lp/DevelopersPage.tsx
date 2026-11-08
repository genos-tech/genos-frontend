import { useEffect, useId } from "react";
import { ExternalLink } from "lucide-react";
import { useLocation } from "react-router-dom";

import { Code } from "./Code";
import { LpShell } from "./kit/LpShell";
import {
    MCP_PROMPTS,
    MCP_READS,
    MCP_TASK_REF_TOOLS,
    MCP_TOOLS,
    MCP_WRITES,
    type McpTool,
} from "./mcpTools";

/**
 * `/developers` — the public API, webhook and WebSocket reference.
 *
 * Public and auth-free, same shell (`LpShell`) as `/legal` and `/privacy`: an
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
 *   - `genos-api/origin/views/public/mcp/tools.py` (MCP — `MCP_TOOLS` below)
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
    <section className="lp-doc-section" id={id}>
        <h2>{title}</h2>
        {subtitle && <p className="lp-small">{subtitle}</p>}
        {children}
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
    <div className="lp-endpoint">
        <div className="lp-endpoint__head">
            <span className="lp-badge lp-badge--accent lp-method">{method}</span>
            <span className="lp-endpoint__path" translate="no">
                {path}
            </span>
        </div>
        {children}
    </div>
);

const Pre = ({ children, label }: { children: string; label?: string }) => (
    <div className="lp-block">
        {label && <div className="lp-label">{label}</div>}
        <pre translate="no">{children}</pre>
    </div>
);

const Params = ({ rows, title }: { rows: Row[]; title: string }) => {
    const labelId = useId();
    return (
        <div className="lp-params">
            <div className="lp-label" id={labelId}>
                {title}
            </div>
            <div className="lp-params__scroll">
                <table aria-labelledby={labelId} role="table">
                    <tbody role="rowgroup">
                        {rows.map((r) => (
                            <tr key={r.name} role="row">
                                <td role="cell">
                                    <Code>{r.name}</Code>
                                </td>
                                <td role="cell">{r.type}</td>
                                <td role="cell">{r.meaning}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// "a, b and c", each in <Code>.
const codeList = (tools: McpTool[]) =>
    tools.map((t, i) => (
        <span key={t.name}>
            {i === 0 ? "" : i === tools.length - 1 ? " and " : ", "}
            <Code>{t.name}</Code>
        </span>
    ));

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

const TOC = [
    ["auth", "Authentication"],
    ["mcp", "MCP"],
    ["rest", "REST"],
    ["errors", "Errors & limits"],
    ["webhooks", "Webhooks"],
    ["realtime", "Realtime"],
    ["stability", "Stability"],
];

export default function DevelopersPage() {
    // A link straight to a section (/developers#webhooks) has to scroll once this lazy
    // route has rendered: the browser tried before the section existed and gave up.
    // The ids are plain ASCII, so the hash is used as is (a malformed %-escape must not throw).
    const { hash } = useLocation();
    useEffect(() => {
        if (!hash) return;
        document.getElementById(hash.slice(1))?.scrollIntoView?.();
    }, [hash]);

    return (
        <LpShell active="developers">
            {() => (
                <div lang="en">
                    <header className="lp-pagehead">
                        <div className="lp-container lp-container--narrow lp-stack-m">
                            <h1 className="lp-title">Developers</h1>
                            <p className="lp-lead">
                                REST API, MCP, outbound webhooks, and the realtime event stream.
                            </p>
                            <div className="lp-actions">
                                <a
                                    className="lp-btn lp-btn--secondary lp-btn--sm"
                                    href={SPEC_URL}
                                    rel="noreferrer"
                                    target="_blank"
                                >
                                    openapi.json
                                    <ExternalLink size={14} aria-hidden />
                                </a>
                            </div>
                            <p className="lp-small">
                                Served by the API itself and drift-tested against the routes, so it
                                cannot fall behind this page. Import it into Postman, Insomnia, or
                                a client generator.
                            </p>
                            <nav className="lp-toc">
                                {TOC.map(([id, label]) => (
                                    <a key={id} href={`#${id}`}>
                                        {label}
                                    </a>
                                ))}
                            </nav>
                        </div>
                    </header>

                    <div className="lp-container lp-container--narrow lp-pagebody">
                        <article className="lp-prose lp-prose--doc">
                            {/* ── auth ─────────────────────────────────────────── */}
                            <Section
                                id="auth"
                                subtitle="Create a key in Settings → Developer. It is shown once and cannot be recovered."
                                title="Authentication"
                            >
                                <Pre label="every request">{`curl ${API_BASE}/api/public/v1/me/ \\
  -H "Authorization: ApiKey gnos_xxxxxxxxxxxxxxxxxxxxxxxx"`}</Pre>
                                <p>
                                    The scheme is <Code>ApiKey</Code>, not <Code>Bearer</Code> — a
                                    key must never be mistaken for a session token by anything that
                                    only looks for <Code>Bearer</Code>.
                                </p>

                                <Params
                                    title="Key kinds"
                                    rows={[
                                        {
                                            name: "personal access token",
                                            type: "team_id required",
                                            meaning: (
                                                <>
                                                    Acts as you, across <b>every</b> team you
                                                    belong to. Because it spans teams, any endpoint
                                                    that needs a team must be told which one — pass{" "}
                                                    <Code>team_id</Code>.
                                                </>
                                            ),
                                        },
                                        {
                                            name: "team-scoped key",
                                            type: "team_id ignored",
                                            meaning: (
                                                <>
                                                    Bound to one team, which is then implied.
                                                    Passing a different <Code>team_id</Code> does
                                                    not widen it. It stops working when the person
                                                    who made it leaves the team, and the team owner
                                                    can revoke it at any time.
                                                </>
                                            ),
                                        },
                                        {
                                            name: "read scope",
                                            type: "GET only",
                                            meaning: (
                                                <>
                                                    Writes answer <Code>403</Code> — never a silent
                                                    no-op.
                                                </>
                                            ),
                                        },
                                        {
                                            name: "write scope",
                                            type: "GET/POST/PATCH",
                                            meaning: "Required for anything that changes data.",
                                        },
                                    ]}
                                />

                                <p>
                                    <b>Every key expires</b> — after 90 days unless you choose
                                    another lifetime, up to one year. Make a replacement before
                                    then. A key works only under <Code>/api/public/</Code>; the
                                    app&apos;s own endpoints refuse it.
                                </p>

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
                                <p className="lp-note">
                                    Available on the Pro plan and above. The REST API below is on
                                    every plan.
                                </p>
                                <p>
                                    With this endpoint an agent works the task itself, instead of
                                    you pasting the description into it and pasting the result
                                    back. Point Claude Code — or any MCP client — at it with an API
                                    key and it can find a task, read its description and its
                                    blockers, search the workspace, and, with a write key, update
                                    the task or leave a comment.
                                </p>
                                <p>
                                    There is no model on this side of the connection. The endpoint
                                    is a JSON-RPC dispatcher over Genos&apos;s workspace tools —
                                    most of them the ones the in-app agent uses, plus a few made
                                    for outside clients, like the briefing below. Your client does
                                    the reasoning; Genos answers questions about the workspace and
                                    writes what it is told to.
                                </p>

                                <Pre label="the whole setup">{`claude mcp add --transport http genos \\
  "${API_BASE}/api/public/v1/mcp?team_id=${TEAM_ID}" \\
  --header "Authorization: ApiKey gnos_…"`}</Pre>
                                <p>
                                    Every message is one <Code>POST</Code> and one JSON object back
                                    — a notification, which carries no id, gets an empty{" "}
                                    <Code>202</Code>. No SSE stream, no session to keep alive, no
                                    batching. Four protocol revisions are supported: a legacy
                                    client settles on one at <Code>initialize</Code>, a 2026-07-28
                                    client names it on every request, so there is nothing to
                                    configure.
                                </p>
                                <p>
                                    A personal access token spans every team you belong to, so it
                                    has to be told which one — append{" "}
                                    <Code>?team_id=&lt;uuid&gt;</Code> to the server URL, as the
                                    setup above does. A team-scoped key carries its own team and
                                    needs no parameter. With neither, everything past the handshake
                                    — <Code>tools/list</Code> included — answers{" "}
                                    <Code>-32602</Code> and says so.
                                </p>

                                <Endpoint method="POST" path="/api/public/v1/mcp">
                                    <p>
                                        No trailing slash, unlike the REST routes below. This URL
                                        is pasted into a client config by hand, and Django&apos;s
                                        append-slash rescue is no help on a <Code>POST</Code> — the
                                        redirect drops the body — so a wrong one fails as a broken
                                        message rather than being fixed for you.
                                    </p>
                                    <p>
                                        Only <Code>POST</Code> and <Code>OPTIONS</Code> are
                                        answered. Claude Code opens by asking for an event stream
                                        with a <Code>GET</Code>, takes the <Code>405</Code> and
                                        carries on — that line in your proxy log is not a fault.
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
                                    <p>
                                        <Code>structuredContent</Code> is the same payload already
                                        parsed, so a client that understands it does not have to
                                        re-read ours.
                                    </p>
                                </Endpoint>

                                <Params rows={MCP_TOOLS} title="Tools · scope" />
                                <p>
                                    {MCP_TOOLS.length} tools, {MCP_READS.length} reads and{" "}
                                    {MCP_WRITES.length} writes — the ones worth a round trip from
                                    outside, rather than the in-app agent&apos;s whole surface. A
                                    read-scoped key&apos;s <Code>tools/list</Code> returns the{" "}
                                    {MCP_READS.length} reads only: the writes are not listed at
                                    all, so an agent never plans around a tool it would be refused.
                                </p>

                                <Params rows={MCP_PROMPTS} title="Prompts · commands" />
                                <p>
                                    A client that shows MCP prompts lists these as commands; in
                                    Claude Code they are <Code>/mcp__genos__catch_me_up</Code> and{" "}
                                    <Code>/mcp__genos__plan_my_day</Code>. They run on your own
                                    model, which calls <Code>get_my_briefing</Code>, and ask it for
                                    a short answer that ends on a question you can answer in a
                                    word. They ask it to change nothing until you say yes, and a
                                    read-only key is told to describe a change instead of making
                                    it. A client that does not show prompts gets the same behaviour
                                    from the server&apos;s instructions.
                                </p>

                                <h3>The briefing is yours alone</h3>
                                <p>
                                    The briefing is built from what you can open and from other
                                    people&apos;s activity on those things only. Today&apos;s
                                    calendar is read from Google when you ask and goes straight
                                    into the answer. Genos does not keep your calendar events.
                                </p>

                                <h3>No confirmation step</h3>
                                <p>
                                    In the Genos app, every write the agent proposes waits for you
                                    to approve it. Over MCP none of them do: the key&apos;s write
                                    scope is the approval, given once when you created it. There is
                                    nobody watching this connection to click a confirmation, so a
                                    write takes effect the moment it is called, and there is no
                                    undo. Give an agent a read key unless it needs to write.
                                </p>

                                <h3>What the agent can see</h3>
                                <p>
                                    A key acts as the person who created it, and every tool
                                    re-checks that person&apos;s permissions on the call. The agent
                                    sees exactly what you see — a private project you are not in
                                    does not exist as far as it is concerned — and anything it
                                    writes is attributed to you in the task&apos;s activity feed.
                                </p>
                                <p>
                                    A team-scoped key is the same principal pinned to one team: it
                                    still acts as its creator. Membership is re-checked on every
                                    request rather than trusted from the key, because a key goes on
                                    naming its team after its owner has been removed from that
                                    team.
                                </p>
                                <p>
                                    Chats are the widest thing a key reaches.{" "}
                                    <Code>list_my_chats</Code> and <Code>get_chat_thread</Code>{" "}
                                    read your own chats, direct messages included, and a
                                    read-scoped key can call both. A key handed to an outside agent
                                    exposes all of them.
                                </p>

                                <h3>Naming a task</h3>
                                <p>
                                    A person names a task in whichever form is in front of them, so
                                    all of them resolve:
                                </p>
                                <Pre>{`display id   ENG-42
raw id       #${TASK_ID}  /  ${TASK_ID}
pasted url   https://app.genosai.dev/workspace/tasks/project/${PROJECT_ID}/task/${TASK_ID}`}</Pre>
                                <p>
                                    Resolved before the tool runs, and only on the{" "}
                                    {MCP_TASK_REF_TOOLS.length} tools that take a task:{" "}
                                    {codeList(MCP_TASK_REF_TOOLS)}. The rest take ordinary
                                    arguments — <Code>list_tasks</Code> does not accept a display
                                    id. A reference that does not resolve comes back as a tool
                                    error saying what to try instead, so the agent retries rather
                                    than stops.
                                </p>

                                <h3>Read keys, and what a refusal looks like</h3>
                                <p>
                                    Scope is not read off the HTTP method here, because every MCP
                                    message is a <Code>POST</Code> — <Code>tools/list</Code> and a
                                    read-only <Code>tools/call</Code> included. Going by the method
                                    would refuse a read key on every request it ever makes, so
                                    scope is enforced per tool instead: the {MCP_WRITES.length}{" "}
                                    writes in the table above need a write key, and nothing else
                                    does.
                                </p>
                                <p>
                                    This is the one place the endpoint differs from the REST routes
                                    below, where a read key attempting a write is a{" "}
                                    <Code>403</Code>. If a read key calls a write tool here — off a
                                    tool list it cached before the key changed, say — the call
                                    succeeds and the <i>result</i> reports the refusal, in a
                                    sentence naming the scope it needs and confirming that reads
                                    still work.
                                </p>
                                <Pre label="200 — a successful call whose result carries the refusal">{`"result": {
  "content": [{ "type": "text", "text": "\`update_task\` writes to the workspace, and this API key is read-only. …" }],
  "isError": true
}`}</Pre>
                                <p>
                                    That is the general rule. Anything the caller could fix by
                                    trying differently — a task reference that does not resolve, a
                                    permission it does not hold, the wrong key scope — arrives as a
                                    result carrying <Code>isError</Code>, because a model can read
                                    that and do something else. Only a disagreement about what
                                    exists, an unknown tool name, is a protocol error.
                                </p>
                            </Section>

                            {/* ── rest ─────────────────────────────────────────── */}
                            <Section
                                id="rest"
                                subtitle="Base URL for every route below."
                                title="REST"
                            >
                                <Pre>{`${API_BASE}/api/public/v1`}</Pre>

                                <Endpoint method="GET" path="/projects/">
                                    <p>Projects you belong to — not every project in the team.</p>
                                    <Params
                                        title="Query"
                                        rows={[
                                            {
                                                name: "team_id",
                                                type: "uuid",
                                                meaning: "Required for a personal access token.",
                                            },
                                        ]}
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
                                        title="Query"
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
                                                        Narrow to one project you belong to. A
                                                        project you are not in answers{" "}
                                                        <Code>404</Code>.
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
                                                        <Code>400</Code> rather than an empty page
                                                        — it is almost always a paging-loop bug.
                                                    </>
                                                ),
                                            },
                                        ]}
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
                                    <p>
                                        Requires a <Code>write</Code> key.
                                    </p>
                                    <Params
                                        title="Body"
                                        rows={[
                                            {
                                                name: "title",
                                                type: "string",
                                                meaning: "Required. Trimmed, max 255.",
                                            },
                                            {
                                                name: "project_id",
                                                type: "integer",
                                                meaning:
                                                    "Required. Must be a project you belong to.",
                                            },
                                            {
                                                name: "team_id",
                                                type: "uuid",
                                                meaning: "Required for a personal access token.",
                                            },
                                            {
                                                name: "status",
                                                type: "string",
                                                meaning: 'Defaults to "Open".',
                                            },
                                            {
                                                name: "priority",
                                                type: "string",
                                                meaning: "Optional.",
                                            },
                                            {
                                                name: "assignee_id",
                                                type: "uuid",
                                                meaning: "Optional.",
                                            },
                                            {
                                                name: "due_date",
                                                type: "date",
                                                meaning: "Optional, YYYY-MM-DD.",
                                            },
                                        ]}
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
                                    <p>
                                        <Code>PATCH</Code> requires a <Code>write</Code> key and
                                        accepts an <b>allowlist</b> — <Code>title</Code>,{" "}
                                        <Code>status</Code>, <Code>priority</Code>. Anything else
                                        is ignored, so a new column never joins the public API by
                                        accident. Sending none of them is a <Code>400</Code>.
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
                                    title="Status codes"
                                    rows={[
                                        {
                                            name: "400",
                                            meaning:
                                                "Malformed input — the message names the field.",
                                        },
                                        {
                                            name: "401",
                                            meaning: "Missing, unknown, revoked or expired key.",
                                        },
                                        {
                                            name: "403",
                                            meaning: (
                                                <>
                                                    A <Code>read</Code> key attempted a write, or a
                                                    session JWT was used instead of a key.
                                                </>
                                            ),
                                        },
                                        {
                                            name: "404",
                                            meaning: (
                                                <>
                                                    Not found <b>or</b> not yours — deliberately
                                                    the same answer, so ids cannot be probed for
                                                    existence.
                                                </>
                                            ),
                                        },
                                        {
                                            name: "429",
                                            meaning: "Rate limited. Back off and retry.",
                                        },
                                    ]}
                                />
                                <p>
                                    Bad input is always a <Code>4xx</Code>, never a{" "}
                                    <Code>5xx</Code> — every documented parameter is swept with
                                    wrong-type, negative and oversized values in the test suite,
                                    because a 500 tells an integrator nothing about what they got
                                    wrong.
                                </p>
                            </Section>

                            {/* ── webhooks ─────────────────────────────────────── */}
                            <Section
                                id="webhooks"
                                subtitle="Genos POSTs to your URL when something happens. Configure in Settings → Developer."
                                title="Webhooks"
                            >
                                <Params
                                    title="Events · scoped by"
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
                                                    Carries <Code>body_text</Code>. Requires an
                                                    explicit channel list — see below.
                                                </>
                                            ),
                                        },
                                    ]}
                                />

                                <h3>Scope — which objects you hear about</h3>
                                <p>
                                    Subscribing to an event type does not have to mean the whole
                                    team. The two filters deliberately behave differently when
                                    empty:
                                </p>
                                <Pre>{`project_ids: []                  → every project    (a filter, unset)
project_ids: [${PROJECT_ID}]                → only that project

channel_ids: []                  → NO channel       (an allow-list, empty)
channel_ids: ["${CHANNEL_ID.slice(0, 8)}…"]  → only that channel`}</Pre>
                                <p>
                                    Task events default to the whole team. <b>Chat does not.</b> A
                                    chat payload carries what people actually wrote, and a webhook
                                    is configured by one admin on behalf of everyone who talks in
                                    that channel — so <Code>message.created</Code> requires you to
                                    name the channels. There is no subscribe-to-all-chat, and{" "}
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

                                <h3>What you receive</h3>
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

                                <h3>Verifying a delivery</h3>
                                <p>
                                    The timestamp is <b>inside</b> the signed string, so a captured
                                    delivery cannot be replayed later.{" "}
                                    <Code>X-Genos-Delivery</Code> is stable across retries — key
                                    your idempotency off it.
                                </p>
                                <Pre>{`signed   = f"{timestamp}.".encode() + raw_body
expected = "sha256=" + hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
hmac.compare_digest(expected, request.headers["X-Genos-Signature"])`}</Pre>
                                <p>
                                    Reply <Code>2xx</Code> quickly and do your work afterwards.
                                    Failures retry with exponential backoff; an endpoint that keeps
                                    failing is disabled and shown as such in Settings.
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
                                <p>
                                    The server resolves the user <b>from the token</b> and
                                    disconnects on mismatch — a client-supplied user id is never
                                    trusted. Room membership is derived from your actual channels
                                    and teams, not from connect arguments.
                                </p>

                                <h3>Every emit is acknowledged</h3>
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
                                <p>
                                    Key your handling off <Code>code</Code>, never{" "}
                                    <Code>message</Code> — the text is for a human reading a log.
                                    Codes: <Code>UNAUTHENTICATED</Code>,{" "}
                                    <Code>VALIDATION_FAILED</Code>, <Code>FORBIDDEN</Code>,{" "}
                                    <Code>BACKEND_ERROR</Code>.
                                </p>
                                <p>
                                    <Code>correlation_id</Code> comes back on the ack <i>and</i>{" "}
                                    the resulting broadcast, which is how a sender matches the
                                    server-confirmed message to its own optimistic copy instead of
                                    rendering it twice.
                                </p>

                                <h3>What you send</h3>
                                <Params
                                    title="Emit · required fields"
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
                                            meaning:
                                                "+ channel_ids (list), since. Use after a reconnect.",
                                        },
                                    ]}
                                />

                                <h3>What you receive, and who else receives it</h3>
                                <p>
                                    Events arrive in <b>rooms</b>, and the room is the audience.
                                    This is the same idea as webhook scope, one layer down.
                                </p>
                                <Params
                                    title="Event · room"
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
                                                    A notification for you. <b>Per-recipient</b> —
                                                    which is why it is realtime-only and not a
                                                    webhook.
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
                                                    Answer to <Code>resync</Code>. On{" "}
                                                    <Code>.error</Code> the checkpoint was too old
                                                    — do a full reload rather than assuming the gap
                                                    was empty.
                                                </>
                                            ),
                                        },
                                    ]}
                                />
                            </Section>

                            {/* ── stability ────────────────────────────────────── */}
                            <Section
                                id="stability"
                                subtitle="What we promise not to break."
                                title="Stability"
                            >
                                <p>
                                    Everything under <Code>/api/public/</Code> is a contract, and
                                    so are event names — an integrator writes{" "}
                                    <Code>if event == &quot;task.created&quot;</Code>, so renaming
                                    one is a breaking change and will not happen inside a version.
                                    New fields may be added to a payload; treat unknown fields as
                                    ignorable.
                                </p>
                                <p>
                                    <Code>/api/v2/</Code> and <Code>/api/v3/</Code> are internal
                                    surfaces that change whenever the app needs them to. They are
                                    not part of this contract and building on them is not supported
                                    — the two exceptions above (creating webhooks and API keys) are
                                    there because they need a session, and will move under{" "}
                                    <Code>/api/public/</Code> when they get key-based management.
                                </p>
                            </Section>
                        </article>
                    </div>
                </div>
            )}
        </LpShell>
    );
}
