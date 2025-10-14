import { PartialBlock } from "@blocknote/core";
import AddIcon from "@mui/icons-material/Add";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVert from "@mui/icons-material/MoreVert";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
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

import { BnChatNoteEditor } from "../../../components/blockNote/bnChatNoteEditor";
import { AvatarWithStatus } from "../../../components/common/avatarWithStatus";
import { GMAvatar } from "../../../components/common/GMAvatar";
import { ProjectAvatar } from "../../../components/common/ProjectAvatar";
import { useAuth } from "../../../context/AuthContext";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { NoteManagementState } from "../../../hooks/notes/useNoteManagement";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps } from "../../../types/chat";
import { ChatNoteProps } from "../../../types/notes";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { ModalDeleteChatNote } from "../modals/ModalDeleteChatNote";
import { addNote } from "../services/addNote";
import { sendUpdatedChatNote } from "../services/sendUpdatedChatNote";
import { ACChatChildNotes } from "./autocompletes/ACChatChildNotes";

type ChatNoteMainProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    teamMembers: UserProps[];
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    setOpeningService: (service: number) => void;
    isInChatPage: boolean;
    setCurrentPreviewTaskId: (id: number) => void;
    setCurrentProject: (project: any) => void;
    NM: NoteManagementState;
    CM: ChatManagementState;
};

