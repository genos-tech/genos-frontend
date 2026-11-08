/**
 * MIP-1291: every menu trigger has an accessible name. Three "..." / kebab buttons were
 * icon-only with no label at all (a screen reader said "button, menu"): the chat and thread
 * headers' kebab, the chat row's "...", the mobile task header's kebab, the tag colour
 * palette and the status preset arrow. The runtime check (aria-haspopup buttons with no
 * name, in a real browser at 390) found them; this pins the source so a new one cannot
 * land unnamed.
 *
 * A `<MenuButton>` counts as named when its opening tag has an `aria-label`, or it has a
 * visible child that is not just an icon (text, a translated string, a Typography, a Chip, a
 * StatusLabel). Two files are listed because they forward props to
 * the MenuButton: the names come from their callers (an `AppTooltip` writes the
 * `aria-label` on) and from the chip's own field / value text.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const FORWARDERS = new Set([
    "components/ui/menu/MenuParts.tsx", // a usage example in a doc comment
    "features/tasks/components/table/filterBarParts.tsx",
]);

const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return name === "__tests__" ? [] : walk(path);
        return path.endsWith(".tsx") ? [path] : [];
    });

/** Every `<MenuButton ...>...</MenuButton>` block, as "file:line" -> its source. */
const menuButtonBlocks = (): Map<string, string> => {
    const blocks = new Map<string, string>();
    for (const file of walk(srcDir)) {
        const rel = relative(srcDir, file).split("\\").join("/");
        if (FORWARDERS.has(rel)) continue;
        const text = readFileSync(file, "utf8");
        for (const m of text.matchAll(/<MenuButton\b/g)) {
            // The block ends at its own closing tag, or at the next trigger if it has none
            // (self-closing): it must never borrow the next block's children.
            const close = text.indexOf("</MenuButton>", m.index);
            const next = text.indexOf("<MenuButton", m.index + 1);
            const ends = [close, next].filter((i) => i !== -1);
            const end = ends.length ? Math.min(...ends) : text.length;
            const line = text.slice(0, m.index).split("\n").length;
            blocks.set(`${rel}:${line}`, text.slice(m.index, end));
        }
    }
    return blocks;
};

/** The children, after the opening tag's closing `>` (not one inside `{...}` or `=>`). */
const children = (block: string) => {
    let depth = 0;
    for (let i = 1; i < block.length; i++) {
        const c = block[i];
        if (c === "{") depth++;
        else if (c === "}") depth--;
        else if (c === ">" && depth === 0 && block[i - 1] !== "=") return block.slice(i + 1);
    }
    return "";
};

/** Children that are not just an icon: text, a translated string, a label component. */
const hasVisibleChild = (block: string) =>
    children(block)
        .replace(/<\w*Icon\b[^>]*\/>|<ArrowDropDown\s*\/>/g, "")
        .trim() !== "";

const isNamed = (block: string) =>
    /aria-label|ariaLabel/.test(block.slice(0, block.length - children(block).length)) ||
    hasVisibleChild(block);

describe("menu triggers are named (MIP-1291)", () => {
    const blocks = menuButtonBlocks();

    it("finds the menu triggers it is meant to check", () => {
        expect(blocks.size).toBeGreaterThan(15);
    });

    it("has no MenuButton without an accessible name", () => {
        const unnamed = [...blocks].filter(([, block]) => !isNamed(block)).map(([where]) => where);
        expect(unnamed).toEqual([]);
    });

    it.each([
        [
            "features/chat/components/headers/MainChatPaneHeader.tsx",
            "t.common.ui.moreMenu.ariaLabel",
        ],
        [
            "features/chat/components/headers/ThreadChatPaneHeader.tsx",
            "t.common.ui.moreMenu.ariaLabel",
        ],
        [
            "features/chat/components/sidebar/ChatListItemActions.tsx",
            "t.common.ui.moreMenu.ariaLabel",
        ],
        ["features/tasks/MobileTaskHome.tsx", "t.common.ui.moreMenu.ariaLabel"],
        [
            "features/tasks/components/contents/base/sub/TagColorPickerMenu.tsx",
            "t.common.editor.colors",
        ],
        [
            "features/admin/components/modals/sub/UserProfileStatus.tsx",
            "t.admin.status.statusPresetsLabel",
        ],
    ])("%s names its trigger with %s", (file, key) => {
        const mine = [...blocks].filter(([where]) => where.startsWith(`${file}:`));
        expect(mine.length).toBeGreaterThan(0);
        expect(mine.some(([, block]) => block.includes(`aria-label={${key}}`))).toBe(true);
    });
});
