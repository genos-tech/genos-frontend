/**
 * Navigate this tab to an in-app URL that arrived as a plain string.
 *
 * Notification payloads carry their target as a string, not a route object:
 * the server composes `item_optionals.href` (`todo_reminders.todo_href`), and
 * the service worker relays a `url` it read out of a push. Neither side can
 * reach the router, so both end up here.
 *
 * A same-tab location change rather than a router `navigate`, deliberately:
 * it re-runs the whole route parser (`useChatRouting`) and the URL-preview
 * modal's deep-link handling, which is what makes a link like
 * `/workspace/todo/2026-08-16/item/42` land on the right row. Pushing history
 * from outside React would skip both.
 *
 * The URL is re-parsed against our own origin and only its path is used, so a
 * payload naming another host navigates within this app instead of off it.
 */
export const openAppUrl = (href: string): void => {
    if (typeof window === "undefined" || !href) return;
    try {
        const url = new URL(href, window.location.origin);
        window.location.assign(url.pathname + url.search + url.hash);
    } catch {
        // Malformed — ignore rather than navigate somewhere wrong.
    }
};
