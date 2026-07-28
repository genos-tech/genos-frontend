import { useEffect, useMemo, useState } from "react";
import VideoCameraFrontRoundedIcon from "@mui/icons-material/VideoCameraFrontRounded";
import {
    Autocomplete,
    AutocompleteOption,
    Avatar,
    Box,
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
    Option,
    Radio,
    RadioGroup,
    Select,
    Stack,
    Textarea,
    Typography,
} from "@mui/joy";
import dayjs from "dayjs";

import { useOptionalAvatarContext } from "../../../components/ui/avatars/AvatarContext";
import { useTranslation } from "../../../i18n";
import { RepeatPicker } from "../../calendar/components/RepeatPicker";
import {
    buildRecurrence,
    DEFAULT_RECURRENCE,
    parseRecurrence,
    type RecurrenceSpec,
} from "../../calendar/utils/rrule";
import {
    CalendarEvent,
    CalendarSummary,
    createEvent,
    deleteEvent,
    getEvent,
    sourceKey,
    updateEvent,
} from "../services/calendar";
import { dateOnly, googleEndToInclusive, inclusiveToGoogleEnd } from "../utils/allDayDates";
import { ReconnectGoogleCalendarButton } from "./ReconnectGoogleCalendarButton";

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
    /** When true, `start`/`end` are date-only ("YYYY-MM-DD") and `end`
     *  is Google's EXCLUSIVE end date (as returned in `event.end.date`).
     *  Callers set this from `!!event.start?.date` when editing an
     *  existing all-day event. */
    all_day?: boolean;
    /** Pre-populate the attendees picker when editing. Callers pass
     *  the event's existing attendees so the user sees who's
     *  already invited and can prune / add. */
    attendees?: Array<{ email: string; displayName?: string }>;
    /** Optional calendar id. Empty/undefined → primary. */
    calendar_id?: string;
    /** Set when the event being edited is one occurrence of a repeating
     *  series: the id of its MASTER. Editing or deleting the whole
     *  series targets this instead of `editingEventId`. */
    recurring_event_id?: string;
    /** Which connected Google account owns `calendar_id`. Required to
     *  edit an event that came from a non-default account: event ids
     *  are unique per calendar, not globally, so without the account
     *  the PATCH is authenticated as the wrong user and 404s. Omitted
     *  → the server's default account. */
    account_id?: string;
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
    /** Calendars the user can pick as the target when CREATING an
     *  event, across every connected account. Read-only ones (shared
     *  by a teammate) are listed but disabled — offering them would
     *  produce a 403 at save time. Empty is fine: the modal then just
     *  posts to the default account's primary calendar as before. */
    calendars?: CalendarSummary[];
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
    /** Fires after a successful delete with the upstream event id.
     *  Caller is expected to refresh its list / clear any cached
     *  reference to the deleted event. */
    onDeleted?: (eventId: string) => void;
    /** Optional error sink — defaults to displaying inside the modal. */
    onError?: (message: string) => void;
}

