import React, { useState } from "react";
import { Modal, ModalDialog, Alert, Stack, Button, Input, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { createChatGroup } from "../../services/createChatGroup";
import { useAuth } from "../../../../context/AuthContext";
import { UserProps } from "../../../../types/admin";
import { AllChatProps, ChatProps } from "../../../../types/chat";

type Props = {
    socket: Socket | null;
    myself: UserProps;
    open: boolean;
    setOpen: (value: boolean) => void;
    allChats: AllChatProps[];
    setAllChats: (value: AllChatProps[]) => void;
    setCurrentMainChat: (value: ChatProps) => void;
};

export const ModalCreateGM: React.FC<Props> = ({
    socket,
    myself,
    open,
    setOpen,
    allChats,
    setAllChats,
    setCurrentMainChat,
}) => {
    const { accessToken } = useAuth();

    const [CreateCGErrorMessage, setCreateCGErrorMessage] = useState<string | null>(null);
    const [chatName, setGroupName] = useState("");
    const handleCreateGroup = () => {
        if (chatName.trim()) {
            createChatGroup(
                myself,
                chatName,
                allChats,
                socket,
                setCreateCGErrorMessage,
                setOpen,
                setGroupName,
                setAllChats,
                setCurrentMainChat,
                accessToken ? accessToken : ""
            );
        }
    };

    return (
        <>
            <Modal open={open} onClose={() => setOpen(false)} sx={{ zIndex: 10000 }}>
                <ModalDialog>
                    <Typography level="h4">Create New Group</Typography>
                    <Input
                        placeholder="Enter group name"
                        value={chatName}
                        onChange={(e) => setGroupName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && chatName.trim()) {
                                handleCreateGroup();
                            }
                        }}
                        sx={{ mt: 1 }}
                    />
                    {CreateCGErrorMessage && CreateCGErrorMessage !== "" && (
                        <Alert color="danger">{CreateCGErrorMessage}</Alert>
                    )}
                    <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "flex-end" }}>
                        <Button
                            component="a"
                            variant="outlined"
                            color="danger"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            component="a"
                            onClick={handleCreateGroup}
                            disabled={!chatName.trim()}
                        >
                            Create
                        </Button>
                    </Stack>
                </ModalDialog>
            </Modal>
        </>
    );
};
