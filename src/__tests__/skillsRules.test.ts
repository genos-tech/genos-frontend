/**
 * The pure rules of the Skills page (MIP-2041): names, tags, the draft's diff and checks, and
 * how the API's answers are read. The server stays the judge; these only have to agree with it.
 */
import { describe, expect, it } from "vitest";

import {
    draftChanges,
    draftFrom,
    hasProblems,
    isDirty,
    validateDraft,
} from "../features/genos/skills/skillDraft";
import {
    parseSkill,
    parseSkillList,
    SKILL_LIMITS,
    type SkillRow,
} from "../features/genos/skills/skillsApi";
import {
    normalizeTag,
    slugify,
    slugProblem,
    tagProblem,
    templateBody,
} from "../features/genos/skills/skillText";

const row = (over: Partial<SkillRow> = {}): SkillRow => ({
    id: "s1",
    teamId: "t1",
    slug: "weekly-update",
    title: "Weekly update",
    description: "Summarise the week",
    tags: ["weekly"],
    icon: "⚡",
    argumentHint: "[project]",
    toolLevel: "read",
    effort: "",
    visibility: "private",
    status: "active",
    moderationReason: "",
    currentVersionNo: 1,
    publishedVersionNo: 0,
    createdAt: "2026-11-20T10:00:00Z",
    updatedAt: "2026-11-21T10:00:00Z",
    publishedAt: null,
    mine: true,
    role: "owner",
    canEdit: true,
    canManage: true,
    canHide: false,
    hiddenByTeam: false,
    ownerName: "ken",
    author: null,
    starCount: 0,
    runCount30d: 0,
    copyCount: 0,
    isOfficial: false,
    starred: false,
    sourceHarmful: false,
    editors: [],
    forkedFrom: null,
    noteId: 12,
    hasUnpublishedChanges: false,
    unpublishedChanges: [],
    ...over,
});

describe("slugify", () => {
    it("makes a name from a title", () => {
        expect(slugify("Weekly update")).toBe("weekly-update");
        expect(slugify("  Café — Plan: my day!  ")).toBe("cafe-plan-my-day");
    });
    it("caps the length and never ends on a hyphen", () => {
        const slug = slugify("a".repeat(30) + " " + "b".repeat(30));
        expect(slug.length).toBeLessThanOrEqual(SKILL_LIMITS.slugMax);
        expect(slug.endsWith("-")).toBe(false);
    });
    it("gives nothing for a title with no usable letters, so the form asks for a name", () => {
        expect(slugify("週次レポート")).toBe("");
        expect(slugify("a")).toBe("");
    });
});

describe("slugProblem", () => {
    it.each([
        ["", "empty"],
        ["a", "length"],
        ["x".repeat(41), "length"],
        ["Weekly Update", "chars"],
        ["weekly--update", "chars"],
        ["-weekly", "chars"],
        ["help", "reserved"],
        ["catch-me-up", "reserved"],
    ])("%j is %s", (value, problem) => {
        expect(slugProblem(value)).toBe(problem);
    });
    it("accepts a good name, in any case", () => {
        expect(slugProblem("weekly-update")).toBeNull();
        expect(slugProblem("Weekly-Update")).toBeNull();
    });
});

describe("tags", () => {
    it("lower-cases and trims", () => {
        expect(normalizeTag("  Weekly ")).toBe("weekly");
    });
    it("refuses characters, length and the sixth tag", () => {
        expect(tagProblem("two words", [])).toBe("chars");
        expect(tagProblem("x".repeat(25), [])).toBe("chars");
        expect(tagProblem("six", ["a", "b", "c", "d", "e"])).toBe("tooMany");
        expect(tagProblem("a", ["a", "b", "c", "d", "e"])).toBeNull();
        expect(tagProblem("ok-tag", [])).toBeNull();
    });
});

describe("templateBody", () => {
    it("has the runbook sections in the given words", () => {
        const body = templateBody("Weekly update", {
            youGet: "You get: x",
            input: "Input",
            inputHint: "i",
            steps: "Steps",
            stepsHint: "s",
            output: "Output",
            outputHint: "o",
            never: "Never",
            neverHint: "n",
        });
        expect(body.startsWith("# Weekly update\nYou get: x")).toBe(true);
        expect(body).toContain("## Steps\n1. s");
        expect(body).toContain("## Never\n- n");
        expect(body.length).toBeLessThan(SKILL_LIMITS.bodyMax);
    });
});

describe("the draft", () => {
    it("is clean when nothing was typed", () => {
        const skill = row();
        expect(isDirty(draftFrom(skill), skill)).toBe(false);
    });
    it("sends only what changed, trimmed", () => {
        const skill = row();
        const draft = { ...draftFrom(skill), title: "  New title ", tags: ["weekly", "ops"] };
        expect(draftChanges(draft, skill)).toEqual({
            title: "New title",
            tags: ["weekly", "ops"],
        });
    });
    it("reads a public skill as private (this page never makes one public)", () => {
        expect(draftFrom(row({ visibility: "public" })).visibility).toBe("private");
    });
    it("names what stops a save", () => {
        const draft = { ...draftFrom(row()), title: " ", slug: "help" };
        expect(validateDraft(draft)).toEqual({ title: "empty", slug: "reserved" });
        expect(hasProblems(validateDraft(draftFrom(row())))).toBe(false);
    });
});

describe("reading the API", () => {
    it("drops what is not a skill and bounds what is", () => {
        expect(parseSkill(null)).toBeNull();
        expect(parseSkill({ title: "no id" })).toBeNull();
        const skill = parseSkill({
            id: "a",
            title: "T",
            toolLevel: "root",
            effort: "extreme",
            visibility: "world",
            noteId: "12",
            tags: ["ok", 3, ""],
        });
        expect(skill?.toolLevel).toBe("read");
        expect(skill?.effort).toBe("");
        expect(skill?.visibility).toBe("private");
        expect(skill?.noteId).toBeNull();
        expect(skill?.tags).toEqual(["ok"]);
    });
    it("reads the unpublished-changes flag as a strict boolean, and the field names as strings", () => {
        const none = parseSkill({ id: "a" });
        expect(none?.hasUnpublishedChanges).toBe(false);
        expect(none?.unpublishedChanges).toEqual([]);
        const odd = parseSkill({
            id: "a",
            hasUnpublishedChanges: "yes",
            unpublishedChanges: "title",
        });
        expect(odd?.hasUnpublishedChanges).toBe(false);
        expect(odd?.unpublishedChanges).toEqual([]);
        const some = parseSkill({
            id: "a",
            hasUnpublishedChanges: true,
            unpublishedChanges: ["title", 3, "", "bodyMarkdown"],
        });
        expect(some?.hasUnpublishedChanges).toBe(true);
        expect(some?.unpublishedChanges).toEqual(["title", "bodyMarkdown"]);
    });
    it("reads the list with its limit (null = unlimited)", () => {
        expect(parseSkillList({ skills: [{ id: "a" }, "junk"], limit: null, used: 2 })).toEqual(
            expect.objectContaining({ limit: null, used: 2, skills: [expect.anything()] })
        );
        expect(parseSkillList({ nope: true })).toBeNull();
        expect(parseSkillList({ skills: [], limit: 3, used: 3 })?.limit).toBe(3);
    });
});
