import { PartialBlock } from "@blocknote/core";

import { UserProps } from "./admin";

export type GroupedReactionProps = {
    senders: UserProps[];
    emoji: string;
    count: number;
};

export type ReactionProps = {
    id: number;
    emoji: string;
    sender: UserProps;
    tsSent: string;
};

// itemType:0 : Activity message
// itemType:1 : Join team request
// itemType:2 : Join project request
// itemType:3 : Join gm request
// itemType:4 : Note access request
// itemType:5 : Team ownership claim (break-glass recovery for an absent
//              owner — the receiver is the CURRENT owner, and ignoring it
//              is what lets the sender take ownership)
// itemType:6 : Proactive Genos digest. NOT a request, and the one type
//              whose `itemBody` is {title, text} rather than blocks.
// itemType:7 : Team connection request (another organization asks to
//              connect; approving it shares nothing by itself)
// itemType:8 : Cross-team share offer (one chat, project or note folder
//              lent to your team; accepting admits nobody until your
//              managers add people). 7 and 8 are answered over HTTP —
//              `respondToTeamConnection` / `respondToExternalShare`.
// itemType:9 : Reminder that came due (a message's or a to-do's).
// itemType:10: Genos report: what a member's own schedule produced. NOT a
//              request; `itemBody` is {title, text, sections} (`text` is the
//              one-line summary). See `features/inbox/utils/genosReport.ts`.
export type InboxItemProps = {
    itemId: number;
    itemBody: PartialBlock[] | any[];
    itemType: number;
    isRead: boolean;
    requestStatus: "pending" | "approved" | "rejected";
    tsSent: string;
    // Request routing payload. Note-access items (itemType 4) carry
    // note_type/note_id/note_title so the card can open the referenced
    // note; other request types carry their own keys. Absent on plain
    // activity items.
    itemOptionals?: {
        note_type?: number;
        note_id?: number;
        note_title?: string;
        [key: string]: unknown;
    } | null;
};
