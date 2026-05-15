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
//   {"type": "tool_call_result", "step", "tool_name", "summary"}
//   {"type": "tool_call_error",  "step", "tool_name", "error"}
//   {"type": "tool_call_pending_approval",
//        "step", "tool_name", "arguments", "approval_token", "run_id"}
//   {"type": "sources", "sources": [...]}
//   {"type": "answer_delta", "text": "..."}
//   {"type": "done", "session_id": "..."}   ← session_id added in Phase 8
//   {"type": "error", "message": "..."}
//
// Why fetch instead of axios: axios doesn't expose the response body
// as a ReadableStream in the browser. Native fetch + the body reader
// gives us token-by-token streaming.

import type { SpotlightResult } from "../features/spotlight/types";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

export interface ToolCallStartPayload {
    step: number;
    tool_name: string;
    arguments: Record<string, unknown>;
}

export interface ToolCallResultPayload {
    step: number;
    tool_name: string;
    summary: string;
}

export interface ToolCallErrorPayload {
    step: number;
    tool_name: string;
    error: string;
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
    | { type: "done"; session_id?: string }
    | { type: "error"; message: string }
    | ({ type: "tool_call_start" } & ToolCallStartPayload)
    | ({ type: "tool_call_result" } & ToolCallResultPayload)
    | ({ type: "tool_call_error" } & ToolCallErrorPayload)
    | ({ type: "tool_call_pending_approval" } & PendingApprovalPayload);

interface BaseStreamHandlers {
    onSources: (sources: SpotlightResult[]) => void;
    onDelta: (text: string) => void;
    onDone: (sessionId?: string) => void;
    onError: (message: string) => void;
    onToolStart?: (payload: ToolCallStartPayload) => void;
    onToolResult?: (payload: ToolCallResultPayload) => void;
    onToolError?: (payload: ToolCallErrorPayload) => void;
    onPendingApproval?: (payload: PendingApprovalPayload) => void;
}

export interface AskAgentArgs extends BaseStreamHandlers {
    query: string;
    teamId: string;
    accessToken: string | null;
    sessionId?: string;
    entityTypes?: Array<"chat" | "task" | "note">;
    signal?: AbortSignal;
}

export interface DecideAgentArgs extends BaseStreamHandlers {
    runId: string;
    approvalToken: string;
    decision: "approve" | "reject";
    accessToken: string | null;
    signal?: AbortSignal;
}

export interface AgentUsage {
    used: number;
    limit: number | null; // null = unlimited
    is_unlimited: boolean;
}

export async function fetchAgentUsage(accessToken: string): Promise<AgentUsage | null> {
    try {
        const resp = await fetch(`${API_BASE}/agent/usage/`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!resp.ok) return null;
        return (await resp.json()) as AgentUsage;
    } catch {
        return null;
    }
}

export async function askAgentStream(args: AskAgentArgs): Promise<void> {
    if (!args.accessToken) {
        args.onError("Not signed in.");
        return;
    }
    await runNdjsonStream(
        `${API_BASE}/agent/ask/`,
        {
            query: args.query,
            team_id: args.teamId,
            entity_types: args.entityTypes,
            ...(args.sessionId ? { session_id: args.sessionId } : {}),
        },
        args.accessToken,
        args.signal,
        args
    );
}

export async function decideAgent(args: DecideAgentArgs): Promise<void> {
    if (!args.accessToken) {
        args.onError("Not signed in.");
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
        handlers.onError(`Network error: ${(err as Error).message}`);
        return;
    }

    if (!resp.ok) {
        let message = `Server returned ${resp.status}`;
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
        handlers.onError("Streaming response has no body.");
        return;
    }
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let doneEventReceived = false;

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
                    if (!doneEventReceived) {
                        doneEventReceived = dispatchLine(line, handlers);
                    }
                }
                nl = buffer.indexOf("\n");
            }
        }
        const tail = buffer.trim();
        if (tail && !doneEventReceived) {
            doneEventReceived = dispatchLine(tail, handlers);
        }
    } catch (err) {
        // AbortError is expected when the user cancels or closes the
        // overlay; silently swallow it — the hook's onCancel already
        // cleans up the streaming state manually.
        if ((err as Error).name === "AbortError") return;
        handlers.onError(`Stream interrupted: ${(err as Error).message}`);
        return;
    } finally {
        try {
            reader.releaseLock();
        } catch {
            // ignore
        }
    }

    // If the server closed the connection without sending a `done`
    // event (e.g. mid-stream server crash, network drop), surface an
    // error so the hook's `onError` handler runs and clears the
    // `isStreaming` flag. Without this the UI would show "streaming…"
    // forever.
    if (!doneEventReceived) {
        handlers.onError("The answer stream ended unexpectedly. Please try again.");
    }
}

// Returns true only for the `done` event so the caller can detect a
// clean stream finish vs a connection that closed without one.
function dispatchLine(line: string, h: BaseStreamHandlers): boolean {
    let evt: AgentEvent;
    try {
        evt = JSON.parse(line) as AgentEvent;
    } catch {
        h.onError(`Malformed NDJSON line: ${line.slice(0, 120)}`);
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
            h.onDone(evt.session_id);
            return true; // signals clean finish
        case "error":
            h.onError(evt.message || "Unknown error");
            return false;
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
            });
            return false;
        case "tool_call_error":
            h.onToolError?.({
                step: evt.step,
                tool_name: evt.tool_name,
                error: evt.error,
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
            return false;
    }
    return false;
}
