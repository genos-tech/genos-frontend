import { useRef } from "react";
import { PartialBlock } from "@blocknote/core";
import CheckIcon from "@mui/icons-material/Check";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import {
    Box,
    Button,
    FormControl,
    IconButton,
    Input,
    Tab,
    TabList,
    TabPanel,
    Tabs,
    Tooltip,
    Typography,
    useColorScheme,
} from "@mui/joy";

import { BnTaskNoteEditor } from "../../../../components/editors/bnTaskNoteEditor";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";

interface NoteTabsProps {
    useNM: NoteManagementState;
    body: PartialBlock[] | undefined;
    noteBodySaved: boolean;
    tsBody: string;
    myself: any;
    setBody: (body: PartialBlock[]) => void;
    useCM: ChatManagementState;
    setMyself: (me: any) => void;
    setNoteBodyEdited: (edited: boolean) => void;
    setNoteBodySaved: (saved: boolean) => void;
    useUISM: UIStateManagementState;
    socket: any;
    useTEM: TeamManagementState;
    onCloseTab: (tabIndex: number, closingNoteId: number) => void;
    onTitleChange: (title: string) => void;
    onTitleBlur: () => void;
    currentTaskNoteTitle: string;
}

export const NoteTabs = ({
    useNM,
    body,
    noteBodySaved,
    tsBody,
    myself,
    setBody,
    useCM,
    setMyself,
    setNoteBodyEdited,
    setNoteBodySaved,
    useUISM,
    socket,
    useTEM,
    onCloseTab,
    onTitleChange,
    onTitleBlur,
    currentTaskNoteTitle,
}: NoteTabsProps) => {
    const titleInputRef = useRef<HTMLInputElement | null>(null);
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    return (
        <Tabs
            sx={{ width: "100%" }}
            value={useNM.selectedTabIndex}
            onChange={(_, val) => {
                useNM.loadNote(
                    useNM.tabItems[Number(val)].noteType,
                    useNM.tabItems[Number(val)].noteId,
                    Number(val)
                );
            }}
        >
            <TabList
                sx={{
                    px: 1,
                    py: 0.5,
                    gap: 0.5,
                    overflow: "auto",
                    scrollSnapType: "x mandatory",
                    background: isDark
                        ? "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, transparent 100%)"
                        : "linear-gradient(180deg, rgba(0,0,0,0.02) 0%, transparent 100%)",
                    borderBottom: isDark
                        ? "1px solid rgba(255,255,255,0.06)"
                        : "1px solid rgba(0,0,0,0.06)",
                    "&::-webkit-scrollbar": { display: "none" },
                    "--ListItem-radius": "8px",
                }}
            >
                {useNM.tabItems.map((tab, index) => (
                    <Tooltip
                        key={`tab-tooltip-${index}`}
                        arrow
                        placement="bottom"
                        size="sm"
                        title={tab.title}
                        variant="soft"
                        sx={{
                            maxWidth: 280,
                            "& .MuiTooltip-arrow": {
                                color: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                            },
                        }}
                    >
                        <Tab
                            key={`tab-${index}`}
                            sx={{
                                flex: "none",
                                scrollSnapAlign: "start",
                                px: 1.5,
                                py: 0.75,
                                minHeight: 36,
                                borderRadius: "8px",
                                fontSize: "0.8125rem",
                                fontWeight: 500,
                                letterSpacing: "-0.01em",
                                transition: "all 0.15s ease-in-out",
                                border: "1px solid transparent",
                                background: "transparent",
                                color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
                                "&:hover": {
                                    background: isDark
                                        ? "rgba(255,255,255,0.06)"
                                        : "rgba(0,0,0,0.04)",
                                    color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.8)",
                                    "& .close-btn": {
                                        opacity: 1,
                                    },
                                },
                                "&.Mui-selected": {
                                    background: isDark
                                        ? "linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(245,158,11,0.08) 100%)"
                                        : "linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(245,158,11,0.06) 100%)",
                                    border: isDark
                                        ? "1px solid rgba(251,191,36,0.2)"
                                        : "1px solid rgba(251,191,36,0.15)",
                                    color: isDark ? "#fcd34d" : "#d97706",
                                    boxShadow: isDark
                                        ? "0 2px 8px rgba(0,0,0,0.3)"
                                        : "0 2px 8px rgba(251,191,36,0.15)",
                                    "& .tab-icon": {
                                        color: isDark ? "#fcd34d" : "#f59e0b",
                                    },
                                    "& .close-btn": {
                                        opacity: 1,
                                    },
                                },
                            }}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    maxWidth: 180,
                                }}
                            >
                                <DescriptionOutlinedIcon
                                    className="tab-icon"
                                    sx={{
                                        fontSize: 16,
                                        color: isDark
                                            ? "rgba(255,255,255,0.4)"
                                            : "rgba(0,0,0,0.4)",
                                        transition: "color 0.15s ease-in-out",
                                        flexShrink: 0,
                                    }}
                                />
                                <Typography
                                    level="body-sm"
                                    noWrap
                                    sx={{
                                        fontSize: "inherit",
                                        fontWeight: "inherit",
                                        color: "inherit",
                                        maxWidth: 120,
                                    }}
                                >
                                    {tab.title}
                                </Typography>

                                {useNM.tabItems.length > 1 && (
                                    <IconButton
                                        className="close-btn"
                                        color="neutral"
                                        component="span"
                                        size="sm"
                                        variant="plain"
                                        sx={{
                                            "--IconButton-size": "20px",
                                            minWidth: 20,
                                            minHeight: 20,
                                            ml: 0.5,
                                            opacity: 0,
                                            transition: "all 0.15s ease-in-out",
                                            borderRadius: "6px",
                                            "&:hover": {
                                                background: isDark
                                                    ? "rgba(255,255,255,0.1)"
                                                    : "rgba(0,0,0,0.08)",
                                            },
                                        }}
                                        onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            onCloseTab(index, Number(tab.noteId));
                                        }}
                                    >
                                        <CloseRoundedIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                )}
                            </Box>
                        </Tab>
                    </Tooltip>
                ))}
            </TabList>

            {useNM.tabItems.map((tabNote, index) => (
                <TabPanel
                    key={`tab-note-body-${tabNote.noteType}-${tabNote.noteId}-${tsBody}`}
                    value={index}
                    sx={{
                        paddingX: "5px",
                        paddingTop: "0px",
                        paddingBottom: "5px",
                    }}
                >
                    <FormControl
                        sx={{
                            mt: "10px",
                            ml: "10px",
                            justifyContent: "center",
                            position: "absolute",
                            zIndex: 100,
                        }}
                        required
                    >
                        <Input
                            key={"currentTaskNoteTitle"}
                            placeholder="Note Title"
                            startDecorator={<NoteAltIcon />}
                            value={currentTaskNoteTitle}
                            variant="soft"
                            slotProps={{
                                input: {
                                    ref: titleInputRef,
                                    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            titleInputRef.current?.blur();
                                        }
                                    },
                                },
                            }}
                            sx={{
                                fontSize: "22px",
                                fontWeight: "bold",
                            }}
                            onBlur={onTitleBlur}
                            onChange={(e) => onTitleChange(e.target.value)}
                        />
                    </FormControl>
                    {noteBodySaved && (
                        <Box
                            sx={{
                                position: "absolute",
                                mt: "12px",
                                ml: "335px",
                                zIndex: 100,
                            }}
                        >
                            <Button
                                color="neutral"
                                size="sm"
                                variant="outlined"
                                startDecorator={
                                    <CheckIcon
                                        sx={{
                                            fontSize: "15px",
                                        }}
                                    />
                                }
                            >
                                Saved
                            </Button>
                        </Box>
                    )}
                    {useNM.currentTaskNote && (
                        <BnTaskNoteEditor
                            body={body || []}
                            useCM={useCM}
                            currentTaskNote={useNM.currentTaskNote}
                            myself={myself}
                            setBody={setBody}
                            setMyself={setMyself}
                            setNoteBodyEdited={setNoteBodyEdited}
                            setNoteBodySaved={setNoteBodySaved}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    )}
                </TabPanel>
            ))}
        </Tabs>
    );
};
