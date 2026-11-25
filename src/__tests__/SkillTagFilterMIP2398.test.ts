/**
 * MIP-2398: the tag filter of the skill pickers, and the tags the runnable list now carries.
 * Pure: which tags are offered, in what order, and which skills carry all the ticked ones.
 */
import { describe, expect, it } from "vitest";

import { parseRunnableSkills, type RunnableSkill } from "../features/genos/skills/skillsApi";
import { filterByTags, tagChoices, toggleTag } from "../features/genos/skills/skillTagFilter";

const chip = (name: string, color = "#808080") => ({ name, color, textColor: "white" });
const row = (id: string, names: string[]): RunnableSkill => ({
    id,
    slug: id,
    title: id,
    description: "",
    group: "mine",
    ownerName: "",
    publishedVersionNo: 1,
    tagChips: names.map((n) => chip(n)),
});

describe("the tags offered", () => {
    it("lists each tag once, template first, then the rest by name", () => {
        const rows = [
            row("a", ["product", "template"]),
            row("b", ["sales", "product"]),
            row("c", []),
        ];
        expect(tagChoices(rows).map((c) => c.name)).toEqual(["template", "product", "sales"]);
    });

    it("keeps the first colour a tag came with", () => {
        const rows = [
            { ...row("a", []), tagChips: [chip("reports", "#ff2323")] },
            { ...row("b", []), tagChips: [chip("reports", "#0044c2")] },
        ];
        expect(tagChoices(rows)[0].color).toBe("#ff2323");
    });

    it("is empty when no skill has a tag", () => {
        expect(tagChoices([row("a", []), row("b", [])])).toEqual([]);
    });
});

describe("filtering", () => {
    const rows = [
        row("a", ["template", "product"]),
        row("b", ["template", "sales"]),
        row("c", ["product"]),
        row("d", []),
    ];

    it("shows every skill when nothing is ticked", () => {
        expect(filterByTags(rows, []).map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
    });

    it("keeps the skills that carry the ticked tag", () => {
        expect(filterByTags(rows, ["template"]).map((r) => r.id)).toEqual(["a", "b"]);
    });

    it("narrows with each further tag: a skill must carry ALL of them", () => {
        expect(filterByTags(rows, ["template", "product"]).map((r) => r.id)).toEqual(["a"]);
        expect(filterByTags(rows, ["sales", "product"])).toEqual([]);
    });

    it("never drops the skill that is already chosen", () => {
        expect(filterByTags(rows, ["sales"], "d").map((r) => r.id)).toEqual(["b", "d"]);
    });

    it("ticks and unticks a tag", () => {
        expect(toggleTag([], "template")).toEqual(["template"]);
        expect(toggleTag(["template", "sales"], "template")).toEqual(["sales"]);
    });
});

describe("the runnable list's tags", () => {
    const base = {
        id: "k1",
        slug: "weekly",
        title: "Weekly",
        group: "official",
        publishedVersionNo: 1,
    };

    it("reads the server's chips", () => {
        const [skill] = parseRunnableSkills({
            skills: [{ ...base, tags: ["template"], tagChips: [chip("template", "#6a5acd")] }],
        })!;
        expect(skill.tagChips).toEqual([chip("template", "#6a5acd")]);
    });

    it("falls back to grey chips from the names when only tags arrive", () => {
        const [skill] = parseRunnableSkills({ skills: [{ ...base, tags: ["a", " ", "b"] }] })!;
        expect(skill.tagChips.map((c) => c.name)).toEqual(["a", "b"]);
    });

    it("has no chips from a server that predates tags", () => {
        const [skill] = parseRunnableSkills({ skills: [base] })!;
        expect(skill.tagChips).toEqual([]);
    });

    it("drops a chip with no name", () => {
        const [skill] = parseRunnableSkills({
            skills: [{ ...base, tagChips: [{ name: "", color: "#ff2323" }, chip("ok")] }],
        })!;
        expect(skill.tagChips.map((c) => c.name)).toEqual(["ok"]);
    });
});
