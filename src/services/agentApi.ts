// Streaming consumers for the agent endpoints.
//
//   POST /api/v2/agent/ask/      — start a fresh run
//   POST /api/v2/agent/decide/   — resume a paused run (approve / reject)
//
// Both endpoints stream NDJSON over POST and emit the same event
// vocabulary. Phase 7 added `tool_call_pending_approval`; Phase 8
// added `session_id` to the `done` event so the frontend can thread
// conversation history across multiple /ask/ calls.
//
// NDJSON event types:
//   {"type": "tool_call_start", "step", "tool_name", "arguments"}
//   {"type": "tool_call_result", "step", "tool_name", "summary", "duration_ms"?}
//   {"type": "tool_call_error",  "step", "tool_name", "error", "duration_ms"?}
//   {"type": "tool_call_pending_approval",
//        "step", "tool_name", "arguments", "approval_token", "run_id"}
//   {"type": "sources", "sources": [...]}
//   {"type": "answer_delta", "text": "..."}
//   {"type": "done", "session_id": "...", "elapsed_ms"?}   ← session_id added in Phase 8
//   {"type": "error", "message": "..."}
//
// `duration_ms` (per-tool execution wall time) and `elapsed_ms` (whole
// stream wall time) are server-measured and OPTIONAL — older backends
// don't send them, and cache-hit results never carry a duration.
//
// Why fetch instead of axios: axios doesn't expose the response body
// as a ReadableStream in the browser. Native fetch + the body reader
// gives us token-by-token streaming.

import type { SpotlightResult } from "../features/spotlight/types";
import { fmt, getMessages, resolveInitialLocale } from "../i18n";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

export interface ToolCallStartPayload {
    step: number;
    tool_name: string;
    arguments: Record<string, unknown>;
}

/** Compact ref the backend attaches to approved create_note /
 * update_note results so the client can refresh note caches and, for
 * body updates, push the new blocks into the live Yjs doc. Absent on
 * every other tool (and on older backends). */
export interface ToolResultNoteRef {
    note_id: number;
    note_type: "personal" | "task";
    title?: string;
    changed_fields?: string[];
}

export interface ToolCallResultPayload {
    step: number;
    tool_name: string;
    summary: string;
    note?: ToolResultNoteRef;
    // Server-measured execution time for THIS call. The client can't
    // time it from event arrival: parallel batches emit every start
    // before any result, so arrival deltas would pin the whole batch
    // wall-clock on the first call. Absent on older backends and on
    // session-cache hits (nothing executed).
    duration_ms?: number;
}

export interface ToolCallErrorPayload {
    step: number;
    tool_name: string;
    error: string;
    // See ToolCallResultPayload.duration_ms. Absent when no tool ran
    // (unknown tool, user-rejected write) and on older backends.
    duration_ms?: number;
}

export interface PendingApprovalPayload {
    step: number;
    tool_name: string;
    arguments: Record<string, unknown>;
    approval_token: string;
    run_id: string;
}

export type AgentEvent =
    | { type: "sources"; sources: SpotlightResult[] }
    | { type: "answer_delta"; text: string }
    | { type: "done"; session_id?: string; run_id?: string; elapsed_ms?: number }
    | { type: "error"; message: string }
    | ({ type: "tool_call_start" } & ToolCallStartPayload)
    | ({ type: "tool_call_result" } & ToolCallResultPayload)
    | ({ type: "tool_call_error" } & ToolCallErrorPayload)
    | ({ type: "tool_call_pending_approval" } & PendingApprovalPayload);

interface BaseStreamHandlers {
    onSources: (sources: SpotlightResult[]) => void;
    onDelta: (text: string) => void;
    // `elapsedMs` = the stream's total wall time, server-measured
    // (undefined on older backends). On a /decide/ resume it covers the
    // resumed segment only — the human approval wait isn't counted.
    onDone: (sessionId?: string, runId?: string, elapsedMs?: number) => void;
    onError: (message: string) => void;
    onToolStart?: (payload: ToolCallStartPayload) => void;
    onToolResult?: (payload: ToolCallResultPayload) => void;
    onToolError?: (payload: ToolCallErrorPayload) => void;
    onPendingApproval?: (payload: PendingApprovalPayload) => void;
}

