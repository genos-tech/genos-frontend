import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import { Breadcrumbs, IconButton, Stack, Typography } from "@mui/joy";

import { TaskNoteProps } from "../../../types/notes";

interface NoteHeaderProps {
    currentTaskNoteChain: any[] | null;
    onLoadNote: (noteType: number, noteId: number, tabIndex: number) => void;
}

export const NoteHeader = ({ currentTaskNoteChain, onLoadNote }: NoteHeaderProps) => {
    return (
        <Breadcrumbs aria-label="breadcrumbs" separator="›">
            <IconButton
                color="success"
                component="button"
                variant="soft"
                sx={{
                    fontSize: "14px",
                }}
            >
                <AssignmentRoundedIcon sx={{ fontSize: "20px" }} />
                Task Notes
            </IconButton>
            {currentTaskNoteChain &&
                currentTaskNoteChain.map((node) => (
                    <Typography
                        key={node.noteId}
                        component="button"
                        level="title-sm"
                        sx={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            color: "#646CFF",
                            textAlign: "left",
                            fontWeight: "bold",
                        }}
                        onClick={() => {
                            onLoadNote(2, node.noteId, -1);
                        }}
                    >
                        {node.title.length > 14 ? `${node.title.slice(0, 14)}...` : node.title}
                    </Typography>
                ))}
        </Breadcrumbs>
    );
};
