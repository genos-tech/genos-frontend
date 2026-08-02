// Public surface of the agentQA package. Wrappers (threadAsk and
// future noteAsk variants) import everything they need from here.

export { AgentQAConversation } from "./AgentQAConversation";
export { AgentQAInput } from "./AgentQAInput";
export { ApprovalCard } from "./ApprovalCard";
export { agentQAUrlTransform, CitationAnchor } from "./CitationAnchor";
export {
    buildSourcesById,
    CITATION_HREF_PREFIX,
    CITATION_PATTERN,
    citedChipSources,
    extractBareCitedIds,
    extractInlineCitedIds,
    rewriteCitations,
    sourceToUrl,
} from "./citationUtils";
export { FeedbackThumbs } from "./FeedbackThumbs";
export { DARK_TEXT_STRONG, markdownAnswerSx } from "./markdownAnswerSx";
export { markdownToBlocks } from "./markdownToBlocks";
export { sessionTurnToCompleted } from "./sessionTurns";
export { SourceChips } from "./SourceChips";
export { formatDurationMs, humanReadableCall, ToolProgressList } from "./ToolProgressList";
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
    type ToolEvent,
    type ToolEventStatus,
    type UseAgentQAArgs,
    type UseAgentQAReturn,
} from "./types";
export { useAgentQA } from "./useAgentQA";
