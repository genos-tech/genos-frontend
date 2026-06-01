import { memo, ReactNode } from "react";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import StarOutlineRoundedIcon from "@mui/icons-material/StarOutlineRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import {
    Box,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemContent,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { useNoteUnread } from "../context/NoteUnreadContext";
import { BaseNoteTreeNode } from "../types/noteTypes";

interface NoteTreeRendererProps<T extends BaseNoteTreeNode> {
    node: T;
    timestamp: string;
    currentChain: T[] | undefined;
    noteType: number;
    useNM: NoteManagementState;
    createChildNoteList: (node: T) => ReactNode;
    depth?: number;
}

function NoteTreeRendererComponent<T extends BaseNoteTreeNode>({
    node,
    timestamp,
    currentChain,
    noteType,
    useNM,
    createChildNoteList,
    depth = 0,
}: NoteTreeRendererProps<T>) {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();
    const { isUnread, markRead } = useNoteUnread();
    const hasUnread = isUnread(noteType, node.noteId);

    // Open state is owned by useNoteManagement so the whole tree shares a
    // single Set instead of one useState + useEffect per row. Sticky
    // auto-expand (chain membership → open) runs once in the hook.
    const open = useNM.isNodeExpanded(noteType, node.noteId);
    const hasChildren = node.children.length > 0;

    // Check if this specific node is currently selected.
    // noteType=4 (shared personal notes) shares the editor slot with
    // myNote, so it highlights against `currentMyNote`.
    const isSelected =
        useNM.currentNoteType === noteType &&
        node?.noteId ===
            (noteType === 1
                ? useNM.currentMyNote?.noteId
                : noteType === 2
                  ? useNM.currentTaskNote?.noteId
                  : noteType === 3
                    ? useNM.currentChatNote?.noteId
                    : noteType === 4
                      ? useNM.currentMyNote?.noteId
                      : 0);

    const handleClick = () => {
        useNM.setCurrentNoteType(noteType);
        localStorage.setItem("lastOpenNoteType", String(noteType));
        useNM.loadNote(noteType, node.noteId, -1);
        // Opening a note clears its unread @mentions (chat-style read).
        if (hasUnread) markRead(noteType, node.noteId);

        // If the node has children and we're clicking it, expand it
        if (hasChildren && !open) {
            useNM.expandNode(noteType, node.noteId);
        }
    };

    const handleChevronClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        useNM.toggleNodeExpanded(noteType, node.noteId);
    };

    // Check if this note is favorited
    const isFavorited = useNM.isNoteFavorited(node.noteId, noteType);

    const handleFavoriteClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await useNM.toggleFavorite(node.noteId, noteType);
    };

    if (!currentChain) return null;

    return (
        <Box
            key={`note-box-${node.noteId}-${timestamp}`}
            sx={{
                position: "relative",
            }}
        >
            <ListItem
                key={`note-${node.noteId}-${timestamp}`}
                sx={{
                    position: "relative",
                }}
                nested
            >
                {/* Tree line connector */}
                {depth > 0 && (
                    <Box
                        sx={{
                            position: "absolute",
                            left: -10,
                            top: 0,
                            bottom: 0,
                            width: 1,
                            backgroundColor: isDark
                                ? "rgba(255,255,255,0.08)"
                                : "rgba(0,0,0,0.06)",
                        }}
                    />
                )}

                <ListItemButton
                    selected={isSelected}
                    sx={{
                        borderRadius: "8px",
                        py: 0.5,
                        px: 1,
                        my: 0.125,
                        gap: 0.75,
                        minHeight: 30,
                        transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                        "&:hover": {
                            backgroundColor: isDark
                                ? "rgba(255,255,255,0.05)"
                                : "rgba(0,0,0,0.03)",
                            "& .favorite-btn": {
                                opacity: 1,
                            },
                        },
                        "&.Mui-selected": {
                            backgroundColor: isDark
                                ? "rgba(124,58,237,0.12)"
                                : "rgba(124,58,237,0.08)",
                            "&:hover": {
                                backgroundColor: isDark
                                    ? "rgba(124,58,237,0.18)"
                                    : "rgba(124,58,237,0.12)",
                            },
                        },
                    }}
                    onClick={() => {
                        handleClick();
                    }}
                >
                    {/* Chevron / Expand button */}
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 16,
                            height: 16,
                            borderRadius: "4px",
                            flexShrink: 0,
                            opacity: hasChildren ? 1 : 0,
                            transition: "all 0.15s ease",
                            cursor: hasChildren ? "pointer" : "default",
                            "&:hover": hasChildren
                                ? {
                                      backgroundColor: isDark
                                          ? "rgba(255,255,255,0.1)"
                                          : "rgba(0,0,0,0.06)",
                                  }
                                : {},
                        }}
                        onClick={hasChildren ? handleChevronClick : undefined}
                    >
                        <ChevronRightRoundedIcon
                            sx={{
                                fontSize: 13,
                                color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.35)",
                                transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                transform: open ? "rotate(90deg)" : "rotate(0deg)",
                            }}
                        />
                    </Box>

                    {/* Note indicator dot — turns red when there's an unread
                        @mention (cleared on open). */}
                    <Box
                        sx={{
                            width: hasUnread ? 8 : 6,
                            height: hasUnread ? 8 : 6,
                            borderRadius: "50%",
                            flexShrink: 0,
                            backgroundColor: hasUnread
                                ? isDark
                                    ? "#a78bfa"
                                    : "#7c3aed"
                                : isSelected
                                  ? isDark
                                      ? "#a78bfa"
                                      : "#6d28d9"
                                  : isDark
                                    ? "rgba(255,255,255,0.2)"
                                    : "rgba(0,0,0,0.15)",
                            transition: "all 0.2s ease",
                        }}
                    />

                    <ListItemContent sx={{ minWidth: 0 }}>
                        <Typography
                            level="body-xs"
                            sx={{
                                fontWeight: hasUnread ? 700 : isSelected ? 500 : 400,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)",
                                fontSize: "0.775rem",
                                letterSpacing: "-0.01em",
                            }}
                        >
                            {node.title || t.notes.defaults.untitled}
                        </Typography>
                    </ListItemContent>

                    {/* Favorite toggle button */}
                    <IconButton
                        className="favorite-btn"
                        color="warning"
                        size="sm"
                        variant="plain"
                        sx={{
                            opacity: isFavorited ? 1 : 0,
                            minWidth: 20,
                            minHeight: 20,
                            borderRadius: "4px",
                            transition: "opacity 0.15s ease, background-color 0.15s ease",
                            "&:hover": {
                                backgroundColor: isDark
                                    ? "rgba(245,158,11,0.15)"
                                    : "rgba(245,158,11,0.1)",
                            },
                        }}
                        onClick={handleFavoriteClick}
                    >
                        {isFavorited ? (
                            <StarRoundedIcon sx={{ fontSize: 14, color: "#f59e0b" }} />
                        ) : (
                            <StarOutlineRoundedIcon
                                sx={{
                                    fontSize: 14,
                                    color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)",
                                }}
                            />
                        )}
                    </IconButton>
                </ListItemButton>

                {/* Children: rendered only when expanded so collapsed
                    subtrees pay zero render cost. Trade-off vs. the previous
                    CSS-grid trick: loses the slide animation but unmounts
                    deep subtrees entirely, which dominates at heavy scale. */}
                {open && hasChildren && (
                    <List
                        sx={{
                            pl: 2,
                            "--List-nestedInsetStart": "16px",
                        }}
                    >
                        {node.children.map((child) => (
                            <NoteTreeRenderer
                                key={child.noteId}
                                createChildNoteList={createChildNoteList}
                                currentChain={currentChain}
                                depth={depth + 1}
                                node={child as T}
                                noteType={noteType}
                                timestamp={timestamp}
                                useNM={useNM}
                            />
                        ))}
                    </List>
                )}
            </ListItem>
        </Box>
    );
}

export const NoteTreeRenderer = memo(NoteTreeRendererComponent) as <T extends BaseNoteTreeNode>(
    props: NoteTreeRendererProps<T>
) => React.JSX.Element;
