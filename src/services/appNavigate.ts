/**
 * "Take me to this page", asked from code that has no router.
 *
 * A toast raised by a service function (`runScheduleAndAnnounce`) outlives the
 * component that started it, so it cannot call `useNavigate`. It asks here,
 * and `useAppNavigateRequests` (mounted once in `App`) navigates in place:
 * unlike `openAppUrl`, which reloads the tab for a payload that has to
 * re-run the route parser, this keeps the running app, its socket and its
 * caches. Same window-event shape as `inboxResyncEvent.ts`, for the same
 * reason. Only in-app paths are accepted.
 */

export const APP_NAVIGATE_EVENT = "app:navigate";

export const requestAppNavigate = (path: string): void => {
    if (typeof window === "undefined" || !path.startsWith("/")) return;
    window.dispatchEvent(new CustomEvent<string>(APP_NAVIGATE_EVENT, { detail: path }));
};
