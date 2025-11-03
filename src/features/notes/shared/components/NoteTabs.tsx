import { PartialBlock } from "@blocknote/core";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
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
} from "@mui/joy";
import { useRef } from "react";

import { BnTaskNoteEditor } from "../../../../components/blockNote/bnTaskNoteEditor";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskNoteProps } from "../../../../types/notes";

interface NoteTabsProps {
    tabItems: TaskNoteProps[];
    selectedTabIndex: number;
    currentTaskNote: TaskNoteProps | null;
    currentTaskNoteTitle: string;
    body: PartialBlock[] | undefined;
    noteBodySaved: boolean;
    tsBody: string;
    myself: any;
    setBody: (body: PartialBlock[]) => void;
    CM: ChatManagementState;
    setMyself: (me: any) => void;
    setNoteBodyEdited: (edited: boolean) => void;
    setNoteBodySaved: (saved: boolean) => void;
    UIM: UIStateManagementState;
    socket: any;
    TEM: TeamManagementState;
    onLoadNote: (noteType: number, noteId: number, tabIndex: number) => void;
    onCloseTab: (tabIndex: number, closingNoteId: number) => void;
    onTitleChange: (title: string) => void;
    onTitleBlur: () => void;
}

export const NoteTabs = ({
    tabItems,
    selectedTabIndex,
    currentTaskNote,
    currentTaskNoteTitle,
    body,
    noteBodySaved,
    tsBody,
    myself,
    setBody,
    CM,
    setMyself,
    setNoteBodyEdited,
    setNoteBodySaved,
    UIM,
    socket,
    TEM,
    onLoadNote,
    onCloseTab,
    onTitleChange,
    onTitleBlur,
}: NoteTabsProps) => {
    const titleInputRef = useRef<HTMLInputElement | null>(null);

    return (
        <Tabs
            sx={{ width: "100%" }}
            value={selectedTabIndex}
            onChange={(_, val) => {
                onLoadNote(
                    tabItems[Number(val)].noteType,
                    tabItems[Number(val)].noteId,
                    Number(val)
                );
            }}
        >
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
                                {tab.title.length > 14
                                    ? `${tab.title.slice(0, 14)}...`
                                    : tab.title}

                                {tabItems.length > 1 && (
                                    <IconButton
                                        color="neutral"
                                        component="span"
                                        size="sm"
                                        sx={{ ml: 1 }}
                                        variant="plain"
                                        onClick={(e: React.MouseEvent) => {
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

            {tabItems.map((tabNote, index) => (
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
                    {currentTaskNote && (
                        <BnTaskNoteEditor
                            body={body || []}
                            CM={CM}
                            currentTaskNote={currentTaskNote}
                            myself={myself}
                            setBody={setBody}
                            setMyself={setMyself}
                            setNoteBodyEdited={setNoteBodyEdited}
                            setNoteBodySaved={setNoteBodySaved}
                            socket={socket}
                            TEM={TEM}
                            UIM={UIM}
                        />
                    )}
                </TabPanel>
            ))}
        </Tabs>
    );
};
