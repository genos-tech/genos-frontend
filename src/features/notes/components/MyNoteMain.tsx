import { PartialBlock } from "@blocknote/core";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVert from "@mui/icons-material/MoreVert";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import WindowIcon from "@mui/icons-material/Window";
import {
    Box,
    Breadcrumbs,
    Button,
    Dropdown,
    FormControl,
    IconButton,
    Input,
    Menu,
    MenuButton,
    MenuItem,
    Stack,
    Tab,
    TabList,
    TabPanel,
    Tabs,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";

import { BnMyNoteEditor } from "../../../components/blockNote/bnMyNoteEditor";
import { useAuth } from "../../../context/AuthContext";
import { NoteManagementState } from "../../../hooks/notes/useNoteManagement";
import { UserProps } from "../../../types/admin";
import { ChatProps } from "../../../types/chat";
import { MyNoteProps } from "../../../types/notes";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { ModalDeleteMyNote } from "../modals/ModalDeleteMyNote";
import { addNote } from "../services/addNote";
import { sendUpdatedMyNote } from "../services/sendUpdatedMyNote";

type MyNoteMainProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    teamMembers: UserProps[];
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    setOpeningService: (service: number) => void;
    setCurrentChat: (chat: ChatProps) => void;
    NM: NoteManagementState;
};

