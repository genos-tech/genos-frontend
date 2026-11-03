import { memo, type ReactNode } from "react";

/**
 * Stops a hidden screen re-rendering just because `AppBody` did (MIP-959).
 *
 * Chat, Tasks and Notes stay mounted forever once visited and are hidden with
 * `display: none`. `AppBody` re-renders about 13 times per task click and hands
 * each screen a fresh set of manager props every time, so after visiting Chat
 * and Notes every click also re-rendered about 140,000 components nobody could
 * see, and the app kept doing it on every refresh tick while idle.
 *
 * Skips only when the screen is hidden both before and after the render:
 *
 *  - The render that HIDES it goes through, so the screen sees
 *    `isActiveRoute = false` (a first version that froze that render too left
 *    the screen believing it was the active route, and the Tasks button
 *    navigated back).
 *  - The render that SHOWS it goes through with the latest props, so every
 *    effect keyed on a prop that changed while hidden catches up then.
 *  - Context changes (theme, language) and the screen's own state updates still
 *    reach it, because a memo bail-out does not stop either. That includes
 *    react-router's location and route contexts, which change on every
 *    navigation: `FreezeRouterWhenHidden` sits just inside this component and
 *    holds those still while the screen is hidden (MIP-971).
 *
 * What it does NOT do: a screen's effects do not re-run for a prop that changes
 * while hidden until the screen is shown again. Anything that must react while
 * hidden has to live above the screen (as the unread counts and sockets do) or
 * in its own state.
 */
export const FreezeWhenHidden = memo(
    ({ children }: { active: boolean; children: ReactNode }) => <>{children}</>,
    (prev, next) => !prev.active && !next.active
);
FreezeWhenHidden.displayName = "FreezeWhenHidden";