export interface ThreadContext {
    chatType: number;
    chatId: number;
    threadId: number;
}

// Scope for "Ask about this note". Mirrors ThreadContext for the note
// surface: `noteType` is the integer code (1=Personal, 2=Task, 3=Chat),
// `noteId` is the row id. `noteType=4` (Shared) is normalised to 1 by
// the caller — it's a UI bucket, not a separate backend table.
export interface NoteContext {
    noteType: 1 | 2 | 3;
    noteId: number;
}

// One structured @/# mention attached to an ask — the wire shape of the
// backend's `mentions` array (see genos-api `agent/mentions.py`). Int
// codes mirror ThreadContext/NoteContext; `label` is advisory only (the
// server re-resolves canonical titles and ACL-checks every entry,
// silently dropping what the user can't read). Built from the picker's
// refs via `toWireMentions` in features/agentQA/mentions.
export type AgentMentionPayload =
    | { type: "user"; user_id: string; label: string }
    | { type: "task"; task_id: number; label: string }
    | { type: "note"; note_type: 1 | 2 | 3; note_id: number; label: string }
    | { type: "chat"; chat_type: number; chat_id: string; label: string }
    | { type: "project"; project_id: number; label: string }
    | { type: "group"; group_id: number; label: string }
    | { type: "todo"; item_id: number; label: string };

export interface AskAgentArgs extends BaseStreamHandlers {
    query: string;
    teamId: string;
    accessToken: string | null;
    sessionId?: string;
    // Structured @/# mentions the user picked in the input. Omitted
    // entirely when empty so older backends see an unchanged payload.
    mentions?: AgentMentionPayload[];
    // Web-search gating is server-side only: the backend reads the user's
    // persisted `spotlight_web_search_enabled` preference (the Settings
    // toggle writes it via PATCH /user/preferences/spotlight-web-search/).
    // The old per-request `allow_web_search` flag was removed — a stale
    // client could send it wrong and silently drop the tool.
    // When set, the agent scopes its answer to one specific chat thread:
    // the backend injects the thread's summary into the system prompt
    // and pre-seeds a source chip for it. The FULL tool set (including
    // write tools — so "create a milestone and tasks from this chat"
    // works here) stays available; only the user's persisted web-search
    // preference gates tools. Used by the "Ask about this thread" modal
    // launched from ThreadChatPaneHeader. When omitted, the normal
    // Spotlight agent behavior applies.
    threadContext?: ThreadContext;
    // Mirror of `threadContext` for the per-note Ask flow. Used by the
    // "Ask about this note" modal launched from NoteHeaderActions —
    // injects the note's summary into the system prompt and binds the
    // session to (note_type, note_id) so a reopen restores prior Q&A.
    // Mutually exclusive with `threadContext`; the backend rejects
    // requests with both set.
    noteContext?: NoteContext;
    // When true, the backend ignores any existing session for this user
    // (both `sessionId` and any per-thread/per-note session) and creates
    // a fresh AgentSession. Used by the "Clear conversation" button so
    // the next ask doesn't accidentally inherit the cleared turns via
    // the per-entity lookup.
    newConversation?: boolean;
    // When true, the ask continues a conversation whose transcript the
    // user can SEE (live overlay/page turns, or a session restored from
    // history). The backend then reuses `sessionId` even past its idle
    // TTL — bounded by the user's history-retention window — instead of
    // silently minting a fresh session under a visible transcript.
    // Omitted when false so older backends see an unchanged payload.
    resume?: boolean;
    signal?: AbortSignal;
}

export interface DecideAgentArgs extends BaseStreamHandlers {
    runId: string;
    approvalToken: string;
    decision: "approve" | "reject";
    accessToken: string | null;
    signal?: AbortSignal;
}

// One quota dimension's snapshot — `null` limit means unlimited for
// this tier. Reused across endpoints (AgentFeatures, AgentModels) so
// the frontend handles all three quota types uniformly.
export interface QuotaBlock {
    used: number;
    limit: number | null;
}

// Monthly quota dimensions (task/note creations) carry the window
// label so the Plan & Usage UI never hardcodes which keys are monthly.
export interface MonthlyQuotaBlock extends QuotaBlock {
    period: "month";
}

