import { useRef } from "react";
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

import { BnTaskNoteEditor } from "../../../../components/blockNote/bnTaskNoteEditor";
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
                                {tab.title.length > 14
                                    ? `${tab.title.slice(0, 14)}...`
                                    : tab.title}

                                {useNM.tabItems.length > 1 && (
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
