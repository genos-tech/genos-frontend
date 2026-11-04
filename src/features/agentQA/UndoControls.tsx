// Undo of an approved write, on the turn that made it.
//
// WHY NOT THE ACTION BAR. The per-turn action bar (`.turn-actions`) is revealed on
// hover. Undo is time-sensitive and the person's main way back from something they
// just approved, so it must be on screen without a hover, on desktop and on touch:
// `AgentTurn` gives it a slot of its own, under the steps, and keeps
// `renderExtraActions` free for others.
//
// ONE CONTROL PER WRITE, NEWEST FIRST. A single write gets a plain "Undo"; several
// get one each, labelled with the tool's phrase ("Creating a task"). The list is
// already ordered newest first (`mergeUndoSteps`).
//
// THE STATE IS NOT HERE. Each control reads its step's state from the undo store
// (`undoStore.ts`, `useSyncExternalStore`), so an undo re-renders this one control
// and nothing above it: not the turn, not any other turn. And a turn mounted twice
// (Spotlight in the overlay and on the Genos page) shows the same state in both.
//
// States: idle -> "Undoing..." (disabled; the store refuses a second request) ->
//   done: a calm status line, replacing the button; or
//   refused: a sentence per code, and a button only where trying again can help.
// A write the server says is already undone shows "Undone", with no button. A write
// whose window has passed on this clock gets no button either (the server stays the
// authority: it also refuses on its own clock).
//
// NO CONFIRM DIALOG. The click is the authorization; the tooltip says what it does.

import { memo, useCallback, useSyncExternalStore } from "react";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import { Box, Button, CircularProgress, Typography } from "@mui/joy";

import { AppTooltip } from "../../components/ui/AppTooltip";
import { fmt } from "../../i18n";
import { purplePalette } from "../../theme/purplePalette";
import type { AgentTurnLabels } from "./agentTurnLabels";
import { isPastAvailable, type UndoRequest, type UndoStepRef } from "./undoSteps";
import { getUndoState, subscribeUndo } from "./undoStore";

interface UndoControlProps {
    step: UndoStepRef;
    // Several writes in the turn: each says which one it undoes.
    labelled: boolean;
    labels: AgentTurnLabels;
    isDark: boolean;
    onUndo: (request: UndoRequest) => void;
}

const UndoControl = memo(({ step, labelled, labels, isDark, onUndo }: UndoControlProps) => {
    const { stepId, runId, toolName, undoneAt, availableUntil } = step;
    const subscribe = useCallback(
        (listener: () => void) => subscribeUndo(stepId, listener),
        [stepId]
    );
    const getSnapshot = useCallback(() => getUndoState(stepId), [stepId]);
    const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const u = labels.undo;
    const tool = labels.approval.toolLabel(toolName);

    const click = useCallback(() => {
        if (runId) onUndo({ runId, stepId, toolName });
    }, [onUndo, runId, stepId, toolName]);

    // A line of status, replacing the button.
    const status = (text: string, tone: "done" | "refused") => (
        <Box
            role="status"
            sx={{ display: "flex", alignItems: "flex-start", gap: 0.5, minWidth: 0 }}
        >
            {tone === "done" ? (
                <CheckRoundedIcon
                    sx={{ fontSize: 16, mt: "1px", color: palette.successTint, flexShrink: 0 }}
                />
            ) : (
                <InfoOutlinedIcon
                    sx={{ fontSize: 16, mt: "1px", color: palette.warningTint, flexShrink: 0 }}
                />
            )}
            <Typography level="body-xs" sx={{ color: palette.textMuted, minWidth: 0 }}>
                {text}
            </Typography>
        </Box>
    );

    const button = (disabled: boolean, busy: boolean, label: string) => {
        const trigger = (
            <Button
                aria-label={labelled ? fmt(u.buttonFor, { tool }) : undefined}
                color="neutral"
                disabled={disabled}
                size="sm"
                sx={{ fontSize: "0.875rem" }}
                variant="outlined"
                startDecorator={
                    busy ? (
                        <CircularProgress size="sm" sx={{ "--CircularProgress-size": "14px" }} />
                    ) : (
                        <UndoRoundedIcon sx={{ fontSize: 16 }} />
                    )
                }
                onClick={click}
            >
                {label}
            </Button>
        );
        // No tooltip on a disabled button (Joy cannot listen to it).
        return disabled ? trigger : <AppTooltip title={u.tooltip(toolName)}>{trigger}</AppTooltip>;
    };

    let body: React.ReactNode;
    if (state.status === "undone") {
        body = status(u.outcome(state.answer), "done");
    } else if (undoneAt) {
        body = status(u.alreadyUndone, "done");
    } else if (state.status === "undoing") {
        body = button(true, true, u.undoing);
    } else if (state.status === "refused") {
        body = (
            <>
                {status(u.refusal(state.refusal), "refused")}
                {state.refusal.retryable && runId ? button(false, false, u.retry) : null}
            </>
        );
    } else if (!runId || isPastAvailable(availableUntil)) {
        // Nothing to ask the server with, or past its window.
        body = null;
    } else {
        body = button(false, false, u.button);
    }
    if (body === null) return null;

    return (
        <Box
            data-step-id={stepId}
            data-testid="undo-control"
            sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75 }}
        >
            {labelled ? (
                <Typography level="body-xs" sx={{ color: palette.textMuted }}>
                    {tool}
                </Typography>
            ) : null}
            {body}
        </Box>
    );
});
UndoControl.displayName = "UndoControl";

interface UndoSlotProps {
    steps: readonly UndoStepRef[];
    labels: AgentTurnLabels;
    isDark: boolean;
    onUndo: (request: UndoRequest) => void;
}

export const UndoSlot = ({ steps, labels, isDark, onUndo }: UndoSlotProps) => {
    if (steps.length === 0) return null;
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 0.5, mb: 0.5 }}>
            {steps.map((step) => (
                <UndoControl
                    key={step.stepId}
                    isDark={isDark}
                    labelled={steps.length > 1}
                    labels={labels}
                    step={step}
                    onUndo={onUndo}
                />
            ))}
        </Box>
    );
};
