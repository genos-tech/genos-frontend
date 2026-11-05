// Streaming consumers for the agent endpoints.
//
//   POST /api/v2/agent/ask/      — start a fresh run
//   POST /api/v2/agent/decide/   — resume a paused run (approve / reject)
//   POST /api/v2/agent/runs/<run>/steps/<step>/undo/ — undo one approved write
//                                                      (plain JSON, not a stream)
//
// The first two endpoints stream NDJSON over POST and emit the same event
// vocabulary. Phase 7 added `tool_call_pending_approval`; Phase 8
// added `session_id` to the `done` event so the frontend can thread
// conversation history across multiple /ask/ calls.
//
// NDJSON event types:
//   {"type": "tool_call_start", "step", "tool_name", "arguments"}
//   {"type": "tool_call_result", "step", "tool_name", "summary", "duration_ms"?,
//        "edited"?, "edited_arguments"?, "undo"?}
//   {"type": "tool_call_error",  "step", "tool_name", "error", "duration_ms"?}
//   {"type": "tool_call_pending_approval",
//        "step", "tool_name", "arguments", "editable"?, "undoable"?, "undo_reason"?,
//        "approval_token", "run_id"}
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
 * update_note / delete_note / restore_note_version results so the client
 * can refresh note caches and, for body updates, push the new blocks into
 * the live Yjs doc. `note_type` is the note FAMILY ("personal" covers My,
 * Team and Shared notes). `deleted: true` marks a delete_note (no
 * `changed_fields`); a restore reports `changed_fields: ["title", "body"]`
 * and carries no body. Absent on every other tool (and on older
 * backends). */
export interface ToolResultNoteRef {
    note_id: number;
    note_type: "personal" | "task" | "chat";
    title?: string;
    changed_fields?: string[];
    deleted?: boolean;
}

/** Ref the backend attaches to an approved delete_note_folder result: what
 * the folder delete destroyed. All the notes are personal-family (My Notes
 * and Team Notes both store personal-family notes). The id lists are
 * capped by the backend; `ids_truncated: true` means they were cut, so the
 * client reloads its lists instead of trusting them as complete. */
export interface ToolResultNoteFolderRef {
    folder_id: number;
    deleted_folder_ids: number[];
    deleted_note_ids: number[];
    ids_truncated: boolean;
}

/** Ref the backend attaches to an approved delete_project result: the
 * server has already deleted the project, so the client only drops its own
 * copies (sidebar entry, open page). Absent on every other tool (and on
 * older backends). */
export interface ToolResultProjectRef {
    project_id: number;
    deleted: true;
}

/** What an approved write's result carries when what undo needs was really
 * stored (genos-api `agent/undo.py`, `event_info`). It, and not `undoable` on
 * the approval card, decides whether Undo is offered. `available_until` is an
 * ISO instant. Absent on a read, on a write nothing was stored for, and on
 * older backends. */
export interface ToolResultUndoRef {
    step_id: number;
    available_until: string;
}

export interface ToolCallResultPayload {
    step: number;
    tool_name: string;
    summary: string;
    // An approved write the person edited first (genos-api #570): `edited` is
    // true and `edited_arguments` holds `{path: value}` for what they typed,
    // the values that actually ran. Both are absent on a plain approve, on
    // every read, and against older backends.
    edited?: boolean;
    edited_arguments?: Record<string, unknown>;
    note?: ToolResultNoteRef;
    note_folder?: ToolResultNoteFolderRef;
    // Server-measured execution time for THIS call. The client can't
    // time it from event arrival: parallel batches emit every start
    // before any result, so arrival deltas would pin the whole batch
    // wall-clock on the first call. Absent on older backends and on
    // session-cache hits (nothing executed).
    duration_ms?: number;
    project?: ToolResultProjectRef;
    undo?: ToolResultUndoRef;
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
    // The argument paths the person may change before approving
    // (`title`, `updates[3].priority`): exactly the paths /decide/ accepts in
    // `edited_args`, in display order. `[]` for a tool with nothing editable.
    // Absent against older backends, which read the same as `[]`. At these
    // paths `arguments` already holds the value as the tool will receive it.
    editable?: string[];
    // A PREDICTION of whether this call could be undone once approved
    // (genos-api `undo.proposal`): the card says so BEFORE the person approves.
    // `false` comes with `undo_reason`, one of `UNDO_REASONS` below. Absent
    // against older backends, which reads as "no claim" (not as undoable). Whether
    // Undo is shown afterwards is the result event's `undo`, never this.
    undoable?: boolean;
    undo_reason?: string;
    approval_token: string;
    run_id: string;
}

