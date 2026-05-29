/**
 * React hooks for the runtime config service.
 *
 * Three hooks:
 *   - `useRuntimeConfig()`        — full config snapshot + isLoaded flag.
 *   - `useRuntimeFlag(name)`      — boolean: is this flag rolled out to me?
 *   - `useRuntimeConfigBootstrap` — lifecycle wiring (mount once near the app root).
 */

import { useEffect, useSyncExternalStore } from "react";

import {
    runtimeConfigService,
    type RuntimeConfig,
    type RuntimeFlagName,
} from "./runtimeConfigService";

/**
 * Returns the current config + whether the first fetch has resolved.
 * Re-renders when either changes.
 */
export function useRuntimeConfig(): { config: RuntimeConfig; isLoaded: boolean } {
    return useSyncExternalStore(runtimeConfigService.subscribe, runtimeConfigService.getSnapshot);
}

/**
 * Whether the named flag is enabled for the current user.
 *
 * `false` until the config has loaded AND the user's bucket has been
 * computed — fail closed during boot so a slow rollout endpoint can't
 * accidentally flip users into v3 paths. Once computed, the value is
 * stable per (user, flag) — the bucket doesn't move even if the
 * threshold does.
 */
export function useRuntimeFlag(flagName: RuntimeFlagName): boolean {
    // Subscribe to the service so this hook re-renders on config / bucket
    // updates — the return value of isEnabled() depends on both.
    useRuntimeConfig();
    return runtimeConfigService.isEnabled(flagName);
}

/**
 * Mount once near the app root after auth is settled. Pushes the
 * latest credentials onto the service and starts the 60s poll loop.
 * Stops on unmount or auth change.
 */
export function useRuntimeConfigBootstrap(
    accessToken: string | null,
    userId: string | null
): void {
    useEffect(() => {
        runtimeConfigService.setAccessToken(accessToken);
        runtimeConfigService.setUserId(userId);
        if (!accessToken) {
            // Not signed in — leave the service idle. Any previous
            // timer is cleaned up by the cleanup of the prior effect.
            return undefined;
        }
        runtimeConfigService.start();
        return () => {
            runtimeConfigService.stop();
        };
    }, [accessToken, userId]);
}
