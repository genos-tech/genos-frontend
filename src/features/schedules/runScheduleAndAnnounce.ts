import { toast } from "../../components/ui/feedback/toastStore";
import { fmt, getMessages } from "../../i18n";
import { requestAppNavigate } from "../../services/appNavigate";
import { runScheduleNow } from "../../services/schedules";
import { requestInboxResync } from "../inbox/inboxResyncEvent";

type RunResult = Awaited<ReturnType<typeof runScheduleNow>>;

/**
 * "Run now", finished at the APP level rather than in the dialog.
 *
 * The run is one request that the API completes whether or not anyone is still
 * looking: `POST /schedules/<id>/run/` files the report in the Inbox before it
 * answers. What used to hang off the dialog's state (the inline notice, the
 * list refresh) is lost when the member closes Settings, and nothing else
 * knew the Inbox had changed: a report filed this way has no acting browser,
 * so no socket event announces it (`inboxResyncEvent.ts`). So the work that
 * must happen however the dialog ends lives here, in a plain function that
 * holds no component state:
 *
 *   * a run that worked asks for an Inbox resync (`schedule-run`), WAITS for
 *     it, then says "Report ready" with a button to open the Inbox, so the
 *     button never lands on a list that does not have the report yet;
 *   * a run that failed says so in a toast.
 *
 * `stillShown` is the dialog saying "I am still on screen and show the
 * problem myself" (its inline notice, or the upgrade prompt for a plan the
 * member lost). Then a failure is not announced twice. Success is always
 * announced: the Inbox button is useful with the dialog open too.
 *
 * Returns the raw result so the dialog can still draw its own notice.
 */
export const runScheduleAndAnnounce = async (
    accessToken: string | null,
    teamId: string,
    id: string,
    stillShown: () => boolean = () => false
): Promise<RunResult> => {
    const res = await runScheduleNow(accessToken, teamId, id);
    const s = getMessages().settings.schedules;
    const toastId = `schedule-run-${id}`;

    if (res.ok && res.outcome.status === "ok") {
        // Best-effort and never rejects: a failed sync costs the member the live
        // appearance, not the report, which is on the server. They are still told
        // it is ready; the Sync button or the next focus finds it.
        await requestInboxResync("schedule-run");
        const title = res.outcome.title.trim();
        toast.success(title ? fmt(s.reportReadyTitled, { title }) : s.reportReady, {
            id: toastId,
            action: { label: s.openInbox, onClick: () => requestAppNavigate("/workspace/inbox") },
        });
        return res;
    }

    if (stillShown()) return res;

    if (res.ok) {
        toast.error(fmt(s.ranFailed, { error: res.outcome.error || s.runFailed }), {
            id: toastId,
        });
    } else if (res.planRequired) {
        toast.warning(s.planRefused, {
            id: toastId,
            action: { label: s.upgradeCta, onClick: () => requestAppNavigate("/workspace/plans") },
        });
    } else {
        toast.error(res.error ?? s.runFailed, { id: toastId });
    }
    return res;
};
