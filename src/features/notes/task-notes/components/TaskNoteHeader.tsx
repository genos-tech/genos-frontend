import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import { Breadcrumbs, IconButton, Tooltip, Typography } from "@mui/joy";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";

interface TaskNoteHeaderProps {
    NM: NoteManagementState;
}

export const TaskNoteHeader = ({ NM }: TaskNoteHeaderProps) => {
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

            {NM.currentTaskNoteChain &&
                NM.currentTaskNoteChain.map((node, index) => (
                    <Tooltip
                        key={`task-note-tooltip-${index}`}
                        size="sm"
                        title={node.title}
                        variant="outlined"
                    >
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
                                NM.loadNote(2, node.noteId, -1);
                            }}
                        >
                            {node.title.length > 14 ? `${node.title.slice(0, 14)}...` : node.title}
                        </Typography>
                    </Tooltip>
                ))}
        </Breadcrumbs>
    );
};
