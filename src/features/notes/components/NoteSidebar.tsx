import { useState, useEffect } from "react";
import {
    GlobalStyles,
    Box,
    Divider,
    List,
    ListItem,
    ListItemContent,
    Typography,
    Sheet,
} from "@mui/joy";
import ListItemButton, { listItemButtonClasses } from "@mui/joy/ListItemButton";
import HomeIcon from "@mui/icons-material/Home";
import WindowIcon from "@mui/icons-material/Window";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import AddIcon from "@mui/icons-material/Add";
import ShareIcon from "@mui/icons-material/Share";

import { useAuth } from "../../../context/AuthContext";
import { UserProps } from "../../../types/admin";
import {
    ChatNoteMetaTreeNode,
    ChatNoteProps,
    MyNoteMetaTreeNode,
    MyNoteProps,
    TaskNoteMetaTreeNode,
    TaskNoteProps,
} from "../../../types/notes";
import { loadSpecificNote } from "../services/loadSpecificNote";
import { addNote } from "../services/addNote";
import { getData } from "../../../db/crud";
import { STORES } from "../../../db/conf";
import { getCurrentTimestamp } from "../../../utils/dateUtils";
import { NoteTreeToggler } from "./sub/NoteTreeToggler";

type NoteSidebarProps = {
    myself: UserProps;
    currentNoteType: number;
    setCurrentNoteType: (value: number) => void;
    myNoteMetaTree: MyNoteMetaTreeNode[];
    currentMyNote: MyNoteProps | null;
    setCurrentMyNote: (value: MyNoteProps) => void;
    currentTaskNote: TaskNoteProps | null;
    setCurrentTaskNote: (value: TaskNoteProps) => void;
    currentChatNote: ChatNoteProps | null;
    setCurrentChatNote: (value: ChatNoteProps) => void;
    handleCreateNewMyNote: (parentNoteId: number | null) => Promise<void>;
    handleCreateNewTaskNote: (
        parentNoteId: number | null,
        projectId: number,
        taskId: number
    ) => Promise<void>;
    handleCreateNewChatNote: (
        parentNoteId: number | null,
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number
    ) => Promise<void>;
    currentMyNoteChain?: MyNoteMetaTreeNode[];
    taskNoteMetaTree: TaskNoteMetaTreeNode[];
    currentTaskNoteChain?: TaskNoteMetaTreeNode[];
    chatNoteMetaTree: ChatNoteMetaTreeNode[];
    tabItems: any[];
    currentChatNoteChain?: ChatNoteMetaTreeNode[];
    allNoteIdChains: Record<string, number[]>;
    selectedTabIndex: number;
    setSelectedTabIndex: (value: number) => void;
};
export const NoteSidebar = (props: NoteSidebarProps) => {
    const {
        myself,
        currentNoteType,
        setCurrentNoteType,
        myNoteMetaTree,
        currentMyNote,
        setCurrentMyNote,
        currentTaskNote,
        setCurrentTaskNote,
        currentChatNote,
        setCurrentChatNote,
        handleCreateNewMyNote,
        handleCreateNewTaskNote,
        handleCreateNewChatNote,
        currentMyNoteChain,
        taskNoteMetaTree,
        currentTaskNoteChain,
        chatNoteMetaTree,
        tabItems,
        currentChatNoteChain,
        allNoteIdChains,
        selectedTabIndex,
        setSelectedTabIndex,
    } = props;
    const { accessToken } = useAuth();

    function areObjectsEqual(objA: object, objB: object): boolean {
        return JSON.stringify(objA) === JSON.stringify(objB);
    }

    //////////////////////////
    // My Note related
    //////////////////////////
    const [tmpCurrentMyNoteChain, setTmpCurrentMyNoteChain] = useState<MyNoteMetaTreeNode[]>();
    const [tmpMyNoteMetaTree, setTmpMyNoteMetaTree] =
        useState<MyNoteMetaTreeNode[]>(myNoteMetaTree);
    useEffect(() => {
        if (currentMyNoteChain && currentMyNoteChain.length > 0) {
            setTmpCurrentMyNoteChain(currentMyNoteChain);
        } else {
            setTmpCurrentMyNoteChain([]);
        }
    }, [currentMyNoteChain]);

    // Only when `myNoteMetaTree` has been updated with new contents, refresh the Note Chain.
    // `myNoteMetaTree` has been always updated without any contents change. Is such case,
    // no need to refresh it since it's the same as the tmp one.
    const [tsMyNoteTreeUpdated, setTsMyNoteTreeUpdated] = useState<string>(getCurrentTimestamp());
    useEffect(() => {
        if (areObjectsEqual(tmpMyNoteMetaTree, myNoteMetaTree) === false) {
            setTmpMyNoteMetaTree(myNoteMetaTree);
            // Set the timestamp for the key, but also with the index.
            setTsMyNoteTreeUpdated(String(selectedTabIndex) + getCurrentTimestamp());
        }
    }, [myNoteMetaTree]);

    useEffect(() => {
        // Update only the index prefix of the timestamp variable.
        // Even if the `myNoteMetaTree` isn't updated, we want to re-render the sidebar tree.
        // The index prefix can achieve the re-rendering.
        setTsMyNoteTreeUpdated(String(selectedTabIndex) + tsMyNoteTreeUpdated.slice(1));
    }, [selectedTabIndex]);

    useEffect(() => {
        // Init timestamp after 1sec which needs to re-render the tree on the sidebar.
        setTimeout(() => {
            setTsMyNoteTreeUpdated(String(selectedTabIndex) + getCurrentTimestamp());
        }, 1000); // wait Xms
    }, []);

    // When `currentMyNote` is changed, refresh the Note Chain.
    useEffect(() => {
        setTmpMyNoteMetaTree(myNoteMetaTree);
    }, [currentMyNote]);

    //////////////////////////
    // Task Note related
    //////////////////////////
    const [tmpCurrentTaskNoteChain, setTmpCurrentTaskNoteChain] =
        useState<TaskNoteMetaTreeNode[]>();
    const [tmpTaskNoteMetaTree, setTmpTaskNoteMetaTree] =
        useState<TaskNoteMetaTreeNode[]>(taskNoteMetaTree);
    useEffect(() => {
        if (currentTaskNoteChain && currentTaskNoteChain.length > 0) {
            setTmpCurrentTaskNoteChain(currentTaskNoteChain);
        } else {
            setTmpCurrentTaskNoteChain([]);
        }
    }, [currentTaskNoteChain]);

    // Only when `taskNoteMetaTree` has been updated with new contents, refresh the Note Chain.
    // `taskNoteMetaTree` has been always updated without any contents change. Is such case,
    // no need to refresh it since it's the same as the tmp one.
    const [tsTaskNoteTreeUpdated, setTsTaskNoteTreeUpdated] = useState<string>(
        getCurrentTimestamp()
    );
    useEffect(() => {
        if (areObjectsEqual(tmpTaskNoteMetaTree, taskNoteMetaTree) === false) {
            setTmpTaskNoteMetaTree(taskNoteMetaTree);
            // Set the timestamp for the key, but also with the index.
            setTsTaskNoteTreeUpdated(String(selectedTabIndex) + getCurrentTimestamp());
        }
    }, [taskNoteMetaTree]);

    useEffect(() => {
        // Update only the index prefix of the timestamp variable.
        // Even if the `taskNoteMetaTree` isn't updated, we want to re-render the sidebar tree.
        // The index prefix can achieve the re-rendering.
        setTsTaskNoteTreeUpdated(String(selectedTabIndex) + tsTaskNoteTreeUpdated.slice(1));
    }, [selectedTabIndex]);

    useEffect(() => {
        // Init timestamp after 1sec which needs to re-render the tree on the sidebar.
        setTimeout(() => {
            setTsTaskNoteTreeUpdated(String(selectedTabIndex) + getCurrentTimestamp());
        }, 1000); // wait Xms
    }, []);

    // When `currentTaskNote` is changed, refresh the Note Chain.
    useEffect(() => {
        setTmpTaskNoteMetaTree(taskNoteMetaTree);
    }, [currentTaskNote]);

    //////////////////////////
    // Chat Note related
    //////////////////////////
    const [tmpCurrentChatNoteChain, setTmpCurrentChatNoteChain] =
        useState<ChatNoteMetaTreeNode[]>();
    const [tmpChatNoteMetaTree, setTmpChatNoteMetaTree] =
        useState<ChatNoteMetaTreeNode[]>(chatNoteMetaTree);
    useEffect(() => {
        if (currentChatNoteChain && currentChatNoteChain.length > 0) {
            setTmpCurrentChatNoteChain(currentChatNoteChain);
        } else {
            setTmpCurrentChatNoteChain([]);
        }
    }, [currentChatNoteChain]);

    // Only when `chatNoteMetaTree` has been updated with new contents, refresh the Note Chain.
    // `chatNoteMetaTree` has been always updated without any contents change. Is such case,
    // no need to refresh it since it's the same as the tmp one.
    const [tsChatNoteTreeUpdated, setTsChatNoteTreeUpdated] = useState<string>(
        getCurrentTimestamp()
    );
    useEffect(() => {
        if (areObjectsEqual(tmpChatNoteMetaTree, chatNoteMetaTree) === false) {
            setTmpChatNoteMetaTree(chatNoteMetaTree);
            // Set the timestamp for the key, but also with the index.
            setTsChatNoteTreeUpdated(String(selectedTabIndex) + getCurrentTimestamp());
        }
    }, [chatNoteMetaTree]);

    useEffect(() => {
        // Update only the index prefix of the timestamp variable.
        // Even if the `chatNoteMetaTree` isn't updated, we want to re-render the sidebar tree.
        // The index prefix can achieve the re-rendering.
        setTsChatNoteTreeUpdated(String(selectedTabIndex) + tsChatNoteTreeUpdated.slice(1));
    }, [selectedTabIndex]);

    useEffect(() => {
        // Init timestamp after 1sec which needs to re-render the tree on the sidebar.
        setTimeout(() => {
            setTsChatNoteTreeUpdated(String(selectedTabIndex) + getCurrentTimestamp());
        }, 1000); // wait Xms
    }, []);

    // When `currentChatNote` is changed, refresh the Note Chain.
    useEffect(() => {
        setTmpChatNoteMetaTree(chatNoteMetaTree);
    }, [currentChatNote]);

    const LoadNote = async (noteType: number, noteId: number) => {
        if (noteType === 1) {
            const note = await getData({ storeName: STORES.PERSONAL_NOTES, key: noteId });
            if (note) {
                if (note.noteType === 1) {
                    setCurrentMyNote(note);
                }
            } else {
                const note: MyNoteProps = await loadSpecificNote(myself, 1, noteId, accessToken);
                if (!note.error && note.noteType === 1) {
                    addNote(1, note);
                    setCurrentMyNote(note);
                }
            }
        } else if (noteType === 2) {
            const note = await getData({ storeName: STORES.TASK_NOTES, key: noteId });
            if (note) {
                if (note.noteType === 2) {
                    setCurrentTaskNote(note);
                }
            } else {
                const note: TaskNoteProps = await loadSpecificNote(myself, 2, noteId, accessToken);
                if (!note.error && note.noteType === 2) {
                    addNote(2, note);
                    setCurrentTaskNote(note);
                }
            }
        } else if (noteType === 3) {
            const note = await getData({ storeName: STORES.CHAT_NOTES, key: noteId });
            if (note) {
                if (note.noteType === 3) {
                    setCurrentChatNote(note);
                }
            } else {
                const note: ChatNoteProps = await loadSpecificNote(myself, 3, noteId, accessToken);
                if (!note.error && note.noteType === 3) {
                    addNote(3, note);
                    setCurrentChatNote(note);
                }
            }
        }
    };

    const outerRenderToggleListItemButton = (
        typo: string,
        open: boolean,
        setOpen: (value: boolean) => void,
        noteType: number
    ) => (
        <ListItemButton
            selected={currentNoteType === noteType ? true : false}
            variant="outlined"
            color="primary"
            onClick={() => {
                setOpen(!open);
                setCurrentNoteType(noteType);
                localStorage.setItem("lastOpenNoteType", String(noteType));
            }}
        >
            {noteType === 1 && <WindowIcon />}
            {noteType === 2 && <AssignmentRoundedIcon />}
            {noteType === 3 && <QuestionAnswerRoundedIcon />}
            {noteType === 4 && <ShareIcon />}
            <ListItemContent>
                <Typography level="title-sm">{typo}</Typography>
            </ListItemContent>
            <KeyboardArrowDownIcon
                sx={[
                    open
                        ? {
                              transform: "rotate(180deg)",
                          }
                        : {
                              transform: "none",
                          },
                ]}
            />
        </ListItemButton>
    );

    const innerRenderToggleListItemButton = (
        open: boolean,
        setOpen: (value: boolean) => void,
        noteType: number,
        node: any
    ) => (
        <ListItemButton
            selected={
                currentNoteType === noteType &&
                node.noteId ===
                    (noteType === 1
                        ? currentMyNote?.noteId
                        : noteType === 2
                        ? currentTaskNote?.noteId
                        : noteType === 3
                        ? currentChatNote?.noteId
                        : noteType === 4
                        ? 0 // TODO: This is for shared notes.
                        : 0)
                    ? true
                    : false
            }
            variant="plain"
            sx={{ my: "1px" }}
            onClick={() => {
                setOpen(!open);
                setCurrentNoteType(noteType);
                localStorage.setItem("lastOpenNoteType", String(noteType));

                // Check if the note is in the tab already.
                // If yes, move to the tab. If not, load the note and move.
                const targetTabIndex: number = tabItems.findIndex(
                    (note) => note.noteType === node.noteType && note.noteId === node.noteId
                );
                if (targetTabIndex === -1) {
                    LoadNote(noteType, node.noteId);
                } else {
                    setSelectedTabIndex(targetTabIndex);
                }
            }}
        >
            <ListItemContent>
                <Typography level="title-sm" sx={{ ml: "20px" }}>
                    {node.title}
                </Typography>
            </ListItemContent>
            <KeyboardArrowDownIcon
                sx={[
                    open
                        ? {
                              transform: "rotate(180deg)",
                          }
                        : {
                              transform: "none",
                          },
                ]}
            />
        </ListItemButton>
    );

    const renderMyNoteTree = (node: MyNoteMetaTreeNode) => (
        <Box key={`my-note-box-${node.noteId}-${tsMyNoteTreeUpdated}`}>
            {tmpCurrentMyNoteChain && (
                <ListItem nested key={`my-note-${node.noteId}-${tsMyNoteTreeUpdated}`}>
                    <NoteTreeToggler
                        // Expanding toggle when the target note is in the tab.
                        defaultExpanded={
                            tmpCurrentMyNoteChain.some(
                                (chainedNote) => chainedNote.noteId === node.noteId
                            ) ||
                            tabItems.some((tabNote) =>
                                allNoteIdChains[`${tabNote.noteType}-${tabNote.noteId}`]?.some(
                                    (chainedNoteId) => chainedNoteId === node.noteId
                                )
                            )
                                ? true
                                : false
                        }
                        renderToggle={({ open, setOpen }) =>
                            innerRenderToggleListItemButton(open, setOpen, 1, node)
                        }
                    >
                        {node.children.length > 0 && tmpCurrentMyNoteChain && (
                            <List>{node.children.map((child) => renderMyNoteTree(child))}</List>
                        )}

                        {node.children.length === 0 && (
                            <Typography
                                level="title-sm"
                                component="button"
                                onClick={() => {
                                    handleCreateNewMyNote(node.noteId);
                                }}
                                sx={{
                                    ml: "25px",
                                    background: "none",
                                    border: "none",
                                    padding: 0,
                                    cursor: "pointer",
                                    color: "inherit", // keeps normal text color
                                    textAlign: "left",
                                }}
                                startDecorator={<AddIcon />}
                            >
                                Child Note
                            </Typography>
                        )}
                    </NoteTreeToggler>
                </ListItem>
            )}
        </Box>
    );

    const renderTaskNoteTree = (node: TaskNoteMetaTreeNode) => (
        <Box key={`task-note-box-${node.noteId}-${tsTaskNoteTreeUpdated}`}>
            {tmpCurrentTaskNoteChain && (
                <ListItem nested key={`task-note-${node.noteId}-${tsTaskNoteTreeUpdated}`}>
                    <NoteTreeToggler
                        // Expanding toggle when the target note is in the tab.
                        defaultExpanded={
                            tmpCurrentTaskNoteChain.some(
                                (chainedNote) => chainedNote.noteId === node.noteId
                            ) ||
                            tabItems.some((tabNote) =>
                                allNoteIdChains[`${tabNote.noteType}-${tabNote.noteId}`]?.some(
                                    (chainedNoteId) => chainedNoteId === node.noteId
                                )
                            )
                                ? true
                                : false
                        }
                        renderToggle={({ open, setOpen }) =>
                            innerRenderToggleListItemButton(open, setOpen, 2, node)
                        }
                    >
                        {node.children.length > 0 && tmpCurrentTaskNoteChain && (
                            <List>{node.children.map((child) => renderTaskNoteTree(child))}</List>
                        )}

                        {node.children.length === 0 && (
                            <Typography
                                level="title-sm"
                                component="button"
                                onClick={() => {
                                    handleCreateNewTaskNote(
                                        node.noteId,
                                        node.projectId,
                                        node.taskId
                                    );
                                }}
                                sx={{
                                    ml: "25px",
                                    background: "none",
                                    border: "none",
                                    padding: 0,
                                    cursor: "pointer",
                                    color: "inherit", // keeps normal text color
                                    textAlign: "left",
                                }}
                                startDecorator={<AddIcon />}
                            >
                                Child Note
                            </Typography>
                        )}
                    </NoteTreeToggler>
                </ListItem>
            )}
        </Box>
    );

    const renderChatNoteTree = (node: ChatNoteMetaTreeNode) => (
        <Box key={`chat-note-box-${node.noteId}-${tsChatNoteTreeUpdated}`}>
            {tmpCurrentChatNoteChain && (
                <ListItem nested key={`chat-note-${node.noteId}-${tsChatNoteTreeUpdated}`}>
                    <NoteTreeToggler
                        // Expanding toggle when the target note is in the tab.
                        defaultExpanded={
                            tmpCurrentChatNoteChain.some(
                                (chainedNote) => chainedNote.noteId === node.noteId
                            ) ||
                            tabItems.some((tabNote) =>
                                allNoteIdChains[`${tabNote.noteType}-${tabNote.noteId}`]?.some(
                                    (chainedNoteId) => chainedNoteId === node.noteId
                                )
                            )
                                ? true
                                : false
                        }
                        renderToggle={({ open, setOpen }) =>
                            innerRenderToggleListItemButton(open, setOpen, 3, node)
                        }
                    >
                        {node.children.length > 0 && tmpCurrentChatNoteChain && (
                            <List>{node.children.map((child) => renderChatNoteTree(child))}</List>
                        )}

                        {node.children.length === 0 && (
                            <Typography
                                level="title-sm"
                                component="button"
                                onClick={() => {
                                    handleCreateNewChatNote(
                                        node.noteId,
                                        node.chatType,
                                        node.chatId,
                                        node.isThread,
                                        node.threadId
                                    );
                                }}
                                sx={{
                                    ml: "25px",
                                    background: "none",
                                    border: "none",
                                    padding: 0,
                                    cursor: "pointer",
                                    color: "inherit", // keeps normal text color
                                    textAlign: "left",
                                }}
                                startDecorator={<AddIcon />}
                            >
                                Child Note
                            </Typography>
                        )}
                    </NoteTreeToggler>
                </ListItem>
            )}
        </Box>
    );
    return (
        <Sheet
            className="TaskSidebar"
            sx={{
                position: { xs: "fixed", md: "sticky" },
                transform: {
                    xs: "translateX(calc(100% * (var(--SideNavigation-slideIn, 0) - 1)))",
                    md: "none",
                },
                transition: "transform 0.4s, width 0.4s",
                height: "100dvh",
                width: "100%",
                top: 0,
                p: 2,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                borderRight: "1px solid",
                borderColor: "divider",
            }}
        >
            <GlobalStyles
                styles={(theme) => ({
                    ":root": {
                        "--TaskSidebar-width": "220px",
                        [theme.breakpoints.up("lg")]: {
                            "--TaskSidebar-width": "240px",
                        },
                    },
                })}
            />

            <Box
                sx={{
                    minHeight: 0,
                    overflow: "hidden auto",
                    flexGrow: 1,
                    display: "flex",
                    flexDirection: "column",
                    [`& .${listItemButtonClasses.root}`]: {
                        gap: 1.5,
                    },
                }}
            >
                <List
                    size="sm"
                    sx={{
                        gap: 1,
                        "--List-nestedInsetStart": "30px",
                        "--ListItem-radius": (theme) => theme.vars.radius.sm,
                    }}
                >
                    <ListItem>
                        <ListItemButton
                            selected={currentNoteType === 0 ? true : false}
                            onClick={() => {
                                setCurrentNoteType(0);
                                localStorage.setItem("lastOpenNoteType", "0");
                            }}
                        >
                            <HomeIcon />
                            <ListItemContent>
                                <Typography level="title-sm">Home</Typography>
                            </ListItemContent>
                        </ListItemButton>
                    </ListItem>

                    <ListItem nested>
                        <NoteTreeToggler
                            defaultExpanded={true}
                            renderToggle={({ open, setOpen }) =>
                                outerRenderToggleListItemButton("My Notes", open, setOpen, 1)
                            }
                        >
                            <List>{tmpMyNoteMetaTree.map((root) => renderMyNoteTree(root))}</List>
                        </NoteTreeToggler>
                    </ListItem>

                    <ListItem nested>
                        <NoteTreeToggler
                            defaultExpanded={true}
                            renderToggle={({ open, setOpen }) =>
                                outerRenderToggleListItemButton("Task Notes", open, setOpen, 2)
                            }
                        >
                            <List>{taskNoteMetaTree.map((root) => renderTaskNoteTree(root))}</List>
                        </NoteTreeToggler>
                    </ListItem>

                    <ListItem nested>
                        <NoteTreeToggler
                            defaultExpanded={true}
                            renderToggle={({ open, setOpen }) =>
                                outerRenderToggleListItemButton("Chat Notes", open, setOpen, 3)
                            }
                        >
                            <List>{chatNoteMetaTree.map((root) => renderChatNoteTree(root))}</List>
                        </NoteTreeToggler>
                    </ListItem>

                    <ListItem nested>
                        <NoteTreeToggler
                            defaultExpanded={true}
                            renderToggle={({ open, setOpen }) =>
                                outerRenderToggleListItemButton(
                                    "Shared Notes (TBD)",
                                    open,
                                    setOpen,
                                    4
                                )
                            }
                        >
                            <ListItemContent>
                                <Typography level="title-sm"></Typography>
                            </ListItemContent>
                        </NoteTreeToggler>
                    </ListItem>
                </List>
            </Box>
            <Divider />
        </Sheet>
    );
};
