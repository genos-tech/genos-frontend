/**
 * MIP-971: a hidden Chat / Tasks / Notes screen must not re-render when the
 * URL changes.
 *
 * `FreezeWhenHidden` already skips a hidden screen when `AppBody` re-renders,
 * but react-router's `RouteContext` / `LocationContext` values change on every
 * navigation and a context change passes straight through a `memo`, so in the
 * browser one task click still re-rendered about 14,000 components in the two
 * screens nobody could see. `FreezeRouterWhenHidden` re-provides both contexts
 * to the screen and holds the last live values while it is hidden.
 *
 * The lesson of the previous round was that a test of ONE instance proves
 * nothing about a component that the app mounts in several places at once. So
 * this file builds the real shape: the app's own router (`BrowserRouter`), the
 * route that renders the body at `/workspace/*` (that is what makes
 * `RouteContext` a fresh value on every navigation), a body that derives the
 * active service from the pathname and mounts three keep-alive screens the way
 * `AppBody` does, each wrapped in the real `FreezeWhenHidden` and the real
 * `FreezeRouterWhenHidden`. Every screen is a stub that reads the router the way
 * the real ones do (`useLocation`, `useNavigate`, `useParams` at its root, plus
 * memoized leaves that read one hook each, plus plain children that re-render
 * whenever the root does) and counts its own renders. The counter THROWS past a
 * limit, so a render loop fails the test at once instead of hanging it.
 *
 * The `controls` block runs the same scenario with the freeze missing, or with
 * only one of the two contexts frozen, and expects the counts to go up: that is
 * what proves the harness can see the bug, and that it sees both contexts.
 *
 * One block also counts the way the browser perf harness does: a React DevTools
 * commit hook that walks every commit and counts the component fibers React
 * marked `PerformedWork`, split into those under a `display: none` host and the
 * rest. That is the number the "~14,000 component updates per click" came from.
 */

import {
    createContext,
    lazy,
    memo,
    StrictMode,
    Suspense,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ComponentType,
    type ReactNode,
} from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
    BrowserRouter,
    Route,
    Routes,
    UNSAFE_LocationContext,
    UNSAFE_NavigationContext,
    UNSAFE_RouteContext,
    useInRouterContext,
    useLocation,
    useNavigate,
    useParams,
    useResolvedPath,
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FreezeRouterWhenHidden } from "../components/layout/FreezeRouterWhenHidden";
import { FreezeWhenHidden } from "../components/layout/FreezeWhenHidden";

// ---- the browser harness's own counting ------------------------------------

// Hoisted so it exists before react-dom loads and can register as the DevTools
// hook. Same rule as the perf harness: on each commit, walk the fibers that
// changed and count the component fibers with the `PerformedWork` flag
// (function, class, forwardRef, memo, simple memo), by whether a `display: none`
// host sits above them.
const fiberCount = vi.hoisted(() => {
    type Fiber = {
        tag: number;
        flags: number;
        child: Fiber | null;
        sibling: Fiber | null;
        alternate: Fiber | null;
        memoizedProps: { style?: { display?: string } } | null;
        type: { displayName?: string; name?: string } | null;
    };
    const state = {
        on: false,
        hidden: 0,
        visible: 0,
        hiddenBy: {} as Record<string, number>,
        visibleBy: {} as Record<string, number>,
    };
    const walk = (n: Fiber, prev: Fiber | null, hidden: boolean) => {
        if (n.tag === 5 && n.memoizedProps?.style?.display === "none") hidden = true;
        const isComponent = [0, 1, 11, 14, 15].includes(n.tag);
        if (isComponent && prev && n.flags & 1) {
            const name = n.type?.displayName || n.type?.name || "anonymous";
            const by = hidden ? state.hiddenBy : state.visibleBy;
            by[name] = (by[name] ?? 0) + 1;
            if (hidden) state.hidden += 1;
            else state.visible += 1;
        }
        // Unchanged subtree: nothing below it rendered.
        if (prev && n.child === prev.child) return;
        for (let c = n.child; c; c = c.sibling) walk(c, c.alternate, hidden);
    };
    (globalThis as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        supportsFiber: true,
        isDisabled: false,
        renderers: new Map(),
        inject: () => 1,
        onCommitFiberRoot: (_id: number, root: { current: Fiber }) => {
            if (state.on) walk(root.current, root.current.alternate, false);
        },
        onCommitFiberUnmount: () => {},
        onPostCommitFiberRoot: () => {},
        checkDCE: () => {},
    };
    return state;
});

