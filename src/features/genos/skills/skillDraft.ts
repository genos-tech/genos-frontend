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
    visibility: skill.visibility === "team" ? "team" : "private",
});

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
    return out;
};

export const isDirty = (draft: SkillDraft, skill: SkillRow): boolean =>
    Object.keys(draftChanges(draft, skill)).length > 0;

export type DraftProblems = {
    title?: "empty";
    slug?: SlugProblem;
    tags?: TagProblem;
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
    return out;
};

export const hasProblems = (p: DraftProblems): boolean => Object.keys(p).length > 0;
