/**
 * MIP-1132 guard: no surface renders its own Joy Snackbar any more; every
 * toast goes through the shared host. The list of files still allowed to
 * import Snackbar may only shrink.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return name === "__tests__" ? [] : walk(full);
        return /\.tsx?$/.test(name) ? [full] : [];
    });

const files = walk(SRC).map((f) => ({ f: relative(SRC, f), text: readFileSync(f, "utf8") }));

describe("feedback adoption", () => {
    it("no file imports Snackbar from @mui/joy", () => {
        const offenders = files
            .filter(({ text }) =>
                [...text.matchAll(/import\s+([^;]*?)\s+from\s+"@mui\/joy(\/Snackbar)?";/gs)].some(
                    ([, names, sub]) => sub === "/Snackbar" || /\bSnackbar\b/.test(names)
                )
            )
            .map(({ f }) => f);
        expect(offenders).toEqual([]);
    });

    it("the hand-built tab strips are gone: the thread and inbox tabs use TabStrip", () => {
        const uses = (path: string) =>
            files.find(({ f }) => f === path)?.text.includes("ui/feedback/TabStrip") ?? false;
        expect(uses("features/chat/components/shared/ThreadTabStrip.tsx")).toBe(true);
        expect(uses("features/inbox/components/InboxTabHeader.tsx")).toBe(true);
    });

    it("the four old EmptyStates are gone: each renders the shared one", () => {
        const shared = (path: string) =>
            files.find(({ f }) => f === path)?.text.includes("ui/feedback/EmptyState") ?? false;
        expect(shared("features/chat/ToDoPane.tsx")).toBe(true);
        expect(shared("features/chat/components/sidebar/ChatList.tsx")).toBe(true);
        expect(shared("features/notes/my-notes/components/MyNoteMain.tsx")).toBe(true);
        // The ones people actually meet: no note open, no chat open, empty inbox.
        expect(shared("features/notes/common/components/NoteContentRenderer.tsx")).toBe(true);
        expect(shared("features/chat/components/panels/SelectChatPanel.tsx")).toBe(true);
        expect(shared("features/inbox/components/InboxSection.tsx")).toBe(true);
        expect(
            files.some(({ f }) => f === "features/notes/common/components/EmptyState.tsx")
        ).toBe(false);
    });
});
