import { useEffect, useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import {
    Box,
    Button,
    Chip,
    IconButton,
    Input,
    Modal,
    ModalDialog,
    Stack,
    Typography,
} from "@mui/joy";

import {
    noteModalChildStackSx,
    useNoteModalHostZIndex,
} from "../../../../components/modals/noteModalHostZIndex";
import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { useAuth } from "../../../../context/AuthContext";
import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { NoteFolderTagProps, TeamNoteFolderTreeNode } from "../../../../types/notes";
import { TagColorOption } from "../../../../types/tasks";
import { ColorPickerMenu } from "../../../tasks/components/contents/base/sub/TagColorPickerMenu";
import {
    createNoteFolderTag,
    deleteNoteFolderTag,
    loadNoteFolderTags,
    NoteFolderTagWithUsage,
    setFolderTags,
    updateNoteFolderTag,
} from "../services/teamNoteFolderTags";

const DEFAULT_COLOR = "#8e23ff";
const DEFAULT_TEXT_COLOR = "white";

type Props = {
    open: boolean;
    folder: TeamNoteFolderTreeNode | null;
    myself: UserProps;
    onClose: () => void;
    onChanged: () => void;
};

// Chip styling shared by this dialog and the sidebar folder rows.
// Mirrors `ProjectLabelChips` so folder tags and project labels read as
// one visual family — the reference this was asked to match.
export const folderTagChipSx = (
    tag: Pick<NoteFolderTagProps, "color" | "textColor">,
    size: "sm" | "md" = "sm"
) => ({
    backgroundColor: tag.color ?? DEFAULT_COLOR,
    color: tag.textColor ?? DEFAULT_TEXT_COLOR,
    borderRadius: "5px",
    fontWeight: 600,
    fontSize: size === "sm" ? "0.625rem" : "0.7rem",
    maxWidth: size === "sm" ? 84 : 200,
    flexShrink: 0,
    "--Chip-paddingInline": size === "sm" ? "6px" : "8px",
    "--Chip-minHeight": size === "sm" ? "16px" : "20px",
    "& .MuiChip-label": {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
});

/**
 * Manage the team's folder-tag vocabulary, and which of those tags apply
 * to the current folder.
 *
 * Two jobs on one row, the same split `ModalManageProjectLabels` uses:
 *   • clicking the CHIP assigns/unassigns the tag on THIS folder;
 *   • the swatch / pencil / trash edit the TEAM-WIDE tag, which every
 *     other folder carrying it sees too — so each row shows how many
 *     folders use it, making that blast radius visible before the user
 *     commits.
 *
 * The vocabulary is shown in full rather than as a free-text field, so
 * near-duplicates ("eng", "Eng", "engineering") can't accumulate and
 * quietly make filtering useless.
 */
export const ModalTeamFolderTags = (props: Props) => {
    const { open, folder, myself, onClose, onChanged } = props;
    const { t } = useTranslation();
    const { accessToken } = useAuth();
    const hostZIndex = useNoteModalHostZIndex();
    // The palette is a portaled Joy Menu; it must clear THIS dialog, and
    // the dialog itself may already be stacked above a UrlLinkModal.
    // `useNoteModalHostZIndex` is undefined on page surfaces, where the
    // picker's own 10010 default is already correct.
    const paletteZIndex = hostZIndex != null ? hostZIndex + 2 : undefined;

    const [allTags, setAllTags] = useState<NoteFolderTagWithUsage[]>([]);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [newName, setNewName] = useState("");
    const [newColor, setNewColor] = useState({
        color: DEFAULT_COLOR,
        textColor: DEFAULT_TEXT_COLOR,
    });
    const [editingTagId, setEditingTagId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reload = async () => setAllTags(await loadNoteFolderTags(myself, accessToken));

    useEffect(() => {
        if (!open || !folder) return;
        setNewName("");
        setNewColor({ color: DEFAULT_COLOR, textColor: DEFAULT_TEXT_COLOR });
        setEditingTagId(null);
        setError(null);
        setSelected(new Set(folder.tags.map((tg) => tg.tagId)));
        void reload();
    }, [open, folder?.folderId]);

    const toggle = (tagId: number) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(tagId)) next.delete(tagId);
            else next.add(tagId);
            return next;
        });

    const trimmed = newName.trim();
    const canCreate = useMemo(
        () =>
            trimmed.length > 0 &&
            trimmed.length <= 40 &&
            !allTags.some((tg) => tg.name.toLowerCase() === trimmed.toLowerCase()),
        [trimmed, allTags]
    );

    const addNew = async () => {
        if (!canCreate) return;
        const created = await createNoteFolderTag(
            myself,
            { name: trimmed, color: newColor.color, textColor: newColor.textColor },
            accessToken
        );
        if (created) {
            setAllTags((prev) => [...prev, { ...created, folderCount: 0 }]);
            setSelected((prev) => new Set(prev).add(created.tagId));
        }
        setNewName("");
    };

    // Rename and recolour share one endpoint. A swatch click persists
    // IMMEDIATELY rather than waiting for Save — colour is the thing
    // users tweak most, and a two-step commit for it feels broken.
    const patchTag = async (
        tagId: number,
        changes: { name?: string; color?: string; textColor?: string }
    ) => {
        setError(null);
        const updated = await updateNoteFolderTag(myself, tagId, changes, accessToken);
        if (!updated) {
            setError(t.notes.teamNotes.tagEditFailed);
            return;
        }
        setAllTags((prev) => prev.map((tg) => (tg.tagId === tagId ? { ...tg, ...updated } : tg)));
        onChanged();
    };

    const commitRename = async (tagId: number) => {
        const name = editName.trim();
        setEditingTagId(null);
        if (name) await patchTag(tagId, { name });
    };

    const removeTag = async (tag: NoteFolderTagWithUsage) => {
        setError(null);
        if (!(await deleteNoteFolderTag(myself, tag.tagId, accessToken))) {
            setError(t.notes.teamNotes.tagDeleteFailed);
            return;
        }
        setAllTags((prev) => prev.filter((tg) => tg.tagId !== tag.tagId));
        setSelected((prev) => {
            const next = new Set(prev);
            next.delete(tag.tagId);
            return next;
        });
        onChanged();
    };

    const submit = async () => {
        if (!folder) return;
        setSaving(true);
        await setFolderTags(myself, folder.folderId, Array.from(selected), accessToken);
        setSaving(false);
        onChanged();
        onClose();
    };

    return (
        <Modal open={open} sx={noteModalChildStackSx(hostZIndex)} onClose={onClose}>
            <ModalDialog sx={{ maxWidth: 560, minWidth: 460 }}>
                <Typography level="title-md">
                    {fmt(t.notes.teamNotes.tagsTitle, { name: folder?.name ?? "" })}
                </Typography>
                <Typography level="body-xs" sx={{ mt: 0.25, opacity: 0.7 }}>
                    {t.notes.teamNotes.tagsHint}
                </Typography>

                <Stack spacing={0.5} sx={{ maxHeight: 300, mt: 1.5, overflowY: "auto" }}>
                    {allTags.length === 0 && (
                        <Typography level="body-sm" sx={{ fontStyle: "italic", opacity: 0.7 }}>
                            {t.notes.teamNotes.noTags}
                        </Typography>
                    )}
                    {allTags.map((tag) => {
                        const isOn = selected.has(tag.tagId);
                        const isEditing = editingTagId === tag.tagId;
                        return (
                            <Stack
                                key={tag.tagId}
                                alignItems="center"
                                direction="row"
                                spacing={1}
                                sx={{ px: 0.5, py: 0.5 }}
                            >
                                {isEditing ? (
                                    <Input
                                        autoFocus
                                        size="sm"
                                        sx={{ flex: 1 }}
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") void commitRename(tag.tagId);
                                            if (e.key === "Escape") setEditingTagId(null);
                                        }}
                                    />
                                ) : (
                                    <>
                                        {/* Clicking assigns/unassigns on THIS
                                            folder. The handler sits on a
                                            wrapper, NOT on the Chip: a Joy
                                            Chip with `onClick` renders a
                                            ChipAction overlay that paints
                                            the variant's own background over
                                            the root, which swallowed the
                                            tag colour and made every chip
                                            here render grey. Keeping the
                                            Chip presentational is also what
                                            ProjectLabelChips does. */}
                                        <Box
                                            role="button"
                                            sx={{ cursor: "pointer", display: "flex" }}
                                            tabIndex={0}
                                            onClick={() => toggle(tag.tagId)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault();
                                                    toggle(tag.tagId);
                                                }
                                            }}
                                        >
                                            <Chip
                                                size="sm"
                                                variant="solid"
                                                startDecorator={
                                                    isOn ? (
                                                        <CheckRoundedIcon sx={{ fontSize: 12 }} />
                                                    ) : undefined
                                                }
                                                sx={{
                                                    ...folderTagChipSx(tag, "md"),
                                                    opacity: isOn ? 1 : 0.45,
                                                }}
                                            >
                                                {tag.name}
                                            </Chip>
                                        </Box>
                                        <Typography level="body-xs" sx={{ flex: 1, opacity: 0.6 }}>
                                            {fmt(t.notes.teamNotes.tagUsage, {
                                                count: tag.folderCount,
                                            })}
                                        </Typography>
                                    </>
                                )}

                                <ColorPickerMenu
                                    zIndex={paletteZIndex}
                                    onSelectColor={(c: TagColorOption) =>
                                        void patchTag(tag.tagId, {
                                            color: c.value,
                                            textColor: c.textColor,
                                        })
                                    }
                                />
                                <AppTooltip size="sm" title={t.notes.folders.rename}>
                                    <IconButton
                                        size="sm"
                                        variant="plain"
                                        onClick={() => {
                                            if (isEditing) void commitRename(tag.tagId);
                                            else {
                                                setEditName(tag.name);
                                                setEditingTagId(tag.tagId);
                                            }
                                        }}
                                    >
                                        <DriveFileRenameOutlineRoundedIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </AppTooltip>
                                <AppTooltip size="sm" title={t.notes.folders.delete}>
                                    <IconButton
                                        color="danger"
                                        size="sm"
                                        variant="plain"
                                        onClick={() => void removeTag(tag)}
                                    >
                                        <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </AppTooltip>
                            </Stack>
                        );
                    })}
                </Stack>

                {error && (
                    <Typography color="danger" level="body-xs" sx={{ mt: 1 }}>
                        {error}
                    </Typography>
                )}

                {/* Create row — swatch first so the colour is chosen
                    before the name, matching the label manager. */}
                <Stack alignItems="center" direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Chip size="sm" sx={folderTagChipSx(newColor, "md")} variant="solid">
                        {trimmed || t.notes.teamNotes.newTagPreview}
                    </Chip>
                    <ColorPickerMenu
                        zIndex={paletteZIndex}
                        onSelectColor={(c: TagColorOption) =>
                            setNewColor({ color: c.value, textColor: c.textColor })
                        }
                    />
                    <Input
                        placeholder={t.notes.teamNotes.newTagPlaceholder}
                        size="sm"
                        sx={{ flexGrow: 1 }}
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") void addNew();
                        }}
                    />
                    <Button
                        disabled={!canCreate}
                        size="sm"
                        startDecorator={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                        variant="soft"
                        onClick={() => void addNew()}
                    >
                        {t.notes.folders.create}
                    </Button>
                </Stack>

                <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 2 }}>
                    <Button color="neutral" variant="plain" onClick={onClose}>
                        {t.notes.folders.cancel}
                    </Button>
                    <Button disabled={saving} loading={saving} onClick={() => void submit()}>
                        {t.notes.folders.save}
                    </Button>
                </Box>
            </ModalDialog>
        </Modal>
    );
};
