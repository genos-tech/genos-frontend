import { authApi } from "../../../services/api";

/**
 * The title of a page a user links from a task, or `null`.
 *
 * Best effort: the caller falls back to the URL itself, so every failure
 * — signed out, a refused address, a 429, a page with no `<title>` — is
 * just "no title", and no error toast. The endpoint requires sign-in
 * since MIP-717 (it was an open fetch-any-URL proxy into the API's
 * private network).
 */
export async function getPageTitle(
    accessToken: string | null | undefined,
    url: string
): Promise<string | null> {
    const api = authApi(accessToken);
    if (!api) return null;
    try {
        const res = await api.get("/getPageTitle/", {
            params: { url },
            suppressErrorToast: true,
        });
        const title = res.data?.title;
        return typeof title === "string" && title !== "" ? title : null;
    } catch {
        return null;
    }
}
