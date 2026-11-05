/**
 * MIP-965 (second PR): the rail and the tab bar light up the service you just
 * clicked at once, not after the page has switched.
 *
 * The highlight is derived from the URL, and a navigation is a transition, so
 * before this the old service stayed highlighted for the whole switch, next to
 * the new "Loading data…" page. The click now records a local "pending" path.
 *
 * The highlight is read off the label's font weight (600 active, 500 not): it
 * is set from the same flag as the colours and the background.
 *
 * `requestAnimationFrame` is a hand-flushed queue and fake timers cover only
 * `setTimeout`, as in `ServiceSwitchLoader.test.tsx`.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BrowserRouter, useLocation, useNavigate, type NavigateFunction } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BottomTabBar } from "../components/layout/BottomTabBar";
import { Sidebar } from "../components/layout/sidebar";
import {
    FAILSAFE_MS,
    reportServiceActive,
    resetServiceSwitchForTests,
    switchService,
} from "../services/serviceSwitch/serviceSwitchStore";

const env = vi.hoisted(() => ({ mobile: false, dropNavigation: false }));
vi.mock("react-router-dom", async (importOriginal) => {
    const actual = await importOriginal<typeof import("react-router-dom")>();
    return {
        ...actual,
        // Lets one test swallow the click's navigation, so the route never moves.
        useNavigate: () => {
            const real = actual.useNavigate();
            return ((...args: Parameters<typeof real>) =>
                env.dropNavigation ? undefined : real(...args)) as typeof real;
        },
    };
});
vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => env.mobile }));
vi.mock("../hooks/common/useSidebarVisibility", async () => ({
    ...(await vi.importActual<object>("../hooks/common/useSidebarVisibility")),
    useSidebarVisibility: () => ({ isVisible: () => true, loading: false, setVisible: () => {} }),
}));
// The rail's heavy neighbours (team menu, settings, avatars) have nothing to do
// with the highlight.
vi.mock("../features/admin/components/teamDropdown", () => ({ TeamDropdown: () => null }));
vi.mock("../components/layout/SettingsModal", () => ({ SettingsModal: () => null }));
vi.mock("../features/admin/components/modals/ModalUserProfile", () => ({
    UserProfile: () => null,
}));
vi.mock("../components/ui/avatars/avatarWithStatus", () => ({ AvatarWithStatus: () => null }));
vi.mock("../hooks/common/useSignOut", () => ({ useSignOut: () => async () => {} }));

let frames: Array<FrameRequestCallback | null> = [];
const paint = () =>
    act(async () => {
        const batch = frames;
        frames = [];
        batch.forEach((cb) => cb?.(0));
        vi.advanceTimersByTime(0);
    });

let navigateRef: NavigateFunction;
const Probe = () => {
    navigateRef = useNavigate();
    return <div data-testid="path">{useLocation().pathname}</div>;
};
const path = () => screen.getByTestId("path").textContent;

const cssOf = (el: HTMLElement) => {
    const cls = Array.from(el.classList).find((c) => c.startsWith("css-"));
    const all = Array.from(document.querySelectorAll("style"))
        .map((st) => st.textContent ?? "")
        .join("\n");
    return all
        .split("\n")
        .filter((line) => cls && line.includes(`.${cls}`))
        .join("\n");
};
/** The label whose text is exactly `text` is lit when its weight is 600. */
const lit = (text: string) => /font-weight:600/.test(cssOf(screen.getByText(text)));

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
});

