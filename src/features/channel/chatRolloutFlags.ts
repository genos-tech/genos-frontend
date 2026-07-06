/**
 * v3-chat rollout gates, split out of `V3ChatShell.tsx` so flag
 * consumers don't drag the whole chat surface into their bundle:
 * the shell's import graph reaches the message composer and the
 * BlockNote editor stack (~900 kB gzipped vendor chunk), and App.tsx
 * needs `useIsV3ChatEnabled` at boot — importing it from the shell
 * module pinned all of that into the initial entry chunk.
 */

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
