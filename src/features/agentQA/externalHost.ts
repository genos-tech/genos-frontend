// The host a model-authored link points at (split from `agentMarkdown`, which keeps
// only the components; the rules in that file's header comment still apply).

/** The host a URL points at, or `null` when it isn't an absolute
 *  http(s) URL on another origin. */
export const externalHost = (href: string | undefined): string | null => {
    if (!href) return null;
    let url: URL;
    try {
        url = new URL(href, window.location.href);
    } catch {
        return null;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.origin === window.location.origin) return null;
    return url.host;
};