/** Component updates (hidden, visible) caused by `fn`, counted as the harness does. */
const measureFibers = (fn: () => void) => {
    fiberCount.hidden = 0;
    fiberCount.visible = 0;
    fiberCount.hiddenBy = {};
    fiberCount.visibleBy = {};
    fiberCount.on = true;
    try {
        fn();
    } finally {
        fiberCount.on = false;
    }
    return {
        hidden: fiberCount.hidden,
        hiddenBy: { ...fiberCount.hiddenBy },
        visible: fiberCount.visible,
        visibleBy: { ...fiberCount.visibleBy },
    };
};

// ---- render counting that fails fast ---------------------------------------

// What is counted is COMMITTED renders: a no-deps effect runs only when the
// component really re-rendered. Counting calls of the function body would be
// wrong here: React 19 lazily propagates a context change down from EVERY
// provider above, shadowed or not, so each consumer under a frozen provider is
// still called once per navigation and then bails out (its value did not
// change) without re-rendering its children or committing. Those calls are not
// updates, they set no `PerformedWork`, and they are not what this guards.
const RENDER_LIMIT = 300;
const counts = new Map<string, number>();
const bump = (key: string) => {
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    if (n > RENDER_LIMIT) {
        throw new Error(`${key} rendered more than ${RENDER_LIMIT} times: render loop`);
    }
};
/** Call once in a component: counts its committed renders under `key`. */
const useRendered = (key: string) => {
    useEffect(() => {
        bump(key);
    });
};
const count = (key: string) => counts.get(key) ?? 0;
const snapshot = () => new Map(counts);
/** Renders of one screen since `before`. */
const since = (before: Map<string, number>, name: string) =>
    [...counts]
        .filter(([k]) => k.startsWith(`${name}:`))
        .reduce((sum, [k, n]) => sum + n - (before.get(k) ?? 0), 0);
const sinceKey = (before: Map<string, number>, key: string) => count(key) - (before.get(key) ?? 0);

// ---- the screens -----------------------------------------------------------

type Svc = "chat" | "tasks" | "notes";
const SERVICES: Svc[] = ["chat", "tasks", "notes"];

type Seen = { path: string; active: boolean };
const seen: Record<string, Seen[]> = {};
const pathEffects: Record<string, string[]> = {};
const navigateChanges: Record<string, number> = {};
const navigationContexts: unknown[] = [];

const ThemeCtx = createContext("light");

// Memoized leaves: no props change, so only a context change re-renders them.
const LocationLeaf = memo(function LocationLeaf({ name }: { name: string }) {
    useRendered(`${name}:location`);
    useLocation();
    return null;
});
const ParamsLeaf = memo(function ParamsLeaf({ name }: { name: string }) {
    useRendered(`${name}:params`);
    useParams();
    return null;
});
const NavigateLeaf = memo(function NavigateLeaf({ name }: { name: string }) {
    useRendered(`${name}:navigate`);
    useNavigate();
    return null;
});
const ResolvedLeaf = memo(function ResolvedLeaf({ name }: { name: string }) {
    useRendered(`${name}:resolved`);
    useResolvedPath("x");
    return null;
});
const NavigationLeaf = memo(function NavigationLeaf({ name }: { name: string }) {
    useRendered(`${name}:navigation`);
    useLocation();
    navigationContexts.push(useContext(UNSAFE_NavigationContext));
    return null;
});
// Not memoized: re-renders whenever the screen root does, like most of the real
// screen (it takes the managers as fresh props).
const Plain = ({ name }: { name: string }) => {
    useRendered(`${name}:plain`);
    return null;
};