export type SubscriptionTier = "free" | "core" | "pro" | "max" | "enterprise";

// Monthly AI credit balance. PRESENT ⇔ the backend runs credits as the
// authoritative limit (`AI_CREDITS_AUTHORITATIVE`). Its presence is the
// render switch — the same contract `AgentModels.efforts` uses, and for
// the same reason: either side can deploy first, and a client showing a
// credit balance while the server still enforces daily ask counts would
// be lying about what actually limits the user.
//
// Values are WHOLE credits with 2 decimals, not milli — a request can
// cost 0.11 credits, so rounding to integers would show "0 left" to
// someone who can still ask. `unlimited` (enterprise) carries nulls
// rather than omitting the block, which would read as "not on credits".
export interface CreditsBlock {
    unlimited: boolean;
    balance: number | null;
    limit: number | null;
    used: number | null;
    // ISO instant the allowance resets (first moment of next UTC month).
    // A date rather than a day count so a page left open overnight
    // can't disagree with the server about "days remaining".
    period_end_iso: string;
    // The most a single request can be charged. Below this, asking
    // starts failing — which is the moment the UI needs to warn about,
    // not zero.
    per_request_max: number;
    // Credits bought as one-off packs. A SEPARATE possession: the
    // monthly allowance is spent first and this is what remains after
    // it, and unlike the allowance it never expires.
    //
    // Optional because a server that predates packs does not send it —
    // the same payload-shape convention `credits` itself uses. `null`
    // on an unlimited plan.
    purchased_balance?: number | null;
}

// The single fetch behind Settings → Plan & Usage: the user's
// EFFECTIVE tier (own tier, or a paying team's plan — `tier_source`
// says which, `tier_team` names the granting team) plus every
// metered/limited dimension. The Settings UI also uses
// `web_search.limit > 0` to surface the "your tier has no web search
// quota" warning up front instead of a mid-stream ToolError.
// The four newer fields are absent from older backends — keep reads
// null-safe.
export interface AgentFeatures {
    tier: SubscriptionTier;
    tier_source?: "personal" | "team";
    tier_team?: string | null;
    llm_ask: QuotaBlock;
    web_search: QuotaBlock;
    task_create?: MonthlyQuotaBlock;
    note_create?: MonthlyQuotaBlock;
    message_retention_days?: number | null; // null = unlimited history
    upload_max_mb?: number | null; // null = no tier file cap
    // Present ⇔ credits are authoritative. When set, `llm_ask` and
    // `web_search` are still returned (old clients, and Free's abuse
    // breaker still uses the ask counter) but no longer describe any
    // limit the user is subject to — render credits instead.
    credits?: CreditsBlock;
    // UX-pillar capability dimensions (UX tier model). Optional so an
    // older backend still type-checks; permissive for every tier until
    // the server-side flip. `integrations` drives the Integrations
    // page locks; the others let in-app UI adapt without new fetches.
    agent_tool_level?: "read" | "act" | "organize";
    max_effort?: "low" | "medium" | "high";
    auto_effort?: boolean;
    agent_memory?: "none" | "own" | "team";
    agent_history_retention_days?: number | null;
    integrations?: ("web" | "google_calendar" | "github")[];
    digest_cadence?: "weekly" | "daily" | null;
}

export async function fetchAgentFeatures(accessToken: string): Promise<AgentFeatures | null> {
    try {
        const resp = await fetch(`${API_BASE}/agent/features/`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!resp.ok) return null;
        return (await resp.json()) as AgentFeatures;
    } catch {
        return null;
    }
}

// Provider/model picker payload — drives Settings → Spotlight → AI Model.
// `daily_limit` is null when no per-model quota applies to this user
// (e.g. paid tier on a cheap model not listed in MODEL_DAILY_QUOTAS).
// `current` reflects the user's saved preference after stale-pref
// fallback, so the picker can pre-select it without the consumer
// duplicating the resolution logic.
export interface AgentModelEntry {
    provider: string;
    model: string;
    label: string;
    note: string;
    daily_limit: number | null;
    used_today: number;
}