interface FormState {
    addMeet: boolean;
    // When true, `startISO`/`endISO` hold date-only "YYYY-MM-DD" values
    // (the inputs switch to type="date") and `endISO` is the INCLUSIVE
    // last day. Otherwise they're "datetime-local" values as before.
    allDay: boolean;
    attendees: AttendeeOption[];
    recurrence: RecurrenceSpec;
    accountId: string;
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

const formFromInitial = (initial: EventFormInitial | undefined): FormState => {
    const allDay = initial?.all_day ?? false;
    return {
        addMeet: initial?.add_meet ?? false,
        allDay,
        attendees: (initial?.attendees ?? []).map((a) => ({
            email: a.email,
            displayName: a.displayName || a.email,
        })),
        recurrence: DEFAULT_RECURRENCE,
        accountId: initial?.account_id ?? "",
        calendarId: initial?.calendar_id ?? "",
        description: initial?.description ?? "",
        // All-day seeds date-only values, converting Google's exclusive
        // end date to the inclusive last day the form shows; timed seeds
        // datetime-local values as before.
        startISO: allDay
            ? initial?.start
                ? dateOnly(initial.start)
                : ""
            : toLocalInputValue(initial?.start),
        endISO: allDay
            ? initial?.end
                ? googleEndToInclusive(initial.end)
                : ""
            : toLocalInputValue(initial?.end),
        summary: initial?.summary ?? "",
    };
};

export const CalendarEventModal = ({
    accessToken,
    open,
    onClose,
    calendars = [],
    initial,
    editingEventId,
    onSaved,
    onDeleted,
    onError,
}: CalendarEventModalProps) => {
    const { t } = useTranslation();
    const [form, setForm] = useState<FormState>(formFromInitial(initial));
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    // Two-step delete: first click arms a confirm state, second click
    // commits. Auto-resets after a few seconds so a stray click can't
    // dismiss the confirmation.
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    // Set when a save fails because the Google refresh token is dead
    // (`google_reauth_required`). Surfaces a "Reconnect" button right
    // in the modal so the user can repair it without leaving the flow.
    const [needsReconnect, setNeedsReconnect] = useState(false);
    // "this" edits/deletes the single occurrence; "all" targets the
    // series master. Never inferred — guessing either way silently does
    // something the user didn't ask for.
    const [scope, setScope] = useState<"this" | "all">("this");

    const masterId = initial?.recurring_event_id;
    const isRecurring = !!masterId;

    // Team-member directory — sourced from `AvatarContext` so the
    // modal doesn't take a teamMembers prop. `useOptional` returns
    // null pre-auth (e.g. signin sandbox) so the picker just shows
    // an empty option list rather than crashing.
    // Calendars the user may actually create on. "reader" /
    // "freeBusyReader" — what a teammate's shared calendar normally
    // grants — are filtered out rather than shown disabled: an option
    // that can only fail isn't worth the row.
    const writableCalendars = useMemo(
        () => calendars.filter((c) => ["owner", "writer"].includes(c.access_role ?? "owner")),
        [calendars]
    );

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
            setNeedsReconnect(false);
            setDeleteConfirm(false);
            setScope("this");
        }
    }, [open, initial, teamOptions]);

    // An INSTANCE carries no `recurrence` of its own — only the master
    // does — so showing the current rule means fetching the master. Its
    // account/calendar are the instance's, which the caller forwards.
    useEffect(() => {
        if (!open || !masterId) return;
        let cancelled = false;
        void (async () => {
            const master = await getEvent(accessToken, masterId, {
                accountId: initial?.account_id,
                calendarId: initial?.calendar_id,
            });
            if (cancelled || !master || typeof master === "string") return;
            setForm((f) => ({ ...f, recurrence: parseRecurrence(master.recurrence) }));
        })();
        return () => {
            cancelled = true;
        };
    }, [open, masterId, accessToken, initial?.account_id, initial?.calendar_id]);

    // Auto-revert the delete confirm state after a short window so a
    // stray "Delete" click doesn't sit primed indefinitely.
    useEffect(() => {
        if (!deleteConfirm) return;
        const id = window.setTimeout(() => setDeleteConfirm(false), 4000);
        return () => window.clearTimeout(id);
    }, [deleteConfirm]);

    const reportError = (message: string) => {
        setLocalError(message);
        onError?.(message);
    };

    // Flip between timed and all-day, converting the existing start/end so
    // the inputs never show a value in the wrong format. Timed → all-day
    // keeps the dates and drops the times; all-day → timed collapses to a
    // 9–10am slot on the start day (a multi-day span can't survive the
    // switch, so we don't try to preserve it).
    const setAllDay = (checked: boolean) =>
        setForm((f) => {
            if (checked === f.allDay) return f;
            if (checked) {
                const start = f.startISO ? dateOnly(f.startISO) : dayjs().format("YYYY-MM-DD");
                const end = f.endISO ? dateOnly(f.endISO) : start;
                return { ...f, allDay: true, startISO: start, endISO: end < start ? start : end };
            }
            const base = f.startISO || dayjs().format("YYYY-MM-DD");
            return { ...f, allDay: false, startISO: `${base}T09:00`, endISO: `${base}T10:00` };
        });

    const submitForm = async () => {
        if (!form.summary || !form.startISO || !form.endISO) {
            reportError("Title, start, and end are required.");
            return;
        }
        // All-day end is inclusive, so equal dates are a valid 1-day event;
        // only a truly earlier end is invalid (string compare is safe for
        // "YYYY-MM-DD"). Google rejects end-before-start with a 400.
        if (form.allDay && form.endISO < form.startISO) {
            reportError("End date can't be before the start date.");
            return;
        }
        setSubmitting(true);
        setLocalError(null);
        setNeedsReconnect(false);
        // Fields that are the same whichever event this write targets.
        const common = {
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
            ...(form.accountId ? { account_id: form.accountId } : {}),
            description: form.description || undefined,
            summary: form.summary,
        };
        // All-day events are date-only; Google's `end.date` is
        // exclusive, so we submit the inclusive last day + 1. Timed
        // events send a full dateTime as before.
        const timing = {
            end: form.allDay
                ? { date: inclusiveToGoogleEnd(form.endISO) }
                : { dateTime: fromLocalInputValue(form.endISO) },
            start: form.allDay
                ? { date: form.startISO }
                : { dateTime: fromLocalInputValue(form.startISO) },
        };
        const recurrence = buildRecurrence(form.recurrence, { allDay: form.allDay });

        // Editing "all events" targets the series MASTER, and that
        // payload must NOT carry start/end: the form holds the start/end
        // of the INSTANCE the user opened, and sending those to the
        // master moves the whole series onto that occurrence's date.
        // Open the third standup, fix a typo, choose "all events" — and
        // the series jumps two weeks forward.
        //
        // Conversely `recurrence` only means anything on the master, so
        // a single-occurrence edit omits it entirely; sending [] there
        // would silently end the repetition.
        const targetsSeries = isRecurring && scope === "all";

        const result = editingEventId
            ? targetsSeries
                ? await updateEvent(accessToken, masterId!, { ...common, recurrence }, reportError)
                : await updateEvent(
                      accessToken,
                      editingEventId,
                      { ...common, ...timing },
                      reportError
                  )
            : await createEvent(accessToken, { ...common, ...timing, recurrence }, reportError);
        setSubmitting(false);
        // A dead refresh token gets an inline reconnect button in
        // addition to the error text `reportError` already set.
        if (result === "google_reauth_required") {
            setNeedsReconnect(true);
            return;
        }
        // `reportError` already surfaces the user-facing reason for
        // string discriminators (google_not_connected /
        // calendar_scope_missing); the modal just needs to skip the
        // success path on anything that isn't a real event.
        if (result && typeof result !== "string") {
            onSaved?.(result);
            onClose();
        }
    };

    // Two-step delete. First click flips `deleteConfirm` to true so
    // the button re-labels itself "Confirm delete?"; the second click
    // (within the 4 s auto-revert window) actually fires the API call.
    // Prevents a misclick from silently nuking a real calendar entry.
    const handleDelete = async () => {
        if (!editingEventId) return;
        if (!deleteConfirm) {
            setDeleteConfirm(true);
            return;
        }
        setDeleting(true);
        setLocalError(null);
        // Deleting the master removes every occurrence; deleting the
        // instance cancels just this one.
        const deleteTargetId = isRecurring && scope === "all" ? masterId! : editingEventId;
        const ok = await deleteEvent(
            accessToken,
            deleteTargetId,
            {
                ...(form.calendarId ? { calendarId: form.calendarId } : {}),
                ...(form.accountId ? { accountId: form.accountId } : {}),
            },
            reportError
        );
        setDeleting(false);
        if (ok) {
            onDeleted?.(editingEventId);
            onClose();
        } else {
            // Failed — drop the primed state so the user can retry
            // intentionally.
            setDeleteConfirm(false);
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
                    {needsReconnect && (
                        <ReconnectGoogleCalendarButton accessToken={accessToken} size="sm" />
                    )}
                    <FormControl required>
                        <FormLabel>Title</FormLabel>
                        <Input
                            value={form.summary}
                            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                        />
                    </FormControl>
                    {/* Target calendar. Only offered on CREATE: Google
                        can't move an existing event between calendars
                        with a PATCH (it needs a separate move call), so
                        showing an editable picker here would silently
                        do nothing. On edit the event's own calendar is
                        displayed read-only instead. */}
                    {writableCalendars.length > 1 && !editingEventId && (
                        <FormControl>
                            <FormLabel>{t.calendar.target.label}</FormLabel>
                            <Select
                                value={
                                    form.accountId
                                        ? sourceKey(form.accountId, form.calendarId)
                                        : ""
                                }
                                onChange={(_e, next) => {
                                    if (!next) return;
                                    const picked = writableCalendars.find(
                                        (c) => sourceKey(c.account_id, c.id) === next
                                    );
                                    if (!picked) return;
                                    setForm((f) => ({
                                        ...f,
                                        accountId: picked.account_id,
                                        calendarId: picked.id,
                                    }));
                                }}
                            >
                                {writableCalendars.map((c) => (
                                    <Option
                                        key={sourceKey(c.account_id, c.id)}
                                        value={sourceKey(c.account_id, c.id)}
                                    >
                                        {/* Account email is part of the
                                            label because two accounts
                                            both have a calendar named
                                            after the user. */}
                                        {c.summary || c.id}
                                        {c.account_email ? ` · ${c.account_email}` : ""}
                                    </Option>
                                ))}
                            </Select>
                            <FormHelperText>{t.calendar.target.helperText}</FormHelperText>
                        </FormControl>
                    )}
                    <Checkbox
                        checked={form.allDay}
                        label={<Typography level="body-sm">All day</Typography>}
                        onChange={(e) => setAllDay(e.target.checked)}
                    />
                    <FormControl required>
                        <FormLabel>Start</FormLabel>
                        <Input
                            type={form.allDay ? "date" : "datetime-local"}
                            value={form.startISO}
                            onChange={(e) => setForm((f) => ({ ...f, startISO: e.target.value }))}
                        />
                    </FormControl>
                    <FormControl required>
                        <FormLabel>End</FormLabel>
                        <Input
                            // For all-day, `min` keeps the (inclusive) end on
                            // or after the start day.
                            slotProps={form.allDay ? { input: { min: form.startISO } } : undefined}
                            type={form.allDay ? "date" : "datetime-local"}
                            value={form.endISO}
                            onChange={(e) => setForm((f) => ({ ...f, endISO: e.target.value }))}
                        />
                        {form.allDay && (
                            <FormHelperText>Ends on this day (inclusive).</FormHelperText>
                        )}
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
                            isOptionEqualToValue={(a, b) => attendeeKey(a) === attendeeKey(b)}
                            noOptionsText={t.calendar.attendees.noResults}
                            value={form.attendees}
                            // Equality by email so options the user
                            // already picked render with the "selected"
                            // indicator and don't appear duplicated in
                            // the dropdown.
                            options={teamOptions}
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
                            multiple
                            onChange={(_e, next) => setForm((f) => ({ ...f, attendees: next }))}
                        />
                        <FormHelperText>
                            {form.attendees.length === 0
                                ? t.calendar.attendees.emptyState
                                : t.calendar.attendees.helperText}
                        </FormHelperText>
                    </FormControl>
                    {/* Scope choice, shown only for a repeating event and
                        placed ABOVE the repeat controls because it
                        governs what they do. Defaults to "this event":
                        the narrower, reversible action. */}
                    {isRecurring && (
                        <FormControl>
                            <FormLabel>{t.calendar.scope.label}</FormLabel>
                            <RadioGroup
                                orientation="horizontal"
                                value={scope}
                                onChange={(e) => setScope(e.target.value as "this" | "all")}
                            >
                                <Radio label={t.calendar.scope.thisEvent} size="sm" value="this" />
                                <Radio label={t.calendar.scope.allEvents} size="sm" value="all" />
                            </RadioGroup>
                            <FormHelperText>
                                {scope === "all"
                                    ? t.calendar.scope.seriesTimingNote
                                    : t.calendar.scope.editHelper}
                            </FormHelperText>
                        </FormControl>
                    )}

                    {/* Repeat rule. On an existing series it's only
                        editable under the "all events" scope — the rule
                        lives on the master, so changing it from a single
                        occurrence would be a no-op the user couldn't
                        see. */}
                    <RepeatPicker
                        disabled={isRecurring && scope !== "all"}
                        startISO={form.startISO}
                        value={form.recurrence}
                        onChange={(recurrence) => setForm((f) => ({ ...f, recurrence }))}
                    />

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
                    <Stack
                        alignItems="center"
                        direction="row"
                        spacing={1}
                        sx={{ flexWrap: "wrap" }}
                    >
                        {/* Delete only on edit. Two-step (first click
                            arms, second click commits); the label
                            flips to "Confirm delete?" until clicked
                            again or the 4 s timer reverts it. */}
                        {editingEventId && (
                            <Button
                                color="danger"
                                disabled={deleting || submitting}
                                variant={deleteConfirm ? "solid" : "outlined"}
                                onClick={handleDelete}
                            >
                                {deleting
                                    ? "Deleting…"
                                    : deleteConfirm
                                      ? isRecurring && scope === "all"
                                          ? "Delete all events?"
                                          : "Confirm delete?"
                                      : "Delete"}
                            </Button>
                        )}
                        <Box sx={{ flex: 1 }} />
                        <Button disabled={deleting} variant="plain" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button disabled={submitting || deleting} onClick={submitForm}>
                            {submitting ? "Saving…" : editingEventId ? "Save" : "Create"}
                        </Button>
                    </Stack>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
