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
    type ScheduleChange,
    type ScheduleFields,
    type ScheduleList,
    type ScheduleResult,
} from "../../../../../services/schedules";
import { g } from "../../../../../theme/tokens";
import { withoutAi } from "../../../../schedules/scheduleEffort";
import { localizeJob } from "../../../../schedules/scheduleParams";

/** The schedule job that makes a dashboard page (MIP-2353). */
export const DASHBOARD_JOB = "ai_dashboard";

type Props = {
    open: boolean;
    teamId: string;
    onClose: () => void;
    /** The schedule was saved: the tab reads its lists again. */
    onCreated: () => void;
};

/**
 * "New dashboard" (MIP-2357): the EXISTING schedule form (`ScheduleFormPanel`), with the dashboard
 * job as the only report on offer. Nothing is built here beyond opening that form: the pickers for
 * kind, period and focus, the AI mode, the frequency and the audience refusals all come from the
 * form and the API, so what Settings > Schedules does for this job, this does too.
 */
export const NewDashboardDialog = ({ open, teamId, onClose, onCreated }: Props) => {
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

    const submit = async (
        body: ScheduleFields | ScheduleChange
    ): Promise<ScheduleResult<object>> => {
        const res = await createSchedule(accessToken, teamId, body as ScheduleFields);
        if (res.ok) {
            toast.success(c.newDashboardSaved, { id: "custom-dashboard-created" });
            onCreated();
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
            title={c.newDashboardTitle}
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
            ) : (
                <>
                    <Typography level="body-sm" sx={{ color: g.text.secondary, mb: 1.5 }}>
                        {c.newDashboardIntro}
                    </Typography>
                    <ScheduleFormPanel
                        aiCreditsOut={list.aiCreditsOut === true}
                        chatTargets={list.chatTargets ?? []}
                        existing={list.schedules}
                        jobs={[localizeJob(job, s)]}
                        schedule={null}
                        timeZone={list.timeZone}
                        onCancel={onClose}
                        onSubmit={submit}
                    />
                </>
            )}
        </ModalFrame>
    );
};
