/**
 * `V3ChatShell` — the proof-of-life mount point for the v3 messaging
 * surfaces.
 *
 * Wires `ChannelListV3` + `MessagesPaneV3` side-by-side. Behind the
 * `VITE_USE_V3_CHAT` flag — `isV3ChatEnabled()` returns false in
 * production builds where the flag isn't set, so this entire surface
 * is dormant. Once the v3 architecture is verified end-to-end the
 * legacy `MainChatPane`/`SubChatPane` paths get retired in favor of
 * these (after polish — see plan §4).
 */

import { useEffect, useState } from "react";

import { ChannelListV3 } from "./components/ChannelListV3";
import { MessagesPaneV3 } from "./components/MessagesPaneV3";

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
    const [selected, setSelected] = useState<string | null>(null);

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

    // When a channel is selected, fetch its message delta if we don't
    // already have it cached. The fetch is `?since=` aware — passing
    // no `since` returns a full load; subsequent re-opens with the
    // checkpoint return only deltas.
    useEffect(() => {
        if (!selected) return;
        let cancelled = false;
        // The store doesn't currently track per-channel sync checkpoints
        // (TODO: persist `server_time` in SYNC_CHECKPOINTS and pass on
        // re-open). For now, every selection triggers a full load. This
        // is cheap thanks to the per-channel cap on the backend; later
        // we'll only fetch the tail.
        void channelService
            .fetchMessagesDelta(selected)
            .then((env) => {
                if (cancelled) return;
                for (const m of env.data.messages ?? []) {
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
            <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                {selected ? (
                    <MessagesPaneV3 channelId={selected} />
                ) : (
                    <div style={{ padding: 16, opacity: 0.5 }}>
                        Select a channel from the left.
                    </div>
                )}
            </main>
        </div>
    );
}
