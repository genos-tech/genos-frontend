// `sort-keys` is disabled file-wide: this 1200-line modal carries ~80
// violations in Joy UI `sx` prop objects whose visual grouping
// (positioning vs sizing vs typography) is intentional and not worth
// re-sorting given the punch-list note above marks the modal as dead
// code once the v3 channel-update path replaces these legacy services.
// `simple-import-sort` is disabled because the prettier import-sort
// plugin disagrees with it on react-vs-@mui ordering; prettier wins.
/* eslint-disable react/jsx-sort-props */
import { useEffect, useMemo, useRef, useState } from "react";
import AssignmentIcon from "@mui/icons-material/Assignment";
import EditIcon from "@mui/icons-material/Edit";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import {
    Box,
    Button,
    Card,
    FormControl,
    FormLabel,
    IconButton,
    Input,
    ListItemButton,
    Stack,
    Typography,
} from "@mui/joy";
import { Socket } from "socket.io-client";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { BaseAvatar } from "../../../../components/ui/avatars/BaseAvatar";
import { FileSizeRejectionSnackbar } from "../../../../components/ui/feedback/FileSizeRejectionSnackbar";
import { useFileSizeGuard } from "../../../../components/ui/feedback/useFileSizeGuard";
import { SearchField } from "../../../../components/ui/fields/SearchField";
import { MemberRoleControl } from "../../../../components/ui/memberRoles/MemberRoleControl";
import { useMemberRemoval } from "../../../../components/ui/memberRoles/useMemberRemoval";
import { ModalLeaveConfirm } from "../../../../components/ui/misc/ModalLeaveConfirm";
import { ModalTransferOwner } from "../../../../components/ui/misc/ModalTransferOwner";
import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { PROFILE_MODAL_Z_INDEX } from "../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { addMembersToProjectWithNotice } from "../../../../services/addMembersWithNotice";
import { channelService } from "../../../../services/channel/channelService";
import { loadProjectProfile } from "../../../../services/loadProjectProfile";
import { g } from "../../../../theme/tokens";
import { ProjectProfileProps, UserProps } from "../../../../types/admin";
import { ChannelKind } from "../../../../types/channel";
import { AllChatProps } from "../../../../types/chat";
import { ProjectLabelProps } from "../../../../types/tasks";
import { buildAvatarSrc } from "../../../../utils/avatarSrc";
import { extractYYYYMMDD } from "../../../../utils/dateUtils";
import { canManageMembers, MemberRole, resolveMyRole } from "../../../../utils/memberRoles";
import { withoutDeletedUsers } from "../../../../utils/teamRoster";
import { ModalAddMembers } from "../../../chat/components/modals/ModalAddMembers";
import { resolveLegacyChatId } from "../../../chat/utils/channelIdResolvers";
import { leaveProject } from "../../services/leaveProject";
import { loadOpenWork, removeMember } from "../../services/removeMember";
import { setProjectMemberRole } from "../../services/setProjectMemberRole";
import { updateProjectProfile } from "../../services/updateProjectProfile";
import { ModalManageProjectLabels } from "../projectLabels/ModalManageProjectLabels";
import { ProjectLabelChips } from "../projectLabels/ProjectLabelChips";
import { ObjectSharesSection } from "../team/ObjectSharesSection";
import { ModalInviteMembers } from "./ModalInviteMembers";

const base_url = import.meta.env.VITE_API_BASE_URL;