const PLAIN_CHILDREN = 25;

type HomeProps = { name: Svc; isActiveRoute: boolean };

const Home = ({ name, isActiveRoute }: HomeProps) => {
    useRendered(`${name}:root`);
    const location = useLocation();
    const navigate = useNavigate();
    const params = useParams();
    const theme = useContext(ThemeCtx);
    const inRouter = useInRouterContext();
    const [own, setOwn] = useState(0);
    useEffect(() => {
        (seen[name] ??= []).push({ path: location.pathname, active: isActiveRoute });
    });
    useEffect(() => {
        (pathEffects[name] ??= []).push(location.pathname);
    }, [name, location.pathname]);
    useEffect(() => {
        navigateChanges[name] = (navigateChanges[name] ?? 0) + 1;
    }, [name, navigate]);
    return (
        <section
            data-active={String(isActiveRoute)}
            data-in-router={String(inRouter)}
            data-own={own}
            data-path={location.pathname}
            data-splat={params["*"]}
            data-testid={name}
            data-theme={theme}
        >
            <button data-testid={`${name}-own`} onClick={() => setOwn((n) => n + 1)} />
            <button data-testid={`${name}-go`} onClick={() => navigate("/workspace/inbox/9")} />
            <LocationLeaf name={name} />
            <ParamsLeaf name={name} />
            <NavigateLeaf name={name} />
            <ResolvedLeaf name={name} />
            <NavigationLeaf name={name} />
            {Array.from({ length: PLAIN_CHILDREN }, (_, i) => (
                <Plain key={i} name={name} />
            ))}
        </section>
    );
};

// ---- the app's shape -------------------------------------------------------

type Freezer = ComponentType<{ active: boolean; children: ReactNode }>;

/**
 * What `AppBody` does with the three screens: derive the active service from
 * the pathname (same rule as `activeService`), mount a screen the first time
 * it is active and keep it mounted (`homesToRender`), hide it with
 * `display: none`, and wrap it in the two freeze components.
 */
const Body = ({
    Freezer,
    components = {},
}: {
    Freezer: Freezer;
    components?: Partial<Record<Svc, ComponentType<HomeProps>>>;
}) => {
    const location = useLocation();
    const activeService = useMemo<Svc | null>(() => {
        const p = location.pathname;
        if (p.includes("/workspace/chat")) return "chat";
        if (p.includes("/workspace/tasks")) return "tasks";
        if (p.includes("/workspace/notes")) return "notes";
        return null;
    }, [location.pathname]);
    const [mounted, setMounted] = useState<ReadonlySet<string>>(() => new Set());
    const homesToRender = useMemo<ReadonlySet<string>>(
        () =>
            activeService && !mounted.has(activeService)
                ? new Set(mounted).add(activeService)
                : mounted,
        [mounted, activeService]
    );
    useEffect(() => {
        if (activeService && !mounted.has(activeService)) {
            setMounted((prev) => new Set(prev).add(activeService));
        }
    }, [activeService, mounted]);

    return (
        <>
            <Routes>
                <Route element={null} path="*" />
            </Routes>
            {SERVICES.filter((svc) => homesToRender.has(svc)).map((svc) => {
                const Screen = components[svc] ?? Home;
                const active = activeService === svc;
                return (
                    <div key={svc} style={{ display: active ? "contents" : "none" }}>
                        <FreezeWhenHidden active={active}>
                            <Freezer active={active}>
                                <Suspense fallback={null}>
                                    <Screen isActiveRoute={active} name={svc} />
                                </Suspense>
                            </Freezer>
                        </FreezeWhenHidden>
                    </div>
                );
            })}
        </>
    );
};

