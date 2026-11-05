import { useEffect, useRef, useState } from "react";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import {
    Alert,
    Box,
    Button,
    Chip,
    Divider,
    FormControl,
    FormLabel,
    IconButton,
    Input,
    Modal,
    ModalDialog,
    Option,
    Select,
    Stack,
    Typography,
} from "@mui/joy";
import dayjs from "dayjs";

import { CreateTodoScheduleInput, UpdateTodoSchedulePatch } from "./services/todoSchedules";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { ModalConfirmAction } from "../../../../components/ui/misc/ModalConfirmAction";
import { fmt, useTranslation } from "../../../../i18n";
import { TodoCategoryProps, TodoScheduleProps } from "../../../../types/chat";
import { getLocalCurrentDate } from "../../../../utils/dateUtils";
import { RepeatPicker } from "../../../calendar/components/RepeatPicker";
import {
    buildRecurrence,
    DEFAULT_RECURRENCE,
    isRepeating,
    parseRecurrence,
    type RecurrenceSpec,
} from "../../../calendar/utils/rrule";
import { TodoTitleText } from "./titleRender";
import { popupLayerSx, useTodoDialogLayer } from "./TodoHostLayer";
import { useTodoTitleField } from "./useTodoTitleField";

type ModalScheduledTodosProps = {
    open: boolean;
    onClose: () => void;
    schedules: TodoScheduleProps[];
    categories: TodoCategoryProps[];
    /** For the `@you` chip's colour in a row's title. */
    myselfUserId?: string;
    /** Overrides the layer; by default it follows the to-do pane's host. */
    zIndex?: number;
    onAdd: (input: CreateTodoScheduleInput) => Promise<TodoScheduleProps | undefined>;
    onUpdate: (
        scheduleId: number,
        patch: UpdateTodoSchedulePatch
    ) => Promise<TodoScheduleProps | undefined>;
    onRemove: (scheduleId: number) => Promise<boolean>;
};

const DAILY_SPEC: RecurrenceSpec = { ...DEFAULT_RECURRENCE, frequency: "daily" };

/** A title for a sentence: "[word](url)" reads as "word". */
const plainTitle = (title: string): string => title.replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1");

/** A rule as the picker would write it, so two rules compare by meaning
 *  rather than by how they happened to be spelled when stored. */
const normalizedRule = (spec: RecurrenceSpec): string | undefined =>
    buildRecurrence(spec, { allDay: true })[0];

/**
 * Create and manage recurring todos.
 *
 * A schedule is a rule ("every Monday") that the pane auto-materializes
 * into today's list — so the user never has to re-add a routine item by
 * hand. The repeat controls are the SAME `RepeatPicker` the calendar uses
 * (daily / weekly-by-weekday / monthly / yearly + interval + end), and the
 * rule persists as the RRULE string that picker's `buildRecurrence`
 * produces, read back with `parseRecurrence`.
 *
 * The form at the top adds a schedule, or — after Edit on a row — changes
 * that one (MIP-1047). Editing never touches the start date or the "created
 * up to" cursor, so a schedule that already made today's to-do does not make
 * a second one; the change shows from the next to-do on.
 *
 * Self-contained like `ModalCreateTaskFromTodo`: it takes the schedule
 * list and mutators as props (owned by `useTodoGroups`) rather than
 * fetching its own, since the pane already holds that state.
 */