// One (provider, effort) row when the backend runs effort levels.
// `model`/`model_label` are what the effort currently maps to;
// daily_limit/used_today are that model's existing quota counters
// (quota stays keyed on model ids server-side — this is a re-label).
export interface AgentEffortEntry {
    provider: string;
    effort: "low" | "medium" | "high";
    model: string;
    model_label: string;
    daily_limit: number | null;
    used_today: number;
    // True when this rung sits above the tier's max_effort ceiling —
    // the server would CLAMP it, so the picker renders it locked with
    // an upgrade hint instead of offering it. Optional: absent on
    // older backends means nothing is locked.
    locked?: boolean;
}

export interface AgentModels {
    tier: SubscriptionTier;
    // `effort` present only when the backend has AGENT_EFFORT_LEVELS on.
    current: { provider: string; model: string; effort?: string };
    models: AgentModelEntry[];
    // Present ⇔ the backend runs effort levels. Its PRESENCE is the
    // render switch: effort picker when set, legacy model picker
    // otherwise — which makes FE/API deploys skew-proof in both
    // directions (no FE flag to coordinate).
    efforts?: AgentEffortEntry[];
    // The tier's effort ceiling (present alongside `efforts` on newer
    // backends). Rungs above it come back `locked: true`.
    max_effort?: "low" | "medium" | "high";
    // Cross-cutting per-tier daily quotas, mirroring AgentFeatures.
    // Folded into this payload so the Settings UI loads everything it
    // needs in one round-trip.
    limits: {
        llm_ask: QuotaBlock;
        web_search: QuotaBlock;
    };
    // Present ⇔ credits are authoritative — see `CreditsBlock`. When
    // set, the per-model `daily_limit` / `used_today` rows describe caps
    // the server no longer enforces, so the picker must stop showing
    // them: a cap that does not apply is worse than no cap at all.
    credits?: CreditsBlock;
}

export async function fetchAgentModels(accessToken: string): Promise<AgentModels | null> {
    try {
        const resp = await fetch(`${API_BASE}/agent/models/`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!resp.ok) return null;
        return (await resp.json()) as AgentModels;
    } catch {
        return null;
    }
}

// One row of the History list. Mirrors the AgentSessionsListView
// payload — first_query is the user's first question in the session,
// already truncated server-side (~140 chars) for a short list row.
export interface AgentSessionSummary {
    session_id: string;
    created_at: string;
    last_active_at: string;
    first_query: string;
    turn_count: number;
    // Pinned rows are returned first and are exempt from the recent-list
    // cap, so a pin keeps a session reachable however old it gets.
    is_pinned: boolean;
}

// One completed turn inside a past session. `answer` is the final text
// the model produced; `error` is non-null when the turn ended with a
// fatal error (status="error"). status="rejected" is a valid terminal
// state from the write-tool approval flow — answer is present, error
// is null. `sources` is rebuilt server-side from the persisted tool
// results so inline citation tokens in the answer can resolve to
// clickable previews the same way they do in the live view.
export interface AgentSessionTurn {
    run_id: string;
    query: string;
    answer: string;
    status: string;
    error: string | null;
    started_at: string;
    sources: SpotlightResult[];
}

export interface AgentSessionDetail {
    session_id: string;
    created_at: string;
    last_active_at: string;
    turns: AgentSessionTurn[];
}

// Response from POST /agent/thread-summary/.
//
// `generated` distinguishes a fresh LLM call from a cache hit, so the UI
// can show a "just refreshed N seconds ago" badge. `fingerprint` is an
// opaque cache key (composite of max_message_id + count + max edit ts);
// the client compares it to a re-fetched value to detect that new
// messages have arrived and offer the user a "Refresh summary?" banner.
//
// `agent_session_id` + `turns` hydrate the modal's Q&A history for this
// user on this thread, so reopening the modal (even after a page reload)
// restores the conversation. Null/empty when the user has never asked
// a follow-up here.
export interface ThreadSummaryResponse {
    summary: string;
    generated: boolean;
    last_updated_iso: string;
    message_count: number;
    fingerprint: string;
    agent_session_id: string | null;
    turns: AgentSessionTurn[];
}