let go: (to: string) => void = () => {};
// Sits in the router but outside the frozen screens, like the sidebar and the
// rail do. Re-renders on every navigation; that is fine, it is not a screen.
const Driver = () => {
    const navigate = useNavigate();
    go = navigate;
    return null;
};
const visit = (to: string) =>
    act(() => {
        go(to);
    });

let setTheme: (theme: string) => void = () => {};
const ThemeHost = ({ children }: { children: ReactNode }) => {
    const [theme, set] = useState("light");
    setTheme = set;
    return <ThemeCtx.Provider value={theme}>{children}</ThemeCtx.Provider>;
};

const mount = (
    start: string,
    opts: {
        Freezer?: Freezer;
        strict?: boolean;
        components?: Partial<Record<Svc, ComponentType<HomeProps>>>;
    } = {}
) => {
    window.history.replaceState({}, "", start);
    const body = (
        <Body components={opts.components} Freezer={opts.Freezer ?? FreezeRouterWhenHidden} />
    );
    const tree = (
        <ThemeHost>
            <BrowserRouter>
                <Driver />
                <Routes>
                    <Route element={body} path="/workspace/*" />
                </Routes>
            </BrowserRouter>
        </ThemeHost>
    );
    return render(opts.strict ? <StrictMode>{tree}</StrictMode> : tree);
};

const attr = (name: Svc, a: string) => screen.getByTestId(name).getAttribute(a);

beforeEach(() => {
    counts.clear();
    for (const k of Object.keys(seen)) delete seen[k];
    for (const k of Object.keys(pathEffects)) delete pathEffects[k];
    for (const k of Object.keys(navigateChanges)) delete navigateChanges[k];
    navigationContexts.length = 0;
});
afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
});

/** Chat and Tasks hidden, Notes active at /workspace/notes/1. */
const visitAll = () => {
    mount("/workspace/chat/dm/1");
    visit("/workspace/tasks/project/1");
    visit("/workspace/notes/1");
};

// ---- the behaviour ---------------------------------------------------------

