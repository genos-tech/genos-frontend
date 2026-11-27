import { useEffect, useState } from "react";
import DashboardCustomizeRoundedIcon from "@mui/icons-material/DashboardCustomizeRounded";
import { Alert, Button, Typography } from "@mui/joy";
import { useTheme } from "@mui/joy/styles";

import { ScheduleFormPanel } from "../../../../../components/layout/schedules/ScheduleFormPanel";
import { SchedulesUpgradePrompt } from "../../../../../components/layout/schedules/SchedulesUpgradePrompt";
import { toast } from "../../../../../components/ui/feedback/toastStore";
import { ModalFrame } from "../../../../../components/ui/modal/ModalFrame";
import { useAuth } from "../../../../../context/authState";
import { fmt, useTranslation } from "../../../../../i18n";
import {
    createSchedule,
    listSchedules,
    updateSchedule,
    type ScheduleChange,
    type ScheduleFields,
    type ScheduleList,
    type ScheduleResult,
} from "../../../../../services/schedules";
import { g } from "../../../../../theme/tokens";
import { announceRunResult } from "../../../../schedules/runScheduleAndAnnounce";
import { withoutAi } from "../../../../schedules/scheduleEffort";
import { localizeJob } from "../../../../schedules/scheduleParams";

/** The schedule job that makes a dashboard page (MIP-2353). */
export const DASHBOARD_JOB = "ai_dashboard";

/** What a dashboard's save place is made of; fixed once its page exists (MIP-2397). */
const PLACE_PARAMS = ["save_to", "folder_id"] as const;

type Props = {
    open: boolean;
    teamId: string;
    /** Set to edit a saved dashboard schedule; empty makes a new one. `hasNote`: its page exists,
     *  so where it is saved can no longer change (the API refuses to move it). */
    editing?: { scheduleId: string; hasNote: boolean } | null;
    onClose: () => void;
    /** The schedule was saved: the tab reads its lists again. */
    onSaved: () => void;
};

/**
 * "New dashboard" (MIP-2357) and "Edit dashboard" (MIP-2397): the EXISTING schedule form
 * (`ScheduleFormPanel`), with the dashboard job as the only report on offer. Nothing is built here
 * beyond opening that form: the pickers for kind, period and focus, the AI mode, the frequency and
 * the audience refusals all come from the form and the API, so what Settings > Schedules does for
 * this job, this does too. Editing sends what changed (`buildPatch`); the report itself cannot be
 * switched (the form lists only this one), so a dashboard stays a dashboard.
 */
