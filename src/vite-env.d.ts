/// <reference types="vite/client" />

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
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
