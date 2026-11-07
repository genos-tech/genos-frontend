/**
 * MIP-965: a click on another service shows a "Loading data…" page FIRST, and
 * only then starts the expensive switch render.
 *
 * What is under test, and what is not:
 *  - Under test: the store (`switchService`), the loader, and the ready marker,
 *    wired the way `App.tsx` wires them: display-contents div ->
 *    `FreezeWhenHidden` -> `Suspense` -> Home + `ServiceSwitchReady` for Chat /
 *    Tasks / Notes, and a route-style marker for Inbox / Genos. The harness
 *    below copies that structure; `App.tsx` itself is not mounted, so the
 *    placement of the markers there is NOT covered by these tests.
 *  - NOT provable in jsdom: real paint timing. `requestAnimationFrame` is a
 *    manual queue here and the "frame" is whatever the test flushes. That the
 *    loader is really on screen before the render starts has to be read off a
 *    browser trace.
 *
 * `requestAnimationFrame` is stubbed with a queue the tests flush by hand and
 * fake timers cover only `setTimeout` (vitest 4 fakes rAF by default, which
 * would make "before the frame callback runs" untestable).
 */
import { lazy, Suspense, use, useEffect, useMemo, useState, type ComponentType } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FreezeWhenHidden } from "../components/layout/FreezeWhenHidden";
import { ServiceSwitchLoader } from "../components/layout/ServiceSwitchLoader";
import { ServiceSwitchReady } from "../components/layout/ServiceSwitchReady";
import { LOADING_INDICATOR_DELAY_MS } from "../components/ui/misc/LoadingIndicator";
import { SWITCH_LOADER_DELAY_MS } from "../features/tasks/components/contents/base/TaskPreviewSwitchGate";
import {
    FAILSAFE_MS,
    getServiceSwitchTarget,
    PAINT_FALLBACK_MS,
    reportServiceActive,
    reportServiceInactive,
    resetServiceSwitchForTests,
    switchService,
    switchServiceOf,
} from "../services/serviceSwitch/serviceSwitchStore";

const media = vi.hoisted(() => ({ mobile: false }));
vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => media.mobile }));

const LABEL = "Loading data…";

// ---- manual frames ---------------------------------------------------------

let frames: Array<FrameRequestCallback | null> = [];
const pendingFrames = () => frames.filter(Boolean).length;
const flushFrames = () => {
    const batch = frames;
    frames = [];
    batch.forEach((cb) => cb?.(0));
};
/** A frame is painted: rAF callbacks run, then the `setTimeout(0)` that follows. */
const paint = () =>
    act(async () => {
        flushFrames();
        vi.advanceTimersByTime(0);
    });
/** Lets microtask-queued React work (and resolved promises) through. */
const settle = () =>
    act(async () => {
        await Promise.resolve();
    });
const advance = (ms: number) =>
    act(() => {
        vi.advanceTimersByTime(ms);
    });

// ---- harness: App.tsx's structure -----------------------------------------

type KeepAlive = "chat" | "tasks" | "notes";
type HomeComponent = ComponentType<{ isActiveRoute: boolean }>;

const renders: Record<string, number> = {};
const makeHome = (name: string): HomeComponent =>
    function Home({ isActiveRoute }) {
        renders[name] = (renders[name] ?? 0) + 1;
        return <div data-active={String(isActiveRoute)} data-testid={`home-${name}`} />;
    };

/** A Home whose chunk "downloads" until `resolve()` is called. */
const lazyHome = (name: string) => {
    let resolve!: () => void;
    const gate = new Promise<void>((r) => {
        resolve = r;
    });
    const Home = lazy(async () => {
        await gate;
        return { default: makeHome(name) };
    });
    return { Home: Home as unknown as HomeComponent, resolve };
};

/**
 * A Home that is already mounted (so its Suspense boundary is already
 * revealed) and then suspends when it becomes the active one. React keeps the
 * OLD screen up for such a transition instead of committing a fallback: the
 * state "the URL says B, B's render is still in flight, A is what the user
 * sees".
 */
