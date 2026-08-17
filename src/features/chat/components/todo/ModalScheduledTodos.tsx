import { useEffect, useRef, useState } from "react";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
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
import { TodoTitleMentionLayer, useTodoTitleMentions } from "./titleMentions";

type ModalScheduledTodosProps = {
    open: boolean;
    onClose: () => void;
    schedules: TodoScheduleProps[];
    categories: TodoCategoryProps[];
    onAdd: (input: CreateTodoScheduleInput) => Promise<TodoScheduleProps | undefined>;
    onUpdate: (
        scheduleId: number,
        patch: UpdateTodoSchedulePatch
    ) => Promise<TodoScheduleProps | undefined>;
    onRemove: (scheduleId: number) => Promise<boolean>;
};

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
 * Self-contained like `ModalCreateTaskFromTodo`: it takes the schedule
 * list and mutators as props (owned by `useTodoGroups`) rather than
 * fetching its own, since the pane already holds that state.
 */
export const ModalScheduledTodos = (props: ModalScheduledTodosProps) => {
    const { open, onClose, schedules, categories, onAdd, onUpdate, onRemove } = props;
    const { t } = useTranslation();
    const ts = t.chat.todoPane.schedule;
    const today = getLocalCurrentDate();

    const [title, setTitle] = useState("");
    const titleInputRef = useRef<HTMLInputElement | null>(null);
    const titleRowRef = useRef<HTMLDivElement | null>(null);
    const mentions = useTodoTitleMentions({
        inputRef: titleInputRef,
        value: title,
        setValue: setTitle,
        enabled: open,
    });
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [spec, setSpec] = useState<RecurrenceSpec>({
        ...DEFAULT_RECURRENCE,
        frequency: "daily",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset the form each time the modal opens.
    useEffect(() => {
        if (!open) return;
        setTitle("");
        setCategoryId(null);
        setSpec({ ...DEFAULT_RECURRENCE, frequency: "daily" });
        setError(null);
        setIsSubmitting(false);
    }, [open]);

    const submit = async () => {
        const trimmed = title.trim();
        if (trimmed === "" || isSubmitting) return;
        if (!isRepeating(spec)) {
            setError(ts.needsRepeat);
            return;
        }
        setIsSubmitting(true);
        setError(null);
        // All-day: todos are date-keyed, never timed, so the UNTIL takes
        // the date-only form.
        const rrule = buildRecurrence(spec, { allDay: true })[0];
        if (!rrule) {
            setError(ts.needsRepeat);
            setIsSubmitting(false);
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

    return (
        <Modal open={open} onClose={onClose}>
            <ModalDialog
                sx={{ width: 460, maxWidth: "94vw", maxHeight: "90vh", overflow: "auto" }}
            >
                <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                    <RepeatRoundedIcon />
                    <Typography level="title-md">{ts.heading}</Typography>
                </Stack>
                <Typography level="body-xs" sx={{ mb: 1.5 }}>
                    {ts.description}
                </Typography>

                {error && (
                    <Alert color="danger" size="sm" sx={{ mb: 1.5 }}>
                        {error}
                    </Alert>
                )}

                {/* Add form */}
                <Stack spacing={1.5}>
                    {/* position: relative — anchors the @/# menu. */}
                    <FormControl ref={titleRowRef} sx={{ position: "relative" }}>
                        <FormLabel>{ts.titleLabel}</FormLabel>
                        <TodoTitleMentionLayer
                            anchorRef={titleRowRef}
                            inputRef={titleInputRef}
                            mentions={mentions}
                            value={title}
                        />
                        <Input
                            disabled={isSubmitting}
                            placeholder={ts.titlePlaceholder}
                            slotProps={{ input: { ref: titleInputRef } }}
                            value={title}
                            autoFocus
                            onClick={mentions.syncCaret}
                            onKeyUp={mentions.syncCaret}
                            onChange={(e) => {
                                setTitle(e.target.value);
                                mentions.syncCaret();
                            }}
                            onKeyDown={(e) => {
                                // Picker first: its Escape must dismiss the
                                // menu without closing the whole modal, and
                                // its Enter completes a mention rather than
                                // submitting the schedule.
                                if (mentions.handleKeyDown(e)) return;
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    void submit();
                                }
                            }}
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

                    <RepeatPicker startISO={today} value={spec} onChange={setSpec} />

                    <Button
                        disabled={isSubmitting || title.trim() === ""}
                        loading={isSubmitting}
                        startDecorator={<RepeatRoundedIcon />}
                        onClick={() => void submit()}
                    >
                        {isSubmitting ? ts.adding : ts.add}
                    </Button>
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
                                schedule={s}
                                onRemove={onRemove}
                                onUpdate={onUpdate}
                            />
                        ))}
                    </Stack>
                )}
            </ModalDialog>
        </Modal>
    );
};

interface ScheduleRowProps {
    schedule: TodoScheduleProps;
    categories: TodoCategoryProps[];
    onUpdate: (
        scheduleId: number,
        patch: UpdateTodoSchedulePatch
    ) => Promise<TodoScheduleProps | undefined>;
    onRemove: (scheduleId: number) => Promise<boolean>;
}

const ScheduleRow = ({ schedule, categories, onUpdate, onRemove }: ScheduleRowProps) => {
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

    const remove = async () => {
        if (!window.confirm(ts.deleteConfirm)) return;
        setBusy(true);
        await onRemove(schedule.scheduleId);
        // No setBusy(false): the row unmounts on success.
    };

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                p: 1,
                borderRadius: "8px",
                border: "1px solid",
                borderColor: "divider",
                opacity: schedule.isActive ? 1 : 0.6,
            }}
        >
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography level="body-sm" sx={{ fontWeight: 600 }} noWrap>
                    {schedule.title}
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
            <IconButton
                color="neutral"
                disabled={busy}
                size="sm"
                title={schedule.isActive ? ts.pause : ts.resume}
                variant="plain"
                onClick={() => void togglePause()}
            >
                {schedule.isActive ? (
                    <PauseRoundedIcon fontSize="small" />
                ) : (
                    <PlayArrowRoundedIcon fontSize="small" />
                )}
            </IconButton>
            <IconButton
                color="danger"
                disabled={busy}
                size="sm"
                title={ts.delete}
                variant="plain"
                onClick={() => void remove()}
            >
                <DeleteOutlineRoundedIcon fontSize="small" />
            </IconButton>
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
