import { fmt } from "../i18n";
import {
    currentPlatform,
    cycleKeys,
    shortcutParts,
    type Platform,
    type ShortcutId,
} from "../shortcuts";

/**
 * The rows of the landing page's "Keyboard shortcuts" list (MIP-1313). The keys come from the
 * shortcut registry for the visitor's own system, so this page cannot drift from the app (it
 * once listed `Ctrl + ⌘ + O` for the To-Do list, which is `X`, and told Windows visitors to
 * "use Alt in place of ⌘" for ⌘K, which is Ctrl+K). The catalogs only hold the labels, in this
 * order: the entry here and the item of `t.featuresPage.shortcuts.items` at the same index
 * are one row. A `null` entry is a row of the page's own (keys in the catalog), not an app shortcut.
 */
export const LP_SHORTCUT_ORDER: ReadonlyArray<ShortcutId | null> = [
    "global.spotlight",
    "global.cycle",
    "global.tasksNew",
    "global.notesNew",
    "global.calendar",
    "global.meetClipboard",
    "global.history",
    "global.taskGraph",
    "global.todo",
    null,
];

type Item = { label: string; keys?: string };
type CycleWords = { hold: string; tap: string };

export const shortcutRows = (
    items: readonly Item[],
    cycleWords: CycleWords,
    platform: Platform = currentPlatform()
): Array<{ keys: string; label: string }> =>
    items.map((item, i) => {
        const id = LP_SHORTCUT_ORDER[i] ?? null;
        if (id === null) return { keys: item.keys ?? "", label: item.label };
        if (id === "global.cycle") {
            // "Hold ⌘ + Tap Ctrl to cycle": the words are Settings', the keys are the registry's.
            const { hold } = cycleKeys(platform);
            return {
                keys: `${fmt(cycleWords.hold, { key: hold })} + ${cycleWords.tap}`,
                label: item.label,
            };
        }
        return { keys: shortcutParts(id, platform).join(" + "), label: item.label };
    });
