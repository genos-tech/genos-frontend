// Structured previews for the three calendar writes (`create_`, `update_`, `delete_calendar_event`;
// MIP-1059, AGENT_PARITY_TOOLS).
//
// Before this the card was the key:value fallback: an `event_id` Google made up, no account and, for a
// change, no idea what the event is now. While the server's flag is on, the pending event's `arguments`
// carry what the card needs as DATA (genos-api `calendar_card.py`): `account_label`, `account_default`,
// `account_count`, `member_time_zone` and, for an update or a delete, `current` (the event as it is
// now) or `event_found: false` (it is not on that account). Every sentence is worded here, in the
// member's language: the server sends no English.
//
// INERT WITHOUT THE FLAG. The three tools already pause for approval with the flag off, and the card is
// then the key:value fallback. `hasCalendarCardFacts` is the gate (`approvalRenderers`): no
// `account_count`, no structured card, so a member sees today's card until the server says otherwise.
//
// What the card says:
//   * the account line, only when the member has more than one Google account or the call named one
//     (the default alone needs no line). An account that is not the member's is said to be refused;
//   * the times, read in the zone they are meant in. The agent's times are NAIVE local times: they
//     are read in `time_zone` when the call carries one, else in the member's zone
//     (`utils/eventWhen`), and compared with the event's own times as instants, never as strings;
//   * for an update, only what would change, each field `before -> after`; a field the event already
//     has is left out, and when nothing would change the card says so;
//   * for an update or a delete, which event it is (its title and time) and, when it is not on that
//     account, that it is not found, so the person is not asked to approve an id they cannot read.
//
// Everything an event holds is a person's text: it is printed as TEXT (never an anchor, a link or a
// mention), and an address, a title or a zone is wrapped in `<bdi>` so it reads right inside an
// Arabic sentence. "Can't be undone" is the card's own `UndoChip`; this preview adds a chip only for
// a backend that predicted nothing (`undoKnown` false), as the other destructive cards do.

import type { ReactNode } from "react";
import EditCalendarRoundedIcon from "@mui/icons-material/EditCalendarRounded";
import EventBusyRoundedIcon from "@mui/icons-material/EventBusyRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import { Box, Typography } from "@mui/joy";

import { useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import { formatEventWhen, isDateOnly, sameWhen } from "../../calendar/utils/eventWhen";
import type { ApprovalPreviewProps } from "./approvalRenderers";
import { MetaChip } from "./previewHelpers";

type Args = Record<string, unknown>;

interface CurrentEvent {
    summary?: string;
    start_iso?: string;
    end_iso?: string;
    all_day?: boolean;
    time_zone?: string | null;
    location?: string | null;
    description?: string | null;
    attendees?: string[];
    add_meet?: boolean;
}

const text = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim() !== "" ? v : undefined;

const currentOf = (args: Args): CurrentEvent | undefined => {
    const c = args.current;
    if (!c || typeof c !== "object" || Array.isArray(c)) return undefined;
    const raw = c as Record<string, unknown>;
    return {
        summary: typeof raw.summary === "string" ? raw.summary : undefined,
        start_iso: text(raw.start_iso),
        end_iso: text(raw.end_iso),
        all_day: typeof raw.all_day === "boolean" ? raw.all_day : undefined,
        time_zone: text(raw.time_zone),
        location: typeof raw.location === "string" ? raw.location : null,
        description: typeof raw.description === "string" ? raw.description : null,
        attendees: Array.isArray(raw.attendees)
            ? raw.attendees.filter((a): a is string => typeof a === "string")
            : undefined,
        add_meet: typeof raw.add_meet === "boolean" ? raw.add_meet : undefined,
    };
};

interface Facts {
    accountLabel: string | null;
    /** The call named an account (`account` is on the card), so the default was not used. */
    accountNamed: boolean;
    accountCount: number;
    /** The zone the proposed times are read in and every time is printed in. */
    zone: string | undefined;
    current: CurrentEvent | undefined;
    notFound: boolean;
}

const factsOf = (args: Args): Facts => ({
    accountLabel: text(args.account_label) ?? null,
    accountNamed: args.account_default === false,
    accountCount: typeof args.account_count === "number" ? args.account_count : 0,
    zone: text(args.time_zone) ?? text(args.member_time_zone),
    current: currentOf(args),
    notFound: args.event_found === false,
});

const wordsOf = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((a): a is string => typeof a === "string") : [];

/** `{key}` slots of a catalog sentence filled with text isolated for bidi (`<bdi>`). */
const withIslands = (template: string, values: Record<string, string>): ReactNode[] =>
    template.split(/(\{\w+\})/).map((part, i) => {
        const key = /^\{(\w+)\}$/.exec(part)?.[1];
        return key !== undefined && key in values ? <bdi key={i}>{values[key]}</bdi> : part;
    });

const heading = (icon: ReactNode, children: ReactNode, chip?: ReactNode) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
        {icon}
        <Typography
            level="body-sm"
            sx={{ fontWeight: 600, color: g.text.primary, overflowWrap: "anywhere", minWidth: 0 }}
        >
            {children}
        </Typography>
        {chip}
    </Box>
);