// Response from POST /agent/note-summary/. Same shape as
// `ThreadSummaryResponse` plus a `body_length` snapshot (used for the
// fingerprint and for the "X char note" hint when the body is empty)
// and the note's title at gen time.
export interface NoteSummaryResponse {
    summary: string;
    generated: boolean;
    last_updated_iso: string;
    body_length: number;
    fingerprint: string;
    note_title: string;
    agent_session_id: string | null;
    turns: AgentSessionTurn[];
}

export async function fetchNoteSummary(args: {
    accessToken: string | null;
    teamId: string;
    noteContext: NoteContext;
    forceRegenerate?: boolean;
    signal?: AbortSignal;
}): Promise<NoteSummaryResponse> {
    if (!args.accessToken) {
        throw new Error(getMessages().services.agent.notSignedIn);
    }
    const resp = await fetch(`${API_BASE}/agent/note-summary/`, {
        method: "POST",
        signal: args.signal,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${args.accessToken}`,
        },
        body: JSON.stringify({
            team_id: args.teamId,
            note_type: args.noteContext.noteType,
            note_id: args.noteContext.noteId,
            ...(args.forceRegenerate ? { force_regenerate: true } : {}),
        }),
    });
    if (!resp.ok) {
        let msg = fmt(getMessages().services.agent.serverReturned, { status: resp.status });
        try {
            const data = await resp.json();
            if (data?.error) msg = data.error;
        } catch {
            // ignore
        }
        throw new Error(msg);
    }
    return (await resp.json()) as NoteSummaryResponse;
}

// Why this is its own non-streaming endpoint (and not a flavor of
// /ask/): a thread summary is a short, terminal artifact — there's no
// follow-up loop, no tools called, no sources to attach. Streaming
// chunks would just complicate the client for ~300 words of output.
export async function fetchThreadSummary(args: {
    accessToken: string | null;
    teamId: string;
    threadContext: ThreadContext;
    forceRegenerate?: boolean;
    signal?: AbortSignal;
}): Promise<ThreadSummaryResponse> {
    if (!args.accessToken) {
        throw new Error(getMessages().services.agent.notSignedIn);
    }
    const resp = await fetch(`${API_BASE}/agent/thread-summary/`, {
        method: "POST",
        signal: args.signal,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${args.accessToken}`,
        },
        body: JSON.stringify({
            team_id: args.teamId,
            chat_type: args.threadContext.chatType,
            chat_id: args.threadContext.chatId,
            thread_id: args.threadContext.threadId,
            ...(args.forceRegenerate ? { force_regenerate: true } : {}),
        }),
    });
    if (!resp.ok) {
        let msg = fmt(getMessages().services.agent.serverReturned, { status: resp.status });
        try {
            const data = await resp.json();
            if (data?.error) msg = data.error;
        } catch {
            // ignore
        }
        throw new Error(msg);
    }
    return (await resp.json()) as ThreadSummaryResponse;
}

// `search` filters server-side across every question in a session, not
// just the `first_query` the row is labelled with — and across the whole
// retention window rather than the capped recent slice, which is the
// point: the asks worth searching for are usually the ones too old to
// scroll to. Omitted from the URL when blank so browsing stays a plain
// cacheable GET.
export async function fetchAgentSessions(args: {
    accessToken: string;
    teamId: string;
    search?: string;
}): Promise<AgentSessionSummary[]> {
    if (!args.accessToken || !args.teamId) return [];
    const search = (args.search || "").trim();
    try {
        const resp = await fetch(
            `${API_BASE}/agent/sessions/?team_id=${encodeURIComponent(args.teamId)}` +
                (search ? `&search=${encodeURIComponent(search)}` : ""),
            { headers: { Authorization: `Bearer ${args.accessToken}` } }
        );
        if (!resp.ok) return [];
        const data = (await resp.json()) as { sessions?: AgentSessionSummary[] };
        return data.sessions || [];
    } catch {
        return [];
    }
}

// Pin / unpin one of the caller's own past asks. Both directions are
// idempotent server-side, and re-pinning keeps the original pin time, so
// a double-click can't reshuffle the sidebar. Best-effort like
// `submitAgentFeedback`: returns whether it stuck, never throws, so the
// caller can roll back its optimistic flip.
export async function setAgentSessionPin(args: {
    accessToken: string;
    sessionId: string;
    pinned: boolean;
}): Promise<boolean> {
    if (!args.accessToken || !args.sessionId) return false;
    try {
        const resp = await fetch(
            `${API_BASE}/agent/sessions/${encodeURIComponent(args.sessionId)}/pin/`,
            {
                method: args.pinned ? "POST" : "DELETE",
                headers: { Authorization: `Bearer ${args.accessToken}` },
            }
        );
        return resp.ok;
    } catch {
        return false;
    }
}

