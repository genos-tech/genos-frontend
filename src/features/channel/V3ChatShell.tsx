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
import {
    runtimeConfigService,
    type RuntimeFlagName,
} from "../../services/runtimeConfig/runtimeConfigService";
import { useRuntimeConfig } from "../../services/runtimeConfig/useRuntimeConfig";
import { ChannelKind } from "../../types/channel";

/**
 * Build-time gate. Returns true iff the `VITE_USE_V3_CHAT` env var was
 * `"true"` at build time. Used by non-React call sites (route guards,
 * menu items rendered outside hooks) that need a sync check.
 *
 * Most call sites should prefer `useIsV3ChatEnabled()` so they pick up
 * the runtime-config rollout too.
 */
export function isV3ChatEnabled(): boolean {
    return import.meta.env.VITE_USE_V3_CHAT === "true";
}

/**
 * Reactive v3 chat gate. Returns true when EITHER:
 *   - The build-time env var is `"true"` (developer / canary build), OR
 *   - The runtime config's panic switch is off AND any of the per-chat-kind
 *     `use_new_chat.{dm,gm,mdm,pm}` flags rolled out to this user.
 *
 * Per-kind granularity (e.g. only DM enabled, GM/PM/MDM still legacy)
 * is reserved for inside the shell — at the route level, any kind being
 * on is enough to make the v3 surface available.
 *
 * Re-renders when the runtime config updates (poll lands or user
 * changes), so a server-side flag flip propagates within ≤60s without
 * a reload.
 */
export function useIsV3ChatEnabled(): boolean {
    // Subscribe so the consumer re-renders when config / buckets change.
    useRuntimeConfig();
    if (isV3ChatEnabled()) return true;
    return (
        runtimeConfigService.isEnabled("use_new_chat.dm") ||
        runtimeConfigService.isEnabled("use_new_chat.gm") ||
        runtimeConfigService.isEnabled("use_new_chat.mdm") ||
        runtimeConfigService.isEnabled("use_new_chat.pm")
    );
}

const CHANNEL_KIND_TO_FLAG: Record<ChannelKind, RuntimeFlagName> = {
    [ChannelKind.DM]: "use_new_chat.dm",
    [ChannelKind.GM]: "use_new_chat.gm",
    [ChannelKind.PM]: "use_new_chat.pm",
    [ChannelKind.MDM]: "use_new_chat.mdm",
};

/**
 * Per-kind v3 gate. Returns true iff:
 *   - The build-time env var is `"true"`, OR
 *   - The runtime config flag for THIS SPECIFIC kind is rolled out
 *     to the current user (panic switch overrides).
 *
 * Use this inside the shell / legacy surfaces to decide whether the
 * current channel should render via v3 paths. Important: this is
 * STRICTLY per-kind — being bucketed for DM does not flip GM on.
 * That lets the rollout shape match the plan (DM → GM → MDM → PM,
 * each baked at 100% before the next starts).
 *
 * Returns false when called outside an authenticated session or before
 * the first config poll completes.
 */
export function useV3ChatEnabledForKind(kind: ChannelKind): boolean {
    useRuntimeConfig();
    if (isV3ChatEnabled()) return true;
    const flag = CHANNEL_KIND_TO_FLAG[kind];
    if (!flag) return false;
    return runtimeConfigService.isEnabled(flag);
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
