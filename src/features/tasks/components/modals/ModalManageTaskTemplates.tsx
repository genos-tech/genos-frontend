import React, { useEffect, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import { keyframes } from "@emotion/react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import {
    Alert,
    Box,
    Button,
    IconButton,
    Input,
    Modal,
    ModalDialog,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { BnLocalBodyEditor } from "../../../../components/editors/bnLocalBodyEditor";
import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { CustomTaskTemplate } from "../../utils/taskTemplates";

const fadeIn = keyframes`
    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
`;

const base_url = import.meta.env.VITE_API_BASE_URL;

type Props = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    useTEM: TeamManagementState;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    open: boolean;
    onClose: () => void;
};

// `null` = list view. `{ id: null }` = authoring a new template.
// `{ id }` = editing that template.
type Draft = { id: number | null; name: string; initialBody: PartialBlock[] } | null;

export const ModalManageTaskTemplates: React.FC<Props> = ({
    myself,
    setMyself,
    socket,
    usePM,
    useTM,
    useTEM,
    useUISM,
    useCM,
    open,
    onClose,
}) => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const tt = t.tasks.modals.manageTemplates;

    const templates = useTM.projectTaskTemplates;
    const projectId = usePM.currentProject?.projectId;

    const [draft, setDraft] = useState<Draft>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    // Latest editor document. A ref (not state) so per-keystroke edits don't
    // re-render the modal / remount the editor.
    const bodyRef = useRef<PartialBlock[]>([]);

    // Reset transient view state whenever the modal closes.
    useEffect(() => {
        if (!open) {
            setDraft(null);
            setConfirmDeleteId(null);
            setErrorMessage(null);
        }
    }, [open]);

    const startCreate = () => {
        bodyRef.current = [];
        setDraft({ id: null, name: "", initialBody: [] });
        setConfirmDeleteId(null);
        setErrorMessage(null);
    };

    const startEdit = (tpl: CustomTaskTemplate) => {
        bodyRef.current = tpl.body;
        setDraft({ id: tpl.id, name: tpl.templateName, initialBody: tpl.body });
        setConfirmDeleteId(null);
        setErrorMessage(null);
    };

    const saveDraft = async () => {
        if (!draft || !projectId) return;
        const name = draft.name.trim();
        if (!name) {
            setErrorMessage(tt.nameEmpty);
            return;
        }
        // BlockNote's `onChange` never fires if the author only typed a
        // name and never touched the body, so `bodyRef` can still be the
        // initial `[]`. Persist a single empty paragraph instead — a
        // zero-block document makes `replaceBlocks` throw when the
        // template is later applied to the task editor.
        const body = bodyRef.current.length > 0 ? bodyRef.current : [{ type: "paragraph" }];
        setIsSaving(true);
        setErrorMessage(null);
        try {
            const isEdit = draft.id !== null;
            const response = await fetch(`${base_url}/project/task-template/`, {
                method: isEdit ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(
                    isEdit
                        ? {
                              id: draft.id,
                              project_id: projectId,
                              template_name: name,
                              body,
                          }
                        : {
                              team_id: myself.teamId,
                              project_id: projectId,
                              template_name: name,
                              body,
                          }
                ),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || tt.saveFailed);
            }
            // Signal the create form to refetch — its `projectTaskTemplates`
            // is what this modal's list reads from.
            useTM.setTemplatesDirty(true);
            setDraft(null);
        } catch (error) {
            setErrorMessage(`${error}`);
        } finally {
            setIsSaving(false);
        }
    };

    const deleteTemplate = async (id: number) => {
        if (!projectId) return;
        try {
            const response = await fetch(`${base_url}/project/task-template/`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ id, project_id: projectId }),
            });
            if (!response.ok && response.status !== 204) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || tt.deleteFailed);
            }
            useTM.setTemplatesDirty(true);
            setConfirmDeleteId(null);
        } catch (error) {
            setErrorMessage(`${error}`);
        }
    };

    return (
        <Modal
            open={open}
            sx={{
                zIndex: 10010,
                backdropFilter: "blur(4px)",
                // Transparent: Joy's own Backdrop slot already paints the
                // backdrop + blur; a second layer here reads as near-black.
                backgroundColor: "transparent",
            }}
            onClose={onClose}
        >
            <ModalDialog
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                sx={{
                    animation: `${fadeIn} 0.2s ease-out`,
                    background:
                        "linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 28, 0.98) 100%)",
                    border: "1px solid rgba(124,58,237,0.2)",
                    borderRadius: "16px",
                    boxShadow:
                        "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(124,58,237,0.1)",
                    width: { xs: "calc(100vw - 24px)", md: "auto" },
                    minWidth: { xs: 0, md: "560px" },
                    maxWidth: { xs: "100vw", md: "680px" },
                    maxHeight: { xs: "calc(100dvh - 32px)", md: "80vh" },
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
                                "linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(139, 92, 246, 0.2) 100%)",
                            border: "1px solid rgba(124,58,237,0.3)",
                        }}
                    >
                        <DescriptionRoundedIcon
                            sx={{ color: "rgba(139, 92, 246, 0.9)", fontSize: 22 }}
                        />
                    </Box>
                    <Typography
                        level="h4"
                        sx={{
                            background: "linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            fontWeight: 600,
                            flex: 1,
                        }}
                    >
                        {tt.heading}
                    </Typography>
                    <IconButton
                        size="sm"
                        variant="plain"
                        sx={{
                            color: "rgba(255,255,255,0.5)",
                            "&:hover": { color: "rgba(255,255,255,0.9)" },
                        }}
                        onClick={onClose}
                    >
                        <CloseRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Box>

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

                {draft ? (
                    // ---- Author / edit view -------------------------------
                    <Stack spacing={1.5}>
                        <Typography level="body-xs" sx={{ color: "rgba(255,255,255,0.6)" }}>
                            {tt.nameLabel}
                        </Typography>
                        <Input
                            placeholder={tt.namePlaceholder}
                            size="sm"
                            value={draft.name}
                            sx={{
                                "--Input-focusedThickness": "1px",
                                backgroundColor: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "8px",
                                color: "#e0e0e0",
                            }}
                            autoFocus
                            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        />
                        <Typography level="body-xs" sx={{ color: "rgba(255,255,255,0.6)" }}>
                            {tt.bodyLabel}
                        </Typography>
                        <Box
                            className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                            sx={{
                                backgroundColor: isDark
                                    ? "rgba(255,255,255,0.03)"
                                    : "rgba(255,255,255,0.9)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: "10px",
                                p: 1,
                                minHeight: 220,
                                maxHeight: "40vh",
                                overflowY: "auto",
                            }}
                        >
                            <BnLocalBodyEditor
                                key={draft.id === null ? "new" : `edit-${draft.id}`}
                                initialBody={draft.initialBody}
                                myself={myself}
                                setMyself={setMyself}
                                socket={socket}
                                useCM={useCM}
                                useTEM={useTEM}
                                useUISM={useUISM}
                                onChange={(blocks) => {
                                    bodyRef.current = blocks;
                                }}
                            />
                        </Box>
                        <Stack
                            direction="row"
                            spacing={1.5}
                            sx={{ justifyContent: "flex-end", mt: 0.5 }}
                        >
                            <Button
                                sx={{ color: "rgba(255,255,255,0.6)", borderRadius: "10px" }}
                                variant="plain"
                                onClick={() => setDraft(null)}
                            >
                                {tt.cancel}
                            </Button>
                            <Button
                                disabled={!draft.name.trim()}
                                loading={isSaving}
                                sx={{
                                    borderRadius: "10px",
                                    background:
                                        "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)",
                                }}
                                onClick={saveDraft}
                            >
                                {draft.id === null ? tt.create : tt.save}
                            </Button>
                        </Stack>
                    </Stack>
                ) : (
                    // ---- List view ----------------------------------------
                    <>
                        <Button
                            size="sm"
                            startDecorator={<AddRoundedIcon sx={{ fontSize: 18 }} />}
                            variant="soft"
                            sx={{
                                mb: 1.5,
                                borderRadius: "10px",
                                color: "#ddd6fe",
                                backgroundColor: "rgba(124,58,237,0.15)",
                                "&:hover": { backgroundColor: "rgba(124,58,237,0.25)" },
                            }}
                            onClick={startCreate}
                        >
                            {tt.newTemplate}
                        </Button>

                        <Stack
                            className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                            spacing={0.5}
                            sx={{ overflowY: "auto", maxHeight: "45vh", pr: 0.5 }}
                        >
                            {templates.length === 0 && (
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        color: "rgba(255,255,255,0.4)",
                                        textAlign: "center",
                                        py: 3,
                                    }}
                                >
                                    {tt.empty}
                                </Typography>
                            )}

                            {templates.map((tpl) => (
                                <Box
                                    key={tpl.id}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        p: 1,
                                        borderRadius: "10px",
                                        backgroundColor: "rgba(255,255,255,0.02)",
                                        border: "1px solid rgba(255,255,255,0.05)",
                                        "&:hover": { backgroundColor: "rgba(255,255,255,0.04)" },
                                    }}
                                >
                                    <DescriptionRoundedIcon
                                        sx={{ fontSize: 16, color: "rgba(139,92,246,0.8)" }}
                                    />
                                    <Typography
                                        level="body-sm"
                                        sx={{ flex: 1, color: "#e0e0e0", fontWeight: 500 }}
                                    >
                                        {tpl.templateName}
                                    </Typography>
                                    {confirmDeleteId === tpl.id ? (
                                        <Stack
                                            direction="row"
                                            spacing={0.5}
                                            sx={{ alignItems: "center" }}
                                        >
                                            <Typography
                                                level="body-xs"
                                                sx={{ color: "rgba(232,121,195,0.8)", mr: 0.5 }}
                                            >
                                                {tt.deletePrompt}
                                            </Typography>
                                            <Button
                                                color="danger"
                                                size="sm"
                                                sx={{ minHeight: 26, fontSize: "0.7rem" }}
                                                variant="soft"
                                                onClick={() => deleteTemplate(tpl.id)}
                                            >
                                                {tt.yes}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="plain"
                                                sx={{
                                                    minHeight: 26,
                                                    fontSize: "0.7rem",
                                                    color: "rgba(255,255,255,0.5)",
                                                }}
                                                onClick={() => setConfirmDeleteId(null)}
                                            >
                                                {tt.no}
                                            </Button>
                                        </Stack>
                                    ) : (
                                        <>
                                            <AppTooltip title={tt.editTooltip}>
                                                <IconButton
                                                    aria-label={tt.editTooltip}
                                                    size="sm"
                                                    variant="plain"
                                                    sx={{
                                                        color: "rgba(255,255,255,0.4)",
                                                        "&:hover": {
                                                            color: "rgba(124,58,237,0.9)",
                                                        },
                                                    }}
                                                    onClick={() => startEdit(tpl)}
                                                >
                                                    <EditRoundedIcon sx={{ fontSize: 16 }} />
                                                </IconButton>
                                            </AppTooltip>
                                            <AppTooltip title={tt.deleteTooltip}>
                                                <IconButton
                                                    aria-label={tt.deleteTooltip}
                                                    size="sm"
                                                    variant="plain"
                                                    sx={{
                                                        color: "rgba(255,255,255,0.4)",
                                                        "&:hover": {
                                                            color: "rgba(232,121,195,0.9)",
                                                        },
                                                    }}
                                                    onClick={() => setConfirmDeleteId(tpl.id)}
                                                >
                                                    <DeleteOutlineRoundedIcon
                                                        sx={{ fontSize: 16 }}
                                                    />
                                                </IconButton>
                                            </AppTooltip>
                                        </>
                                    )}
                                </Box>
                            ))}
                        </Stack>

                        <Stack
                            direction="row"
                            spacing={1.5}
                            sx={{ justifyContent: "flex-end", mt: 2 }}
                        >
                            <Button
                                variant="plain"
                                sx={{
                                    color: "rgba(255,255,255,0.6)",
                                    borderRadius: "10px",
                                    px: 2.5,
                                }}
                                onClick={onClose}
                            >
                                {tt.close}
                            </Button>
                        </Stack>
                    </>
                )}
            </ModalDialog>
        </Modal>
    );
};
