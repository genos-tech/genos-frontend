// Streaming consumer for POST /api/v2/agent/ask.
//
// The backend ships NDJSON: one JSON object per newline. Each line
// has a `type` discriminator:
//
//   {"type": "sources", "sources": [...]}
//   {"type": "answer_delta", "text": "Hello"}
//   {"type": "answer_delta", "text": ", world"}
//   {"type": "done"}
//   {"type": "error", "message": "..."}
//
// Why fetch instead of axios: axios doesn't expose the response body
// as a ReadableStream in the browser, so we'd have to buffer the
// whole reply before the user sees anything. Native fetch + the body
// reader gives us token-by-token streaming.

import type { SpotlightResult } from "../features/spotlight/types";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

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
}

export type AgentEvent =
    | { type: "sources"; sources: SpotlightResult[] }
    | { type: "answer_delta"; text: string }
    | { type: "done" }
    | { type: "error"; message: string };

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
                    dispatchLine(line, onSources, onDelta, onDone, onError);
                }
                nl = buffer.indexOf("\n");
            }
        }
        // Flush any final partial line.
        const tail = buffer.trim();
        if (tail) dispatchLine(tail, onSources, onDelta, onDone, onError);
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

function dispatchLine(
    line: string,
    onSources: AskAgentArgs["onSources"],
    onDelta: AskAgentArgs["onDelta"],
    onDone: AskAgentArgs["onDone"],
    onError: AskAgentArgs["onError"]
) {
    let evt: AgentEvent;
    try {
        evt = JSON.parse(line) as AgentEvent;
    } catch {
        // Server promised NDJSON; bail loudly so we notice.
        onError(`Malformed NDJSON line: ${line.slice(0, 120)}`);
        return;
    }
    switch (evt.type) {
        case "sources":
            onSources(evt.sources || []);
            return;
        case "answer_delta":
            if (evt.text) onDelta(evt.text);
            return;
        case "done":
            onDone();
            return;
        case "error":
            onError(evt.message || "Unknown error");
            return;
    }
}
