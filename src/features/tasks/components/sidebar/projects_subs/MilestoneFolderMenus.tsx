import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import {
    Dropdown,
    IconButton,
    ListDivider,
    Menu,
    MenuButton,
    MenuItem,
    Typography,
} from "@mui/joy";

import { useTranslation } from "../../../../../i18n";
import { MilestoneFolder } from "../../../sprint-milestone/types";

// The "..." menus of the milestone sidebar (MIP-847). Both stop the click
// from reaching the row underneath, which would open the milestone or toggle
// the folder.

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

type MilestoneRowMenuProps = {
    milestoneTitle: string;
    currentFolderId: number | null;
    folders: MilestoneFolder[];
    onMoveToFolder: (folderId: number | null) => void;
};

/** "Move to folder" for one milestone. This menu is also the only way to
 *  file a milestone on a phone, where there is no drag. */
export const MilestoneRowMenu = ({
    milestoneTitle,
    currentFolderId,
    folders,
    onMoveToFolder,
}: MilestoneRowMenuProps) => {
    const { t } = useTranslation();
    return (
        <Dropdown>
            <MenuButton
                aria-label={`${t.tasks.folders.moveActions}: ${milestoneTitle}`}
                size="sm"
                slotProps={{ root: { variant: "plain", color: "neutral", size: "sm" } }}
                slots={{ root: IconButton }}
                onClick={stop}
            >
                <MoreHorizRoundedIcon sx={{ fontSize: 16 }} />
            </MenuButton>
            <Menu
                placement="bottom-end"
                size="sm"
                sx={{ zIndex: 10010, minWidth: 180 }}
                onClick={stop}
            >
                <Typography level="body-xs" sx={{ opacity: 0.6, px: 1.5, py: 0.5 }}>
                    {t.tasks.folders.moveToFolder}
                </Typography>
                <MenuItem disabled={currentFolderId == null} onClick={() => onMoveToFolder(null)}>
                    {currentFolderId == null && <CheckRoundedIcon sx={{ fontSize: 16 }} />}
                    {t.tasks.folders.noFolder}
                </MenuItem>
                {folders.map((f) => (
                    <MenuItem
                        key={f.folderId}
                        disabled={f.folderId === currentFolderId}
                        onClick={() => onMoveToFolder(f.folderId)}
                    >
                        {f.folderId === currentFolderId && (
                            <CheckRoundedIcon sx={{ fontSize: 16 }} />
                        )}
                        {f.name}
                    </MenuItem>
                ))}
            </Menu>
        </Dropdown>
    );
};

type FolderMenuProps = {
    folderName: string;
    onRename: () => void;
    onDelete: () => void;
};

/** Rename / delete one folder. Any project member may. */
export const FolderMenu = ({ folderName, onRename, onDelete }: FolderMenuProps) => {
    const { t } = useTranslation();
    return (
        <Dropdown>
            <MenuButton
                aria-label={`${t.tasks.folders.folderActions}: ${folderName}`}
                size="sm"
                slotProps={{ root: { variant: "plain", color: "neutral", size: "sm" } }}
                slots={{ root: IconButton }}
                onClick={stop}
            >
                <MoreHorizRoundedIcon sx={{ fontSize: 16 }} />
            </MenuButton>
            <Menu placement="bottom-end" size="sm" sx={{ zIndex: 10010 }} onClick={stop}>
                <MenuItem onClick={onRename}>{t.tasks.folders.renameFolder}</MenuItem>
                <ListDivider />
                <MenuItem color="danger" onClick={onDelete}>
                    {t.tasks.folders.deleteFolder}
                </MenuItem>
            </Menu>
        </Dropdown>
    );
};
