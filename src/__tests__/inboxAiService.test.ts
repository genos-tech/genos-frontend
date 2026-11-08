/**
 * MIP-1227: the off switch's service. It must read genos-api's answers as they are: Undo is only
 * honest when the source WAS on, a deleted schedule is a 404 "no longer exists", the plan refusal
 * is a 403 `plan_required`, and none of it raises the global error toast.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { switchInboxAi } from "../features/inbox/services/inboxAi";

const post = vi.hoisted(() => vi.fn());
vi.mock("../services/api", () => ({
    authApi: (token: string | null) => (token ? { post } : null),
}));

const reject = (status: number, data: unknown) => Promise.reject({ response: { status, data } });

describe("switchInboxAi", () => {
    beforeEach(() => post.mockReset());

    it("posts to the item's own off and on endpoints, silently", async () => {
        post.mockResolvedValue({ data: { enabled: false, was_enabled: true } });
        await switchInboxAi("tok", 812, false);
        await switchInboxAi("tok", 812, true);
        expect(post).toHaveBeenNthCalledWith(1, "/inbox/812/ai/off/", undefined, {
            suppressErrorToast: true,
        });
        expect(post).toHaveBeenNthCalledWith(2, "/inbox/812/ai/on/", undefined, {
            suppressErrorToast: true,
        });
    });

    it("reports was_enabled only when the server said true", async () => {
        post.mockResolvedValueOnce({ data: { was_enabled: true } });
        expect(await switchInboxAi("tok", 1, false)).toEqual({
            ok: true,
            enabled: false,
            wasEnabled: true,
        });
        post.mockResolvedValueOnce({ data: { was_enabled: false } });
        expect(await switchInboxAi("tok", 1, false)).toMatchObject({ wasEnabled: false });
        post.mockResolvedValueOnce({ data: {} });
        expect(await switchInboxAi("tok", 1, false)).toMatchObject({ wasEnabled: false });
        post.mockResolvedValueOnce({ data: { was_enabled: "true" } });
        expect(await switchInboxAi("tok", 1, false)).toMatchObject({ wasEnabled: false });
    });

    it("a deleted schedule is `gone`", async () => {
        post.mockImplementationOnce(() =>
            reject(404, { error: "The schedule that made this report no longer exists." })
        );
        expect(await switchInboxAi("tok", 1, false)).toMatchObject({ ok: false, reason: "gone" });
    });

    it("an item that is not the member's (404) is a plain error with no sentence", async () => {
        post.mockImplementationOnce(() => reject(404, { error: "Inbox item not found." }));
        expect(await switchInboxAi("tok", 1, false)).toEqual({
            ok: false,
            reason: "error",
            error: null,
        });
    });

    it("403 or code plan_required is `plan`", async () => {
        post.mockImplementationOnce(() =>
            reject(403, {
                error: "Scheduled reports are part of the Core plan.",
                code: "plan_required",
            })
        );
        expect(await switchInboxAi("tok", 1, true)).toMatchObject({ ok: false, reason: "plan" });
        post.mockImplementationOnce(() => reject(400, { error: "x", code: "plan_required" }));
        expect(await switchInboxAi("tok", 1, true)).toMatchObject({ ok: false, reason: "plan" });
    });

    it("a bare 403 is `plan` too", async () => {
        post.mockImplementationOnce(() => reject(403, {}));
        expect(await switchInboxAi("tok", 1, true)).toMatchObject({ ok: false, reason: "plan" });
    });

    it("a 400 sentence is passed on; a network failure has none", async () => {
        post.mockImplementationOnce(() => reject(400, { error: "Something plain." }));
        expect(await switchInboxAi("tok", 1, true)).toEqual({
            ok: false,
            reason: "error",
            error: "Something plain.",
        });
        post.mockImplementationOnce(() => Promise.reject(new Error("offline")));
        expect(await switchInboxAi("tok", 1, true)).toEqual({
            ok: false,
            reason: "error",
            error: null,
        });
    });

    it("makes no call without a session", async () => {
        expect(await switchInboxAi(null, 1, false)).toMatchObject({ ok: false });
        expect(post).not.toHaveBeenCalled();
    });
});