export async function fetchAgentSessionDetail(args: {
    accessToken: string;
    teamId: string;
    sessionId: string;
}): Promise<AgentSessionDetail | null> {
    if (!args.accessToken || !args.teamId || !args.sessionId) return null;
    try {
        const resp = await fetch(
            `${API_BASE}/agent/sessions/${encodeURIComponent(args.sessionId)}/?team_id=${encodeURIComponent(args.teamId)}`,
            { headers: { Authorization: `Bearer ${args.accessToken}` } }
        );
        if (!resp.ok) return null;
        return (await resp.json()) as AgentSessionDetail;
    } catch {
        return null;
    }
}

// F1 — record 👍/👎 on an answer (SPOTLIGHT_QUALITY_ARCHITECTURE.md §Q0).
// `rating`: 1 = up, -1 = down, 0 = cleared. Best-effort: returns true on a
// 2xx, false otherwise; never throws (feedback must not break the UI).
export async function submitAgentFeedback(args: {
    runId: string;
    rating: number;
    accessToken: string;
    comment?: string;
}): Promise<boolean> {
    try {
        const resp = await fetch(
            `${API_BASE}/agent/runs/${encodeURIComponent(args.runId)}/feedback/`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${args.accessToken}`,
                },
                body: JSON.stringify({ rating: args.rating, comment: args.comment ?? "" }),
            }
        );
        return resp.ok;
    } catch {
        return false;
    }
}

export async function askAgentStream(args: AskAgentArgs): Promise<void> {
    if (!args.accessToken) {
        args.onError(getMessages().services.agent.notSignedIn);
        return;
    }
    await runNdjsonStream(
        `${API_BASE}/agent/ask/`,
        {
            query: args.query,
            team_id: args.teamId,
            ...(args.mentions?.length ? { mentions: args.mentions } : {}),
            ...(args.sessionId ? { session_id: args.sessionId } : {}),
            ...(args.threadContext
                ? {
                      thread_context: {
                          chat_type: args.threadContext.chatType,
                          chat_id: args.threadContext.chatId,
                          thread_id: args.threadContext.threadId,
                      },
                  }
                : {}),
            ...(args.noteContext
                ? {
                      note_context: {
                          note_type: args.noteContext.noteType,
                          note_id: args.noteContext.noteId,
                      },
                  }
                : {}),
            ...(args.newConversation ? { new_conversation: true } : {}),
            ...(args.resume ? { resume: true } : {}),
            // The active UI locale so the agent answers in the user's
            // language (GENOS_CAPABILITY_ROADMAP §3.4). Read from the shared
            // resolver (localStorage → navigator → "en"), which `setLocale`
            // keeps current, so it always reflects the live language even
            // after an in-session switch. Sent every time; the backend maps
            // it to a "reply in {language}" directive and no-ops on "en".
            locale: resolveInitialLocale(),
        },
        args.accessToken,
        args.signal,
        args
    );
}

export async function decideAgent(args: DecideAgentArgs): Promise<void> {
    if (!args.accessToken) {
        args.onError(getMessages().services.agent.notSignedIn);
        return;
    }
    await runNdjsonStream(
        `${API_BASE}/agent/decide/`,
        {
            run_id: args.runId,
            approval_token: args.approvalToken,
            decision: args.decision,
        },
        args.accessToken,
        args.signal,
        args
    );
}

// Shared NDJSON consumer. Used by both /ask/ and /decide/ — the wire
// protocol is identical, only the request body differs.
async function runNdjsonStream(
    url: string,
    body: unknown,
    accessToken: string,
    signal: AbortSignal | undefined,
    handlers: BaseStreamHandlers
): Promise<void> {
    let resp: Response;
    try {
        resp = await fetch(url, {
            method: "POST",
            signal,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(body),
        });
    } catch (err) {
        // AbortError is expected when the user closes the overlay /
        // types a new query; silently swallow it.
        if ((err as Error).name === "AbortError") return;
        handlers.onError(
            fmt(getMessages().services.agent.networkError, { message: (err as Error).message })
        );
        return;
    }

    if (!resp.ok) {
        let message = fmt(getMessages().services.agent.serverReturned, { status: resp.status });
        try {
            const data = await resp.json();
            if (data?.error) message = data.error;
        } catch {
            try {
                const txt = await resp.text();
                if (txt) message = txt.slice(0, 200);
            } catch {
                // ignore
            }
        }
        handlers.onError(message);
        return;
    }

    const reader = resp.body?.getReader();
    if (!reader) {
        handlers.onError(getMessages().services.agent.streamNoBody);
        return;
    }
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let streamClosedCleanly = false;

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let nl = buffer.indexOf("\n");
            while (nl !== -1) {
                const line = buffer.slice(0, nl).trim();
                buffer = buffer.slice(nl + 1);
                if (line) {
                    if (!streamClosedCleanly) {
                        streamClosedCleanly = dispatchLine(line, handlers);
                    }
                }
                nl = buffer.indexOf("\n");
            }
        }
        const tail = buffer.trim();
        if (tail && !streamClosedCleanly) {
            streamClosedCleanly = dispatchLine(tail, handlers);
        }
    } catch (err) {
        // AbortError is expected when the user cancels or closes the
        // overlay; silently swallow it — the hook's onCancel already
        // cleans up the streaming state manually.
        if ((err as Error).name === "AbortError") return;
        handlers.onError(
            fmt(getMessages().services.agent.streamInterrupted, {
                message: (err as Error).message,
            })
        );
        return;
    } finally {
        try {
            reader.releaseLock();
        } catch {
            // ignore
        }
    }

    // If the server closed the connection without any terminal event
    // (e.g. mid-stream server crash, network drop), surface an error
    // so the hook's `onError` handler runs and clears the `isStreaming`
    // flag. Without this the UI would show "streaming…" forever.
    // `done`, `error`, and `tool_call_pending_approval` are all
    // legitimate stream-closing events — none of them should trip this.
    if (!streamClosedCleanly) {
        handlers.onError(getMessages().services.agent.streamEndedUnexpectedly);
    }
}

// Returns true when the line is a terminal event the backend uses to
// close the stream: `done` (clean finish), `error` (backend reported
// failure), or `tool_call_pending_approval` (paused, awaiting /decide/).
// Caller uses this to distinguish an intentional close from a dropped
// connection.
function dispatchLine(line: string, h: BaseStreamHandlers): boolean {
    let evt: AgentEvent;
    try {
        evt = JSON.parse(line) as AgentEvent;
    } catch {
        h.onError(
            fmt(getMessages().services.agent.malformedNdjsonLine, { line: line.slice(0, 120) })
        );
        return false;
    }
    switch (evt.type) {
        case "sources":
            h.onSources(evt.sources || []);
            return false;
        case "answer_delta":
            if (evt.text) h.onDelta(evt.text);
            return false;
        case "done":
            h.onDone(evt.session_id, evt.run_id, evt.elapsed_ms);
            return true; // terminal: clean finish
        case "error":
            h.onError(evt.message || getMessages().services.agent.unknownError);
            return true; // terminal: backend already reported the failure
        case "tool_call_start":
            h.onToolStart?.({
                step: evt.step,
                tool_name: evt.tool_name,
                arguments: evt.arguments,
            });
            return false;
        case "tool_call_result":
            h.onToolResult?.({
                step: evt.step,
                tool_name: evt.tool_name,
                summary: evt.summary,
                note: evt.note,
                duration_ms: evt.duration_ms,
            });
            return false;
        case "tool_call_error":
            h.onToolError?.({
                step: evt.step,
                tool_name: evt.tool_name,
                error: evt.error,
                duration_ms: evt.duration_ms,
            });
            return false;
        case "tool_call_pending_approval":
            h.onPendingApproval?.({
                step: evt.step,
                tool_name: evt.tool_name,
                arguments: evt.arguments,
                approval_token: evt.approval_token,
                run_id: evt.run_id,
            });
            return true; // terminal: stream pauses here until /decide/
    }
    return false;
}
