/// <reference types="vite/client" />

declare module "*.md" {
    const content: string;
    export default content;
}

interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string;
    readonly VITE_WS_BASE_URL: string;
    readonly VITE_API_DJANGO_BASE_URL: string;
    readonly VITE_DJANGO_URL: string;
    readonly VITE_MEDIA_ROOT_DJANGO: string;
    readonly VITE_COLLAB_URL: string;
    /**
     * v3 messaging surface gate.
     *
     * When `"true"` (string), v3-only UI surfaces (`MessagesPaneV3`,
     * `ChannelListV3`) render alongside the legacy chat code. When
     * unset / any other value, only the legacy paths render — the
     * v3 service is still bootstrapped (so it can build up its
     * cache in the background) but its components are dormant.
     *
     * Production stays off until the v3 rewrite is fully wired.
     */
    readonly VITE_USE_V3_CHAT?: string;
    /**
     * VAPID public key (base64url) for Web Push. Same value as the
     * backend's `WEBPUSH_VAPID_PUBLIC_KEY`. When unset, the push subscribe
     * flow no-ops (in-app notifications are unaffected).
     */
    readonly VITE_VAPID_PUBLIC_KEY?: string;
    /**
     * PostHog product analytics (see `services/analytics.ts`). Both are
     * PUBLIC client-side values — the project API key ships in the served
     * bundle by design. When either is unset, every analytics call
     * silently no-ops (local dev default). Same key on every deploy
     * domain → one PostHog project; events are distinguished by their
     * URL/host properties.
     */
    readonly VITE_POSTHOG_KEY?: string;
    readonly VITE_POSTHOG_HOST?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
