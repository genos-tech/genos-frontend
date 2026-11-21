import { useEffect, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import {
    Button,
    FormControl,
    FormLabel,
    IconButton,
    Input,
    Option,
    Select,
    Stack,
    Textarea,
    Typography,
} from "@mui/joy";
import { useTheme } from "@mui/joy/styles";

import { useNoteModalHostZIndex } from "../../../components/modals/noteModalHostZIndex";
import { AppTooltip } from "../../../components/ui/AppTooltip";
import { EmptyState } from "../../../components/ui/feedback/EmptyState";
import { ModalFrame } from "../../../components/ui/modal/ModalFrame";
import { useAuth } from "../../../context/AuthContext";
import { fmt, useTranslation } from "../../../i18n";
import type { UserProps } from "../../../types/admin";
import type { TeamNoteFolderProps } from "../../../types/notes";
import { markdownToNoteBlocks, noteBlocksToMarkdown } from "../common/services/noteMarkdown";
import {
    deleteTeamNoteTemplate,
    loadTeamNoteTemplate,
    saveTeamNoteTemplate,
    type TeamNoteTemplate,
} from "./teamNoteTemplates";

const NO_FOLDER = "none";

type Props = {
    open: boolean;
    myself: UserProps;
    templates: TeamNoteTemplate[];
    // Only the team's own folders can hold a default (the server refuses the rest).
    folders: TeamNoteFolderProps[];
    onClose: () => void;
    // A template or a folder default changed: reload the list and the folder rows.
    onChanged: () => void;
};

type Draft = {
    templateId?: number;
    name: string;
    title: string;
    markdown: string;
    folder: string;
};

const EMPTY: Draft = { name: "", title: "", markdown: "", folder: NO_FOLDER };

/**
 * Manage the team's note templates (MIP-1697): the list, and one form to create or edit.
 * The body is written as Markdown and stored as BlockNote blocks, the way an imported note is.
 * Anyone in the team can add one; only the creator or the team owner can change or delete it
 * (the server decides, a refusal shows as "could not save").
 */
export const ModalNoteTemplates = ({
    open,
    myself,
    templates,
    folders,
    onClose,
    onChanged,
}: Props) => {
    const { t } = useTranslation();
    const copy = t.notes.noteTemplates.team;
    const { accessToken } = useAuth();
    const hostZIndex = useNoteModalHostZIndex();
    const theme = useTheme();
    const [draft, setDraft] = useState<Draft | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setDraft(null);
            setError(null);
        }
    }, [open]);

    const ownFolders = folders.filter((f) => f.isExternal !== true);
    const folderName = (id: number | null) =>
        id == null ? null : (ownFolders.find((f) => f.folderId === id)?.name ?? null);

    const edit = async (tpl: TeamNoteTemplate) => {
        setError(null);
        setBusy(true);
        const full = await loadTeamNoteTemplate(myself, tpl.templateId, accessToken);
        setBusy(false);
        if (!full) {
            setError(copy.saveFailed);
            return;
        }
        setDraft({
            templateId: tpl.templateId,
            name: full.name,
            title: full.title,
            markdown: await noteBlocksToMarkdown(full.body ?? []),
            folder: full.defaultFolderId == null ? NO_FOLDER : String(full.defaultFolderId),
        });
    };

    const remove = async (tpl: TeamNoteTemplate) => {
        setError(null);
        if (await deleteTeamNoteTemplate(myself, tpl.templateId, accessToken)) onChanged();
        else setError(copy.deleteFailed);
    };

    const save = async () => {
        if (!draft || !draft.name.trim()) return;
        setBusy(true);
        setError(null);
        const saved = await saveTeamNoteTemplate(
            myself,
            {
                templateId: draft.templateId,
                name: draft.name.trim(),
                title: draft.title,
                body: await markdownToNoteBlocks(draft.markdown),
                defaultFolderId: draft.folder === NO_FOLDER ? null : Number(draft.folder),
            },
            accessToken
        );
        setBusy(false);
        if (!saved) {
            setError(copy.saveFailed);
            return;
        }
        setDraft(null);
        onChanged();
    };

    return (
        <ModalFrame
            description={draft ? undefined : copy.manageHint}
            hostZIndex={hostZIndex}
            open={open}
            size="md"
            zIndex={theme.zIndex.modal}
            actions={
                draft ? (
                    <>
                        <Button color="neutral" variant="plain" onClick={() => setDraft(null)}>
                            {t.notes.folders.cancel}
                        </Button>
                        <Button
                            disabled={busy || !draft.name.trim()}
                            loading={busy}
                            onClick={() => void save()}
                        >
                            {t.notes.folders.save}
                        </Button>
                    </>
                ) : (
                    <Button
                        startDecorator={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                        variant="soft"
                        onClick={() => setDraft(EMPTY)}
                    >
                        {copy.newTemplate}
                    </Button>
                )
            }
            title={
                draft
                    ? draft.templateId
                        ? copy.editTemplate
                        : copy.newTemplate
                    : copy.manageTitle
            }
            ownsListboxPopups
            onClose={onClose}
        >
            {draft ? (
                <Stack spacing={1.5}>
                    <FormControl>
                        <FormLabel>{copy.name}</FormLabel>
                        <Input
                            slotProps={{ input: { maxLength: 100 } }}
                            value={draft.name}
                            autoFocus
                            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        />
                    </FormControl>
                    <FormControl>
                        <FormLabel>{copy.noteTitle}</FormLabel>
                        <Input
                            slotProps={{ input: { maxLength: 255 } }}
                            value={draft.title}
                            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        />
                    </FormControl>
                    <FormControl>
                        <FormLabel>{copy.defaultFolder}</FormLabel>
                        <Select
                            value={draft.folder}
                            onChange={(_, v) => setDraft({ ...draft, folder: v ?? NO_FOLDER })}
                        >
                            <Option value={NO_FOLDER}>{copy.noDefault}</Option>
                            {ownFolders.map((f) => (
                                <Option key={f.folderId} value={String(f.folderId)}>
                                    {f.name}
                                </Option>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl>
                        <FormLabel>{copy.body}</FormLabel>
                        <Textarea
                            maxRows={14}
                            minRows={8}
                            value={draft.markdown}
                            onChange={(e) => setDraft({ ...draft, markdown: e.target.value })}
                        />
                    </FormControl>
                    {error && (
                        <Typography color="danger" level="body-xs">
                            {error}
                        </Typography>
                    )}
                </Stack>
            ) : (
                <Stack spacing={0.5} sx={{ maxHeight: 360, overflowY: "auto" }}>
                    {templates.length === 0 && (
                        <EmptyState body={copy.empty} data-empty="note-templates" size="xs" />
                    )}
                    {templates.map((tpl) => {
                        const inFolder = folderName(tpl.defaultFolderId);
                        return (
                            <Stack
                                key={tpl.templateId}
                                alignItems="center"
                                direction="row"
                                spacing={1}
                                sx={{ px: 0.5, py: 0.5 }}
                            >
                                <Stack sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography level="body-sm" noWrap>
                                        {tpl.name}
                                    </Typography>
                                    {inFolder && (
                                        <Typography level="body-xs" sx={{ opacity: 0.6 }} noWrap>
                                            {fmt(copy.defaultIn, { folder: inFolder })}
                                        </Typography>
                                    )}
                                </Stack>
                                <AppTooltip size="sm" title={t.notes.folders.rename}>
                                    <IconButton
                                        aria-label={t.notes.folders.rename}
                                        disabled={busy}
                                        size="sm"
                                        variant="plain"
                                        onClick={() => void edit(tpl)}
                                    >
                                        <DriveFileRenameOutlineRoundedIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </AppTooltip>
                                <AppTooltip size="sm" title={t.notes.folders.delete}>
                                    <IconButton
                                        aria-label={t.notes.folders.delete}
                                        color="danger"
                                        size="sm"
                                        variant="plain"
                                        onClick={() => void remove(tpl)}
                                    >
                                        <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </AppTooltip>
                            </Stack>
                        );
                    })}
                    {error && (
                        <Typography color="danger" level="body-xs" sx={{ mt: 1 }}>
                            {error}
                        </Typography>
                    )}
                </Stack>
            )}
        </ModalFrame>
    );
};