export const DashboardScheduleDialog = ({ open, teamId, editing, onClose, onSaved }: Props) => {
    const { t } = useTranslation();
    const c = t.tasks.dashboard.customDashboards;
    const s = t.settings.schedules;
    const { accessToken } = useAuth();
    const theme = useTheme();
    const [list, setList] = useState<ScheduleList | null>(null);
    const [failed, setFailed] = useState(false);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        if (!open) return undefined;
        let live = true;
        setList(null);
        setFailed(false);
        setRefusedByPlan(false);
        void listSchedules(accessToken, teamId).then((res) => {
            if (!live) return;
            if (res === null) setFailed(true);
            else
                setList(
                    res.aiAvailable === false ? { ...res, jobs: res.jobs.map(withoutAi) } : res
                );
        });
        return () => {
            live = false;
        };
    }, [open, accessToken, teamId, reload]);

    const job = list?.jobs.find((j) => j.job === DASHBOARD_JOB);
    // The plan said no up front, or refused the save (the plan changed since the list was read).
    const [refusedByPlan, setRefusedByPlan] = useState(false);
    const planBlocked = (!!list && list.planAllowed === false) || refusedByPlan;

    const target = editing ? list?.schedules.find((x) => x.id === editing.scheduleId) : undefined;

    const submit = async (
        body: ScheduleFields | ScheduleChange
    ): Promise<ScheduleResult<object>> => {
        if (editing) {
            // Nothing changed: nothing to ask the server.
            if (Object.keys(body).length === 0) {
                onClose();
                return { ok: true };
            }
            const saved = await updateSchedule(accessToken, teamId, editing.scheduleId, body);
            if (saved.ok) {
                toast.success(c.editSaved, { id: "custom-dashboard-edited" });
                onSaved();
                onClose();
            } else if (saved.planRequired) {
                setRefusedByPlan(true);
            } else if (saved.gone) {
                // Deleted elsewhere since the list was read: say so, and show the real list.
                toast.error(c.editGone, { id: "custom-dashboard-edited" });
                onSaved();
                onClose();
            }
            return saved;
        }
        const res = await createSchedule(accessToken, teamId, body as ScheduleFields);
        if (res.ok) {
            // "Run right away" (MIP-2402): the create already ran it, so say how that went, as
            // Settings > Schedules does. "Run it now" would run (and charge) it twice (MIP-2425).
            if (res.outcome) {
                const chat = res.schedule.deliverChannel;
                void announceRunResult(
                    { ok: true, outcome: res.outcome },
                    res.schedule.id,
                    () => false,
                    chat ? chat.title || s.unavailable : null
                );
            } else {
                toast.success(c.newDashboardSaved, { id: "custom-dashboard-created" });
            }
            onSaved();
            onClose();
        } else if (res.planRequired) {
            setRefusedByPlan(true);
        } else if (res.limitReached && list) {
            return { ...res, error: fmt(s.limitReached, { limit: list.limit }) };
        }
        return res;
    };

    return (
        <ModalFrame
            icon={<DashboardCustomizeRoundedIcon sx={{ color: g.accent.text }} />}
            open={open}
            size="lg"
            title={editing ? c.editTitle : c.newDashboardTitle}
            zIndex={theme.zIndex.modal}
            clearBottomBar
            headerDivider
            onClose={onClose}
        >
            {failed ? (
                <Alert
                    color="danger"
                    size="sm"
                    sx={{ flexWrap: "wrap" }}
                    endDecorator={
                        <Button
                            color="danger"
                            size="sm"
                            variant="outlined"
                            onClick={() => setReload((n) => n + 1)}
                        >
                            {s.retry}
                        </Button>
                    }
                >
                    {c.newDashboardLoadFailed}
                </Alert>
            ) : !list ? (
                <Typography level="body-sm" role="status" sx={{ color: g.text.secondary }}>
                    {s.loading}
                </Typography>
            ) : planBlocked ? (
                <SchedulesUpgradePrompt hasKept={false} onNavigateAway={onClose} />
            ) : !job ? (
                <Typography level="body-sm" role="status" sx={{ color: g.text.secondary }}>
                    {c.newDashboardNoJob}
                </Typography>
            ) : editing && !target ? (
                // The schedule is not in the list any more: deleted elsewhere.
                <Typography level="body-sm" role="status" sx={{ color: g.text.secondary }}>
                    {c.editGone}
                </Typography>
            ) : (
                <>
                    {!editing && (
                        <Typography level="body-sm" sx={{ color: g.text.secondary, mb: 1.5 }}>
                            {c.newDashboardIntro}
                        </Typography>
                    )}
                    <ScheduleFormPanel
                        key={editing?.scheduleId ?? "new"}
                        aiCreditsOut={list.aiCreditsOut === true}
                        chatTargets={list.chatTargets ?? []}
                        existing={list.schedules}
                        jobs={[localizeJob(job, s)]}
                        schedule={target ?? null}
                        timeZone={list.timeZone}
                        lockedParams={
                            editing?.hasNote
                                ? { keys: PLACE_PARAMS, hint: c.editLockedHint }
                                : undefined
                        }
                        onCancel={onClose}
                        onSubmit={submit}
                    />
                </>
            )}
        </ModalFrame>
    );
};
