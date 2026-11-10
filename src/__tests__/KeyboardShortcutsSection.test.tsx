/**
 * Settings -> Shortcuts is generated from the registry (MIP-1275): every
 * shortcut is a row, the text is the platform's, and the cycle row no longer
 * prints the Mac text on Windows.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { KeyboardShortcutsSection } from "../components/layout/settings/KeyboardShortcutsSection";
import { I18nProvider } from "../i18n";
import { SHORTCUT_IDS } from "../shortcuts";

let mac = true;
vi.mock("../utils/platform", () => ({ isMac: () => mac }));

const view = () =>
    render(
        <CssVarsProvider>
            <I18nProvider>
                <KeyboardShortcutsSection />
            </I18nProvider>
        </CssVarsProvider>
    );

const keys = (container: HTMLElement, id: string) =>
    [...container.querySelectorAll(`[data-shortcut-id="${id}"] kbd`)].map((k) => k.textContent);

beforeEach(() => {
    mac = true;
    localStorage.clear();
});

describe("KeyboardShortcutsSection", () => {
    it("lists every registered shortcut exactly once", () => {
        const { container } = view();
        const rows = [...container.querySelectorAll("[data-shortcut-id]")].map((r) =>
            r.getAttribute("data-shortcut-id")
        );
        expect(rows.sort()).toEqual([...SHORTCUT_IDS].sort());
    });

    it("groups them: global, chat, writing", () => {
        const { getByTestId } = view();
        expect(within(getByTestId("shortcut-group-global")).getByText("Global")).toBeTruthy();
        expect(getByTestId("shortcut-group-chat").querySelectorAll("kbd").length).toBeGreaterThan(
            0
        );
        expect(
            within(getByTestId("shortcut-group-editing")).getByText("Send a message or comment")
        ).toBeTruthy();
    });

    it("lists the task board's keys in their own group, the same caps on every system (MIP-1402)", () => {
        const { container, getByTestId } = view();
        expect(within(getByTestId("shortcut-group-board")).getByText("Task board")).toBeTruthy();
        expect(keys(container, "board.move")).toEqual(["← ↑ ↓ →"]);
        expect(keys(container, "board.boardEdges")).toEqual(["Ctrl", "Home / End"]);
        expect(keys(container, "board.lift")).toEqual(["Space"]);
    });

    it("prints the Mac chords", () => {
        const { container } = view();
        expect(keys(container, "global.tasksNew")).toEqual(["Ctrl", "⌘", "T"]);
        expect(keys(container, "global.spotlight")).toEqual(["⌘", "K"]);
        expect(keys(container, "chat.switchTab")).toEqual(["⌘", "Shift", "← / →"]);
        expect(keys(container, "composer.send")).toEqual(["⌘", "Enter"]);
        expect(keys(container, "global.cycle")).toEqual([
            "Hold ⌘",
            "Tap Ctrl to cycle",
            "Release ⌘ to switch",
        ]);
        expect(keys(container, "chat.openThread")).toEqual(["⌘", "Click message"]);
    });

    it("prints the Windows chords, including a cycle row that says Alt, not ⌘", () => {
        mac = false;
        const { container } = view();
        expect(keys(container, "global.tasksNew")).toEqual(["Ctrl", "Alt", "T"]);
        expect(keys(container, "global.spotlight")).toEqual(["Ctrl", "K"]);
        expect(keys(container, "chat.moveSelection")).toEqual(["Alt", "Shift", "↑ / ↓"]);
        expect(keys(container, "taskCreate.submit")).toEqual(["Ctrl", "Enter"]);
        expect(keys(container, "global.cycle")).toEqual([
            "Hold Alt",
            "Tap Ctrl to cycle",
            "Release Alt to switch",
        ]);
        expect(keys(container, "chat.openThread")).toEqual(["Alt", "Click message"]);
    });

    it("key caps stay left to right in every language; a row with translated words follows the page", () => {
        const { container } = view();
        const caps = (id: string) =>
            container
                .querySelector(`[data-shortcut-id="${id}"] kbd`)
                ?.parentElement?.getAttribute("dir");
        expect(caps("global.tasksNew")).toBe("ltr");
        expect(caps("composer.send")).toBe("ltr");
        expect(caps("global.cycle")).toBeNull();
        expect(caps("chat.openThread")).toBeNull();
    });

    it("every row prints at least one key cap, on both platforms (a new gesture entry needs a branch)", () => {
        for (const isMacPlatform of [true, false]) {
            mac = isMacPlatform;
            const { container, unmount } = view();
            for (const id of SHORTCUT_IDS) {
                expect(keys(container, id).length, `${id} mac=${isMacPlatform}`).toBeGreaterThan(
                    0
                );
            }
            unmount();
        }
    });
});
