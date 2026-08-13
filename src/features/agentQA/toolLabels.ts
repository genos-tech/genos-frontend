// Maps a backend agent `tool_name` to a friendly, non-technical label
// for display. The agent surfaces (Spotlight, thread-ask, note-ask) show
// this both on the in-flight tool-progress strip and in the approval-card
// title, so a non-technical user never reads an engineering identifier
// like `search_knowledge_base` or `update_tasks_bulk`.
//
// The label catalog lives in the `agentApproval` i18n namespace (localized
// like every other agent string). An unmapped tool_name falls back to the
// raw name — safe, and no worse than today — so a newly added backend tool
// can never crash the strip while its label is pending translation.

import type { Messages } from "../../i18n";

export const getToolLabel = (toolName: string, t: Messages): string =>
    (t.agentApproval.toolNames as Record<string, string>)[toolName] ?? toolName;