/** Why a proposed write can't be undone: the codes the card has copy for. A
 * code outside the list reads as the generic one. */
export const UNDO_REASONS = [
    "irreversible_delete",
    "notified_people",
    "no_snapshot",
    "unsupported_fields",
    "not_yet",
] as const;
export type UndoReason = (typeof UNDO_REASONS)[number];

// What a 422 from /decide/ says: the person's edits cannot be applied. The
// approval was NOT spent, the run is still awaiting it, and the same token
// still works. `fieldErrors` maps each offending path (as the client sent it)
// to a sentence for a person (English, from the server).
export interface EditsRejected {
    message: string;
    fieldErrors: Record<string, string>;
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
    // The edits made on the card: a flat `{path: new value}` patch carrying
    // ONLY what changed. Sent on an approve and never on a reject (the server
    // answers 400 to that); an empty patch is a plain approve and is left off
    // the wire.
    editedArgs?: Record<string, unknown>;
    accessToken: string | null;
    signal?: AbortSignal;
    // Called INSTEAD of `onError` when the server refuses the edits with a 422
    // `{error, field_errors}`. That is not a stream and not a failure of the
    // run: nothing was approved or run, and the card still works. No other
    // handler is called. Without this handler a 422 falls through to `onError`
    // like any other non-OK answer.
    onEditsRejected?: (rejection: EditsRejected) => void;
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
    // The turn's approved writes that have an undo, oldest first (one run can
    // approve several): empty for none, absent against older backends. Whether
    // one can STILL be undone is not known here, only when it is tried.
    undo?: AgentSessionUndo[];
}