type ModalProjectProfileProps = {
    socket: Socket | null;
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    pmChat: AllChatProps;
    openModalProjectProfile: boolean;
    setOpenModalProjectProfile: (value: boolean) => void;
    setAvatarUserId: (value: string) => void;
    setOpenUserProfile: (value: boolean) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
};
export const ModalProjectProfile = (props: ModalProjectProfileProps) => {
    const {
        socket,
        useTEM,
        myself,
        setMyself,
        pmChat,
        openModalProjectProfile,
        setOpenModalProjectProfile,
        setAvatarUserId,
        setOpenUserProfile,
        useCM,
        useUISM,
    } = props;

    const { accessToken } = useAuth();
    const { t } = useTranslation();

    // Resolve the legacy integer `project_id` from the v3 channel UUID
    // via `Channel.legacyChatId`. Every legacy project service this
    // modal calls (`updateProjectProfile`, `leaveProject`,
    // `deletePMChatData`, `loadProjectProfile`, and the inline image
    // / code PUT below) binds its backend URL param to a Django
    // `IntegerField`. Passing a UUID 500s.
    //
    // Returns `-1` when no v3 mirror exists; downstream calls 404
    // benignly rather than 500-with-traceback.
    const pmChatIdLegacy = resolveLegacyChatId(pmChat.chatId) ?? -1;

    const [projectProfile, setProjectProfile] = useState<ProjectProfileProps | null>(null);

    // Pull the live chat row from `useCM.allChats` so the avatar reflects
    // the freshest `profileImagePath` after a profile-image upload patches
    // `allChats` below. The `pmChat` prop is captured by the parent at
    // modal-open time and otherwise goes stale — mirrors the `liveChat`
    // pattern in ModalGMProfile.
    const liveChat = useMemo(() => {
        const found = useCM.allChats.find(
            (c) => c.chatId === pmChat.chatId && c.chatType === pmChat.chatType
        );
        return found ?? pmChat;
    }, [useCM.allChats, pmChat]);

    // Member search state
    const [memberSearchQuery, setMemberSearchQuery] = useState("");

    // Editable project code state. The chip flips to an Input when the
    // user clicks the pencil; Save fires PUT /project/ to persist.
    const [codeEditMode, setCodeEditMode] = useState(false);
    const [codeDraft, setCodeDraft] = useState("");
    const [codeError, setCodeError] = useState<string | null>(null);
    const [codeSaving, setCodeSaving] = useState(false);

    // Leave-project flow. Owners can't leave (would orphan the project);
    // ownership is loaded async (projectProfile may be null on first
    // open) so the button is gated on both projectProfile presence and
    // ownerUserId mismatch.
    const [openLeaveConfirm, setOpenLeaveConfirm] = useState(false);
    const [openInviteGuests, setOpenInviteGuests] = useState(false);
    const isProjectOwner = !!projectProfile && myself.userId === projectProfile.ownerUserId;
    const canShowLeave = !!projectProfile && !isProjectOwner;

    // Owner OR editor may manage: rename, image, code, labels, and other
    // members' roles. Only the owner may delete or transfer.
    //
    // `resolveMyRole` overlays `owner` from `ownerUserId` — the server
    // never stores "owner" on a member row, so reading `memberRole`
    // directly would deny the actual owner.
    const myRole = resolveMyRole(
        myself.userId,
        projectProfile?.ownerUserId,
        projectProfile?.projectMembers
    );
    const canManage = !!projectProfile && canManageMembers(myRole);

    // Offering the project to another organization is a TEAM-level act, not
    // a project-level one: the host team consents to the share, so a project
    // editor who is only a viewer of the team must not be able to lend the
    // team's data out. Hence the separate role lookup against the team
    // roster rather than reusing `canManage` above. The server enforces the
    // same rule; this only decides whether the control appears.
    const canManageTeam = canManageMembers(
        resolveMyRole(myself.userId, useTEM.currentTeam.teamOwnerId, useTEM.teamMembers)
    );

    // Whose project this is. A project shared with the viewer's team opens
    // from that team's own list, so this modal now renders over someone
    // else's project — and lending it onward is the host's to do. Treating
    // the viewer's team as the host would offer a control the server
    // refuses, against a list of connections that are not the host's.
    const hostTeamId = projectProfile?.teamId ? String(projectProfile.teamId) : myself.teamId;
    const isExternalProject = hostTeamId !== myself.teamId;

    // Removing someone else (MIP-1371): owner removes anyone, an editor only viewers and guests.
    // The server cleans up that person's open work in THIS project when asked.
    const removal = useMemberRemoval({
        kind: "project",
        scopeName: projectProfile?.projectName ?? "",
        ownerUserId: projectProfile?.ownerUserId,
        myRole,
        myUserId: myself.userId,
        zIndex: PROFILE_MODAL_Z_INDEX + 2,
        loadOpenWork: (userId) =>
            projectProfile?.projectId
                ? loadOpenWork(accessToken, "project", projectProfile.projectId, userId)
                : Promise.resolve(null),
        remove: (userId, unassign) =>
            removeMember(accessToken, "project", projectProfile?.projectId ?? 0, userId, unassign),
        onRemoved: (userId) => {
            if (!projectProfile) return;
            setProjectProfile({
                ...projectProfile,
                projectMembers: projectProfile.projectMembers.filter(
                    (m) => String(m.userId) !== String(userId)
                ),
            });
        },
    });

    const handleMemberRoleChange = async (
        userId: string,
        nextRole: MemberRole
    ): Promise<boolean> => {
        if (!projectProfile?.projectId) return false;
        const ok = await setProjectMemberRole(
            projectProfile.projectId,
            userId,
            nextRole,
            accessToken
        );
        if (!ok) return false;
        setProjectProfile({
            ...projectProfile,
            projectMembers: projectProfile.projectMembers.map((m) =>
                String(m.userId) === String(userId) ? { ...m, memberRole: nextRole } : m
            ),
        });
        return true;
    };

    // Inline rename + transfer-ownership flow (owner-only). Rename goes
    // over the v3 socket rail (see handleNameSave) so every member's
    // sidebar syncs live; owner transfer still PUTs through
    // `updateProjectProfile`. Local profile state is updated on success
    // so the modal reflects the change without a refetch.
    const [nameEditMode, setNameEditMode] = useState(false);
    const [nameDraft, setNameDraft] = useState("");
    const [nameError, setNameError] = useState<string | null>(null);
    const [nameSaving, setNameSaving] = useState(false);
    const [openTransfer, setOpenTransfer] = useState(false);

    const handleNameSave = async () => {
        if (!projectProfile) return;
        const next = nameDraft.trim();
        if (!next) {
            setNameError(t.common.profileEdit.nameEmpty);
            return;
        }
        if (next === (projectProfile?.projectName ?? pmChat.chatName)) {
            setNameEditMode(false);
            setNameError(null);
            return;
        }
        setNameSaving(true);
        setNameError(null);
        // Rename over the v3 socket rail (mirrors ModalGMProfile). A PM
        // title patch DELEGATES to the project rename server-side (owner
        // + collision rules unchanged), and the sockets proxy broadcasts
        // `channel.updated` to the PM channel room — so every member's
        // sidebar picks up the new name live. The previous REST
        // PUT /project/ path updated the DB but broadcast nothing: other
        // sessions kept the stale name until a full reload, and even the
        // local patch below could be reverted by a stale in-flight
        // listChannels response (the #91 coalescing gotcha).
        let ok = false;
        try {
            await channelService.updateChannel(pmChat.chatId, ChannelKind.PM, { title: next });
            ok = true;
        } catch (e) {
            console.error("[ModalProjectProfile] rename failed:", e);
            setNameError(t.common.profileEdit.renameError);
        }
        setNameSaving(false);
        if (ok) {
            setProjectProfile({ ...projectProfile, projectName: next });
            // Optimistic local patch — avoids the one-frame flicker
            // between the emit ack and the `channel.updated` broadcast
            // landing in channelService.
            useCM.setAllChats((prev) =>
                prev.map((c) =>
                    c.chatType === pmChat.chatType && c.chatId === pmChat.chatId
                        ? { ...c, chatName: next }
                        : c
                )
            );
            setNameEditMode(false);
        }
    };

    const handleTransferConfirm = async (newOwnerId: string) => {
        if (!projectProfile) return false;
        const ok = await updateProjectProfile(accessToken, pmChatIdLegacy, {
            ownerId: newOwnerId,
        });
        if (ok) {
            setProjectProfile({ ...projectProfile, ownerUserId: newOwnerId });
            setOpenTransfer(false);
        }
        return ok;
    };

    // Deleted accounts are anonymised, not removed, so they still ride in
    // on the roster — drop them before anything renders or lists them.
    const visibleMembers = useMemo(
        () => withoutDeletedUsers(projectProfile?.projectMembers ?? []),
        [projectProfile?.projectMembers]
    );

    const transferCandidates = useMemo(
        () =>
            visibleMembers
                .filter((m) => m.userId !== myself.userId)
                .map((m) => ({
                    userId: m.userId,
                    userName: m.userName,
                    userEmail: m.userEmail,
                    avatarImgPath: m.avatarImgPath,
                })),
        [visibleMembers, myself.userId]
    );

    const handleLeaveProject = async () => {
        if (!myself.teamId) return false;
        const ok = await leaveProject(accessToken, myself.teamId, pmChatIdLegacy, myself.userId);
        if (!ok) return false;
        // Drop the project chat from the in-memory list so the sidebar
        // updates immediately.
        useCM.setAllChats((prev) =>
            prev.filter((c) => !(c.chatType === pmChat.chatType && c.chatId === pmChat.chatId))
        );
        if (
            useCM.currentMainChat?.chatType === pmChat.chatType &&
            useCM.currentMainChat?.chatId === pmChat.chatId
        ) {
            useCM.setCurrentMainChat(undefined);
        }
        if (
            useCM.currentSubChat?.chatType === pmChat.chatType &&
            useCM.currentSubChat?.chatId === pmChat.chatId
        ) {
            useCM.setCurrentSubChat(undefined);
        }
        // v3 ownership: when the user is removed from the project's
        // channel, the v3 `channel.member_removed` broadcast triggers
        // `channelService._evictChannelMessages`, which drops the
        // channel from the snapshot + IDB. No manual cleanup needed.
        setOpenModalProjectProfile(false);
        return true;
    };

    const handleCodeSave = async () => {
        if (!projectProfile?.projectId) return;
        const next = codeDraft.trim().toUpperCase();
        if (!/^[A-Z][A-Z0-9]{1,5}$/.test(next)) {
            setCodeError(t.admin.projectProfile.codeInvalid);
            return;
        }
        setCodeSaving(true);
        setCodeError(null);
        try {
            const res = await fetch(`${base_url}/project/`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    project_id: projectProfile.projectId,
                    code: next,
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                setCodeError(
                    body.error ||
                        fmt(t.admin.projectProfile.codeSaveFailed, {
                            status: res.status,
                        })
                );
                return;
            }
            setProjectProfile({ ...projectProfile, code: next });
            setCodeEditMode(false);
        } catch {
            setCodeError(t.admin.projectProfile.codeNetworkError);
        } finally {
            setCodeSaving(false);
        }
    };

    // Filter members based on search query
    const filteredMembers = useMemo(() => {
        if (!memberSearchQuery.trim()) {
            return visibleMembers;
        }
        const query = memberSearchQuery.toLowerCase();
        return visibleMembers.filter(
            (member) =>
                member.userName.toLowerCase().includes(query) ||
                member.userEmail.toLowerCase().includes(query)
        );
    }, [visibleMembers, memberSearchQuery]);

    // Profile image file upload manager
    const inputRef = useRef<HTMLInputElement | null>(null);
    const handleButtonClick = () => {
        inputRef.current?.click();
    };

    // Per-file size cap. Profile images are tiny by nature; the cap is
    // mostly a safety net against accidentally selecting a 4K RAW.
    const { rejection, dismissRejection, filterFiles } = useFileSizeGuard();

    const handleSelectedFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (pmChat.project) {
            const selectedFiles = event.target.files;
            if (!selectedFiles || selectedFiles.length !== 1) return;

            const accepted = filterFiles(selectedFiles);
            if (accepted.length === 0) {
                event.target.value = "";
                return;
            }

            const tmpProjectProfileImage = accepted[0]; // original File

            // Create a new File instance with the existing file data but new name
            const imageFileName = "profile.jpg";
            const userProfileImage = new File([tmpProjectProfileImage], imageFileName, {
                type: tmpProjectProfileImage.type,
                lastModified: tmpProjectProfileImage.lastModified,
            });

            const formData = new FormData();
            formData.append("profile_image", userProfileImage);
            formData.append("project_id", pmChat.project.projectId.toString());
            const uploadProfileImageResponse = await fetch(`${base_url}/project/profile/image/`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                body: formData,
            });

            const uploadProfileImageData = await uploadProfileImageResponse.json();

            if (!uploadProfileImageResponse.ok) {
                throw new Error(t.admin.projectProfile.uploadFailed);
            }
            // The PUT returns the updated ProjectMaster row.
            // `profile_image_file_name` is the FE-canonical media path with
            // a server-appended `?v=<ts>` cache buster (see
            // `ProjectProfileImageView`). Patch the avatar straight from that
            // response rather than leaning on `syncChannel` + `funcSetAllChats`:
            // `syncChannel` only pulls messages/threads/members (NOT channel
            // metadata), and `funcSetAllChats` → `listChannels` is coalesced by
            // `_listChannelsInflight`, so a refresh already in flight when the
            // upload commits resolves with the STALE pre-upload image — the
            // intermittent "project avatar never changes" bug. The
            // `_ensure_pm_channel_for_project` signal has already written the
            // new path onto `Channel.profile_image_url` server-side, so a later
            // natural refresh stays consistent with the patch below.
            const newImagePath: string =
                (uploadProfileImageData?.profile_image_file_name as string) || "";
            if (newImagePath) {
                // 1. Patch the v3 snapshot channel so any later chat-list
                //    re-derive keeps the new avatar (survives funcSetAllChats).
                const snapChannel = channelService.getSnapshot().channels.get(pmChat.chatId);
                if (snapChannel) {
                    channelService.handleChannelUpdated({
                        ...snapChannel,
                        profileImageUrl: newImagePath,
                    });
                }
                // 2. Optimistically patch the legacy chat row for an immediate
                //    re-render of `liveChat` here + the sidebar `ProjectAvatar`
                //    (mirrors the rename path in `handleNameSave`).
                useCM.setAllChats((prev) =>
                    prev.map((c) =>
                        c.chatType === pmChat.chatType && c.chatId === pmChat.chatId
                            ? { ...c, profileImagePath: newImagePath }
                            : c
                    )
                );
            }
        }
    };

    const loadProjectProfileData = async () => {
        const projectProfile = await loadProjectProfile(
            myself.teamId,
            pmChatIdLegacy,
            accessToken
        );
        setProjectProfile(projectProfile);
    };

    // Team-scoped labels on THIS project (the chips also shown in the
    // task sidebar). Owner-only to manage, same gate as rename/transfer,
    // and re-checked server-side. Held in local state rather than read
    // straight off `projectProfile` so an assignment change re-renders
    // without refetching the whole profile.
    const [openManageLabels, setOpenManageLabels] = useState(false);
    const [projectLabels, setProjectLabels] = useState<ProjectLabelProps[]>([]);
    useEffect(() => {
        setProjectLabels(projectProfile?.projectLabels ?? []);
    }, [projectProfile?.projectLabels]);

    // Add-teammates flow. Open to ANY project member, not just the owner
    // (unlike rename / transfer above) — that was the ask, and the
    // backend's `POST /project/join/` has no ownership check either.
    const [openAddMembers, setOpenAddMembers] = useState(false);

    const handleAddMembers = async (memberIds: string[]): Promise<boolean> => {
        if (!projectProfile?.projectId) return false;
        const { addedIds, failedIds } = await addMembersToProjectWithNotice({
            accessToken,
            memberIds,
            myself,
            projectId: projectProfile.projectId,
            projectName: projectProfile.projectName ?? pmChat.chatName,
            socket,
        });
        if (addedIds.length > 0) {
            // Re-read the roster so the member list + count reflect the
            // adds. Nothing to patch for the PM channel itself — the
            // `_sync_pm_channel_member` signal mirrors it server-side.
            await loadProjectProfileData();
        }
        return failedIds.length === 0;
    };

    useEffect(() => {
        if (openModalProjectProfile) {
            loadProjectProfileData();
        }
        // Intentional: load on open only. Including `loadProjectProfileData`
        // would refire whenever the closure rebinds (every render); we
        // only want one fetch per open transition.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openModalProjectProfile]);

    return (
        <>
            <FileSizeRejectionSnackbar rejection={rejection} onDismiss={dismissRejection} />
            <ModalFrame
                open={openModalProjectProfile}
                title={fmt(t.admin.projectProfile.title, {
                    projectName: projectProfile?.projectName ?? pmChat.chatName,
                })}
                size="profile"
                zIndex={PROFILE_MODAL_Z_INDEX}
                flush
                fullScreenOnMobile
                onClose={() => setOpenModalProjectProfile(false)}
            >
                <Stack
                    spacing={4}
                    sx={{
                        display: "flex",
                        mx: "auto",
                        px: { xs: 2, md: 6 },
                        py: { xs: 2, md: 3 },
                    }}
                >
                    <Card
                        sx={{
                            background: g.surface.default,
                            border: `1px solid ${g.border.default}`,
                            borderRadius: g.radius.md,
                            boxShadow: "none",
                        }}
                    >
                        <Stack
                            direction={{ xs: "column", md: "row" }}
                            alignItems={{ xs: "stretch", md: "flex-start" }}
                            sx={{
                                display: "flex",
                                my: 1,
                                width: "100%",
                                minWidth: 0,
                            }}
                        >
                            <Box
                                sx={{
                                    pl: { xs: 0, md: "20px" },
                                    pr: { xs: 0, md: "40px" },
                                    mb: { xs: 2, md: 0 },
                                    position: "relative",
                                    display: "inline-block",
                                    alignSelf: { xs: "center", md: "auto" },
                                }}
                            >
                                <BaseAvatar
                                    size="display"
                                    src={buildAvatarSrc(liveChat.profileImagePath)}
                                    sx={{
                                        fontSize: "50px",
                                        border: `3px solid ${g.border.default}`,
                                    }}
                                >
                                    <AssignmentIcon sx={{ fontSize: 100 }} />
                                </BaseAvatar>

                                {/* Image upload is owner/editor now — the
                                            endpoint had no gate at all before, and
                                            this button was shown to everyone. */}
                                {canManage && (
                                    <Box
                                        sx={{
                                            position: "absolute",
                                            top: 150,
                                            right: 30,
                                        }}
                                    >
                                        <input
                                            ref={inputRef}
                                            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                                            multiple={false}
                                            style={{ display: "none" }}
                                            type="file"
                                            onChange={handleSelectedFiles}
                                        />
                                        <AppTooltip
                                            size="sm"
                                            title={t.admin.projectProfile.editProfileImage}
                                        >
                                            <IconButton
                                                variant="soft"
                                                sx={{
                                                    background: g.accent.subtle,
                                                    border: `1px solid ${g.border.default}`,
                                                    transition: "all 0.2s ease",
                                                    "&:hover": {
                                                        background: g.accent.border,
                                                        transform: "scale(1.1)",
                                                    },
                                                }}
                                                onClick={() => {
                                                    if (pmChat.project) {
                                                        handleButtonClick();
                                                    } else {
                                                        console.error("Project not found");
                                                    }
                                                }}
                                            >
                                                <EditIcon
                                                    sx={{
                                                        fontSize: "30px",
                                                        color: g.accent.text,
                                                    }}
                                                />
                                            </IconButton>
                                        </AppTooltip>
                                    </Box>
                                )}
                            </Box>

                            <Stack
                                spacing={2}
                                sx={{
                                    flexGrow: 1,
                                    minWidth: 0,
                                    width: "100%",
                                    maxWidth: "100%",
                                }}
                            >
                                <Stack direction="column" spacing={1.5}>
                                    {/* Project name — inline rename for owners. */}
                                    <FormControl>
                                        <FormLabel
                                            sx={{
                                                color: g.text.secondary,
                                                fontSize: "0.75rem",
                                                fontWeight: 600,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.05em",
                                                mb: 0.5,
                                            }}
                                        >
                                            {t.admin.projectProfile.projectName}
                                        </FormLabel>
                                        {nameEditMode ? (
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <Input
                                                    size="sm"
                                                    autoFocus
                                                    value={nameDraft}
                                                    onChange={(e) => setNameDraft(e.target.value)}
                                                    // See ModalTeamProfile for the
                                                    // rationale on routing keydown through
                                                    // slotProps.input.
                                                    slotProps={{
                                                        input: {
                                                            onKeyDown: (e) => {
                                                                if (e.key === "Enter") {
                                                                    e.preventDefault();
                                                                    void handleNameSave();
                                                                }
                                                                if (e.key === "Escape") {
                                                                    setNameEditMode(false);
                                                                    setNameError(null);
                                                                }
                                                            },
                                                        },
                                                    }}
                                                    sx={{
                                                        flex: 1,
                                                        "--Input-radius": g.radius.md,
                                                    }}
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="solid"
                                                    loading={nameSaving}
                                                    onClick={handleNameSave}
                                                >
                                                    {t.common.profileEdit.save}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="plain"
                                                    color="neutral"
                                                    onClick={() => {
                                                        setNameEditMode(false);
                                                        setNameError(null);
                                                    }}
                                                >
                                                    {t.common.profileEdit.cancel}
                                                </Button>
                                            </Stack>
                                        ) : (
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <Typography
                                                    fontWeight={600}
                                                    sx={{
                                                        userSelect: "text",
                                                        color: g.text.primary,
                                                        fontSize: "18px",
                                                    }}
                                                >
                                                    {projectProfile?.projectName ??
                                                        pmChat.chatName}
                                                </Typography>
                                                {canManage && (
                                                    <AppTooltip
                                                        title={t.common.profileEdit.rename}
                                                        size="sm"
                                                    >
                                                        <IconButton
                                                            size="sm"
                                                            variant="plain"
                                                            onClick={() => {
                                                                setNameDraft(
                                                                    projectProfile?.projectName ??
                                                                        pmChat.chatName
                                                                );
                                                                setNameError(null);
                                                                setNameEditMode(true);
                                                            }}
                                                        >
                                                            <EditIcon sx={{ fontSize: 16 }} />
                                                        </IconButton>
                                                    </AppTooltip>
                                                )}
                                            </Stack>
                                        )}
                                        {nameError && (
                                            <Typography
                                                level="body-xs"
                                                sx={{
                                                    color: g.danger.text,
                                                    mt: 0.5,
                                                }}
                                            >
                                                {nameError}
                                            </Typography>
                                        )}
                                    </FormControl>

                                    <FormControl>
                                        <FormLabel
                                            sx={{
                                                color: g.text.secondary,
                                                fontSize: "0.75rem",
                                                fontWeight: 600,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.05em",
                                                mb: 0.5,
                                            }}
                                        >
                                            {t.admin.projectProfile.owner}
                                        </FormLabel>
                                        {/* Name + email on one (wrap-friendly) row,
                                                    Transfer button on its own row below. */}
                                        <Stack
                                            direction="row"
                                            alignItems="center"
                                            spacing={2}
                                            sx={{ flexWrap: "wrap", rowGap: 0.5 }}
                                        >
                                            <Button
                                                color="neutral"
                                                variant="plain"
                                                sx={{
                                                    justifyContent: "flex-start",
                                                    px: 1.5,
                                                    py: 0.5,
                                                    borderRadius: g.radius.md,
                                                    transition: "all 0.2s ease",
                                                    "&:hover": {
                                                        background: g.hover,
                                                    },
                                                }}
                                                onClick={() => {
                                                    if (projectProfile?.ownerUserId) {
                                                        setAvatarUserId(
                                                            projectProfile.ownerUserId
                                                        );
                                                        setOpenUserProfile(true);
                                                    }
                                                }}
                                            >
                                                <Typography
                                                    fontWeight={600}
                                                    sx={{
                                                        userSelect: "text",
                                                        fontSize: "20px",
                                                        color: g.text.primary,
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {projectProfile
                                                        ? useTEM.teamMemberProfiles[
                                                              projectProfile?.ownerUserId
                                                          ]?.userName
                                                        : t.admin.projectProfile.notAvailable}
                                                </Typography>
                                            </Button>
                                            <Typography
                                                component="a"
                                                href={`mailto:${
                                                    projectProfile
                                                        ? useTEM.teamMemberProfiles[
                                                              projectProfile?.ownerUserId
                                                          ]?.userEmail
                                                        : t.admin.projectProfile.notAvailable
                                                }`}
                                                startDecorator={
                                                    <EmailRoundedIcon
                                                        fontSize="small"
                                                        sx={{
                                                            color: g.accent.text,
                                                        }}
                                                    />
                                                }
                                                sx={{
                                                    textDecoration: "none",
                                                    color: g.text.primary,
                                                    cursor: "pointer",
                                                    transition: "all 0.2s ease",
                                                    "&:hover": {
                                                        color: g.accent.text,
                                                    },
                                                }}
                                            >
                                                {projectProfile
                                                    ? useTEM.teamMemberProfiles[
                                                          projectProfile?.ownerUserId
                                                      ]?.userEmail
                                                    : t.admin.projectProfile.notAvailable}
                                            </Typography>
                                        </Stack>
                                        {isProjectOwner && (
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    justifyContent: "flex-end",
                                                    mt: 1,
                                                    mb: 1.5,
                                                }}
                                            >
                                                <Button
                                                    size="sm"
                                                    variant="outlined"
                                                    color="neutral"
                                                    startDecorator={
                                                        <SwapHorizRoundedIcon
                                                            sx={{ fontSize: 16 }}
                                                        />
                                                    }
                                                    onClick={() => setOpenTransfer(true)}
                                                    sx={{ borderRadius: g.radius.md }}
                                                >
                                                    {t.common.profileEdit.transferOwner}
                                                </Button>
                                            </Box>
                                        )}
                                    </FormControl>

                                    {/* The member list is a SIBLING of the FormControl,
                                                not a child. Joy allows only one control component
                                                per FormControl, and the list now holds a role
                                                <Select> per row — with the search <Input> that
                                                was two controls in one instance. */}
                                    <Box sx={{ display: "flex", flexDirection: "column" }}>
                                        <FormControl>
                                            <Stack
                                                direction={{ xs: "column", sm: "row" }}
                                                alignItems={{
                                                    xs: "stretch",
                                                    sm: "center",
                                                }}
                                                justifyContent="space-between"
                                                spacing={{ xs: 1, sm: 0 }}
                                                sx={{ mb: 1 }}
                                            >
                                                <Stack
                                                    alignItems="center"
                                                    direction="row"
                                                    spacing={1}
                                                >
                                                    <FormLabel
                                                        sx={{
                                                            color: g.text.secondary,
                                                            fontSize: "0.75rem",
                                                            fontWeight: 600,
                                                            textTransform: "uppercase",
                                                            letterSpacing: "0.05em",
                                                            mb: 0,
                                                        }}
                                                    >
                                                        {fmt(t.admin.projectProfile.members, {
                                                            filtered: filteredMembers.length,
                                                            total: visibleMembers.length,
                                                        })}
                                                    </FormLabel>
                                                    {/* Any member can add teammates — no
                                                            owner gate. Disabled until the
                                                            profile (and so the project id)
                                                            has loaded.

                                                            Gone on a project shared with you:
                                                            it adds people to the HOST's
                                                            project directly, which the server
                                                            refuses to an outsider. Your
                                                            colleagues come in through the
                                                            share panel below instead — so this
                                                            is a control with a replacement,
                                                            not a missing one. */}
                                                    {!isExternalProject && (
                                                        <Button
                                                            disabled={!projectProfile?.projectId}
                                                            size="sm"
                                                            variant="soft"
                                                            startDecorator={
                                                                <PersonAddAltRoundedIcon
                                                                    sx={{ fontSize: 14 }}
                                                                />
                                                            }
                                                            sx={{
                                                                borderRadius: g.radius.md,
                                                                fontSize: "12px",
                                                                fontWeight: 600,
                                                                flexShrink: 0,
                                                            }}
                                                            onClick={() => setOpenAddMembers(true)}
                                                        >
                                                            {t.common.addMembers.openButton}
                                                        </Button>
                                                    )}
                                                    {/* Guests are invited BY EMAIL, not picked
                                                                from the team roster, because the whole
                                                                point is that they aren't in it. Hence a
                                                                second button rather than a mode on the
                                                                member picker. */}
                                                    {canManage && !isExternalProject && (
                                                        <Button
                                                            color="neutral"
                                                            size="sm"
                                                            variant="outlined"
                                                            startDecorator={
                                                                <PersonAddAltRoundedIcon
                                                                    sx={{ fontSize: 14 }}
                                                                />
                                                            }
                                                            sx={{
                                                                borderRadius: g.radius.md,
                                                                fontSize: "12px",
                                                                fontWeight: 600,
                                                                flexShrink: 0,
                                                            }}
                                                            onClick={() =>
                                                                setOpenInviteGuests(true)
                                                            }
                                                        >
                                                            {t.admin.inviteMembers.openButtonGuest}
                                                        </Button>
                                                    )}
                                                </Stack>
                                                <SearchField
                                                    placeholder={
                                                        t.admin.projectProfile.searchMembers
                                                    }
                                                    sx={{
                                                        width: { xs: "100%", sm: "220px" },
                                                        maxWidth: "100%",
                                                    }}
                                                    value={memberSearchQuery}
                                                    onChange={setMemberSearchQuery}
                                                />
                                            </Stack>
                                        </FormControl>
                                        <Box
                                            sx={{
                                                maxHeight: "300px",
                                                overflow: "auto",
                                                background: "transparent",
                                                borderRadius: g.radius.md,
                                                border: `1px solid ${g.border.default}`,
                                                p: 1,
                                            }}
                                        >
                                            {filteredMembers.length > 0 ? (
                                                filteredMembers.map((member) => (
                                                    <ListItemButton
                                                        key={`project-member-${member.userId}`}
                                                        sx={{
                                                            ml: 1,
                                                            my: 0.3,
                                                            borderRadius: g.radius.md,
                                                            transition: "all 0.2s ease",
                                                            "&:hover": {
                                                                background: g.hover,
                                                            },
                                                        }}
                                                        onClick={() => {
                                                            setAvatarUserId(member.userId);
                                                            setOpenUserProfile(true);
                                                        }}
                                                    >
                                                        <AvatarWithStatus
                                                            avatarUser={member}
                                                            clickable={false}
                                                            useCM={useCM}
                                                            isYou={false}
                                                            myself={myself}
                                                            setMyself={setMyself}
                                                            showNameAndEmail={true}
                                                            socket={socket}
                                                            useUISM={useUISM}
                                                        />
                                                        <Box
                                                            sx={{
                                                                ml: "auto",
                                                                pl: 1,
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: 0.5,
                                                            }}
                                                        >
                                                            {removal.button({
                                                                userId: member.userId,
                                                                memberRole: member.memberRole,
                                                                name: member.userName,
                                                            })}
                                                            <MemberRoleControl
                                                                canManage={canManage}
                                                                isSelf={
                                                                    member.userId === myself.userId
                                                                }
                                                                memberRole={member.memberRole}
                                                                ownerUserId={
                                                                    projectProfile?.ownerUserId
                                                                }
                                                                popupZIndex={
                                                                    PROFILE_MODAL_Z_INDEX + 2
                                                                }
                                                                userId={member.userId}
                                                                onChange={handleMemberRoleChange}
                                                            />
                                                        </Box>
                                                    </ListItemButton>
                                                ))
                                            ) : (
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        py: 3,
                                                        color: g.text.secondary,
                                                    }}
                                                >
                                                    <Typography level="body-sm">
                                                        {fmt(
                                                            t.admin.projectProfile.noMembersFound,
                                                            { query: memberSearchQuery }
                                                        )}
                                                    </Typography>
                                                </Box>
                                            )}
                                        </Box>
                                    </Box>

                                    {/* Cross-team sharing sits directly under the member
                                                list because it answers the same question one
                                                level up — which OTHER organizations are in this
                                                project — and because the two lists must be read
                                                together: an external participant appears in both,
                                                and only this section says which team they came
                                                from. Renders nothing for an unshared project. */}
                                    <ObjectSharesSection
                                        borderColor={g.border.default}
                                        canOffer={canManageTeam && !isExternalProject}
                                        hostTeamId={hostTeamId}
                                        labelColor={g.text.secondary}
                                        myUserId={myself.userId}
                                        objectId={
                                            projectProfile?.projectId != null
                                                ? String(projectProfile.projectId)
                                                : undefined
                                        }
                                        objectType="project"
                                        socket={socket}
                                        valueColor={g.text.primary}
                                    />

                                    {/* Metadata row. `flexWrap` because this row now
                                                carries four fields and the Tags chips are
                                                variable-width — without it a heavily tagged
                                                project pushes Created Date off the card. */}
                                    <Stack
                                        direction="row"
                                        spacing={4}
                                        sx={{ mt: 1, flexWrap: "wrap", rowGap: 2 }}
                                    >
                                        {/* Project tags — team-scoped labels used to
                                                    organize the project list. Chips are visible
                                                    to every member; only the owner gets the
                                                    edit affordance, which mirrors the pencil on
                                                    Code rather than shouting with its own
                                                    button. */}
                                        <FormControl>
                                            <FormLabel
                                                sx={{
                                                    color: g.text.secondary,
                                                    fontSize: "0.75rem",
                                                    fontWeight: 600,
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.05em",
                                                    mb: 0.5,
                                                }}
                                            >
                                                {t.admin.projectLabels.sectionLabel}
                                            </FormLabel>
                                            <Stack
                                                direction="row"
                                                spacing={0.5}
                                                alignItems="center"
                                            >
                                                {projectLabels.length > 0 ? (
                                                    <ProjectLabelChips
                                                        labels={projectLabels}
                                                        size="md"
                                                    />
                                                ) : (
                                                    // Same em-dash placeholder Code
                                                    // uses for an unset value, so the
                                                    // row reads consistently.
                                                    <Typography
                                                        fontWeight={600}
                                                        sx={{ color: g.text.primary }}
                                                    >
                                                        —
                                                    </Typography>
                                                )}
                                                {canManage && (
                                                    <AppTooltip
                                                        size="sm"
                                                        title={t.admin.projectLabels.manageTooltip}
                                                    >
                                                        <IconButton
                                                            disabled={!projectProfile?.projectId}
                                                            size="sm"
                                                            variant="plain"
                                                            onClick={() =>
                                                                setOpenManageLabels(true)
                                                            }
                                                        >
                                                            <EditIcon sx={{ fontSize: 16 }} />
                                                        </IconButton>
                                                    </AppTooltip>
                                                )}
                                            </Stack>
                                        </FormControl>
                                        <FormControl>
                                            <FormLabel
                                                sx={{
                                                    color: g.text.secondary,
                                                    fontSize: "0.75rem",
                                                    fontWeight: 600,
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.05em",
                                                    mb: 0.5,
                                                }}
                                            >
                                                {t.admin.projectProfile.code}
                                            </FormLabel>
                                            {codeEditMode ? (
                                                <Stack
                                                    direction="row"
                                                    spacing={0.5}
                                                    alignItems="center"
                                                >
                                                    <Input
                                                        size="sm"
                                                        value={codeDraft}
                                                        autoFocus
                                                        onChange={(e) =>
                                                            setCodeDraft(
                                                                e.target.value.toUpperCase()
                                                            )
                                                        }
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter")
                                                                void handleCodeSave();
                                                            if (e.key === "Escape") {
                                                                setCodeEditMode(false);
                                                                setCodeError(null);
                                                            }
                                                        }}
                                                        slotProps={{
                                                            input: {
                                                                maxLength: 6,
                                                                spellCheck: false,
                                                                style: {
                                                                    textTransform: "uppercase",
                                                                },
                                                            },
                                                        }}
                                                        sx={{
                                                            width: 90,
                                                            "--Input-radius": g.radius.md,
                                                        }}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        variant="solid"
                                                        loading={codeSaving}
                                                        onClick={handleCodeSave}
                                                    >
                                                        {t.common.actions.save}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="plain"
                                                        color="neutral"
                                                        onClick={() => {
                                                            setCodeEditMode(false);
                                                            setCodeError(null);
                                                        }}
                                                    >
                                                        {t.common.actions.cancel}
                                                    </Button>
                                                </Stack>
                                            ) : (
                                                <Stack
                                                    direction="row"
                                                    spacing={0.5}
                                                    alignItems="center"
                                                >
                                                    <Box
                                                        sx={{
                                                            display: "inline-flex",
                                                            px: 1.5,
                                                            py: 0.5,
                                                            borderRadius: g.radius.md,
                                                            background: g.bg.subtle,
                                                            border: `1px solid ${g.border.default}`,
                                                            fontFamily:
                                                                "ui-monospace, SFMono-Regular, Menlo, monospace",
                                                        }}
                                                    >
                                                        <Typography
                                                            fontWeight={600}
                                                            sx={{
                                                                color: g.text.primary,
                                                            }}
                                                        >
                                                            {projectProfile?.code || "—"}
                                                        </Typography>
                                                    </Box>
                                                    {/* The code pencil used to show for
                                                                everyone (the endpoint was open to
                                                                any caller). Now owner/editor,
                                                                matching the backend. */}
                                                    {canManage && (
                                                        <AppTooltip
                                                            title={t.admin.projectProfile.editCode}
                                                            size="sm"
                                                        >
                                                            <IconButton
                                                                size="sm"
                                                                variant="plain"
                                                                onClick={() => {
                                                                    setCodeDraft(
                                                                        projectProfile?.code || ""
                                                                    );
                                                                    setCodeError(null);
                                                                    setCodeEditMode(true);
                                                                }}
                                                            >
                                                                <EditIcon sx={{ fontSize: 16 }} />
                                                            </IconButton>
                                                        </AppTooltip>
                                                    )}
                                                </Stack>
                                            )}
                                            {codeError && (
                                                <Typography
                                                    level="body-xs"
                                                    sx={{
                                                        color: g.danger.text,
                                                        mt: 0.5,
                                                    }}
                                                >
                                                    {codeError}
                                                </Typography>
                                            )}
                                        </FormControl>
                                        <FormControl>
                                            <FormLabel
                                                sx={{
                                                    color: g.text.secondary,
                                                    fontSize: "0.75rem",
                                                    fontWeight: 600,
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.05em",
                                                    mb: 0.5,
                                                }}
                                            >
                                                {t.admin.projectProfile.isPrivate}
                                            </FormLabel>
                                            <Box
                                                sx={{
                                                    display: "inline-flex",
                                                    px: 2,
                                                    py: 0.5,
                                                    borderRadius: "20px",
                                                    background: projectProfile?.isPrivate
                                                        ? g.danger.subtle
                                                        : g.success.subtle,
                                                    border: `1px solid ${
                                                        projectProfile?.isPrivate
                                                            ? g.danger.border
                                                            : g.success.border
                                                    }`,
                                                }}
                                            >
                                                <Typography
                                                    fontWeight={600}
                                                    sx={{
                                                        userSelect: "text",
                                                        color: projectProfile?.isPrivate
                                                            ? g.danger.text
                                                            : g.success.text,
                                                    }}
                                                >
                                                    {projectProfile?.isPrivate
                                                        ? t.admin.projectProfile.yes
                                                        : t.admin.projectProfile.no}
                                                </Typography>
                                            </Box>
                                        </FormControl>

                                        <FormControl>
                                            <FormLabel
                                                sx={{
                                                    color: g.text.secondary,
                                                    fontSize: "0.75rem",
                                                    fontWeight: 600,
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.05em",
                                                    mb: 0.5,
                                                }}
                                            >
                                                {t.admin.projectProfile.createdDate}
                                            </FormLabel>
                                            <Box
                                                sx={{
                                                    display: "inline-flex",
                                                    px: 2,
                                                    py: 0.5,
                                                    borderRadius: g.radius.md,
                                                    background: g.bg.subtle,
                                                    border: `1px solid ${g.border.default}`,
                                                }}
                                            >
                                                <Typography
                                                    fontWeight={600}
                                                    sx={{
                                                        userSelect: "text",
                                                        color: g.text.primary,
                                                    }}
                                                >
                                                    {projectProfile?.tsCreatedAt
                                                        ? extractYYYYMMDD(
                                                              projectProfile.tsCreatedAt
                                                          )
                                                        : t.admin.projectProfile.notAvailable}
                                                </Typography>
                                            </Box>
                                        </FormControl>
                                    </Stack>

                                    {canShowLeave && (
                                        <Box
                                            sx={{
                                                mt: 2,
                                                display: "flex",
                                                justifyContent: "flex-end",
                                            }}
                                        >
                                            <Button
                                                color="danger"
                                                variant="outlined"
                                                startDecorator={
                                                    <LogoutRoundedIcon fontSize="small" />
                                                }
                                                onClick={() => setOpenLeaveConfirm(true)}
                                                sx={{
                                                    borderRadius: g.radius.sm,
                                                    borderColor: g.danger.border,
                                                    color: g.danger.text,
                                                    "&:hover": {
                                                        background: g.danger.subtle,
                                                        borderColor: g.danger.border,
                                                    },
                                                }}
                                            >
                                                {t.common.actions.leave}
                                            </Button>
                                        </Box>
                                    )}
                                </Stack>
                            </Stack>
                        </Stack>
                    </Card>
                </Stack>
            </ModalFrame>
            {removal.dialog}
            <ModalLeaveConfirm
                open={openLeaveConfirm}
                title={t.common.leaveConfirm.projectTitle}
                description={t.common.leaveConfirm.projectDescription}
                entityName={pmChat.chatName}
                onConfirm={handleLeaveProject}
                onCancel={() => setOpenLeaveConfirm(false)}
            />
            {/* Owner-only. Mounted only once the profile has loaded so
                `projectId` is real — every write is keyed on it. */}
            {canManage && projectProfile?.projectId != null && (
                <ModalManageProjectLabels
                    assignedLabels={projectLabels}
                    open={openManageLabels}
                    projectId={projectProfile.projectId}
                    teamId={myself.teamId}
                    onAssignedChange={setProjectLabels}
                    onClose={() => setOpenManageLabels(false)}
                />
            )}
            <ModalTransferOwner
                open={openTransfer}
                title={t.common.profileEdit.transferTitle}
                description={t.common.profileEdit.transferProjectDescription}
                candidates={transferCandidates}
                onConfirm={handleTransferConfirm}
                onCancel={() => setOpenTransfer(false)}
            />
            {/* Reuses the chat picker — it already does "search my team,
                multi-select, chips". `onAdd` replaces its DM→MDM dispatch
                (which can't handle PM), and `excludeUserIds` hides people
                already in the project: the picker can't derive a PM roster
                from `AllChatProps` on its own. */}
            <ModalInviteMembers
                open={openInviteGuests}
                teamId={myself.teamId}
                projectId={projectProfile?.projectId ?? null}
                projectName={projectProfile?.projectName}
                onClose={() => setOpenInviteGuests(false)}
            />
            <ModalAddMembers
                chat={pmChat}
                excludeUserIds={(projectProfile?.projectMembers ?? []).map((m) => m.userId)}
                myself={myself}
                open={openAddMembers}
                setMyself={setMyself}
                setOpen={setOpenAddMembers}
                socket={socket}
                useCM={useCM}
                useTEM={useTEM}
                useUISM={useUISM}
                // Derived from this modal's own layer, not hardcoded — the
                // picker's page-level default (10000) is BELOW us and would
                // open behind the modal that launched it.
                zIndex={PROFILE_MODAL_Z_INDEX + 1}
                heading={fmt(t.common.addMembers.headingProject, {
                    projectName: projectProfile?.projectName ?? pmChat.chatName,
                })}
                onAdd={handleAddMembers}
            />
        </>
    );
};
