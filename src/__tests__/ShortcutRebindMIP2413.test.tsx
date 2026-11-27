/**
 * Rebinding in Settings -> Shortcuts (MIP-2413), end to end in the app's own pieces: the
 * ui_settings provider, the bridge into the shortcut store, and the listeners.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { KeyboardShortcutsSection } from "../components/layout/settings/KeyboardShortcutsSection";
import { ModalFrame } from "../components/ui/modal/ModalFrame";
import { UiSettingsProvider } from "../hooks/common/useUiSettings";
import { I18nProvider } from "../i18n";
import { applyOverrides, getOverrides, isRecording, useShortcut } from "../shortcuts";
import { ShortcutOverridesBridge } from "../shortcuts/ShortcutOverridesBridge";

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), token: "a" as string | null }));
vi.mock("../utils/platform", () => ({ isMac: () => true }));
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: api.token }) }));
vi.mock("../services/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../services/api")>()),
    authApi: (token: string | null) => (token ? { get: api.get, patch: api.patch } : null),
}));

const onClose = vi.fn();
const tree = () => (
    <CssVarsProvider>
        <I18nProvider>
            <UiSettingsProvider>
                <ShortcutOverridesBridge />
                <ModalFrame open title="Settings" onClose={onClose}>
                    <KeyboardShortcutsSection />
                </ModalFrame>
            </UiSettingsProvider>
        </I18nProvider>
    </CssVarsProvider>
);

const row = (id: string) => document.querySelector(`[data-shortcut-id="${id}"]`) as HTMLElement;
const button = (label: string) =>
    screen.getByRole("button", { name: new RegExp(`Change the shortcut for ${label}`) });
const keys = (id: string) => [...row(id).querySelectorAll("kbd")].map((k) => k.textContent);
const mac = { ctrlKey: true, metaKey: true };
const press = (el: Element, key: string, init: object = mac) =>
    fireEvent.keyDown(el, { key, code: `Key${key.toUpperCase()}`, ...init });

const open = async (stored: Record<string, unknown> = {}) => {
    api.get.mockResolvedValue({ data: { ui_settings: stored } });
    const view = render(tree());
    await waitFor(() => expect(button("Open history")).toHaveProperty("disabled", false));
    return view;
};

/** Press the row's keys, so the next keydown is recorded. */
const record = (label: string) => {
    const el = button(label);
    fireEvent.click(el);
    return el;
};

beforeEach(() => {
    localStorage.clear();
    applyOverrides("mac", {});
    api.token = "a";
    api.get.mockReset();
    api.patch.mockReset().mockResolvedValue({});
    onClose.mockReset();
});

