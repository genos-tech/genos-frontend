// A row in "Sub tasks" / "Tasks in this milestone" shows at most this many tag chips
// (MIP-2176): a task with 8 tags used to push the title out of its row. The rest sit
// behind a "+N" chip.
export const MAX_ROW_TAGS_DESKTOP = 2;
export const MAX_ROW_TAGS_PHONE = 1;

export type RowTag = { tagName: string; tagColor: string };

/** Split a task's tags into the chips shown and the ones behind "+N". */
export const capRowTags = <T>(tags: T[], isPhone: boolean): { shown: T[]; hidden: T[] } => {
    const cap = isPhone ? MAX_ROW_TAGS_PHONE : MAX_ROW_TAGS_DESKTOP;
    return { shown: tags.slice(0, cap), hidden: tags.slice(cap) };
};
