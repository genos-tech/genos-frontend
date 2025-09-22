import { Socket } from "socket.io-client";
import { useState, useEffect, useRef } from "react";
import {
    Box,
    Stack,
    Typography,
    IconButton,
    Button,
    FormControl,
    Input,
    Menu,
    MenuItem,
    Breadcrumbs,
    Tabs,
    TabList,
    TabPanel,
    Tab,
    Dropdown,
    MenuButton,
} from "@mui/joy";
import { PartialBlock } from "@blocknote/core";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVert from "@mui/icons-material/MoreVert";
import CheckIcon from "@mui/icons-material/Check";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";

import { UserProps } from "../../../types/admin";
import { ChatProps } from "../../../types/chat";
import { BnChatNoteEditor } from "../../../components/blockNote/bnChatNoteEditor";
import { NoteMetaProps, ChatNoteProps, ChatNoteMetaTreeNode } from "../../../types/notes";
import { sendUpdatedChatNote } from "../services/sendUpdatedChatNote";
import { useAuth } from "../../../context/AuthContext";
import { getCurrentTimestamp } from "../../../utils/dateUtils";
import { addNote } from "../services/addNote";
import { ModalDeleteChatNote } from "../modals/ModalDeleteChatNote";
import { getData } from "../../../db/crud";
import { STORES } from "../../../db/conf";
import { loadSpecificNote } from "../services/loadSpecificNote";

type ChatNoteMainProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    teamMembers: UserProps[];
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    currentNoteType: number;
    currentChatNote: ChatNoteProps | null;
    setCurrentChatNote: (value: ChatNoteProps) => void;
    currentChatNoteTitle: string;
    setCurrentChatNoteTitle: (value: string) => void;
    setOpeningService: (service: number) => void;
    setCurrentChat: (chat: ChatProps) => void;
    chatNoteMeta: NoteMetaProps[];
    setChatNoteMeta: (value: NoteMetaProps[]) => void;
    tabNotes: any[];
    setTabNotes: (value: any[]) => void;
    selectedTabIndex: number;
    setSelectedTabIndex: (value: number) => void;
    handleCreateNewChatNote: (
        parentNoteId: number | null,
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number
    ) => Promise<void>;
    currentChatNoteChain?: ChatNoteMetaTreeNode[];
    isInChatPage: boolean;
};

