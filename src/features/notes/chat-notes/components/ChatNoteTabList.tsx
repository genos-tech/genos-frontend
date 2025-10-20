import CloseIcon from "@mui/icons-material/Close";
import { Box, IconButton, Tab, TabList, Tooltip } from "@mui/joy";

import { ChatNoteProps } from "../../../../types/notes";

interface ChatNoteTabListProps {
    tabItems: ChatNoteProps[];
    selectedTabIndex: number;
    onTabChange: (newValue: number) => void;
    onCloseTab: (tabIndex: number, closingNoteId: number) => Promise<void>;
}

export const ChatNoteTabList = ({
    tabItems,
    selectedTabIndex,
    onTabChange,
    onCloseTab,
}: ChatNoteTabListProps) => {
    return (
        <TabList
            sx={{
                px: "5px",
                overflow: "auto",
                scrollSnapType: "x mandatory",
                "&::-webkit-scrollbar": { display: "none" },
            }}
        >
            {tabItems.map((tab, index) => (
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

                            {tabItems.length > 1 && (
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
