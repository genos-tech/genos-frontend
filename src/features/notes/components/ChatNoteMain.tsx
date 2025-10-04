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
    Tooltip,
} from "@mui/joy";
import { PartialBlock } from "@blocknote/core";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVert from "@mui/icons-material/MoreVert";
import CheckIcon from "@mui/icons-material/Check";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CancelIcon from "@mui/icons-material/Cancel";

import { UserProps } from "../../../types/admin";
import { ChatProps } from "../../../types/chat";
import { BnChatNoteEditor } from "../../../components/blockNote/bnChatNoteEditor";
import { ChatNoteMetaProps, ChatNoteProps, ChatNoteMetaTreeNode } from "../../../types/notes";
import { sendUpdatedChatNote } from "../services/sendUpdatedChatNote";
import { useAuth } from "../../../context/AuthContext";
import { getCurrentTimestamp } from "../../../utils/dateUtils";
import { addNote } from "../services/addNote";
import { ModalDeleteChatNote } from "../modals/ModalDeleteChatNote";
import { ACChatChildNotes } from "./autocompletes/ACChatChildNotes";

type ChatNoteMainProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    teamMembers: UserProps[];
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    currentNoteType: number;
    currentChatNote: ChatNoteProps | null;
    setCurrentChatNote: (value: ChatNoteProps) => void;
    setOpeningService: (service: number) => void;
    setCurrentChat: (chat: ChatProps) => void;
    chatNoteMeta: ChatNoteMetaProps[];
    setChatNoteMeta: (value: ChatNoteMetaProps[]) => void;
    tabItems: ChatNoteProps[];
    setTabItems: (value: ChatNoteProps[]) => void;
    selectedTabIndex: number;
    handleCreateNewChatNote: (
        parentNoteId: number | null,
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number
    ) => Promise<void>;
    currentChatNoteChain?: ChatNoteMetaTreeNode[];
    isInChatPage: boolean;
    setIsMainChatVisible: (value: boolean) => void;
    setIsChatNoteVisible: (value: boolean) => void;
    loadNote: (noteType: number, noteId: number, nextTabIndex: number) => Promise<void>;
    moveToSpecificChat: (chatType: number, chatId: number, threadId: number) => void;
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
        setOpeningService,
        setCurrentChat,
        currentNoteType,
        chatNoteMeta,
        setChatNoteMeta,
        tabItems,
        setTabItems,
        selectedTabIndex,
        handleCreateNewChatNote,
        currentChatNoteChain,
        isInChatPage,
        setIsMainChatVisible,
        setIsChatNoteVisible,
        loadNote,
        moveToSpecificChat,
    } = props;

    const { accessToken } = useAuth();

    const [noteUpdated, setNoteUpdated] = useState(false);
    const [startIntervalUpdatingNote, setStartIntervalUpdatingNote] = useState(false);
    const [currentChatNoteTitle, setCurrentChatNoteTitle] = useState<string>(
        currentChatNote?.title || ""
    );
    const [noteBodyEdited, setNoteBodyEdited] = useState(false);
    const [noteBodySaved, setNoteBodySaved] = useState(false);
    const [body, setBody] = useState<PartialBlock[]>();
    const [tsBody, setTsBody] = useState<string>(getCurrentTimestamp());
    const [openDeleteNote, setOpenDeleteNote] = useState<boolean>(false);
    const [openSearchBox, setOpenSearchBox] = useState(false);
    const titleInputRef = useRef<HTMLInputElement | null>(null);

    // Auto save note body every Nms if needed
    useEffect(() => {
        if (startIntervalUpdatingNote) {
            updateNote();
        }
    }, [startIntervalUpdatingNote]);
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (noteBodyEdited === true) {
                setStartIntervalUpdatingNote(true);
            }
        }, 3000);

        // Clean up the interval when the component unmounts
        return () => clearInterval(intervalId);
    }, [noteBodyEdited]);

    // Send updated note to the backend when note is updated
    const updateNote = async () => {
        if (currentChatNote) {
            let newNoteTitle = currentChatNoteTitle;

            // If the note title is empty, use the note original title.
            // (not updating the title to empty)
            if (currentChatNoteTitle === "") {
                newNoteTitle = currentChatNote.title;
                setCurrentChatNoteTitle(newNoteTitle);
            }

            const newNote: ChatNoteProps = {
                ...currentChatNote,
                title: newNoteTitle,
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

            // This needs to update the note title on the tab.
            setTabItems(
                tabItems.map((item) =>
                    item.noteType === currentChatNote?.noteType &&
                    item.noteId === currentChatNote?.noteId
                        ? newNote
                        : item
                )
            );

            // This needs to update the note title in the sidebar.
            setChatNoteMeta(
                chatNoteMeta.map((item) =>
                    item.noteType === newNote.noteType && item.noteId === newNote.noteId
                        ? {
                              noteType: newNote.noteType,
                              noteId: newNote.noteId,
                              parentNoteId: newNote.parentNoteId,
                              chatType: newNote.chatType,
                              chatId: newNote.chatId,
                              isThread: newNote.isThread,
                              threadId: newNote.threadId,
                              title: newNote.title,
                              tsUpdated: newNote.tsUpdated,
                          }
                        : item
                )
            );
        }
    };

    useEffect(() => {
        if (noteUpdated) {
            updateNote();
        }
    }, [noteUpdated]);

    useEffect(() => {
        if (currentChatNote) {
            setBody(currentChatNote.body);
            setTsBody(getCurrentTimestamp());
            setCurrentChatNoteTitle(currentChatNote.title);
        }
    }, [currentChatNote]);

    const handleCloseTab = async (tabIndex: number, closingNoteId: number) => {
        const indexOfNextNote = tabIndex === 0 ? 1 : tabIndex - 1;
        const nextTabIndex = Math.max(tabIndex - 1, 0);
        setTabItems(tabItems.filter((t) => t.noteId !== closingNoteId));
        await loadNote(
            tabItems[indexOfNextNote].noteType,
            tabItems[indexOfNextNote].noteId,
            nextTabIndex
        );
    };

    useEffect(() => {
        setNoteBodySaved(false);
    }, [selectedTabIndex]);

    return (
        <>
            {(chatNoteMeta.length === 0 || currentChatNote === null) && (
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
                        No Chat Selected
                    </IconButton>
                </Box>
            )}

            {!(chatNoteMeta.length === 0 || currentChatNote === null) &&
                chatNoteMeta.length > 0 && (
                    <Stack direction={"column"} sx={{ width: "100%" }}>
                        {body && (
                            <>
                                {currentNoteType !== 0 && (
                                    <Stack direction={"column"} sx={{ width: "100%" }}>
                                        {/* Note Header */}
                                        <Stack
                                            direction="row"
                                            alignItems="center"
                                            justifyContent="space-between"
                                            sx={{
                                                width: "100%",
                                                height: "30px",
                                                mt: isInChatPage === true ? "0px" : "10px",
                                                mb: "5px",
                                            }}
                                        >
                                            {isInChatPage === true && currentChatNote && (
                                                <Box
                                                    sx={{
                                                        ml: "5px",
                                                        mb: "10px",
                                                        width: "40%",
                                                    }}
                                                >
                                                    <ACChatChildNotes
                                                        myself={myself}
                                                        noteId={currentChatNote.noteId}
                                                        openSearchBox={openSearchBox}
                                                        setOpenSearchBox={setOpenSearchBox}
                                                        setCurrentChatNote={setCurrentChatNote}
                                                    />
                                                </Box>
                                            )}
                                            {isInChatPage === false && (
                                                <>
                                                    <Breadcrumbs
                                                        separator="›"
                                                        aria-label="breadcrumbs"
                                                    >
                                                        <IconButton
                                                            component="button"
                                                            variant="soft"
                                                            color="warning"
                                                            sx={{
                                                                fontSize: "14px",
                                                            }}
                                                        >
                                                            <QuestionAnswerRoundedIcon
                                                                sx={{ fontSize: "20px" }}
                                                            />
                                                            Chat Notes
                                                        </IconButton>
                                                        {currentChatNoteChain &&
                                                            currentChatNoteChain.map((node) => (
                                                                <Typography
                                                                    level="title-sm"
                                                                    component="button"
                                                                    onClick={() => {
                                                                        loadNote(
                                                                            3,
                                                                            node.noteId,
                                                                            -1
                                                                        );
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
                                                                    {node.title.length > 19
                                                                        ? `${node.title.slice(
                                                                              0,
                                                                              19
                                                                          )}...`
                                                                        : node.title}
                                                                </Typography>
                                                            ))}
                                                    </Breadcrumbs>
                                                </>
                                            )}

                                            <Stack direction={"row"}>
                                                {isInChatPage && currentChatNote && (
                                                    <IconButton
                                                        component="button"
                                                        variant="plain"
                                                        color="neutral"
                                                        sx={{
                                                            fontSize: "14px",
                                                            paddingRight: "10px",
                                                            height: "5px",
                                                        }}
                                                        onClick={() => {
                                                            handleCreateNewChatNote(
                                                                currentChatNote.noteId,
                                                                currentChatNote.chatType,
                                                                currentChatNote.chatId,
                                                                currentChatNote.isThread,
                                                                currentChatNote.threadId
                                                            );
                                                        }}
                                                    >
                                                        <AddIcon />
                                                        Child Note
                                                    </IconButton>
                                                )}

                                                {isInChatPage && (
                                                    <Tooltip title="Open in Notes">
                                                        <IconButton
                                                            size="sm"
                                                            color="neutral"
                                                            variant="plain"
                                                            sx={{ mb: "5px" }}
                                                            onClick={() => {
                                                                setOpeningService(3);
                                                            }}
                                                        >
                                                            <OpenInNewIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

                                                {isInChatPage === false && (
                                                    <Tooltip title="Open Chat">
                                                        <IconButton
                                                            size="sm"
                                                            color="neutral"
                                                            variant="plain"
                                                            sx={{ mb: "5px" }}
                                                            onClick={() => {
                                                                moveToSpecificChat(
                                                                    currentChatNote.chatType,
                                                                    currentChatNote.chatId,
                                                                    currentChatNote.threadId
                                                                );
                                                            }}
                                                        >
                                                            <OpenInNewIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

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

                                                {isInChatPage === true && (
                                                    <Tooltip title="Close Notes">
                                                        <IconButton
                                                            size="sm"
                                                            color="neutral"
                                                            variant="plain"
                                                            sx={{ mb: "5px" }}
                                                            onClick={() => {
                                                                setIsChatNoteVisible(false);

                                                                // Open main chat pane
                                                                if (setIsMainChatVisible) {
                                                                    setIsMainChatVisible(true);
                                                                }
                                                            }}
                                                        >
                                                            <CancelIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

                                                {currentChatNote && (
                                                    <ModalDeleteChatNote
                                                        myself={myself}
                                                        openDeleteNote={openDeleteNote}
                                                        setOpenDeleteNote={setOpenDeleteNote}
                                                        chatNoteMeta={chatNoteMeta}
                                                        setChatNoteMeta={setChatNoteMeta}
                                                        currentChatNote={currentChatNote}
                                                        handleCloseTab={handleCloseTab}
                                                        currentTabIndex={selectedTabIndex}
                                                    />
                                                )}
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
                                                    currentTabIndex={selectedTabIndex}
                                                />
                                            )}
                                        </Stack>

                                        <Tabs
                                            value={selectedTabIndex}
                                            onChange={(_, val) => {
                                                loadNote(
                                                    tabItems[Number(val)].noteType,
                                                    tabItems[Number(val)].noteId,
                                                    Number(val)
                                                );
                                            }}
                                            sx={{ width: "100%" }}
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
                                                    <Tab
                                                        key={`tab-${index}`}
                                                        sx={{
                                                            mx: "2px",
                                                            my: "4px",
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
                                                            {tab.title.length > 19
                                                                ? `${tab.title.slice(0, 19)}...`
                                                                : tab.title}

                                                            {tabItems.length > 1 && (
                                                                <IconButton
                                                                    component="span"
                                                                    size="sm"
                                                                    variant="plain"
                                                                    color="neutral"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleCloseTab(
                                                                            index,
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
                                                            slotProps={{
                                                                input: {
                                                                    ref: titleInputRef,
                                                                    onKeyDown: (
                                                                        e: React.KeyboardEvent<HTMLInputElement>
                                                                    ) => {
                                                                        if (e.key === "Enter") {
                                                                            e.preventDefault(); // stop form submission if inside <form>
                                                                            titleInputRef.current?.blur();
                                                                        }
                                                                    },
                                                                },
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
                                                                teamMemberProfiles={
                                                                    teamMemberProfiles
                                                                }
                                                                myself={myself}
                                                                setMyself={setMyself}
                                                                socket={socket}
                                                                teamMembers={teamMembers}
                                                                currentChatNote={currentChatNote}
                                                                body={body}
                                                                setBody={setBody}
                                                                setNoteBodyEdited={
                                                                    setNoteBodyEdited
                                                                }
                                                                setNoteBodySaved={setNoteBodySaved}
                                                                setCurrentChat={setCurrentChat}
                                                                setOpeningService={
                                                                    setOpeningService
                                                                }
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
