import { useState } from "react";
import { createReactInlineContentSpec, DefaultReactSuggestionItem } from "@blocknote/react";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import { Avatar, Box, Chip, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useMentionGroupModal } from "../../context/MentionGroupModalContext";
import { UserProfile } from "../../features/admin/components/modals/ModalUserProfile";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { MentionGroup } from "../../services/mentionGroupsApi";
import { UserProps } from "../../types/admin";
import { PulseDot } from "../ui/misc/PulseDot";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

// Shared visual treatment for every mention chip (user OR group). The
// only difference between variants is the colour palette; the pill
// shape, padding, hover transition, and typography stay identical so
// the two kinds of mention read as siblings instead of unrelated
// styles. To change the look of a mention, change `mentionChipSx`
// here and both chips update together.
type MentionPalette = { bg: string; bgHover: string; text: string };

const mentionChipSx = (palette: MentionPalette) =>
    ({
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        backgroundColor: palette.bg,
        borderRadius: "12px",
        px: 1,
        py: 0.5,
        cursor: "pointer",
        userSelect: "none",
        fontSize: "0.875rem",
        transition: "background-color 0.15s ease",
        "&:hover": { backgroundColor: palette.bgHover },
    }) as const;

// User mention palettes. The "self" variant is kept distinct because
// it's a useful UX signal — when *you* are the one being mentioned, the
// chip pops with a different colour so the eye lands on it during a
// scan of a long message list.
const USER_SELF_PALETTE: MentionPalette = {
    bg: "rgba(245, 158, 11, 0.18)",
    bgHover: "rgba(245, 158, 11, 0.32)",
    text: "#d97706",
};
const USER_OTHER_PALETTE: MentionPalette = {
    bg: "rgba(236, 72, 153, 0.15)",
    bgHover: "rgba(236, 72, 153, 0.28)",
    text: "#db2777",
};
const GROUP_PALETTE: MentionPalette = {
    bg: "rgba(34, 197, 94, 0.15)",
    bgHover: "rgba(34, 197, 94, 0.28)",
    text: "#16a34a",
};

// The Mention inline content
export const CreateMentionSpec = (
    teamMemberProfiles: Record<string, UserProps>,
    socket: Socket | null,
    myself: UserProps,
    setMyself: (value: UserProps) => void,
    useUISM: UIStateManagementState,
    useCM: ChatManagementState
) =>
    createReactInlineContentSpec(
        {
            type: "mention",
            propSchema: {
                userName: {
                    default: "N/A",
                },
                userId: {
                    default: "N/A",
                },
            },
            content: "none",
        },
        {
            render: (props) => {
                const userName = props.inlineContent.props.userName;
                const userId = props.inlineContent.props.userId;

                const [openUserProfile, setOpenUserProfile] = useState<boolean>(false);

                const palette = myself.userId === userId ? USER_SELF_PALETTE : USER_OTHER_PALETTE;
                return (
                    <>
                        <Box
                            sx={mentionChipSx(palette)}
                            onClick={() => {
                                setOpenUserProfile(true);
                            }}
                        >
                            <Typography
                                fontWeight={"bold"}
                                level="body-sm"
                                sx={{ color: palette.text }}
                            >
                                @{userName}
                            </Typography>
                        </Box>

                        <UserProfile
                            useCM={useCM}
                            isYou={myself.userId === userId ? true : false}
                            myself={myself}
                            openUserProfile={openUserProfile}
                            setMyself={setMyself}
                            setOpenUserProfile={setOpenUserProfile}
                            socket={socket}
                            useUISM={useUISM}
                            user={teamMemberProfiles[userId]}
                        />
                    </>
                );
            },
        }
    );