afterEach(() => {
    env.dropNavigation = false;
    cleanup();
    resetServiceSwitchForTests();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

const mountBar = (start: string) => {
    env.mobile = true;
    window.history.replaceState({}, "", start);
    render(
        <CssVarsProvider>
            <BrowserRouter>
                <Probe />
                <BottomTabBar
                    useCM={{ unReadChatAndActivityCounts: 0 } as never}
                    useIM={{ unReadInboxItemCount: 0 } as never}
                    onOpenAccount={() => {}}
                />
            </BrowserRouter>
        </CssVarsProvider>
    );
};

// `onOpenGenos` is App's `openGenosPage`: close Spotlight, then switchService.
const GenosAwareSidebar = () => {
    const navigate = useNavigate();
    return (
        <Sidebar
            myself={{} as never}
            setMyself={() => {}}
            socket={null}
            useCM={{ unReadChatAndActivityCounts: 0 } as never}
            useIM={{ unReadInboxItemCount: 0 } as never}
            useTEM={{ teamMemberProfiles: {} } as never}
            useUISM={{} as never}
            onOpenGenos={() => switchService(navigate, "/workspace/genos")}
            onOpenHistory={() => {}}
            onOpenTodo={() => {}}
        />
    );
};
const mountRail = (start: string) => {
    env.mobile = false;
    window.history.replaceState({}, "", start);
    render(
        <CssVarsProvider>
            <BrowserRouter>
                <Probe />
                <GenosAwareSidebar />
            </BrowserRouter>
        </CssVarsProvider>
    );
};

// The same behaviour on both surfaces; the labels are the tab bar's and the rail's.
const SURFACES = [
    ["tab bar", mountBar, { chat: "Chats", tasks: "Tasks", notes: "Notes", inbox: "Inbox" }],
    ["rail", mountRail, { chat: "Chats", tasks: "Tasks", notes: "Notes", inbox: "Inbox" }],
] as const;

describe.each(SURFACES)("%s highlight", (_name, mount, label) => {
    it("starts on the service the route is in", () => {
        mount("/workspace/chat");
        expect(lit(label.chat)).toBe(true);
        expect(lit(label.tasks)).toBe(false);
    });

    it("moves on click, before the URL changes", async () => {
        mount("/workspace/chat");
        fireEvent.click(screen.getByText(label.tasks));
        // Nothing navigated yet: the route (and the old page) are still Chat's...
        expect(path()).toBe("/workspace/chat");
        expect(window.location.pathname).toBe("/workspace/chat");
        // ...but the highlight is already on Tasks.
        expect(lit(label.tasks)).toBe(true);
        expect(lit(label.chat)).toBe(false);

        await paint(); // the frame: navigate
        expect(path()).toBe("/workspace/tasks");
        expect(lit(label.tasks)).toBe(true);
        expect(lit(label.chat)).toBe(false);
    });

    it("clears when the URL catches up: a later route change is followed, not shadowed", async () => {
        mount("/workspace/chat");
        fireEvent.click(screen.getByText(label.tasks));
        await paint();
        expect(path()).toBe("/workspace/tasks");
        // A navigation that did not come from this surface (a link, a notification).
        act(() => {
            navigateRef("/workspace/notes");
        });
        expect(lit(label.notes)).toBe(true);
        expect(lit(label.tasks)).toBe(false);
    });

    it("clicking back to the service on screen undoes the pending highlight at once (A, B, A)", () => {
        mount("/workspace/chat");
        fireEvent.click(screen.getByText(label.tasks));
        expect(lit(label.tasks)).toBe(true);
        fireEvent.click(screen.getByText(label.chat));
        expect(lit(label.chat)).toBe(true);
        expect(lit(label.tasks)).toBe(false);
    });

    it("clears when the switch ends without the URL changing (another path took over)", async () => {
        mount("/workspace/chat");
        reportServiceActive("chat"); // Chat is what is on screen
        fireEvent.click(screen.getByText(label.tasks));
        expect(lit(label.tasks)).toBe(true);
        // A shortcut asks for Chat before the Tasks switch has navigated: the
        // switch is abandoned, the route never leaves Chat.
        await act(async () => {
            switchService(navigateRef, "/workspace/chat");
        });
        expect(path()).toBe("/workspace/chat");
        expect(lit(label.chat)).toBe(true);
        expect(lit(label.tasks)).toBe(false);
    });

    it("clears when the loader's failsafe ends a switch whose navigation never happened", async () => {
        mount("/workspace/chat");
        env.dropNavigation = true; // the navigation is swallowed: the route stays put
        fireEvent.click(screen.getByText(label.tasks));
        expect(lit(label.tasks)).toBe(true);
        await paint();
        expect(path()).toBe("/workspace/chat");
        // Still pending: the loader is up, waiting for a Tasks that never comes.
        expect(lit(label.tasks)).toBe(true);
        await act(async () => {
            vi.advanceTimersByTime(FAILSAFE_MS);
        });
        expect(path()).toBe("/workspace/chat");
        expect(lit(label.chat)).toBe(true);
        expect(lit(label.tasks)).toBe(false);
    });

    it("a click on the service the route is already in moves nothing", () => {
        mount("/workspace/tasks");
        fireEvent.click(screen.getByText(label.tasks));
        expect(lit(label.tasks)).toBe(true);
        expect(path()).toBe("/workspace/tasks");
    });
});

describe("rail: the Genos button", () => {
    it("lights Genos on click, before the URL changes, and Genos' old neighbour goes dark", async () => {
        mountRail("/workspace/tasks");
        expect(lit("Genos")).toBe(false);
        fireEvent.click(screen.getByText("Genos"));
        expect(path()).toBe("/workspace/tasks");
        expect(lit("Genos")).toBe(true);
        expect(lit("Tasks")).toBe(false);
        await paint();
        expect(path()).toBe("/workspace/genos");
        expect(lit("Genos")).toBe(true);
    });
});

describe("tab bar: the Account tab", () => {
    it("opens the sheet and moves no highlight", () => {
        mountBar("/workspace/chat");
        fireEvent.click(screen.getByText("Account"));
        expect(lit("Chats")).toBe(true);
        expect(lit("Account")).toBe(false);
    });
});
