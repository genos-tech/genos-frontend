/**
 * The client's side of `POST /skills/<id>/report/` (MIP-2044): the request it sends and how it
 * reads each answer the server can give.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { isModerated, parseSkill, reportSkill } from "../features/genos/skills/skillsApi";
import { authApi } from "../services/api";

vi.mock("../services/api", () => ({ authApi: vi.fn() }));

const post = vi.fn();

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi).mockReturnValue({ post } as unknown as ReturnType<typeof authApi>);
});

const refused = (status: number, data: Record<string, unknown>) =>
    Object.assign(new Error("x"), { response: { status, data } });

describe("reportSkill", () => {
    it("posts the reason and a trimmed note, and says whether it was new", async () => {
        post.mockResolvedValueOnce({ status: 201, data: { reported: true } });
        const res = await reportSkill("tok", "a b", "harmful", "  sends my notes out  ");
        expect(post).toHaveBeenCalledWith(
            "/skills/a%20b/report/",
            { reason: "harmful", note: "sends my notes out" },
            { suppressErrorToast: true }
        );
        expect(res).toEqual({ ok: true, data: { created: true } });
        post.mockResolvedValueOnce({ status: 200, data: { reported: true } });
        expect(await reportSkill("tok", "s1", "spam", "")).toEqual({
            ok: true,
            data: { created: false },
        });
    });

    it("never sends more than the server accepts", async () => {
        post.mockResolvedValueOnce({ status: 201, data: {} });
        await reportSkill("tok", "s1", "other", "x".repeat(5000));
        expect(post.mock.calls[0][1].note).toHaveLength(1000);
    });

    it("reads the daily limit apart from other refusals", async () => {
        post.mockRejectedValueOnce(
            refused(429, { code: "report_limit", error: "You can send 20 reports a day." })
        );
        expect(await reportSkill("tok", "s1", "spam", "")).toMatchObject({
            ok: false,
            reason: "report_limit",
        });
        post.mockRejectedValueOnce(refused(404, { error: "Skill not found." }));
        expect(await reportSkill("tok", "s1", "spam", "")).toMatchObject({
            ok: false,
            reason: "off",
        });
        post.mockRejectedValueOnce(refused(400, { error: "This is your own skill." }));
        expect(await reportSkill("tok", "s1", "spam", "")).toMatchObject({
            ok: false,
            reason: "bad_input",
            message: "This is your own skill.",
        });
    });

    it("does nothing without a session", async () => {
        vi.mocked(authApi).mockReturnValue(null as unknown as ReturnType<typeof authApi>);
        expect(await reportSkill(null, "s1", "spam", "")).toMatchObject({ ok: false });
        expect(post).not.toHaveBeenCalled();
    });
});

describe("moderation state", () => {
    it("knows the three states an operator or the check puts a skill in", () => {
        expect(["in_review", "reported_hidden", "taken_down"].every(isModerated)).toBe(true);
        expect(["active", "hidden_by_team", ""].some(isModerated)).toBe(false);
    });

    it("reads the author's reason as untrusted text", () => {
        const row = parseSkill({
            id: "s1",
            status: "taken_down",
            moderationReason: "x".repeat(900),
        });
        expect(row?.moderationReason).toHaveLength(600);
        expect(parseSkill({ id: "s1", moderationReason: 5 })?.moderationReason).toBe("");
    });
});
