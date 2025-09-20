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
} from "@mui/joy";
import { PartialBlock } from "@blocknote/core";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

import { UserProps } from "../../../types/admin";
import { ChatProps } from "../../../types/chat";
import { BnNoteEditor } from "../../../components/blockNote/bnNoteEditor";
import { NoteProps } from "../../../types/notes";
import { sendUpdatedNote } from "../services/sendUpdatedNote";
import { useAuth } from "../../../context/AuthContext";

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
    useEffect(() => {
        if (currentNote) {
            setBody(currentNote.body);
            setNoteTitle(currentNote.title);
        }
    }, [currentNote]);

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
                            <Breadcrumbs aria-label="breadcrumbs">
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

                            <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{ width: "100%" }}
                            >
                                <FormControl required sx={{ width: "30%" }}>
                                    <Input
                                        startDecorator={<NoteAltIcon />}
                                        key={"taskTitle"}
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
                                            width: "100%",
                                            fontSize: "20px",
                                            fontWeight: "bold",
                                            backgroundColor: "transparent",
                                        }}
                                    />
                                </FormControl>

                                <Tooltip title="Create a new my note" size="sm">
                                    <IconButton
                                        component="button"
                                        size="sm"
                                        variant="plain"
                                        color="neutral"
                                        onClick={() => {}}
                                        sx={{ px: "10px" }}
                                    >
                                        <PlaylistAddIcon />
                                        New Note
                                    </IconButton>
                                </Tooltip>
                            </Stack>

                            <Box>
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
                            </Box>
                        </Stack>
                    )}
                </>
            )}
        </Stack>
    );
};
