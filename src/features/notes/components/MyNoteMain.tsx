import { Socket } from "socket.io-client";
import { useState, useEffect, useRef } from "react";
import {
    Box,
    Stack,
    Typography,
    Tooltip,
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
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import WindowIcon from "@mui/icons-material/Window";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVert from "@mui/icons-material/MoreVert";
import CheckIcon from "@mui/icons-material/Check";

import { UserProps } from "../../../types/admin";
import { ChatProps } from "../../../types/chat";
import { BnMyNoteEditor } from "../../../components/blockNote/bnMyNoteEditor";
import { MyNoteMetaProps, MyNoteProps, MyNoteMetaTreeNode } from "../../../types/notes";
import { sendUpdatedMyNote } from "../services/sendUpdatedMyNote";
import { useAuth } from "../../../context/AuthContext";
import { getCurrentTimestamp } from "../../../utils/dateUtils";
import { addNote } from "../services/addNote";
import { ModalDeleteMyNote } from "../modals/ModalDeleteMyNote";

type MyNoteMainProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    teamMembers: UserProps[];
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    currentNoteType: number;
    currentMyNote: MyNoteProps | null;
    setOpeningService: (service: number) => void;
    setCurrentChat: (chat: ChatProps) => void;
    myNoteMeta: MyNoteMetaProps[];
    setMyNoteMeta: (value: MyNoteMetaProps[]) => void;
    tabItems: MyNoteProps[];
    setTabItems: (value: MyNoteProps[]) => void;
    selectedTabIndex: number;
    handleCreateNewMyNote: (parentNoteId: number | null) => Promise<void>;
    currentMyNoteChain: MyNoteMetaTreeNode[];
    loadNote: (noteType: number, noteId: number, nextTabIndex: number) => Promise<void>;
};

