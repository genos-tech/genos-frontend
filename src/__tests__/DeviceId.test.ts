/**
 * The device id ties a push subscription to its own presence heartbeat.
 * If it isn't stable across reloads, the server sees a new device every
 * time and never suppresses the tab you're actually looking at — so
 * stability is the property worth pinning, not the format.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { getDeviceId } from "../utils/deviceId";

describe("getDeviceId", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("returns the same id across calls (survives reloads)", () => {
        const first = getDeviceId();
        expect(first).toBeTruthy();
        expect(getDeviceId()).toBe(first);
    });

    it("persists under a stable storage key so a reload reuses it", () => {
        const id = getDeviceId();
        expect(localStorage.getItem("genos.deviceId")).toBe(id);
    });

    it("adopts an id already in storage rather than minting a new one", () => {
        localStorage.setItem("genos.deviceId", "existing-device");
        expect(getDeviceId()).toBe("existing-device");
    });
});