export const MyNoteMain = (props: MyNoteMainProps) => {
    const {
        teamMemberProfiles,
        socket,
        teamMembers,
        myself,
        setMyself,
        setOpeningService,
        setCurrentChat,
        NM,
    } = props;

    const { accessToken } = useAuth();

    const [noteUpdated, setNoteUpdated] = useState(false);
    const [startIntervalUpdatingNote, setStartIntervalUpdatingNote] = useState(false);
    const [currentMyNoteTitle, setCurrentMyNoteTitle] = useState<string>(
        NM.currentMyNote?.title || ""
    );
    const [noteBodyEdited, setNoteBodyEdited] = useState(false);
    const [noteBodySaved, setNoteBodySaved] = useState(false);
    const [body, setBody] = useState<PartialBlock[]>();
    const [tsBody, setTsBody] = useState<string>(getLocalCurrentTimestamp());
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
        if (NM.currentMyNote) {
            let newNoteTitle = currentMyNoteTitle;

            // If the note title is empty, use the note original title.
            // (not updating the title to empty)
            if (currentMyNoteTitle === "") {
                newNoteTitle = NM.currentMyNote.title;
                setCurrentMyNoteTitle(newNoteTitle);
            }

            const newNote: MyNoteProps = {
                ...NM.currentMyNote,
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
            NM.setTabItems(
                NM.tabItems.map((item) =>
                    item.noteType === NM.currentMyNote?.noteType &&
                    item.noteId === NM.currentMyNote?.noteId
                        ? newNote
                        : item
                )
            );

            // This needs to update the note title in the sidebar.
            NM.setMyNoteMeta(
                NM.myNoteMeta.map((item) =>
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
        if (NM.currentMyNote) {
            setBody(NM.currentMyNote.body);
            setTsBody(getLocalCurrentTimestamp());
            setCurrentMyNoteTitle(NM.currentMyNote.title);
        }
    }, [NM.currentMyNote]);

    const handleCloseTab = async (tabIndex: number, closingNoteId: number) => {
        const indexOfNextNote = tabIndex === 0 ? 1 : tabIndex - 1;
        const nextTabIndex = Math.max(tabIndex - 1, 0);
        NM.setTabItems(NM.tabItems.filter((t) => t.noteId !== closingNoteId));
        await NM.loadNote(
            NM.tabItems[indexOfNextNote].noteType,
            NM.tabItems[indexOfNextNote].noteId,
            nextTabIndex
        );
    };
    // Reset note body saved status when the selected tab index changes
    useEffect(() => {
        setNoteBodySaved(false);
    }, [NM.selectedTabIndex]);

    return (
        <>
            {(NM.tabItems.length === 0 || NM.currentMyNote === null) && (
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
                        onClick={() => {
                            NM.handleCreateNewMyNote(null);
                        }}
                    >
                        <AddIcon />
                        New Note
                    </IconButton>
                </Box>
            )}

            {!(NM.tabItems.length === 0 || NM.currentMyNote === null) && (
                <Stack direction={"column"} sx={{ width: "100%" }}>
                    {body && (
                        <>
                            {NM.currentNoteType !== 0 && (
                                <Stack direction={"column"} sx={{ width: "100%" }}>
                                    {/* Note Header */}
                                    <Stack
                                        alignItems="center"
                                        direction="row"
                                        justifyContent="space-between"
                                        sx={{
                                            width: "100%",
                                            height: "30px",
                                            mt: "10px",
                                            mb: "5px",
                                        }}
                                    >
                                        <Breadcrumbs aria-label="breadcrumbs" separator="›">
                                            <IconButton
                                                color="primary"
                                                component="button"
                                                variant="soft"
                                                sx={{
                                                    fontSize: "14px",
                                                }}
                                            >
                                                <WindowIcon sx={{ fontSize: "20px" }} />
                                                My Notes
                                            </IconButton>
                                            {NM.currentMyNoteChain &&
                                                NM.currentMyNoteChain.map((node) => (
                                                    <Typography
                                                        component="button"
                                                        level="title-sm"
                                                        sx={{
                                                            background: "none",
                                                            border: "none",
                                                            padding: 0,
                                                            cursor: "pointer",
                                                            color: "#646CFF",
                                                            textAlign: "left",
                                                            fontWeight: "bold",
                                                        }}
                                                        onClick={() => {
                                                            NM.loadNote(1, node.noteId, -1);
                                                        }}
                                                    >
                                                        {node.title.length > 14
                                                            ? `${node.title.slice(0, 14)}...`
                                                            : node.title}
                                                    </Typography>
                                                ))}
                                        </Breadcrumbs>

                                        <Stack direction={"row"}>
                                            <Tooltip size="sm" title="Create a New Note">
                                                <IconButton
                                                    color="neutral"
                                                    component="button"
                                                    size="sm"
                                                    sx={{ px: "10px", mb: "5px" }}
                                                    variant="plain"
                                                    onClick={() => {
                                                        NM.handleCreateNewMyNote(null);
                                                    }}
                                                >
                                                    <PlaylistAddIcon sx={{ mr: "2px" }} />
                                                    New Note
                                                </IconButton>
                                            </Tooltip>
                                            <Dropdown>
                                                <Tooltip title="More Options">
                                                    <MenuButton
                                                        slots={{ root: IconButton }}
                                                        sx={{ mb: "5px" }}
                                                        slotProps={{
                                                            root: { color: "neutral" },
                                                        }}
                                                    >
                                                        <MoreVert />
                                                    </MenuButton>
                                                </Tooltip>
                                                <Menu size="sm">
                                                    <MenuItem
                                                        onClick={() => {
                                                            if (NM.currentMyNote) {
                                                                NM.handleCreateNewMyNote(
                                                                    NM.currentMyNote.noteId
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
                                                        sx={{
                                                            color: "red",
                                                            fontWeight: "bold",
                                                        }}
                                                        onClick={() => {
                                                            setOpenDeleteNote(true);
                                                        }}
                                                    >
                                                        <DeleteIcon sx={{ color: "red" }} />
                                                        Delete Note
                                                    </MenuItem>
                                                </Menu>
                                            </Dropdown>
                                        </Stack>
                                        {NM.currentMyNote && (
                                            <ModalDeleteMyNote
                                                currentMyNote={NM.currentMyNote}
                                                currentTabIndex={NM.selectedTabIndex}
                                                handleCloseTab={handleCloseTab}
                                                myNoteMeta={NM.myNoteMeta}
                                                myself={myself}
                                                openDeleteNote={openDeleteNote}
                                                setMyNoteMeta={NM.setMyNoteMeta}
                                                setOpenDeleteNote={setOpenDeleteNote}
                                            />
                                        )}
                                    </Stack>

                                    <Tabs
                                        sx={{ width: "100%" }}
                                        value={NM.selectedTabIndex}
                                        onChange={(_, val) => {
                                            NM.loadNote(
                                                NM.tabItems[Number(val)].noteType,
                                                NM.tabItems[Number(val)].noteId,
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
                                            {NM.tabItems.map((tab, index) => (
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

                                                        {NM.tabItems.length > 1 && (
                                                            <IconButton
                                                                color="neutral"
                                                                component="span"
                                                                size="sm"
                                                                sx={{ ml: 1 }}
                                                                variant="plain"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCloseTab(
                                                                        index,
                                                                        Number(tab.noteId)
                                                                    );
                                                                }}
                                                            >
                                                                <CloseIcon />
                                                            </IconButton>
                                                        )}
                                                    </Box>
                                                </Tab>
                                            ))}
                                        </TabList>

                                        {NM.tabItems.map((tabNote, index) => (
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
                                                        key={"currentMyNoteTitle"}
                                                        placeholder="Note Title"
                                                        startDecorator={<NoteAltIcon />}
                                                        value={currentMyNoteTitle}
                                                        variant="soft"
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
                                                        sx={{
                                                            fontSize: "22px",
                                                            fontWeight: "bold",
                                                        }}
                                                        onBlur={() => {
                                                            setNoteUpdated(true);
                                                        }}
                                                        onChange={(e) => {
                                                            setCurrentMyNoteTitle(e.target.value);
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
                                                            color="neutral"
                                                            size="sm"
                                                            variant="outlined"
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
                                                {NM.currentMyNote && (
                                                    <>
                                                        <BnMyNoteEditor
                                                            body={body}
                                                            currentMyNote={NM.currentMyNote}
                                                            myself={myself}
                                                            setBody={setBody}
                                                            setCurrentChat={setCurrentChat}
                                                            setMyself={setMyself}
                                                            setNoteBodyEdited={setNoteBodyEdited}
                                                            setNoteBodySaved={setNoteBodySaved}
                                                            setOpeningService={setOpeningService}
                                                            socket={socket}
                                                            teamMemberProfiles={teamMemberProfiles}
                                                            teamMembers={teamMembers}
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
