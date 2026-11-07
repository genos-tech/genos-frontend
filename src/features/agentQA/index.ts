// Public surface of the agentQA package. Wrappers (threadAsk and
// future noteAsk variants) import everything they need from here.

export { agentMarkdownComponents, BlockedImage, ExternalLink } from "./agentMarkdown";
export { emitProjectToolResult } from "./approvedProjectWrites";
export { AgentQAConversation } from "./AgentQAConversation";
export { AgentQAInput } from "./AgentQAInput";
export { AgentTurn, type AgentTurnActionContext, type AgentTurnProps } from "./AgentTurn";
export {
    type AgentTurnHost,
    type AgentTurnLabels,
    buildAgentTurnLabels,
    type ChipLabels,
} from "./agentTurnLabels";
export { ApprovalCard } from "./ApprovalCard";
export {
    agentQAUrlTransform,
    buildSourcesById,
    CITATION_HREF_PREFIX,
    CITATION_PATTERN,
    citedChipSources,
    extractBareCitedIds,
    extractInlineCitedIds,
    rewriteCitations,
    sourceToUrl,
} from "./citationUtils";
export { CitationLink } from "./CitationLink";
export { FeedbackThumbs } from "./FeedbackThumbs";
export { markdownAnswerSx } from "./markdownAnswerSx";
export { markdownToBlocks } from "./markdownToBlocks";
export { renderSaveAnswerActions, renderSaveAnswerStatus } from "./saveAnswer/SaveAnswerActions";
export {
    type AgentSessionsDeletedDetail,
    deletionCoversSession,
    emitAgentSessionsDeleted,
    useAgentSessionsDeleted,
} from "./sessionEvents";
export { sessionTurnToCompleted } from "./sessionTurns";
export { type UndoRequest, type UndoStepRef } from "./undoSteps";
export { sourceChipLabel } from "./sourceChipLabel";
export { formatDurationMs, ToolProgressList } from "./ToolProgressList";
export { getToolLabel } from "./toolLabels";
export { MentionHighlightOverlay } from "./mentions/MentionHighlightOverlay";
export { MentionSuggestionDropdown } from "./mentions/MentionSuggestionDropdown";
export {
    type AgentMentionCandidate,
    type AgentMentionRef,
    mentionKey,
    toWireMentions,
} from "./mentions/types";
export {
    detectMentionTrigger,
    matchMentionTokens,
    useAgentMentionDraft,
    type MentionTokenMatch,
    type UseAgentMentionDraftReturn,
} from "./mentions/useAgentMentionDraft";
export { useAgentMentionSources } from "./mentions/useAgentMentionSources";
export {
    type AgentQALabels,
    type AgentRunResult,
    type AskState,
    type CompletedTurn,
    EMPTY_ASK_STATE,
    MAX_TURNS_IN_HISTORY,
    type StaticAnswer,
    type ToolEvent,
    type ToolEventStatus,
    type UseAgentQAArgs,
    type UseAgentQAReturn,
} from "./types";
export { useAgentQA } from "./useAgentQA";
