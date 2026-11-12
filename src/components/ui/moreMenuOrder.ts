/**
 * The one order every "…" menu follows (MIP-903).
 *
 * The same action used to sit somewhere different in each menu (Copy link was
 * first in one, fifth in the next, Mute before Delete in one and after Import
 * in another), so what a user learned from one menu did not carry to the
 * next. Each item names the action it is with `kind`; `MoreMenu` sorts by the
 * position of that kind in the table below. Ids stay per-menu on purpose
 * (tests and the pinned-action preference key on them), which is exactly why
 * the order cannot hang off `id`.
 *
 * Position in the table is the whole rule: the groups run top to bottom, and
 * inside a group the kinds run in the order listed. Delete is always last.
 *
 * Menus that compose `MenuSurface` / `MenuRow` themselves instead of passing an
 * `items` array to `MoreMenu` (the mobile pane headers, TodoItemMoreMenu,
 * ChatListItemActions) cannot use this, so their JSX is ordered by hand to
 * match — move an entry here and move those with it.
 */
export const MORE_MENU_GROUPS = [
    // Go to, or respond to, the thing itself.
    {
        group: "open",
        kinds: ["reply", "openTask", "openThread", "openNote", "openInNotes", "askGenos"],
    },
    { group: "share", kinds: ["share", "copyLink"] },
    // Marks that are yours alone, not the object's.
    { group: "personal", kinds: ["favorite", "flag", "remindMe", "addToTodo"] },
    {
        group: "create",
        kinds: [
            "newTask",
            "newSubTask",
            "newNote",
            "newChildNote",
            "newProject",
            "newMilestone",
            "newSubfolder",
        ],
    },
    {
        group: "organize",
        kinds: [
            "rename",
            "move",
            "convert",
            "tags",
            "members",
            "customizeFields",
            "versionHistory",
        ],
    },
    { group: "content", kinds: ["unwrapAll", "unwrapCode", "import", "export"] },
    { group: "mute", kinds: ["mute"] },
    { group: "edit", kinds: ["edit"] },
    { group: "delete", kinds: ["delete"] },
] as const;

export type MoreMenuGroup = (typeof MORE_MENU_GROUPS)[number]["group"];
export type MoreMenuKind = (typeof MORE_MENU_GROUPS)[number]["kinds"][number];

const RANK = new Map<string, number>(
    MORE_MENU_GROUPS.flatMap((g) => g.kinds as readonly string[]).map((kind, rank) => [kind, rank])
);
// "delete" is the last kind, so a destructive item shares its rank.
const DELETE_RANK = RANK.get("delete")!;

type Orderable = { kind?: MoreMenuKind; danger?: boolean; visible?: boolean };

/**
 * The items a menu shows, in the shared order.
 *
 * Hidden items are dropped first, so a `visible: false` item can't hold a
 * position open. The sort is stable: two items of the same kind keep the
 * order they were written in. A `danger` item is Delete whatever it is
 * tagged, so it always lands last — `MoreMenu` puts its divider above it.
 *
 * An item with no `kind` follows the item written before it (the first one
 * leads), which keeps it where its author put it relative to its neighbours
 * instead of guessing a group for it. Tag everything; this is only a guard.
 */
export const orderMoreMenuItems = <T extends Orderable>(items: readonly T[]): T[] => {
    let carried = -1;
    return items
        .filter((item) => item.visible !== false)
        .map((item, index) => {
            if (item.kind !== undefined) carried = RANK.get(item.kind) ?? carried;
            return { index, item, rank: item.danger ? DELETE_RANK : carried };
        })
        .sort((a, b) => a.rank - b.rank || a.index - b.index)
        .map(({ item }) => item);
};
