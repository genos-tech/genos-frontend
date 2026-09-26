import { beforeEach, describe, expect, it, vi } from "vitest";

import { demoSignIn } from "../features/admin/services/demoSignin";
import { nonAuthApi } from "../services/api";

vi.mock("../services/api", () => ({
    nonAuthApi: vi.fn(),
}));

/** Capture the POST body `demoSignIn` sends. */
const mockPost = () => {
    const post = vi.fn().mockResolvedValue({ data: { access: "t", team_id: "1" } });
    (nonAuthApi as ReturnType<typeof vi.fn>).mockReturnValue({ post });
    return post;
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("demoSignIn — the language the workspace is seeded in", () => {
    it("asks for a Japanese workspace when the app is in Japanese", () => {
        // The whole point of the feature: 3 months of seeded chat, tasks and
        // notes in Japanese. The seeding is synchronous inside this request,
        // so there is no second chance to get this right.
        const post = mockPost();
        void demoSignIn(undefined, "ja");
        expect(post).toHaveBeenCalledWith("/user/demo/", { lang: "ja" });
    });

    it("asks for an English workspace when the app is in English", () => {
        const post = mockPost();
        void demoSignIn(undefined, "en");
        expect(post).toHaveBeenCalledWith("/user/demo/", { lang: "en" });
    });

    it("omits lang for a locale with no demo content table", () => {
        // `fr` has no seeder table. Sending `{lang: "fr"}` would be wrong, but
        // so would sending `{lang: "en"}` — an empty body lets the API apply
        // its own `Accept-Language` fallback, which knows more than we do.
        const post = mockPost();
        void demoSignIn(undefined, "fr");
        expect(post).toHaveBeenCalledWith("/user/demo/", {});
    });

    it("omits lang when no locale is passed at all", () => {
        const post = mockPost();
        void demoSignIn();
        expect(post).toHaveBeenCalledWith("/user/demo/", {});
    });
});
