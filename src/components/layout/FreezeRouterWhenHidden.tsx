import { useContext, useLayoutEffect, useRef, type ContextType, type ReactNode } from "react";
import { UNSAFE_LocationContext, UNSAFE_RouteContext } from "react-router-dom";

type RouterValues = {
    location: ContextType<typeof UNSAFE_LocationContext>;
    route: ContextType<typeof UNSAFE_RouteContext>;
};

/**
 * Keeps a hidden screen from re-rendering on every navigation (MIP-971).
 *
 * `FreezeWhenHidden` stops a hidden Chat / Tasks / Notes screen re-rendering
 * with `AppBody`, but a context change passes straight through its `memo`. The
 * router is a context: react-router re-creates the `RouteContext` value every
 * time `<Routes>` renders its matches (so on every navigation), and the
 * `LocationContext` value changes with the URL. Almost everything in a screen
 * reads one of them (`useNavigate`, `useParams`, `useLocation`,
 * `useResolvedPath`; the three screens' routing hooks read `useLocation()` at
 * their root), so one task click re-rendered about 14,000 components in
 * screens nobody could see.
 *
 * This component sits right inside `FreezeWhenHidden` and re-provides both
 * contexts to the screen:
 *
 *  - the LIVE values while the screen is shown, and in the render that hides
 *    it (so the screen sees the URL that hid it, together with
 *    `isActiveRoute = false`, as `FreezeWhenHidden` already guarantees for the
 *    props; a screen that was handed the OLD URL there would not see a
 *    "left this page" change, and coming back to that very URL would look like
 *    no change at all);
 *  - the values of that last live render, the SAME objects, for as long as the
 *    screen stays hidden. Nothing below re-renders, and no effect keyed on the
 *    path, the params or `navigate` fires.
 *
 * When the screen is shown again it gets the live values in that one render,
 * like any other prop it missed (a first visit, mounted while active, also
 * gets the live values: the snapshot starts as whatever the router says when
 * the component mounts).
 *
 * `NavigationContext` is deliberately NOT frozen: under `BrowserRouter` its
 * value is memoized on the history object and the basename, so it does not
 * change on navigation and does not cause the re-renders. The test "leaves
 * react-router's NavigationContext alone" in `freezeRouterWhenHidden.test.tsx`
 * pins that, so a router upgrade that makes it change fails there with this
 * explanation.
 *
 * What it costs while hidden: this component itself re-renders once per
 * navigation (it has to read the live contexts to be able to show them again),
 * and React 19 calls each router-context consumer below once per navigation
 * and lets it bail out, because it propagates a context change lazily from
 * every provider above, shadowed or not. Neither re-renders anything below or
 * commits; the screen's components get no update.
 *
 * What a hidden screen no longer sees: the URL changes after the one that hid
 * it. Anything that has to react to those must live above the screen (as the
 * unread counts and sockets do). A hidden screen can still call `navigate()`
 * with an absolute path (every call in the three screens is absolute, and the
 * routing hooks already refuse to navigate while hidden); a RELATIVE path
 * would resolve against the frozen location.
 *
 * Why the held values are written in a layout effect, not during render: a
 * transition render (react-router sets its location state in a transition)
 * that React throws away must not plant a value the screen never committed.
 */
export const FreezeRouterWhenHidden = ({
    active,
    children,
}: {
    active: boolean;
    children: ReactNode;
}) => {
    const live: RouterValues = {
        location: useContext(UNSAFE_LocationContext),
        route: useContext(UNSAFE_RouteContext),
    };

    // What the last committed live render showed, and whether it was active.
    const held = useRef<RouterValues>(live);
    const wasActive = useRef(active);

    // Same rule as `FreezeWhenHidden`: only a render that is hidden both before
    // and after is frozen. The render that hides (wasActive && !active) and the
    // render that shows (active) both get the live values.
    const showLive = active || wasActive.current;
    const shown = showLive ? live : held.current;

    useLayoutEffect(() => {
        if (showLive) held.current = live;
        wasActive.current = active;
    });

    return (
        <UNSAFE_LocationContext.Provider value={shown.location}>
            <UNSAFE_RouteContext.Provider value={shown.route}>
                {children}
            </UNSAFE_RouteContext.Provider>
        </UNSAFE_LocationContext.Provider>
    );
};
FreezeRouterWhenHidden.displayName = "FreezeRouterWhenHidden";
