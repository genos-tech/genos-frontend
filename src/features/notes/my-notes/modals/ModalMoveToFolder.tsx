import { useMemo, useState } from "react";
import DriveFileMoveRoundedIcon from "@mui/icons-material/DriveFileMoveRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import { Box, Button, List, ListItem, ListItemButton, Typography } from "@mui/joy";

import { useNoteModalHostZIndex } from "../../../../components/modals/noteModalHostZIndex";
import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { MyNoteFolderProps } from "../../../../types/notes";
import { collectDescendantFolderIds } from "../../../../utils/note";

type ModalMoveToFolderProps = {
    open: boolean;
    folders: MyNoteFolderProps[];
    // When moving a FOLDER, its own subtree is disabled as a target
    // (cycle prevention). Undefined when moving a note.
    movingFolderId?: number;
    // Current placement, rendered pre-selected.
    currentFolderId?: number | null;
    // Show the "child note detaches from its parent" hint (note moves
    // only, where the note being moved is nested under another note).
    showDetachHint?: boolean;
    onClose: () => void;
    // null = move to the My Notes root.
    onSelect: (folderId: number | null) => void;
};

type FolderRow = { folder: MyNoteFolderProps; depth: number };

// Flatten the folder tree into indented rows (name-sorted per level) —
// a flat List renders more predictably inside a modal than nested ones.
const flattenFolders = (folders: MyNoteFolderProps[]): FolderRow[] => {
    const byParent = new Map<number | null, MyNoteFolderProps[]>();
    folders.forEach((f) => {
        // Orphaned parents (race with a delete) surface at root.
        const key =
            f.parentFolderId != null && folders.some((p) => p.folderId === f.parentFolderId)
                ? f.parentFolderId
                : null;
        const list = byParent.get(key) ?? [];
        list.push(f);
        byParent.set(key, list);
    });
    byParent.forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));

    const rows: FolderRow[] = [];
    const visited = new Set<number>();
    const walk = (parentId: number | null, depth: number) => {
        for (const f of byParent.get(parentId) ?? []) {
            if (visited.has(f.folderId)) continue;
            visited.add(f.folderId);
            rows.push({ folder: f, depth });
            walk(f.folderId, depth + 1);
        }
    };
    walk(null, 0);
    return rows;
};

// Folder picker for "Move to folder…" on notes and "Move folder…" on
// folders. Root is always the first option.
export const ModalMoveToFolder = (props: ModalMoveToFolderProps) => {
    const {
        open,
        folders,
        movingFolderId,
        currentFolderId = null,
        showDetachHint = false,
        onClose,
        onSelect,
    } = props;
    const { t } = useTranslation();
    const hostZIndex = useNoteModalHostZIndex();

    const [selected, setSelected] = useState<number | null>(currentFolderId);

    const rows = useMemo(() => flattenFolders(folders), [folders]);
    const disabledIds = useMemo(
        () =>
            movingFolderId != null
                ? collectDescendantFolderIds(folders, movingFolderId)
                : new Set<number>(),
        [folders, movingFolderId]
    );

    const rowSx = (isSelected: boolean, isDisabled: boolean) => ({
        borderRadius: g.radius.md,
        gap: 1,
        py: 0.5,
        opacity: isDisabled ? 0.4 : 1,
        backgroundColor: isSelected ? g.accent.subtle : "transparent",
    });

    return (
        <ModalFrame
            hostZIndex={hostZIndex}
            icon={<DriveFileMoveRoundedIcon sx={{ color: g.accent.text }} />}
            open={open}
            size="sm"
            title={t.notes.folders.moveTitle}
            actions={
                <>
                    <Button color="neutral" variant="plain" onClick={onClose}>
                        {t.notes.folders.cancel}
                    </Button>
                    <Button
                        disabled={selected != null && disabledIds.has(selected)}
                        onClick={() => {
                            onSelect(selected);
                            onClose();
                        }}
                    >
                        {t.notes.folders.move}
                    </Button>
                </>
            }
            onClose={onClose}
        >
            {showDetachHint && (
                <Typography level="body-xs" sx={{ mb: 1, color: g.text.secondary }}>
                    {t.notes.folders.moveNoteHint}
                </Typography>
            )}

            <Box sx={{ maxHeight: "40vh", overflowY: "auto" }}>
                <List size="sm" sx={{ gap: 0.25 }}>
                    <ListItem>
                        <ListItemButton
                            sx={rowSx(selected === null, false)}
                            onClick={() => setSelected(null)}
                        >
                            <HomeRoundedIcon sx={{ fontSize: 16 }} />
                            <Typography level="body-sm">{t.notes.folders.rootLabel}</Typography>
                        </ListItemButton>
                    </ListItem>
                    {rows.map(({ folder, depth }) => {
                        const isDisabled = disabledIds.has(folder.folderId);
                        return (
                            <ListItem key={folder.folderId}>
                                <ListItemButton
                                    disabled={isDisabled}
                                    sx={{
                                        ...rowSx(selected === folder.folderId, isDisabled),
                                        paddingInlineStart: `${(1 + depth * 2) * 8}px`,
                                    }}
                                    onClick={() => setSelected(folder.folderId)}
                                >
                                    <FolderRoundedIcon sx={{ fontSize: 16 }} />
                                    <Typography level="body-sm" noWrap>
                                        {folder.name}
                                    </Typography>
                                </ListItemButton>
                            </ListItem>
                        );
                    })}
                </List>
            </Box>
        </ModalFrame>
    );
};
