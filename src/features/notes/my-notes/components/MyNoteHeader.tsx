import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import { Breadcrumbs, IconButton, Tooltip, Typography } from "@mui/joy";

interface MyNoteHeaderProps {
    currentMyNoteChain: any[] | null;
    onLoadNote: (noteType: number, noteId: number, tabIndex: number) => void;
}

export const MyNoteHeader = ({ currentMyNoteChain, onLoadNote }: MyNoteHeaderProps) => {
    return (
        <Breadcrumbs aria-label="breadcrumbs" separator="›">
            <IconButton
                color="primary"
                component="button"
                variant="soft"
                sx={{
                    fontSize: "14px",
                }}
            >
                <AssignmentRoundedIcon sx={{ fontSize: "20px" }} />
                My Notes
            </IconButton>

            {currentMyNoteChain &&
                currentMyNoteChain.map((node, index) => (
                    <Tooltip
                        key={`my-note-tooltip-${index}`}
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
                                onLoadNote(1, node.noteId, -1);
                            }}
                        >
                            {node.title.length > 14 ? `${node.title.slice(0, 14)}...` : node.title}
                        </Typography>
                    </Tooltip>
                ))}
        </Breadcrumbs>
    );
};
