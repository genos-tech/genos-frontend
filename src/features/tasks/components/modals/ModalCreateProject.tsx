import React, { useState } from "react";
import { keyframes } from "@emotion/react";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PublicIcon from "@mui/icons-material/Public";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Input,
    Modal,
    ModalDialog,
    Stack,
    Typography,
} from "@mui/joy";

import { useAuth } from "../../../../context/AuthContext";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { replaceSpacesWithUnderscore } from "../../../../utils/stringHelper";
import { joinTeam } from "../../../admin/services/joinTeam";
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
};

export const ModalCreateProject: React.FC<Props> = ({ myself, usePM, setIsNewProjectCreated }) => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isPrivate, setIsPrivate] = useState(false);
    const [projectName, setProjectName] = useState("");
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
                backgroundColor: "rgba(0, 0, 0, 0.5)",
            }}
            onClose={() => usePM.setOpenCreateProject(false)}
        >
            <ModalDialog
                sx={{
                    animation: `${fadeIn} 0.2s ease-out`,
                    background:
                        "linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 28, 0.98) 100%)",
                    border: "1px solid rgba(124,58,237,0.2)",
                    borderRadius: "16px",
                    boxShadow:
                        "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(124,58,237,0.1)",
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
                                "linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(168, 85, 247, 0.2) 100%)",
                            border: "1px solid rgba(124,58,237,0.3)",
                        }}
                    >
                        <FolderOpenIcon sx={{ color: "rgba(168, 85, 247, 0.9)", fontSize: 22 }} />
                    </Box>
                    <Typography
                        level="h4"
                        sx={{
                            background: "linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%)",
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
                        "--Input-focusedHighlight": "rgba(124,58,237,0.5)",
                        backgroundColor: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: "10px",
                        color: "#e0e0e0",
                        transition: "all 0.2s ease",
                        "&:hover": {
                            borderColor: "rgba(124,58,237,0.3)",
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
                            ? "rgba(168, 85, 247, 0.1)"
                            : "rgba(34, 197, 94, 0.1)",
                        border: `1px solid ${isPrivate ? "rgba(168, 85, 247, 0.2)" : "rgba(34, 197, 94, 0.2)"}`,
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
                            sx={{ color: "rgba(168, 85, 247, 0.8)", fontSize: 18 }}
                        />
                    ) : (
                        <PublicIcon sx={{ color: "rgba(34, 197, 94, 0.8)", fontSize: 18 }} />
                    )}
                    <Typography
                        level="body-sm"
                        sx={{
                            color: isPrivate
                                ? "rgba(168, 85, 247, 0.9)"
                                : "rgba(34, 197, 94, 0.9)",
                        }}
                    >
                        {isPrivate
                            ? t.tasks.modals.createProject.privateProject
                            : t.tasks.modals.createProject.publicProject}
                    </Typography>
                </Box>

                {/* Error Alert */}
                {errorMessage && (
                    <Alert
                        color="danger"
                        sx={{
                            mb: 2,
                            borderRadius: "10px",
                            backgroundColor: "rgba(232,121,195,0.1)",
                            border: "1px solid rgba(232,121,195,0.3)",
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
                            background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                            borderRadius: "10px",
                            px: 3,
                            fontWeight: 600,
                            boxShadow: "0 4px 15px rgba(124, 58, 237, 0.3)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                transform: "translateY(-1px)",
                                boxShadow: "0 6px 20px rgba(124, 58, 237, 0.4)",
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
