import { Channel, ChannelKind } from "../../../types/channel";

/**
 * Find a project's PM (project-management) channel among a set of channels.
 *
 * Kept dependency-free (types only) so it's unit-testable without dragging in
 * the `channelService` singleton / IDB. Used by `uploadNewTask` to route the
 * "task created" chat bubble to the right PM channel.
 *
 * projectIds are compared as strings on purpose: the channel's `projectId`
 * comes off `/api/v3/channels/` (a DRF `IntegerField`, but `allow_null`) while
 * the task's comes from the project store — normalizing rules out a
 * string/number skew silently missing a real match. A channel with a null
 * `projectId` never matches.
 */
export const findPmChannelForProject = (
    channels: Iterable<Channel>,
    projectId: number | string
): Channel | undefined => {
    const target = String(projectId);
    for (const ch of channels) {
        if (
            ch.kind === ChannelKind.PM &&
            ch.projectId != null &&
            String(ch.projectId) === target
        ) {
            return ch;
        }
    }
    return undefined;
};
