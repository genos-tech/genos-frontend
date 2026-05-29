/**
 * `useIsV3ChatEnabled` hook tests.
 *
 * The hook ORs the build-time env var with the runtime config's
 * per-chat-kind rollout flags. These tests focus on the OR semantics
 * and the hook's re-render contract; the underlying `isEnabled()`
 * bucket math is covered by `V3RuntimeConfig.test.ts`.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIsV3ChatEnabled, useV3ChatEnabledForKind } from "../features/channel/V3ChatShell";
import { authApi } from "../services/api";
import { runtimeConfigService } from "../services/runtimeConfig/runtimeConfigService";
import { ChannelKind } from "../types/channel";

vi.mock("../services/api", () => ({
    authApi: vi.fn(),
    nonAuthApi: vi.fn(),
}));

function mockGet(returnPayload: unknown) {
    const get = vi.fn().mockResolvedValue({ data: returnPayload });
    (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get });
    return get;
}

describe("useIsV3ChatEnabled", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // The dev .env.local sets VITE_USE_V3_CHAT=true, which would
        // short-circuit the hook before the runtime path is checked.
        // Stub it off so these tests exercise the runtime config branch
        // in isolation. The build-time branch is its own one-liner and
        // is covered indirectly by the "returns false ... all flags off"
        // case below where both branches are false.
        vi.stubEnv("VITE_USE_V3_CHAT", "false");
        runtimeConfigService._resetForTests();
        runtimeConfigService.setAccessToken("tok-1");
        runtimeConfigService.setUserId("u-alice");
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        runtimeConfigService.stop();
    });

    it("returns false when env off, all runtime flags off", () => {
        // No fetch issued — config stays at defaults (all zero).
        const { result } = renderHook(() => useIsV3ChatEnabled());
        expect(result.current).toBe(false);
    });

    it("returns true when ANY per-chat-kind flag is fully rolled out", async () => {
        // mdm=10000 means "true regardless of bucket". Other kinds at 0.
        mockGet({
            version: 1,
            use_new_chat: { dm: 0, gm: 0, mdm: 10000, pm: 0 },
            panic_switch: false,
        });
        runtimeConfigService.start();
        const { result } = renderHook(() => useIsV3ChatEnabled());
        await waitFor(() => expect(result.current).toBe(true));
    });

    it("returns false when panic_switch is on, even at 100% rollout", async () => {
        mockGet({
            version: 1,
            use_new_chat: { dm: 10000, gm: 10000, mdm: 10000, pm: 10000 },
            panic_switch: true,
        });
        runtimeConfigService.start();
        const { result } = renderHook(() => useIsV3ChatEnabled());
        // Wait long enough for config to land.
        await waitFor(() => expect(runtimeConfigService.getSnapshot().isLoaded).toBe(true));
        expect(result.current).toBe(false);
    });

    it("re-renders to true when the runtime poll lands a rollout flag", async () => {
        mockGet({
            version: 1,
            use_new_chat: { dm: 0, gm: 0, mdm: 0, pm: 10000 },
            panic_switch: false,
        });
        runtimeConfigService.start();
        const { result } = renderHook(() => useIsV3ChatEnabled());
        // Initially false (config hasn't loaded), eventually true.
        await waitFor(() => expect(result.current).toBe(true));
    });

    it("returns true unconditionally when the build-time env var is on", async () => {
        // Re-enable the env var; runtime config is left at defaults
        // (everything off, no fetch). The build-time short-circuit
        // should still flip the hook on.
        vi.stubEnv("VITE_USE_V3_CHAT", "true");
        const { result } = renderHook(() => useIsV3ChatEnabled());
        expect(result.current).toBe(true);
    });
});

describe("useV3ChatEnabledForKind", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("VITE_USE_V3_CHAT", "false");
        runtimeConfigService._resetForTests();
        runtimeConfigService.setAccessToken("tok-1");
        runtimeConfigService.setUserId("u-alice");
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        runtimeConfigService.stop();
    });

    it("flips on ONLY for the matching kind, not its siblings", async () => {
        // DM at 100%, every other kind off.
        mockGet({
            version: 1,
            use_new_chat: { dm: 10000, gm: 0, mdm: 0, pm: 0 },
            panic_switch: false,
        });
        runtimeConfigService.start();
        const dm = renderHook(() => useV3ChatEnabledForKind(ChannelKind.DM));
        const gm = renderHook(() => useV3ChatEnabledForKind(ChannelKind.GM));
        const mdm = renderHook(() => useV3ChatEnabledForKind(ChannelKind.MDM));
        const pm = renderHook(() => useV3ChatEnabledForKind(ChannelKind.PM));
        await waitFor(() => expect(dm.result.current).toBe(true));
        expect(gm.result.current).toBe(false);
        expect(mdm.result.current).toBe(false);
        expect(pm.result.current).toBe(false);
    });

    it("panic_switch overrides per-kind rollout", async () => {
        mockGet({
            version: 1,
            use_new_chat: { dm: 10000, gm: 10000, mdm: 10000, pm: 10000 },
            panic_switch: true,
        });
        runtimeConfigService.start();
        const { result } = renderHook(() => useV3ChatEnabledForKind(ChannelKind.DM));
        await waitFor(() => expect(runtimeConfigService.getSnapshot().isLoaded).toBe(true));
        expect(result.current).toBe(false);
    });

    it("build-time env var short-circuits per-kind to true", () => {
        vi.stubEnv("VITE_USE_V3_CHAT", "true");
        const { result } = renderHook(() => useV3ChatEnabledForKind(ChannelKind.PM));
        expect(result.current).toBe(true);
    });
});
