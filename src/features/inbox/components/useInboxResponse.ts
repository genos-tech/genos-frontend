import { useState } from "react";
import type { Socket } from "socket.io-client";

import { useAuth } from "../../../context/authState";
import { useTranslation } from "../../../i18n";
import type { InboxItemProps } from "../../../types/common";
import { addInboxItem } from "../../admin/services/addInboxItem";
import { respondToOwnershipClaim } from "../../admin/services/ownershipClaim";
import {
    respondToExternalShare,
    respondToTeamConnection,
} from "../../admin/services/teamConnections";
import {
    HTTP_ANSWERED,
    OWNERSHIP_CLAIM,
    TEAM_CONNECTION,
    type InboxItemConfig,
} from "./inboxItemConfig";

export type InboxResponse = {
    /** The request's status: what this card just did, else what the server stored. */
    status: InboxItemProps["requestStatus"] | "approved" | "rejected";
    isHandled: boolean;
    /** Only the HTTP paths can report a refusal; a socket emit is fire-and-forget. */
    error: string | null;
    approve: () => void;
    reject: () => void;
};

/**
 * Answering one request from its card: Approve and Reject, over the socket for types 1-4 and over
 * HTTP for the ownership claim and the two cross-team types (their rules live in a locked Django
 * transaction). Moved out of `InboxBubble` unchanged; only the file it lives in is new.
 */
export const useInboxResponse = (
    inboxItem: InboxItemProps,
    config: InboxItemConfig | undefined,
    socket: Socket | null,
    onItemChanged?: () => void
): InboxResponse => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const [localStatus, setLocalStatus] = useState<"approved" | "rejected" | null>(null);
    // Answering something you no longer have standing to answer (a claim after ownership moved,
    // a share the host withdrew) has to say so, not no-op.
    const [error, setError] = useState<string | null>(null);

    const status = localStatus ?? inboxItem.requestStatus;
    const isHandled = status === "approved" || status === "rejected";

    // Three request types are answered over HTTP rather than the socket events types 1-4 use.
    // Which endpoint is decided by the type; what they have in common is everything after.
    const answerOverHttp = async (accept: boolean): Promise<boolean> => {
        const optionals = inboxItem.itemOptionals ?? {};
        if (inboxItem.itemType === OWNERSHIP_CLAIM) {
            return respondToOwnershipClaim(
                accessToken,
                inboxItem.itemId,
                accept ? "approve" : "reject",
                setError
            );
        }
        if (inboxItem.itemType === TEAM_CONNECTION) {
            const connectionId = optionals.connection_id as string | undefined;
            if (!connectionId) {
                setError(t.inbox.crossTeam.failed);
                return false;
            }
            return respondToTeamConnection(accessToken, connectionId, accept, setError);
        }
        const grantId = optionals.grant_id as string | undefined;
        if (!grantId) {
            setError(t.inbox.crossTeam.failed);
            return false;
        }
        return respondToExternalShare(accessToken, grantId, accept, setError);
    };

    // The optimistic `setLocalStatus` only moves once the call resolves: unlike a socket emit,
    // these can be refused, and showing "Approved" on a request the server rejected would be a
    // lie about what access exists.
    const respondOverHttp = async (accept: boolean) => {
        setError(null);
        if (!(await answerOverHttp(accept))) return;
        const next = accept ? "approved" : "rejected";
        setLocalStatus(next);
        // PERSIST IT, don't just flip local state. These rows render inside a Virtuoso list, so
        // component state dies whenever a row is recycled, and the stored item still said
        // "pending": the card came back with Approve/Reject live on an answered request. Types
        // 1-4 avoid this for free (the service pushes the updated card back); these answer over
        // HTTP, so they write it and re-read the list themselves.
        await addInboxItem({ ...inboxItem, requestStatus: next, isRead: true });
        onItemChanged?.();
    };

    const approve = () => {
        if (HTTP_ANSWERED.includes(inboxItem.itemType)) {
            void respondOverHttp(true);
        } else if (socket && config?.approveEvent) {
            socket.emit(config.approveEvent, { item_id: inboxItem.itemId });
            setLocalStatus("approved");
        }
    };

    const reject = () => {
        if (HTTP_ANSWERED.includes(inboxItem.itemType)) {
            void respondOverHttp(false);
        } else if (socket && config?.rejectEvent) {
            socket.emit(config.rejectEvent, { item_id: inboxItem.itemId });
            setLocalStatus("rejected");
        }
    };

    return { status, isHandled, error, approve, reject };
};