describe("FreezeRouterWhenHidden: several screens in one router", () => {
    it("starts with the expected harness shape", () => {
        visitAll();
        expect(attr("chat", "data-active")).toBe("false");
        expect(attr("tasks", "data-active")).toBe("false");
        expect(attr("notes", "data-active")).toBe("true");
        expect(attr("notes", "data-path")).toBe("/workspace/notes/1");
    });

    it("renders nothing in the hidden screens on navigation, while the active one follows it", () => {
        visitAll();
        const before = snapshot();
        for (let i = 2; i <= 6; i += 1) visit(`/workspace/notes/${i}`);

        // Not one component of either hidden screen, root, leaves or plain
        // children: this is the ~14,000 updates per click.
        expect(since(before, "chat")).toBe(0);
        expect(since(before, "tasks")).toBe(0);
        // The active screen still follows every navigation, with the live URL.
        expect(sinceKey(before, "notes:root")).toBeGreaterThanOrEqual(5);
        expect(attr("notes", "data-path")).toBe("/workspace/notes/6");
        expect(attr("notes", "data-splat")).toBe("notes/6");
    });

    it("also renders nothing in hidden screens when navigating between other places", () => {
        visitAll();
        const before = snapshot();
        visit("/workspace/inbox/3");
        visit("/workspace/genos");
        visit("/workspace/inbox/4");
        // Notes is hidden by the first of those; chat and tasks stay frozen.
        expect(since(before, "chat")).toBe(0);
        expect(since(before, "tasks")).toBe(0);
        // Notes got exactly the render that hid it, nothing after.
        expect(sinceKey(before, "notes:root")).toBe(1);
    });

    it("the render that hides a screen sees the URL that hid it, with isActiveRoute = false", () => {
        mount("/workspace/tasks/project/1");
        const before = snapshot();
        visit("/workspace/chat/dm/5");

        expect(sinceKey(before, "tasks:root")).toBe(1);
        const last = seen.tasks[seen.tasks.length - 1];
        expect(last).toEqual({ path: "/workspace/chat/dm/5", active: false });
        expect(attr("tasks", "data-path")).toBe("/workspace/chat/dm/5");
    });

    it("then keeps showing that URL however far the app navigates", () => {
        mount("/workspace/tasks/project/1");
        visit("/workspace/chat/dm/5");
        const before = snapshot();
        visit("/workspace/notes/1");
        visit("/workspace/notes/2");
        visit("/workspace/inbox/7");
        expect(since(before, "tasks")).toBe(0);
        expect(attr("tasks", "data-path")).toBe("/workspace/chat/dm/5");
        expect(attr("tasks", "data-splat")).toBe("chat/dm/5");
    });

    it("shows a hidden screen the CURRENT route in a single render when it comes back", () => {
        visitAll();
        for (let i = 2; i <= 6; i += 1) visit(`/workspace/notes/${i}`);
        const before = snapshot();

        visit("/workspace/tasks/project/9/task/44");

        // One render of the root and one of each leaf that reads the router,
        // and all of the plain children once: a single catch-up render.
        expect(sinceKey(before, "tasks:root")).toBe(1);
        expect(sinceKey(before, "tasks:location")).toBe(1);
        expect(sinceKey(before, "tasks:params")).toBe(1);
        expect(sinceKey(before, "tasks:navigate")).toBe(1);
        expect(sinceKey(before, "tasks:resolved")).toBe(1);
        expect(sinceKey(before, "tasks:plain")).toBe(PLAIN_CHILDREN);
        const last = seen.tasks[seen.tasks.length - 1];
        expect(last).toEqual({ path: "/workspace/tasks/project/9/task/44", active: true });
        expect(attr("tasks", "data-splat")).toBe("tasks/project/9/task/44");
        // The screen it left (notes) got its hide render and chat none.
        expect(sinceKey(before, "notes:root")).toBe(1);
        expect(sinceKey(before, "chat:root")).toBe(0);
    });

    it("does not fire location effects or navigate-dependent effects while hidden", () => {
        mount("/workspace/tasks/project/1");
        visit("/workspace/chat/dm/5"); // hides tasks
        const effectsAtHide = [...pathEffects.tasks];
        const navigateAtHide = navigateChanges.tasks;
        for (let i = 1; i <= 8; i += 1) visit(`/workspace/notes/${i}`);
        visit("/workspace/inbox/2");

        expect(pathEffects.tasks).toEqual(effectsAtHide);
        expect(effectsAtHide).toEqual(["/workspace/tasks/project/1", "/workspace/chat/dm/5"]);
        expect(navigateChanges.tasks).toBe(navigateAtHide);
    });

    it("fires the location effect when the screen is shown again, even at the URL it was hidden from", () => {
        mount("/workspace/tasks/project/1");
        visit("/workspace/chat/dm/5");
        visit("/workspace/notes/3");
        visit("/workspace/tasks/project/1"); // exactly where it started
        expect(pathEffects.tasks).toEqual([
            "/workspace/tasks/project/1",
            "/workspace/chat/dm/5",
            "/workspace/tasks/project/1",
        ]);
    });

    it("gives a screen mounted while active the live URL from its first render", () => {
        mount("/workspace/notes/5");
        expect(seen.notes[0]).toEqual({ path: "/workspace/notes/5", active: true });
        expect(attr("notes", "data-splat")).toBe("notes/5");
    });

    it("gives a screen visited for the first time the live URL, not a stale one", () => {
        mount("/workspace/tasks/project/1");
        visit("/workspace/inbox/1");
        visit("/workspace/inbox/2");
        visit("/workspace/chat/dm/3");
        expect(seen.chat[0]).toEqual({ path: "/workspace/chat/dm/3", active: true });
        expect(attr("chat", "data-splat")).toBe("chat/dm/3");
    });

    it("lets a hidden screen navigate with an absolute path", () => {
        visitAll();
        // The hidden chat screen's navigate() is the one it got when it was hidden.
        fireEvent.click(screen.getByTestId("chat-go"));
        expect(window.location.pathname).toBe("/workspace/inbox/9");
        // And nobody was left stale by it: notes (active before) was hidden by it.
        expect(attr("notes", "data-active")).toBe("false");
    });

    it("hands a hidden screen the same navigate function for as long as it is hidden", () => {
        visitAll();
        const before = snapshot();
        const changes = navigateChanges.chat;
        for (let i = 2; i <= 4; i += 1) visit(`/workspace/notes/${i}`);
        expect(sinceKey(before, "chat:navigate")).toBe(0);
        expect(navigateChanges.chat).toBe(changes);
    });

    it("still lets a hidden screen update its own state, rendering with the frozen URL", () => {
        visitAll();
        for (let i = 2; i <= 4; i += 1) visit(`/workspace/notes/${i}`);
        const before = snapshot();
        fireEvent.click(screen.getByTestId("chat-own"));
        expect(attr("chat", "data-own")).toBe("1");
        expect(sinceKey(before, "chat:root")).toBe(1);
        // Frozen at the render that hid it (chat -> tasks).
        expect(attr("chat", "data-path")).toBe("/workspace/tasks/project/1");
    });

    it("still delivers other context changes (theme) to a hidden screen", () => {
        visitAll();
        act(() => setTheme("dark"));
        expect(attr("chat", "data-theme")).toBe("dark");
        expect(attr("tasks", "data-theme")).toBe("dark");
    });

    it("keeps the router available to a hidden screen", () => {
        visitAll();
        act(() => setTheme("dark")); // re-renders the hidden screens
        expect(attr("chat", "data-theme")).toBe("dark");
        expect(attr("chat", "data-in-router")).toBe("true");
    });

    it("works under StrictMode too", () => {
        mount("/workspace/chat/dm/1", { strict: true });
        visit("/workspace/tasks/project/1");
        visit("/workspace/notes/1");
        const before = snapshot();
        for (let i = 2; i <= 5; i += 1) visit(`/workspace/notes/${i}`);
        expect(since(before, "chat")).toBe(0);
        expect(since(before, "tasks")).toBe(0);
        const mid = snapshot();
        visit("/workspace/chat/dm/8");
        expect(sinceKey(mid, "chat:root")).toBeGreaterThanOrEqual(1);
        expect(attr("chat", "data-path")).toBe("/workspace/chat/dm/8");
        expect(attr("chat", "data-active")).toBe("true");
    });

    it("holds the values of the hide render for a screen whose code finishes loading while hidden", async () => {
        let release: () => void = () => {};
        const LazyHome = lazy(
            () =>
                new Promise<{ default: ComponentType<HomeProps> }>((resolve) => {
                    release = () => resolve({ default: Home });
                })
        );
        mount("/workspace/chat/dm/1", { components: { tasks: LazyHome } });
        visit("/workspace/tasks/project/1"); // the chunk starts loading
        visit("/workspace/notes/1"); // the user leaves before it arrives
        expect(counts.get("tasks:root")).toBeUndefined();

        await act(async () => release());
        // First ever render of the screen, and it happens while hidden: it sees
        // the URL that hid it, not a later one and not the one it was asked for.
        expect(seen.tasks[0]).toEqual({ path: "/workspace/notes/1", active: false });
        const before = snapshot();
        visit("/workspace/notes/2");
        visit("/workspace/notes/3");
        expect(since(before, "tasks")).toBe(0);

        visit("/workspace/tasks/project/2");
        expect(attr("tasks", "data-path")).toBe("/workspace/tasks/project/2");
    });

    it("leaves react-router's NavigationContext alone because it does not change on navigation", () => {
        // `FreezeRouterWhenHidden` does not freeze it. This pins the reason: if a
        // router upgrade makes its value change per navigation, hidden screens
        // would start following it again and this fails, saying why.
        visitAll();
        navigationContexts.length = 0;
        for (let i = 2; i <= 4; i += 1) visit(`/workspace/notes/${i}`);
        const distinct = new Set(navigationContexts);
        expect(navigationContexts.length).toBeGreaterThan(0);
        expect(distinct.size).toBe(1);
    });

    it("the routing contexts DO change on every navigation (what this component exists for)", () => {
        // A canary for the premise: if react-router stopped re-creating these,
        // the freeze would be dead weight and this should say so.
        const seenRoute = new Set<unknown>();
        const seenLocation = new Set<unknown>();
        const Spy = () => {
            seenRoute.add(useContext(UNSAFE_RouteContext));
            seenLocation.add(useContext(UNSAFE_LocationContext));
            return null;
        };
        window.history.replaceState({}, "", "/workspace/notes/1");
        render(
            <BrowserRouter>
                <Driver />
                <Routes>
                    <Route element={<Spy />} path="/workspace/*" />
                </Routes>
            </BrowserRouter>
        );
        visit("/workspace/notes/2");
        visit("/workspace/notes/3");
        expect(seenRoute.size).toBe(3);
        expect(seenLocation.size).toBe(3);
    });
});

