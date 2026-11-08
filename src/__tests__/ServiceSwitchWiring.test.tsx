/**
 * MIP-965: where the "Loading data…" switch is wired in.
 *
 * The behaviour of the store, the loader and the ready marker is in
 * `ServiceSwitchLoader.test.tsx`. This file checks the call sites:
 *  - the mobile tab bar and the Cmd+Tab-style shortcut by rendering them, and
 *  - `App.tsx` and the desktop rail by reading the source, because mounting
 *    either needs the whole app's managers. The scan pins the placements the
 *    behaviour tests cannot see: a `ServiceSwitchReady` inside EACH Home's
 *    `Suspense` (so it cannot report before a lazy Home has mounted), the
 *    loader mounted once, and the jumps that must NOT show it left alone.
 */
import fs from "node:fs";
import path from "node:path";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BrowserRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BottomTabBar } from "../components/layout/BottomTabBar";
import { useGlobalServiceShortcut } from "../hooks/common/useGlobalServiceShortcut";
import {
    getServiceSwitchTarget,
    reportServiceActive,
    resetServiceSwitchForTests,
} from "../services/serviceSwitch/serviceSwitchStore";

vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => true }));
vi.mock("../hooks/common/useSidebarVisibility", async () => ({
    ...(await vi.importActual<object>("../hooks/common/useSidebarVisibility")),
    useSidebarVisibility: () => ({ isVisible: () => true, loading: false, setVisible: () => {} }),
}));
const platform = vi.hoisted(() => ({ mac: true }));
vi.mock("../utils/platform", () => ({ isMac: () => platform.mac }));

let frames: Array<FrameRequestCallback | null> = [];
const paint = () =>
    act(async () => {
        const batch = frames;
        frames = [];
        batch.forEach((cb) => cb?.(0));
        vi.advanceTimersByTime(0);
    });

beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        frames.push(cb);
        return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
        frames[id - 1] = null;
    });
    platform.mac = true;
});

afterEach(() => {
    cleanup();
    resetServiceSwitchForTests();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

const Where = () => <div data-testid="path">{useLocation().pathname}</div>;
const path_ = () => screen.getByTestId("path").textContent;

describe("BottomTabBar", () => {
    const renderBar = (start: string) => {
        window.history.replaceState({}, "", start);
        const onOpenMore = vi.fn();
        render(
            <CssVarsProvider>
                <BrowserRouter>
                    <Where />
                    <BottomTabBar
                        useCM={{ unReadChatAndActivityCounts: 0 } as never}
                        useIM={{ unReadInboxItemCount: 0 } as never}
                        onOpenMore={onOpenMore}
                    />
                </BrowserRouter>
            </CssVarsProvider>
        );
        return { onOpenMore };
    };

    it("a tab for another service shows the loader first and navigates a frame later", async () => {
        renderBar("/workspace/chat");
        fireEvent.click(screen.getByText("Tasks"));
        expect(getServiceSwitchTarget()).toBe("tasks");
        expect(path_()).toBe("/workspace/chat");
        await paint();
        expect(path_()).toBe("/workspace/tasks");
    });

    it("a tab for the service already on screen navigates straight through", () => {
        reportServiceActive("chat");
        renderBar("/workspace/tasks");
        fireEvent.click(screen.getByText("Chats"));
        // Chat is what the Home reports as on screen: no switch to wait for.
        expect(getServiceSwitchTarget()).toBeNull();
        expect(path_()).toBe("/workspace/chat");
    });

    it("the More tab opens the sheet and never starts a switch", () => {
        const { onOpenMore } = renderBar("/workspace/chat");
        fireEvent.click(screen.getByText("More"));
        expect(onOpenMore).toHaveBeenCalledTimes(1);
        expect(getServiceSwitchTarget()).toBeNull();
    });
});

describe("the Cmd+Tab-style service shortcut", () => {
    const Host = () => {
        useGlobalServiceShortcut();
        return <Where />;
    };

    it("commits the highlighted service through the loader, a frame later", async () => {
        window.history.replaceState({}, "", "/workspace/tasks");
        render(
            <BrowserRouter>
                <Host />
            </BrowserRouter>
        );
        // Hold Cmd (Mac), tap Ctrl: highlight the previous service (the first
        // one in the default order, Inbox). Releasing Cmd commits it.
        act(() => {
            document.dispatchEvent(
                new KeyboardEvent("keydown", { key: "Control", metaKey: true })
            );
        });
        act(() => {
            document.dispatchEvent(new KeyboardEvent("keyup", { key: "Meta" }));
        });
        expect(getServiceSwitchTarget()).toBe("inbox");
        expect(path_()).toBe("/workspace/tasks");
        await paint();
        expect(path_()).toBe("/workspace/inbox");
    });
});

describe("call sites (source)", () => {
    const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8");
    const app = read("App.tsx");

    it("App.tsx mounts the loader exactly once", () => {
        expect(app.match(/<ServiceSwitchLoader\s*\/>/g)?.length).toBe(1);
    });

    it.each([
        ["ChatHome", "chat"],
        ["TaskHome", "tasks"],
        ["NoteHome", "notes"],
        ["InboxHome", "inbox"],
        ["GenosHome", "genos"],
    ])("%s has its ready marker inside its own Suspense, beside it", (home, service) => {
        const at = app.indexOf(`<${home}\n`);
        expect(at).toBeGreaterThan(-1);
        const open = app.lastIndexOf("<Suspense", at);
        const close = app.indexOf("</Suspense>", at);
        const boundary = app.slice(open, close);
        // The one marker in this boundary is for this service.
        expect(boundary.match(/<ServiceSwitchReady/g)?.length).toBe(1);
        expect(boundary).toContain(`service="${service}"`);
    });

    it("the letter shortcuts and the Genos page jump go through switchService", () => {
        expect(app).toContain('switchService(navigate, "/workspace/genos")');
        expect(app).toMatch(
            /switchService\(navigate, "\/workspace\/notes", \(\) => \{\s*void useNM\.handleCreateNewMyNote\(null\);/
        );
        expect(app).toMatch(
            /switchService\(navigate, "\/workspace\/tasks", \(\) => \{\s*useTM\.handleCreateTask\(\);/
        );
    });

    it("notification, Spotlight and history jumps are NOT part of this change", () => {
        // They keep calling navigate directly (a later step, per the plan).
        expect(app).toContain('navigate("/workspace/inbox")');
        expect(app).toContain("navigate(spotlightNotePath(r, noteScopes))");
    });

    it("the desktop rail and the shortcut hook switch through the same helper", () => {
        expect(read("components/layout/sidebar.tsx")).toMatch(
            /handleNavClick = \(path: string\) => \{[^}]*switchService\(navigate, path\);/
        );
        expect(read("hooks/common/useGlobalServiceShortcut.ts")).toContain(
            "switchService(navigate, target.path)"
        );
    });
});