// `old → new`. The arrow is read out ("rightwards arrow", as in the app's other diffs) and, in a
// right-to-left language, mirrored so it points the way the sentence reads.
const Arrow = () => (
    <Box
        component="span"
        sx={{ display: "inline-block", "[dir=rtl] &": { transform: "scaleX(-1)" } }}
    >
        {"\u00a0→\u00a0"}
    </Box>
);

/** One `label: value` line. `children` is the value, already printed. */
const Row = ({ label, children }: { label: string; children: ReactNode }) => (
    <Box sx={{ display: "flex", gap: 0.75, alignItems: "baseline", flexWrap: "wrap" }}>
        <Typography
            level="body-xs"
            sx={{ color: g.text.secondary, fontWeight: 600, flexShrink: 0 }}
        >
            {label}
        </Typography>
        <Typography
            level="body-xs"
            sx={{ color: g.text.primary, overflowWrap: "anywhere", minWidth: 0, flex: "1 1 8rem" }}
        >
            {children}
        </Typography>
    </Box>
);

const Block = ({ children, maxHeight = 200 }: { children: string; maxHeight?: number }) => (
    <Box
        sx={{
            maxHeight,
            overflowY: "auto",
            pl: 1.25,
            borderLeft: "2px solid",
            borderColor: g.border.subtle,
            fontSize: "0.8125rem",
            color: g.text.secondary,
            // Plain text, not markdown: keep the author's line breaks and never overflow.
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
        }}
    >
        <bdi>{children}</bdi>
    </Box>
);

const AccountLine = ({ facts }: { facts: Facts }) => {
    const { t } = useTranslation();
    if (facts.accountCount <= 1 && !facts.accountNamed) return null;
    if (facts.accountNamed && facts.accountLabel === null) {
        // The id is not one of the member's: the tool refuses it, and the card says so before the
        // person approves.
        return (
            <Typography level="body-xs" role="alert" sx={{ color: g.danger.text }}>
                {t.agentApproval.calendarAccountForeign}
            </Typography>
        );
    }
    if (facts.accountLabel === null) return null;
    const template = facts.accountNamed
        ? t.agentApproval.calendarAccount
        : t.agentApproval.calendarAccountDefault;
    return (
        <Typography level="body-xs" sx={{ color: g.text.secondary, overflowWrap: "anywhere" }}>
            {withIslands(template, { account: facts.accountLabel })}
        </Typography>
    );
};

const CalendarLine = ({ args }: { args: Args }) => {
    const { t } = useTranslation();
    const calendar = text(args.calendar_id);
    // The primary calendar is the default: naming it says nothing.
    if (!calendar || calendar === "primary") return null;
    return (
        <Typography level="body-xs" sx={{ color: g.text.secondary, overflowWrap: "anywhere" }}>
            {withIslands(t.agentApproval.calendarCalendar, { calendar })}
        </Typography>
    );
};

