/**
 * MIP-1177: the last-message time stays visible on a phone, in the chat list, in the
 * Recent activities list and in the flagged-message rows.
 *
 * jsdom does not evaluate responsive `sx` (`display: { xs: "none" }` is a media rule),
 * so this pins the source: the element that prints the time must not be hidden below `md`.
 * The behaviour itself was checked in a real browser at 390px (evidence doc).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Not `new URL(…, import.meta.url)`: Vite rewrites that form as an asset import.
const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path: string) => readFileSync(resolve(srcDir, path), "utf8");

/** The `<Typography …>` opening tag whose body prints `needle`. */
const timeTypography = (text: string, needle: string): string => {
    const at = text.indexOf(needle);
    expect(at, `${needle} not found`).toBeGreaterThan(-1);
    const open = text.lastIndexOf("<Typography", at);
    return text.slice(open, at);
};

describe("the last-message time is shown on a phone too", () => {
    it.each([
        ["chat list row", "features/chat/components/sidebar/ChatListItemActions.tsx", "{time}"],
        [
            "Recent activities row",
            "features/chat/components/sidebar/activity/ActivityHeader.tsx",
            "extractYYYYMMDDHHMM(activity.tsSent)",
        ],
        [
            "flagged message row",
            "features/chat/components/sidebar/chatListItemForFlagMessages.tsx",
            "extractYYYYMMDDHHMM(flaggedMessage.tsSent)",
        ],
    ])("%s", (_name, file, needle) => {
        const tag = timeTypography(source(file), needle);
        expect(tag).not.toMatch(/display:\s*\{[^}]*xs:\s*"none"/);
        expect(tag).not.toContain('display: "none"');
    });
});
