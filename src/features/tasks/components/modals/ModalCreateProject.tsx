import React, { useEffect, useMemo, useState } from "react";
import { keyframes } from "@emotion/react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PublicIcon from "@mui/icons-material/Public";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    Input,
    Modal,
    ModalDialog,
    Stack,
    Typography,
} from "@mui/joy";

import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { replaceSpacesWithUnderscore } from "../../../../utils/stringHelper";
import { ownTeamOnly } from "../../../../utils/teamRoster";
import { joinTeam } from "../../../admin/services/joinTeam";
import { popTeamMembers } from "../../../admin/services/popTeamMembers";
import { signUp } from "../../../admin/services/signup";

const base_url = import.meta.env.VITE_API_BASE_URL;

const fadeIn = keyframes`
    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
`;

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
            // Signup for a system user for the new project
            const _signup = async (projectEmail: string, password: string) => {
                // Step-1: Create a system user for the new project.
                const signUpRes = await signUp(
                    projectName,
                    projectEmail,
                    password,
                    true,
                    setErrorMessage
                );

                // Step-2: If the system user is created successfully, create the project.
                // System user signups always return the JWT shape (the
                // backend skips the email-verification branch for
                // is_system_user=True), so the user payload is present.
                if (signUpRes && "user" in signUpRes) {
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
                            project_system_user: signUpRes.user.id,
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
                        // Step-3: Join the project.
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
                            // Step-4: Join the team for the system user.
                            const prjJoinTeamRes = await joinTeam(
                                accessToken,
                                myself.teamId,
                                signUpRes.user.id,
                                setErrorMessage
                            );

                            // Step-5: Join the team for the user.
                            const meJoinTeamRes = await joinTeam(
                                accessToken,
                                myself.teamId,
                                myself.userId,
                                setErrorMessage
                            );

                            if (prjJoinTeamRes && meJoinTeamRes && createProjectData.project_id) {
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
                                console.error("Failed to add me and/or system_user to the team");
                            }
                        }
                    }
                } else {
                    console.error("Failed to create system user for the project.");
                }
            };
            _signup(
                `${myself.teamId}-${replaceSpacesWithUnderscore(projectName)}@genos.tech`,
                `${projectName}-Bad-Password-Need-Secure-One`
            );
        } catch (error) {
            const err_msg = `${error}`;
            console.error(err_msg);
            setErrorMessage(err_msg);
        }
    }

    return (
        <Modal
            open={usePM.openCreateProject}
            sx={{
                zIndex: 10010,
                backdropFilter: "blur(4px)",
                // Transparent: Joy's own Backdrop slot already paints
                // `palette.background.backdrop` + blur(8px). Stacking a
                // second 50% black on the modal root composited to ~75%,
                // which read as a solid black page. Matches ModalUserProfile.
                backgroundColor: "transparent",
            }}
            onClose={() => usePM.setOpenCreateProject(false)}
        >
            <ModalDialog
                sx={{
                    animation: `${fadeIn} 0.2s ease-out`,
                    background:
                        "linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 28, 0.98) 100%)",
                    border: "1px solid rgba(var(--gp-brand-700-rgb), 0.2)",
                    borderRadius: "16px",
                    boxShadow:
                        "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(var(--gp-brand-700-rgb), 0.1)",
                    width: { xs: "calc(100vw - 24px)", md: "auto" },
                    minWidth: { xs: 0, md: "360px" },
                    maxWidth: { xs: "100vw", md: "500px" },
                    maxHeight: { xs: "calc(100dvh - 32px)", md: "85vh" },
                    p: { xs: 2, md: 3 },
                    overflow: "auto",
                }}
            >
                {/* Header */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 40,
                            height: 40,
                            borderRadius: "10px",
                            background:
                                "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.2) 0%, rgba(var(--gp-brand-500-rgb), 0.2) 100%)",
                            border: "1px solid rgba(var(--gp-brand-700-rgb), 0.3)",
                        }}
                    >
                        <FolderOpenIcon
                            sx={{ color: "rgba(var(--gp-brand-500-rgb), 0.9)", fontSize: 22 }}
                        />
                    </Box>
                    <Typography
                        level="h4"
                        sx={{
                            background:
                                "linear-gradient(135deg, var(--gp-brandalt-200) 0%, var(--gp-brandalt-300) 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            fontWeight: 600,
                        }}
                    >
                        {t.tasks.modals.createProject.heading}
                    </Typography>
                </Box>

                {/* Input */}
                <Input
                    placeholder={t.tasks.modals.createProject.namePlaceholder}
                    value={projectName}
                    sx={{
                        mb: 2,
                        "--Input-focusedThickness": "1px",
                        "--Input-focusedHighlight": "rgba(var(--gp-brand-700-rgb), 0.5)",
                        backgroundColor: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: "10px",
                        color: "#e0e0e0",
                        transition: "all 0.2s ease",
                        "&:hover": {
                            borderColor: "rgba(var(--gp-brand-700-rgb), 0.3)",
                        },
                        "& input::placeholder": {
                            color: "rgba(255, 255, 255, 0.4)",
                        },
                    }}
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
                        borderRadius: "10px",
                        backgroundColor: isPrivate
                            ? "rgba(var(--gp-brand-500-rgb), 0.1)"
                            : "rgba(34, 197, 94, 0.1)",
                        border: `1px solid ${isPrivate ? "rgba(var(--gp-brand-500-rgb), 0.2)" : "rgba(34, 197, 94, 0.2)"}`,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                    }}
                    onClick={() => setIsPrivate(!isPrivate)}
                >
                    <Checkbox
                        checked={isPrivate}
                        color="neutral"
                        sx={{ pointerEvents: "none" }}
                        variant="soft"
                        onChange={(e) => setIsPrivate(e.target.checked)}
                    />
                    {isPrivate ? (
                        <LockOutlinedIcon
                            sx={{ color: "rgba(var(--gp-brand-500-rgb), 0.8)", fontSize: 18 }}
                        />
                    ) : (
                        <PublicIcon sx={{ color: "rgba(34, 197, 94, 0.8)", fontSize: 18 }} />
                    )}
                    <Typography
                        level="body-sm"
                        sx={{
                            color: isPrivate
                                ? "rgba(var(--gp-brand-500-rgb), 0.9)"
                                : "rgba(34, 197, 94, 0.9)",
                        }}
                    >
                        {isPrivate
                            ? t.tasks.modals.createProject.privateProject
                            : t.tasks.modals.createProject.publicProject}
                    </Typography>
                </Box>

                {/* Add members (optional) — same picker UX as GM creation */}
                <Typography
                    level="body-xs"
                    sx={{ mb: 1, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}
                >
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
                            borderRadius: "10px",
                            backgroundColor: "rgba(var(--gp-brand-700-rgb), 0.1)",
                            border: "1px solid rgba(var(--gp-brand-700-rgb), 0.2)",
                        }}
                    >
                        {selectedMembers.map((member) => (
                            <Chip
                                key={member.userId}
                                color="primary"
                                size="sm"
                                variant="soft"
                                endDecorator={
                                    <CloseRoundedIcon
                                        sx={{ fontSize: 14, cursor: "pointer" }}
                                        onClick={() => handleRemoveMember(member.userId)}
                                    />
                                }
                                sx={{
                                    "--Chip-gap": "4px",
                                    backgroundColor: "rgba(var(--gp-brand-700-rgb), 0.2)",
                                }}
                            >
                                {member.userName}
                            </Chip>
                        ))}
                    </Box>
                )}

                {/* Member Search */}
                <Input
                    placeholder={t.tasks.modals.createProject.searchMembersPlaceholder}
                    value={searchQuery}
                    startDecorator={
                        <SearchRoundedIcon sx={{ color: "rgba(255, 255, 255, 0.4)" }} />
                    }
                    sx={{
                        mb: 1,
                        "--Input-focusedThickness": "1px",
                        "--Input-focusedHighlight": "rgba(var(--gp-brand-700-rgb), 0.5)",
                        backgroundColor: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: "10px",
                        color: "#e0e0e0",
                        transition: "all 0.2s ease",
                        "&:hover": { borderColor: "rgba(var(--gp-brand-700-rgb), 0.3)" },
                        "& input::placeholder": { color: "rgba(255, 255, 255, 0.4)" },
                    }}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />

                {/* Member List */}
                <Box
                    sx={{
                        maxHeight: "200px",
                        overflowY: "auto",
                        mb: 1,
                        borderRadius: "10px",
                        backgroundColor: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid rgba(255, 255, 255, 0.05)",
                    }}
                >
                    {filteredMembers.length === 0 ? (
                        <Typography
                            level="body-sm"
                            sx={{ p: 3, textAlign: "center", color: "rgba(255, 255, 255, 0.4)" }}
                        >
                            {searchQuery
                                ? t.tasks.modals.createProject.noMembersMatchingSearch
                                : t.tasks.modals.createProject.noMembersAvailable}
                        </Typography>
                    ) : (
                        filteredMembers.map((member) => {
                            const isSelected = selectedMembers.some(
                                (m) => m.userId === member.userId
                            );
                            return (
                                <Box
                                    key={member.userId}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1.5,
                                        p: 1.5,
                                        cursor: "pointer",
                                        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                                        transition: "all 0.15s ease",
                                        backgroundColor: isSelected
                                            ? "rgba(var(--gp-brand-700-rgb), 0.1)"
                                            : "transparent",
                                        "&:hover": {
                                            backgroundColor: isSelected
                                                ? "rgba(var(--gp-brand-700-rgb), 0.15)"
                                                : "rgba(255, 255, 255, 0.05)",
                                        },
                                        "&:last-child": { borderBottom: "none" },
                                    }}
                                    onClick={() => handleToggleMember(member)}
                                >
                                    <Checkbox
                                        checked={isSelected}
                                        color="primary"
                                        sx={{ pointerEvents: "none" }}
                                        variant="soft"
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
                                                color: "rgba(255, 255, 255, 0.9)",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {member.userName}
                                        </Typography>
                                        <Typography
                                            level="body-xs"
                                            sx={{
                                                color: "rgba(255, 255, 255, 0.4)",
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
                    sx={{
                        mb: 2,
                        color:
                            selectedMembers.length > 0
                                ? "rgba(var(--gp-brand-700-rgb), 0.8)"
                                : "rgba(255, 255, 255, 0.4)",
                    }}
                >
                    {fmt(t.tasks.modals.createProject.membersSelected, {
                        count: selectedMembers.length,
                    })}
                </Typography>

                {/* Error Alert */}
                {errorMessage && (
                    <Alert
                        color="danger"
                        sx={{
                            mb: 2,
                            borderRadius: "10px",
                            backgroundColor: "rgba(var(--gp-tint-danger-rgb), 0.1)",
                            border: "1px solid rgba(var(--gp-tint-danger-rgb), 0.3)",
                        }}
                    >
                        {errorMessage}
                    </Alert>
                )}

                {/* Action Buttons */}
                <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end" }}>
                    <Button
                        variant="plain"
                        sx={{
                            color: "rgba(255, 255, 255, 0.6)",
                            borderRadius: "10px",
                            px: 2.5,
                            "&:hover": {
                                backgroundColor: "rgba(255, 255, 255, 0.05)",
                                color: "rgba(255, 255, 255, 0.9)",
                            },
                        }}
                        onClick={() => usePM.setOpenCreateProject(false)}
                    >
                        {t.tasks.modals.createProject.cancelButton}
                    </Button>
                    <Button
                        disabled={!projectName.trim()}
                        sx={{
                            background:
                                "linear-gradient(135deg, var(--gp-brand-700) 0%, var(--gp-brand-800) 100%)",
                            borderRadius: "10px",
                            px: 3,
                            fontWeight: 600,
                            boxShadow: "0 4px 15px rgba(var(--gp-brand-700-rgb), 0.3)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                transform: "translateY(-1px)",
                                boxShadow: "0 6px 20px rgba(var(--gp-brand-700-rgb), 0.4)",
                            },
                            "&:disabled": {
                                background: "rgba(255, 255, 255, 0.1)",
                                color: "rgba(255, 255, 255, 0.3)",
                            },
                        }}
                        onClick={handleCreateProject}
                    >
                        {t.tasks.modals.createProject.createButton}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
