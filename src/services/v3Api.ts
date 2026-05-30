/**
 * v3 API host helper.
 *
 * `authApi` / `VITE_API_BASE_URL` end in `/api/v2/` (legacy convention),
 * so calling a `/api/v3/...` path through them resolves to
 * `/api/v2/api/v3/...`. Use this helper to get the Django host root
 * (`http://host` with no `/api/v*` suffix) so v3 paths concatenate
 * cleanly.
 *
 * Mirrors the `v3BaseURL` private helper in `channelService.ts` —
 * exported here so non-channelService surfaces (activity loader,
 * notifications, etc.) can hit the same host without depending on the
 * service module.
 */
export function v3ApiBaseURL(): string {
    const explicit = import.meta.env.VITE_DJANGO_URL;
    if (explicit) return String(explicit).replace(/\/$/, "");
    const legacy = import.meta.env.VITE_API_BASE_URL ?? "";
    return String(legacy)
        .replace(/\/api\/v\d+\/?$/, "")
        .replace(/\/$/, "");
}
