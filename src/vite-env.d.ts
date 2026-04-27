/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string;
    readonly VITE_WS_BASE_URL: string;
    readonly VITE_API_DJANGO_BASE_URL: string;
    readonly VITE_DJANGO_URL: string;
    readonly VITE_MEDIA_ROOT_DJANGO: string;
    readonly VITE_COLLAB_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
