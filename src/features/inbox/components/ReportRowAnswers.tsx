// "On it" and "Not important" on a report's task row (MIP-1211).
//
// The two answers are quiet, secondary and never required: a report is already complete with no
// tap. They sit BESIDE the row's link, never inside it (a button inside a link is invalid and a
// tap would also open the task). One tap, no confirm: the row dims at once and says what
// happened with an Undo; a refusal is told in words and the row goes back.
//
// Layout: on a phone each button is an icon with its label under the row, 40 px high. From `sm`
// they are two 32 px icon buttons at the row's end, drawn on hover and focus (always on a
// device that cannot hover), each with a tooltip; the accessible name is the same everywhere
// and names the task.
//
// State is in `inboxAnswerStore`, by member, team and task, so the same task in another card
// answers together and a row Virtuoso recycled keeps its Undo. No request until a tap; the row
// does not re-render for another task's answer. `children` is the row's own link, drawn by the
// card: it is handed in as an element, so a store change redraws this shell and not the row.

import {
    memo,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
    type ReactElement,
    type ReactNode,
} from "react";
import DoneRoundedIcon from "@mui/icons-material/DoneRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import { Box, Button, Typography } from "@mui/joy";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { useAuth } from "../../../context/AuthContext";
import { fmt, useTranslation } from "../../../i18n";
import { focusRing, g, type } from "../../../theme/tokens";
import {
    answerKey,
    getAnswer,
    isDimmed,
    subscribeAnswers,
    type AnswerEntry,
    type AnswerKey,
} from "../inboxAnswerStore";
import { answerTask, undoAnswer } from "../services/answerTask";

type Props = {
    userId: string;
    teamId: string;
    taskId: number;
    /** "WRD-7 Title": names the task in every label, so a screen reader hears which row. */
    name: string;
    children: ReactNode;
};

// From `sm` on a device that can hover, the buttons are drawn when the row is hovered or has
// focus inside it; on a phone, and on a touch tablet, they are always there.
const HOVER_ONLY = "@media (min-width: 600px) and (hover: hover) and (pointer: fine)";

/** From `sm` the buttons are two 32 px squares, 4 px apart, 4 px from the row: the card keeps
 *  this much room on a row of the same section that has no buttons. */
export const ANSWER_SLOT_WIDTH = 72;

const wrapSx = {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 0.5,
    minWidth: 0,
    [`${HOVER_ONLY}`]: {
        "& [data-answer-actions]": {
            opacity: 0,
            transition: `opacity ${g.motion.fast} ${g.ease}`,
        },
        "&:hover [data-answer-actions], &:focus-within [data-answer-actions]": { opacity: 1 },
    },
} as const;

const actionSx = {
    // 40 px with its label on a phone, a 32 px icon from `sm`.
    minHeight: { xs: 40, sm: 32 },
    minWidth: { xs: 0, sm: 32 },
    px: { xs: 1.25, sm: 0 },
    gap: 0.5,
    color: g.text.secondary,
    "&:hover": { background: g.hover, color: g.text.primary },
    "&:focus-visible": focusRing,
} as const;

const ANSWERS: ReadonlyArray<{ key: AnswerKey; icon: ReactElement }> = [
    { key: "on_it", icon: <DoneRoundedIcon sx={{ fontSize: 18 }} /> },
    { key: "not_important", icon: <VisibilityOffRoundedIcon sx={{ fontSize: 18 }} /> },
];

/** The refusals the member can read, in plain words. Anything else is one generic line. */
const reasonText = (
    entry: AnswerEntry,
    c: ReturnType<typeof useTranslation>["t"]["inbox"]["report"]
): string => {
    if (entry.reason === "recording_off") return c.answerRecordingOff;
    if (entry.reason === "not_found") return c.answerGone;
    return entry.phase === "undo-failed" ? c.answerUndoFailed : c.answerFailed;
};

/** After a refusal that will repeat (the task is gone, recording is off) the buttons go. */
const isFinal = (entry: AnswerEntry | undefined): boolean =>
    entry?.phase === "failed" &&
    (entry.reason === "not_found" || entry.reason === "recording_off");

/** A device that cannot hover has no use for a tooltip (a tap would leave it on screen over the
 *  next row), and the buttons carry their words there anyway. Read once per row. */
const canHover = (): boolean =>
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function" ||
    window.matchMedia("(hover: hover)").matches;