const gatedHome = (name: string) => {
    const state: { hold: Promise<void> | null } = { hold: null };
    const Home: HomeComponent = function Gated({ isActiveRoute }) {
        if (isActiveRoute && state.hold) use(state.hold);
        return <div data-active={String(isActiveRoute)} data-testid={`home-${name}`} />;
    };
    /** From now on activating the Home suspends; returns the release. */
    const hold = () => {
        let release!: () => void;
        state.hold = new Promise<void>((resolve) => {
            release = () => {
                state.hold = null;
                resolve();
            };
        });
        return release;
    };
    return { Home, hold };
};

// Same derivation as App.tsx's `activeService`.
const activeServiceOf = (p: string): KeepAlive | "inbox" | null => {
    if (p.includes("/workspace/chat")) return "chat";
    if (p.includes("/workspace/tasks")) return "tasks";
    if (p.includes("/workspace/notes")) return "notes";
    if (p.includes("/workspace/inbox")) return "inbox";
    return null;
};

const KeepAliveHome = ({
    name,
    activeService,
    Home,
}: {
    name: KeepAlive;
    activeService: string | null;
    Home: HomeComponent;
}) => (
    <div style={{ display: activeService === name ? "contents" : "none" }}>
        <FreezeWhenHidden active={activeService === name}>
            <Suspense fallback={<div data-testid={`fallback-${name}`} />}>
                <Home isActiveRoute={activeService === name} />
                <ServiceSwitchReady active={activeService === name} service={name} />
            </Suspense>
        </FreezeWhenHidden>
    </div>
);

const RouteHome = ({ name, service }: { name: string; service: "inbox" | "genos" }) => (
    <Suspense fallback={null}>
        <div data-testid={`home-${name}`} />
        <ServiceSwitchReady service={service} active />
    </Suspense>
);

const NAV: Array<[string, string]> = [
    ["chat", "/workspace/chat"],
    ["tasks", "/workspace/tasks"],
    ["tasks-project", "/workspace/tasks/project/1"],
    ["notes", "/workspace/notes"],
    ["inbox", "/workspace/inbox"],
    ["genos", "/workspace/genos"],
    ["integrations", "/workspace/integrations"],
];

const Shell = ({ homes }: { homes: Record<KeepAlive, HomeComponent> }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const activeService = useMemo(() => activeServiceOf(location.pathname), [location.pathname]);
    // App.tsx's keep-alive mounting: a Home mounts on first visit and stays.
    const [mounted, setMounted] = useState<ReadonlySet<string>>(() => new Set());
    const toRender = useMemo(() => {
        if (activeService && activeService !== "inbox" && !mounted.has(activeService)) {
            return new Set(mounted).add(activeService);
        }
        return mounted;
    }, [mounted, activeService]);
    useEffect(() => {
        if (activeService && activeService !== "inbox" && !mounted.has(activeService)) {
            setMounted((prev) => new Set(prev).add(activeService));
        }
    }, [activeService, mounted]);

    return (
        <>
            <ServiceSwitchLoader />
            <div data-testid="path">{location.pathname}</div>
            {NAV.map(([id, path]) => (
                <button key={id} onClick={() => switchService(navigate, path)}>
                    {`go-${id}`}
                </button>
            ))}
            {(["chat", "tasks", "notes"] as const).map((name) =>
                toRender.has(name) ? (
                    <KeepAliveHome
                        key={name}
                        activeService={activeService}
                        Home={homes[name]}
                        name={name}
                    />
                ) : null
            )}
            <Routes>
                <Route
                    element={<RouteHome name="inbox" service="inbox" />}
                    path="/workspace/inbox/*"
                />
                <Route
                    element={<RouteHome name="genos" service="genos" />}
                    path="/workspace/genos"
                />
                <Route element={null} path="*" />
            </Routes>
        </>
    );
};

const mount = (
    homes: Partial<Record<KeepAlive, HomeComponent>> = {},
    start = "/workspace/chat"
) => {
    window.history.replaceState({}, "", start);
    return render(
        <CssVarsProvider>
            <BrowserRouter>
                <Shell
                    homes={{
                        chat: makeHome("chat"),
                        tasks: makeHome("tasks"),
                        notes: makeHome("notes"),
                        ...homes,
                    }}
                />
            </BrowserRouter>
        </CssVarsProvider>
    );
};

const click = (id: string) => fireEvent.click(screen.getByText(`go-${id}`));
const loader = () => screen.queryByRole("status");
const path = () => screen.getByTestId("path").textContent;