export const ModalScheduledTodos = (props: ModalScheduledTodosProps) => {
    const { open, onClose, schedules, categories, myselfUserId, onAdd, onUpdate, onRemove } =
        props;
    const { t } = useTranslation();
    const ts = t.chat.todoPane.schedule;
    const today = getLocalCurrentDate();
    // Inside the to-do modal this opens above it (default: the page's own layer).
    const hostedLayer = useTodoDialogLayer();
    const layer = props.zIndex ?? hostedLayer;

    const [title, setTitle] = useState("");
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [spec, setSpec] = useState<RecurrenceSpec>(DAILY_SPEC);
    // The schedule the form is editing, or null when it is adding.
    const [editingId, setEditingId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState<TodoScheduleProps | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const dialogRef = useRef<HTMLDivElement | null>(null);

    const editing =
        editingId != null ? schedules.find((s) => s.scheduleId === editingId) : undefined;

    const resetForm = () => {
        setTitle("");
        setCategoryId(null);
        setSpec(DAILY_SPEC);
        setEditingId(null);
        setError(null);
        setIsSubmitting(false);
    };

    // Reset the form each time the modal opens.
    useEffect(() => {
        if (!open) return;
        resetForm();
        setDeleting(null);
    }, [open]);

    // The schedule being edited went away (deleted here or elsewhere): the
    // form has nothing left to save to, so it goes back to adding.
    useEffect(() => {
        if (editingId != null && !schedules.some((s) => s.scheduleId === editingId)) {
            resetForm();
        }
    }, [editingId, schedules]);

    const submit = async () => {
        const trimmed = title.trim();
        if (trimmed === "" || isSubmitting) return;
        if (!isRepeating(spec)) {
            setError(ts.needsRepeat);
            return;
        }
        // All-day: todos are date-keyed, never timed, so the UNTIL takes
        // the date-only form.
        const rrule = normalizedRule(spec);
        if (!rrule) {
            setError(ts.needsRepeat);
            return;
        }
        setIsSubmitting(true);
        setError(null);

        if (editing) {
            // Send only what changed: the start date and the "created up to"
            // cursor are never part of an edit.
            const patch: UpdateTodoSchedulePatch = {};
            if (trimmed !== editing.title) patch.title = trimmed;
            if (categoryId !== editing.categoryId) patch.categoryId = categoryId;
            if (rrule !== normalizedRule(parseRecurrence([editing.rrule]))) patch.rrule = rrule;
            if (Object.keys(patch).length > 0) {
                const saved = await onUpdate(editing.scheduleId, patch);
                if (!saved) {
                    setIsSubmitting(false);
                    setError(ts.failed);
                    return;
                }
            }
            resetForm();
            return;
        }

        const created = await onAdd({
            title: trimmed,
            rrule,
            startDate: today,
            categoryId,
        });
        setIsSubmitting(false);
        if (!created) {
            setError(ts.failed);
            return;
        }
        // Clear the title for a quick second add; keep the repeat/tag
        // choices, which people often reuse across a batch.
        setTitle("");
    };

    // The same title field as every to-do title input: paste a URL over a
    // selected word to link it, and the @ / # picker.
    const titleField = useTodoTitleField({
        value: title,
        setValue: setTitle,
        enabled: open,
        onKeyDown: (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                void submit();
            }
        },
    });

    const beginEdit = (s: TodoScheduleProps) => {
        setEditingId(s.scheduleId);
        setTitle(s.title);
        setCategoryId(s.categoryId);
        setSpec(parseRecurrence([s.rrule]));
        setError(null);
        // The form is at the top and the list is long: bring it into view.
        dialogRef.current?.scrollTo?.({ top: 0, behavior: "smooth" });
        requestAnimationFrame(() => titleField.inputRef.current?.focus());
    };

    return (
        <>
            <Modal open={open} sx={{ zIndex: layer, ...popupLayerSx(layer) }} onClose={onClose}>
                <ModalDialog
                    ref={dialogRef}
                    sx={{ width: 460, maxWidth: "94vw", maxHeight: "90vh", overflow: "auto" }}
                >
                    <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                        {editing ? <EditRoundedIcon /> : <RepeatRoundedIcon />}
                        <Typography level="title-md">
                            {editing ? ts.editHeading : ts.heading}
                        </Typography>
                    </Stack>
                    <Typography level="body-xs" sx={{ mb: 1.5 }}>
                        {ts.description}
                    </Typography>

                    {error && (
                        <Alert color="danger" size="sm" sx={{ mb: 1.5 }}>
                            {error}
                        </Alert>
                    )}

                    {/* Add / edit form */}
                    <Stack spacing={1.5}>
                        {/* position: relative — anchors the @/# menu. */}
                        <FormControl ref={titleField.anchorRef} sx={{ position: "relative" }}>
                            <FormLabel>{ts.titleLabel}</FormLabel>
                            {titleField.layer}
                            <Input
                                {...titleField.inputProps}
                                disabled={isSubmitting}
                                placeholder={ts.titlePlaceholder}
                                autoFocus
                            />
                        </FormControl>

                        {categories.length > 0 && (
                            <FormControl>
                                <FormLabel>{ts.categoryLabel}</FormLabel>
                                {/* Joy's Select value can't be null, so a -1
                                    sentinel stands in for "no tag" (category ids
                                    are positive), mapped back to null on change —
                                    the same trick SprintManagerDialog uses. */}
                                <Select<number>
                                    disabled={isSubmitting}
                                    placeholder={ts.noCategory}
                                    value={categoryId ?? -1}
                                    onChange={(_e, next) =>
                                        setCategoryId(next == null || next === -1 ? null : next)
                                    }
                                >
                                    <Option value={-1}>{ts.noCategory}</Option>
                                    {categories.map((c) => (
                                        <Option key={c.categoryId} value={c.categoryId}>
                                            {c.name}
                                        </Option>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        <RepeatPicker
                            startISO={editing ? editing.startDate : today}
                            value={spec}
                            onChange={setSpec}
                        />

                        <Stack direction="row" spacing={1}>
                            <Button
                                disabled={isSubmitting || title.trim() === ""}
                                loading={isSubmitting}
                                startDecorator={
                                    editing ? <EditRoundedIcon /> : <RepeatRoundedIcon />
                                }
                                sx={{ flex: 1 }}
                                onClick={() => void submit()}
                            >
                                {editing ? ts.save : isSubmitting ? ts.adding : ts.add}
                            </Button>
                            {editing && (
                                <Button
                                    color="neutral"
                                    disabled={isSubmitting}
                                    variant="outlined"
                                    onClick={resetForm}
                                >
                                    {t.common.actions.cancel}
                                </Button>
                            )}
                        </Stack>
                    </Stack>

                    <Divider sx={{ my: 2 }} />

                    {/* Existing schedules */}
                    <Typography level="title-sm" sx={{ mb: 1 }}>
                        {ts.listHeading}
                    </Typography>
                    {schedules.length === 0 ? (
                        <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
                            {ts.empty}
                        </Typography>
                    ) : (
                        <Stack spacing={1}>
                            {schedules.map((s) => (
                                <ScheduleRow
                                    key={s.scheduleId}
                                    categories={categories}
                                    editing={s.scheduleId === editingId}
                                    myselfUserId={myselfUserId}
                                    schedule={s}
                                    onAskDelete={setDeleting}
                                    onEdit={beginEdit}
                                    onUpdate={onUpdate}
                                />
                            ))}
                        </Stack>
                    )}
                </ModalDialog>
            </Modal>

            {/* Delete: the app's own red confirmation, above this dialog. */}
            <ModalConfirmAction
                cancelLabel={t.common.actions.cancel}
                confirmLabel={ts.delete}
                description={ts.deleteBody}
                entityName={deleting ? plainTitle(deleting.title) : undefined}
                icon={
                    <DeleteOutlineRoundedIcon
                        sx={{ color: "rgba(var(--gp-tint-danger-rgb), 0.9)", fontSize: 28 }}
                    />
                }
                open={deleting != null}
                title={ts.deleteTitle}
                tone="danger"
                zIndex={layer != null ? layer + 10 : undefined}
                onClose={() => setDeleting(null)}
                onConfirm={async () => {
                    if (!deleting) return;
                    const ok = await onRemove(deleting.scheduleId);
                    // A thrown error keeps the dialog open with a message.
                    if (!ok) throw new Error();
                }}
            />
        </>
    );
};

interface ScheduleRowProps {
    schedule: TodoScheduleProps;
    categories: TodoCategoryProps[];
    editing: boolean;
    myselfUserId?: string;
    onEdit: (schedule: TodoScheduleProps) => void;
    onAskDelete: (schedule: TodoScheduleProps) => void;
    onUpdate: (
        scheduleId: number,
        patch: UpdateTodoSchedulePatch
    ) => Promise<TodoScheduleProps | undefined>;
}

const ScheduleRow = ({
    schedule,
    categories,
    editing,
    myselfUserId,
    onEdit,
    onAskDelete,
    onUpdate,
}: ScheduleRowProps) => {
    const { t } = useTranslation();
    const ts = t.chat.todoPane.schedule;
    const [busy, setBusy] = useState(false);

    const category = categories.find((c) => c.categoryId === schedule.categoryId);
    const summary = summarizeRule(schedule.rrule, ts);

    const togglePause = async () => {
        setBusy(true);
        await onUpdate(schedule.scheduleId, { isActive: !schedule.isActive });
        setBusy(false);
    };

    return (
        <Box
            data-editing={editing ? "true" : undefined}
            data-schedule-row
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                p: 1,
                borderRadius: "8px",
                border: "1px solid",
                // The row the form above is editing is marked.
                borderColor: editing ? "primary.500" : "divider",
                boxShadow: editing ? "0 0 0 1px var(--joy-palette-primary-500)" : undefined,
                opacity: schedule.isActive ? 1 : 0.6,
            }}
        >
            <Box sx={{ flex: 1, minWidth: 0 }}>
                {/* The title as a to-do shows it: links clickable, # / @ as chips. */}
                <Typography level="body-sm" sx={{ fontWeight: 600 }} noWrap>
                    <TodoTitleText myselfUserId={myselfUserId} text={schedule.title} />
                </Typography>
                <Stack alignItems="center" direction="row" spacing={0.75}>
                    <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                        {summary}
                    </Typography>
                    {category && (
                        <Chip color="primary" size="sm" variant="soft">
                            {category.name}
                        </Chip>
                    )}
                    {!schedule.isActive && (
                        <Chip color="neutral" size="sm" variant="soft">
                            {ts.paused}
                        </Chip>
                    )}
                </Stack>
            </Box>
            {/* Three compact icon buttons: no gap, so they read as one group. */}
            <Stack alignItems="center" direction="row" spacing={0} sx={{ flexShrink: 0 }}>
                <AppTooltip title={ts.edit}>
                    <IconButton
                        aria-label={ts.edit}
                        color="neutral"
                        disabled={busy}
                        size="sm"
                        variant="plain"
                        onClick={() => onEdit(schedule)}
                    >
                        <EditRoundedIcon fontSize="small" />
                    </IconButton>
                </AppTooltip>
                <AppTooltip title={schedule.isActive ? ts.pause : ts.resume}>
                    <IconButton
                        aria-label={schedule.isActive ? ts.pause : ts.resume}
                        color="neutral"
                        disabled={busy}
                        size="sm"
                        variant="plain"
                        onClick={() => void togglePause()}
                    >
                        {schedule.isActive ? (
                            <PauseRoundedIcon fontSize="small" />
                        ) : (
                            <PlayArrowRoundedIcon fontSize="small" />
                        )}
                    </IconButton>
                </AppTooltip>
                <AppTooltip title={ts.delete}>
                    <IconButton
                        aria-label={ts.delete}
                        color="danger"
                        disabled={busy}
                        size="sm"
                        variant="plain"
                        onClick={() => onAskDelete(schedule)}
                    >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                </AppTooltip>
            </Stack>
        </Box>
    );
};

/** Human-readable one-liner for a stored RRULE, reusing the calendar's
 *  parser so the summary always matches what the picker would show. */
const summarizeRule = (
    rrule: string,
    ts: ReturnType<typeof useTranslation>["t"]["chat"]["todoPane"]["schedule"]
): string => {
    const spec = parseRecurrence([rrule]);
    const n = spec.interval;
    switch (spec.frequency) {
        case "daily":
            return n > 1 ? fmt(ts.summaryEveryNDays, { n }) : ts.summaryDaily;
        case "weekly": {
            const days = [...new Set(spec.byWeekday)]
                .filter((d) => d >= 0 && d <= 6)
                .sort((a, b) => a - b)
                .map((d) => dayjs().day(d).format("ddd"))
                .join(", ");
            if (days) {
                return n > 1
                    ? fmt(ts.summaryEveryNWeeksOn, { n, days })
                    : fmt(ts.summaryWeeklyOn, { days });
            }
            return n > 1 ? fmt(ts.summaryEveryNWeeks, { n }) : ts.summaryWeekly;
        }
        case "monthly":
            return n > 1 ? fmt(ts.summaryEveryNMonths, { n }) : ts.summaryMonthly;
        case "yearly":
            return n > 1 ? fmt(ts.summaryEveryNYears, { n }) : ts.summaryYearly;
        default:
            return "";
    }
};
