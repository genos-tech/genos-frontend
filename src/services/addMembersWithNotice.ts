import { Socket } from "socket.io-client";

import { UserProps } from "../types/admin";
import { channelService } from "./channel/channelService";

const base_url = import.meta.env.VITE_API_BASE_URL;

/**
 * Add existing teammates to a project or GM, then tell them about it.
 *
 * Two steps on purpose, because the add and the notice have different
 * owners:
 *
 *   1. **The add** goes through whichever primitive owns that membership.
 *      A project is NOT "just a channel": `POST /api/v3/channels/<id>/members/`
 *      explicitly 400s for PM kind ("membership is managed via the
 *      project"), so projects go through `POST /project/join/` and a
 *      Django `post_save` signal (`_sync_pm_channel_member`) mirrors the
 *      row into the PM channel. GMs are plain channels, so they use the
 *      v3 `channel.member.add` event (`channelService.addMembers`).
 *   2. **The notice** is the same for both: emit `members_added_notice`,
 *      whose Flask handler POSTs `inbox/` (item_type 0 = plain activity
 *      card + webpush) and `send()`s it live to each added user. Doing
 *      this over the socket rather than POSTing `inbox/` from here is
 *      what makes the card appear in their inbox immediately instead of
 *      on their next refresh.
 *
 * The notice is best-effort: a failure there must not report the add as
 * failed, because the membership write has already committed.
 */

const emitAddedNotice = (
    socket: Socket | null,
    targetKind: "project" | "gm",
    targetName: string,
    receiverIds: string[]
): void => {
    // Nobody landed — nothing to announce. Not a problem.
    if (receiverIds.length === 0) return;
    // Someone landed but we have no rail to announce it on. This is a
    // wiring bug at the call site, and it used to fail silently: the member
    // was added, and their invite simply never existed — no inbox row, no
    // webpush, no error. `TaskHeader` hardcoded `socket={null}`, so every
    // invite sent from the task-header project profile vanished while the
    // identical GM flow worked.
    if (!socket) {
        console.error(
            `[addMembersWithNotice] no socket — ${receiverIds.length} member(s) were added ` +
                `to ${targetKind} "${targetName}" but will NOT be notified. ` +
                `The caller must pass the legacy socket through.`,
            receiverIds
        );
        return;
    }
    try {
        socket.emit("members_added_notice", {
            receiver_ids: receiverIds,
            target_kind: targetKind,
            target_name: targetName,
        });
    } catch (err) {
        console.error("[addMembersWithNotice] notice emit failed:", err);
    }
};

/**
 * Add teammates to a project. Resolves the ids that were actually added.
 *
 * Each member is a separate `POST /project/join/` (the endpoint takes one
 * `attendee_id`), and they're independent: one failure doesn't sink the
 * rest, and everyone who did land still gets notified.
 */
export const addMembersToProjectWithNotice = async ({
    accessToken,
    myself,
    projectId,
    projectName,
    memberIds,
    socket,
}: {
    accessToken: string | null;
    myself: UserProps;
    projectId: number;
    projectName: string;
    memberIds: string[];
    socket: Socket | null;
}): Promise<{ addedIds: string[]; failedIds: string[] }> => {
    const addedIds: string[] = [];
    const failedIds: string[] = [];

    for (const attendeeId of memberIds) {
        try {
            const res = await fetch(`${base_url}/project/join/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    team_id: myself.teamId,
                    project_id: projectId,
                    attendee_id: attendeeId,
                }),
            });
            if (!res.ok) {
                console.error(
                    `[addMembersWithNotice] project join failed for ${attendeeId}:`,
                    res.status
                );
                failedIds.push(attendeeId);
                continue;
            }
            addedIds.push(attendeeId);
        } catch (err) {
            console.error(`[addMembersWithNotice] project join threw for ${attendeeId}:`, err);
            failedIds.push(attendeeId);
        }
    }

    emitAddedNotice(socket, "project", projectName, addedIds);
    return { addedIds, failedIds };
};

/**
 * Add teammates to a GM. `channelService.addMembers` is one bulk v3 emit,
 * so it's all-or-nothing — unlike the project loop above.
 */
export const addMembersToGMWithNotice = async ({
    channelId,
    gmName,
    memberIds,
    socket,
}: {
    channelId: string;
    gmName: string;
    memberIds: string[];
    socket: Socket | null;
}): Promise<{ addedIds: string[]; failedIds: string[] }> => {
    try {
        const result = await channelService.addMembers(channelId, memberIds);
        if (!result) {
            return { addedIds: [], failedIds: memberIds };
        }
    } catch (err) {
        console.error("[addMembersWithNotice] GM addMembers failed:", err);
        return { addedIds: [], failedIds: memberIds };
    }

    emitAddedNotice(socket, "gm", gmName, memberIds);
    return { addedIds: memberIds, failedIds: [] };
};
