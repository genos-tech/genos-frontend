// Input row for agent-Q&A surfaces: textarea + Send-or-Cancel button.
// When the stream is in-flight, the textarea disables and Send swaps
// to Cancel. The caller can pass `disabled` to additionally lock the
// row (e.g. while a prerequisite like a summary is still loading).
//
// The textarea carries the @/# mention picker (useAgentMentionDraft):
// typing a trigger opens a dropdown fed by the same datasets as the
// BlockNote editors' mention menus; picking splices a plain-text
// `@Name` / `#Title` token into the query and records the resolved ref.
// On send the surviving refs ride along to `onAsk` as structured
// mentions. While the dropdown is open, Arrow/Enter/Escape drive it
// (Escape stops propagation so the host modal stays open).

import { useCallback, useRef } from "react";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { Box, Button, Stack, Textarea } from "@mui/joy";

import { MentionHighlightOverlay } from "./mentions/MentionHighlightOverlay";
import { MentionSuggestionDropdown } from "./mentions/MentionSuggestionDropdown";
import type { AgentMentionCandidate } from "./mentions/types";
import { useAgentMentionDraft } from "./mentions/useAgentMentionDraft";
import { useAgentMentionSources } from "./mentions/useAgentMentionSources";
import type { AgentQALabels, UseAgentQAReturn } from "./types";

interface AgentQAInputProps {
    state: UseAgentQAReturn;
    labels: AgentQALabels;
    // Caller-side gate (e.g. "summary not loaded yet"). The hook's
    // own in-flight / pending-approval states are already handled
    // internally; `disabled` adds extra constraints on top.
    disabled?: boolean;
}

export const AgentQAInput = ({ state, labels, disabled }: AgentQAInputProps) => {
    const isStreaming = state.ask.isStreaming;
    const sendDisabled = disabled || !state.query.trim();

    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    // Both host modals (ThreadAsk / NoteAsk) mount inside
    // HashMentionDataProvider + AvatarContext, so the sources hook
    // needs no props here.
    const sources = useAgentMentionSources();
    const mention = useAgentMentionDraft({
        value: state.query,
        onChange: state.setQuery,
        members: sources.members,
        entities: sources.entities,
    });

    const syncCaret = useCallback(() => {
        const el = textareaRef.current;
        if (el) mention.setCaret(el.selectionStart ?? 0);
    }, [mention]);

    const handleMentionSelect = useCallback(
        (c: AgentMentionCandidate) => {
            const newCaret = mention.selectSuggestion(c);
            // Restore focus + caret after React commits the new value.
            requestAnimationFrame(() => {
                const el = textareaRef.current;
                if (el) {
                    el.focus();
                    el.setSelectionRange(newCaret, newCaret);
                }
            });
        },
        [mention]
    );

    const submit = useCallback(() => {
        state.onAsk(undefined, mention.consumeMentions(state.query));
    }, [state, mention]);

    return (
        <Box ref={wrapperRef} sx={{ position: "relative" }}>
            {mention.pickerOpen && !isStreaming && (
                <MentionSuggestionDropdown
                    anchorRef={wrapperRef}
                    ariaLabel={labels.mentions?.ariaLabel}
                    highlightIndex={mention.highlightIndex}
                    placement="above"
                    suggestions={mention.suggestions}
                    onSelect={handleMentionSelect}
                />
            )}
            {/* Marker highlight over live mention tokens, so a picked
                mention is visibly different from identical typed text. */}
            <MentionHighlightOverlay
                containerRef={wrapperRef}
                ranges={mention.highlightRanges}
                elementRef={textareaRef}
                value={state.query}
            />
            <Stack alignItems="flex-end" direction="row" spacing={1}>
                <Textarea
                    disabled={isStreaming}
                    maxRows={5}
                    minRows={1}
                    placeholder={labels.conversation.placeholder}
                    slotProps={{ textarea: { ref: textareaRef } }}
                    sx={{ flex: 1 }}
                    value={state.query}
                    onChange={(e) => {
                        state.setQuery(e.target.value);
                        mention.setCaret(e.target.selectionStart ?? e.target.value.length);
                    }}
                    onClick={syncCaret}
                    onKeyUp={syncCaret}
                    onKeyDown={(e) => {
                        // IME guard: while an input-method composition is
                        // active (typing Japanese / Chinese / Korean, or
                        // accented input), Enter CONFIRMS the composition —
                        // it is not a send, and Arrow/Escape drive the
                        // candidate window. Bail so the IME owns the key.
                        // Without this, the confirming Enter both fires the
                        // ask AND leaves the just-committed text behind: the
                        // commit's trailing onChange repopulates the box
                        // after onAsk's setQuery("") already cleared it.
                        // `isComposing` is the modern signal; keyCode 229 is
                        // the legacy sentinel for engines that don't set it.
                        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                        // Picker-open precedence: the dropdown owns
                        // Arrow / Enter / Escape before the send logic.
                        if (mention.pickerOpen) {
                            if (e.key === "ArrowDown") {
                                e.preventDefault();
                                mention.moveHighlight(1);
                                return;
                            }
                            if (e.key === "ArrowUp") {
                                e.preventDefault();
                                mention.moveHighlight(-1);
                                return;
                            }
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                const c = mention.suggestions[mention.highlightIndex];
                                if (c) handleMentionSelect(c);
                                return;
                            }
                            if (e.key === "Escape") {
                                // stopPropagation keeps the keystroke from
                                // reaching the host Joy Modal — one Escape
                                // closes the picker, the next the modal.
                                e.preventDefault();
                                e.stopPropagation();
                                mention.closePicker();
                                return;
                            }
                        }
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            submit();
                        }
                    }}
                />
                {isStreaming ? (
                    <Button color="neutral" variant="soft" onClick={state.onCancel}>
                        {labels.conversation.cancel}
                    </Button>
                ) : (
                    <Button
                        disabled={sendDisabled}
                        startDecorator={<SendRoundedIcon sx={{ fontSize: 16 }} />}
                        // Wrap to drop the MouseEvent argument so it isn't
                        // coerced into `overrideQuery` and used verbatim as
                        // the query text.
                        onClick={() => submit()}
                    >
                        {labels.conversation.send}
                    </Button>
                )}
            </Stack>
        </Box>
    );
};
