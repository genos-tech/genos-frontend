// The dialog an agent calendar chip opens (MIP-1059, AGENT_PARITY_TOOLS).
//
// A chip names an event by `(account_id, calendar_id, event_id)`. Clicking it reads that event
// (`GET /calendar/events/<id>/?account_id=&calendar_id=`) and puts it in the same edit dialog the
// calendar grid opens, over whatever the person was in (Spotlight, the Genos page, an Ask dialog):
// a quick look that keeps the conversation where it is. Three outcomes:
//
//   * the event: the edit dialog, seeded as the grid seeds it (`eventToFormInitial`). A save or a
//     delete from it tells an open calendar grid (`calendarChanges`);
//   * `event_deleted_upstream`: the event is gone from Google (an agent's delete lands here too, and
//     so does a chip kept from an earlier day). There was no UI for it before (only the service's
//     return value), so it is a small notice, not an error;
//   * anything else (Google not reachable, a sign-in that expired, the account removed): the
//     service's own sentence when it has one, and Retry.
//
// It lives at the App root and listens for `genos:open-calendar-event` (`calendarEventLink`), so no
// surface has to know about it. It is inert until a chip is clicked, and chips exist only while the
// server's `AGENT_PARITY_TOOLS` flag is on.

import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Typography } from "@mui/joy";

import { ErrorState } from "../../../components/ui/feedback/ErrorState";
import { Spinner } from "../../../components/ui/feedback/Skeleton";
import { ModalFrame } from "../../../components/ui/modal/ModalFrame";
import { useAuth } from "../../../context/AuthContext";
import { useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import { CalendarEventModal } from "../../integrations/components/CalendarEventModal";
import { getEvent, type CalendarEvent } from "../../integrations/services/calendar";
import { eventToFormInitial } from "../../integrations/utils/eventFormInitial";
import { emitCalendarChanged } from "../calendarChanges";
import { onOpenCalendarEvent, type CalendarEventRef } from "../calendarEventLink";

// Above everything a chip can be clicked in: Spotlight (13100), the link preview that opens over it
// (13200) and the thread and note Ask dialogs inside that preview (its layer plus one), as well as
// the ones on Joy's own layer. Tooltips (13300) stay above it, and so do none of its own lists:
// the pickers inside the dialog open ten above it (`CalendarEventModal`).
const DIALOG_Z_INDEX = 13250;

type View =
    | { state: "loading" }
    | { state: "event"; event: CalendarEvent }
    | { state: "deleted" }
    | { state: "failed"; message: string | null };

export const CalendarEventLinkHost = () => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const [ref, setRef] = useState<CalendarEventRef | null>(null);
    const [view, setView] = useState<View>({ state: "loading" });
    // The latest read, so a slow answer for an event the person has since left cannot open it.
    const attempt = useRef(0);

    const load = useCallback(
        async (target: CalendarEventRef) => {
            const mine = ++attempt.current;
            setView({ state: "loading" });
            if (!accessToken) {
                setView({ state: "failed", message: null });
                return;
            }
            let message: string | null = null;
            const result = await getEvent(
                accessToken,
                target.eventId,
                { accountId: target.accountId, calendarId: target.calendarId },
                (m) => {
                    message = m;
                }
            );
            if (mine !== attempt.current) return;
            if (result === "event_deleted_upstream") setView({ state: "deleted" });
            else if (result && typeof result !== "string")
                setView({ state: "event", event: result });
            else setView({ state: "failed", message });
        },
        [accessToken]
    );

    useEffect(
        () =>
            onOpenCalendarEvent((next) => {
                setRef(next);
                void load(next);
            }),
        [load]
    );

    const close = useCallback(() => {
        attempt.current++;
        setRef(null);
    }, []);

    if (!ref) return null;
    const zIndex = DIALOG_Z_INDEX;

    if (view.state === "event" && accessToken) {
        return (
            <CalendarEventModal
                accessToken={accessToken}
                editingEventId={view.event.id}
                zIndex={zIndex}
                initial={eventToFormInitial(view.event, {
                    accountId: ref.accountId,
                    calendarId: ref.calendarId,
                })}
                open
                onClose={close}
                onDeleted={() =>
                    emitCalendarChanged({
                        action: "delete",
                        accountId: ref.accountId,
                        calendarId: ref.calendarId,
                        eventId: view.event.id,
                    })
                }
                onSaved={() =>
                    emitCalendarChanged({
                        action: "update",
                        accountId: ref.accountId,
                        calendarId: ref.calendarId,
                        eventId: view.event.id,
                    })
                }
            />
        );
    }

    const closeButton = (
        <Button color="neutral" variant="plain" onClick={close}>
            {t.common.actions.close}
        </Button>
    );
    if (view.state === "deleted") {
        return (
            <ModalFrame
                actions={closeButton}
                size="sm"
                title={t.calendar.linked.deletedTitle}
                zIndex={zIndex}
                open
                onClose={close}
            >
                <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                    {t.calendar.linked.deletedBody}
                </Typography>
            </ModalFrame>
        );
    }
    if (view.state === "failed") {
        // The shared "couldn't load" state, always with a Retry (the service's own sentence replaces the
        // generic hint when it has one: a sign-in that expired says so).
        return (
            <ModalFrame
                size="sm"
                title={t.calendar.linked.title}
                zIndex={zIndex}
                open
                onClose={close}
            >
                <ErrorState
                    body={view.message || t.calendar.linked.failedBody}
                    data-error="calendar-event"
                    secondary={{ label: t.common.actions.close, onClick: close }}
                    size="sm"
                    title={t.calendar.linked.failedTitle}
                    onRetry={() => void load(ref)}
                />
            </ModalFrame>
        );
    }
    // Loading: the frame is up at once so the click is answered, and the event replaces it.
    return (
        <ModalFrame size="sm" title={t.calendar.linked.title} zIndex={zIndex} open onClose={close}>
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                <Spinner />
            </Box>
        </ModalFrame>
    );
};