// Emotion keeps every rule it ever injected: read the rules of the element's
// own generated class, not the whole stylesheet.
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
    media.mobile = false;
    Object.keys(renders).forEach((k) => delete renders[k]);
});

afterEach(() => {
    cleanup();
    resetServiceSwitchForTests();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

/** Chat -> Tasks fully done, so both Homes are mounted and Tasks is on screen. */
const visitTasks = async () => {
    click("tasks");
    await paint(); // the frame: navigate
    await paint(); // the Home's ready frame: the loader hides
    expect(loader()).toBeNull();
    expect(path()).toBe("/workspace/tasks");
};

// ---------------------------------------------------------------------------

describe("switchServiceOf", () => {
    it("knows the five services, with sub-paths, queries and hashes", () => {
        expect(switchServiceOf("/workspace/chat")).toBe("chat");
        expect(switchServiceOf("/workspace/tasks/project/295/task/12")).toBe("tasks");
        expect(switchServiceOf("/workspace/notes?x=1")).toBe("notes");
        expect(switchServiceOf("/workspace/inbox#top")).toBe("inbox");
        expect(switchServiceOf("/workspace/genos")).toBe("genos");
    });

    it("is null for everything else, so those navigate straight through", () => {
        expect(switchServiceOf("/workspace")).toBeNull();
        expect(switchServiceOf("/workspace/integrations")).toBeNull();
        expect(switchServiceOf("/workspace/plans")).toBeNull();
        expect(switchServiceOf("/signin")).toBeNull();
    });
});

describe("the loader is painted before the switch render starts", () => {
    it("shows at once; URL and active Home stay put until the frame; the loader outlives the navigation; the Home's ready frame clears it", async () => {
        mount();
        await visitTasks();
        // Warm switch back to Chat (Chat is mounted and hidden).
        expect(screen.getByTestId("home-chat").dataset.active).toBe("false");

        click("chat");
        // BEFORE the frame callback runs: loader in the DOM, nothing navigated.
        const sheet = screen.getByRole("status");
        expect(sheet.getAttribute("aria-label")).toBe(LABEL);
        expect(screen.getByText(LABEL)).toBeTruthy();
        expect(pendingFrames()).toBe(1);
        expect(path()).toBe("/workspace/tasks");
        expect(window.location.pathname).toBe("/workspace/tasks");
        expect(screen.getByTestId("home-tasks").dataset.active).toBe("true");
        expect(screen.getByTestId("home-chat").dataset.active).toBe("false");

        // The frame is painted: navigate. The Home is active, the loader stays.
        await paint();
        expect(path()).toBe("/workspace/chat");
        expect(screen.getByTestId("home-chat").dataset.active).toBe("true");
        expect(screen.getByTestId("home-tasks").dataset.active).toBe("false");
        expect(loader()).not.toBeNull();

        // One frame after the Home is active and committed: gone.
        await paint();
        expect(loader()).toBeNull();
        expect(pendingFrames()).toBe(0);
    });

    it("works for all five services, the route-driven Inbox and Genos included", async () => {
        mount();
        for (const [id, expected] of [
            ["inbox", "/workspace/inbox"],
            ["genos", "/workspace/genos"],
            ["notes", "/workspace/notes"],
            ["chat", "/workspace/chat"],
        ] as const) {
            click(id);
            expect(loader()).not.toBeNull();
            await paint();
            expect(path()).toBe(expected);
            expect(loader()).not.toBeNull();
            await paint();
            expect(loader()).toBeNull();
        }
    });

    it("re-renders nothing but the loader when it appears", async () => {
        mount();
        await visitTasks();
        const before = { ...renders };
        click("chat");
        expect(loader()).not.toBeNull();
        expect(renders).toEqual(before);
    });

    it("never takes focus", () => {
        mount();
        const button = screen.getByText("go-tasks");
        button.focus();
        click("tasks");
        const sheet = screen.getByRole("status");
        expect(sheet.hasAttribute("tabindex")).toBe(false);
        expect(document.activeElement).toBe(button);
        expect(sheet.getAttribute("aria-busy")).toBe("true");
    });
});

describe("how the loader looks", () => {
    it("surface at once; dots and caption wait 150ms (CSS), with a reduced-motion step that keeps the delay", () => {
        mount();
        click("tasks");
        const sheet = screen.getByRole("status");
        const surface = cssOf(sheet);
        // The surface: the Homes' own look, no delay, no entrance animation.
        // (Flat canvas token since MIP-1118; it was a vertical gradient.)
        expect(surface).toMatch(/background:var\(--gp-(dark|light)-bg\)/);
        expect(surface).not.toMatch(/gradient/);
        expect(surface).not.toMatch(/\d+ms both/);
        expect(surface).not.toContain("slideIn");
        // sheet children: two decor boxes, the dots, then the caption.
        const delayed = new RegExp(`0\\.2s ease-out ${LOADING_INDICATOR_DELAY_MS}ms both`);
        for (const el of [sheet.children[2] as HTMLElement, screen.getByText(LABEL)]) {
            const css = cssOf(el);
            expect(css).toMatch(delayed);
            expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
            expect(css).toMatch(new RegExp(`1ms linear ${LOADING_INDICATOR_DELAY_MS}ms both`));
        }
        // One delay for both switch loaders (MIP-962's task switch and this).
        expect(LOADING_INDICATOR_DELAY_MS).toBe(150);
        expect(LOADING_INDICATOR_DELAY_MS).toBe(SWITCH_LOADER_DELAY_MS);
        // The decor boxes are part of the surface: not delayed.
        expect(cssOf(sheet.children[0] as HTMLElement)).not.toMatch(/\d+ms both/);
    });

    it("desktop: covers the content area only; the rail stays clickable; right-to-left safe", () => {
        mount();
        click("tasks");
        const css = cssOf(screen.getByRole("status"));
        expect(css).toContain("position:fixed");
        expect(css).toContain("inset-inline-start:var(--Sidebar-width, 68px)");
        expect(css).toContain("inset-inline-end:0");
        expect(css).toContain("top:0");
        expect(css).toContain("bottom:0");
        // Above the Homes, below the tab bar (1200) and the modals (1300).
        expect(css).toContain("z-index:1100");
        // Logical properties only: no physical left/right on the loader itself.
        expect(css).not.toMatch(/(^|[;{])(left|right):/);
    });

    it("mobile: full width above the bottom tab bar", () => {
        media.mobile = true;
        mount();
        click("tasks");
        const css = cssOf(screen.getByRole("status"));
        expect(css).toContain("inset-inline-start:0");
        expect(css).toContain("inset-inline-end:0");
        expect(css).toContain("bottom:var(--BottomTabBar-height, 60px)");
        expect(css).toContain("z-index:1100");
    });
});

describe("no loader when nothing is switching", () => {
    it("navigates inside the current service straight through", async () => {
        mount();
        await visitTasks();
        click("tasks-project");
        expect(loader()).toBeNull();
        expect(path()).toBe("/workspace/tasks/project/1");
        expect(pendingFrames()).toBe(0);
    });

    it("navigates to a page that is not one of the five services straight through", () => {
        mount();
        click("integrations");
        expect(loader()).toBeNull();
        expect(path()).toBe("/workspace/integrations");
        expect(pendingFrames()).toBe(0);
    });
});

describe("quick clicks", () => {
    it("A -> B -> C before the frame: only C is navigated to, and only C clears it", async () => {
        mount();
        const startEntries = window.history.length;
        click("tasks");
        click("notes");
        expect(loader()).not.toBeNull();
        expect(pendingFrames()).toBe(1); // B's frame wait was dropped
        await paint();
        // B was never visited.
        expect(path()).toBe("/workspace/notes");
        expect(window.history.length).toBe(startEntries + 1);
        expect(screen.queryByTestId("home-tasks")).toBeNull();
        expect(loader()).not.toBeNull();
        await paint();
        expect(loader()).toBeNull();
    });

    it("B has committed and is waiting for its ready frame when C is clicked: B does not clear C's loader", async () => {
        mount();
        click("tasks");
        await paint(); // navigate(B); B commits and reports; its ready frame is pending
        expect(path()).toBe("/workspace/tasks");
        expect(loader()).not.toBeNull();
        expect(pendingFrames()).toBe(1);

        click("notes");
        // B's pending hide was cancelled; only C's navigation frame is queued.
        expect(pendingFrames()).toBe(1);
        await paint(); // navigate(C); C reports; its ready frame is pending
        expect(path()).toBe("/workspace/notes");
        expect(loader()).not.toBeNull();
        await paint();
        expect(loader()).toBeNull();
    });

    it("B's chunk arriving after C was chosen does not disturb C", async () => {
        const tasks = lazyHome("tasks");
        mount({ tasks: tasks.Home });
        click("tasks");
        await paint(); // navigate(B): its chunk is still loading
        click("notes");
        await paint(); // navigate(C): C commits, its ready frame is pending
        expect(path()).toBe("/workspace/notes");
        expect(loader()).not.toBeNull();

        await act(async () => {
            tasks.resolve(); // B arrives late, mounts hidden
            await Promise.resolve();
        });
        // Whatever B does, it is not the target: C's loader stays until C's frame.
        expect(loader()).not.toBeNull();
        await paint();
        expect(loader()).toBeNull();
        expect(screen.getByTestId("home-notes").dataset.active).toBe("true");
        // B's superseded navigation never mounted it as the active Home.
        expect(screen.queryByTestId("home-tasks")?.dataset.active).not.toBe("true");
    });

    it("a Home that finishes AFTER the user chose another service does not clear the loader (store level)", () => {
        // The race: B's render finishes and B reports ready while C is already
        // the target. Driven through the store because React's act cannot
        // reproduce a render that completes between two clicks.
        const navigate = vi.fn();
        window.history.replaceState({}, "", "/workspace/chat");
        reportServiceActive("chat");
        switchService(navigate, "/workspace/tasks"); // B
        act(() => {
            flushFrames();
            vi.advanceTimersByTime(0);
        });
        expect(navigate).toHaveBeenCalledWith("/workspace/tasks");
        switchService(navigate, "/workspace/notes"); // C, before B has reported
        expect(getServiceSwitchTarget()).toBe("notes");

        reportServiceInactive("chat");
        reportServiceActive("tasks"); // B arrives late
        act(() => {
            flushFrames();
            vi.advanceTimersByTime(PAINT_FALLBACK_MS);
        });
        // B's ready frame came and went; the loader still waits for C.
        expect(getServiceSwitchTarget()).toBe("notes");

        reportServiceInactive("tasks");
        reportServiceActive("notes");
        act(() => {
            flushFrames();
        });
        expect(getServiceSwitchTarget()).toBeNull();
    });

    it("A -> B -> A: going back to the service that is still on screen clears the loader at once", async () => {
        const tasks = gatedHome("tasks");
        mount({ tasks: tasks.Home }, "/workspace/tasks");
        click("chat");
        await paint();
        await paint();
        expect(loader()).toBeNull();
        expect(path()).toBe("/workspace/chat");
        const release = tasks.hold(); // B's render will not finish until released

        click("tasks");
        await paint(); // navigate(B): the URL is B's, the screen is still A's
        expect(window.location.pathname).toBe("/workspace/tasks");
        expect(path()).toBe("/workspace/chat");
        expect(screen.getByTestId("home-chat").dataset.active).toBe("true");
        expect(loader()).not.toBeNull();

        click("chat");
        // Chat IS what is on screen: nothing to switch, nothing to wait for.
        // Without this the loader would sit here until the failsafe, because
        // Chat's active flag never flipped and so its marker never fires.
        // (`settle`: React's act defers the loader's update while the other
        // render is parked on a promise; a microtask flush lets it through.)
        await settle();
        expect(loader()).toBeNull();
        expect(window.location.pathname).toBe("/workspace/chat");
        expect(pendingFrames()).toBe(0);

        // The abandoned render finishing later brings nothing back.
        act(() => {
            release();
        });
        await settle();
        await paint();
        await paint();
        expect(loader()).toBeNull();
        expect(screen.getByTestId("home-chat").dataset.active).toBe("true");
        advance(FAILSAFE_MS);
        expect(loader()).toBeNull();
    });
});

describe("a cold switch (the Home's chunk is still downloading)", () => {
    it("keeps the loader up through the fallback and hides it one frame after the Home mounts", async () => {
        const tasks = lazyHome("tasks");
        mount({ tasks: tasks.Home });
        click("tasks");
        await paint(); // navigate
        // The lazy Home has not arrived: however many frames pass, the loader stays.
        await paint();
        await paint();
        expect(loader()).not.toBeNull();
        expect(screen.queryByTestId("home-tasks")).toBeNull();

        await act(async () => {
            tasks.resolve();
            await Promise.resolve();
        });
        expect(screen.getByTestId("home-tasks").dataset.active).toBe("true");
        // The Home is in; its ready frame has not run yet.
        expect(loader()).not.toBeNull();
        await paint();
        expect(loader()).toBeNull();
    });
});

describe("Back / Forward (best effort)", () => {
    const popTo = (to: string) =>
        act(() => {
            window.history.pushState({}, "", to);
            window.dispatchEvent(new PopStateEvent("popstate"));
        });

    it("shows the loader for a pop to another service, then clears it once that Home is on screen", async () => {
        mount();
        await visitTasks();
        popTo("/workspace/chat");
        // The URL already changed and the router followed in the same event.
        expect(loader()).not.toBeNull();
        expect(path()).toBe("/workspace/chat");
        await paint();
        expect(loader()).toBeNull();
    });

    it("a pop from a page outside the five (Integrations) back to Tasks is a real switch", async () => {
        mount();
        await visitTasks();
        click("integrations"); // Tasks is hidden now; nothing is "on screen"
        expect(loader()).toBeNull();
        popTo("/workspace/tasks");
        expect(loader()).not.toBeNull();
        await paint();
        expect(loader()).toBeNull();
    });

    it("a pop inside the service on screen shows nothing", async () => {
        mount();
        await visitTasks();
        click("tasks-project");
        popTo("/workspace/tasks");
        expect(loader()).toBeNull();
    });

    it("a pop away from a pending switch to a page outside the five drops the loader", () => {
        mount();
        click("tasks"); // loader up, waiting for its frame
        expect(loader()).not.toBeNull();
        popTo("/workspace/integrations");
        expect(loader()).toBeNull();
        expect(pendingFrames()).toBe(0);
    });
});

describe("safety nets", () => {
    it("failsafe: a Home that never reports ready cannot leave the loader up past 10s", async () => {
        const tasks = lazyHome("tasks"); // never resolved
        mount({ tasks: tasks.Home });
        click("tasks");
        await paint();
        advance(FAILSAFE_MS - 1);
        expect(loader()).not.toBeNull();
        advance(1);
        expect(loader()).toBeNull();
    });

    it("hidden tab: no frame ever fires, the fallback timer still navigates (and later hides)", () => {
        mount();
        click("tasks");
        expect(path()).toBe("/workspace/chat");
        advance(PAINT_FALLBACK_MS - 1);
        expect(path()).toBe("/workspace/chat");
        advance(1);
        // rAF never ran; the click still went through.
        expect(path()).toBe("/workspace/tasks");
        expect(loader()).not.toBeNull();
        advance(PAINT_FALLBACK_MS);
        expect(loader()).toBeNull();
    });

    it("navigates in the task AFTER the painted frame, not inside the frame callback", async () => {
        mount();
        click("tasks");
        // The rAF callback runs before the frame is painted: still nothing.
        await act(async () => {
            flushFrames();
        });
        expect(path()).toBe("/workspace/chat");
        expect(loader()).not.toBeNull();
        // The task queued after it runs once the frame is out.
        advance(0);
        expect(path()).toBe("/workspace/tasks");
    });

    it("navigates exactly once when both the frame and the fallback fire", async () => {
        mount();
        const startEntries = window.history.length;
        click("tasks");
        await paint(); // frame + settle timer: navigates
        advance(PAINT_FALLBACK_MS * 2); // the fallback must have been cancelled
        expect(window.history.length).toBe(startEntries + 1);
    });
});

describe("afterNavigate", () => {
    it("runs right after the navigation, in the same tick, a frame later for a real switch", () => {
        const calls: string[] = [];
        const navigate = vi.fn((to: string) => {
            calls.push(`navigate ${to}`);
        });
        window.history.replaceState({}, "", "/workspace/chat");
        switchService(navigate, "/workspace/tasks", () => calls.push("after"));
        expect(calls).toEqual([]); // not before the frame
        act(() => {
            flushFrames();
            vi.advanceTimersByTime(0);
        });
        expect(calls).toEqual(["navigate /workspace/tasks", "after"]);
    });

    it("runs at once, after the navigation, when nothing is switching", () => {
        const calls: string[] = [];
        const navigate = vi.fn((to: string) => {
            calls.push(`navigate ${to}`);
        });
        switchService(navigate, "/workspace/integrations", () => calls.push("after"));
        expect(calls).toEqual(["navigate /workspace/integrations", "after"]);
    });
});