export const ReportRowAnswers = memo(({ userId, teamId, taskId, name, children }: Props) => {
    const { t } = useTranslation();
    const c = t.inbox.report;
    const { accessToken } = useAuth();
    const [hover] = useState(canHover);
    const key = answerKey(userId, teamId, taskId);
    const read = () => getAnswer(key);
    const entry = useSyncExternalStore(subscribeAnswers, read, read);
    const undoRef = useRef<HTMLButtonElement>(null);
    const firstActionRef = useRef<HTMLButtonElement>(null);
    // Focus follows the member: the button they pressed is replaced, so the next thing they can
    // press takes focus (the Undo after an answer, the first button after an Undo or a refusal).
    const focusNext = useRef(false);
    const who = { accessToken, userId, teamId, taskId };

    const phase = entry?.phase;
    useEffect(() => {
        if (!focusNext.current) return;
        if (phase === "saved" || phase === "undo-failed") {
            focusNext.current = false;
            undoRef.current?.focus();
        } else if (phase === undefined || phase === "failed") {
            focusNext.current = false;
            firstActionRef.current?.focus();
        }
    }, [phase]);

    const dimmed = isDimmed(entry);
    const showActions =
        entry === undefined ||
        entry.phase === "undoing" ||
        (entry.phase === "failed" && !isFinal(entry));
    const busy = entry?.phase === "undoing";
    const showNotice = entry !== undefined && entry.phase !== "undoing";
    const failed = entry?.phase === "failed" || entry?.phase === "undo-failed";

    return (
        <Box
            data-answer-row={dimmed ? "dimmed" : ""}
            sx={wrapSx}
            // The row around the card opens the item on a click: an answer is not that. An event
            // boundary in the shape the clickable-element guard (MIP-1129) accepts: the whole
            // handler is `stopPropagation()`, written inline. The controls inside are real buttons.
            onClick={(event) => event.stopPropagation()}
        >
            <Box
                sx={{
                    flex: { xs: "1 1 100%", sm: "1 1 0" },
                    minWidth: 0,
                    // With no buttons drawn (an answer stands) the slot stays, so the row's
                    // marks do not jump to the right when the buttons go.
                    paddingInlineEnd: showActions ? 0 : { sm: `${ANSWER_SLOT_WIDTH}px` },
                    opacity: dimmed ? 0.55 : 1,
                    transition: `opacity ${g.motion.fast} ${g.ease}`,
                }}
            >
                {children}
            </Box>
            {showActions && (
                <Box
                    aria-label={fmt(c.answersFor, { task: name })}
                    data-answer-actions=""
                    role="group"
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        flexShrink: 0,
                        px: { xs: 0.5, sm: 0 },
                        pb: { xs: 0.25, sm: 0 },
                        "@media (hover: none)": { opacity: 1 },
                    }}
                >
                    {ANSWERS.map(({ key: answer, icon }, index) => {
                        const label = answer === "on_it" ? c.answerOnIt : c.answerNotImportant;
                        const named =
                            answer === "on_it"
                                ? fmt(c.answerOnItNamed, { task: name })
                                : fmt(c.answerNotImportantNamed, { task: name });
                        const tip = answer === "on_it" ? c.answerOnItTip : c.answerNotImportantTip;
                        const onPress = () => {
                            focusNext.current = true;
                            void answerTask(who, answer);
                        };
                        return (
                            <AppTooltip
                                key={answer}
                                placement="top"
                                suppressed={!hover}
                                title={tip}
                            >
                                <Box component="span" sx={{ display: "inline-flex" }}>
                                    <Button
                                        ref={index === 0 ? firstActionRef : undefined}
                                        aria-label={named}
                                        color="neutral"
                                        disabled={busy}
                                        size="sm"
                                        sx={actionSx}
                                        variant="plain"
                                        onClick={onPress}
                                    >
                                        {icon}
                                        <Box
                                            component="span"
                                            sx={{ display: { xs: "inline", sm: "none" } }}
                                        >
                                            {label}
                                        </Box>
                                    </Button>
                                </Box>
                            </AppTooltip>
                        );
                    })}
                </Box>
            )}
            {showNotice && entry && (
                <Box
                    data-answer-notice={entry.phase}
                    sx={{
                        flexBasis: "100%",
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        columnGap: 1,
                        px: 1,
                        minHeight: { xs: 40, sm: 32 },
                    }}
                >
                    <Typography
                        role={failed ? "alert" : "status"}
                        sx={{
                            ...type("body-xs"),
                            color: failed ? g.danger.text : g.text.secondary,
                            minWidth: 0,
                            overflowWrap: "anywhere",
                        }}
                    >
                        {entry.phase === "failed" || entry.phase === "undo-failed"
                            ? reasonText(entry, c)
                            : entry.answer === "on_it"
                              ? c.answerQuietedOnIt
                              : c.answerQuietedNotImportant}
                    </Typography>
                    {entry.phase !== "failed" && (
                        <Button
                            ref={undoRef}
                            aria-label={fmt(c.answerUndoNamed, { task: name })}
                            color="neutral"
                            disabled={entry.phase === "saving"}
                            size="sm"
                            sx={{ minHeight: { xs: 40, sm: 32 }, px: 1 }}
                            variant="plain"
                            onClick={() => {
                                focusNext.current = true;
                                void undoAnswer(who);
                            }}
                        >
                            {c.answerUndo}
                        </Button>
                    )}
                </Box>
            )}
        </Box>
    );
});
ReportRowAnswers.displayName = "ReportRowAnswers";