export const MyNoteMain = (props: MyNoteMainProps) => {
    const {
        teamMemberProfiles,
        socket,
        teamMembers,
        myself,
        setMyself,
        currentMyNote,
        setOpeningService,
        setCurrentChat,
        currentNoteType,
        myNoteMeta,
        setMyNoteMeta,
        tabItems,
        setTabItems,
        selectedTabIndex,
        handleCreateNewMyNote,
        currentMyNoteChain,
        loadNote,
    } = props;

    const { accessToken } = useAuth();

    const [noteUpdated, setNoteUpdated] = useState(false);
    const [startIntervalUpdatingNote, setStartIntervalUpdatingNote] = useState(false);
    const [currentMyNoteTitle, setCurrentMyNoteTitle] = useState<string>(
        currentMyNote?.title || ""
    );
    const [noteBodyEdited, setNoteBodyEdited] = useState(false);
    const [noteBodySaved, setNoteBodySaved] = useState(false);
    const [body, setBody] = useState<PartialBlock[]>();
    const [tsBody, setTsBody] = useState<string>(getCurrentTimestamp());
    const [openDeleteNote, setOpenDeleteNote] = useState<boolean>(false);
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
        if (currentMyNote) {
            let newNoteTitle = currentMyNoteTitle;

            // If the note title is empty, use the note original title.
            // (not updating the title to empty)
            if (currentMyNoteTitle === "") {
                newNoteTitle = currentMyNote.title;
                setCurrentMyNoteTitle(newNoteTitle);
            }

            const newNote: MyNoteProps = {
                ...currentMyNote,
                title: newNoteTitle,
                body: body || [],
            };
            // Send the update note to the backend
            await sendUpdatedMyNote(myself, newNote, accessToken);

            // Add the updated note to the indexedDB
            await addNote(1, newNote);

            setStartIntervalUpdatingNote(false);
            setNoteBodyEdited(false);
            setNoteBodySaved(true);
            setNoteUpdated(false);

            // This needs to update the note title on the tab.
            setTabItems(
                tabItems.map((item) =>
                    item.noteType === currentMyNote?.noteType &&
                    item.noteId === currentMyNote?.noteId
                        ? newNote
                        : item
                )
            );

            // This needs to update the note title in the sidebar.
            setMyNoteMeta(
                myNoteMeta.map((item) =>
                    item.noteType === newNote.noteType && item.noteId === newNote.noteId
                        ? {
                              noteType: newNote.noteType,
                              noteId: newNote.noteId,
                              parentNoteId: newNote.parentNoteId,
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
        if (currentMyNote) {
            setBody(currentMyNote.body);
            setTsBody(getCurrentTimestamp());
            setCurrentMyNoteTitle(currentMyNote.title);
        }
    }, [currentMyNote]);

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
    // Reset note body saved status when the selected tab index changes
    useEffect(() => {
        setNoteBodySaved(false);
    }, [selectedTabIndex]);

    return (
        <>
            {(myNoteMeta.length === 0 || currentMyNote === null) && (
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
                            paddingRight: "10px",
                        }}
                        onClick={() => {
                            handleCreateNewMyNote(null);
                        }}
                    >
                        <AddIcon />
                        New Note
                    </IconButton>
                </Box>
            )}

            {myNoteMeta.length > 0 && (
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
                                            mt: "10px",
                                            mb: "5px",
                                        }}
                                    >
                                        <Breadcrumbs separator="›" aria-label="breadcrumbs">
                                            <IconButton
                                                component="button"
                                                variant="soft"
                                                color="primary"
                                                sx={{
                                                    fontSize: "14px",
                                                }}
                                            >
                                                <WindowIcon sx={{ fontSize: "20px" }} />
                                                My Notes
                                            </IconButton>
                                            {currentMyNoteChain.map((node) => (
                                                <Typography
                                                    level="title-sm"
                                                    component="button"
                                                    onClick={() => {
                                                        loadNote(1, node.noteId, -1);
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
                                                        ? `${node.title.slice(0, 19)}...`
                                                        : node.title}
                                                </Typography>
                                            ))}
                                        </Breadcrumbs>

                                        <Stack direction={"row"}>
                                            <Tooltip title="Create a New Note" size="sm">
                                                <IconButton
                                                    component="button"
                                                    size="sm"
                                                    variant="outlined"
                                                    color="neutral"
                                                    onClick={() => {
                                                        handleCreateNewMyNote(null);
                                                    }}
                                                    sx={{ px: "10px", mb: "5px" }}
                                                >
                                                    <PlaylistAddIcon />
                                                    New Note
                                                </IconButton>
                                            </Tooltip>
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
                                                            if (currentMyNote) {
                                                                handleCreateNewMyNote(
                                                                    currentMyNote.noteId
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
                                        {currentMyNote && (
                                            <ModalDeleteMyNote
                                                myself={myself}
                                                openDeleteNote={openDeleteNote}
                                                setOpenDeleteNote={setOpenDeleteNote}
                                                myNoteMeta={myNoteMeta}
                                                setMyNoteMeta={setMyNoteMeta}
                                                currentMyNote={currentMyNote}
                                                handleCloseTab={handleCloseTab}
                                                currentTabIndex={selectedTabIndex}
                                            />
                                        )}
                                    </Stack>

                                    <Tabs
                                        key={`tabs-${tabItems.length}-${selectedTabIndex}`}
                                        value={selectedTabIndex}
                                        onChange={(_, val) => {
                                            loadNote(
                                                tabItems[Number(val)].noteType,
                                                tabItems[Number(val)].noteId,
                                                Number(val)
                                            );
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
                                            {tabItems.map((tab, index) => (
                                                <Tab
                                                    key={`tab-${tab.noteType}-${tab.noteId}-${tsBody}`}
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
                                                        key={"currentMyNoteTitle"}
                                                        variant="soft"
                                                        placeholder="Note Title"
                                                        value={currentMyNoteTitle}
                                                        onChange={(e) => {
                                                            setCurrentMyNoteTitle(e.target.value);
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
                                                {currentMyNote && (
                                                    <>
                                                        <BnMyNoteEditor
                                                            teamMemberProfiles={teamMemberProfiles}
                                                            myself={myself}
                                                            setMyself={setMyself}
                                                            socket={socket}
                                                            teamMembers={teamMembers}
                                                            currentMyNote={currentMyNote}
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