/** A time as the card prints it, in the card's zone; the text as it came when it cannot be read. */
const useWhen = (facts: Facts) => {
    const { locale } = useTranslation();
    return (
        start: string | null | undefined,
        end: string | null | undefined,
        allDay?: boolean | null
    ): string | null => {
        if (!start) return null;
        return (
            formatEventWhen({ start, end, allDay, zone: facts.zone }, locale) ??
            (end ? `${start} – ${end}` : start)
        );
    };
};

/** "Times in Asia/Tokyo": said once, when a timed time is on the card. */
const ZoneLine = ({ facts, timed }: { facts: Facts; timed: boolean }) => {
    const { t } = useTranslation();
    if (!timed || !facts.zone) return null;
    return (
        <Typography level="body-xs" sx={{ color: g.text.tertiary }}>
            {withIslands(t.agentApproval.calendarTimesIn, { zone: facts.zone })}
        </Typography>
    );
};

const Guests = ({ guests, cleared }: { guests: string[]; cleared: string }) => (
    <bdi>{guests.length ? guests.join(", ") : cleared}</bdi>
);

const sameGuests = (a: string[], b: string[]): boolean => {
    const norm = (list: string[]) => list.map((x) => x.trim().toLowerCase()).sort();
    const [x, y] = [norm(a), norm(b)];
    return x.length === y.length && x.every((v, i) => v === y[i]);
};

const sameText = (a: string | null | undefined, b: string | null | undefined): boolean =>
    (a ?? "").trim() === (b ?? "").trim();

// ---- create -----------------------------------------------------------------------------------

export const CreateCalendarEventPreview = ({ args }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const facts = factsOf(args);
    const when = useWhen(facts);
    const start = text(args.start_iso);
    const end = text(args.end_iso);
    const summary = text(args.summary) ?? t.agentApproval.calendarUntitled;
    const proposedWhen = when(start, end, start ? isDateOnly(start) : undefined);
    const location = text(args.location);
    const guests = wordsOf(args.attendees);
    const description = text(args.description);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            {heading(
                <EventRoundedIcon sx={{ fontSize: 16, color: g.warning.text }} />,
                t.agentApproval.calendarNew
            )}
            <AccountLine facts={facts} />
            <Typography
                level="body-sm"
                sx={{ fontWeight: 600, color: g.text.primary, overflowWrap: "anywhere" }}
            >
                <bdi>{summary}</bdi>
            </Typography>
            {proposedWhen ? (
                <Row label={t.agentApproval.calendarFields.when}>
                    <bdi>{proposedWhen}</bdi>
                </Row>
            ) : null}
            <ZoneLine facts={facts} timed={!!start && !isDateOnly(start)} />
            <CalendarLine args={args} />
            {location ? (
                <Row label={t.agentApproval.calendarFields.location}>
                    <bdi>{location}</bdi>
                </Row>
            ) : null}
            {guests.length ? (
                <Row label={t.agentApproval.calendarFields.attendees}>
                    <Guests cleared={t.agentApproval.cleared} guests={guests} />
                </Row>
            ) : null}
            {args.add_meet === true ? (
                <Row label={t.agentApproval.calendarFields.meet}>
                    {t.agentApproval.calendarMeetOn}
                </Row>
            ) : null}
            {description ? <Block>{description}</Block> : null}
        </Box>
    );
};

// ---- update -----------------------------------------------------------------------------------

/** Which event this is, for the heading of an update or a delete: its title when the card knows it. */
const eventHeading = (
    facts: Facts,
    named: string,
    unnamed: string,
    t: ReturnType<typeof useTranslation>["t"]
): ReactNode => {
    const current = facts.current;
    if (!current) return unnamed;
    const title = current.summary?.trim() || t.agentApproval.calendarUntitled;
    return withIslands(named, { event: title });
};