describe("rebinding a shortcut", () => {
    it("records the new keys, saves them to the account and prints them", async () => {
        await open();
        press(record("Open history"), "j");
        await waitFor(() => expect(keys("global.history")).toEqual(["Ctrl", "⌘", "J"]));
        expect(api.patch).toHaveBeenCalledWith("/user/preferences/ui-settings/", {
            shortcutsMac: { "global.history": "ctrl+meta+j" },
        });
        expect(row("global.history").textContent).toContain("Custom");
        expect(screen.getByRole("status").textContent).toContain("Open history is now");
        expect(isRecording()).toBe(false);
    });

    it("fires on the new keys without rebinding the listener, and not on the old ones", async () => {
        await open();
        const handler = vi.fn();
        renderHook(() => useShortcut("global.spotlight", handler));
        press(record("Open Spotlight"), "j");
        await waitFor(() => expect(getOverrides("mac")["global.spotlight"]).toBeDefined());
        fireEvent.keyDown(document.body, { key: "k", metaKey: true });
        expect(handler).not.toHaveBeenCalled();
        press(document.body, "j");
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("keeps every shortcut quiet while recording", async () => {
        await open();
        const handler = vi.fn();
        renderHook(() => useShortcut("global.spotlight", handler));
        const el = record("Open history");
        press(el, "k", { metaKey: true });
        expect(handler).not.toHaveBeenCalled();
        expect(row("global.history").textContent).toContain("Hold ⁦Ctrl+⌘⁩");
    });

    it("refuses keys another shortcut uses, and system keys, changing nothing", async () => {
        await open();
        const el = record("Open history");
        press(el, "t");
        expect(row("global.history").textContent).toContain(
            "already used by “Open Tasks and start a new task”"
        );
        press(el, "f");
        expect(row("global.history").textContent).toContain("used by your system");
        expect(api.patch).not.toHaveBeenCalled();
        expect(isRecording()).toBe(true);
    });

    it("Escape stops recording and leaves Settings open; the next Escape closes it", async () => {
        await open();
        const el = record("Open history");
        fireEvent.keyDown(el, { key: "Escape" });
        expect(onClose).not.toHaveBeenCalled();
        expect(isRecording()).toBe(false);
        fireEvent.keyDown(el, { key: "Escape" });
        expect(onClose).toHaveBeenCalled();
    });

    it("Tab, leaving the button and Cancel all stop recording", async () => {
        await open();
        const el = record("Open history");
        expect(fireEvent.keyDown(el, { key: "Tab" })).toBe(true); // not prevented
        expect(isRecording()).toBe(false);
        record("Open history");
        act(() => el.blur());
        expect(isRecording()).toBe(false);
        record("Open history");
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(isRecording()).toBe(false);
        expect(api.patch).not.toHaveBeenCalled();
    });

    it("closing the page mid-recording gives the shortcuts back", async () => {
        const view = await open();
        record("Open history");
        view.unmount();
        expect(isRecording()).toBe(false);
    });

    it("resets one, and all", async () => {
        await open({
            shortcutsMac: { "global.history": "ctrl+meta+j", "global.todo": "ctrl+meta+u" },
        });
        expect(keys("global.history")).toEqual(["Ctrl", "⌘", "J"]);
        fireEvent.click(screen.getByRole("button", { name: "Reset Open history to the default" }));
        await waitFor(() => expect(keys("global.history")).toEqual(["Ctrl", "⌘", "H"]));
        expect(document.activeElement).toBe(button("Open history"));
        fireEvent.click(screen.getByRole("button", { name: "Reset all" }));
        await waitFor(() => expect(keys("global.todo")).toEqual(["Ctrl", "⌘", "X"]));
        expect(api.patch).toHaveBeenLastCalledWith("/user/preferences/ui-settings/", {
            shortcutsMac: null,
        });
        expect(screen.getByRole("button", { name: "Reset all" })).toHaveProperty("disabled", true);
    });

    it("will not reset onto keys another shortcut has taken", async () => {
        await open({
            shortcutsMac: {
                "global.tasksNew": "ctrl+meta+j",
                "global.history": "ctrl+meta+t",
            },
        });
        fireEvent.click(
            screen.getByRole("button", {
                name: "Reset Open Tasks and start a new task to the default",
            })
        );
        expect(row("global.tasksNew").textContent).toContain("already used by “Open history”");
        expect(api.patch).not.toHaveBeenCalled();
    });

    it("offers no change for fixed shortcuts, and none until the account has loaded", () => {
        api.get.mockReturnValue(new Promise(() => {}));
        render(tree());
        expect(button("Open history")).toHaveProperty("disabled", true);
        expect(row("composer.send").querySelector("button")).toBeNull();
        expect(row("global.cycle").querySelector("button")).toBeNull();
    });

    it("does not carry one account's keys over to the next", async () => {
        const view = await open({ shortcutsMac: { "global.history": "ctrl+meta+j" } });
        expect(getOverrides("mac")["global.history"]).toBeDefined();
        // Another user signs in: the local mirror is wiped before their token arrives.
        localStorage.clear();
        api.get.mockReturnValue(new Promise(() => {}));
        api.token = "b";
        view.rerender(tree());
        await waitFor(() => expect(getOverrides("mac")).toEqual({}));
    });
});
