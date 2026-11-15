import { Fragment } from "react";
import { Box } from "@mui/joy";

import { toast } from "../../../components/ui/feedback/toastStore";
import { fmt, getMessages } from "../../../i18n";

// What a project move can cost people, read off the answer of the save that
// moved the task (PUT /task/) or the milestone (PATCH /milestone/<id>/).
//
// genos-api counts two things and sends them as top-level numbers, present on
// a move only (MIP-1597):
//   - `notesNarrowed`: task-note owners who lost the Owner role because they
//     are not on the destination project. Moving back restores it.
//   - `reportersOutsideDestination`: people who filed a moved task and are on
//     neither the destination project nor its team. NEUTRAL wording on
//     purpose: whether they can still open the task is the server's rule (it
//     is being narrowed), so this must not promise either way.
// An answer from an older server has neither field, and then nothing is shown.

/** A count the server sent that is worth telling the person: a whole number above 0. */
const positiveCount = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

/** The sentences for a move's answer, one per count above 0 (none when it has nothing to say). */
export const moveNoticeLines = (answer: unknown): string[] => {
    const data = (answer ?? {}) as {
        notesNarrowed?: unknown;
        reportersOutsideDestination?: unknown;
    };
    const notes = positiveCount(data.notesNarrowed);
    const reporters = positiveCount(data.reportersOutsideDestination);
    const t = getMessages().tasks.moveNotice;
    const lines: string[] = [];
    if (notes > 0) lines.push(fmt(t.notesNarrowed, { count: notes }));
    if (reporters > 0) lines.push(fmt(t.reportersOutsideDestination, { count: reporters }));
    return lines;
};

/** The notice as one text, or `null` when the answer carries nothing to say. */
export const moveNoticeText = (answer: unknown): string | null => {
    const lines = moveNoticeLines(answer);
    return lines.length > 0 ? lines.join(" ") : null;
};

// Long enough to read two sentences without hovering; hover still pauses it.
const NOTICE_DURATION_MS = 9000;

/**
 * Tell the person what the move they just made changed for others, in the
 * shared toast (neutral: nothing went wrong). Call only after a move the
 * server accepted. Shows nothing for an answer without the fields.
 */
export const showMoveNotice = (answer: unknown): void => {
    const lines = moveNoticeLines(answer);
    if (lines.length === 0) return;
    // One paragraph per sentence: run together, the second one starts with a
    // bare number and reads as the end of the first. The space between them
    // keeps the toast's plain text (what a screen reader gets) one sentence
    // after the other.
    const message =
        lines.length === 1 ? (
            lines[0]
        ) : (
            <>
                {lines.map((line, i) => (
                    <Fragment key={i}>
                        {i > 0 ? " " : null}
                        <Box component="span" sx={{ display: "block", mt: i > 0 ? 0.75 : 0 }}>
                            {line}
                        </Box>
                    </Fragment>
                ))}
            </>
        );
    toast.neutral(message, { id: "project-move-notice", duration: NOTICE_DURATION_MS });
};
