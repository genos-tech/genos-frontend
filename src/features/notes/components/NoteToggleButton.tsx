import { memo, ReactNode } from "react";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { ListItemButton, ListItemContent, Typography } from "@mui/joy";

import { NoteManagementState } from "../../../hooks/notes/useNoteManagement";

interface NoteToggleButtonProps {
    open: boolean;
    setOpen: (value: boolean) => void;
    noteType: number;
    node?: any;
    title?: string;
    icon?: ReactNode;
    NM: NoteManagementState;
    isOuter?: boolean;
}

export const NoteToggleButton = memo(function NoteToggleButton({
    open,
    setOpen,
    noteType,
    node,
    title,
    icon,
    NM,
    isOuter = false,
}: NoteToggleButtonProps) {
    const handleClick = () => {
        setOpen(!open);
        NM.setCurrentNoteType(noteType);
        localStorage.setItem("lastOpenNoteType", String(noteType));

        if (node && !isOuter) {
            NM.loadNote(noteType, node.noteId, -1);
        }
    };

    const isSelected = isOuter
        ? NM.currentNoteType === noteType
        : NM.currentNoteType === noteType &&
          node?.noteId ===
              (noteType === 1
                  ? NM.currentMyNote?.noteId
                  : noteType === 2
                    ? NM.currentTaskNote?.noteId
                    : noteType === 3
                      ? NM.currentChatNote?.noteId
                      : noteType === 4
                        ? 0 // TODO: This is for shared notes.
                        : 0);

    return (
        <ListItemButton
            color={isOuter ? "primary" : undefined}
            selected={isSelected}
            variant={isOuter ? "outlined" : "plain"}
            sx={isOuter ? {} : { my: "1px" }}
            onClick={handleClick}
        >
            {icon}
            <ListItemContent
                onClick={!isOuter ? handleClick : undefined}
                sx={!isOuter ? { ml: "20px" } : {}}
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
