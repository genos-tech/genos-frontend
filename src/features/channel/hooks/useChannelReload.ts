/**
 * Retry for a channel's history load (MIP-1299).
 *
 * `channelService.syncChannel` records a failure per channel
 * (`snapshot.syncFailedByChannel`); `reload` runs it again. `reloading` is true
 * while that run is in flight, so a pane shows the skeleton for the retry
 * instead of the stale error. A failure of the retry lands in the snapshot like
 * the first one, so nothing is thrown here.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { channelService } from "../../../services/channel/channelService";

export function useChannelReload(channelId: string): { reloading: boolean; reload: () => void } {
    // Keyed by channel: panes stay mounted across a channel switch, and a retry
    // of channel A must not paint B's pane as "reloading".
    const [reloadingId, setReloadingId] = useState<string | null>(null);
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    const reload = useCallback(() => {
        setReloadingId(channelId);
        channelService
            .syncChannel(channelId)
            .catch(() => {
                /* recorded in the snapshot (`syncFailedByChannel`) */
            })
            .finally(() => {
                if (alive.current) setReloadingId((cur) => (cur === channelId ? null : cur));
            });
    }, [channelId]);
    return { reloading: reloadingId === channelId, reload };
}
