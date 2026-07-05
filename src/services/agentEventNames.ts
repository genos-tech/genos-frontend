// Canonical NDJSON event-type vocabulary for the agent stream
// (POST /api/v2/agent/ask/ and /api/v2/agent/decide/).
//
// ⚠️ KEEP IN SYNC — genos-api: origin/search_engine/agent/events.py
//
// Each repo pins its own code to its copy of this list: genos-api asserts
// every event type it emits is listed; this repo asserts
// (src/__tests__/agentEventContract.test.ts) that agentApi.ts dispatches
// every name here to a handler. Adding/renaming an event on one side
// without the other turns a silent production break (dead UI, stuck
// "streaming…" spinner) into a red build. Name-level tripwire only — it
// does not catch field renames inside an event. Contract & rationale:
// genos-docs spotlight/SPOTLIGHT_AGENT_CHANGE_SAFETY.md §4.3.
export const AGENT_EVENT_NAMES = [
    "sources",
    "answer_delta",
    "done",
    "error",
    "tool_call_start",
    "tool_call_result",
    "tool_call_error",
    "tool_call_pending_approval",
] as const;

export type AgentEventName = (typeof AGENT_EVENT_NAMES)[number];
