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
import { NoteMetaProps, MyNoteProps, MyNoteMetaTreeNode } from "../../../types/notes";
import { sendUpdatedMyNote } from "../services/sendUpdatedMyNote";
import { useAuth } from "../../../context/AuthContext";
import { getCurrentTimestamp } from "../../../utils/dateUtils";
import { addNote } from "../services/addNote";
import { ModalDeleteMyNote } from "../modals/ModalDeleteMyNote";
import { getData } from "../../../db/crud";
import { STORES } from "../../../db/conf";
import { loadSpecificNote } from "../services/loadSpecificNote";

type MyNoteMainProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    teamMembers: UserProps[];
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    currentNoteType: number;
    currentMyNote: MyNoteProps | null;
    setCurrentMyNote: (value: MyNoteProps) => void;
    currentMyNoteTitle: string;
    setCurrentMyNoteTitle: (value: string) => void;
    setOpeningService: (service: number) => void;
    setCurrentChat: (chat: ChatProps) => void;
    myNoteMeta: NoteMetaProps[];
    setMyNoteMeta: (value: NoteMetaProps[]) => void;
    tabMyNotes: MyNoteProps[];
    setTabMyNotes: (value: MyNoteProps[]) => void;
    selectedTabIndex: number;
    setSelectedTabIndex: (value: number) => void;
    handleCreateNewMyNote: (parentNoteId: number | null) => Promise<void>;
    currentMyNoteChain: MyNoteMetaTreeNode[];
};

export const MyNoteMain = (props: MyNoteMainProps) => {
    const {
        teamMemberProfiles,
        socket,
        teamMembers,
        myself,
        setMyself,
        currentMyNote,
        setCurrentMyNote,
        currentMyNoteTitle,
        setCurrentMyNoteTitle,
        setOpeningService,
        setCurrentChat,
        currentNoteType,
        myNoteMeta,
        setMyNoteMeta,
        tabMyNotes,
        setTabMyNotes,
        selectedTabIndex,
        setSelectedTabIndex,
        handleCreateNewMyNote,
        currentMyNoteChain,
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
        if (currentMyNote) {
            const newNote: MyNoteProps = {
                ...currentMyNote,
                title: currentMyNoteTitle,
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
        if (currentMyNote) {
            setBody(currentMyNote.body);
            setTsBody(getCurrentTimestamp()); // This must be executed together with "setBody" !!!!
            setCurrentMyNoteTitle(currentMyNote.title);

            if (
                isUpdatingTabContents === true &&
                (tabMyNotes.length === 0 ||
                    (tabMyNotes.length > 0 &&
                        tabMyNotes.some((note) => note.noteId === currentMyNote.noteId)) === false)
            ) {
                // Add the clicked note to the tab.
                setTabMyNotes([...tabMyNotes, currentMyNote]);
                // Also, update the index to the clicked note.
                setSelectedTabIndex(tabMyNotes.length); // switch to new tab
            } else {
                // Update the index when an user click a note in the sidebar
                setSelectedTabIndex(
                    tabMyNotes.findIndex((note) => note.noteId === currentMyNote.noteId)
                );
            }

            setIsUpdatingTabContents(true);
        }
    }, [currentMyNote]);

    const setNote = async (noteId: number) => {
        const note: MyNoteProps = await getData({
            storeName: STORES.PERSONAL_NOTES,
            key: noteId,
        });
        if (note) {
            setTabMyNotes([note]);
            setCurrentMyNote(note);
        } else {
            // console.log("not four note in indexedDB:", note);
            setTabMyNotes([]);
        }
        setSelectedTabIndex(0);
    };

    const handleCloseTab = (closedNoteId: number) => {
        if (tabMyNotes.length > 1) {
            setTabMyNotes(tabMyNotes.filter((t) => t.noteId !== closedNoteId));
            if (selectedTabIndex >= tabMyNotes.length - 1) {
                setSelectedTabIndex(tabMyNotes.length - 2); // fallback to previous tab
            } else {
                setIsUpdatingTabContents(false);
            }
        } else if (myNoteMeta.length > 0) {
            setNote(myNoteMeta[0].noteId);
        }
    };

    useEffect(() => {
        if (isUpdatingTabContents === false) {
            if (tabMyNotes[selectedTabIndex]) {
                setCurrentMyNote(tabMyNotes[selectedTabIndex]);
            }
        }
    }, [isUpdatingTabContents]);

    useEffect(() => {
        setNoteBodySaved(false);
        if (tabMyNotes[selectedTabIndex]) {
            setCurrentMyNote(tabMyNotes[selectedTabIndex]);
        }
    }, [selectedTabIndex]);

    // Update note title in the tab
    useEffect(() => {
        setTabMyNotes(
            tabMyNotes.map((u) =>
                u.noteId === currentMyNote?.noteId ? { ...u, title: currentMyNoteTitle } : u
            )
        );
    }, [currentMyNoteTitle]);

    const [openDeleteNote, setOpenDeleteNote] = useState<boolean>(false);

    const LoadNote = async (noteId: number) => {
        const note: MyNoteProps = await getData({ storeName: STORES.PERSONAL_NOTES, key: noteId });
        if (note) {
            setCurrentMyNote(note);
        } else {
            const note: MyNoteProps = await loadSpecificNote(myself, 1, noteId, accessToken);
            if (!note.error) {
                addNote(1, note);
                setCurrentMyNote(note);
            }
        }
    };

    return (
        <>
            {myNoteMeta.length === 0 && (
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
                    {currentNoteType === 0 && (
                        <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            sx={{ width: "100%" }}
                        >
                            <Typography fontSize="20px">Note Home</Typography>

                            <Tooltip title="Create a new my note" size="sm">
                                <IconButton
                                    component="button"
                                    size="sm"
                                    variant="outlined"
                                    color="neutral"
                                    onClick={() => {}}
                                    sx={{ px: "10px" }}
                                >
                                    <PlaylistAddIcon />
                                    New Note
                                </IconButton>
                            </Tooltip>
                        </Stack>
                    )}

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
                                        <Breadcrumbs separator="›" aria-label="breadcrumbs">
                                            <Typography
                                                level="body-sm"
                                                startDecorator={<WindowIcon />}
                                            >
                                                My Notes
                                            </Typography>
                                            {currentMyNoteChain.map((node) => (
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
                                                        ? `${node.title.slice(0, 15)}...`
                                                        : node.title}
                                                </Typography>
                                            ))}
                                        </Breadcrumbs>

                                        <Stack direction={"row"}>
                                            <Tooltip title="Create a new my note" size="sm">
                                                <IconButton
                                                    component="button"
                                                    size="sm"
                                                    variant="outlined"
                                                    color="neutral"
                                                    onClick={() => {
                                                        handleCreateNewMyNote(null);
                                                    }}
                                                    sx={{ px: "10px" }}
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
                                            />
                                        )}
                                    </Stack>

                                    <Tabs
                                        key={`tabs-${tabMyNotes.length}`}
                                        value={selectedTabIndex}
                                        onChange={(_, val) => {
                                            // console.log("move tab to:", val);
                                            setCurrentMyNote(tabMyNotes[Number(val)]);
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
                                            {tabMyNotes.map((tab, index) => (
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

                                                        {tabMyNotes.length > 1 && (
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

                                        {tabMyNotes.map((tabNote, index) => (
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
                                                        key={"currentMyNoteTitle"}
                                                        variant="soft"
                                                        placeholder="Note Title"
                                                        value={currentMyNoteTitle}
                                                        onChange={(e) => {
                                                            setCurrentMyNoteTitle(e.target.value);
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
