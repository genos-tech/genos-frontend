import { describe, expect, it } from "vitest";

import { withAvatarVersion } from "../utils/avatarSrc";

describe("withAvatarVersion (MIP-1472)", () => {
    it("adds nothing before an upload, or without a picture", () => {
        expect(withAvatarVersion("https://m.example/a.png", 0)).toBe("https://m.example/a.png");
        expect(withAvatarVersion(undefined, 3)).toBeUndefined();
    });

    it("adds ?v= after an upload, and & when the URL already has a query", () => {
        expect(withAvatarVersion("https://m.example/a.png", 2)).toBe(
            "https://m.example/a.png?v=2"
        );
        expect(withAvatarVersion("https://m.example/a.png?s=1", 2)).toBe(
            "https://m.example/a.png?s=1&v=2"
        );
    });
});
