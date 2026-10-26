/**
 * An `href` that is safe to put on an anchor: the URL as given if it is a web
 * link (http or https), or `undefined` if it is not.
 *
 * A task or milestone link is typed by a person, stored on the server and shown
 * to the whole team as `<a href={link.url}>`. React does not block a
 * `javascript:` href, and one runs in the app's origin with the clicker's session
 * when a teammate clicks a link titled "Design doc" (CodeQL js/xss-through-dom,
 * MIP-821). The entry form's check was `new URL(x)`, which parses every scheme,
 * and the server stored whatever it was sent, so a row written before the server
 * began refusing them can still be on a task: this is what keeps it from being a
 * live link.
 *
 * It reads the scheme with `new URL`, which follows the same rules a browser
 * applies to an `href` (leading control characters and spaces and any tab or
 * newline inside the URL are removed before the scheme is read), so the usual
 * disguises (`" JaVa\tScRiPt:..."`) are seen for what they are. Hand-parsing the
 * string is what those tricks beat.
 *
 * A value with no scheme (a relative path, `example.com`) is NOT a web link and
 * is refused here: on a task link that would resolve against the app's own origin
 * and open the wrong page. The server leaves such values alone (it only refuses a
 * dangerous scheme), so this is the stricter of the two on purpose.
 */
export const safeWebHref = (url: string | null | undefined): string | undefined => {
    if (typeof url !== "string" || url === "") return undefined;
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return undefined;
    }
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : undefined;
};

/** Is `url` a web link? The form's check; `new URL` alone accepts every scheme. */
export const isWebUrl = (url: string | null | undefined): boolean =>
    safeWebHref(url) !== undefined;
