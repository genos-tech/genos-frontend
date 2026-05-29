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

/**
 * Pure helper so other call sites (e.g. menu items / dev tools) can
 * cheaply gate themselves on the flag without needing to know the env
 * shape.
 */
export function isV3ChatEnabled(): boolean {
    return import.meta.env.VITE_USE_V3_CHAT === "true";
}

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

    // When a channel is selected, fetch its message + thread deltas in
    // parallel. The `/messages/` endpoint returns top-level messages;
    // `/threads/` returns thread replies. Both flow into the same
    // store via handleMessageCreated and the hooks filter by
    // isThreadReply.
    useEffect(() => {
        if (!selected) return;
        let cancelled = false;
        // The store doesn't currently track per-channel sync checkpoints
        // (TODO: persist `server_time` in SYNC_CHECKPOINTS and pass on
        // re-open). For now, every selection triggers a full load.
        void Promise.all([
            channelService.fetchMessagesDelta(selected),
            channelService.fetchThreadsDelta(selected),
        ])
            .then(([msgs, threads]) => {
                if (cancelled) return;
                for (const m of msgs.data.messages ?? []) {
                    channelService.handleMessageCreated(m);
                }
                for (const m of threads.data.messages ?? []) {
                    channelService.handleMessageCreated(m);
                }
            })
            .catch(() => {
                /* network error — pane stays on whatever's cached */
            });
        return () => {
            cancelled = true;
        };
    }, [selected]);

    return (
        <div
            style={{
                display: "flex",
                height: "100%",
                fontFamily: "system-ui, sans-serif",
            }}
            data-testid="v3-chat-shell"
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
