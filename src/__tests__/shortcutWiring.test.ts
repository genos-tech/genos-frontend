/**
 * Where the registry is used (MIP-1275). Mounting these surfaces needs the whole
 * app's managers, so this reads the source, like ServiceSwitchWiring does. The
 * matching and the guards are tested in shortcutRegistry / useShortcut; this pins
 * the call sites those tests cannot see, so a handler cannot quietly go back to a
 * private key check that Settings and the tooltips then disagree with.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { SHORTCUTS, type ShortcutId } from "../shortcuts";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8");

const USES_HOOK: Array<[string, string]> = [
    ["features/spotlight/useSpotlight.ts", "global.spotlight"],
    ["features/chat/components/sidebar/ChatSidebar.tsx", "chat.switchTab"],
    ["features/chat/components/sidebar/ChatList.tsx", "chat.moveSelection"],
    ["features/tasks/components/contents/CreateTaskForm.tsx", "taskCreate.submit"],
];

describe("handlers read the registry", () => {
    it.each(USES_HOOK)("%s binds %s through useShortcut", (file, id) => {
        const src = read(file);
        expect(src).toContain(`useShortcut(`);
        expect(src).toContain(`"${id}"`);
    });

    it("none of them keeps a private Cmd/Alt chord check", () => {
        for (const [file] of USES_HOOK) {
            const src = read(file);
            expect(src, file).not.toMatch(/mac \? e\.metaKey/);
            expect(src, file).not.toMatch(/holdHeld/);
            expect(src, file).not.toContain("wrongModifierHeld");
        }
    });

    it("the create-task submit is contained to its form, so the chat composer's Cmd/Ctrl+Enter only sends (MIP-1312)", () => {
        expect(read("features/tasks/components/contents/CreateTaskForm.tsx")).toMatch(
            /"taskCreate\.submit",[\s\S]*?within: formRootRef/
        );
    });

    it("every `contained` shortcut is bound with `within` at its call site", () => {
        const contained = (Object.keys(SHORTCUTS) as ShortcutId[]).filter(
            (id) => "contained" in SHORTCUTS[id]
        );
        expect(contained.length).toBeGreaterThan(0);
        for (const id of contained) {
            const files = USES_HOOK.filter(([, hooked]) => hooked === id).map(([file]) => file);
            expect(files.length, `${id} has no call site in USES_HOOK`).toBeGreaterThan(0);
            for (const file of files)
                expect(read(file), `${file} binds ${id}`).toMatch(
                    new RegExp(`"${id.replace(".", "\\.")}",[\\s\\S]*?within:`)
                );
        }
    });

    it("the composer's send chord is the registry's", () => {
        expect(read("components/editors/composer/useChatComposer.ts")).toContain(
            'matchesShortcut("composer.send"'
        );
    });

    it("the global hook's letter table covers the seven action shortcuts", () => {
        const src = read("hooks/common/useGlobalServiceShortcut.ts");
        for (const id of [
            "global.tasksNew",
            "global.notesNew",
            "global.calendar",
            "global.meetClipboard",
            "global.history",
            "global.taskGraph",
            "global.todo",
        ])
            expect(src).toContain(`"${id}"`);
        expect(src).not.toMatch(/key === "[a-z]" && optionsRef/);
    });
});

describe("tooltips and Settings print from the registry", () => {
    it.each([
        ["components/layout/sidebar.tsx", "shortcutText("],
        ["features/tasks/components/header/TaskHeader.tsx", 'shortcutText("global.tasksNew")'],
        [
            "features/notes/common/components/NoteHeaderActions.tsx",
            'shortcutText("global.notesNew")',
        ],
        [
            "features/chat/components/headers/MainChatPaneHeader.tsx",
            'shortcutText("global.calendar")',
        ],
        ["components/editors/sub/EditorSendButton.tsx", 'shortcutParts("composer.send")'],
        [
            "features/tasks/components/contents/base/TaskCreateFooter.tsx",
            'shortcutText("taskCreate.submit")',
        ],
        ["features/tasks/components/contents/TaskPreview.tsx", 'shortcutText("global.taskGraph")'],
    ])("%s", (file, needle) => {
        expect(read(file)).toContain(needle);
    });

    it("no component builds its own platform text any more", () => {
        for (const file of [
            "components/layout/sidebar.tsx",
            "features/tasks/components/header/TaskHeader.tsx",
            "features/notes/common/components/NoteHeaderActions.tsx",
            "features/tasks/components/contents/base/TaskCreateFooter.tsx",
            "components/editors/sub/EditorSendButton.tsx",
        ]) {
            const src = read(file);
            expect(src, file).not.toMatch(/isMac\(\)/);
            expect(src, file).not.toMatch(/"(⌘|Ctrl|Alt) \+/);
        }
    });

    it("Settings renders the generated section, not a hand-written list", () => {
        const src = read("components/layout/SettingsModal.tsx");
        expect(src).toContain("KeyboardShortcutsSection");
        expect(src).not.toContain("const KeyboardShortcutsSection");
    });
});
