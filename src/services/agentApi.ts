// Streaming consumer for POST /api/v2/agent/ask.
//
// Phase 3: the backend now runs a multi-step Gemini function-calling
// loop. NDJSON event types:
//
//   {"type": "tool_call_start", "step": N, "tool_name": "...", "arguments": {...}}
//   {"type": "tool_call_result", "step": N, "tool_name": "...", "summary": "..."}
//   {"type": "tool_call_error",  "step": N, "tool_name": "...", "error": "..."}
//   {"type": "sources", "sources": [...]}        // after each search call
//   {"type": "answer_delta", "text": "Hello"}
//   {"type": "done"}
//   {"type": "error", "message": "..."}
//
// Why fetch instead of axios: axios doesn't expose the response body
// as a ReadableStream in the browser, so we'd have to buffer the
// whole reply before the user sees anything. Native fetch + the body
// reader gives us token-by-token streaming.

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

export interface AskAgentArgs {
    query: string;
    teamId: string;
    accessToken: string | null;
    entityTypes?: Array<"chat" | "task" | "note">;
    signal?: AbortSignal;
    onSources: (sources: SpotlightResult[]) => void;
    onDelta: (text: string) => void;
    onDone: () => void;
    onError: (message: string) => void;
    onToolStart?: (payload: ToolCallStartPayload) => void;
    onToolResult?: (payload: ToolCallResultPayload) => void;
    onToolError?: (payload: ToolCallErrorPayload) => void;
}

export type AgentEvent =
    | { type: "sources"; sources: SpotlightResult[] }
    | { type: "answer_delta"; text: string }
    | { type: "done" }
    | { type: "error"; message: string }
    | ({ type: "tool_call_start" } & ToolCallStartPayload)
    | ({ type: "tool_call_result" } & ToolCallResultPayload)
    | ({ type: "tool_call_error" } & ToolCallErrorPayload);

export async function askAgentStream(args: AskAgentArgs): Promise<void> {
    const {
        query,
        teamId,
        accessToken,
        entityTypes,
        signal,
        onSources,
        onDelta,
        onDone,
        onError,
    } = args;

    if (!accessToken) {
        onError("Not signed in.");
        return;
    }

    let resp: Response;
    try {
        resp = await fetch(`${API_BASE}/agent/ask/`, {
            method: "POST",
            signal,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                query,
                team_id: teamId,
                entity_types: entityTypes,
            }),
        });
    } catch (err) {
        // AbortError is expected when the user closes the overlay /
        // types a new query; silently swallow it.
        if ((err as Error).name === "AbortError") return;
        onError(`Network error: ${(err as Error).message}`);
        return;
    }

    if (!resp.ok) {
        // Try to extract a JSON error body; fall back to raw text.
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
        onError(message);
        return;
    }

    const reader = resp.body?.getReader();
    if (!reader) {
        onError("Streaming response has no body.");
        return;
    }
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    const handlers = {
        onSources,
        onDelta,
        onDone,
        onError,
        onToolStart: args.onToolStart,
        onToolResult: args.onToolResult,
        onToolError: args.onToolError,
    };

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            // Split on newlines; keep the trailing partial line in
            // the buffer for the next iteration.
            let nl = buffer.indexOf("\n");
            while (nl !== -1) {
                const line = buffer.slice(0, nl).trim();
                buffer = buffer.slice(nl + 1);
                if (line) {
                    dispatchLine(line, handlers);
                }
                nl = buffer.indexOf("\n");
            }
        }
        // Flush any final partial line.
        const tail = buffer.trim();
        if (tail) dispatchLine(tail, handlers);
    } catch (err) {
        if ((err as Error).name === "AbortError") return;
        onError(`Stream interrupted: ${(err as Error).message}`);
    } finally {
        try {
            reader.releaseLock();
        } catch {
            // ignore
        }
    }
}

interface DispatchHandlers {
    onSources: AskAgentArgs["onSources"];
    onDelta: AskAgentArgs["onDelta"];
    onDone: AskAgentArgs["onDone"];
    onError: AskAgentArgs["onError"];
    onToolStart?: AskAgentArgs["onToolStart"];
    onToolResult?: AskAgentArgs["onToolResult"];
    onToolError?: AskAgentArgs["onToolError"];
}

function dispatchLine(line: string, h: DispatchHandlers) {
    let evt: AgentEvent;
    try {
        evt = JSON.parse(line) as AgentEvent;
    } catch {
        // Server promised NDJSON; bail loudly so we notice.
        h.onError(`Malformed NDJSON line: ${line.slice(0, 120)}`);
        return;
    }
    switch (evt.type) {
        case "sources":
            h.onSources(evt.sources || []);
            return;
        case "answer_delta":
            if (evt.text) h.onDelta(evt.text);
            return;
        case "done":
            h.onDone();
            return;
        case "error":
            h.onError(evt.message || "Unknown error");
            return;
        case "tool_call_start":
            h.onToolStart?.({
                step: evt.step,
                tool_name: evt.tool_name,
                arguments: evt.arguments,
            });
            return;
        case "tool_call_result":
            h.onToolResult?.({
                step: evt.step,
                tool_name: evt.tool_name,
                summary: evt.summary,
            });
            return;
        case "tool_call_error":
            h.onToolError?.({
                step: evt.step,
                tool_name: evt.tool_name,
                error: evt.error,
            });
            return;
    }
}