export const ChatNoteMain = (props: ChatNoteMainProps) => {
    const {
        teamMemberProfiles,
        socket,
        teamMembers,
        myself,
        setMyself,
        currentChatNote,
        setCurrentChatNote,
        currentChatNoteTitle,
        setCurrentChatNoteTitle,
        setOpeningService,
        setCurrentChat,
        currentNoteType,
        chatNoteMeta,
        setChatNoteMeta,
        tabNotes,
        setTabNotes,
        selectedTabIndex,
        setSelectedTabIndex,
        handleCreateNewChatNote,
        currentChatNoteChain,
        isInChatPage,
    } = props;

    const { accessToken } = useAuth();

    const breadcrumbsRef = useRef<HTMLDivElement>(null);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (breadcrumbsRef.current && !breadcrumbsRef.current.contains(event.target as Node)) {
                handleClose();
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const [noteUpdated, setNoteUpdated] = useState(false);
    const [startIntervalUpdatingNote, setStartIntervalUpdatingNote] = useState(false);
    const [noteBodyEdited, setNoteBodyEdited] = useState(false);
    const [noteBodySaved, setNoteBodySaved] = useState(false);
    const [body, setBody] = useState<PartialBlock[]>();
    const [tsBody, setTsBody] = useState<string>(getCurrentTimestamp());

    // Send updated note to the backend when note is updated
    const updateNote = async () => {
        if (currentChatNote) {
            const newNote: ChatNoteProps = {
                ...currentChatNote,
                title: currentChatNoteTitle,
                body: body || [],
            };
            // Send the update note to the backend
            await sendUpdatedChatNote(myself, newNote, accessToken);

            // Add the updated note to the indexedDB
            await addNote(3, newNote);

            setStartIntervalUpdatingNote(false);
            setNoteBodyEdited(false);
            setNoteBodySaved(true);
            setNoteUpdated(false);
        }
    };

    useEffect(() => {
        if (noteUpdated) {
            updateNote();
        }
    }, [noteUpdated]);

    useEffect(() => {
        if (startIntervalUpdatingNote) {
            updateNote();
        }
    }, [startIntervalUpdatingNote]);

    // Auto save note body every Nms if needed
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (noteBodyEdited === true) {
                setStartIntervalUpdatingNote(true);
            }
        }, 3000);

        // Clean up the interval when the component unmounts
        return () => clearInterval(intervalId);
    }, [noteBodyEdited]);

    // Tab management
    const [isUpdatingTabContents, setIsUpdatingTabContents] = useState(true);

    useEffect(() => {
        if (currentChatNote) {
            setBody(currentChatNote.body);
            setTsBody(getCurrentTimestamp()); // This must be executed together with "setBody" !!!!
            setCurrentChatNoteTitle(currentChatNote.title);

            if (
                isUpdatingTabContents === true &&
                (tabNotes.length === 0 ||
                    (tabNotes.length > 0 &&
                        tabNotes.some((note) => note.noteId === currentChatNote.noteId)) === false)
            ) {
                // Add the clicked note to the tab.
                setTabNotes([...tabNotes, currentChatNote]);
                // Also, update the index to the clicked note.
                setSelectedTabIndex(tabNotes.length); // switch to new tab
            } else {
                // Update the index when an user click a note in the sidebar
                setSelectedTabIndex(
                    tabNotes.findIndex((note) => note.noteId === currentChatNote.noteId)
                );
            }

            setIsUpdatingTabContents(true);
        }
    }, [currentChatNote]);

    const setNote = async (noteId: number) => {
        const note: ChatNoteProps = await getData({
            storeName: STORES.CHAT_NOTES,
            key: noteId,
        });
        if (note) {
            setTabNotes([note]);
            setCurrentChatNote(note);
        } else {
            // console.log("not four note in indexedDB:", note);
            setTabNotes([]);
        }
        setSelectedTabIndex(0);
    };

    const handleCloseTab = (closedNoteId: number) => {
        if (tabNotes.length > 1) {
            setTabNotes(tabNotes.filter((t) => t.noteId !== closedNoteId));
            if (selectedTabIndex >= tabNotes.length - 1) {
                setSelectedTabIndex(tabNotes.length - 2); // fallback to previous tab
            } else {
                setIsUpdatingTabContents(false);
            }
        } else if (chatNoteMeta.length > 0) {
            setNote(chatNoteMeta[0].noteId);
        }
    };

    useEffect(() => {
        if (isUpdatingTabContents === false) {
            if (tabNotes[selectedTabIndex]) {
                setCurrentChatNote(tabNotes[selectedTabIndex]);
            }
        }
    }, [isUpdatingTabContents]);

    useEffect(() => {
        setNoteBodySaved(false);
        if (tabNotes[selectedTabIndex]) {
            setCurrentChatNote(tabNotes[selectedTabIndex]);
        }
    }, [selectedTabIndex]);

    // Update note title in the tab
    useEffect(() => {
        setTabNotes(
            tabNotes.map((u) =>
                u.noteId === currentChatNote?.noteId ? { ...u, title: currentChatNoteTitle } : u
            )
        );
    }, [currentChatNoteTitle]);

    const [openDeleteNote, setOpenDeleteNote] = useState<boolean>(false);

    const LoadNote = async (noteId: number) => {
        const note: ChatNoteProps = await getData({
            storeName: STORES.CHAT_NOTES,
            key: noteId,
        });
        if (note) {
            setCurrentChatNote(note);
        } else {
            const note: ChatNoteProps = await loadSpecificNote(myself, 3, noteId, accessToken);
            if (!note.error) {
                addNote(3, note);
                setCurrentChatNote(note);
            }
        }
    };

    return (
        <>
            {chatNoteMeta.length === 0 && (
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
                        component="button"
                        variant="soft"
                        color="neutral"
                        sx={{
                            fontSize: "15px",
                            padding: "10px",
                        }}
                    >
                        Not Found
                    </IconButton>
                </Box>
            )}

            {chatNoteMeta.length > 0 && (
                <Stack direction={"column"} sx={{ width: "100%" }}>
                    {body && (
                        <>
                            {currentNoteType !== 0 && (
                                <Stack direction={"column"} sx={{ width: "100%" }}>
                                    <Stack
                                        direction="row"
                                        alignItems="center"
                                        justifyContent="space-between"
                                        sx={{
                                            width: "100%",
                                            height: "30px",
                                            mt: "10px",
                                            mb: "3px",
                                        }}
                                    >
                                        {isInChatPage === true && <Box>Sub Notes (TBD)</Box>}
                                        {isInChatPage === false && (
                                            <>
                                                <Breadcrumbs
                                                    separator="›"
                                                    aria-label="breadcrumbs"
                                                >
                                                    <Typography
                                                        level="body-sm"
                                                        startDecorator={
                                                            <QuestionAnswerRoundedIcon />
                                                        }
                                                    >
                                                        Chat Notes
                                                    </Typography>
                                                    {currentChatNoteChain &&
                                                        currentChatNoteChain.map((node) => (
                                                            <Typography
                                                                level="title-sm"
                                                                component="button"
                                                                onClick={() => {
                                                                    LoadNote(node.noteId);
                                                                }}
                                                                sx={{
                                                                    background: "none",
                                                                    border: "none",
                                                                    padding: 0,
                                                                    cursor: "pointer",
                                                                    color: "#646CFF",
                                                                    textAlign: "left",
                                                                    fontWeight: "bold",
                                                                }}
                                                            >
                                                                {node.title.length > 15
                                                                    ? `${node.title.slice(
                                                                          0,
                                                                          15
                                                                      )}...`
                                                                    : node.title}
                                                            </Typography>
                                                        ))}
                                                </Breadcrumbs>
                                            </>
                                        )}

                                        <Stack direction={"row"}>
                                            <Dropdown>
                                                <MenuButton
                                                    slots={{ root: IconButton }}
                                                    slotProps={{
                                                        root: { color: "neutral" },
                                                    }}
                                                    sx={{ mb: "5px" }}
                                                >
                                                    <MoreVert />
                                                </MenuButton>
                                                <Menu size="sm">
                                                    <MenuItem
                                                        onClick={() => {
                                                            if (currentChatNote) {
                                                                handleCreateNewChatNote(
                                                                    currentChatNote.noteId,
                                                                    currentChatNote.chatType,
                                                                    currentChatNote.chatId,
                                                                    currentChatNote.isThread,
                                                                    currentChatNote.threadId
                                                                );
                                                            } else {
                                                                console.error(
                                                                    "Can't parent note ID to create a child note."
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        <AddIcon />
                                                        Child Note
                                                    </MenuItem>
                                                    <MenuItem
                                                        onClick={() => {
                                                            setOpenDeleteNote(true);
                                                        }}
                                                        sx={{
                                                            color: "red",
                                                            fontWeight: "bold",
                                                        }}
                                                    >
                                                        <DeleteIcon sx={{ color: "red" }} />
                                                        Delete Note
                                                    </MenuItem>
                                                </Menu>
                                            </Dropdown>
                                        </Stack>
                                        {currentChatNote && (
                                            <ModalDeleteChatNote
                                                myself={myself}
                                                openDeleteNote={openDeleteNote}
                                                setOpenDeleteNote={setOpenDeleteNote}
                                                chatNoteMeta={chatNoteMeta}
                                                setChatNoteMeta={setChatNoteMeta}
                                                currentChatNote={currentChatNote}
                                                handleCloseTab={handleCloseTab}
                                            />
                                        )}
                                    </Stack>

                                    <Tabs
                                        key={`tabs-${tabNotes.length}`}
                                        value={selectedTabIndex}
                                        onChange={(_, val) => {
                                            // console.log("move tab to:", val);
                                            setCurrentChatNote(tabNotes[Number(val)]);
                                            setSelectedTabIndex(Number(val));
                                        }}
                                        aria-label="Scrollable tabs"
                                        sx={{ width: "100%" }}
                                    >
                                        <TabList
                                            sx={{
                                                px: "5px",
                                                overflowX: "auto",
                                                scrollSnapType: "x mandatory",
                                                "&::-webkit-scrollbar": { display: "none" },
                                            }}
                                        >
                                            {tabNotes.map((tab, index) => (
                                                <Tab
                                                    key={tab.noteId}
                                                    sx={{
                                                        my: "3px",
                                                        flex: "none",
                                                        scrollSnapAlign: "start",
                                                        borderRadius: "5px",
                                                    }}
                                                    variant="soft"
                                                >
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            height: "20px",
                                                            maxWidth: "200px",
                                                        }}
                                                    >
                                                        {tab.title.length > 15
                                                            ? `${tab.title.slice(0, 15)}...`
                                                            : tab.title}

                                                        {tabNotes.length > 1 && (
                                                            <IconButton
                                                                component="span"
                                                                size="sm"
                                                                variant="plain"
                                                                color="neutral"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCloseTab(
                                                                        Number(tab.noteId)
                                                                    );
                                                                }}
                                                                sx={{ ml: 1 }}
                                                            >
                                                                <CloseIcon />
                                                            </IconButton>
                                                        )}
                                                    </Box>
                                                </Tab>
                                            ))}
                                        </TabList>

                                        {tabNotes.map((tabNote, index) => (
                                            <TabPanel
                                                key={`tab-note-body-${tabNote.noteId}-${tsBody}`}
                                                value={index}
                                                sx={{
                                                    paddingX: "5px",
                                                    paddingTop: "0px",
                                                    paddingBottom: "5px",
                                                }}
                                            >
                                                <FormControl
                                                    required
                                                    sx={{
                                                        mt: "10px",
                                                        ml: "10px",
                                                        justifyContent: "center",
                                                        position: "absolute",
                                                        zIndex: 100,
                                                    }}
                                                >
                                                    <Input
                                                        startDecorator={<NoteAltIcon />}
                                                        key={"currentChatNoteTitle"}
                                                        variant="soft"
                                                        placeholder="Note Title"
                                                        value={currentChatNoteTitle}
                                                        onChange={(e) => {
                                                            setCurrentChatNoteTitle(
                                                                e.target.value
                                                            );
                                                        }}
                                                        onBlur={() => {
                                                            setNoteUpdated(true);
                                                        }}
                                                        sx={{
                                                            fontSize: "22px",
                                                            fontWeight: "bold",
                                                        }}
                                                    />
                                                </FormControl>
                                                {noteBodySaved === true && (
                                                    <Box
                                                        sx={{
                                                            position: "absolute",
                                                            mt: "12px",
                                                            ml: "335px",
                                                            zIndex: 100,
                                                        }}
                                                    >
                                                        <Button
                                                            variant="outlined"
                                                            color="neutral"
                                                            size="sm"
                                                            startDecorator={
                                                                <CheckIcon
                                                                    sx={{ fontSize: "15px" }}
                                                                />
                                                            }
                                                        >
                                                            Saved
                                                        </Button>
                                                    </Box>
                                                )}
                                                {currentChatNote && (
                                                    <>
                                                        <BnChatNoteEditor
                                                            teamMemberProfiles={teamMemberProfiles}
                                                            myself={myself}
                                                            setMyself={setMyself}
                                                            socket={socket}
                                                            teamMembers={teamMembers}
                                                            currentChatNote={currentChatNote}
                                                            body={body}
                                                            setBody={setBody}
                                                            setNoteBodyEdited={setNoteBodyEdited}
                                                            setNoteBodySaved={setNoteBodySaved}
                                                            setCurrentChat={setCurrentChat}
                                                            setOpeningService={setOpeningService}
                                                        />
                                                    </>
                                                )}
                                            </TabPanel>
                                        ))}
                                    </Tabs>
                                </Stack>
                            )}
                        </>
                    )}
                </Stack>
            )}
        </>
    );
};
