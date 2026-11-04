/**
 * Which API requests are NOT something a click waits for (MIP-989).
 *
 * The recorder's `settle_ms` ends with the last request that started in the
 * click's window, whatever it was. On a task open that is usually the GitHub
 * PR lookup (it starts about 2 s in and takes about 1.7 s), the presence
 * heartbeat or the runtime-config poll, so it reads about 2.5 s while the
 * content is on screen at about 1 s. `content_ms` leaves these out.
 *
 * Only routes that are never a click's content belong here. The once-a-minute
 * refresh (my / task / chat / note meta, team folders, the project list,
 * `search/teamTasks`, the project-tasks delta) is deliberately NOT listed: the
 * same routes are the real content of a note, project or service switch, and
 * nothing in the URL tells the two apart. When one lands inside a click's
 * window it stays in `content_ms`; `idle_minute` samples measure the refresh
 * on its own.
 *
 * The collab access check is not here either: genos-collab calls it, not the
 * browser, so it never appears in the browser's resource timings.
 */

/** Exact routes under the API base, without the trailing slash. */
const BACKGROUND_ROUTES = new Set(["/user/presence/heartbeat", "/runtime-config"]);

/** Every route under these prefixes (after the API base). */
const BACKGROUND_PREFIXES = ["/github/"];

/**
 * `url` is a resource entry's full URL (query string and all); `apiBase` is
 * `VITE_API_BASE_URL`. Anything outside the API base is not background: the
 * recorder only counts API traffic in the first place.
 */
export const isBackgroundRequest = (url: string, apiBase: string): boolean => {
    const base = apiBase.replace(/\/+$/, "");
    if (!base || !url.startsWith(base)) return false;
    // `rest` must start with "/" to match anything below, so a base that
    // stops in the middle of a word (`/api/v2x/...`) never matches.
    const rest = url.slice(base.length);
    // The path only: a query string that happens to contain a route is not one.
    const path = rest.split(/[?#]/, 1)[0];
    if (BACKGROUND_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
    return BACKGROUND_ROUTES.has(path.replace(/\/+$/, ""));
};
