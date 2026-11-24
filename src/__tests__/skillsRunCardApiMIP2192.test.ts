/**
 * The client's side of the Skills safety follow-ups (MIP-2192): the first-run card, the confirm, the
 * update diff and the accepted update. Every body is untrusted, so what is pinned is the strict
 * reading of each answer and the exact request each call sends.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    acceptSkillUpdate,
    confirmSkillRun,
    fetchRunCard,
    fetchUpdateDiff,
    parseRunCard,
    parseSkill,
    parseUpdateDiff,
} from "../features/genos/skills/skillsApi";
import { authApi } from "../services/api";

vi.mock("../services/api", () => ({ authApi: vi.fn() }));

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi).mockReturnValue({ get, post, patch } as unknown as ReturnType<
        typeof authApi
    >);
});

const refused = (status: number, data: Record<string, unknown>) =>
    Object.assign(new Error("x"), { response: { status, data } });

const CARD = {
    skillId: "s1",
    versionNo: 3,
    slug: "weekly",
    title: "Weekly update",
    bodyMarkdown: "Summarise the week.\n![x](https://evil.example/p.png)",
    toolLevel: "act",
    mayPropose: ["create_task", "create_note", "create_todo_item"],
    author: { handle: "ayumi", displayName: "Ayumi" },
    outside: true,
    harmful: false,
    confirmed: false,
};

describe("parseRunCard", () => {
    it("reads a whole card and never cuts or rewrites the text", () => {
        const long = "x".repeat(60_000);
        const card = parseRunCard({ ...CARD, bodyMarkdown: long });
        expect(card?.bodyMarkdown).toBe(long);
        expect(parseRunCard(CARD)).toMatchObject({
            skillId: "s1",
            versionNo: 3,
            toolLevel: "act",
            mayPropose: ["create_task", "create_note", "create_todo_item"],
            author: { handle: "ayumi", displayName: "Ayumi" },
            outside: true,
            harmful: false,
            confirmed: false,
        });
    });

    it("keeps only the three tools an outside skill may propose", () => {
        const card = parseRunCard({
            ...CARD,
            mayPropose: ["create_task", "delete_note", 5, "update_task", "create_note"],
        });
        expect(card?.mayPropose).toEqual(["create_task", "create_note"]);
        expect(parseRunCard({ ...CARD, mayPropose: "create_task" })?.mayPropose).toEqual([]);
    });

    it("refuses a card that cannot name its version or has no text", () => {
        expect(parseRunCard(null)).toBeNull();
        expect(parseRunCard({ ...CARD, skillId: "" })).toBeNull();
        expect(parseRunCard({ ...CARD, versionNo: "3" })).toBeNull();
        expect(parseRunCard({ ...CARD, versionNo: -1 })).toBeNull();
        expect(parseRunCard({ ...CARD, versionNo: 1.5 })).toBeNull();
        expect(parseRunCard({ ...CARD, bodyMarkdown: undefined })).toBeNull();
        // Version 0 is a real version number.
        expect(parseRunCard({ ...CARD, versionNo: 0 })?.versionNo).toBe(0);
    });

    it("reads flags strictly and an unknown author as none", () => {
        const card = parseRunCard({
            ...CARD,
            author: { displayName: "No handle" },
            outside: "yes",
            harmful: 1,
            confirmed: "true",
            toolLevel: "root",
        });
        expect(card).toMatchObject({
            author: null,
            outside: false,
            harmful: false,
            confirmed: false,
            toolLevel: "read",
        });
    });
});

describe("fetchRunCard", () => {
    it("asks for the card of one team and version", async () => {
        get.mockResolvedValueOnce({ data: { card: CARD } });
        const res = await fetchRunCard("tok", "a b", "team-1", 3);
        expect(get).toHaveBeenCalledWith("/skills/a%20b/run-card/", {
            suppressErrorToast: true,
            params: { teamId: "team-1", versionNo: 3 },
        });
        expect(res).toMatchObject({ ok: true, data: { skillId: "s1", versionNo: 3 } });
    });

    it("reads 404 as gone and 403 as the server's sentence", async () => {
        get.mockRejectedValueOnce(refused(404, { error: "Skill not found." }));
        expect(await fetchRunCard("tok", "s1", "t", 1)).toMatchObject({
            ok: false,
            reason: "off",
        });
        get.mockRejectedValueOnce(
            refused(403, { error: "Install this skill before you run it." })
        );
        expect(await fetchRunCard("tok", "s1", "t", 1)).toMatchObject({
            ok: false,
            reason: "bad_input",
            message: "Install this skill before you run it.",
        });
        get.mockResolvedValueOnce({ data: { card: { skillId: "s1" } } });
        expect(await fetchRunCard("tok", "s1", "t", 1)).toMatchObject({ ok: false });
    });
});

describe("confirmSkillRun", () => {
    it("posts the team and the version the person read", async () => {
        post.mockResolvedValueOnce({
            data: { confirmed: true, versionNo: 3, outside: true, harmful: false },
        });
        const res = await confirmSkillRun("tok", "s1", "team-1", 3);
        expect(post).toHaveBeenCalledWith(
            "/skills/s1/confirm/",
            { teamId: "team-1", versionNo: 3 },
            { suppressErrorToast: true }
        );
        expect(res).toEqual({
            ok: true,
            data: { versionNo: 3, outside: true, harmful: false },
        });
    });

    it("is not a confirmation unless the server says confirmed", async () => {
        post.mockResolvedValueOnce({ data: { confirmed: false } });
        expect(await confirmSkillRun("tok", "s1", "t", 0)).toMatchObject({ ok: false });
        post.mockRejectedValueOnce(refused(400, { error: "versionNo is required." }));
        expect(await confirmSkillRun("tok", "s1", "t", 1)).toMatchObject({
            ok: false,
            reason: "bad_input",
        });
    });
});

const DIFF = {
    fromVersionNo: 1,
    toVersionNo: 3,
    upToDate: false,
    changes: [
        { field: "title", from: "Weekly", to: "Weekly update" },
        { field: "tags", from: ["a"], to: ["a", "b"] },
        { field: "toolLevel", from: "read", to: "act" },
        { field: "owner", from: "x", to: "y" },
    ],
    toolLevelRaised: true,
    changelogs: [
        { versionNo: 2, changelog: "Fixed a typo" },
        { versionNo: 3, changelog: "Can now propose tasks" },
    ],
    diff: "--- v1\n+++ v3\n@@ -1 +1 @@\n-old\n+new\n",
    truncated: true,
    needsConfirmation: true,
};

describe("parseUpdateDiff", () => {
    it("reads every part, drops an unknown field and joins tags as text", () => {
        const diff = parseUpdateDiff(DIFF);
        expect(diff).toMatchObject({
            fromVersionNo: 1,
            toVersionNo: 3,
            upToDate: false,
            toolLevelRaised: true,
            truncated: true,
            needsConfirmation: true,
            diff: DIFF.diff,
        });
        expect(diff?.changes).toEqual([
            { field: "title", from: "Weekly", to: "Weekly update" },
            { field: "tags", from: "a", to: "a, b" },
            { field: "toolLevel", from: "read", to: "act" },
        ]);
        expect(diff?.changelogs).toHaveLength(2);
    });

    it("refuses a body without both version numbers and reads flags strictly", () => {
        expect(parseUpdateDiff({ ...DIFF, toVersionNo: undefined })).toBeNull();
        expect(parseUpdateDiff([])).toBeNull();
        expect(
            parseUpdateDiff({ ...DIFF, toolLevelRaised: "true", truncated: 1, upToDate: "yes" })
        ).toMatchObject({ toolLevelRaised: false, truncated: false, upToDate: false });
        expect(
            parseUpdateDiff({ ...DIFF, diff: 5, changes: "x", changelogs: null })
        ).toMatchObject({
            diff: "",
            changes: [],
            changelogs: [],
        });
    });
});

describe("fetchUpdateDiff and acceptSkillUpdate", () => {
    it("reads the diff of an installed skill", async () => {
        get.mockResolvedValueOnce({ data: DIFF });
        const res = await fetchUpdateDiff("tok", "s 1");
        expect(get).toHaveBeenCalledWith("/skills/s%201/update-diff/", {
            suppressErrorToast: true,
        });
        expect(res).toMatchObject({ ok: true, data: { toVersionNo: 3 } });
        get.mockRejectedValueOnce(refused(404, { error: "Not installed." }));
        expect(await fetchUpdateDiff("tok", "s1")).toMatchObject({ ok: false, reason: "off" });
    });

    it("installs exactly the version the diff ended at", async () => {
        patch.mockResolvedValueOnce({ data: { installedVersionNo: 3 } });
        const res = await acceptSkillUpdate("tok", "s1", 3);
        expect(patch).toHaveBeenCalledWith(
            "/skills/s1/install/",
            { versionNo: 3 },
            { suppressErrorToast: true }
        );
        expect(res).toEqual({ ok: true, data: { installedVersionNo: 3 } });
    });

    it("maps 409 update_moved to a failure that carries the code", async () => {
        patch.mockRejectedValueOnce(
            refused(409, { error: "A newer version exists.", code: "update_moved" })
        );
        expect(await acceptSkillUpdate("tok", "s1", 3)).toMatchObject({
            ok: false,
            reason: "conflict",
            code: "update_moved",
        });
        patch.mockResolvedValueOnce({ data: {} });
        expect(await acceptSkillUpdate("tok", "s1", 3)).toMatchObject({ ok: false });
    });
});

describe("sourceHarmful on a skill row", () => {
    it("is true only when the server says so, false when absent", () => {
        const row = { id: "s1", title: "x" };
        expect(parseSkill(row)?.sourceHarmful).toBe(false);
        expect(parseSkill({ ...row, sourceHarmful: true })?.sourceHarmful).toBe(true);
        expect(parseSkill({ ...row, sourceHarmful: "true" })?.sourceHarmful).toBe(false);
    });
});
