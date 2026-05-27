// Input row for agent-Q&A surfaces: textarea + Send-or-Cancel button.
// When the stream is in-flight, the textarea disables and Send swaps
// to Cancel. The caller can pass `disabled` to additionally lock the
// row (e.g. while a prerequisite like a summary is still loading).

import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { Button, Stack, Textarea } from "@mui/joy";

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
    return (
        <Stack alignItems="flex-end" direction="row" spacing={1}>
            <Textarea
                disabled={isStreaming}
                maxRows={5}
                minRows={1}
                placeholder={labels.conversation.placeholder}
                sx={{ flex: 1 }}
                value={state.query}
                onChange={(e) => state.setQuery(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        state.onAsk();
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
                    onClick={() => state.onAsk()}
                >
                    {labels.conversation.send}
                </Button>
            )}
        </Stack>
    );
};
