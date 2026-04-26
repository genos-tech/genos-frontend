import React, { useState } from "react";
import { keyframes } from "@emotion/react";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import { Alert, Box, Button, Chip, Input, Modal, ModalDialog, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { useAuth } from "../../../../context/AuthContext";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ProjectProps } from "../../../../types/tasks";
import { ColorPickerMenu } from "../contents/base/sub/TagColorPickerMenu";

const fadeIn = keyframes`
    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
`;

const base_url = import.meta.env.VITE_API_BASE_URL;

type Props = {
    myself: UserProps;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
};

export const ModalCreateTag: React.FC<Props> = ({ myself, usePM, useTM }) => {
    const { accessToken } = useAuth();
    const [errorTagCreateMessage, setErrorTagCreateMessage] = useState<string | null>(null);
    const [tagName, setTagName] = useState("");
    const { mode } = useColorScheme();
    const [selectedColor, setSelectedColor] = useState({
        chipColor: "#ff2323",
        textColor: "white",
    });

    const handleCreateTag = () => {
        const trimmed = tagName.trim();
        if (!trimmed) {
            setErrorTagCreateMessage("Tag name cannot be empty.");
            return;
        }
        if (/\s/.test(trimmed)) {
            setErrorTagCreateMessage("Tag name must not contain spaces.");
            return;
        }
        setErrorTagCreateMessage(null);
        createTag(trimmed);
    };

    async function createTag(trimmedName: string): Promise<void> {
        try {
            const response = await fetch(`${base_url}/project/tag/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    team_id: myself.teamId,
                    project_id: usePM.currentProject?.projectId ?? -1,
                    tag_name: trimmedName,
                    tag_color: selectedColor.chipColor,
                    tag_text_color: selectedColor.textColor,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                console.error(data);
                throw new Error(data.hint || "Tag Creation Failed");
            } else {
                useTM.setOpenCreateTag(false);
                setTagName("");
                useTM.setIsNewTagCreated(true);
            }
        } catch (error) {
            const errMsg = `${error}`;
            console.error(errMsg);
            setErrorTagCreateMessage(errMsg);
        }
    }

    return (
        <Modal
            open={useTM.openCreateTag}
            sx={{
                zIndex: 10010,
                backdropFilter: "blur(4px)",
                backgroundColor: "rgba(0, 0, 0, 0.5)",
            }}
            onClose={() => useTM.setOpenCreateTag(false)}
        >
            <ModalDialog
                sx={{
                    animation: `${fadeIn} 0.2s ease-out`,
                    background:
                        "linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 28, 0.98) 100%)",
                    border: "1px solid rgba(34, 197, 94, 0.2)",
                    borderRadius: "16px",
                    boxShadow:
                        "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(34, 197, 94, 0.1)",
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
                                "linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%)",
                            border: "1px solid rgba(34, 197, 94, 0.3)",
                        }}
                    >
                        <LocalOfferIcon sx={{ color: "rgba(34, 197, 94, 0.9)", fontSize: 22 }} />
                    </Box>
                    <Typography
                        level="h4"
                        sx={{
                            background: "linear-gradient(135deg, #86efac 0%, #4ade80 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            fontWeight: 600,
                        }}
                    >
                        Create New Tag
                    </Typography>
                </Box>

                {/* Error Alert */}
                {errorTagCreateMessage && (
                    <Alert
                        color="danger"
                        sx={{
                            mb: 2,
                            borderRadius: "10px",
                            backgroundColor: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                        }}
                    >
                        {errorTagCreateMessage}
                    </Alert>
                )}

                {/* Input Row */}
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    <Input
                        placeholder="Enter tag name..."
                        value={tagName}
                        onChange={(e) => setTagName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                handleCreateTag();
                            }
                        }}
                        sx={{
                            flex: 1,
                            "--Input-focusedThickness": "1px",
                            "--Input-focusedHighlight": "rgba(34, 197, 94, 0.5)",
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "10px",
                            color: "#fff",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                borderColor: "rgba(34, 197, 94, 0.3)",
                            },
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

                {/* Tag Preview */}
                {selectedColor && tagName !== "" && (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5,
                            p: 2,
                            mb: 2,
                            borderRadius: "10px",
                            backgroundColor: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                        }}
                    >
                        <Typography level="body-sm" sx={{ color: "rgba(255, 255, 255, 0.5)" }}>
                            Preview:
                        </Typography>
                        <Chip
                            variant="outlined"
                            sx={{
                                color: "white",
                                fontWeight: "bold",
                                borderRadius: "6px",
                                borderWidth: "2px",
                                borderColor: alpha(
                                    selectedColor.chipColor,
                                    mode === "dark" ? 0.6 : 0.75
                                ),
                                backgroundColor: alpha(selectedColor.chipColor, 0.1),
                            }}
                        >
                            {tagName}
                        </Chip>
                    </Box>
                )}

                {/* Action Buttons */}
                <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end" }}>
                    <Button
                        variant="plain"
                        onClick={() => useTM.setOpenCreateTag(false)}
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
                        disabled={!tagName.trim()}
                        onClick={handleCreateTag}
                        sx={{
                            background: "linear-gradient(135deg, #22c55e 0%, #10b981 100%)",
                            borderRadius: "10px",
                            px: 3,
                            fontWeight: 600,
                            boxShadow: "0 4px 15px rgba(34, 197, 94, 0.3)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                transform: "translateY(-1px)",
                                boxShadow: "0 6px 20px rgba(34, 197, 94, 0.4)",
                            },
                            "&:disabled": {
                                background: "rgba(255, 255, 255, 0.1)",
                                color: "rgba(255, 255, 255, 0.3)",
                            },
                        }}
                    >
                        Create Tag
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
