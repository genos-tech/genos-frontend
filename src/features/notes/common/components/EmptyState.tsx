import AddIcon from "@mui/icons-material/Add";
import { Box, IconButton } from "@mui/joy";

import { useTranslation } from "../../../../i18n";

interface EmptyStateProps {
    onCreateNewNote: () => void;
}

export const EmptyState = ({ onCreateNewNote }: EmptyStateProps) => {
    const { t } = useTranslation();
    return (
        <Box
            sx={{
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
            }}
        >
            <IconButton
                color="neutral"
                component="button"
                variant="soft"
                sx={{
                    fontSize: "15px",
                    paddingRight: "10px",
                }}
                onClick={onCreateNewNote}
            >
                <AddIcon />
                {t.notes.header.newNote}
            </IconButton>
        </Box>
    );
};
