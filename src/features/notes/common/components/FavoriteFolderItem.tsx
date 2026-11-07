import FolderRoundedIcon from "@mui/icons-material/FolderRounded";

import { NavItem } from "../../../../components/ui/nav/NavItem";
import { NAV_KEEP_CLASS } from "../../../../components/ui/nav/navStyles";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { FavoriteFolderMeta } from "../../favorite-notes/services";
import { FolderFavoriteStar } from "./FolderFavoriteStar";

// A starred folder in Favorites (MIP-747). Clicking jumps to it in its
// own tree: My Notes, or Team Notes for a team folder (a folder shared
// from another team is listed there too).
export const FavoriteFolderItem = ({
    folder,
    spaceLabel,
    useNM,
}: {
    folder: FavoriteFolderMeta;
    spaceLabel: string;
    useNM: NoteManagementState;
}) => (
    <NavItem
        as="div"
        data-testid={`favorite-folder-${folder.folderId}`}
        icon={<FolderRoundedIcon />}
        label={folder.name}
        lines={2}
        secondary={spaceLabel}
        // The star is the row's whole point here: it is always shown.
        actions={
            <span className={NAV_KEEP_CLASS}>
                <FolderFavoriteStar folderId={folder.folderId} useNM={useNM} />
            </span>
        }
        onClick={() =>
            useNM.revealFolder(folder.folderId, folder.scope === "team" ? "team" : "my")
        }
    />
);