describe("FreezeRouterWhenHidden: mounted hidden", () => {
    it("shows the values from mount while hidden, and the live ones once active", () => {
        let setActive: (v: boolean) => void = () => {};
        const paths: string[] = [];
        const Probe = () => {
            const { pathname } = useLocation();
            // Committed renders only (see the note on counting above).
            useEffect(() => {
                paths.push(pathname);
            });
            return null;
        };
        const Host = () => {
            const [active, set] = useState(false);
            setActive = set;
            return (
                <FreezeRouterWhenHidden active={active}>
                    <Probe />
                </FreezeRouterWhenHidden>
            );
        };
        window.history.replaceState({}, "", "/workspace/notes/1");
        render(
            <BrowserRouter>
                <Driver />
                <Routes>
                    <Route element={<Host />} path="/workspace/*" />
                </Routes>
            </BrowserRouter>
        );
        visit("/workspace/notes/2");
        visit("/workspace/notes/3");
        expect(paths).toEqual(["/workspace/notes/1"]);
        act(() => setActive(true));
        expect(paths[paths.length - 1]).toBe("/workspace/notes/3");
        visit("/workspace/notes/4");
        expect(paths[paths.length - 1]).toBe("/workspace/notes/4");
    });
});

// ---- counted the way the browser harness counts ----------------------------

