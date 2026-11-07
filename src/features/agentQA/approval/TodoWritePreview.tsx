// Structured previews for the three to-do writes (MIP-884):
//
//   update_todo_item  "Update to-do: Call Sam" + Day / Reminder old → new
//   create_todo_item  "New to-do" + the day and the reminder it will carry
//   delete_todo_item  "Delete to-do: Call Sam" + what goes with it
//
// `item_id` arrives friendly-ized to the to-do's title. The backend adds
// `current` (the day it is on now, its pending reminder with the offset, and
// for a delete how many sub-items go with it) only for a to-do on the
// caller's own list, and `time_zone` when a clock time was proposed, since
// the model's own words don't say which zone `remind_at` is read in.

import type { ReactNode } from "react";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import { Box, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import type { ApprovalPreviewProps } from "./approvalRenderers";
import { asString, diffValue, MetaChip, shortTime } from "./previewHelpers";

type Current = {
    target_date?: string | null;
    reminder_at?: string | null;
    sub_items?: number;
};

const Shell = ({
    icon,
    title,
    chips,
    children,
}: {
    icon: ReactNode;
    title: string;
    chips: string[];
    children?: ReactNode;
}) => {
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                {icon}
                <Typography level="body-sm" sx={{ fontWeight: 700, color: g.text.primary }}>
                    {title}
                </Typography>
                {chips.map((c) => (
                    <MetaChip key={c} label={c} />
                ))}
            </Box>
            {children}
        </Box>
    );
};

const NotesBody = ({ text }: { text: string }) => {
    return (
        <Box
            sx={{
                maxHeight: 200,
                overflowY: "auto",
                pl: 1.25,
                borderLeft: "2px solid",
                borderColor: g.border.subtle,
                fontSize: "0.8125rem",
                color: g.text.secondary,
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
            }}
        >
            {text}
        </Box>
    );
};

/** What the reminder will become, in words: a clock time, "in N min", or none. */
const useProposedReminder = (args: Record<string, unknown>) => {
    const { t } = useTranslation();
    if (args.cancel_reminder === true) return { proposed: "" as unknown };
    // Printed the way the present reminder is (`2026-11-05 09:00`), so the two
    // sides of "old → new" read alike.
    const at = asString(args.remind_at)?.replace("T", " ");
    if (at) {
        const zone = asString(args.time_zone);
        return { proposed: zone ? fmt(t.agentApproval.reminderZone, { time: at, zone }) : at };
    }
    const minutes = asString(args.remind_in_minutes);
    if (minutes) return { proposed: fmt(t.agentApproval.reminderIn, { minutes }) };
    return { proposed: undefined };
};

const currentOf = (args: Record<string, unknown>) => args.current as Current | undefined;

export const UpdateTodoPreview = ({ args }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const current = currentOf(args);
    const reminder = useProposedReminder(args);

    const chips: string[] = [];
    // `''` is "no move" to the tool (a to-do's day can't be cleared), so it
    // gets no chip, unlike the clear sentinels on a task.
    if (asString(args.target_date)) {
        chips.push(
            `${t.agentApproval.fieldLabels.target_date}: ${diffValue(
                args.target_date,
                current?.target_date,
                t.agentApproval.cleared
            )}`
        );
    }
    if (reminder.proposed !== undefined) {
        const was = current?.reminder_at;
        chips.push(
            `${t.agentApproval.fieldLabels.reminder_at}: ${diffValue(
                reminder.proposed,
                typeof was === "string" ? shortTime(was) : was,
                t.agentApproval.cleared
            )}`
        );
    }
    if (args.is_completed === true) chips.push(t.agentApproval.todoDone);
    if (args.is_completed === false) chips.push(t.agentApproval.todoReopen);
    const category = asString(args.category);
    if (category) chips.push(`${t.agentApproval.category}: ${category}`);
    if (args.clear_category === true)
        chips.push(`${t.agentApproval.category}: ${t.agentApproval.cleared}`);

    const title = asString(args.title);
    const notesProposed = args.notes_text !== undefined && args.notes_text !== null;
    const notes = asString(args.notes_text);
    if (notesProposed && !notes)
        chips.push(`${t.agentApproval.changesBody}: ${t.agentApproval.cleared}`);

    return (
        <Shell
            chips={chips}
            icon={<EditRoundedIcon sx={{ fontSize: 16, color: g.warning.text }} />}
            title={fmt(t.agentApproval.updateTodo, { item: asString(args.item_id) ?? "" })}
        >
            {title ? (
                <Typography level="body-sm" sx={{ fontWeight: 600, color: g.text.primary }}>
                    {title}
                </Typography>
            ) : null}
            {notes ? <NotesBody text={notes} /> : null}
        </Shell>
    );
};

export const CreateTodoPreview = ({ args }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const reminder = useProposedReminder(args);

    const chips: string[] = [];
    const day = asString(args.target_date);
    if (day) chips.push(`${t.agentApproval.fieldLabels.target_date}: ${day}`);
    if (typeof reminder.proposed === "string" && reminder.proposed)
        chips.push(`${t.agentApproval.fieldLabels.reminder_at}: ${reminder.proposed}`);
    const category = asString(args.category);
    if (category) chips.push(`${t.agentApproval.category}: ${category}`);

    const title = asString(args.title);
    const notes = asString(args.notes_text);

    return (
        <Shell
            chips={chips}
            icon={<CheckCircleOutlineRoundedIcon sx={{ fontSize: 16, color: g.warning.text }} />}
            title={t.agentApproval.newTodo}
        >
            {title ? (
                <Typography level="body-sm" sx={{ fontWeight: 600, color: g.text.primary }}>
                    {title}
                </Typography>
            ) : null}
            {notes ? <NotesBody text={notes} /> : null}
        </Shell>
    );
};

export const DeleteTodoPreview = ({ args }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const current = currentOf(args);

    const chips: string[] = [];
    if (current?.target_date)
        chips.push(`${t.agentApproval.fieldLabels.target_date}: ${current.target_date}`);
    if (current?.sub_items)
        chips.push(fmt(t.agentApproval.alsoDeletesSubItems, { count: current.sub_items }));
    if (current?.reminder_at) chips.push(t.agentApproval.alsoDropsReminder);

    return (
        <Shell
            chips={chips}
            icon={<DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: g.danger.text }} />}
            title={fmt(t.agentApproval.deleteTodo, { item: asString(args.item_id) ?? "" })}
        />
    );
};
