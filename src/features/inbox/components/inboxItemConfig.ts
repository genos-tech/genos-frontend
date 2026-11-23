import type { ElementType } from "react";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";

import type { InboxItemProps } from "../../../types/common";
import { GENOS_REPORT_ITEM_TYPE } from "../utils/genosReport";

/** `item_type`s, by name. Server vocabulary: `origin/models/common/inbox_models.py`. */
export const TEAM_REQUEST = 1;
export const PROJECT_REQUEST = 2;
export const GM_REQUEST = 3;
export const NOTE_ACCESS_REQUEST = 4;
/** A team-ownership claim. See `ownershipClaim.ts`. */
export const OWNERSHIP_CLAIM = 5;
/** A proactive Genos digest (retired, old items stay). */
export const DIGEST = 6;
/** Cross-team sharing. See `teamConnections.ts`. */
export const TEAM_CONNECTION = 7;
export const EXTERNAL_SHARE = 8;
/** A reminder that came due, a message's or a to-do's: ONE type, because it is the same thing
 *  from the reader's side; `item_optionals.kind` says which. */
export const MESSAGE_REMINDER = 9;
/** A schedule's report. See `utils/genosReport.ts`. */
export const GENOS_REPORT = GENOS_REPORT_ITEM_TYPE;

/** `item_optionals.kind` for the to-do flavour of the reminder. */
export const TODO_REMINDER_KIND = "todo_reminder";

/** `item_optionals.kind` of the first-month-of-Core trial notice (an activity, item type 0). */
export const TRIAL_NOTICE_KIND = "core_trial_notice";

/** The request types answered over HTTP rather than a socket event. Their rules live in a locked
 *  Django transaction, so they carry no socket events. */
export const HTTP_ANSWERED = [OWNERSHIP_CLAIM, TEAM_CONNECTION, EXTERNAL_SHARE];

export type RequestLabelKey =
    | "teamRequest"
    | "projectRequest"
    | "gmRequest"
    | "noteAccessRequest"
    | "ownershipClaim"
    | "digest"
    | "teamConnection"
    | "externalShare"
    | "messageReminder"
    | "todoReminder"
    | "genosReport"
    | "trialNotice";

/** The colour a type's mark takes. A status ROLE where the hue IS that status (blue info, green
 *  success, amber warning, red danger), the accent for what Genos or your own reminders say, and
 *  neutral for the rest: one calm set, not one hue per type. */
export type InboxTone = "info" | "success" | "warning" | "danger" | "accent" | "neutral";

export type InboxItemConfig = {
    labelKey: RequestLabelKey;
    Icon: ElementType;
    tone: InboxTone;
    /** Types 1-4 answer over Socket.IO. */
    approveEvent?: string;
    rejectEvent?: string;
};

export const ITEM_TYPE_CONFIG: Record<number, InboxItemConfig> = {
    [TEAM_REQUEST]: {
        labelKey: "teamRequest",
        Icon: GroupsRoundedIcon,
        tone: "info",
        approveEvent: "approve_join_team_request",
        rejectEvent: "reject_join_team_request",
    },
    [PROJECT_REQUEST]: {
        labelKey: "projectRequest",
        Icon: FolderRoundedIcon,
        tone: "success",
        approveEvent: "approve_join_project_request",
        rejectEvent: "reject_join_project_request",
    },
    [GM_REQUEST]: {
        labelKey: "gmRequest",
        Icon: ChatRoundedIcon,
        tone: "neutral",
        approveEvent: "approve_join_gm_request",
        rejectEvent: "reject_join_gm_request",
    },
    [NOTE_ACCESS_REQUEST]: {
        labelKey: "noteAccessRequest",
        Icon: StickyNote2RoundedIcon,
        tone: "warning",
        approveEvent: "approve_note_access_request",
        rejectEvent: "reject_note_access_request",
    },
    // Red, alone among the request types, and deliberately so: this is the only inbox item that
    // costs you something by being IGNORED.
    [OWNERSHIP_CLAIM]: {
        labelKey: "ownershipClaim",
        Icon: ShieldRoundedIcon,
        tone: "danger",
    },
    [DIGEST]: {
        labelKey: "digest",
        Icon: AutoAwesomeRoundedIcon,
        tone: "accent",
    },
    // Cross-team sharing: the other party is a different ORGANIZATION. Answered over HTTP.
    [TEAM_CONNECTION]: {
        labelKey: "teamConnection",
        Icon: HubRoundedIcon,
        tone: "neutral",
    },
    [EXTERNAL_SHARE]: {
        labelKey: "externalShare",
        Icon: ShareRoundedIcon,
        tone: "neutral",
    },
    // A promise you made yourself, kept.
    [MESSAGE_REMINDER]: {
        labelKey: "messageReminder",
        Icon: NotificationsActiveRoundedIcon,
        tone: "accent",
    },
    [GENOS_REPORT]: {
        labelKey: "genosReport",
        Icon: ArticleRoundedIcon,
        tone: "accent",
    },
};

/** The trial notice. Type 0 is the catch-all activity type and has no entry above (its other
 *  cards stay without a label), so this one is picked by `kind`. */
export const TRIAL_NOTICE_CONFIG: InboxItemConfig = {
    labelKey: "trialNotice",
    Icon: WorkspacePremiumRoundedIcon,
    tone: "success",
};

export const TodoReminderIcon = TaskAltRoundedIcon;
export const ReminderChatIcon = ChatRoundedIcon;

export const isTrialNotice = (item: Pick<InboxItemProps, "itemType" | "itemOptionals">): boolean =>
    item.itemType === 0 && item.itemOptionals?.kind === TRIAL_NOTICE_KIND;

/** The config of an item, or undefined for a plain activity. */
export const pickConfig = (
    item: Pick<InboxItemProps, "itemType" | "itemOptionals">
): InboxItemConfig | undefined =>
    isTrialNotice(item) ? TRIAL_NOTICE_CONFIG : ITEM_TYPE_CONFIG[item.itemType];

/** Genos itself wrote these: the Genos mark is their avatar. */
export const isGenosAuthored = (
    item: Pick<InboxItemProps, "itemType" | "itemOptionals">
): boolean => item.itemType === DIGEST || item.itemType === GENOS_REPORT || isTrialNotice(item);
