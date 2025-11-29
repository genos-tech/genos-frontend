import { memo, ReactNode } from "react";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { ListItemButton, ListItemContent, Typography } from "@mui/joy";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";

interface NoteToggleButtonProps {
    open: boolean;
    setOpen: (value: boolean) => void;
    noteType: number;
    node?: any;
    title?: string;
    icon?: ReactNode;
    useNM: NoteManagementState;
    isOuter?: boolean;
}

export const NoteToggleButton = memo(function NoteToggleButton({
    open,
    setOpen,
    noteType,
    node,
    title,
    icon,
    useNM,
    isOuter = false,
}: NoteToggleButtonProps) {
    const handleClick = () => {
        setOpen(!open);
        useNM.setCurrentNoteType(noteType);
        localStorage.setItem("lastOpenNoteType", String(noteType));

        if (node && !isOuter) {
            useNM.loadNote(noteType, node.noteId, -1);
        }
    };

    const isSelected = isOuter
        ? useNM.currentNoteType === noteType
        : useNM.currentNoteType === noteType &&
          node?.noteId ===
              (noteType === 1
                  ? useNM.currentMyNote?.noteId
                  : noteType === 2
                    ? useNM.currentTaskNote?.noteId
                    : noteType === 3
                      ? useNM.currentChatNote?.noteId
                      : noteType === 4
                        ? 0 // TODO: This is for shared notes.
                        : 0);

    return (
        <ListItemButton
            color={isOuter ? "primary" : undefined}
            selected={isSelected}
            sx={isOuter ? {} : { my: "1px" }}
            variant={isOuter ? "outlined" : "plain"}
            onClick={handleClick}
        >
            {icon}
            <ListItemContent
                sx={!isOuter ? { ml: "20px" } : {}}
                onClick={!isOuter ? handleClick : undefined}
            >
                <Typography
                    level="title-sm"
                    sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {title || node?.title}
                </Typography>
            </ListItemContent>
            <KeyboardArrowDownIcon
                sx={[
                    open
                        ? {
                              transform: "rotate(180deg)",
                          }
                        : {
                              transform: "none",
                          },
                ]}
                onClick={!isOuter ? () => setOpen(!open) : undefined}
            />
        </ListItemButton>
    );
});
