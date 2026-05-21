import { useEffect, useState } from "react";
import VideoCameraFrontRoundedIcon from "@mui/icons-material/VideoCameraFrontRounded";
import {
    Button,
    Checkbox,
    FormControl,
    FormLabel,
    Input,
    Modal,
    ModalDialog,
    Stack,
    Textarea,
    Typography,
} from "@mui/joy";

import { CalendarEvent, createEvent, updateEvent } from "../services/calendar";

interface EventFormInitial {
    /** Pre-check the "Add Google Meet" box. Callers typically derive
     *  this from `!!event.hangoutLink` when editing an existing
     *  event. */
    add_meet?: boolean;
    /** Optional calendar id. Empty/undefined → primary. */
    calendar_id?: string;
    description?: string;
    /** RFC3339 / ISO datetime string. */
    end?: string;
    /** RFC3339 / ISO datetime string. */
    start?: string;
    summary?: string;
}

interface CalendarEventModalProps {
    accessToken: string;
    open: boolean;
    onClose: () => void;
    /** When omitted, the modal opens in "create" mode with empty
     *  fields; the caller can pre-fill via this prop. When set, the
     *  fields are seeded from `initial` and submit calls `updateEvent`
     *  against `editingEventId`. */
    initial?: EventFormInitial;
    /** When set, the modal patches this event ID instead of creating
     *  a new one. The fields displayed come from `initial`; this prop
     *  carries only the upstream identifier. */
    editingEventId?: string;
    /** Fires after a successful create or update with the upstream
     *  event payload. Callers wire task-side persistence (e.g. saving
     *  `event.id` to `linked_calendar_event_id`) through this. */
    onSaved?: (event: CalendarEvent) => void;
    /** Optional error sink — defaults to displaying inside the modal. */
    onError?: (message: string) => void;
}

interface FormState {
    addMeet: boolean;
    calendarId: string;
    description: string;
    endISO: string;
    startISO: string;
    summary: string;
}

const toLocalInputValue = (iso: string | undefined): string => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromLocalInputValue = (value: string): string => new Date(value).toISOString();

const formFromInitial = (initial: EventFormInitial | undefined): FormState => ({
    addMeet: initial?.add_meet ?? false,
    calendarId: initial?.calendar_id ?? "",
    description: initial?.description ?? "",
    endISO: toLocalInputValue(initial?.end),
    startISO: toLocalInputValue(initial?.start),
    summary: initial?.summary ?? "",
});

export const CalendarEventModal = ({
    accessToken,
    open,
    onClose,
    initial,
    editingEventId,
    onSaved,
    onError,
}: CalendarEventModalProps) => {
    const [form, setForm] = useState<FormState>(formFromInitial(initial));
    const [submitting, setSubmitting] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    // Re-seed when the modal is (re)opened with new initial values.
    // Without this, opening with a different `initial` would silently
    // reuse stale state from the previous open.
    useEffect(() => {
        if (open) {
            setForm(formFromInitial(initial));
            setLocalError(null);
        }
    }, [open, initial]);

    const reportError = (message: string) => {
        setLocalError(message);
        onError?.(message);
    };

    const submitForm = async () => {
        if (!form.summary || !form.startISO || !form.endISO) {
            reportError("Title, start, and end are required.");
            return;
        }
        setSubmitting(true);
        setLocalError(null);
        const payload = {
            add_meet: form.addMeet,
            ...(form.calendarId ? { calendar_id: form.calendarId } : {}),
            description: form.description || undefined,
            end: { dateTime: fromLocalInputValue(form.endISO) },
            start: { dateTime: fromLocalInputValue(form.startISO) },
            summary: form.summary,
        };
        const result = editingEventId
            ? await updateEvent(accessToken, editingEventId, payload, reportError)
            : await createEvent(accessToken, payload, reportError);
        setSubmitting(false);
        if (result) {
            onSaved?.(result);
            onClose();
        }
    };

    return (
        <Modal open={open} onClose={onClose}>
            <ModalDialog sx={{ minWidth: 400, p: 3 }}>
                <Typography level="title-lg" sx={{ mb: 2 }}>
                    {editingEventId ? "Edit event" : "New event"}
                </Typography>
                <Stack spacing={2}>
                    {localError && (
                        <Typography level="body-sm" sx={{ color: "danger.500" }}>
                            {localError}
                        </Typography>
                    )}
                    <FormControl required>
                        <FormLabel>Title</FormLabel>
                        <Input
                            value={form.summary}
                            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                        />
                    </FormControl>
                    <FormControl required>
                        <FormLabel>Start</FormLabel>
                        <Input
                            type="datetime-local"
                            value={form.startISO}
                            onChange={(e) => setForm((f) => ({ ...f, startISO: e.target.value }))}
                        />
                    </FormControl>
                    <FormControl required>
                        <FormLabel>End</FormLabel>
                        <Input
                            type="datetime-local"
                            value={form.endISO}
                            onChange={(e) => setForm((f) => ({ ...f, endISO: e.target.value }))}
                        />
                    </FormControl>
                    <FormControl>
                        <FormLabel>Description (optional)</FormLabel>
                        <Textarea
                            minRows={2}
                            value={form.description}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, description: e.target.value }))
                            }
                        />
                    </FormControl>
                    <Checkbox
                        checked={form.addMeet}
                        label={
                            <Stack alignItems="center" direction="row" spacing={0.75}>
                                <VideoCameraFrontRoundedIcon sx={{ fontSize: 18 }} />
                                <Typography level="body-sm">Add Google Meet link</Typography>
                            </Stack>
                        }
                        onChange={(e) => setForm((f) => ({ ...f, addMeet: e.target.checked }))}
                    />
                    <Stack direction="row" justifyContent="flex-end" spacing={1}>
                        <Button variant="plain" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button disabled={submitting} onClick={submitForm}>
                            {submitting ? "Saving…" : editingEventId ? "Save" : "Create"}
                        </Button>
                    </Stack>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
