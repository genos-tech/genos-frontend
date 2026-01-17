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
import { SignUpResponse, UserProps } from "../../../../types/admin";
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

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isPrivate, setIsPrivate] = useState(true);
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
                const signUpRes: SignUpResponse = await signUp(
                    projectName,
                    projectEmail,
                    password,
                    true,
                    setErrorMessage
                );

                // Step-2: If the system user is created successfully, create the project.
                if (signUpRes) {
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
                        throw new Error(createProjectData.hint || "Project Creation Failed");
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
                                joinProjectData.hint || "Failed to join the created project"
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
                                usePM.setCurrentProject({
                                    projectId: createProjectData.project_id,
                                    projectName: createProjectData.project_name,
                                    projectTags: [],
                                    systemUserId: createProjectData.project_system_user,
                                });
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
                    border: "1px solid rgba(99, 102, 241, 0.2)",
                    borderRadius: "16px",
                    boxShadow:
                        "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.1)",
                    minWidth: "360px",
                    p: 3,
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
                                "linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%)",
                            border: "1px solid rgba(99, 102, 241, 0.3)",
                        }}
                    >
                        <FolderOpenIcon sx={{ color: "rgba(168, 85, 247, 0.9)", fontSize: 22 }} />
                    </Box>
                    <Typography
                        level="h4"
                        sx={{
                            background: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            fontWeight: 600,
                        }}
                    >
                        Create New Project
                    </Typography>
                </Box>

                {/* Input */}
                <Input
                    placeholder="Enter project name..."
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && projectName.trim()) {
                            handleCreateProject();
                        }
                    }}
                    sx={{
                        mb: 2,
                        "--Input-focusedThickness": "1px",
                        "--Input-focusedHighlight": "rgba(99, 102, 241, 0.5)",
                        backgroundColor: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: "10px",
                        transition: "all 0.2s ease",
                        "&:hover": {
                            borderColor: "rgba(99, 102, 241, 0.3)",
                        },
                        "&::placeholder": {
                            color: "rgba(255, 255, 255, 0.4)",
                        },
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
                        variant="soft"
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        sx={{ pointerEvents: "none" }}
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
                        {isPrivate ? "Private Project" : "Public Project"}
                    </Typography>
                </Box>

                {/* Error Alert */}
                {errorMessage && (
                    <Alert
                        color="danger"
                        sx={{
                            mb: 2,
                            borderRadius: "10px",
                            backgroundColor: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                        }}
                    >
                        {errorMessage}
                    </Alert>
                )}

                {/* Action Buttons */}
                <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end" }}>
                    <Button
                        variant="plain"
                        onClick={() => usePM.setOpenCreateProject(false)}
                        sx={{
                            color: "rgba(255, 255, 255, 0.6)",
                            borderRadius: "10px",
                            px: 2.5,
                            "&:hover": {
                                backgroundColor: "rgba(255, 255, 255, 0.05)",
                                color: "rgba(255, 255, 255, 0.9)",
                            },
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        disabled={!projectName.trim()}
                        onClick={handleCreateProject}
                        sx={{
                            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                            borderRadius: "10px",
                            px: 3,
                            fontWeight: 600,
                            boxShadow: "0 4px 15px rgba(99, 102, 241, 0.3)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                transform: "translateY(-1px)",
                                boxShadow: "0 6px 20px rgba(99, 102, 241, 0.4)",
                            },
                            "&:disabled": {
                                background: "rgba(255, 255, 255, 0.1)",
                                color: "rgba(255, 255, 255, 0.3)",
                            },
                        }}
                    >
                        Create Project
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
