import { Socket } from "socket.io-client";
import { useState, useEffect, useRef } from "react";
import {
    Box,
    Stack,
    Typography,
    Tooltip,
    IconButton,
    Link,
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
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVert from "@mui/icons-material/MoreVert";
import CheckIcon from "@mui/icons-material/Check";

import { UserProps } from "../../../types/admin";
import { ChatProps } from "../../../types/chat";
import { BnNoteEditor } from "../../../components/blockNote/bnNoteEditor";
import { NoteProps } from "../../../types/notes";
import { sendUpdatedNote } from "../services/sendUpdatedNote";
import { useAuth } from "../../../context/AuthContext";
import { getCurrentTimestamp } from "../../../utils/dateUtils";

type NoteMainProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    teamMembers: UserProps[];
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    noteType: number;
    setNoteType: (value: number) => void;
    currentNote: NoteProps | null;
    setCurrentNote: (value: NoteProps) => void;
    setOpeningService: (service: number) => void;
    setCurrentChat: (chat: ChatProps) => void;
};

export const NoteMain = (props: NoteMainProps) => {
    const {
        teamMemberProfiles,
        socket,
        teamMembers,
        myself,
        setMyself,
        currentNote,
        setCurrentNote,
        setOpeningService,
        setCurrentChat,
        noteType,
        setNoteType,
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

    const [noteTitle, setNoteTitle] = useState<string>("");
    const [noteUpdated, setNoteUpdated] = useState(false);
    const [startIntervalUpdatingNote, setStartIntervalUpdatingNote] = useState(false);
    const [noteBodyEdited, setNoteBodyEdited] = useState(false);
    const [noteBodySaved, setNoteBodySaved] = useState(false);
    const [body, setBody] = useState<PartialBlock[]>();
    const [tsBody, setTsBody] = useState<string>(getCurrentTimestamp());

    // Send updated note to the backend when note is updated
    const updateNote = async () => {
        if (currentNote) {
            const newNote: NoteProps = {
                ...currentNote,
                title: noteTitle,
                body: body || [],
            };

            await sendUpdatedNote(myself, newNote, accessToken);
            setStartIntervalUpdatingNote(false);
            setNoteBodyEdited(false);
            setNoteBodySaved(true);
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
    const [tabContents, setTabContents] = useState<NoteProps[]>(currentNote ? [currentNote] : []);
    const [selectedTabIndex, setSelectedTabIndex] = useState(0);
    const [isUpdatingTabContents, setIsUpdatingTabContents] = useState(true);

    useEffect(() => {
        if (currentNote) {
            setBody(currentNote.body);
            setTsBody(getCurrentTimestamp()); // This must be executed together with "setBody" !!!!
            setNoteTitle(currentNote.title);

            if (
                isUpdatingTabContents === true &&
                (tabContents.length === 0 ||
                    (tabContents.length > 0 &&
                        tabContents.some((note) => note.noteId === currentNote.noteId)) === false)
            ) {
                // Add the clicked note to the tab.
                setTabContents((prev) => [...prev, currentNote]);
                // Also, update the index to the clicked note.
                setSelectedTabIndex(tabContents.length); // switch to new tab
            } else {
                // Update the index when an user click a note in the sidebar
                setSelectedTabIndex(
                    tabContents.findIndex((note) => note.noteId === currentNote.noteId)
                );
            }

            setIsUpdatingTabContents(true);
        }
    }, [currentNote]);

    const handleCloseTab = (closedNoteId: number) => {
        if (tabContents.length > 1) {
            setTabContents((prev) => prev.filter((t) => t.noteId !== closedNoteId));
            if (selectedTabIndex >= tabContents.length - 1) {
                setSelectedTabIndex(tabContents.length - 2); // fallback to previous tab
            } else {
                setIsUpdatingTabContents(false);
            }
        }
    };

    useEffect(() => {
        if (isUpdatingTabContents === false) {
            setCurrentNote(tabContents[selectedTabIndex]);
        }
    }, [isUpdatingTabContents]);

    useEffect(() => {
        setCurrentNote(tabContents[selectedTabIndex]);
    }, [selectedTabIndex]);

    return (
        <Stack direction={"column"} sx={{ width: "100%" }}>
            {noteType === 0 && (
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
                    {noteType !== 0 && (
                        <Stack direction={"column"} sx={{ width: "100%" }}>
                            <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{ width: "100%" }}
                            >
                                <Menu
                                    ref={breadcrumbsRef}
                                    anchorEl={anchorEl}
                                    open={Boolean(anchorEl)}
                                    onClose={handleClose}
                                    aria-labelledby="with-menu-demo-breadcrumbs"
                                >
                                    <MenuItem onClick={handleClose}>Breadcrumb 2</MenuItem>
                                    <MenuItem onClick={handleClose}>Breadcrumb 3</MenuItem>
                                    <MenuItem onClick={handleClose}>Breadcrumb 4</MenuItem>
                                </Menu>
                                <Breadcrumbs separator="›" aria-label="breadcrumbs">
                                    <Link color="primary" href="#condensed-with-menu">
                                        <PlayArrowIcon />
                                        Breadcrumb 1
                                    </Link>
                                    <Button
                                        size="sm"
                                        onClick={handleClick}
                                        variant="plain"
                                        color="primary"
                                    >
                                        •••
                                    </Button>
                                    <Link color="primary" href="#condensed-with-menu">
                                        Breadcrumb 5
                                    </Link>
                                    <Link color="primary" href="#condensed-with-menu">
                                        Breadcrumb 6
                                    </Link>
                                </Breadcrumbs>

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
                                        <MenuItem onClick={() => {}}>
                                            <AddIcon />
                                            New Note (TBD)
                                        </MenuItem>
                                        <MenuItem
                                            onClick={() => {}}
                                            sx={{
                                                color: "red",
                                                fontWeight: "bold",
                                            }}
                                        >
                                            <DeleteIcon sx={{ color: "red" }} />
                                            Delete Note (TBD)
                                        </MenuItem>
                                    </Menu>
                                </Dropdown>
                            </Stack>

                            <Tabs
                                key={`tabs-${tabContents.length}`}
                                value={selectedTabIndex}
                                onChange={(_, val) => {
                                    // console.log("move tab to:", val);
                                    setCurrentNote(tabContents[Number(val)]);
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
                                    {tabContents.map((tab, index) => (
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
                                                <IconButton
                                                    component="span"
                                                    size="sm"
                                                    variant="plain"
                                                    color="neutral"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCloseTab(Number(tab.noteId));
                                                    }}
                                                    sx={{ ml: 1 }}
                                                >
                                                    <CloseIcon />
                                                </IconButton>
                                            </Box>
                                        </Tab>
                                    ))}
                                </TabList>

                                {tabContents.map((tabNote, index) => (
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
                                                mt: "5px",
                                                ml: "5px",
                                                justifyContent: "center",
                                                position: "absolute",
                                                zIndex: 10100,
                                            }}
                                        >
                                            <Input
                                                startDecorator={<NoteAltIcon />}
                                                key={"noteTitle"}
                                                variant="soft"
                                                placeholder="Note Title"
                                                value={noteTitle}
                                                onChange={(e) => {
                                                    setNoteTitle(e.target.value);
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
                                                    mt: "8px",
                                                    ml: "330px",
                                                    zIndex: 10100,
                                                }}
                                            >
                                                <Button
                                                    variant="outlined"
                                                    color="neutral"
                                                    size="sm"
                                                    startDecorator={
                                                        <CheckIcon sx={{ fontSize: "15px" }} />
                                                    }
                                                >
                                                    Saved
                                                </Button>
                                            </Box>
                                        )}
                                        <BnNoteEditor
                                            teamMemberProfiles={teamMemberProfiles}
                                            myself={myself}
                                            setMyself={setMyself}
                                            noteType={noteType}
                                            socket={socket}
                                            teamMembers={teamMembers}
                                            body={body}
                                            setBody={setBody}
                                            setNoteBodyEdited={setNoteBodyEdited}
                                            setNoteBodySaved={setNoteBodySaved}
                                            setCurrentChat={setCurrentChat}
                                            setOpeningService={setOpeningService}
                                        />
                                    </TabPanel>
                                ))}
                            </Tabs>
                        </Stack>
                    )}
                </>
            )}
        </Stack>
    );
};
