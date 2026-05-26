// Compose an absolute URL for an uploaded avatar / profile image.
//
// Avatar fields in the API (`avatarImgPath`, `profileImagePath`,
// `teamImgPath`) ship as media-server-relative paths. The `<UserAvatar>`,
// `<GMAvatar>`, `<ProjectAvatar>`, etc. components each compose the URL
// locally with `${VITE_MEDIA_ROOT_DJANGO}/${path}`. This helper centralises
// that composition for non-Avatar callers — e.g. the notification router,
// which needs a full URL for the native `Notification({ icon })` field
// (the browser can't resolve a bare relative path inside a notification).
//
// Returns `undefined` for empty / null / unconfigured inputs so the
// caller can omit the field entirely rather than passing a broken URL.

const MEDIA_URL = import.meta.env.VITE_MEDIA_ROOT_DJANGO as string | undefined;

export const buildAvatarSrc = (path: string | null | undefined): string | undefined => {
    if (!path) return undefined;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    if (!MEDIA_URL) return undefined;
    return `${MEDIA_URL}/${path}`;
};
