/**
 * `V3ChatShell` — the proof-of-life mount point for the v3 messaging
 * surfaces.
 *
 * Routes:
 *   /workspace/v3                           — channel list, no pane
 *   /workspace/v3/:channelId                — channel open in main pane
 *   /workspace/v3/:channelId/t/:rootId      — channel + thread side panel
 *
 * Behind `VITE_USE_V3_CHAT` — `isV3ChatEnabled()` returns false in
 * production builds where the flag isn't set, so this entire surface
 * is dormant.
 */

import { useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ChannelListV3 } from "./components/ChannelListV3";
import { MessagesPaneV3 } from "./components/MessagesPaneV3";
import { ThreadPanelV3 } from "./components/ThreadPanelV3";

import { channelService } from "../../services/channel/channelService";

// The rollout gates (`isV3ChatEnabled` / `useIsV3ChatEnabled` /
// `useV3ChatEnabledForKind`) used to live here; they moved to
// `chatRolloutFlags.ts` so flag consumers (App.tsx at boot) don't
// drag this module's import graph — which reaches the message
// composer and the whole BlockNote editor stack — into the initial
// entry chunk. Import flags from there; this module is loaded lazily.

export function V3ChatShell() {
    // Channel + thread selection live in the URL so they survive
    // reloads and the browser back button does the right thing.
    const { channelId, rootMessageId } = useParams<{
        channelId?: string;
        rootMessageId?: string;
    }>();
    const navigate = useNavigate();
    const selected = channelId ?? null;
    const openThread = rootMessageId ?? null;

    const setSelected = useCallback(
        (id: string) => {
            navigate(`/workspace/v3/${id}`);
        },
        [navigate]
    );

    const closeThread = useCallback(() => {
        if (selected) navigate(`/workspace/v3/${selected}`);
    }, [selected, navigate]);

    const openThreadFor = useCallback(
        (rootId: string) => {
            if (selected) navigate(`/workspace/v3/${selected}/t/${rootId}`);
        },
        [selected, navigate]
    );

    // Best-effort REST refresh on mount so the chat list has fresh
    // server-side `latestMessage` / `unreadCount` denorms. Each
    // channel is upserted into the store via handleChannelCreated so
    // subscribers re-render.
    useEffect(() => {
        let cancelled = false;
        void channelService
            .listChannels()
            .then((channels) => {
                if (cancelled) return;
                for (const ch of channels) channelService.handleChannelCreated(ch);
            })
            .catch(() => {
                /* network error — store stays on cached IDB snapshot */
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // When a channel is selected, kick the incremental sync. The
    // service owns the checkpoint read/write loop — first selection
    // does a full load, subsequent selections only pull rows updated
    // since the persisted `server_time`. See `syncChannel` for the
    // ordering guarantees.
    //
    // The effect cleanup just skips error reporting on unmount/switch;
    // the underlying sync (and its checkpoint write) still completes
    // because partial work is wasted otherwise — the data IS correct
    // up to the captured server_time and the next sync would re-fetch
    // exactly what we already wrote.
    useEffect(() => {
        if (!selected) return;
        let cancelled = false;
        void channelService.syncChannel(selected).catch(() => {
            if (cancelled) return;
            /* network error — pane stays on whatever's cached */
        });
        return () => {
            cancelled = true;
        };
    }, [selected]);

    return (
        <div
            data-testid="v3-chat-shell"
            style={{
                display: "flex",
                height: "100%",
                fontFamily: "system-ui, sans-serif",
            }}
        >
            <ChannelListV3 selectedChannelId={selected} onSelect={setSelected} />
            <main style={{ flex: 1, display: "flex", minWidth: 0 }}>
                {selected ? (
                    <>
                        <div
                            style={{
                                flex: 1,
                                display: "flex",
                                flexDirection: "column",
                                minWidth: 0,
                            }}
                        >
                            <MessagesPaneV3 channelId={selected} onOpenThread={openThreadFor} />
                        </div>
                        {openThread && (
                            <div
                                style={{
                                    width: 360,
                                    borderLeft: "1px solid #ddd",
                                    display: "flex",
                                    flexDirection: "column",
                                }}
                            >
                                <ThreadPanelV3
                                    channelId={selected}
                                    rootMessageId={openThread}
                                    onClose={closeThread}
                                />
                            </div>
                        )}
                    </>
                ) : (
                    <div style={{ padding: 16, opacity: 0.5 }}>
                        Select a channel from the left.
                    </div>
                )}
            </main>
        </div>
    );
}
