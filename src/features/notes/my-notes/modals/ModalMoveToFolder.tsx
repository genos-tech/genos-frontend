import { useMemo, useState } from "react";
import DriveFileMoveRoundedIcon from "@mui/icons-material/DriveFileMoveRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import {
    Box,
    Button,
    List,
    ListItem,
    ListItemButton,
    Modal,
    ModalDialog,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import {
    noteModalChildStackSx,
    useNoteModalHostZIndex,
} from "../../../../components/modals/noteModalHostZIndex";
import { useTranslation } from "../../../../i18n";
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
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
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
        borderRadius: "8px",
        gap: 1,
        py: 0.5,
        opacity: isDisabled ? 0.4 : 1,
        backgroundColor: isSelected
            ? isDark
                ? "rgba(124,58,237,0.2)"
                : "rgba(124,58,237,0.1)"
            : "transparent",
    });

    return (
        <Modal
            open={open}
            sx={{
                zIndex: 10010,
                backdropFilter: "blur(4px)",
                ...noteModalChildStackSx(hostZIndex),
            }}
            onClose={onClose}
        >
            <ModalDialog
                sx={{
                    borderRadius: "16px",
                    width: { xs: "calc(100vw - 24px)", md: "400px" },
                    p: { xs: 2, md: 3 },
                }}
            >
                <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1 }}>
                    <DriveFileMoveRoundedIcon
                        sx={{ fontSize: 20, color: isDark ? "#a78bfa" : "#7c3aed" }}
                    />
                    <Typography level="title-lg">{t.notes.folders.moveTitle}</Typography>
                </Stack>

                {showDetachHint && (
                    <Typography level="body-xs" sx={{ mb: 1, opacity: 0.7 }}>
                        {t.notes.folders.moveNoteHint}
                    </Typography>
                )}

                <Box
                    className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                    sx={{ maxHeight: "40vh", overflowY: "auto" }}
                >
                    <List size="sm" sx={{ gap: 0.25 }}>
                        <ListItem>
                            <ListItemButton
                                sx={rowSx(selected === null, false)}
                                onClick={() => setSelected(null)}
                            >
                                <HomeRoundedIcon sx={{ fontSize: 16 }} />
                                <Typography level="body-sm">
                                    {t.notes.folders.rootLabel}
                                </Typography>
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
                                            pl: 1 + depth * 2,
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

                <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
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
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
