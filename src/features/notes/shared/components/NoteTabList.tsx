import CloseIcon from "@mui/icons-material/Close";
import { Box, IconButton, Tab, TabList, Tooltip } from "@mui/joy";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";

interface NoteTabListProps {
    useNM: NoteManagementState;
    onCloseTab: (tabIndex: number, closingNoteId: number) => void;
}

export const NoteTabList = ({ useNM, onCloseTab }: NoteTabListProps) => {
    return (
        <TabList
            sx={{
                px: "5px",
                overflow: "auto",
                scrollSnapType: "x mandatory",
                "&::-webkit-scrollbar": { display: "none" },
            }}
        >
            {useNM.tabItems.map((tab, index) => (
                <Tooltip
                    key={`tab-tooltip-${index}`}
                    size="sm"
                    title={tab.title}
                    variant="outlined"
                >
                    <Tab
                        key={`tab-${index}`}
                        variant="soft"
                        sx={{
                            mx: "2px",
                            my: "4px",
                            flex: "none",
                            scrollSnapAlign: "start",
                            borderRadius: "5px",
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                height: "20px",
                                maxWidth: "200px",
                            }}
                        >
                            {tab.title.length > 14 ? `${tab.title.slice(0, 14)}...` : tab.title}

                            {useNM.tabItems.length > 1 && (
                                <IconButton
                                    color="neutral"
                                    component="span"
                                    size="sm"
                                    sx={{ ml: 1 }}
                                    variant="plain"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCloseTab(index, Number(tab.noteId));
                                    }}
                                >
                                    <CloseIcon />
                                </IconButton>
                            )}
                        </Box>
                    </Tab>
                </Tooltip>
            ))}
        </TabList>
    );
};
