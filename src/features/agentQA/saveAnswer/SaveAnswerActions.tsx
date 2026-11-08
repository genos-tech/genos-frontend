// "Save as note" and "Save as task" on an Ask Genos answer.
//
// THE CLICK IS THE AUTHORIZATION. The app writes the note or task itself from the
// full stored answer: no model call, no approval card, nothing the model sees.
//
// TWO PIECES, ONE STORE. The buttons sit in the per-turn action bar
// (`renderExtraActions`), which fades in on hover. What became of a click must not
// fade out, so its status line has the slot `AgentTurn` gives it under the answer
// (`renderAnswerStatus`). Both read `saveAnswerStore.ts`, which is also why a turn
// shown in two places (the overlay and the Genos page) agrees with itself.
//
// ABOVE THE PROVIDERS. Spotlight's overlay mounts these above the Avatar, project
// and UrlLinkModal contexts, so they read only the root ones: i18n (falls back to
// English without a provider) and the access token (null without one). The signed-in
// team and user are what sign-in left in localStorage, which is also what
// `switchTeam` rewrites. Opening what was made is the HOST's call (`onPreview`):
// the overlay closes and routes, the Ask modals quick-look. This never navigates.
//
// THE TASK DIALOG is the to-do pane's own (`ModalCreateTaskFromTodo`), lazy-loaded:
// it pulls the project and milestone pickers, which the entry chunk must not carry.

import {
    lazy,
    memo,
    Suspense,
    useCallback,
    useState,
    useSyncExternalStore,
    type ReactNode,
} from "react";
import type { PartialBlock } from "@blocknote/core";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import { Box, Button, IconButton, Typography } from "@mui/joy";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { Spinner } from "../../../components/ui/feedback/Skeleton";
import { useOptionalAccessToken } from "../../../context/AuthContext";
import { useTranslation } from "../../../i18n";
import type { SpotlightResult } from "../../spotlight/types";
import type { AgentTurnActionContext } from "../AgentTurn";
import { emitNoteChanged } from "../noteWriteTools";
import { answerTitle, buildAnswerBody } from "./answerBlocks";
import { NoteLimitError, saveAnswerAsNote } from "./saveAnswerAsNote";
import {
    beginSave,
    cancelSave,
    failSave,
    finishSave,
    getSaveState,
    subscribeSave,
    turnKeyOf,
    type SaveFailure,
    type SaveKind,
} from "./saveAnswerStore";
import { createdTaskSource, savedNoteSource } from "./syntheticSource";

const ModalCreateTaskFromTodo = lazy(() =>
    import("../../chat/components/todo/ModalCreateTaskFromTodo").then((m) => ({
        default: m.ModalCreateTaskFromTodo,
    }))
);

// Above the Spotlight overlay (13100); Joy's pickers are lifted with it.
export const SAVE_TASK_DIALOG_LAYER = 13200;

// What sign-in and `switchTeam` leave in localStorage.
const readIdentity = () => ({
    teamId: localStorage.getItem("teamId") ?? "",
    userId: localStorage.getItem("userId") ?? "",
});

/** A finished answer worth saving: text, no error, nothing still streaming or
 *  waiting on a decision, and a completed run behind it (a cancelled turn keeps
 *  its partial text but has no run id, and half an answer is not worth a note). */
export const canSaveAnswer = (ctx: AgentTurnActionContext): boolean =>
    !ctx.hasError &&
    !ctx.isStreaming &&
    !ctx.awaitingApproval &&
    Boolean(ctx.runId) &&
    ctx.answer.trim() !== "";

interface SaveProps {
    turnKey: string;
    askedQuery: string;
    answer: string;
    answerSources: readonly SpotlightResult[];
    sourcesById: ReadonlyMap<string, SpotlightResult>;
    onPreview: (source: SpotlightResult) => void;
}

// The note save, shared by the button and the status line's "Try again".
const runNoteSave = async (
    props: SaveProps,
    copy: { introTemplate: string; fallbackTitle: string },
    accessToken: string | null
) => {
    const { turnKey, askedQuery, answer, answerSources, sourcesById } = props;
    if (!beginSave(turnKey, "note")) return;
    const body = buildAnswerBody({
        askedQuery,
        answer,
        answerSources,
        sourcesById,
        introTemplate: copy.introTemplate,
    });
    if (!body.ok) {
        failSave(turnKey, "note", "tooLong");
        return;
    }
    const title = answerTitle(askedQuery, copy.fallbackTitle);
    try {
        const noteId = await saveAnswerAsNote({
            accessToken,
            ...readIdentity(),
            title,
            blocks: body.blocks,
        });
        // The notes sidebar re-reads on this, as it does for an approved agent note.
        emitNoteChanged("create_note", { note_id: noteId, note_type: "personal", title });
        finishSave(turnKey, "note", savedNoteSource(noteId, title));
    } catch (err) {
        failSave(turnKey, "note", err instanceof NoteLimitError ? "limitReached" : "failed");
    }
};

