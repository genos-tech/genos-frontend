import { toast } from "../../../components/ui/feedback/toastStore";
import { getMessages } from "../../../i18n";

/**
 * Say so when the server refuses a flag change (MIP-1441).
 *
 * `channelService.flagMessage` / `unflagMessage` / `completeFlag` / `reopenFlag` write the store
 * first, send over the socket, and roll the store back if the ack fails (then rethrow). Callers
 * that only logged the error left the person watching a flag appear and vanish with no sentence
 * saying why: a 404 for someone who is not in the channel, an expired session, being offline.
 *
 * One toast id for all four, so a second failure replaces the first instead of stacking. The
 * wording names no noun ("message" would be wrong for a task comment).
 */
export type FlagAction = "flag" | "unflag" | "complete" | "reopen";

export const FLAG_FAILURE_TOAST_ID = "flag-action-failed";

export const reportFlagFailure = (action: FlagAction, error: unknown, source: string): void => {
    console.error(`[${source}] ${action} failed:`, error);
    toast.error(getMessages().chat.messageActions.failed[action], { id: FLAG_FAILURE_TOAST_ID });
};
