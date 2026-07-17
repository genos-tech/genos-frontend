import { authApi } from "./api";

// Wire-shape mirroring GifSearchView in the Django API (which proxies
// GIPHY so the key stays server-side). `url` is the full-size GIF to
// insert into content; `previewUrl` the light 200px rendition for the
// picker grid.
export interface GifResult {
    id: string;
    title: string;
    url: string;
    previewUrl: string;
    width: number;
    height: number;
}

export interface GifSearchPage {
    results: GifResult[];
    // Offset cursor for the next page; "" when exhausted.
    next: string;
    // Set when the server answered 503 — the GIPHY key isn't
    // configured. The picker shows a friendly notice instead of a grid.
    notConfigured?: boolean;
}

// Empty query = the trending feed (the picker's initial grid).
export const searchGifs = async (
    accessToken: string,
    opts: { q?: string; offset?: string } = {}
): Promise<GifSearchPage> => {
    const api = authApi(accessToken);
    if (!api) return { results: [], next: "" };
    const params = new URLSearchParams();
    if (opts.q) params.set("q", opts.q);
    if (opts.offset) params.set("offset", opts.offset);
    try {
        const res = await api.get(`/gif/search/?${params.toString()}`);
        return {
            results: (res.data?.results ?? []) as GifResult[],
            next: String(res.data?.next ?? ""),
        };
    } catch (e) {
        const status = (e as { response?: { status?: number } })?.response?.status;
        if (status === 503) {
            return { results: [], next: "", notConfigured: true };
        }
        console.error("[gifApi] search failed:", e);
        return { results: [], next: "" };
    }
};