const useSaveState = (turnKey: string, kind: SaveKind) => {
    const subscribe = useCallback(
        (listener: () => void) => subscribeSave(turnKey, listener),
        [turnKey]
    );
    const getSnapshot = useCallback(() => getSaveState(turnKey, kind), [turnKey, kind]);
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

const buttonSx = { minWidth: 0, p: "3px" } as const;
const iconSx = { fontSize: 14 } as const;

const SaveAnswerButtons = memo((props: SaveProps) => {
    const { turnKey, askedQuery, answer, answerSources, sourcesById } = props;
    const { t } = useTranslation();
    const s = t.agentSave;
    const accessToken = useOptionalAccessToken();
    const note = useSaveState(turnKey, "note");
    const task = useSaveState(turnKey, "task");
    // The task dialog, with the body it will create. Local: it is one person's
    // open form, not a fact about the turn.
    const [draft, setDraft] = useState<{
        title: string;
        blocks: PartialBlock[];
        identity: { teamId: string; userId: string };
    } | null>(null);

    const saveNote = useCallback(
        () =>
            void runNoteSave(
                props,
                { introTemplate: s.note.intro, fallbackTitle: s.note.fallbackTitle },
                accessToken
            ),
        [props, s.note.intro, s.note.fallbackTitle, accessToken]
    );

    const openTaskDialog = useCallback(() => {
        const body = buildAnswerBody({
            askedQuery,
            answer,
            answerSources,
            sourcesById,
            introTemplate: s.note.intro,
        });
        if (!body.ok) {
            failSave(turnKey, "task", "tooLong");
            return;
        }
        setDraft({
            title: answerTitle(askedQuery, s.note.fallbackTitle),
            blocks: body.blocks,
            identity: readIdentity(),
        });
    }, [
        turnKey,
        askedQuery,
        answer,
        answerSources,
        sourcesById,
        s.note.intro,
        s.note.fallbackTitle,
    ]);

    const closeDialog = useCallback(() => {
        setDraft(null);
        // A refused "too long" is stale once the person tries again.
        if (getSaveState(turnKey, "task").status === "error") cancelSave(turnKey, "task");
    }, [turnKey]);

    const noteButton =
        note.status === "saved" ? (
            <IconButton
                aria-label={s.note.saved}
                color="success"
                size="sm"
                sx={buttonSx}
                variant="plain"
                disabled
            >
                <CheckRoundedIcon sx={iconSx} />
            </IconButton>
        ) : note.status === "saving" ? (
            <IconButton aria-label={s.note.saving} size="sm" sx={buttonSx} variant="plain" loading>
                <StickyNote2RoundedIcon sx={iconSx} />
            </IconButton>
        ) : (
            <AppTooltip title={s.note.tooltip}>
                <IconButton
                    aria-label={s.note.button}
                    color="neutral"
                    size="sm"
                    sx={buttonSx}
                    variant="plain"
                    onClick={saveNote}
                >
                    <StickyNote2RoundedIcon sx={iconSx} />
                </IconButton>
            </AppTooltip>
        );

    const taskButton =
        task.status === "saved" ? (
            <IconButton
                aria-label={s.task.saved}
                color="success"
                size="sm"
                sx={buttonSx}
                variant="plain"
                disabled
            >
                <CheckRoundedIcon sx={iconSx} />
            </IconButton>
        ) : (
            <AppTooltip title={s.task.tooltip}>
                <IconButton
                    aria-label={s.task.button}
                    color="neutral"
                    size="sm"
                    sx={buttonSx}
                    variant="plain"
                    onClick={openTaskDialog}
                >
                    <TaskAltRoundedIcon sx={iconSx} />
                </IconButton>
            </AppTooltip>
        );

    return (
        <>
            {noteButton}
            {taskButton}
            {draft && (
                <Suspense fallback={null}>
                    <ModalCreateTaskFromTodo
                        layer={SAVE_TASK_DIALOG_LAYER}
                        myself={draft.identity}
                        openCreatedTask={false}
                        todoNotes={draft.blocks}
                        todoTitle={draft.title}
                        copy={{
                            heading: s.task.modal.heading,
                            description: s.task.modal.description,
                        }}
                        open
                        onClose={closeDialog}
                        onCreated={(taskId, info) => {
                            finishSave(
                                turnKey,
                                "task",
                                taskId != null && info
                                    ? createdTaskSource(
                                          taskId,
                                          info.projectId,
                                          info.title,
                                          info.displayId
                                      )
                                    : undefined
                            );
                        }}
                    />
                </Suspense>
            )}
        </>
    );
});
SaveAnswerButtons.displayName = "SaveAnswerButtons";

const failureText = (
    kind: SaveKind,
    failure: SaveFailure | undefined,
    s: ReturnType<typeof useTranslation>["t"]["agentSave"]
) => {
    if (failure === "limitReached") return s.note.limitReached;
    if (failure === "tooLong") return kind === "note" ? s.note.tooLong : s.task.tooLong;
    return s.note.failed;
};

const SaveAnswerStatus = memo((props: SaveProps) => {
    const { turnKey, onPreview } = props;
    const { t } = useTranslation();
    const s = t.agentSave;
    const accessToken = useOptionalAccessToken();
    const note = useSaveState(turnKey, "note");
    const task = useSaveState(turnKey, "task");

    const retry = useCallback(
        () =>
            void runNoteSave(
                props,
                { introTemplate: s.note.intro, fallbackTitle: s.note.fallbackTitle },
                accessToken
            ),
        [props, s.note.intro, s.note.fallbackTitle, accessToken]
    );

    const rows: ReactNode[] = [];
    const line = (id: string, icon: ReactNode, text: string, action?: ReactNode) =>
        rows.push(
            <Box
                key={id}
                role="status"
                sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}
            >
                {icon}
                <Typography level="body-xs" sx={{ color: "text.tertiary", minWidth: 0 }}>
                    {text}
                </Typography>
                {action}
            </Box>
        );
    const ok = <CheckRoundedIcon sx={{ fontSize: 16, color: "success.500", flexShrink: 0 }} />;
    const warn = <InfoOutlinedIcon sx={{ fontSize: 16, color: "warning.500", flexShrink: 0 }} />;
    const busy = <Spinner />;
    const open = (label: string, target?: SpotlightResult) =>
        target ? (
            <Button
                color="primary"
                size="sm"
                sx={{ minHeight: 0, py: 0, px: 0.5, fontSize: "0.75rem" }}
                variant="plain"
                onClick={() => onPreview(target)}
            >
                {label}
            </Button>
        ) : undefined;

    if (note.status === "saving") line("note", busy, s.note.saving);
    else if (note.status === "saved") {
        line("note", ok, s.note.saved, open(s.note.open, note.target));
    } else if (note.status === "error") {
        line(
            "note",
            warn,
            failureText("note", note.failure, s),
            note.failure === "tooLong" ? undefined : (
                <Button
                    color="primary"
                    size="sm"
                    sx={{ minHeight: 0, py: 0, px: 0.5, fontSize: "0.75rem" }}
                    variant="plain"
                    onClick={retry}
                >
                    {s.note.retry}
                </Button>
            )
        );
    }
    if (task.status === "saved") {
        line("task", ok, s.task.saved, open(s.task.open, task.target));
    } else if (task.status === "error") {
        line("task", warn, failureText("task", task.failure, s));
    }

    if (rows.length === 0) return null;
    return <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, mt: 0.5 }}>{rows}</Box>;
});
SaveAnswerStatus.displayName = "SaveAnswerStatus";

const propsOf = (ctx: AgentTurnActionContext): SaveProps => ({
    turnKey: turnKeyOf(ctx.runId, ctx.askedQuery, ctx.answer),
    askedQuery: ctx.askedQuery,
    answer: ctx.answer,
    answerSources: ctx.answerSources,
    sourcesById: ctx.sourcesById,
    onPreview: ctx.onPreview,
});

// MODULE-LEVEL, so every host hands `AgentTurn` the same two functions for ever: a
// finished turn re-renders for nothing because of them. The components they return
// are `memo`, keyed on values that only change when the turn itself does.
export const renderSaveAnswerActions = (ctx: AgentTurnActionContext): ReactNode =>
    canSaveAnswer(ctx) ? <SaveAnswerButtons {...propsOf(ctx)} /> : null;

export const renderSaveAnswerStatus = (ctx: AgentTurnActionContext): ReactNode =>
    canSaveAnswer(ctx) ? <SaveAnswerStatus {...propsOf(ctx)} /> : null;
