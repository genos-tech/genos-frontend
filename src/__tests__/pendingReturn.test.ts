import { beforeEach, describe, expect, it } from "vitest";

import { isAllowedReturn, rememberReturn, takeReturn } from "../utils/pendingReturn";

beforeEach(() => sessionStorage.clear());

describe("pendingReturn", () => {
    it("remembers the consent request with its query and gives it back once", () => {
        const path =
            "/oauth/consent?client_id=abc&state=x%20y&redirect_uri=https%3A%2F%2Fa.test%2Fcb";
        rememberReturn(path);
        expect(takeReturn()).toBe(path);
        expect(takeReturn()).toBeNull();
    });

    it("returns nothing when nothing was remembered", () => {
        expect(takeReturn()).toBeNull();
    });

    it("only ever remembers the consent page", () => {
        for (const bad of [
            "/workspace/genos",
            "/oauth/consent/../workspace",
            "/oauth/consentx",
            "/signin",
            "https://evil.example/oauth/consent",
            "//evil.example/oauth/consent",
            "/\\evil.example",
            "javascript:alert(1)",
            "/oauth/consent\n?x=1",
            "",
        ]) {
            expect(isAllowedReturn(bad), bad).toBe(false);
            rememberReturn(bad);
            expect(takeReturn(), bad).toBeNull();
        }
    });

    it("does not trust a value planted in storage", () => {
        sessionStorage.setItem("genos-pending-return", "https://evil.example/");
        expect(takeReturn()).toBeNull();
        sessionStorage.setItem("genos-pending-return", "//evil.example/oauth/consent");
        expect(takeReturn()).toBeNull();
    });

    it("clears a planted value even though it refuses it", () => {
        sessionStorage.setItem("genos-pending-return", "/workspace");
        takeReturn();
        expect(sessionStorage.getItem("genos-pending-return")).toBeNull();
    });
});