describe("as the perf harness counts it (PerformedWork component fibers)", () => {
    const fiveNavigations = () => {
        for (let i = 2; i <= 6; i += 1) visit(`/workspace/notes/${i}`);
    };

    it("the only updates under a hidden screen are its own FreezeRouterWhenHidden, one per navigation", () => {
        visitAll();
        const { hidden, hiddenBy, visible } = measureFibers(fiveNavigations);
        // Two hidden screens x five navigations: the two wrappers, nothing of
        // the screens themselves (about 14,000 components in the real app).
        expect(hiddenBy).toEqual({ FreezeRouterWhenHidden: 2 * 5 });
        expect(hidden).toBe(10);
        expect(visible).toBeGreaterThan(0);
    });

    it("this is the number the fix removes: without it every hidden component updates on every navigation", () => {
        mount("/workspace/chat/dm/1", { Freezer: ({ children }) => <>{children}</> });
        visit("/workspace/tasks/project/1");
        visit("/workspace/notes/1");
        const { hidden, hiddenBy } = measureFibers(fiveNavigations);
        // Two hidden screens x five navigations x (root + 5 leaves + 25 children).
        expect(hidden).toBe(2 * 5 * (1 + 5 + PLAIN_CHILDREN));
        expect(hiddenBy.Home).toBe(2 * 5);
        expect(hiddenBy.Plain).toBe(2 * 5 * PLAIN_CHILDREN);
    });

    it("showing one screen and hiding another costs one pass each, and the third screen nothing", () => {
        visitAll();
        fiveNavigations();
        const { hiddenBy, visibleBy } = measureFibers(() => visit("/workspace/tasks/project/9"));
        const both = (name: string) => (hiddenBy[name] ?? 0) + (visibleBy[name] ?? 0);
        // Tasks shown and notes hidden: exactly two screens rendered, once each.
        expect(both("Home")).toBe(2);
        expect(both("Plain")).toBe(2 * PLAIN_CHILDREN);
        for (const leaf of [
            "LocationLeaf",
            "ParamsLeaf",
            "NavigateLeaf",
            "ResolvedLeaf",
            "NavigationLeaf",
        ]) {
            expect(both(leaf)).toBe(2);
        }
    });
});