export const ChatNoteMain = (props: ChatNoteMainProps) => {
    const {
        teamMemberProfiles,
        socket,
        teamMembers,
        myself,
        setMyself,
        setOpeningService,
        isInChatPage,
        setCurrentPreviewTaskId,
        setCurrentProject,
        NM,
        CM,
    } = props;

    const { accessToken } = useAuth();

    const [noteUpdated, setNoteUpdated] = useState(false);
    const [startIntervalUpdatingNote, setStartIntervalUpdatingNote] = useState(false);
    const [currentChatNoteTitle, setCurrentChatNoteTitle] = useState<string>(
        NM.currentChatNote?.title || ""
    );
    const [noteBodyEdited, setNoteBodyEdited] = useState(false);
    const [noteBodySaved, setNoteBodySaved] = useState(false);
    const [body, setBody] = useState<PartialBlock[]>();
    const [tsBody, setTsBody] = useState<string>(getLocalCurrentTimestamp());
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
        if (NM.currentChatNote) {
            let newNoteTitle = currentChatNoteTitle;

            // If the note title is empty, use the note original title.
            // (not updating the title to empty)
            if (currentChatNoteTitle === "") {
                newNoteTitle = NM.currentChatNote.title;
                setCurrentChatNoteTitle(newNoteTitle);
            }

            const newNote: ChatNoteProps = {
                ...NM.currentChatNote,
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
            NM.setTabItems(
                NM.tabItems.map((item) =>
                    item.noteType === NM.currentChatNote?.noteType &&
                    item.noteId === NM.currentChatNote?.noteId
                        ? newNote
                        : item
                )
            );

            // This needs to update the note title in the sidebar.
            NM.setChatNoteMeta(
                NM.chatNoteMeta.map((item) =>
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
        if (NM.currentChatNote) {
            setBody(NM.currentChatNote.body);
            setTsBody(getLocalCurrentTimestamp());
            setCurrentChatNoteTitle(NM.currentChatNote.title);
        }
    }, [NM.currentChatNote]);

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

    useEffect(() => {
        setNoteBodySaved(false);
    }, [NM.selectedTabIndex]);

    const chat = CM.allChats.find(
        (chat) =>
            chat.chatType === NM.currentChatNote?.chatType &&
            NM.currentChatNote &&
            chat.chatId === NM.currentChatNote.chatId
    );

    return (
        <>
            {(NM.tabItems.length === 0 || NM.currentChatNote === null) && (
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
                            padding: "10px",
                        }}
                    >
                        No Chat Selected
                    </IconButton>
                </Box>
            )}

            {!(NM.tabItems.length === 0 || NM.currentChatNote === null) &&
                NM.chatNoteMeta.length > 0 && (
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
                                                mt: isInChatPage === true ? "0px" : "10px",
                                                mb: "5px",
                                            }}
                                        >
                                            {isInChatPage === true && NM.currentChatNote && (
                                                <Box
                                                    sx={{
                                                        ml: "5px",
                                                        mb: "10px",
                                                        width: "40%",
                                                    }}
                                                >
                                                    <ACChatChildNotes
                                                        myself={myself}
                                                        noteId={NM.currentChatNote.noteId}
                                                        openSearchBox={openSearchBox}
                                                        setCurrentChatNote={NM.setCurrentChatNote}
                                                        setOpenSearchBox={setOpenSearchBox}
                                                    />
                                                </Box>
                                            )}
                                            {isInChatPage === false && (
                                                <>
                                                    <Breadcrumbs
                                                        aria-label="breadcrumbs"
                                                        separator="›"
                                                    >
                                                        <IconButton
                                                            color="warning"
                                                            component="button"
                                                            variant="soft"
                                                            sx={{
                                                                fontSize: "14px",
                                                            }}
                                                        >
                                                            <QuestionAnswerRoundedIcon
                                                                sx={{ fontSize: "20px" }}
                                                            />
                                                            Chat Notes
                                                        </IconButton>
                                                        {NM.currentChatNoteChain &&
                                                            NM.currentChatNoteChain.map((node) => (
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
                                                                        NM.loadNote(
                                                                            3,
                                                                            node.noteId,
                                                                            -1
                                                                        );
                                                                    }}
                                                                >
                                                                    {node.title.length > 14
                                                                        ? `${node.title.slice(0, 14)}...`
                                                                        : node.title}
                                                                </Typography>
                                                            ))}
                                                    </Breadcrumbs>
                                                </>
                                            )}

                                            <Stack direction={"row"}>
                                                {chat && chat.chatType === 1 && (
                                                    <Box sx={{ mt: "2px", mr: "5px" }}>
                                                        <AvatarWithStatus
                                                            chat={chat}
                                                            isYou={false}
                                                            myself={myself}
                                                            setMyself={setMyself}
                                                            setOpeningService={setOpeningService}
                                                            socket={socket}
                                                            avatarUser={
                                                                teamMemberProfiles[
                                                                    chat.dmPartnerUser.userId
                                                                ]
                                                            }
                                                            setCurrentMainChat={
                                                                CM.setCurrentMainChat
                                                            }
                                                        />
                                                    </Box>
                                                )}
                                                {chat && chat.chatType === 2 && (
                                                    <Box sx={{ mt: "2px", mr: "5px" }}>
                                                        <GMAvatar
                                                            funcSetAllChats={CM.funcSetAllChats}
                                                            gmChat={chat}
                                                            isYou={false}
                                                            myself={myself}
                                                            setMyself={setMyself}
                                                            setOpeningService={setOpeningService}
                                                            socket={socket}
                                                            teamMemberProfiles={teamMemberProfiles}
                                                            setCurrentMainChat={
                                                                CM.setCurrentMainChat
                                                            }
                                                        />
                                                    </Box>
                                                )}
                                                {chat && chat.chatType === 3 && (
                                                    <Box sx={{ mt: "2px", mr: "5px" }}>
                                                        <ProjectAvatar
                                                            funcSetAllChats={CM.funcSetAllChats}
                                                            myself={myself}
                                                            pmChat={chat}
                                                            setMyself={setMyself}
                                                            setOpeningService={setOpeningService}
                                                            socket={socket}
                                                            teamMemberProfiles={teamMemberProfiles}
                                                            setCurrentMainChat={
                                                                CM.setCurrentMainChat
                                                            }
                                                        />
                                                    </Box>
                                                )}

                                                {isInChatPage && NM.currentChatNote && (
                                                    <IconButton
                                                        color="neutral"
                                                        component="button"
                                                        variant="plain"
                                                        sx={{
                                                            fontSize: "14px",
                                                            paddingRight: "10px",
                                                            height: "5px",
                                                        }}
                                                        onClick={() => {
                                                            NM.handleCreateNewChatNote(
                                                                NM.currentChatNote?.noteId || null,
                                                                NM.currentChatNote?.chatType || 0,
                                                                NM.currentChatNote?.chatId || 0,
                                                                NM.currentChatNote?.isThread ||
                                                                    false,
                                                                NM.currentChatNote?.threadId || 0
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
                                                            color="neutral"
                                                            size="sm"
                                                            sx={{ mb: "5px" }}
                                                            variant="plain"
                                                            onClick={() => {
                                                                setOpeningService(3);
                                                            }}
                                                        >
                                                            <OpenInNewIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

                                                {isInChatPage === false && (
                                                    <Tooltip title="Open Related Chat">
                                                        <IconButton
                                                            color="neutral"
                                                            size="sm"
                                                            sx={{ mb: "5px" }}
                                                            variant="plain"
                                                            onClick={() => {
                                                                CM.moveToSpecificChat(
                                                                    NM.currentChatNote?.chatType ||
                                                                        0,
                                                                    NM.currentChatNote?.chatId ||
                                                                        0,
                                                                    NM.currentChatNote?.threadId ||
                                                                        0,
                                                                    true, // openTaskNoteInChat
                                                                    false, // openThreadTaskPreview
                                                                    setOpeningService,
                                                                    setCurrentPreviewTaskId,
                                                                    setCurrentProject
                                                                );
                                                            }}
                                                        >
                                                            <QuestionAnswerIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

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
                                                                if (NM.currentChatNote) {
                                                                    NM.handleCreateNewChatNote(
                                                                        NM.currentChatNote.noteId,
                                                                        NM.currentChatNote
                                                                            .chatType,
                                                                        NM.currentChatNote.chatId,
                                                                        NM.currentChatNote
                                                                            .isThread,
                                                                        NM.currentChatNote.threadId
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

                                                {isInChatPage === true && (
                                                    <Tooltip title="Close Notes">
                                                        <IconButton
                                                            color="neutral"
                                                            size="sm"
                                                            sx={{ mb: "5px" }}
                                                            variant="plain"
                                                            onClick={() => {
                                                                CM.setIsChatNoteVisibleInChat(
                                                                    false
                                                                );

                                                                // Open main chat pane
                                                                if (CM.setIsMainChatVisible) {
                                                                    CM.setIsMainChatVisible(true);
                                                                }
                                                            }}
                                                        >
                                                            <CancelIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

                                                {NM.currentChatNote && (
                                                    <ModalDeleteChatNote
                                                        chatNoteMeta={NM.chatNoteMeta}
                                                        currentChatNote={NM.currentChatNote}
                                                        currentTabIndex={NM.selectedTabIndex}
                                                        handleCloseTab={handleCloseTab}
                                                        myself={myself}
                                                        openDeleteNote={openDeleteNote}
                                                        setChatNoteMeta={NM.setChatNoteMeta}
                                                        setOpenDeleteNote={setOpenDeleteNote}
                                                    />
                                                )}
                                            </Stack>

                                            {NM.currentChatNote && (
                                                <ModalDeleteChatNote
                                                    chatNoteMeta={NM.chatNoteMeta}
                                                    currentChatNote={NM.currentChatNote}
                                                    currentTabIndex={NM.selectedTabIndex}
                                                    handleCloseTab={handleCloseTab}
                                                    myself={myself}
                                                    openDeleteNote={openDeleteNote}
                                                    setChatNoteMeta={NM.setChatNoteMeta}
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
                                                            key={"currentChatNoteTitle"}
                                                            placeholder="Note Title"
                                                            startDecorator={<NoteAltIcon />}
                                                            value={currentChatNoteTitle}
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
                                                                setCurrentChatNoteTitle(
                                                                    e.target.value
                                                                );
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
                                                    {NM.currentChatNote && (
                                                        <>
                                                            <BnChatNoteEditor
                                                                body={body}
                                                                myself={myself}
                                                                setBody={setBody}
                                                                setMyself={setMyself}
                                                                setNoteBodySaved={setNoteBodySaved}
                                                                socket={socket}
                                                                teamMembers={teamMembers}
                                                                currentChatNote={
                                                                    NM.currentChatNote
                                                                }
                                                                setCurrentChat={
                                                                    CM.setCurrentMainChat
                                                                }
                                                                setNoteBodyEdited={
                                                                    setNoteBodyEdited
                                                                }
                                                                setOpeningService={
                                                                    setOpeningService
                                                                }
                                                                teamMemberProfiles={
                                                                    teamMemberProfiles
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
