import React, { useEffect, useMemo, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PublicIcon from "@mui/icons-material/Public";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Alert, Box, Button, Checkbox, Chip, Input, Typography } from "@mui/joy";

import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { ownTeamOnly } from "../../../../utils/teamRoster";
import { joinTeam } from "../../../admin/services/joinTeam";
import { popTeamMembers } from "../../../admin/services/popTeamMembers";

const base_url = import.meta.env.VITE_API_BASE_URL;

type Props = {
    myself: UserProps;
    usePM: ProjectManagementState;
    setIsNewProjectCreated?: (value: boolean) => void;
    /** Needed to refresh the chat list after the project lands — Django
     *  creates the project's PM channel via a signal, but nothing tells
     *  this tab about it (see `createProject`). */
    useCM?: ChatManagementState;
};

export const ModalCreateProject: React.FC<Props> = ({
    myself,
    usePM,
    setIsNewProjectCreated,
    useCM,
}) => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isPrivate, setIsPrivate] = useState(false);
    const [projectName, setProjectName] = useState("");

    // Initial-member selection — same picker UX as ModalCreateGM. The
    // creator is always joined (below); these are additional teammates
    // to add to the project on creation.
    const [teamMembers, setTeamMembers] = useState<UserProps[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<UserProps[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    // Load the team roster when the modal opens, excluding the creator
    // (they're joined unconditionally). `popTeamMembers` is self-contained
    // so this modal needs no extra props (mirrors ModalCreateGM's fallback).
    useEffect(() => {
        if (!usePM.openCreateProject || !myself.userId) return;
        let cancelled = false;
        popTeamMembers(myself).then((members) => {
            // `ownTeamOnly`: the roster includes the other teams' people you
            // already work with; a new project reaches them by being shared,
            // not by adding them as members.
            if (!cancelled)
                setTeamMembers(ownTeamOnly(members).filter((m) => m.userId !== myself.userId));
        });
        return () => {
            cancelled = true;
        };
    }, [usePM.openCreateProject, myself]);

    // Reset the picker (and errors) whenever the modal closes.
    useEffect(() => {
        if (!usePM.openCreateProject) {
            setSelectedMembers([]);
            setSearchQuery("");
            setErrorMessage(null);
        }
    }, [usePM.openCreateProject]);

    const filteredMembers = useMemo(() => {
        if (!searchQuery.trim()) return teamMembers;
        const query = searchQuery.toLowerCase();
        return teamMembers.filter(
            (m) =>
                m.userName.toLowerCase().includes(query) ||
                m.userEmail.toLowerCase().includes(query)
        );
    }, [teamMembers, searchQuery]);

    const handleToggleMember = (member: UserProps) => {
        setSelectedMembers((prev) =>
            prev.some((m) => m.userId === member.userId)
                ? prev.filter((m) => m.userId !== member.userId)
                : [...prev, member]
        );
    };

    const handleRemoveMember = (memberId: string) => {
        setSelectedMembers((prev) => prev.filter((m) => m.userId !== memberId));
    };

    const handleCreateProject = () => {
        if (projectName.trim()) {
            createProject();
        }
    };
    async function createProject(): Promise<void> {
        try {
            const _create = async () => {
                // Step-1: Create the project. The server makes the project's
                // system user itself, in the same transaction, and puts it on
                // the team (MIP-1031). The page used to sign one up through the
                // open signup endpoint and name it here.
                {
                    const createProjectResponse = await fetch(`${base_url}/project/`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${accessToken}`,
                        },
                        body: JSON.stringify({
                            team: myself.teamId,
                            project_name: projectName,
                            owner: myself.userId,
                            is_private: isPrivate,
                        }),
                    });

                    const createProjectData = await createProjectResponse.json();

                    if (!createProjectResponse.ok) {
                        console.error(createProjectData);
                        throw new Error(
                            createProjectData.hint || t.tasks.modals.createProject.creationFailed
                        );
                    } else {
                        // Step-2: Join the project.
                        const joinProjectResponse = await fetch(`${base_url}/project/join/`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${accessToken}`,
                            },
                            body: JSON.stringify({
                                team_id: myself.teamId,
                                project_id: createProjectData.project_id,
                                attendee_id: myself.userId,
                            }),
                        });

                        const joinProjectData = await joinProjectResponse.json();

                        if (!joinProjectResponse.ok) {
                            console.error(joinProjectData);
                            throw new Error(
                                joinProjectData.hint || t.tasks.modals.createProject.joinFailed
                            );
                        } else {
                            // Step-3: Join the team for the user.
                            const meJoinTeamRes = await joinTeam(
                                accessToken,
                                myself.teamId,
                                myself.userId,
                                setErrorMessage
                            );

                            if (meJoinTeamRes && createProjectData.project_id) {
                                // Add the selected initial members. Each is a
                                // separate POST /project/join/ (the endpoint
                                // takes one attendee_id); the Django
                                // `_sync_pm_channel_member` signal mirrors each
                                // into the project's PM channel automatically.
                                // Independent — a per-member failure doesn't
                                // sink the others or the creation itself.
                                for (const member of selectedMembers) {
                                    try {
                                        const memberJoinRes = await fetch(
                                            `${base_url}/project/join/`,
                                            {
                                                method: "POST",
                                                headers: {
                                                    "Content-Type": "application/json",
                                                    Authorization: `Bearer ${accessToken}`,
                                                },
                                                body: JSON.stringify({
                                                    team_id: myself.teamId,
                                                    project_id: createProjectData.project_id,
                                                    attendee_id: member.userId,
                                                }),
                                            }
                                        );
                                        if (!memberJoinRes.ok) {
                                            console.error(
                                                `[ModalCreateProject] member join failed for ${member.userId}:`,
                                                memberJoinRes.status
                                            );
                                        }
                                    } catch (e) {
                                        console.error(
                                            `[ModalCreateProject] member join threw for ${member.userId}:`,
                                            e
                                        );
                                    }
                                }
                                const newProject = {
                                    projectId: createProjectData.project_id,
                                    projectName: createProjectData.project_name,
                                    projectTags: [],
                                    isPrivate: isPrivate,
                                    systemUserId: createProjectData.project_system_user,
                                    isJoined: true,
                                };
                                usePM.setTeamProjects([...usePM.teamProjects, newProject]);
                                usePM.setCurrentProject(newProject);
                                usePM.setOpenCreateProject(false);
                                // Pull the project's brand-new PM channel into
                                // `allChats`. Django's `_ensure_pm_channel_for_project`
                                // signal creates it, but Django owns no socket —
                                // so nothing tells this tab, and `allChats` stays
                                // stale until some unrelated refresh.
                                //
                                // Everything keyed off the PM chat row is missing
                                // until then: the project sidebar entry, and — via
                                // `TaskHeader`'s `{pmChat && …}` gate — the project
                                // icon, which is the ONLY way into the project
                                // profile (and so into "Add members"). A user who
                                // just made a project couldn't invite anyone to it
                                // without reloading first.
                                //
                                // Awaited, not fire-and-forget: `setCurrentProject`
                                // above has already pointed the header at this
                                // project, so the row wants to exist as soon as it
                                // renders.
                                if (useCM) {
                                    try {
                                        await useCM.funcSetAllChats();
                                    } catch (e) {
                                        console.error(
                                            "[ModalCreateProject] chat-list refresh failed:",
                                            e
                                        );
                                    }
                                }
                                if (setIsNewProjectCreated) {
                                    setIsNewProjectCreated(true);
                                    usePM.loadProjectsAndTasks(createProjectData.project_id);
                                }
                            } else {
                                console.error("Failed to add me to the team");
                            }
                        }
                    }
                }
            };
            _create();
        } catch (error) {
            const err_msg = `${error}`;
            console.error(err_msg);
            setErrorMessage(err_msg);
        }
    }

    return (
        <ModalFrame
            icon={<FolderOpenIcon sx={{ color: g.accent.text }} />}
            open={usePM.openCreateProject}
            size="md"
            title={t.tasks.modals.createProject.heading}
            actions={
                <>
                    <Button
                        color="neutral"
                        variant="plain"
                        onClick={() => usePM.setOpenCreateProject(false)}
                    >
                        {t.tasks.modals.createProject.cancelButton}
                    </Button>
                    <Button disabled={!projectName.trim()} onClick={handleCreateProject}>
                        {t.tasks.modals.createProject.createButton}
                    </Button>
                </>
            }
            onClose={() => usePM.setOpenCreateProject(false)}
        >
            {/* Input */}
            <Input
                placeholder={t.tasks.modals.createProject.namePlaceholder}
                sx={{ mb: 2 }}
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && projectName.trim()) {
                        handleCreateProject();
                    }
                }}
            />

            {/* Checkbox */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    p: 1.5,
                    mb: 2,
                    borderRadius: g.radius.md,
                    backgroundColor: isPrivate ? g.accent.subtle : g.success.subtle,
                    border: `1px solid ${isPrivate ? g.accent.border : g.success.border}`,
                    cursor: "pointer",
                }}
                onClick={() => setIsPrivate(!isPrivate)}
            >
                <Checkbox
                    checked={isPrivate}
                    color="neutral"
                    sx={{ pointerEvents: "none" }}
                    variant="outlined"
                    onChange={(e) => setIsPrivate(e.target.checked)}
                />
                {isPrivate ? (
                    <LockOutlinedIcon sx={{ color: g.accent.text, fontSize: 18 }} />
                ) : (
                    <PublicIcon sx={{ color: g.success.text, fontSize: 18 }} />
                )}
                <Typography
                    level="body-sm"
                    sx={{ color: isPrivate ? g.accent.text : g.success.text }}
                >
                    {isPrivate
                        ? t.tasks.modals.createProject.privateProject
                        : t.tasks.modals.createProject.publicProject}
                </Typography>
            </Box>

            {/* Add members (optional) — same picker UX as GM creation */}
            <Typography level="body-xs" sx={{ mb: 1, color: g.text.secondary, fontWeight: 600 }}>
                {t.tasks.modals.createProject.addMembersLabel}
            </Typography>

            {/* Selected Members Chips */}
            {selectedMembers.length > 0 && (
                <Box
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 0.5,
                        mb: 2,
                        p: 1.5,
                        borderRadius: g.radius.md,
                        backgroundColor: g.accent.subtle,
                        border: `1px solid ${g.accent.border}`,
                    }}
                >
                    {selectedMembers.map((member) => (
                        <Chip
                            key={member.userId}
                            color="primary"
                            size="sm"
                            sx={{ "--Chip-gap": "4px", backgroundColor: g.accent.subtle }}
                            variant="soft"
                            endDecorator={
                                <CloseRoundedIcon
                                    sx={{ fontSize: 14, cursor: "pointer" }}
                                    onClick={() => handleRemoveMember(member.userId)}
                                />
                            }
                        >
                            <bdi className="g-bidi-island">{member.userName}</bdi>
                        </Chip>
                    ))}
                </Box>
            )}

            {/* Member Search */}
            <Input
                placeholder={t.tasks.modals.createProject.searchMembersPlaceholder}
                startDecorator={<SearchRoundedIcon sx={{ color: g.text.tertiary }} />}
                sx={{ mb: 1 }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />

            {/* Member List */}
            <Box
                sx={{
                    maxHeight: "200px",
                    overflowY: "auto",
                    mb: 1,
                    borderRadius: g.radius.md,
                    backgroundColor: g.bg.subtle,
                    border: `1px solid ${g.border.subtle}`,
                }}
            >
                {filteredMembers.length === 0 ? (
                    <Typography
                        level="body-sm"
                        sx={{ p: 3, textAlign: "center", color: g.text.tertiary }}
                    >
                        {searchQuery
                            ? t.tasks.modals.createProject.noMembersMatchingSearch
                            : t.tasks.modals.createProject.noMembersAvailable}
                    </Typography>
                ) : (
                    filteredMembers.map((member) => {
                        const isSelected = selectedMembers.some((m) => m.userId === member.userId);
                        return (
                            <Box
                                key={member.userId}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1.5,
                                    p: 1.5,
                                    cursor: "pointer",
                                    borderBottom: `1px solid ${g.border.subtle}`,
                                    backgroundColor: isSelected ? g.accent.subtle : "transparent",
                                    "&:hover": {
                                        backgroundColor: isSelected ? g.accent.subtle : g.hover,
                                    },
                                    "&:last-child": { borderBottom: "none" },
                                }}
                                onClick={() => handleToggleMember(member)}
                            >
                                <Checkbox
                                    checked={isSelected}
                                    color="primary"
                                    sx={{ pointerEvents: "none" }}
                                    variant="outlined"
                                />
                                <UserAvatar
                                    clickable={false}
                                    showPulseDot={false}
                                    userId={member.userId}
                                />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography
                                        level="body-sm"
                                        sx={{
                                            fontWeight: 500,
                                            color: g.text.primary,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        <bdi className="g-bidi-island">{member.userName}</bdi>
                                    </Typography>
                                    <Typography
                                        level="body-xs"
                                        sx={{
                                            color: g.text.tertiary,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {member.userEmail}
                                    </Typography>
                                </Box>
                            </Box>
                        );
                    })
                )}
            </Box>

            {/* Selected Count */}
            <Typography
                level="body-xs"
                sx={{ mb: 2, color: selectedMembers.length > 0 ? g.accent.text : g.text.tertiary }}
            >
                {fmt(t.tasks.modals.createProject.membersSelected, {
                    count: selectedMembers.length,
                })}
            </Typography>

            {/* Error Alert */}
            {errorMessage && (
                <Alert color="danger" sx={{ mb: 2 }}>
                    {errorMessage}
                </Alert>
            )}
        </ModalFrame>
    );
};
