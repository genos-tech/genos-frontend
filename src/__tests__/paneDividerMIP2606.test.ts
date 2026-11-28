/**
 * MIP-2606: one pane divider.
 *
 * jsdom has no layout, so this reads the source: the resize handle is the only
 * place that renders `PanelResizeHandle`, and the panes beside it draw no border
 * of their own (the chat panes' `1px black inset` was a light grey line down the
 * right edge of the chat page).
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { LayoutStyles } from "../components/ui/styles/commonStyle";

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(resolve(srcDir, path), "utf8");

const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(dir, entry.name);
        if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sources(path);
        return /\.tsx?$/.test(entry.name) ? [relative(srcDir, path)] : [];
    });

describe("the pane divider", () => {
    it("one component renders every resize handle", () => {
        const users = sources(srcDir).filter((path) => /<PanelResizeHandle\b/.test(read(path)));
        expect(users).toEqual(["components/ui/ResizeHandle.tsx"]);
    });

    it("takes its color from the theme token", () => {
        expect(read("index.css")).toMatch(
            /\.gp-pane-handle \{[^}]*background-color: var\(--g-border\);/
        );
    });

    it.each([
        "features/chat/MainChatPane.tsx",
        "features/chat/components/panels/ChatNotePanel.tsx",
        "features/chat/components/panels/CreateTaskPanel.tsx",
        "features/chat/components/panels/SubChatPanel.tsx",
        "features/chat/components/panels/TaskPreviewPanel.tsx",
        "features/chat/components/panels/ThreadPanel.tsx",
        "features/chat/components/sidebar/ChatSidebar.tsx",
        "features/notes/NoteHome.tsx",
        "features/notes/task-notes/components/TaskPreviewPanel.tsx",
    ])("%s draws no pane border of its own", (path) => {
        expect(read(path)).not.toMatch(/borderRight|borderInlineEnd|boxShadow: "0 0 0 1px/);
    });

    it.each(["dark", "light"] as const)("%s: the shared pane styles have no border", (mode) => {
        expect(LayoutStyles[mode].sidebarPanel).not.toHaveProperty("borderRight");
        expect(LayoutStyles[mode].mainPanel).not.toHaveProperty("borderRight");
    });
});
