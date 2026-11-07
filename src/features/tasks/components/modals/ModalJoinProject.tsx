import React, { useState } from "react";
import FolderSharedIcon from "@mui/icons-material/FolderShared";
import LockOutlineIcon from "@mui/icons-material/LockOutline";
import PublicIcon from "@mui/icons-material/Public";
import SendIcon from "@mui/icons-material/Send";
import { Alert, Box, Button, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { useAuth } from "../../../../context/AuthContext";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";

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
};
export const ModalJoinProject: React.FC<Props> = ({
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
                        // `error` alongside `hint`: the authorization
                        // refusals ("Project not found.", "Only members
                        // of this team can…") only populate `error`, so
                        // without it every refusal collapsed into the
                        // generic line and gave no clue which gate hit.
                        throw new Error(
                            joinProjectData.hint ||
                                joinProjectData.error ||
                                t.tasks.modals.joinProject.joinFailed
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
        <ModalFrame
            icon={<FolderSharedIcon sx={{ color: g.accent.text }} />}
            open={openJoinProject.flag}
            size="sm"
            zIndex={10010}
            actions={
                <>
                    <Button
                        color="neutral"
                        variant="plain"
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
                        onClick={handleJoinProject}
                    >
                        {openJoinProject.isPrivate
                            ? t.tasks.modals.joinProject.sendButton
                            : t.tasks.modals.joinProject.joinButton}
                    </Button>
                </>
            }
            title={
                openJoinProject.isPrivate
                    ? t.tasks.modals.joinProject.requestHeading
                    : t.tasks.modals.joinProject.joinHeading
            }
            onClose={() => setOpenJoinProject(disableOpenJoinModalParams)}
        >
            {/* Privacy Badge */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                {openJoinProject.isPrivate ? (
                    <LockOutlineIcon sx={{ color: g.text.tertiary, fontSize: 16 }} />
                ) : (
                    <PublicIcon sx={{ color: g.text.tertiary, fontSize: 16 }} />
                )}
                <Typography
                    level="body-xs"
                    sx={{
                        color: g.text.secondary,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                    }}
                >
                    {openJoinProject.isPrivate
                        ? t.tasks.modals.joinProject.privateBadge
                        : t.tasks.modals.joinProject.publicBadge}
                </Typography>
            </Box>

            {/* Project Name */}
            <Typography
                level="title-lg"
                sx={{ color: g.text.primary, mb: 1, overflowWrap: "anywhere" }}
            >
                {openJoinProject.projectName}
            </Typography>

            {/* Error Alert */}
            {errorMessage && (
                <Alert color="danger" sx={{ mt: 1 }}>
                    {errorMessage}
                </Alert>
            )}
        </ModalFrame>
    );
};
