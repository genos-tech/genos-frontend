import React, { useState } from "react";
import { keyframes } from "@emotion/react";
import FolderSharedIcon from "@mui/icons-material/FolderShared";
import LockOutlineIcon from "@mui/icons-material/LockOutline";
import PublicIcon from "@mui/icons-material/Public";
import SendIcon from "@mui/icons-material/Send";
import { Alert, Box, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { ProjectProps } from "../../../../types/tasks";

const fadeIn = keyframes`
    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
`;

const base_url = import.meta.env.VITE_API_BASE_URL;
const disableOpenJoinModalParams = {
    flag: false,
    projectId: -1,
    projectName: "",
    isPrivate: true,
    systemUserId: "",
};

type Props = {
    socket: Socket | null;
    myself: UserProps;
    openJoinProject: {
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    };
    setOpenJoinProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    }) => void;
    usePM: ProjectManagementState;
    useCM: ChatManagementState;
};
export const ModalJoinProject: React.FC<Props> = ({
    useCM,
    usePM,
    socket,
    myself,
    openJoinProject,
    setOpenJoinProject,
}) => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    async function joinProject(): Promise<void> {
        try {
            if (socket !== null) {
                if (openJoinProject.isPrivate === true) {
                    socket.emit(
                        "join_project_request",
                        {
                            joiningProjectId: openJoinProject.projectId,
                            joiningProjectName: openJoinProject.projectName,
                        },
                        async (ack: any) => {
                            const item_body = [
                                {
                                    type: "paragraph",
                                    props: {
                                        textColor: "default",
                                        textAlignment: "left",
                                        backgroundColor: "default",
                                    },
                                    content: [
                                        {
                                            text: t.tasks.modals.joinProject.requestMessagePrefix,
                                            type: "text",
                                            styles: {},
                                        },
                                        {
                                            text: openJoinProject.projectName,
                                            type: "text",
                                            styles: { bold: true, textColor: "pink" },
                                        },
                                        {
                                            text: t.tasks.modals.joinProject.requestMessageSuffix,
                                            type: "text",
                                            styles: {},
                                        },
                                    ],
                                    children: [],
                                },
                                {
                                    type: "paragraph",
                                    props: {
                                        textColor: "default",
                                        textAlignment: "left",
                                        backgroundColor: "default",
                                    },
                                    content: [],
                                    children: [],
                                },
                            ];

                            const sendInboxMessageResponse = await fetch(`${base_url}/inbox/`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${accessToken}`,
                                },
                                body: JSON.stringify({
                                    team_id: myself.teamId,
                                    sender_id: myself.userId,
                                    receiver_id: myself.userId,
                                    item_body: item_body,
                                    item_type: 0,
                                }),
                            });
                            if (!sendInboxMessageResponse.ok) {
                                throw new Error(t.tasks.modals.joinProject.sendMessageFailed);
                            }
                        }
                    );
                } else {
                    const joinProjectResponse = await fetch(`${base_url}/project/join/`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${accessToken}`,
                        },
                        body: JSON.stringify({
                            team_id: myself.teamId,
                            project_id: openJoinProject.projectId,
                            attendee_id: myself.userId,
                        }),
                    });

                    const joinProjectData = await joinProjectResponse.json();

                    if (!joinProjectResponse.ok) {
                        console.error(joinProjectData);
                        throw new Error(
                            joinProjectData.hint || t.tasks.modals.joinProject.joinFailed
                        );
                    } else {
                        if (openJoinProject.projectId) {
                            usePM.setTeamProjects(
                                usePM.teamProjects.map((p) =>
                                    p.projectId === openJoinProject.projectId
                                        ? { ...p, isJoined: true }
                                        : p
                                )
                            );
                            usePM.setCurrentProject({
                                projectId: openJoinProject.projectId,
                                projectName: openJoinProject.projectName,
                                isPrivate: openJoinProject.isPrivate,
                                projectTags: [],
                                systemUserId: openJoinProject.systemUserId,
                            });
                            // v3 source. The PM channel is added to the
                            // joiner's `user:{userId}` room via the
                            // backend's join hook, which broadcasts
                            // `channel.created` (or `channel.member_added`
                            // if the channel already existed). The v3
                            // subscription in `useChatManagement` picks
                            // it up and re-derives `allChats` — no
                            // manual REST refresh of the chat row needed.
                        } else {
                            console.error("Failed to join the project");
                        }
                    }
                }
                setOpenJoinProject(disableOpenJoinModalParams);
            } else {
                const err_msg: string = t.tasks.modals.joinProject.socketNotFound;
                console.error(err_msg);
                setErrorMessage(err_msg);
                throw new Error(err_msg);
            }
        } catch (error) {
            const err_msg = `${error}`;
            console.error(err_msg);
            setErrorMessage(err_msg);
        }
    }

    const handleJoinProject = () => {
        joinProject();
    };

    return (
        <Modal
            open={openJoinProject.flag}
            sx={{
                zIndex: 10010,
                backdropFilter: "blur(4px)",
                // Transparent: Joy's own Backdrop slot already paints
                // `palette.background.backdrop` + blur(8px). Stacking a
                // second 50% black on the modal root composited to ~75%,
                // which read as a solid black page. Matches ModalUserProfile.
                backgroundColor: "transparent",
            }}
            onClose={() => setOpenJoinProject(disableOpenJoinModalParams)}
        >
            <ModalDialog
                sx={{
                    animation: `${fadeIn} 0.2s ease-out`,
                    background:
                        "linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 28, 0.98) 100%)",
                    border: `1px solid ${openJoinProject.isPrivate ? "rgba(var(--gp-brand-500-rgb), 0.2)" : "rgba(var(--gp-brand-500-rgb), 0.2)"}`,
                    borderRadius: "16px",
                    boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px ${openJoinProject.isPrivate ? "rgba(var(--gp-brand-500-rgb), 0.1)" : "rgba(var(--gp-brand-500-rgb), 0.1)"}`,
                    width: { xs: "calc(100vw - 24px)", md: "auto" },
                    minWidth: { xs: 0, md: "360px" },
                    maxWidth: { xs: "100vw", md: "500px" },
                    maxHeight: { xs: "calc(100dvh - 32px)", md: "85vh" },
                    p: { xs: 2, md: 3 },
                    overflow: "auto",
                    textAlign: "center",
                }}
            >
                {/* Icon */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 56,
                        height: 56,
                        borderRadius: "14px",
                        background: openJoinProject.isPrivate
                            ? "linear-gradient(135deg, rgba(var(--gp-brand-500-rgb), 0.15) 0%, rgba(var(--gp-brandalt-500-rgb), 0.15) 100%)"
                            : "linear-gradient(135deg, rgba(var(--gp-brand-500-rgb), 0.15) 0%, rgba(var(--gp-brand-700-rgb), 0.15) 100%)",
                        border: `1px solid ${openJoinProject.isPrivate ? "rgba(var(--gp-brand-500-rgb), 0.25)" : "rgba(var(--gp-brand-500-rgb), 0.25)"}`,
                        mx: "auto",
                        mb: 2,
                    }}
                >
                    <FolderSharedIcon
                        sx={{
                            color: openJoinProject.isPrivate
                                ? "rgba(var(--gp-brand-500-rgb), 0.9)"
                                : "rgba(var(--gp-brand-500-rgb), 0.9)",
                            fontSize: 28,
                        }}
                    />
                </Box>

                {/* Privacy Badge */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 1,
                        mb: 1,
                    }}
                >
                    {openJoinProject.isPrivate ? (
                        <>
                            <LockOutlineIcon
                                sx={{ color: "rgba(var(--gp-brand-500-rgb), 0.7)", fontSize: 16 }}
                            />
                            <Typography
                                level="body-xs"
                                sx={{
                                    color: "rgba(var(--gp-brand-500-rgb), 0.8)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.1em",
                                }}
                            >
                                {t.tasks.modals.joinProject.privateBadge}
                            </Typography>
                        </>
                    ) : (
                        <>
                            <PublicIcon
                                sx={{ color: "rgba(var(--gp-brand-500-rgb), 0.7)", fontSize: 16 }}
                            />
                            <Typography
                                level="body-xs"
                                sx={{
                                    color: "rgba(var(--gp-brand-500-rgb), 0.8)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.1em",
                                }}
                            >
                                {t.tasks.modals.joinProject.publicBadge}
                            </Typography>
                        </>
                    )}
                </Box>

                {/* Title */}
                <Typography
                    level="h4"
                    sx={{
                        color: "rgba(255, 255, 255, 0.9)",
                        fontWeight: 600,
                        mb: 0.5,
                    }}
                >
                    {openJoinProject.isPrivate
                        ? t.tasks.modals.joinProject.requestHeading
                        : t.tasks.modals.joinProject.joinHeading}
                </Typography>

                {/* Project Name */}
                <Typography
                    level="h3"
                    sx={{
                        background: openJoinProject.isPrivate
                            ? "linear-gradient(135deg, var(--gp-brand-500) 0%, var(--gp-brandalt-500) 100%)"
                            : "linear-gradient(135deg, var(--gp-brand-700) 0%, var(--gp-brand-800) 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        fontWeight: 700,
                        mb: 2.5,
                    }}
                >
                    {openJoinProject.projectName}
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
                            textAlign: "left",
                        }}
                    >
                        {errorMessage}
                    </Alert>
                )}

                {/* Action Buttons */}
                <Stack direction="row" spacing={1.5} sx={{ justifyContent: "center" }}>
                    <Button
                        variant="plain"
                        sx={{
                            color: "rgba(255, 255, 255, 0.6)",
                            borderRadius: "10px",
                            px: 3,
                            "&:hover": {
                                backgroundColor: "rgba(255, 255, 255, 0.05)",
                                color: "rgba(255, 255, 255, 0.9)",
                            },
                        }}
                        onClick={() => setOpenJoinProject(disableOpenJoinModalParams)}
                    >
                        {t.tasks.modals.joinProject.cancelButton}
                    </Button>
                    <Button
                        endDecorator={
                            openJoinProject.isPrivate ? (
                                <SendIcon sx={{ fontSize: 16 }} />
                            ) : undefined
                        }
                        sx={{
                            background: openJoinProject.isPrivate
                                ? "linear-gradient(135deg, var(--gp-brand-500) 0%, var(--gp-brandalt-500) 100%)"
                                : "linear-gradient(135deg, var(--gp-brand-700) 0%, var(--gp-brand-800) 100%)",
                            borderRadius: "10px",
                            px: 3,
                            fontWeight: 600,
                            boxShadow: openJoinProject.isPrivate
                                ? "0 4px 15px rgba(var(--gp-brand-500-rgb), 0.3)"
                                : "0 4px 15px rgba(var(--gp-brand-700-rgb), 0.3)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                transform: "translateY(-1px)",
                                boxShadow: openJoinProject.isPrivate
                                    ? "0 6px 20px rgba(var(--gp-brand-500-rgb), 0.4)"
                                    : "0 6px 20px rgba(var(--gp-brand-500-rgb), 0.4)",
                            },
                        }}
                        onClick={handleJoinProject}
                    >
                        {openJoinProject.isPrivate
                            ? t.tasks.modals.joinProject.sendButton
                            : t.tasks.modals.joinProject.joinButton}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