export interface AgentSessionUndo {
    step_id: number;
    // The step's index within its run.
    step: number;
    tool_name: string;
    available_until: string;
    // Set once the write was undone.
    undone_at: string | null;
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
//
// `null` when the request FAILED (a non-2xx, a dropped connection, a body that
// isn't JSON), `[]` only when the server answered and there are none. The two
// are different claims: callers keep the list they already show on `null` and
// say "couldn't load" if they have nothing, instead of telling the person they
// have no conversations (MIP-973). Same contract as `fetchAgentSessionDetail`
// and `fetchSharedAnswers`. With no token or team there is nothing to ask, so
// that is `[]` — both callers check before they call.
export async function fetchAgentSessions(args: {
    accessToken: string;
    teamId: string;
    search?: string;
}): Promise<AgentSessionSummary[] | null> {
    if (!args.accessToken || !args.teamId) return [];
    const search = (args.search || "").trim();
    try {
        const resp = await fetch(
            `${API_BASE}/agent/sessions/?team_id=${encodeURIComponent(args.teamId)}` +
                (search ? `&search=${encodeURIComponent(search)}` : ""),
            { headers: { Authorization: `Bearer ${args.accessToken}` } }
        );
        if (!resp.ok) return null;
        const data = (await resp.json()) as { sessions?: AgentSessionSummary[] };
        return data.sessions || [];
    } catch {
        return null;
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

// ---------------------------------------------------------------------------
// "What Genos remembers": delete conversations, list and withdraw the
// answers shared with the team.
//
//   DELETE /agent/sessions/<id>/             one of the caller's conversations
//   DELETE /agent/sessions/?team_id=         ALL of the caller's, in that team
//   GET    /agent/shared-answers/?team_id=   the answers teammates may see
//   DELETE /agent/shared-answers/<run_id>/   stop sharing one answer
//
// Unlike the best-effort helpers above, these return a result the caller
// MUST branch on: a destructive request that silently "worked" (or didn't)
// is worse than none. Each outcome the UI words differently has its own
// `kind`, and nothing here throws.
// ---------------------------------------------------------------------------

export type AgentDeleteResult =
    | { kind: "deleted"; deletedSessions: number; deletedRuns: number }
    // 404: already gone, or never the caller's. Same outcome as success for
    // the list (the row has to go), so callers treat it that way.
    | { kind: "gone" }
    // 409 `run_in_flight`: a conversation is still answering. The server
    // deletes NOTHING in that case (all-or-nothing), so the caller keeps
    // its list and asks the person to wait.
    | { kind: "in_flight" }
    | { kind: "error" };

const readDeleteCounts = async (
    resp: Response
): Promise<{ deletedSessions: number; deletedRuns: number }> => {
    try {
        const data = (await resp.json()) as {
            deleted_sessions?: number;
            deleted_runs?: number;
        };
        return {
            deletedSessions: Number(data.deleted_sessions) || 0,
            deletedRuns: Number(data.deleted_runs) || 0,
        };
    } catch {
        return { deletedSessions: 0, deletedRuns: 0 };
    }
};

const classifyDelete = async (resp: Response): Promise<AgentDeleteResult> => {
    if (resp.ok) return { kind: "deleted", ...(await readDeleteCounts(resp)) };
    if (resp.status === 404) return { kind: "gone" };
    if (resp.status === 409) return { kind: "in_flight" };
    return { kind: "error" };
};

// Permanently delete one of the caller's own conversations: the session,
// all of its turns, and the copies Genos recalls them from.
export async function deleteAgentSession(args: {
    accessToken: string;
    sessionId: string;
}): Promise<AgentDeleteResult> {
    if (!args.accessToken || !args.sessionId) return { kind: "error" };
    try {
        const resp = await fetch(
            `${API_BASE}/agent/sessions/${encodeURIComponent(args.sessionId)}/`,
            { method: "DELETE", headers: { Authorization: `Bearer ${args.accessToken}` } }
        );
        return await classifyDelete(resp);
    } catch {
        return { kind: "error" };
    }
}

// Permanently delete ALL of the caller's conversations in one team,
// including ones the History list doesn't show (older than its cap, hidden
// by the plan's history window, or started from a thread or note). The team
// is required by the server and deliberately never defaulted: a delete-all
// that quietly reached into the person's other teams would be the worst way
// to get this wrong.
export async function deleteAllAgentSessions(args: {
    accessToken: string;
    teamId: string;
}): Promise<AgentDeleteResult> {
    if (!args.accessToken || !args.teamId) return { kind: "error" };
    try {
        const resp = await fetch(
            `${API_BASE}/agent/sessions/?team_id=${encodeURIComponent(args.teamId)}`,
            { method: "DELETE", headers: { Authorization: `Bearer ${args.accessToken}` } }
        );
        return await classifyDelete(resp);
    } catch {
        return { kind: "error" };
    }
}

// One answer the caller currently has shared with teammates. `audience_size`
// counts the people who could be shown it, the caller included, so 1 means
// only them. `session_id` is null for a standalone ask.
export interface SharedAnswer {
    run_id: string;
    session_id: string | null;
    team_id: string;
    question: string;
    answer_snippet: string;
    started_at: string;
    audience_size: number;
}

export interface SharedAnswersResponse {
    // The account-wide preference; when false the server sends no answers.
    share_answers_with_team: boolean;
    answers: SharedAnswer[];
    // True when the list was cut short (the server returns at most 50 and
    // only audits a bounded number of candidates).
    has_more: boolean;
}

// `null` on any failure, so the caller can tell "couldn't load" from "nothing
// shared" and say so — an empty list that is really an outage would read as
// "your answers are not shared", which is exactly the claim this page makes.
export async function fetchSharedAnswers(args: {
    accessToken: string;
    teamId: string;
}): Promise<SharedAnswersResponse | null> {
    if (!args.accessToken || !args.teamId) return null;
    try {
        // Always team-scoped: omitting `team_id` returns every team's, which
        // would show another team's answers in this team's shell.
        const resp = await fetch(
            `${API_BASE}/agent/shared-answers/?team_id=${encodeURIComponent(args.teamId)}`,
            { headers: { Authorization: `Bearer ${args.accessToken}` } }
        );
        if (!resp.ok) return null;
        const data = (await resp.json()) as Partial<SharedAnswersResponse>;
        return {
            share_answers_with_team: data.share_answers_with_team !== false,
            answers: Array.isArray(data.answers) ? data.answers : [],
            has_more: Boolean(data.has_more),
        };
    } catch {
        return null;
    }
}

export type WithdrawSharedAnswerResult =
    | { kind: "withdrawn" }
    // 404: missing or not the caller's. The row has to go either way.
    | { kind: "gone" }
    | { kind: "error" };

// Stop sharing ONE answer. One-way on the server: the conversation stays,
// but that answer is never collected for the team again.
export async function withdrawSharedAnswer(args: {
    accessToken: string;
    runId: string;
}): Promise<WithdrawSharedAnswerResult> {
    if (!args.accessToken || !args.runId) return { kind: "error" };
    try {
        const resp = await fetch(
            `${API_BASE}/agent/shared-answers/${encodeURIComponent(args.runId)}/`,
            { method: "DELETE", headers: { Authorization: `Bearer ${args.accessToken}` } }
        );
        if (resp.ok) return { kind: "withdrawn" };
        if (resp.status === 404) return { kind: "gone" };
        return { kind: "error" };
    } catch {
        return { kind: "error" };
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
    // Edits ride only on an approve, and only when there is something in them:
    // the server treats an absent / null / `{}` patch as a plain approve, and a
    // reject that carries one as a 400 that consumes nothing.
    const edits =
        args.decision === "approve" && args.editedArgs && Object.keys(args.editedArgs).length > 0
            ? args.editedArgs
            : undefined;
    await runNdjsonStream(
        `${API_BASE}/agent/decide/`,
        {
            run_id: args.runId,
            approval_token: args.approvalToken,
            decision: args.decision,
            ...(edits ? { edited_args: edits } : {}),
        },
        args.accessToken,
        args.signal,
        args,
        args.onEditsRejected
    );
}

// `undo` of a result event, only when it is whole: a real step id and a date.
// Anything else (a field from a newer backend, a null) is no Undo at all, never
// a control that cannot work.
const asUndoRef = (raw: unknown): ToolResultUndoRef | undefined => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
    const { step_id, available_until } = raw as Record<string, unknown>;
    if (typeof step_id !== "number" || !Number.isFinite(step_id)) return undefined;
    if (typeof available_until !== "string" || !available_until) return undefined;
    return { step_id, available_until };
};

// ---------------------------------------------------------------------------
// Undo an approved write.
//
//   POST /agent/runs/<run_id>/steps/<step_id>/undo/     (genos-api `undo_apply.py`)
//
// No body, and nothing in it is the person's to choose: the click is the
// authorization. A plain JSON POST like the feedback call, with the same bearer
// token the other agent calls use (none of them refreshes a token, and neither
// does this: the caller holds the live one).
//
// Never throws. The answer is either `undone` or a `refused` one that names why
// in a code the card has a sentence for. A refusal changes NOTHING on the server.
// ---------------------------------------------------------------------------

/** A field undo reports it did not put back, because someone changed it after
 * the write. `field` is a column name (`status`, `due_date`, ...) or `body`. */
export interface UndoSkippedField {
    field: string;
    reason: string;
}

/** What the undo touched. `note_type` is the note FAMILY, as on a note ref.
 * `comment` is what undoing `add_comment` reports (it deleted the comment). */
export type UndoEntity =
    | { kind: "task"; task_id: number; project_id: number | null; display_id: string }
    | {
          kind: "note";
          note_type: "personal" | "task" | "chat";
          note_id: number;
          title: string;
      }
    | {
          kind: "comment";
          task_id: number;
          project_id: number | null;
          display_id: string;
          comment_id: number;
      };

export interface UndoAnswer {
    run_id: string;
    step_id: number;
    tool_name: string;
    undone_at: string;
    // `restored`: put back as it was, re-read it. `deleted`: what the agent made
    // is gone, close it and drop it.
    action: "restored" | "deleted";
    // Column names put back (`title`, `status`, `priority`, `effort_level`,
    // `due_date`, `start_date`, `tags`, `body`); empty for a delete.
    restored: string[];
    skipped: UndoSkippedField[];
    // Null for a kind this client does not know: nothing is refreshed for it.
    entity: UndoEntity | null;
    // The server's English sentence: a fallback, people read localized copy.
    summary: string;
    // A note edit only: whether the live editor was handed the restored text
    // (`sent`, `failed`, `skipped`, `deferred`).
    live_editor?: string;
}

/** Why an undo was not done. The first six are the server's own `code`; the
 * rest are decided here from the transport. */
export type UndoRefusalCode =
    | "not_found"
    | "not_undoable"
    | "already_undone"
    | "changed_since"
    | "expired"
    | "permission_lost"
    | "throttled"
    | "unauthorized"
    | "network"
    | "server"
    | "unknown";

export interface UndoRefusal {
    code: UndoRefusalCode;
    status: number;
    // The server's sentence (`error`, or DRF's `detail` on a throttle). English.
    message: string | null;
    // `changed_since` of `update_task` lists what had changed.
    skipped: UndoSkippedField[];
    // `changed_since` of a note may say why.
    detail: string | null;
    // Whether trying again can help: only where the cause is not the state of
    // the workspace (a dropped connection, a 5xx, the throttle, a token).
    retryable: boolean;
}

export type UndoResult =
    | { kind: "undone"; answer: UndoAnswer }
    | { kind: "refused"; refusal: UndoRefusal };

const SERVER_UNDO_CODES: ReadonlySet<string> = new Set([
    "not_found",
    "not_undoable",
    "already_undone",
    "changed_since",
    "expired",
    "permission_lost",
]);

const asSkipped = (raw: unknown): UndoSkippedField[] =>
    Array.isArray(raw)
        ? raw.flatMap((item) => {
              if (!item || typeof item !== "object") return [];
              const { field, reason } = item as Record<string, unknown>;
              return typeof field === "string"
                  ? [{ field, reason: typeof reason === "string" ? reason : "changed_since" }]
                  : [];
          })
        : [];

const asNumber = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

const asUndoEntity = (raw: unknown): UndoEntity | null => {
    if (!raw || typeof raw !== "object") return null;
    const e = raw as Record<string, unknown>;
    if (e.kind === "task" || e.kind === "comment") {
        const taskId = asNumber(e.task_id);
        if (taskId === null) return null;
        const base = {
            task_id: taskId,
            project_id: asNumber(e.project_id),
            display_id: typeof e.display_id === "string" ? e.display_id : "",
        };
        if (e.kind === "task") return { kind: "task", ...base };
        const commentId = asNumber(e.comment_id);
        return commentId === null ? null : { kind: "comment", ...base, comment_id: commentId };
    }
    if (e.kind === "note") {
        const noteId = asNumber(e.note_id);
        const family = e.note_type;
        if (noteId === null || (family !== "personal" && family !== "task" && family !== "chat")) {
            return null;
        }
        return {
            kind: "note",
            note_type: family,
            note_id: noteId,
            title: typeof e.title === "string" ? e.title : "",
        };
    }
    return null;
};

const asUndoAnswer = (raw: unknown, fallbackStepId: number): UndoAnswer | null => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const d = raw as Record<string, unknown>;
    if (d.action !== "restored" && d.action !== "deleted") return null;
    return {
        run_id: typeof d.run_id === "string" ? d.run_id : "",
        step_id: asNumber(d.step_id) ?? fallbackStepId,
        tool_name: typeof d.tool_name === "string" ? d.tool_name : "",
        undone_at: typeof d.undone_at === "string" ? d.undone_at : new Date().toISOString(),
        action: d.action,
        restored: Array.isArray(d.restored)
            ? d.restored.filter((f): f is string => typeof f === "string")
            : [],
        skipped: asSkipped(d.skipped),
        entity: asUndoEntity(d.entity),
        summary: typeof d.summary === "string" ? d.summary : "",
        ...(typeof d.live_editor === "string" ? { live_editor: d.live_editor } : {}),
    };
};

const refusal = (
    code: UndoRefusalCode,
    status: number,
    extra: Partial<Omit<UndoRefusal, "code" | "status">> = {}
): UndoResult => ({
    kind: "refused",
    refusal: {
        code,
        status,
        message: null,
        skipped: [],
        detail: null,
        retryable:
            code === "network" ||
            code === "server" ||
            code === "throttled" ||
            code === "unauthorized",
        ...extra,
    },
});

export async function undoAgentStep(args: {
    runId: string;
    stepId: number;
    accessToken: string | null;
    signal?: AbortSignal;
}): Promise<UndoResult> {
    if (!args.accessToken) return refusal("unauthorized", 0, { retryable: false });
    let resp: Response;
    try {
        resp = await fetch(
            `${API_BASE}/agent/runs/${encodeURIComponent(args.runId)}/steps/${encodeURIComponent(
                String(args.stepId)
            )}/undo/`,
            {
                method: "POST",
                signal: args.signal,
                headers: { Authorization: `Bearer ${args.accessToken}` },
            }
        );
    } catch {
        return refusal("network", 0);
    }

    let data: unknown = null;
    try {
        data = await resp.json();
    } catch {
        // An HTML 404 from an older backend, a gateway page: no body to read.
    }

    if (resp.ok) {
        const answer = asUndoAnswer(data, args.stepId);
        // A 2xx that is not an undo answer did not undo what we can name: say so
        // rather than claim it did.
        return answer ? { kind: "undone", answer } : refusal("unknown", resp.status);
    }

    const body = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    const message =
        typeof body.error === "string"
            ? body.error
            : typeof body.detail === "string"
              ? body.detail
              : null;
    const extra = {
        message,
        skipped: asSkipped(body.skipped),
        detail: typeof body.detail === "string" ? body.detail : null,
    };
    // A DRF throttle is `{detail}` with no code; 401 is the token.
    if (resp.status === 429) return refusal("throttled", 429, extra);
    if (resp.status === 401) return refusal("unauthorized", 401, extra);
    if (resp.status >= 500) return refusal("server", resp.status, extra);
    const code = typeof body.code === "string" ? body.code : "";
    if (SERVER_UNDO_CODES.has(code)) {
        return refusal(code as UndoRefusalCode, resp.status, extra);
    }
    // No (known) code: the status is all there is. A 404 is "not found" even from
    // a backend that has no such route.
    return refusal(resp.status === 404 ? "not_found" : "unknown", resp.status, extra);
}

// `field_errors` as the card can use it: an object of `{path: sentence}`.
// Entries that are not text are dropped; no object at all (not a 422 from the
// edit check) is null, so the caller treats the response as any other failure.
const asFieldErrors = (raw: unknown): Record<string, string> | null => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const out: Record<string, string> = {};
    for (const [path, message] of Object.entries(raw)) {
        if (typeof message === "string") out[path] = message;
    }
    return out;
};

// Shared NDJSON consumer. Used by both /ask/ and /decide/ — the wire
// protocol is identical, only the request body differs.
async function runNdjsonStream(
    url: string,
    body: unknown,
    accessToken: string,
    signal: AbortSignal | undefined,
    handlers: BaseStreamHandlers,
    onEditsRejected?: (rejection: EditsRejected) => void
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
        let fieldErrors: Record<string, string> | null = null;
        try {
            const data = await resp.json();
            if (data?.error) message = data.error;
            // /decide/ answers 422 `{error, field_errors}` when the person's
            // edits cannot be applied. Plain JSON, not an NDJSON stream, and
            // not a failed run: hand it to the caller, who restores the card.
            if (resp.status === 422) fieldErrors = asFieldErrors(data?.field_errors);
        } catch {
            try {
                const txt = await resp.text();
                if (txt) message = txt.slice(0, 200);
            } catch {
                // ignore
            }
        }
        if (fieldErrors && onEditsRejected) {
            onEditsRejected({ message, fieldErrors });
            return;
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
                edited: evt.edited,
                edited_arguments: evt.edited_arguments,
                note: evt.note,
                note_folder: evt.note_folder,
                duration_ms: evt.duration_ms,
                project: evt.project,
                undo: asUndoRef(evt.undo),
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
                editable: evt.editable,
                // Only a real boolean is a claim; only a `false` has a reason.
                ...(typeof evt.undoable === "boolean" ? { undoable: evt.undoable } : {}),
                ...(evt.undoable === false && typeof evt.undo_reason === "string"
                    ? { undo_reason: evt.undo_reason }
                    : {}),
                approval_token: evt.approval_token,
                run_id: evt.run_id,
            });
            return true; // terminal: stream pauses here until /decide/
    }
    return false;
}
