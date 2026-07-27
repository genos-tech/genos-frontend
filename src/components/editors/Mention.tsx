import { useState } from "react";
import {
    createReactInlineContentSpec,
    DefaultReactSuggestionItem,
    SuggestionMenuProps,
    useComponentsContext,
} from "@blocknote/react";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import { Box, Chip, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useMentionGroupModal } from "../../context/MentionGroupModalContext";
import { UserProfile } from "../../features/admin/components/modals/ModalUserProfile";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { MentionGroup } from "../../services/mentionGroupsApi";
import { UserProps } from "../../types/admin";
import { useResolvedUserName } from "../ui/avatars/AvatarContext";
import { UserAvatar } from "../ui/avatars/UserAvatar";

// Shared visual treatment for every mention chip (user OR group). The
// only difference between variants is the colour palette; the pill
// shape, padding, hover transition, and typography stay identical so
// the two kinds of mention read as siblings instead of unrelated
// styles. To change the look of a mention, change `mentionChipSx`
// here and both chips update together.
//
// Exported so the `#` mention chips (HashMention.tsx) render as siblings
// of the `@` chips — same pill shape / padding / hover, only the palette
// differs per entity type.
export type MentionPalette = { bg: string; bgHover: string; text: string };

export const mentionChipSx = (palette: MentionPalette) =>
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
// Exported so the light message-body renderer (`LightMessageBody`) can
// paint identical chips without instantiating a BlockNote editor. Both
// paths must read the SAME palette objects — a mention rendered by the
// fast path and one rendered by the BlockNote fallback appear in the
// same message list and any drift would be visible side by side.
export const USER_SELF_PALETTE: MentionPalette = {
    bg: "rgba(245, 158, 11, 0.18)",
    bgHover: "rgba(245, 158, 11, 0.32)",
    text: "#d97706",
};
export const USER_OTHER_PALETTE: MentionPalette = {
    bg: "rgba(236, 72, 153, 0.15)",
    bgHover: "rgba(236, 72, 153, 0.28)",
    text: "#db2777",
};
export const GROUP_PALETTE: MentionPalette = {
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
                // Resolve the mentioned user's CURRENT name (the name baked
                // into the mention when it was typed goes stale on rename).
                const displayName = useResolvedUserName(userId, userName);

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
                                @{displayName}
                            </Typography>
                        </Box>

                        <UserProfile
                            isYou={myself.userId === userId ? true : false}
                            myself={myself}
                            openUserProfile={openUserProfile}
                            setMyself={setMyself}
                            setOpenUserProfile={setOpenUserProfile}
                            socket={socket}
                            useCM={useCM}
                            user={teamMemberProfiles[userId]}
                            useUISM={useUISM}
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

// Sort rule shared with the assignee/reporter picker (`ACTeamUsers`)
// so the same ordering shows up on every member-selection surface:
// self first (you almost always mean to mention/assign yourself when
// reaching for the picker), then everyone else by display name,
// case-insensitive. Pure — caller passes a fresh array, we never
// mutate the input.
export const sortMembersMyselfFirst = <T extends { userId: string; userName: string }>(
    members: T[],
    myselfUserId: string
): T[] => {
    return [...members].sort((a, b) => {
        if (a.userId === myselfUserId) return -1;
        if (b.userId === myselfUserId) return 1;
        return (a.userName || "").localeCompare(b.userName || "", undefined, {
            sensitivity: "base",
        });
    });
};

// Cache the entire built menu (sorted users + JSX rows + group rows)
// per editor instance. `MentionMenuItems` is called by BlockNote's
// `getItems` on every query change as the user types, and the body
// below rebuilds many React elements — without this cache, every
// keystroke would re-sort the member list AND re-instantiate every
// avatar / chip / icon for every option, then throw the lot away when
// the next character arrives.
//
// Keyed by `editor` so two editors open at once (e.g. main chat +
// open thread) don't thrash a single global slot. WeakMap auto-frees
// the entry when the editor is gc'd. Cache hits require ALL inputs
// to be reference-equal — `useTEM.teamMembers`,
// `useTEM.teamMemberProfiles`, and the `mentionGroups` context value
// only change reference when their underlying data does, so steady-
// state typing collapses to a hash lookup + a no-op return.
interface MenuCacheEntry {
    profiles: Record<string, UserProps>;
    users: UserProps[];
    myselfId: string;
    groups: MentionGroup[];
    items: DefaultReactSuggestionItem[];
}

const _menuItemsCache = new WeakMap<object, MenuCacheEntry>();

// Function which gets all users + groups for the mentions menu.
// Groups are listed first so they're easy to spot when typing.
export const MentionMenuItems = (
    teamMemberProfiles: Record<string, UserProps>,
    editor: any,
    users: UserProps[],
    myselfUserId: string,
    mentionGroups: MentionGroup[] = []
): DefaultReactSuggestionItem[] => {
    const cached = _menuItemsCache.get(editor);
    if (
        cached &&
        cached.profiles === teamMemberProfiles &&
        cached.users === users &&
        cached.myselfId === myselfUserId &&
        cached.groups === mentionGroups
    ) {
        return cached.items;
    }

    const sortedUsers = sortMembersMyselfFirst(users, myselfUserId);
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
                <Chip color="success" size="sm" sx={{ ml: "auto" }} variant="soft">
                    {g.memberCount}
                </Chip>
            </Box>
        ),
    }));

    const userItems: DefaultReactSuggestionItem[] = sortedUsers.map((user) => {
        const isSelf = user.userId === myselfUserId;
        return {
            // BlockNote's default suggestion menu renders `title` next
            // to the icon slot — so putting the email here showed it
            // twice (in the icon block on the left AND as the big
            // right-side label). Use the userName instead so the
            // right-side label, if shown, matches the bolded `@name`
            // in the icon. Email search still works because
            // `filterSuggestionItems` also matches against `aliases`.
            title: user.userName,
            aliases: [user.userEmail],
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
                <Box
                    alignItems="center"
                    display="flex"
                    gap={1.25}
                    sx={{ minWidth: 0, width: "100%", py: 0.25 }}
                >
                    {/* Avatar + online dot via the shared `UserAvatar`
                        so size, status color, fallback initial, and
                        online/offline logic stay in sync with every
                        other avatar in the app. `clickable={false}`
                        because the whole row is already a click target
                        (selecting the mention); we don't also want the
                        avatar to open the user-profile modal underneath
                        the menu. */}
                    <Box sx={{ flexShrink: 0 }}>
                        <UserAvatar clickable={false} size={36} userId={user.userId} />
                    </Box>

                    {/* Two-line block: @userName (bold) over email
                        (muted), matching the group item's layout above. */}
                    <Box
                        display="flex"
                        flexDirection="column"
                        sx={{ minWidth: 0, flex: 1, gap: 0.125 }}
                    >
                        <Box alignItems="center" display="flex" gap={0.5} sx={{ minWidth: 0 }}>
                            <Typography
                                level="body-sm"
                                sx={{
                                    fontWeight: 600,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    minWidth: 0,
                                }}
                            >
                                @{user.userName}
                            </Typography>
                            {isSelf && (
                                <Chip
                                    color="warning"
                                    size="sm"
                                    variant="soft"
                                    sx={{
                                        fontSize: "0.6rem",
                                        fontWeight: 700,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.04em",
                                        minHeight: 0,
                                        py: "1px",
                                        px: "5px",
                                        "--Chip-paddingInline": "5px",
                                        flexShrink: 0,
                                    }}
                                >
                                    You
                                </Chip>
                            )}
                        </Box>
                        <Typography
                            level="body-xs"
                            sx={{
                                opacity: 0.7,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {user.userEmail}
                        </Typography>
                    </Box>

                    {/* Custom status pulled to the right so it never
                        crowds the name. Italic + muted so it reads as
                        ambient context, not a primary label. */}
                    {user.customStatus && (
                        <Typography
                            level="body-xs"
                            sx={{
                                opacity: 0.7,
                                fontStyle: "italic",
                                ml: "auto",
                                flexShrink: 0,
                                maxWidth: 140,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {user.customStatus}
                        </Typography>
                    )}
                </Box>
            ),
        };
    });

    // Users first — they're the common case, and the BlockNote
    // suggestion popup only shows a few items above the fold. Putting
    // groups at the top pushed individual @user picks out of view and
    // looked like users weren't surfaced at all.
    const items = [...userItems, ...groupItems];
    _menuItemsCache.set(editor, {
        profiles: teamMemberProfiles,
        users,
        myselfId: myselfUserId,
        groups: mentionGroups,
        items,
    });
    return items;
};

// Custom suggestion-menu component for the `@` mentions popup.
//
// Why we need one: BlockNote's default `SuggestionMenu.Item` always
// renders a body slot (title + subtext) with `flex: 1` to the right of
// the icon, even when title is empty — so it leaves a stretched empty
// column next to our rich icon. We've packed everything visible
// (avatar, name, email, status, "You" chip) into the `icon` field, so
// we want a renderer that draws ONLY the icon for each item.
//
// We keep `Components.SuggestionMenu.Root` for the popover surface so
// the menu matches every other BlockNote popup (slash menu, etc.) in
// background, border, shadow, and z-index treatment. Loading/empty
// states reuse the matching `Components.SuggestionMenu` slots for the
// same reason.
//
// Selection + keyboard nav: BlockNote owns query parsing, arrow-key
// navigation, and Enter-to-select. It just hands us `selectedIndex`
// each render and calls `onItemClick` when the user commits. We mirror
// the selected row visually with the purple accent used elsewhere in
// the app's mention chips.
export const MentionSuggestionMenu = <T extends DefaultReactSuggestionItem>(
    props: SuggestionMenuProps<T>
) => {
    const Components = useComponentsContext()!;
    const { items, loadingState, selectedIndex, onItemClick } = props;

    return (
        <Components.SuggestionMenu.Root className="bn-suggestion-menu" id="bn-suggestion-menu">
            {items.map((item, i) => (
                <Box
                    // Index-based key: suggestion titles aren't unique (e.g.
                    // several GMs named "test", or repeated note titles), so a
                    // title key collides and breaks React's list reconciliation
                    // — which can leave the menu showing stale rows after the
                    // query changes. The list is rebuilt per query, so index is
                    // a stable, unique key here.
                    key={i}
                    aria-selected={i === selectedIndex || undefined}
                    role="option"
                    // BlockNote's default item uses `mousedown.preventDefault`
                    // to stop the editor from blurring before the click
                    // commits — keep the same behavior so a click on a row
                    // doesn't drop the menu first.
                    sx={{
                        cursor: "pointer",
                        px: 1,
                        py: 0.25,
                        borderRadius: "6px",
                        backgroundColor:
                            i === selectedIndex
                                ? "rgba(var(--gp-brand-700-rgb), 0.12)"
                                : "transparent",
                        transition: "background-color 0.1s ease",
                        "&:hover": {
                            backgroundColor: "rgba(var(--gp-brand-700-rgb), 0.08)",
                        },
                    }}
                    onClick={() => onItemClick?.(item)}
                    onMouseDown={(e) => e.preventDefault()}
                >
                    {item.icon}
                </Box>
            ))}
            {items.length === 0 && (loadingState === "loading" || loadingState === "loaded") && (
                <Components.SuggestionMenu.EmptyItem className="bn-suggestion-menu-item">
                    No matches
                </Components.SuggestionMenu.EmptyItem>
            )}
            {(loadingState === "loading-initial" || loadingState === "loading") && (
                <Components.SuggestionMenu.Loader className="bn-suggestion-menu-loader" />
            )}
        </Components.SuggestionMenu.Root>
    );
};
