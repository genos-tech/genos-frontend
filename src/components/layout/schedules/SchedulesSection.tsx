import { useCallback, useEffect, useRef, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import { Alert, Box, Button, Chip, Sheet, Stack, Switch, Typography } from "@mui/joy";

import { useAuth } from "../../../context/AuthContext";
import { runScheduleAndAnnounce } from "../../../features/schedules/runScheduleAndAnnounce";
import { findDuplicate } from "../../../features/schedules/scheduleDuplicates";
import { rowEffort } from "../../../features/schedules/scheduleEffort";
import {
    formatMoment,
    STATUS_KEYS,
    statusColor,
} from "../../../features/schedules/scheduleFormat";
import { fmt, useTranslation } from "../../../i18n";
import {
    createSchedule,
    deleteSchedule,
    listSchedules,
    Schedule,
    ScheduleChange,
    ScheduleFields,
    ScheduleList,
    ScheduleResult,
    ScheduleSuggestion,
    updateSchedule,
} from "../../../services/schedules";
import { g } from "../../../theme/tokens";
import { EmptyState } from "../../ui/feedback/EmptyState";
import { ScheduleFormPanel } from "./ScheduleFormPanel";
import { SchedulesUpgradePrompt } from "./SchedulesUpgradePrompt";

type Props = {
    /** The team on screen. Every call carries it. */
    teamId: string;
    /** Draw the "Schedules" heading row. A host that already titles the panel (the Genos
     *  page's dialog) turns it off so the word does not appear twice. */
    showHeading?: boolean;
    /** Called just before the upgrade call navigates to the plans page, so a host that is a
     *  dialog can close itself instead of staying open on top of it. */
    onNavigateAway?: () => void;
};

type Mode = { kind: "new" } | { kind: "edit"; id: string } | null;

/** The words for a suggestion Genos makes, by its key. A key this page does not know falls
 *  back to the name the server sent, so a new suggestion still shows. */
const SUGGESTION_TEXT = {
    morning_plan: { name: "suggestMorningName", blurb: "suggestMorningBlurb" },
    evening_recap: { name: "suggestEveningName", blurb: "suggestEveningBlurb" },
} as const;

/** The server sends a paused schedule's reason as the label of its choice, not as a code
 *  (`pausedReason` is "the plan does not include scheduled reports", not "plan"). Those five
 *  labels are matched exactly and said in the member's language; any other text is shown as it
 *  came, so a new reason still shows. */
const PAUSE_REASONS = {
    "paused by the member": "pausedManual",
    "paused after repeated failures": "pausedFailures",
    "the member left the team": "pausedLeftTeam",
    "the account is inactive": "pausedInactive",
    "the plan does not include scheduled reports": "pausedByPlan",
} as const;

/** What "Run now" said, kept per schedule so the refetch after it keeps it. */
type RunNotice =
    | { kind: "ok"; title: string; items: number }
    | { kind: "failed"; error: string }
    | { kind: "refused"; error: string };

/**
 * Settings → Schedules (MIP-1150), also opened from the Genos page (MIP-1200): the member's own "at this local time, on
 * these days, run this report" rules. The report lands in the Inbox; this page
 * only creates, edits, pauses, runs and deletes the rules.
 *
 * Nothing here knows a job by name: the list of reports, and each one's
 * parameters, come from the API's catalog. Every sentence that explains a
 * refusal is written by the API for the member and is shown as it arrived.
 * Deleting asks first, in the page, because a browser confirm dialog is not
 * available inside every host this runs in.
 */
export const SchedulesSection = ({ teamId, showHeading = true, onNavigateAway }: Props) => {
    const { t, locale } = useTranslation();
    const { accessToken } = useAuth();
    const s = t.settings.schedules;
    const effortWords = {
        low: t.settings.llmModel.effortLow,
        medium: t.settings.llmModel.effortMedium,
        high: t.settings.llmModel.effortHigh,
    };

    const [data, setData] = useState<ScheduleList | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [mode, setMode] = useState<Mode>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [running, setRunning] = useState<string | null>(null);
    const [confirming, setConfirming] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notices, setNotices] = useState<Record<string, RunNotice>>({});
    const [adding, setAdding] = useState<string | null>(null);
    // A 403 `plan_required` from an action says the plan does not include schedules even when
    // the list on screen said it did (the plan changed since): show the upgrade prompt now.
    const [planBlocked, setPlanBlocked] = useState(false);

    // Only the newest request may write: a slow answer for the team the member
    // just left must not paint over the team they are in now.
    const latest = useRef(0);

    // Whether this panel is still on screen. "Run now" finishes in
    // `runScheduleAndAnnounce`, which outlives the dialog; it asks this so a
    // failure the panel is about to show itself is not also toasted.
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const refresh = useCallback(async () => {
        const mine = ++latest.current;
        const list = await listSchedules(accessToken, teamId);
        if (mine !== latest.current) return;
        setLoading(false);
        if (list === null) {
            setLoadFailed(true);
            return;
        }
        setLoadFailed(false);
        setPlanBlocked(false); // the list is the truth: its `planAllowed` decides from here
        setData(list);
    }, [accessToken, teamId]);

    useEffect(() => {
        setData(null);
        setMode(null);
        setConfirming(null);
        setNotices({});
        setError(null);
        setLoading(true);
        void refresh();
        const requests = latest;
        return () => {
            // Invalidate whatever is still in flight for this team.
            requests.current++;
        };
    }, [refresh]);

    /** The plan does not include schedules (403 `plan_required`): the upgrade prompt, not a
     *  failure. The list is read again so the page agrees with the server. */
    const planRefused = async () => {
        setError(null);
        setPlanBlocked(true);
        setMode(null);
        setConfirming(null);
        await refresh();
        setPlanBlocked(true);
    };

    /** A 404 means the list on screen is stale: say so and show the real one. */
    const failed = async (
        res: { gone: boolean; error: string | null; planRequired?: boolean },
        fallback: string
    ) => {
        if (res.planRequired) {
            await planRefused();
            return;
        }
        setError(res.error ?? (res.gone ? s.gone : fallback));
        if (res.gone) await refresh();
    };

    const submitForm = async (
        body: ScheduleFields | ScheduleChange
    ): Promise<ScheduleResult<object>> => {
        const editing = mode?.kind === "edit" ? mode.id : null;
        if (editing && Object.keys(body).length === 0) {
            setMode(null);
            return { ok: true };
        }
        const res = editing
            ? await updateSchedule(accessToken, teamId, editing, body)
            : await createSchedule(accessToken, teamId, body as ScheduleFields);
        if (res.ok) {
            setError(null);
            setMode(null);
            await refresh();
        } else if (res.planRequired) {
            await planRefused();
        } else if (res.gone) {
            setMode(null);
            await failed(res, s.saveFailed);
        }
        return res;
    };

    const toggle = async (sch: Schedule) => {
        setBusy(sch.id);
        setError(null);
        const res = await updateSchedule(accessToken, teamId, sch.id, { enabled: !sch.enabled });
        if (res.ok) await refresh();
        else await failed(res, s.saveFailed);
        setBusy(null);
    };

    const runNow = async (sch: Schedule) => {
        setBusy(sch.id);
        setRunning(sch.id);
        setError(null);
        setNotices((cur) =>
            Object.fromEntries(Object.entries(cur).filter(([id]) => id !== sch.id))
        );
        // The run, the Inbox resync and the "Report ready" toast all happen in the
        // service, so closing this dialog right after pressing the button loses none
        // of them. What follows is only this panel's own notice.
        const res = await runScheduleAndAnnounce(
            accessToken,
            teamId,
            sch.id,
            () => mounted.current
        );
        let notice: RunNotice;
        if (!res.ok && res.planRequired) {
            setBusy(null);
            setRunning(null);
            await planRefused();
            return;
        }
        if (!res.ok) {
            notice = { kind: "refused", error: res.error ?? s.runFailed };
            if (res.gone) await refresh();
        } else if (res.outcome.status === "failed") {
            notice = { kind: "failed", error: res.outcome.error || s.runFailed };
        } else {
            notice = { kind: "ok", title: res.outcome.title, items: res.outcome.items };
        }
        setNotices((cur) => ({ ...cur, [sch.id]: notice }));
        if (res.ok) await refresh();
        setBusy(null);
        setRunning(null);
    };

    /** Accepting a suggestion is an ordinary create: the schedule is the member's from then on. */
    const accept = async (sug: ScheduleSuggestion) => {
        const known = SUGGESTION_TEXT[sug.key as keyof typeof SUGGESTION_TEXT];
        setAdding(sug.key);
        setError(null);
        const res = await createSchedule(accessToken, teamId, {
            name: known ? s[known.name] : sug.name,
            job: sug.job,
            params: sug.params,
            frequency: sug.frequency,
            timeOfDay: sug.timeOfDay,
            deliverPush: true,
        });
        setAdding(null);
        if (res.ok) await refresh();
        else await failed(res, s.suggestAddFailed);
    };

    const remove = async (id: string) => {
        setBusy(id);
        setError(null);
        const res = await deleteSchedule(accessToken, teamId, id);
        setBusy(null);
        if (!res.ok && !res.gone) {
            setError(res.error ?? s.deleteFailed);
            return;
        }
        setConfirming(null);
        if (!res.ok) setError(res.error ?? s.gone);
        await refresh();
    };

    const schedules = data?.schedules ?? [];
    // Core and up. A server that predates the gate sends no `planAllowed`: that is "allowed".
    const planBlockedNow = !!data && (data.planAllowed === false || planBlocked);
    const suggestions = data?.suggestions ?? [];
    const atLimit = !!data && data.limit > 0 && schedules.length >= data.limit;
    const zone = data?.timeZone ?? "";
    const when = (iso: string) => formatMoment(iso, zone, locale);
    const pauseText = (reason: string): string => {
        const known = PAUSE_REASONS[reason as keyof typeof PAUSE_REASONS];
        return known ? s[known] : reason;
    };

    const form = (existing: Schedule | null) => (
        <ScheduleFormPanel
            existing={schedules}
            jobs={data?.jobs ?? []}
            schedule={existing}
            timeZone={zone}
            onCancel={() => setMode(null)}
            onSubmit={submitForm}
        />
    );

    return (
        <Stack data-testid="schedules-section" spacing={1.5} sx={{ minWidth: 0 }}>
            {showHeading && (
                <Stack alignItems="center" direction="row" spacing={1}>
                    <EventRepeatRoundedIcon sx={{ fontSize: 18 }} />
                    <Typography level="title-md">{s.title}</Typography>
                </Stack>
            )}
            <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                {s.blurb}
            </Typography>

            {loading && (
                <Typography level="body-sm" role="status" sx={{ color: g.text.secondary }}>
                    {s.loading}
                </Typography>
            )}
            {loadFailed && (
                <Alert
                    color="danger"
                    size="sm"
                    sx={{ flexWrap: "wrap" }}
                    endDecorator={
                        <Button
                            color="danger"
                            size="sm"
                            variant="outlined"
                            onClick={() => void refresh()}
                        >
                            {s.retry}
                        </Button>
                    }
                >
                    {s.loadFailed}
                </Alert>
            )}
            {error && (
                <Alert color="danger" role="alert" size="sm">
                    {error}
                </Alert>
            )}

            {data && planBlockedNow && (
                <SchedulesUpgradePrompt
                    hasKept={schedules.length > 0}
                    onNavigateAway={onNavigateAway}
                />
            )}

            {data && !planBlockedNow && schedules.length === 0 && mode === null && (
                <EmptyState
                    body={s.empty}
                    data-empty="schedules"
                    size="sm"
                    action={{
                        label: s.createFirst,
                        icon: <AddRoundedIcon />,
                        onClick: () => setMode({ kind: "new" }),
                    }}
                />
            )}

            {data && !planBlockedNow && suggestions.length > 0 && mode === null && (
                <Stack data-testid="schedule-suggestions" spacing={0.75}>
                    <Typography level="title-sm">{s.suggestedHeading}</Typography>
                    <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                        {s.suggestedHint}
                    </Typography>
                    {suggestions.map((sug) => {
                        const known = SUGGESTION_TEXT[sug.key as keyof typeof SUGGESTION_TEXT];
                        // The member may already have it under the same name or doing the same
                        // at the same time (the API says so too; this is the instant answer).
                        const have = findDuplicate(
                            {
                                name: known ? s[known.name] : sug.name,
                                job: sug.job,
                                params: sug.params,
                                frequency: sug.frequency,
                                timeOfDay: sug.timeOfDay,
                            },
                            schedules
                        );
                        return (
                            <Sheet
                                key={sug.key}
                                variant="outlined"
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                    gap: 1,
                                    p: 1,
                                    borderRadius: "md",
                                    minWidth: 0,
                                }}
                            >
                                <Stack spacing={0.25} sx={{ flex: "1 1 12rem", minWidth: 0 }}>
                                    <Typography level="title-sm" sx={{ overflowWrap: "anywhere" }}>
                                        {known ? s[known.name] : sug.name}
                                    </Typography>
                                    <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                                        {known ? s[known.blurb] : ""}
                                        {known ? " · " : ""}
                                        {sug.frequency === "daily"
                                            ? fmt(s.suggestDaily, { time: sug.timeOfDay })
                                            : sug.timeOfDay}
                                    </Typography>
                                    {have && (
                                        <Typography
                                            level="body-xs"
                                            sx={{ color: g.text.secondary }}
                                        >
                                            {fmt(s.suggestExists, { name: have.schedule.name })}
                                        </Typography>
                                    )}
                                </Stack>
                                <Button
                                    color="neutral"
                                    disabled={atLimit || adding !== null || !!have}
                                    loading={adding === sug.key}
                                    size="sm"
                                    startDecorator={<AddRoundedIcon />}
                                    variant="outlined"
                                    onClick={() => void accept(sug)}
                                >
                                    {s.suggestAdd}
                                </Button>
                            </Sheet>
                        );
                    })}
                </Stack>
            )}

            {data && !planBlockedNow && schedules.length > 0 && mode?.kind !== "new" && (
                <Stack alignItems="flex-start" spacing={0.75}>
                    <Button
                        color="neutral"
                        disabled={atLimit}
                        size="sm"
                        startDecorator={<AddRoundedIcon />}
                        variant="outlined"
                        onClick={() => setMode({ kind: "new" })}
                    >
                        {s.newSchedule}
                    </Button>
                    {atLimit && (
                        <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                            {fmt(s.limitReached, { limit: data.limit })}
                        </Typography>
                    )}
                </Stack>
            )}

            {data && !planBlockedNow && mode?.kind === "new" && form(null)}

            {schedules.map((sch) => {
                if (!planBlockedNow && mode?.kind === "edit" && mode.id === sch.id) {
                    return <Box key={sch.id}>{form(sch)}</Box>;
                }
                const notice = notices[sch.id];
                const effort = rowEffort(
                    data?.jobs.find((j) => j.job === sch.job),
                    sch
                );
                const rowBusy = busy === sch.id;
                return (
                    <Sheet
                        key={sch.id}
                        data-testid="schedule-row"
                        sx={{ borderRadius: 8, p: 1.25, minWidth: 0 }}
                        variant="soft"
                    >
                        <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                            <Stack
                                alignItems="center"
                                direction="row"
                                spacing={1}
                                sx={{ minWidth: 0, flexWrap: "wrap" }}
                                useFlexGap
                            >
                                <Typography
                                    level="title-sm"
                                    sx={{ minWidth: 0, flex: 1, overflowWrap: "anywhere" }}
                                >
                                    {sch.name}
                                </Typography>
                                <Chip size="sm" variant="soft">
                                    {sch.jobTitle ?? s.jobRemoved}
                                </Chip>
                                {!sch.enabled && (
                                    <Chip color="warning" size="sm" variant="soft">
                                        {s.paused}
                                    </Chip>
                                )}
                            </Stack>

                            <Typography level="body-sm" sx={{ overflowWrap: "anywhere" }}>
                                {sch.when}
                            </Typography>
                            {effort && (
                                <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                                    {fmt(s.rowEffort, { level: effortWords[effort] })}
                                </Typography>
                            )}
                            {!sch.enabled && sch.pausedReason && (
                                <Typography
                                    level="body-xs"
                                    sx={{ color: g.text.secondary, overflowWrap: "anywhere" }}
                                >
                                    {pauseText(sch.pausedReason)}
                                </Typography>
                            )}
                            <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                                {sch.nextRun
                                    ? fmt(s.nextRun, { when: when(sch.nextRun) })
                                    : s.noNextRun}
                            </Typography>
                            <Stack
                                alignItems="center"
                                direction="row"
                                spacing={0.75}
                                sx={{ flexWrap: "wrap", minWidth: 0 }}
                                useFlexGap
                            >
                                {sch.lastRun ? (
                                    <>
                                        <Typography
                                            level="body-xs"
                                            sx={{ color: g.text.secondary }}
                                        >
                                            {fmt(s.lastRun, { when: when(sch.lastRun) })}
                                        </Typography>
                                        {sch.lastStatus && (
                                            <Chip
                                                color={statusColor(sch.lastStatus)}
                                                size="sm"
                                                variant="soft"
                                            >
                                                {s[STATUS_KEYS[sch.lastStatus]]}
                                            </Chip>
                                        )}
                                    </>
                                ) : (
                                    <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                                        {s.neverRun}
                                    </Typography>
                                )}
                            </Stack>
                            {sch.lastResult && sch.lastStatus === "ok" && (
                                <Typography
                                    level="body-xs"
                                    sx={{ color: g.text.secondary, overflowWrap: "anywhere" }}
                                >
                                    {fmt(s.lastResult, {
                                        title: sch.lastResult.title,
                                        count: sch.lastResult.items,
                                    })}
                                </Typography>
                            )}
                            {sch.lastError && sch.lastStatus !== "ok" && (
                                <Typography
                                    level="body-xs"
                                    sx={{ color: g.danger.text, overflowWrap: "anywhere" }}
                                >
                                    {sch.lastError}
                                </Typography>
                            )}
                            {sch.problem && (
                                <Alert color="warning" size="sm" variant="soft">
                                    {sch.problem}
                                </Alert>
                            )}
                            {notice && (
                                <Alert
                                    color={notice.kind === "ok" ? "success" : "danger"}
                                    data-testid="run-notice"
                                    role="status"
                                    size="sm"
                                    variant="soft"
                                >
                                    {notice.kind === "ok"
                                        ? fmt(s.ranOk, {
                                              title: notice.title,
                                              count: notice.items,
                                          })
                                        : notice.kind === "failed"
                                          ? fmt(s.ranFailed, { error: notice.error })
                                          : notice.error}
                                </Alert>
                            )}

                            {confirming === sch.id ? (
                                <Alert
                                    color="danger"
                                    role="alertdialog"
                                    variant="soft"
                                    sx={{
                                        alignItems: "flex-start",
                                        flexDirection: "column",
                                        gap: 1,
                                    }}
                                >
                                    <Typography level="body-sm" sx={{ overflowWrap: "anywhere" }}>
                                        {fmt(s.deleteConfirm, { name: sch.name })}
                                    </Typography>
                                    <Stack direction="row" spacing={1}>
                                        <Button
                                            color="danger"
                                            loading={rowBusy}
                                            size="sm"
                                            onClick={() => void remove(sch.id)}
                                        >
                                            {s.deleteYes}
                                        </Button>
                                        <Button
                                            color="neutral"
                                            disabled={rowBusy}
                                            size="sm"
                                            variant="outlined"
                                            onClick={() => setConfirming(null)}
                                        >
                                            {s.cancel}
                                        </Button>
                                    </Stack>
                                </Alert>
                            ) : (
                                <Stack
                                    alignItems="center"
                                    direction="row"
                                    spacing={1}
                                    sx={{ flexWrap: "wrap" }}
                                    useFlexGap
                                >
                                    <Switch
                                        checked={sch.enabled}
                                        // Pausing is always allowed; turning one on is a Core
                                        // feature (the server refuses it).
                                        disabled={rowBusy || (planBlockedNow && !sch.enabled)}
                                        endDecorator={sch.enabled ? s.active : s.paused}
                                        size="sm"
                                        slotProps={{
                                            input: {
                                                "aria-label": fmt(
                                                    sch.enabled ? s.pauseNamed : s.resumeNamed,
                                                    { name: sch.name }
                                                ),
                                            },
                                        }}
                                        onChange={() => void toggle(sch)}
                                    />
                                    {!planBlockedNow && (
                                        <Button
                                            color="neutral"
                                            disabled={rowBusy}
                                            loading={running === sch.id}
                                            size="sm"
                                            startDecorator={<PlayArrowRoundedIcon />}
                                            variant="outlined"
                                            onClick={() => void runNow(sch)}
                                        >
                                            {s.runNow}
                                        </Button>
                                    )}
                                    {!planBlockedNow && (
                                        <Button
                                            color="neutral"
                                            disabled={rowBusy}
                                            size="sm"
                                            variant="outlined"
                                            onClick={() => setMode({ kind: "edit", id: sch.id })}
                                        >
                                            {s.edit}
                                        </Button>
                                    )}
                                    <Button
                                        color="danger"
                                        disabled={rowBusy}
                                        size="sm"
                                        variant="outlined"
                                        onClick={() => setConfirming(sch.id)}
                                    >
                                        {s.delete}
                                    </Button>
                                </Stack>
                            )}
                        </Stack>
                    </Sheet>
                );
            })}
        </Stack>
    );
};
