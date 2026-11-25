// The tag filter of the skill pickers (MIP-2398): which tags the listed skills carry, and which
// skills carry ALL of the tags the member ticked. Pure, so the rules are testable on their own.

import { compareText } from "../../../i18n/collate";
import type { RunnableSkill, SkillTagChip } from "./skillsApi";

/** The built-in tag of the official skills (the server's `template`). */
export const TEMPLATE_TAG = "template";

/** Each tag the skills carry, once, with its colour: `template` first (it is the one a member looks
 *  for), then the rest by name in the app's language. */
/** A row's chips. A row that was not made by `parseRunnableSkills` may lack them. */
const chipsOf = (row: RunnableSkill): SkillTagChip[] => row.tagChips ?? [];

export const tagChoices = (rows: readonly RunnableSkill[]): SkillTagChip[] => {
    const seen = new Map<string, SkillTagChip>();
    for (const row of rows) {
        for (const chip of chipsOf(row)) if (!seen.has(chip.name)) seen.set(chip.name, chip);
    }
    return [...seen.values()].sort((a, b) =>
        a.name === TEMPLATE_TAG ? -1 : b.name === TEMPLATE_TAG ? 1 : compareText(a.name, b.name)
    );
};

/** The skills that carry every ticked tag. Nothing ticked is every skill. The skill the member has
 *  already chosen (`keepId`) stays in the list whatever the filter says, so the picker never shows
 *  a blank for what is chosen. */
export const filterByTags = (
    rows: readonly RunnableSkill[],
    ticked: readonly string[],
    keepId = ""
): RunnableSkill[] =>
    ticked.length === 0
        ? [...rows]
        : rows.filter(
              (r) =>
                  r.id === keepId ||
                  ticked.every((name) => chipsOf(r).some((c) => c.name === name))
          );

/** Tick or untick a tag. */
export const toggleTag = (ticked: readonly string[], name: string): string[] =>
    ticked.includes(name) ? ticked.filter((n) => n !== name) : [...ticked, name];
