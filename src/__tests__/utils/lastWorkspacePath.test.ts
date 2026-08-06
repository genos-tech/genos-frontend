import { beforeEach, describe, expect, it } from "vitest";

import {
    getDefaultWorkspacePath,
    getLastWorkspacePath,
    resolveLoggedInLandingPath,
    saveLastWorkspacePath,
} from "../../utils/lastWorkspacePath";

describe("lastWorkspacePath", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("ignores non-workspace paths", () => {
        saveLastWorkspacePath("/signin");
        saveLastWorkspacePath("/jointeam");
        expect(getLastWorkspacePath()).toBeNull();
    });

    it("remembers a workspace path", () => {
        saveLastWorkspacePath("/workspace/notes/my/1");
        expect(getLastWorkspacePath()).toBe("/workspace/notes/my/1");
    });

    it("lands on /jointeam when signed in but teamless", () => {
        localStorage.setItem("isSigningIn", "yes");
        expect(resolveLoggedInLandingPath()).toBe("/jointeam");
    });

    it("prefers the last workspace path when a team is set", () => {
        localStorage.setItem("teamId", "t1");
        saveLastWorkspacePath("/workspace/chat/dm/abc");
        expect(resolveLoggedInLandingPath()).toBe("/workspace/chat/dm/abc");
    });

    it("falls back to Genos home when no last path is stored", () => {
        localStorage.setItem("teamId", "t1");
        expect(resolveLoggedInLandingPath()).toBe(getDefaultWorkspacePath());
    });
});
