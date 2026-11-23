/**
 * The details form's state, apart from the screen: what the person has typed (`SkillDraft`),
 * what differs from the saved skill (`draftChanges`), and what is wrong with it
 * (`validateDraft`), so each can be tested without drawing anything.
 */

import {
    SKILL_LIMITS,
    type SkillEffort,
    type SkillInput,
    type SkillRow,
    type SkillShare,
    type SkillVisibility,
    type ToolLevel,
} from "./skillsApi";
import { slugProblem, tagProblem, type SlugProblem, type TagProblem } from "./skillText";

export type SkillDraft = {
    title: string;
    slug: string;
    description: string;
    tags: string[];
    icon: string;
    argumentHint: string;
    toolLevel: ToolLevel;
    effort: SkillEffort;
    visibility: SkillVisibility;
    /** Who a "specific" skill is shared with (kept while another choice is selected, so a
     *  mis-click does not lose the list). */
    shares: SkillShare[];
};

export const draftFrom = (skill: SkillRow): SkillDraft => ({
    title: skill.title,
    slug: skill.slug,
    description: skill.description,
    tags: [...skill.tags],
    icon: skill.icon,
    argumentHint: skill.argumentHint,
    toolLevel: skill.toolLevel,
    effort: skill.effort,
    // A public skill is not made on this page: it reads as the nearest thing it can set.
    visibility:
        skill.visibility === "team" || skill.visibility === "specific"
            ? skill.visibility
            : "private",
    shares: skill.shares.map((s) => ({ ...s })),
});

/** The identity of a share, for comparing two lists. */
export const shareKey = (s: Pick<SkillShare, "kind" | "id">): string => `${s.kind}:${s.id}`;

/** Only the fields that differ from the saved skill, as the API takes them. Empty = clean. */
export const draftChanges = (draft: SkillDraft, skill: SkillRow): SkillInput => {
    const saved = draftFrom(skill);
    const out: SkillInput = {};
    if (draft.title.trim() !== saved.title) out.title = draft.title.trim();
    if (draft.slug.trim().toLowerCase() !== saved.slug) out.slug = draft.slug.trim().toLowerCase();
    if (draft.description.trim() !== saved.description) out.description = draft.description.trim();
    if (draft.tags.join("\n") !== saved.tags.join("\n")) out.tags = draft.tags;
    if (draft.icon.trim() !== saved.icon) out.icon = draft.icon.trim();
    if (draft.argumentHint.trim() !== saved.argumentHint) {
        out.argumentHint = draft.argumentHint.trim();
    }
    if (draft.toolLevel !== saved.toolLevel) out.toolLevel = draft.toolLevel;
    if (draft.effort !== saved.effort) out.effort = draft.effort;
    if (draft.visibility !== saved.visibility) out.visibility = draft.visibility;
    // The list goes with a save that changes it, or that makes the skill "specific".
    const listChanged =
        [...draft.shares.map(shareKey)].sort().join("\n") !==
        [...saved.shares.map(shareKey)].sort().join("\n");
    if (listChanged || (out.visibility === "specific" && draft.shares.length > 0)) {
        out.shares = draft.shares.map(({ kind, id }) => ({ kind, id }));
    }
    return out;
};

export const isDirty = (draft: SkillDraft, skill: SkillRow): boolean =>
    Object.keys(draftChanges(draft, skill)).length > 0;

export type DraftProblems = {
    title?: "empty";
    slug?: SlugProblem;
    tags?: TagProblem;
    /** "Specific people" is chosen and nobody is. */
    shares?: "empty";
};

/** What stops a save, before the server is asked. The description's and hint's lengths are
 *  held by the inputs themselves (`maxLength`), so they cannot be wrong. */
export const validateDraft = (draft: SkillDraft): DraftProblems => {
    const out: DraftProblems = {};
    if (draft.title.trim() === "") out.title = "empty";
    const slug = slugProblem(draft.slug);
    if (slug) out.slug = slug;
    for (const [i, tag] of draft.tags.entries()) {
        const problem = tagProblem(tag, draft.tags.slice(0, i));
        if (problem) {
            out.tags = problem;
            break;
        }
    }
    if (!out.tags && draft.tags.length > SKILL_LIMITS.tagsMax) out.tags = "tooMany";
    if (draft.visibility === "specific" && draft.shares.length === 0) out.shares = "empty";
    return out;
};

export const hasProblems = (p: DraftProblems): boolean => Object.keys(p).length > 0;
