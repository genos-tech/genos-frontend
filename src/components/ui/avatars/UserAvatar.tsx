import { memo, useCallback, useMemo, useState } from "react";
import { Avatar, Box, Stack, Typography } from "@mui/joy";

import { UserProfile } from "../../../features/admin/components/modals/ModalUserProfile";
import { PulseDot } from "../misc/PulseDot";
import { useAvatarContext, useUserProfile } from "./AvatarContext";

const MEDIA_URL = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type UserAvatarProps = {
    userId: string | number | null | undefined;
    /** Pixel size of the avatar circle. Default 32. */
    size?: number;
    /** When true, clicking opens the user-profile modal. Default true. */
    clickable?: boolean;
    /** Render the user's display name and email next to the avatar. */
    showNameAndEmail?: boolean;
    /**
     * Optional initial override (e.g. chat-name initials in GM/PM bubbles
     * where the avatar represents the chat itself, not a single user).
     * When unset, falls back to the user's name -> email -> "?".
     */
    fallbackInitial?: string;
};

// Empty / null / undefined path -> `undefined` so the browser does not
// fire a request to `${MEDIA_URL}/` and briefly render the broken-image
// glyph. Joy's <Avatar> falls back to the `children` (initials) when
// `src` is undefined or fails to load.
const buildSrc = (path: string | null | undefined): string | undefined => {
    if (!path) return undefined;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    if (!MEDIA_URL) return undefined;
    return `${MEDIA_URL}/${path}`;
};

const buildInitial = (
    fallbackInitial: string | undefined,
    userName: string | undefined,
    userEmail: string | undefined
): string => {
    const candidates = [fallbackInitial, userName, userEmail];
    for (const candidate of candidates) {
        const trimmed = (candidate ?? "").trim();
        if (trimmed.length > 0) return trimmed.charAt(0).toUpperCase();
    }
    return "?";
};

const UserAvatarInner = (props: UserAvatarProps) => {
    const { userId, size, clickable = true, showNameAndEmail, fallbackInitial } = props;

    const ctx = useAvatarContext();
    const profile = useUserProfile(userId);

    const [openUserProfile, setOpenUserProfile] = useState(false);

    const _size = size ?? 32;

    const isYou = useMemo(
        () => userId != null && String(userId) === String(ctx.myself.userId),
        [userId, ctx.myself.userId]
    );

    const isOnline = useMemo(() => {
        if (isYou) return ctx.myself.isOfflineForced !== "true";
        if (!profile) return false;
        return profile.isOnline === true && profile.isOfflineForced !== "true";
    }, [isYou, ctx.myself.isOfflineForced, profile]);

    const src = useMemo(
        () => buildSrc(isYou ? ctx.myself.avatarImgPath : profile?.avatarImgPath),
        [isYou, ctx.myself.avatarImgPath, profile?.avatarImgPath]
    );

    const initial = useMemo(
        () =>
            buildInitial(
                fallbackInitial,
                isYou ? ctx.myself.userName : profile?.userName,
                isYou ? ctx.myself.userEmail : profile?.userEmail
            ),
        [
            fallbackInitial,
            isYou,
            ctx.myself.userName,
            ctx.myself.userEmail,
            profile?.userName,
            profile?.userEmail,
        ]
    );

    const displayName = isYou ? ctx.myself.userName : profile?.userName;
    const displayEmail = isYou ? ctx.myself.userEmail : profile?.userEmail;

    const handleOpen = useCallback(() => {
        if (clickable) setOpenUserProfile(true);
    }, [clickable]);

    // Memoise the JSX so context churn (the `teamMemberProfiles`
    // reference flipping every minute when nothing changed for *this*
    // user) does not produce DOM updates. Keys are the primitive slices
    // we render, so the memo only invalidates on real changes.
    const avatarJsx = useMemo(
        () => (
            <Stack direction="row" spacing={1}>
                <Box
                    height={_size}
                    position="relative"
                    sx={clickable ? { cursor: "pointer" } : undefined}
                    width={_size}
                    onClick={handleOpen}
                >
                    <Avatar size="sm" src={src} sx={{ height: _size, width: _size }}>
                        {initial}
                    </Avatar>
                    <Box bottom={0} height={17} position="absolute" right={0} width={12}>
                        <PulseDot color={isOnline ? "#4caf50" : "#999"} />
                    </Box>
                </Box>
                {showNameAndEmail === true && (
                    <Typography
                        fontWeight="bold"
                        sx={{ pl: "5px", pt: "3px", userSelect: "text" }}
                        onClick={handleOpen}
                    >
                        {displayName} - {displayEmail}
                    </Typography>
                )}
            </Stack>
        ),
        [
            _size,
            clickable,
            src,
            initial,
            isOnline,
            showNameAndEmail,
            displayName,
            displayEmail,
            handleOpen,
        ]
    );

    return (
        <div>
            {avatarJsx}
            {/* Lazy-mount the modal: render the heavy `<UserProfile>` subtree
                only when the user actually clicks. Hundreds of avatars on
                screen (chat list, task table, etc.) would otherwise each
                instantiate a closed modal subtree just to keep it hidden. */}
            {openUserProfile && (
                <UserProfile
                    isYou={isYou}
                    myself={ctx.myself}
                    openUserProfile={openUserProfile}
                    setMyself={ctx.setMyself}
                    setOpenUserProfile={setOpenUserProfile}
                    socket={ctx.socket}
                    useCM={ctx.useCM}
                    user={profile}
                    useUISM={ctx.useUISM}
                />
            )}
        </div>
    );
};

UserAvatarInner.displayName = "UserAvatar";

export const UserAvatar = memo(UserAvatarInner);