/** The id line, said when the card cannot name the event (`current` is missing). */
const EventIdLine = ({ args, facts }: { args: Args; facts: Facts }) => {
    const { t } = useTranslation();
    const id = text(args.event_id);
    if (facts.current || !id) return null;
    return (
        <Typography level="body-xs" sx={{ color: g.text.secondary, overflowWrap: "anywhere" }}>
            {withIslands(t.agentApproval.calendarEventId, { id })}
        </Typography>
    );
};

const NotFoundLine = ({ facts, delete: isDelete }: { facts: Facts; delete: boolean }) => {
    const { t } = useTranslation();
    // (An account that is not the member's has its own line; there is no account to name here.)
    if (!facts.notFound || facts.accountLabel === null) return null;
    const template = isDelete
        ? t.agentApproval.calendarDeleteNotFound
        : t.agentApproval.calendarUpdateNotFound;
    return (
        <Typography level="body-xs" sx={{ color: g.danger.text }}>
            {withIslands(template, { account: facts.accountLabel })}
        </Typography>
    );
};

export const UpdateCalendarEventPreview = ({ args }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const facts = factsOf(args);
    const when = useWhen(facts);
    const { current } = facts;
    const fields = t.agentApproval.calendarFields;
    const cleared = t.agentApproval.cleared;

    // The proposal, field by field. Against `current`, a field the event already has is dropped; with
    // no `current` (Google could not be read, or the event is not on that account) every field the
    // model sent is shown as it is, with no "before".
    const rows: ReactNode[] = [];
    const diff = (before: ReactNode | undefined, after: ReactNode) =>
        before === undefined ? (
            after
        ) : (
            <>
                {before}
                <Arrow />
                {after}
            </>
        );

    const summary = typeof args.summary === "string" ? args.summary : undefined;
    if (summary !== undefined && !(current && sameText(current.summary, summary))) {
        rows.push(
            <Row key="summary" label={fields.summary}>
                {diff(
                    current ? (
                        <bdi>{current.summary?.trim() || t.agentApproval.calendarUntitled}</bdi>
                    ) : undefined,
                    <bdi>{summary.trim() || t.agentApproval.calendarUntitled}</bdi>
                )}
            </Row>
        );
    }

    const start = text(args.start_iso);
    const end = text(args.end_iso);
    // Whether a time of day (so a zone) is on the card, and whether the time row is.
    let timed = false;
    let timeRow = false;
    if (start || end) {
        const allDay = start ? isDateOnly(start) : undefined;
        // Only the sides the call sent are compared: a call that sends just one of the two leaves the
        // other as it is, which is no change to it.
        const unchanged =
            current &&
            (!start || sameWhen(start, current.start_iso, facts.zone)) &&
            (!end || sameWhen(end, current.end_iso, facts.zone));
        if (!unchanged) {
            timed = !!start && !isDateOnly(start);
            const after = when(start, end, allDay);
            const before = current
                ? when(current.start_iso, current.end_iso, current.all_day)
                : null;
            if (after) {
                timeRow = true;
                rows.push(
                    <Row key="when" label={fields.when}>
                        {diff(before ? <bdi>{before}</bdi> : undefined, <bdi>{after}</bdi>)}
                    </Row>
                );
            }
        }
    }

    const location = typeof args.location === "string" ? args.location : undefined;
    if (location !== undefined && !(current && sameText(current.location, location))) {
        rows.push(
            <Row key="location" label={fields.location}>
                {diff(
                    current ? <bdi>{current.location?.trim() || cleared}</bdi> : undefined,
                    <bdi>{location.trim() || cleared}</bdi>
                )}
            </Row>
        );
    }

    if (Array.isArray(args.attendees)) {
        const proposed = wordsOf(args.attendees);
        if (!(current?.attendees && sameGuests(current.attendees, proposed))) {
            rows.push(
                <Row key="attendees" label={fields.attendees}>
                    {diff(
                        current?.attendees ? (
                            <Guests cleared={cleared} guests={current.attendees} />
                        ) : undefined,
                        <Guests cleared={cleared} guests={proposed} />
                    )}
                </Row>
            );
        }
    }

    if (typeof args.add_meet === "boolean" && current?.add_meet !== args.add_meet) {
        rows.push(
            <Row key="meet" label={fields.meet}>
                {args.add_meet ? t.agentApproval.calendarMeetOn : t.agentApproval.calendarMeetOff}
            </Row>
        );
    }

    const description = typeof args.description === "string" ? args.description : undefined;
    const descriptionChanged =
        description !== undefined && !(current && sameText(current.description, description));

    // The event as it is now: the person's way to recognise it. When its time is being changed the
    // "before" is already on the time row, so it is not said twice.
    const now = current ? when(current.start_iso, current.end_iso, current.all_day) : null;
    const nowShown = !!now && !timeRow;
    const nothingChanges =
        !!current && !facts.notFound && rows.length === 0 && !descriptionChanged;

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            {heading(
                <EditCalendarRoundedIcon sx={{ fontSize: 16, color: g.warning.text }} />,
                eventHeading(
                    facts,
                    t.agentApproval.calendarUpdate,
                    t.agentApproval.calendarUpdateUnnamed,
                    t
                )
            )}
            <AccountLine facts={facts} />
            <EventIdLine args={args} facts={facts} />
            <NotFoundLine delete={false} facts={facts} />
            {nowShown ? (
                <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                    <bdi>{now}</bdi>
                </Typography>
            ) : null}
            <CalendarLine args={args} />
            {rows}
            <ZoneLine
                facts={facts}
                timed={timed || (nowShown && !!current && current.all_day === false)}
            />
            {descriptionChanged ? (
                description?.trim() ? (
                    <>
                        <Typography
                            level="body-xs"
                            sx={{ color: g.text.secondary, fontWeight: 600 }}
                        >
                            {fields.description}
                        </Typography>
                        <Block>{description}</Block>
                    </>
                ) : (
                    <Row label={fields.description}>{cleared}</Row>
                )
            ) : null}
            {nothingChanges ? (
                <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                    {t.agentApproval.calendarNoChange}
                </Typography>
            ) : null}
        </Box>
    );
};

