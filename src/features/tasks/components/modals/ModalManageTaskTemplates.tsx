import React, { useEffect, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import { Alert, Box, Button, IconButton, Input, Stack, Typography } from "@mui/joy";
import { useTheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { BnLocalBodyEditor } from "../../../../components/editors/bnLocalBodyEditor";
import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { CustomTaskTemplate } from "../../utils/taskTemplates";

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
    const theme = useTheme();
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
        <ModalFrame
            icon={<DescriptionRoundedIcon sx={{ color: g.accent.text }} />}
            open={open}
            // The author / edit view carries the body editor, so it wants
            // more room than the plain list.
            size={draft ? "xl" : "lg"}
            title={tt.heading}
            // Deliberately NOT the 10010 the tag modals use: this modal
            // hosts a BlockNote editor, and BlockNote's floating menus
            // (slash / formatting / link) are lifted to z-index 1400 by a
            // global App.css override tuned for the 1300-family Joy modals.
            // Sitting at Joy's modal layer keeps those menus above the
            // dialog instead of trapped behind it (same reason ModalTaskView /
            // ModalNoteView host their editors at the default layer).
            zIndex={theme.zIndex.modal}
            actions={
                draft ? (
                    <>
                        <Button color="neutral" variant="plain" onClick={() => setDraft(null)}>
                            {tt.cancel}
                        </Button>
                        <Button
                            disabled={!draft.name.trim()}
                            loading={isSaving}
                            onClick={saveDraft}
                        >
                            {draft.id === null ? tt.create : tt.save}
                        </Button>
                    </>
                ) : (
                    <Button color="neutral" variant="plain" onClick={onClose}>
                        {tt.close}
                    </Button>
                )
            }
            onClose={onClose}
        >
            {errorMessage && (
                <Alert color="danger" sx={{ mb: 2 }}>
                    {errorMessage}
                </Alert>
            )}

            {draft ? (
                // ---- Author / edit view -------------------------------
                <Stack spacing={1.5}>
                    <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                        {tt.nameLabel}
                    </Typography>
                    <Input
                        placeholder={tt.namePlaceholder}
                        size="sm"
                        value={draft.name}
                        sx={{
                            backgroundColor: g.bg.subtle,
                            border: `1px solid ${g.border.default}`,
                            borderRadius: g.radius.md,
                            color: g.text.primary,
                        }}
                        autoFocus
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    />
                    <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                        {tt.bodyLabel}
                    </Typography>
                    {/* The editor renders its own `bn-task-body-box`
                            container (same surface as the task body), so this
                            wrapper is just a rounded frame — no background of
                            its own, or it'd show through as the grey gutter the
                            old version had. */}
                    <Box
                        sx={{
                            border: `1px solid ${g.border.default}`,
                            borderRadius: g.radius.md,
                            overflow: "hidden",
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
                </Stack>
            ) : (
                // ---- List view ----------------------------------------
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                    <Button
                        size="sm"
                        startDecorator={<AddRoundedIcon sx={{ fontSize: 18 }} />}
                        variant="soft"
                        sx={{
                            mb: 1.5,
                            borderRadius: g.radius.md,
                            color: g.accent.text,
                            backgroundColor: g.accent.subtle,
                            "&:hover": { backgroundColor: g.accent.subtle },
                        }}
                        onClick={startCreate}
                    >
                        {tt.newTemplate}
                    </Button>

                    <Stack spacing={0.5} sx={{ overflowY: "auto", maxHeight: "45vh", pr: 0.5 }}>
                        {templates.length === 0 && (
                            <Typography
                                level="body-sm"
                                sx={{ color: g.text.tertiary, textAlign: "center", py: 3 }}
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
                                    borderRadius: g.radius.md,
                                    backgroundColor: g.bg.subtle,
                                    border: `1px solid ${g.border.subtle}`,
                                    "&:hover": { backgroundColor: g.hover },
                                }}
                            >
                                <DescriptionRoundedIcon
                                    sx={{ fontSize: 16, color: g.accent.text }}
                                />
                                <Typography
                                    level="body-sm"
                                    sx={{ flex: 1, color: g.text.primary, fontWeight: 500 }}
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
                                            sx={{ color: g.danger.text, mr: 0.5 }}
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
                                                color: g.text.secondary,
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
                                                    color: g.text.tertiary,
                                                    "&:hover": { color: g.accent.text },
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
                                                    color: g.text.tertiary,
                                                    "&:hover": { color: g.danger.text },
                                                }}
                                                onClick={() => setConfirmDeleteId(tpl.id)}
                                            >
                                                <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                                            </IconButton>
                                        </AppTooltip>
                                    </>
                                )}
                            </Box>
                        ))}
                    </Stack>
                </Box>
            )}
        </ModalFrame>
    );
};