// ---- controls: the harness has to be able to see the bug -------------------

describe("controls: the same scenario without the freeze goes up", () => {
    const PassThrough: Freezer = ({ children }) => <>{children}</>;

    // Freeze only the location: put the LIVE route back underneath.
    const LocationOnly: Freezer = ({ active, children }) => {
        const route = useContext(UNSAFE_RouteContext);
        return (
            <FreezeRouterWhenHidden active={active}>
                <UNSAFE_RouteContext.Provider value={route}>
                    {children}
                </UNSAFE_RouteContext.Provider>
            </FreezeRouterWhenHidden>
        );
    };
    // Freeze only the route: put the LIVE location back underneath.
    const RouteOnly: Freezer = ({ active, children }) => {
        const location = useContext(UNSAFE_LocationContext);
        return (
            <FreezeRouterWhenHidden active={active}>
                <UNSAFE_LocationContext.Provider value={location}>
                    {children}
                </UNSAFE_LocationContext.Provider>
            </FreezeRouterWhenHidden>
        );
    };

    const hiddenRendersAfterNavigation = (Freezer: Freezer) => {
        mount("/workspace/chat/dm/1", { Freezer });
        visit("/workspace/tasks/project/1");
        visit("/workspace/notes/1");
        const before = snapshot();
        for (let i = 2; i <= 6; i += 1) visit(`/workspace/notes/${i}`);
        return { before, chat: (suffix: string) => sinceKey(before, `chat:${suffix}`) };
    };

    it("with no freeze at all, hidden screens follow every navigation", () => {
        const { before, chat } = hiddenRendersAfterNavigation(PassThrough);
        expect(chat("root")).toBe(5);
        expect(chat("plain")).toBe(5 * PLAIN_CHILDREN);
        expect(since(before, "tasks")).toBeGreaterThan(0);
    });

    it("freezing only the location leaves the route context re-rendering the screen", () => {
        const { chat } = hiddenRendersAfterNavigation(LocationOnly);
        expect(chat("location")).toBe(0);
        expect(chat("root")).toBeGreaterThan(0); // useParams / useNavigate at the root
        expect(chat("params")).toBeGreaterThan(0);
        expect(chat("navigate")).toBeGreaterThan(0);
    });

    it("freezing only the route leaves the location context re-rendering the screen", () => {
        const { chat } = hiddenRendersAfterNavigation(RouteOnly);
        expect(chat("params")).toBe(0);
        expect(chat("location")).toBeGreaterThan(0);
        expect(chat("root")).toBeGreaterThan(0); // useLocation at the root
    });

    it("the render counter throws past its limit instead of letting a loop run", () => {
        expect(() => {
            for (let i = 0; i <= RENDER_LIMIT; i += 1) bump("loop:test");
        }).toThrow(/render loop/);
    });
});
