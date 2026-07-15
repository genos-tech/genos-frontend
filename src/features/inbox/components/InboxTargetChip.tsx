/**
 * The "what is this request FOR" affordance on an inbox request card.
 *
 * A join request card names the requester (a rich `mention` node in
 * `itemBody`, hence already clickable) and the thing they want to join — but
 * the target is baked into the body as plain bold text at send time. So the
 * approver could see *who* and *what* by name, and open neither: deciding on
 * a request meant leaving the inbox to go look the target up.
 *
 * The routing ids are already on the wire in `itemOptionals` (`project_id`,
 * `gm_id`); a team request's target is always the viewer's current team,
 * because the inbox GET is team-scoped. So this reads what's there rather
 * than touching the stored body — which also means every EXISTING request
 * card gets the chip, with no migration.
 *
 * Self-contained (local open-state + hosted modal), mirroring `ProjectAvatar`
 * / `GMAvatar`, so `InboxBubble` doesn't hand-roll modal state three times.
 *
 * Resolvability is not assumed. The approver is the target's owner, so they
 * hold it in their own `allChats` — but a chip that opens nothing is worse
 * than no chip, so an unresolvable target falls back to plain text.
 *
 * Activity items (`itemType` 0) get nothing here: none of the nine handlers
 * that create them store `item_optionals`, so there is no id to resolve.
 */
import { useState } from "react";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import { Chip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../context/AuthContext";
import { ModalProjectProfile } from "../../../features/admin/components/modals/ModalProjectProfile";
import { ModalTeamProfile } from "../../../features/admin/components/modals/ModalTeamProfile";
import { UserProfile } from "../../../features/admin/components/modals/ModalUserProfile";
import { loadMyTeams } from "../../../features/admin/services/loadMyTeams";
import { ModalGMProfile } from "../../../features/chat/components/modals/ModalGMProfile";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { TeamProfileProps, UserProps } from "../../../types/admin";
import { InboxItemProps } from "../../../types/common";
import { resolveInboxTarget } from "../utils/resolveInboxTarget";

type InboxTargetChipProps = {
    inboxItem: InboxItemProps;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useCM: ChatManagementState;
    useTEM: TeamManagementState;
    useUISM: UIStateManagementState;
};

const ICONS = {
    team: <GroupsRoundedIcon sx={{ fontSize: 14 }} />,
    project: <FolderRoundedIcon sx={{ fontSize: 14 }} />,
    gm: <ChatRoundedIcon sx={{ fontSize: 14 }} />,
};

// Same hues as `ITEM_TYPE_CONFIG` in InboxBubble (Team=blue, Project=green,
// GM=pink) so the chip reads as the same object as the request-type badge
// above it.
const COLORS = {
    team: { dark: "#60a5fa", light: "#3b82f6" },
    project: { dark: "#4ade80", light: "#22c55e" },
    gm: { dark: "#f472b6", light: "#ec4899" },
};

export const InboxTargetChip = (props: InboxTargetChipProps) => {
    const { inboxItem, myself, setMyself, socket, useCM, useTEM, useUISM } = props;
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const [openProject, setOpenProject] = useState(false);
    const [openGM, setOpenGM] = useState(false);
    const [openTeam, setOpenTeam] = useState(false);
    const [teamProfile, setTeamProfile] = useState<TeamProfileProps | null>(null);
    const [openUserProfile, setOpenUserProfile] = useState(false);
    const [avatarUserId, setAvatarUserId] = useState<string | undefined>(undefined);

    // `itemOptionals.team_name` is what the request actually stored; these are
    // only fallbacks for a row that predates it.
    const currentTeamName = useTEM.currentTeam?.teamName || myself.teamName || "";
    const target = resolveInboxTarget(inboxItem, useCM.allChats, currentTeamName);

    if (!target) return null;

    // The team profile isn't held in state anywhere, so it's fetched on click
    // (mirrors `teamDropdown`'s handler). Opening only after it resolves keeps
    // the modal from mounting against a null profile.
    const handleOpenTeam = async () => {
        if (!accessToken) return;
        const teams: TeamProfileProps[] = await loadMyTeams(accessToken, myself.userId);
        const found = teams.find((tm) => tm.teamId === myself.teamId) ?? null;
        if (!found) {
            console.error("[InboxTargetChip] current team not found in loadMyTeams", {
                teamId: myself.teamId,
            });
            return;
        }
        setTeamProfile(found);
        setOpenTeam(true);
    };

    const handleClick = () => {
        if (target.kind === "project") setOpenProject(true);
        else if (target.kind === "gm") setOpenGM(true);
        else void handleOpenTeam();
    };

    const color = COLORS[target.kind];

    return (
        <>
            <Chip
                size="sm"
                startDecorator={ICONS[target.kind]}
                variant="soft"
                sx={{
                    cursor: "pointer",
                    maxWidth: "100%",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "0.7rem",
                    background: isDark ? `${color.dark}15` : `${color.light}12`,
                    color: isDark ? color.dark : color.light,
                    border: "1px solid",
                    borderColor: isDark ? `${color.dark}25` : `${color.light}20`,
                    "& .MuiChip-startDecorator": { color: "inherit" },
                    "& .MuiChip-label": {
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    },
                    "&:hover": {
                        background: isDark ? `${color.dark}28` : `${color.light}20`,
                    },
                }}
                onClick={handleClick}
            >
                <Typography component="span" sx={{ color: "inherit", fontSize: "inherit" }}>
                    {target.name}
                </Typography>
            </Chip>

            {target.kind === "project" && (
                <ModalProjectProfile
                    myself={myself}
                    openModalProjectProfile={openProject}
                    pmChat={target.pmChat}
                    setAvatarUserId={setAvatarUserId}
                    setMyself={setMyself}
                    setOpenModalProjectProfile={setOpenProject}
                    setOpenUserProfile={setOpenUserProfile}
                    socket={socket}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            )}

            {target.kind === "gm" && (
                <ModalGMProfile
                    gmChat={target.gmChat}
                    myself={myself}
                    openModalGMProfile={openGM}
                    setAvatarUserId={setAvatarUserId}
                    setMyself={setMyself}
                    setOpenModalGMProfile={setOpenGM}
                    setOpenUserProfile={setOpenUserProfile}
                    socket={socket}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            )}

            {target.kind === "team" && teamProfile && (
                <ModalTeamProfile
                    myself={myself}
                    openModalTeamProfile={openTeam}
                    setAvatarUserId={setAvatarUserId}
                    setMyself={setMyself}
                    setOpenModalTeamProfile={setOpenTeam}
                    setOpenUserProfile={setOpenUserProfile}
                    setTeamProfile={setTeamProfile}
                    socket={socket}
                    teamProfile={teamProfile}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            )}

            {avatarUserId && (
                <UserProfile
                    isYou={false}
                    myself={myself}
                    openUserProfile={openUserProfile}
                    setMyself={setMyself}
                    setOpenUserProfile={setOpenUserProfile}
                    socket={socket}
                    useCM={useCM}
                    user={useTEM.teamMemberProfiles[avatarUserId]}
                    useUISM={useUISM}
                />
            )}
        </>
    );
};
