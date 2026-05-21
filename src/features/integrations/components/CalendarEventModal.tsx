import { useEffect, useMemo, useState } from "react";
import VideoCameraFrontRoundedIcon from "@mui/icons-material/VideoCameraFrontRounded";
import {
    Autocomplete,
    AutocompleteOption,
    Avatar,
    Button,
    Checkbox,
    FormControl,
    FormHelperText,
    FormLabel,
    Input,
    ListItemContent,
    ListItemDecorator,
    Modal,
    ModalDialog,
    Stack,
    Textarea,
    Typography,
} from "@mui/joy";

import { useOptionalAvatarContext } from "../../../components/ui/avatars/AvatarContext";
import { useTranslation } from "../../../i18n";
import { CalendarEvent, createEvent, updateEvent } from "../services/calendar";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

/** What the Autocomplete options + selection both speak. Decoupled
 *  from `UserProps` so the picker can later accept free-form
 *  external emails without restructuring. */
interface AttendeeOption {
    email: string;
    displayName: string;
    /** Optional — driven from team-member profiles when available
     *  so the option list shows avatars. External / pre-existing
     *  attendees on edit may not have one. */
    avatarImgPath?: string;
}

const attendeeKey = (a: AttendeeOption) => a.email.trim().toLowerCase();

interface EventFormInitial {
    /** Pre-check the "Add Google Meet" box. Callers typically derive
     *  this from `!!event.hangoutLink` when editing an existing
     *  event. */
    add_meet?: boolean;
    /** Pre-populate the attendees picker when editing. Callers pass
     *  the event's existing attendees so the user sees who's
     *  already invited and can prune / add. */
    attendees?: Array<{ email: string; displayName?: string }>;
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
    attendees: AttendeeOption[];
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
    attendees: (initial?.attendees ?? []).map((a) => ({
        email: a.email,
        displayName: a.displayName || a.email,
    })),
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
    const { t } = useTranslation();
    const [form, setForm] = useState<FormState>(formFromInitial(initial));
    const [submitting, setSubmitting] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    // Team-member directory — sourced from `AvatarContext` so the
    // modal doesn't take a teamMembers prop. `useOptional` returns
    // null pre-auth (e.g. signin sandbox) so the picker just shows
    // an empty option list rather than crashing.
    const avatarCtx = useOptionalAvatarContext();
    const teamOptions: AttendeeOption[] = useMemo(() => {
        if (!avatarCtx) return [];
        const out: AttendeeOption[] = [];
        const me = avatarCtx.myself;
        for (const u of Object.values(avatarCtx.teamMemberProfiles)) {
            if (!u.userEmail) continue;
            if (me && String(u.userId) === String(me.userId)) continue; // skip self
            out.push({
                email: u.userEmail,
                displayName: u.userName || u.userEmail,
                avatarImgPath: u.avatarImgPath,
            });
        }
        // Pre-fill avatar/displayName for any attendees that already
        // map to a team member (covers the edit-existing-event case
        // where `initial.attendees` arrives as bare email strings).
        return out.sort((a, b) =>
            a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" })
        );
    }, [avatarCtx]);

    // Re-seed when the modal is (re)opened with new initial values.
    // Also re-decorate any pre-populated attendees with team-member
    // avatars when the directory finally arrives.
    useEffect(() => {
        if (open) {
            const seeded = formFromInitial(initial);
            // Merge team avatars onto seeded attendees by email key.
            const byEmail: Record<string, AttendeeOption> = {};
            for (const o of teamOptions) byEmail[attendeeKey(o)] = o;
            seeded.attendees = seeded.attendees.map((a) => {
                const match = byEmail[attendeeKey(a)];
                return match ? { ...a, ...match } : a;
            });
            setForm(seeded);
            setLocalError(null);
        }
    }, [open, initial, teamOptions]);

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
            // Only include attendees in the body when the user has
            // something selected. An empty list on PATCH would
            // clear an existing attendee list on Google's side; on
            // create it'd just send nothing. Either way omitting is
            // safer than sending [].
            ...(form.attendees.length > 0
                ? {
                      attendees: form.attendees.map((a) => ({
                          email: a.email,
                          displayName: a.displayName,
                      })),
                  }
                : {}),
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
        // `reportError` already surfaces the user-facing reason for
        // string discriminators (google_not_connected /
        // calendar_scope_missing); the modal just needs to skip the
        // success path on anything that isn't a real event.
        if (result && typeof result !== "string") {
            onSaved?.(result);
            onClose();
        }
    };

    return (
        <Modal open={open} onClose={onClose}>
            <ModalDialog sx={{ minWidth: 480, maxWidth: 560, p: 3 }}>
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
                    <FormControl>
                        <FormLabel>{t.calendar.attendees.label}</FormLabel>
                        <Autocomplete
                            multiple
                            options={teamOptions}
                            value={form.attendees}
                            // Equality by email so options the user
                            // already picked render with the "selected"
                            // indicator and don't appear duplicated in
                            // the dropdown.
                            isOptionEqualToValue={(a, b) => attendeeKey(a) === attendeeKey(b)}
                            getOptionLabel={(o) => o.displayName}
                            // Filter manually so "alice" matches both
                            // name AND email — Joy's default only
                            // searches the label string.
                            filterOptions={(opts, { inputValue }) => {
                                const q = inputValue.trim().toLowerCase();
                                if (!q) return opts;
                                return opts.filter(
                                    (o) =>
                                        o.displayName.toLowerCase().includes(q) ||
                                        o.email.toLowerCase().includes(q)
                                );
                            }}
                            placeholder={
                                form.attendees.length === 0 ? t.calendar.attendees.placeholder : ""
                            }
                            noOptionsText={t.calendar.attendees.noResults}
                            onChange={(_e, next) => setForm((f) => ({ ...f, attendees: next }))}
                            renderOption={(props, option) => (
                                <AutocompleteOption {...props} key={attendeeKey(option)}>
                                    <ListItemDecorator>
                                        <Avatar
                                            size="sm"
                                            src={
                                                option.avatarImgPath
                                                    ? `${media_url}/${option.avatarImgPath}`
                                                    : undefined
                                            }
                                        >
                                            {option.displayName.charAt(0).toUpperCase()}
                                        </Avatar>
                                    </ListItemDecorator>
                                    <ListItemContent sx={{ minWidth: 0 }}>
                                        <Typography level="body-sm" noWrap>
                                            {option.displayName}
                                        </Typography>
                                        <Typography
                                            level="body-xs"
                                            sx={{ color: "text.tertiary" }}
                                            noWrap
                                        >
                                            {option.email}
                                        </Typography>
                                    </ListItemContent>
                                </AutocompleteOption>
                            )}
                        />
                        <FormHelperText>
                            {form.attendees.length === 0
                                ? t.calendar.attendees.emptyState
                                : t.calendar.attendees.helperText}
                        </FormHelperText>
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
