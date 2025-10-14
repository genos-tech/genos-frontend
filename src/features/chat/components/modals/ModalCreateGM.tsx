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
import React, { useState } from "react";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { UserProps } from "../../../../types/admin";
import { AllChatProps, ChatProps } from "../../../../types/chat";
import { createChatGroup } from "../../services/createChatGroup";

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

    const [isPrivate, setIsPrivate] = useState(true);
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
                accessToken ? accessToken : "",
                isPrivate
            );
        }
    };

    return (
        <>
            <Modal open={open} sx={{ zIndex: 10000 }} onClose={() => setOpen(false)}>
                <ModalDialog>
                    <Typography level="h4">Create New Group</Typography>
                    <Input
                        placeholder="Enter group name"
                        sx={{ mt: 1 }}
                        value={chatName}
                        onChange={(e) => setGroupName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && chatName.trim()) {
                                handleCreateGroup();
                            }
                        }}
                    />
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Checkbox
                            checked={isPrivate}
                            color="neutral"
                            label="🔒 Private Project"
                            sx={{ mt: 1 }}
                            variant="soft"
                            onChange={(e) => setIsPrivate(e.target.checked)}
                        />
                    </Box>
                    {CreateCGErrorMessage && CreateCGErrorMessage !== "" && (
                        <Alert color="danger">{CreateCGErrorMessage}</Alert>
                    )}
                    <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "flex-end" }}>
                        <Button
                            color="danger"
                            component="a"
                            variant="outlined"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            component="a"
                            disabled={!chatName.trim()}
                            onClick={handleCreateGroup}
                        >
                            Create
                        </Button>
                    </Stack>
                </ModalDialog>
            </Modal>
        </>
    );
};
