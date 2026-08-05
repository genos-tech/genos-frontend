import { memo, useCallback, useMemo, useState } from "react";
import { Avatar, Box, Stack, Typography } from "@mui/joy";

import { UserProfile } from "../../../features/admin/components/modals/ModalUserProfile";
import { AppTooltip } from "../AppTooltip";
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
     * Render the online/offline status dot at the avatar's bottom-right.
     * Default `true`. Set to `false` for dense surfaces (task node
     * cards, table cells) where presence is noise and the dot crowds
     * the layout.
     */
    showPulseDot?: boolean;
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
    const {
        userId,
        size,
        clickable = true,
        showNameAndEmail,
        showPulseDot = true,
        fallbackInitial,
    } = props;

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
    // Status dot scales with avatar size so it stays proportional on
    // tiny chat-list thumbnails (24px) all the way up to large profile
    // cards (64px+). Floor at 6px so it never disappears.
    const dotSize = Math.max(6, Math.round(_size * 0.3));
    // The avatar is a circle inscribed in a square bounding box. Pinning
    // the dot at `right: 0; bottom: 0` puts it at the *square's* corner,
    // which is `radius * (sqrt(2) - 1) ≈ 0.41 * radius` outside the
    // visible circle. That gap is invisible on a 32px avatar (the dot
    // bridges it) but on a 64px+ avatar the dot ends up floating in the
    // empty corner. Inset proportionally so the dot's centre lands on
    // (or just inside) the circle's bottom-right edge at every size.
    const dotInset = Math.max(0, Math.round((_size - 32) * 0.18));
    // Joy's Avatar at `size="sm"` (its 32px preset) doesn't fully fill
    // its bounding box: the component's built-in baseline leaves ~6px
    // empty below the visible circle and ~1px to the right. Below the
    // "sm" threshold the avatar is compressed enough by sx that the gap
    // closes (size=26 lands perfectly without correction). Ramping the
    // correction in smoothly across 26..32 matches both ends; capping
    // at the size=32 values keeps the dot near the visible circle for
    // larger avatars rather than over-correcting it inward.
    const avatarBaselineBottom = Math.max(0, Math.min(6, _size - 26));
    const avatarBaselineRight = Math.max(0, Math.min(1, _size - 31));

    // Somebody from another team wears their team's icon. Without it their
    // face is indistinguishable from a colleague's, and the whole point of
    // a cross-team share is knowing whose side of the wall a person is on
    // before you write to them. Top-left, because bottom-right is presence
    // and the two must never overlap.
    const homeTeam = isYou || profile?.isExternal !== true ? undefined : profile;
    const badgeSize = Math.max(10, Math.round(_size * 0.4));
    const badgeSrc = buildSrc(homeTeam?.homeTeamImgPath);
    const badgeTitle = homeTeam?.homeTeamName || homeTeam?.userName || "";

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
                    {showPulseDot && (
                        <Box
                            bottom={dotInset + avatarBaselineBottom}
                            height={dotSize}
                            position="absolute"
                            right={dotInset + avatarBaselineRight}
                            width={dotSize}
                            // PulseDot ships with `marginLeft: 4px` for the inline-
                            // beside-text usage; zero it out here so the dot fills
                            // the wrapper exactly and lands at the avatar's bottom-
                            // right corner regardless of avatar size.
                            sx={{ "& > span": { marginLeft: 0 } }}
                        >
                            <PulseDot color={isOnline ? "#4caf50" : "#999"} size={dotSize} />
                        </Box>
                    )}
                    {homeTeam && (
                        // The team's name is the badge's accessible name, so a
                        // reader can tell WHICH team and a screen reader says
                        // it. The hover hint used to be a native `title` on an
                        // element with `pointer-events: none` — a hint that
                        // could never fire, on the one mark whose job is to
                        // answer "who is this person". Pointer events are back
                        // on: the click still opens the profile, because the
                        // handler is on the wrapper this bubbles to.
                        <AppTooltip title={badgeTitle}>
                            <Avatar
                                aria-label={badgeTitle}
                                size="sm"
                                src={badgeSrc}
                                sx={{
                                    position: "absolute",
                                    top: -2,
                                    left: -2,
                                    height: badgeSize,
                                    width: badgeSize,
                                    fontSize: Math.max(7, Math.round(badgeSize * 0.6)),
                                    border: "1.5px solid",
                                    borderColor: "background.surface",
                                }}
                            >
                                {(badgeTitle || "?").charAt(0).toUpperCase()}
                            </Avatar>
                        </AppTooltip>
                    )}
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
            dotSize,
            dotInset,
            avatarBaselineBottom,
            avatarBaselineRight,
            clickable,
            src,
            initial,
            isOnline,
            homeTeam,
            badgeSize,
            badgeSrc,
            badgeTitle,
            showNameAndEmail,
            showPulseDot,
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
