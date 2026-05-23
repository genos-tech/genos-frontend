import { useState } from "react";
import { createReactInlineContentSpec, DefaultReactSuggestionItem } from "@blocknote/react";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import { Avatar, Box, Chip, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { UserProfile } from "../../features/admin/components/modals/ModalUserProfile";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { MentionGroup } from "../../services/mentionGroupsApi";
import { UserProps } from "../../types/admin";
import { PulseDot } from "../ui/misc/PulseDot";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

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

                return (
                    <>
                        <Box
                            sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.5,
                                backgroundColor:
                                    myself.userId === userId
                                        ? "#ddff003e"
                                        : "rgba(255, 0, 238, 0.15)",
                                borderRadius: "12px",
                                px: 1,
                                py: 0.5,
                                cursor: "pointer",
                                userSelect: "none",
                                fontSize: "0.875rem",
                            }}
                            onClick={() => {
                                setOpenUserProfile(true);
                            }}
                        >
                            <Typography
                                fontWeight={"bold"}
                                level="body-sm"
                                sx={{
                                    color: myself.userId === userId ? "#ff7700ff" : "#ff0077fd",
                                }}
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
                const memberCount = props.inlineContent.props.memberCount;
                return (
                    <Box
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.5,
                            backgroundColor: "rgba(34, 197, 94, 0.15)",
                            borderRadius: "12px",
                            px: 1,
                            py: 0.5,
                            userSelect: "none",
                            fontSize: "0.875rem",
                        }}
                    >
                        <GroupRoundedIcon sx={{ fontSize: 14, color: "#16a34a", mr: 0.25 }} />
                        <Typography fontWeight={"bold"} level="body-sm" sx={{ color: "#16a34a" }}>
                            @{groupName}
                        </Typography>
                        {Number(memberCount) > 0 && (
                            <Typography
                                level="body-xs"
                                sx={{ color: "#16a34a", opacity: 0.7, ml: 0.25 }}
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
        title: `@${g.groupName}`,
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

    // Groups first — they're rarer and people scan top-down.
    return [...groupItems, ...userItems];
};
