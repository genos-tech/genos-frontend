import { alpha } from "@mui/system";
import React, { useState } from "react";
import { Modal, ModalDialog, Alert, Stack, Button, Input, Box, Chip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { ColorPickerMenu } from "../contents/base/sub/TagColorPickerMenu";
import { UserProps } from "../../../../types/admin";
import { ProjectProps } from "../../../../types/tasks";
import { useAuth } from "../../../../context/AuthContext";

const base_url = import.meta.env.VITE_API_BASE_URL;

type Props = {
    myself: UserProps;
    currentProject: ProjectProps | null;
    openCreateTag: boolean;
    setOpenCreateTag: (value: boolean) => void;
    setIsNewTagCreated: (value: boolean) => void;
};

export const ModalCreateTag: React.FC<Props> = ({
    myself,
    currentProject,
    openCreateTag,
    setOpenCreateTag,
    setIsNewTagCreated,
}) => {
    const { accessToken } = useAuth();
    const [errorTagCreateMessage, setErrorTagCreateMessage] = useState<string | null>(null);
    const [tagName, setTagName] = useState("");
    const { mode } = useColorScheme();
    const [selectedColor, setSelectedColor] = useState({
        chipColor: "#ff2323",
        textColor: "white",
    });

    const handleCreateTag = () => {
        if (tagName.trim()) {
            createTag();
        }
    };

    async function createTag(): Promise<void> {
        try {
            const response = await fetch(`${base_url}/project/tag/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    team_id: myself.teamId,
                    project_id: currentProject?.projectId ?? -1,
                    tag_name: tagName,
                    tag_color: selectedColor.chipColor,
                    tag_text_color: selectedColor.textColor,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                console.error(data);
                throw new Error(data.hint || "Tag Creation Failed");
            } else {
                setOpenCreateTag(false);
                setTagName("");
                setIsNewTagCreated(true);
            }
        } catch (error) {
            const errMsg = `${error}`;
            console.error(errMsg);
            setErrorTagCreateMessage(errMsg);
        }
    }

    return (
        <>
            <Modal
                sx={{ zIndex: 10010 }}
                open={openCreateTag}
                onClose={() => setOpenCreateTag(false)}
            >
                <ModalDialog>
                    <Typography level="h4">Create New Tag</Typography>
                    {errorTagCreateMessage && errorTagCreateMessage !== "" && (
                        <Alert color="danger">{errorTagCreateMessage}</Alert>
                    )}
                    <Stack direction={"row"}>
                        <Input
                            placeholder="Unique tag name"
                            value={tagName}
                            onChange={(e) => setTagName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && tagName.trim()) {
                                    handleCreateTag();
                                }
                            }}
                        />
                        <ColorPickerMenu
                            onSelectColor={(color) =>
                                setSelectedColor({
                                    chipColor: color.value,
                                    textColor: color.textColor,
                                })
                            }
                        />
                    </Stack>
                    {selectedColor && tagName !== "" && (
                        <Box>
                            Tag will be:&nbsp;
                            <Chip
                                variant="outlined"
                                sx={{
                                    color: mode === "dark" ? "white" : "black",
                                    fontWeight: "bold",
                                    borderRadius: "5px",
                                    borderWidth: "3px",
                                    borderColor: alpha(
                                        selectedColor.chipColor,
                                        mode === "dark" ? 0.5 : 0.75
                                    ),
                                }}
                            >
                                {tagName}
                            </Chip>
                        </Box>
                    )}
                    <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "flex-end" }}>
                        <Button
                            component="a"
                            variant="outlined"
                            color="danger"
                            onClick={() => setOpenCreateTag(false)}
                        >
                            Cancel
                        </Button>
                        <Button component="a" onClick={handleCreateTag} disabled={!tagName.trim()}>
                            Create
                        </Button>
                    </Stack>
                </ModalDialog>
            </Modal>
        </>
    );
};
