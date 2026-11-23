/**
 * The words a skill is made of, as the server checks them (genos-api `services/skills/text.py`),
 * so the form can say what is wrong before it asks. The server stays the judge: every rule here
 * is only an early answer, and a refusal the server still sends is shown as written.
 */

import { SKILL_LIMITS } from "./skillsApi";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TAG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Names a person cannot take: the `/` picker's own commands and the MCP prompts' names. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
    "help",
    "new",
    "clear",
    "schedule",
    "skills",
    "hub",
    "settings",
    "catch-me-up",
    "catch_me_up",
    "plan-my-day",
    "plan_my_day",
]);

/** A valid-looking slug from a title (the server's `slugify`: ASCII only). Empty when the title
 *  has no letters or digits the name can use (a Japanese title), so the form asks for a name. */
export const slugify = (title: string): string => {
    const folded = title.normalize("NFKD").replace(/[^ -~]/g, "");
    const slug = folded
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, SKILL_LIMITS.slugMax)
        .replace(/-+$/g, "");
    return slug.length >= SKILL_LIMITS.slugMin ? slug : "";
};

export type SlugProblem = "empty" | "length" | "chars" | "reserved";

/** What is wrong with a typed name, or null. The empty name is its own answer: the form shows
 *  it as "required" only after the person has had a chance to type. */
export const slugProblem = (value: string): SlugProblem | null => {
    const slug = value.trim().toLowerCase();
    if (slug === "") return "empty";
    if (slug.length < SKILL_LIMITS.slugMin || slug.length > SKILL_LIMITS.slugMax) return "length";
    if (!SLUG_RE.test(slug)) return "chars";
    if (RESERVED_SLUGS.has(slug)) return "reserved";
    return null;
};

export type TagProblem = "chars" | "tooMany";

/** Lower-cases, drops blanks and repeats. */
export const normalizeTag = (raw: string): string => raw.trim().toLowerCase();

export const tagProblem = (tag: string, existing: readonly string[]): TagProblem | null => {
    if (tag.length > SKILL_LIMITS.tagMax || !TAG_RE.test(tag)) return "chars";
    if (!existing.includes(tag) && existing.length >= SKILL_LIMITS.tagsMax) return "tooMany";
    return null;
};

/** The body of a new skill made from the template (the design's runbook shape), in the words of
 *  the person's language. */
export type TemplateWords = {
    youGet: string;
    input: string;
    inputHint: string;
    steps: string;
    stepsHint: string;
    output: string;
    outputHint: string;
    never: string;
    neverHint: string;
};

export const templateBody = (title: string, w: TemplateWords): string =>
    [
        `# ${title.trim() || "…"}`,
        w.youGet,
        "",
        `## ${w.input}`,
        `- ${w.inputHint}`,
        "",
        `## ${w.steps}`,
        `1. ${w.stepsHint}`,
        "",
        `## ${w.output}`,
        w.outputHint,
        "",
        `## ${w.never}`,
        `- ${w.neverHint}`,
        "",
    ].join("\n");