// ---- delete -----------------------------------------------------------------------------------

export const DeleteCalendarEventPreview = ({ args, undoKnown }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const facts = factsOf(args);
    const when = useWhen(facts);
    const { current } = facts;
    const fields = t.agentApproval.calendarFields;
    const now = current ? when(current.start_iso, current.end_iso, current.all_day) : null;
    const guests = current?.attendees ?? [];
    const location = current?.location?.trim();
    const description = current?.description?.trim();

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            {heading(
                <EventBusyRoundedIcon sx={{ fontSize: 16, color: g.danger.text }} />,
                eventHeading(
                    facts,
                    t.agentApproval.calendarDelete,
                    t.agentApproval.calendarDeleteUnnamed,
                    t
                ),
                undoKnown ? null : <MetaChip label={t.agentApproval.cannotUndo} />
            )}
            <AccountLine facts={facts} />
            <EventIdLine args={args} facts={facts} />
            <NotFoundLine facts={facts} delete />
            {now ? (
                <Row label={fields.when}>
                    <bdi>{now}</bdi>
                </Row>
            ) : null}
            <ZoneLine facts={facts} timed={!!current && current.all_day === false} />
            <CalendarLine args={args} />
            {location ? (
                <Row label={fields.location}>
                    <bdi>{location}</bdi>
                </Row>
            ) : null}
            {guests.length ? (
                <Row label={fields.attendees}>
                    <Guests cleared={t.agentApproval.cleared} guests={guests} />
                </Row>
            ) : null}
            {description ? <Block maxHeight={96}>{description}</Block> : null}
        </Box>
    );
};
