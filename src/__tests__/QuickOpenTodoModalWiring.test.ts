/**
 * MIP-1044: where the to-do modal is wired in `App.tsx`. Mounting App needs the
 * whole app's managers, so this reads the source, like ServiceSwitchWiring does.
 * The behaviour itself is in useGlobalServiceShortcutTodo / ModalTodoViewList /
 * UrlLinkModalTodoList; this pins the call sites those tests cannot see.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const app = fs.readFileSync(path.resolve(__dirname, "..", "App.tsx"), "utf8");

describe("App wires the to-do modal", () => {
    it("the shortcut toggles the modal, and no longer goes to the chat page", () => {
        expect(app).toContain("onOpenTodo: toggleTodoModal");
        expect(app).not.toMatch(/onOpenTodo: openTodoPage/);
    });

    it("the sidebar's To-Do button opens the modal, not the page", () => {
        expect(app).toMatch(/onOpenTodo=\{\s*showTodoModal\s*\}/);
        expect(app).not.toMatch(/onOpenTodo=\{\s*openTodoPage\s*\}/);
    });

    it("the modal's 'Open full page' is the old page behaviour", () => {
        expect(app).toMatch(/openTodoList\(\{ onOpenFullPage: openTodoPage \}\)/);
    });

    it("the switcher knows whether the modal is open, and can open and close it", () => {
        expect(app).toContain('const todoModalOpen = urlLinkModal.target?.kind === "todo"');
        expect(app).toMatch(/isTodoOpen: todoModalOpen/);
        expect(app).toMatch(/onShowTodo: showTodoModal/);
        expect(app).toMatch(/onHideTodo: closeUrlLinkModal/);
    });

    it("the overlay is given the hover and click handlers", () => {
        expect(app).toMatch(/onHighlight=\{\s*highlightServiceSwitcherTile\s*\}/);
        expect(app).toMatch(/onSelect=\{selectServiceSwitcherTile\}/);
    });
});
