import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import { ListItem, ListItemButton, ListItemContent, Typography } from "@mui/joy";

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
    isDark,
}: {
    folder: FavoriteFolderMeta;
    spaceLabel: string;
    useNM: NoteManagementState;
    isDark: boolean;
}) => (
    <ListItem>
        <ListItemButton
            data-testid={`favorite-folder-${folder.folderId}`}
            sx={{
                borderRadius: "8px",
                py: 0.5,
                px: 1,
                gap: 0.75,
                minHeight: 32,
                "@media (hover: hover) and (pointer: fine)": {
                    "&:hover": {
                        backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                        "& .folder-menu-btn": { opacity: 1 },
                    },
                },
            }}
            onClick={() =>
                useNM.revealFolder(folder.folderId, folder.scope === "team" ? "team" : "my")
            }
        >
            <FolderRoundedIcon
                sx={{
                    fontSize: 14,
                    color: isDark ? "var(--gp-brandalt-400)" : "var(--gp-brand-700)",
                    flexShrink: 0,
                }}
            />
            <ListItemContent sx={{ minWidth: 0 }}>
                <Typography
                    level="body-xs"
                    sx={{
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.65)",
                    }}
                >
                    {folder.name}
                </Typography>
                <Typography
                    level="body-xs"
                    sx={{
                        fontSize: "0.65rem",
                        color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
                    }}
                >
                    {spaceLabel}
                </Typography>
            </ListItemContent>
            <FolderFavoriteStar folderId={folder.folderId} isDark={isDark} useNM={useNM} />
        </ListItemButton>
    </ListItem>
);