// The MentionGroup inline content — Slack-style @group token. Renders
// as a distinct green chip so users can tell at a glance that the
// notification will fan out to multiple people. Click is a no-op (the
// management UI lives in Settings → Mention groups); we could later
// wire a popover listing members, but a quiet token reads cleaner.
export const CreateMentionGroupSpec = () =>
    createReactInlineContentSpec(
        {
            type: "mentionGroup",
            propSchema: {
                groupName: { default: "group" },
                groupId: { default: "0" },
                memberCount: { default: "0" },
            },
            content: "none",
        },
        {
            render: (props) => {
                const groupName = props.inlineContent.props.groupName;
                const groupId = props.inlineContent.props.groupId;
                const memberCount = props.inlineContent.props.memberCount;
                // Click opens the single-group modal mounted at the App
                // root via `MentionGroupModalContext`. Same UX as the
                // user-mention chip, which opens `UserProfile`.
                const { openGroupModal } = useMentionGroupModal();
                const handleClick = (e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const parsed = Number(groupId);
                    if (Number.isFinite(parsed) && parsed > 0) openGroupModal(parsed);
                };
                return (
                    <Box sx={mentionChipSx(GROUP_PALETTE)} onClick={handleClick}>
                        <GroupRoundedIcon
                            sx={{ fontSize: 14, color: GROUP_PALETTE.text, mr: 0.25 }}
                        />
                        <Typography
                            fontWeight={"bold"}
                            level="body-sm"
                            sx={{ color: GROUP_PALETTE.text }}
                        >
                            @{groupName}
                        </Typography>
                        {Number(memberCount) > 0 && (
                            <Typography
                                level="body-xs"
                                sx={{ color: GROUP_PALETTE.text, opacity: 0.7, ml: 0.25 }}
                            >
                                ({memberCount})
                            </Typography>
                        )}
                    </Box>
                );
            },
        }
    );

// Function which gets all users + groups for the mentions menu.
// Groups are listed first so they're easy to spot when typing.
export const MentionMenuItems = (
    teamMemberProfiles: Record<string, UserProps>,
    editor: any,
    users: UserProps[],
    mentionGroups: MentionGroup[] = []
): DefaultReactSuggestionItem[] => {
    const groupItems: DefaultReactSuggestionItem[] = mentionGroups.map((g) => ({
        // `title` is what BlockNote's `filterSuggestionItems` searches.
        // The `@` trigger character is consumed before the query is
        // passed in, so a title that *starts* with `@` produces a
        // mismatch the user can't see (typing `d` against `@design`
        // doesn't startsWith). Use the bare name here; the icon below
        // still shows the `@` prefix for visual identity.
        title: g.groupName,
        badge: `${g.memberCount} member${g.memberCount === 1 ? "" : "s"}`,
        onItemClick: () => {
            editor.insertInlineContent([
                {
                    key: `group-${g.groupId}`,
                    type: "mentionGroup",
                    props: {
                        groupName: g.groupName,
                        groupId: String(g.groupId),
                        memberCount: String(g.memberCount),
                    },
                },
                " ",
            ]);
        },
        icon: (
            <Box alignItems="center" display="flex" gap={1}>
                <Box
                    sx={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: "rgba(34, 197, 94, 0.18)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <GroupRoundedIcon sx={{ fontSize: 18, color: "#16a34a" }} />
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                    <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                        @{g.groupName}
                    </Typography>
                    {g.description && (
                        <Typography level="body-xs" sx={{ opacity: 0.7 }}>
                            {g.description}
                        </Typography>
                    )}
                </Box>
                <Chip size="sm" variant="soft" color="success" sx={{ ml: "auto" }}>
                    {g.memberCount}
                </Chip>
            </Box>
        ),
    }));

    const userItems: DefaultReactSuggestionItem[] = users.map((user) => ({
        title: user.userEmail,
        badge: user.customStatus,
        onItemClick: () => {
            editor.insertInlineContent([
                {
                    key: user.userId,
                    type: "mention",
                    props: {
                        userName: user.userName,
                        userEmail: user.userEmail,
                        userId: user.userId,
                        teamId: user.teamId,
                        teamName: user.teamName,
                        avatarImgPath: user.avatarImgPath,
                        customStatus: user.customStatus,
                    },
                },
                " ",
            ]);
        },
        icon: (
            <Box alignItems="center" display="flex" gap={1}>
                {/* Avatar + Status Dot */}
                <Box height={32} position="relative" width={32}>
                    <Avatar
                        alt={user.userName}
                        src={`${media_url}/${user.avatarImgPath}`}
                        sx={{ width: 32, height: 32 }}
                    />
                    <Box bottom={0} height={10} position="absolute" right={0} width={10}>
                        <PulseDot
                            color={
                                teamMemberProfiles[user.userId]?.isOnline === true &&
                                teamMemberProfiles[user.userId]?.isOfflineForced !== "true"
                                    ? "#4caf50"
                                    : "#999"
                            }
                        />
                    </Box>
                </Box>
                {user.userName}
            </Box>
        ),
    }));

    // Users first — they're the common case, and the BlockNote
    // suggestion popup only shows a few items above the fold. Putting
    // groups at the top pushed individual @user picks out of view and
    // looked like users weren't surfaced at all.
    return [...userItems, ...groupItems];
};
