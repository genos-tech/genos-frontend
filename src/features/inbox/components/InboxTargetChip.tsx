/**
 * The "what is this card ABOUT" affordance on an inbox card.
 *
 * A card names a person (a rich `mention` node in `itemBody`, hence already
 * clickable) and a thing — the project/GM/team they want to join, or that you
 * were just approved for. But that thing is baked into the body as plain bold
 * text at send time, so you could read *who* and *what* by name and open
 * neither: acting on a card meant leaving the inbox to go look it up.
 *
 * Driven by `itemOptionals` rather than the stored body, so no card needs
 * rewriting. Requests (1-3) have carried their routing ids all along, so every
 * existing request card gets the chip with no migration. Activities (0) only
 * started carrying them recently (api #76 + sockets #10) — older activity rows
 * resolve to null forever, since the data was never captured.
 *
 * Self-contained (local open-state + hosted modal), mirroring `ProjectAvatar`
 * / `GMAvatar`, so `InboxBubble` doesn't hand-roll modal state three times.
 *
 * Resolvability is never assumed — a chip that opens nothing is worse than no
 * chip. Whoever reads the card usually holds the target in their own
 * `allChats` (an approver owns it; someone just approved/added is now a
 * member), but rejections and "waiting for approval" receipts name a thing the
 * reader can't reach, and those render as plain text.
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
