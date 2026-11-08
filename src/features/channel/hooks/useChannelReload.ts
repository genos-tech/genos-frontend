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
    const [reloading, setReloading] = useState(false);
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    const reload = useCallback(() => {
        setReloading(true);
        channelService
            .syncChannel(channelId)
            .catch(() => {
                /* recorded in the snapshot (`syncFailedByChannel`) */
            })
            .finally(() => {
                if (alive.current) setReloading(false);
            });
    }, [channelId]);
    return { reloading, reload };
}
