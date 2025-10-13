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

import {
    ChatNoteMetaTreeNode,
    MyNoteMetaTreeNode,
    TaskNoteMetaTreeNode,
} from "../../../types/notes";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { NoteTreeToggler } from "./sub/NoteTreeToggler";
import { NoteManagementState } from "../../../hooks/useNoteManagement";

type NoteSidebarProps = {
    noteManagement: NoteManagementState;
};
export const NoteSidebar = (props: NoteSidebarProps) => {
    const { noteManagement } = props;

    function areObjectsEqual(objA: object, objB: object): boolean {
        return JSON.stringify(objA) === JSON.stringify(objB);
    }

    //////////////////////////
    // My Note related
    //////////////////////////
    const [tmpCurrentMyNoteChain, setTmpCurrentMyNoteChain] = useState<MyNoteMetaTreeNode[]>();
    const [tmpMyNoteMetaTree, setTmpMyNoteMetaTree] = useState<MyNoteMetaTreeNode[]>(
        noteManagement.myNoteMetaTree
    );
    useEffect(() => {
        if (noteManagement.currentMyNoteChain && noteManagement.currentMyNoteChain.length > 0) {
            setTmpCurrentMyNoteChain(noteManagement.currentMyNoteChain);
        } else {
            setTmpCurrentMyNoteChain([]);
        }
    }, [noteManagement.currentMyNoteChain]);

    // Only when `myNoteMetaTree` has been updated with new contents, refresh the Note Chain.
    // `myNoteMetaTree` has been always updated without any contents change. Is such case,
    // no need to refresh it since it's the same as the tmp one.
    const [tsMyNoteTreeUpdated, setTsMyNoteTreeUpdated] = useState<string>(
        getLocalCurrentTimestamp()
    );
    useEffect(() => {
        if (areObjectsEqual(tmpMyNoteMetaTree, noteManagement.myNoteMetaTree) === false) {
            setTmpMyNoteMetaTree(noteManagement.myNoteMetaTree);
            // Set the timestamp for the key, but also with the index.
            setTsMyNoteTreeUpdated(
                String(noteManagement.selectedTabIndex) + getLocalCurrentTimestamp()
            );
        }
    }, [noteManagement.myNoteMetaTree]);

    useEffect(() => {
        // Update only the index prefix of the timestamp variable.
        // Even if the `myNoteMetaTree` isn't updated, we want to re-render the sidebar tree.
        // The index prefix can achieve the re-rendering.
        setTsMyNoteTreeUpdated(
            String(noteManagement.selectedTabIndex) + tsMyNoteTreeUpdated.slice(1)
        );
    }, [noteManagement.selectedTabIndex]);

    useEffect(() => {
        // Init timestamp after 1sec which needs to re-render the tree on the sidebar.
        setTimeout(() => {
            setTsMyNoteTreeUpdated(
                String(noteManagement.selectedTabIndex) + getLocalCurrentTimestamp()
            );
        }, 1000); // wait Xms
    }, []);

    // When `currentMyNote` is changed, refresh the Note Chain.
    useEffect(() => {
        setTmpMyNoteMetaTree(noteManagement.myNoteMetaTree);
    }, [noteManagement.currentMyNote]);

    const renderMyNoteTree = (node: MyNoteMetaTreeNode) => (
        <Box key={`my-note-box-${node.noteId}-${tsMyNoteTreeUpdated}`}>
            {tmpCurrentMyNoteChain && noteManagement.currentMyNoteChain && (
                <ListItem nested key={`my-note-${node.noteId}-${tsMyNoteTreeUpdated}`}>
                    <NoteTreeToggler
                        // Expanding toggle when the target note is in the tab.
                        defaultExpanded={
                            tmpCurrentMyNoteChain.some(
                                (chainedNote) => chainedNote.noteId === node.noteId
                            ) ||
                            noteManagement.tabItems.some((tabNote) =>
                                noteManagement.allNoteIdChains[
                                    `${tabNote.noteType}-${tabNote.noteId}`
                                ]?.some((chainedNoteId: number) => chainedNoteId === node.noteId)
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
                        {node.children.length === 0 && createChildNoteList(node)}
                    </NoteTreeToggler>
                </ListItem>
            )}
        </Box>
    );

    //////////////////////////
    // Task Note related
    //////////////////////////
    const [tmpCurrentTaskNoteChain, setTmpCurrentTaskNoteChain] =
        useState<TaskNoteMetaTreeNode[]>();
    const [tmpTaskNoteMetaTree, setTmpTaskNoteMetaTree] = useState<TaskNoteMetaTreeNode[]>(
        noteManagement.taskNoteMetaTree
    );
    useEffect(() => {
        if (
            noteManagement.currentTaskNoteChain &&
            noteManagement.currentTaskNoteChain.length > 0
        ) {
            setTmpCurrentTaskNoteChain(noteManagement.currentTaskNoteChain);
        } else {
            setTmpCurrentTaskNoteChain([]);
        }
    }, [noteManagement.currentTaskNoteChain]);

    // Only when `taskNoteMetaTree` has been updated with new contents, refresh the Note Chain.
    // `taskNoteMetaTree` has been always updated without any contents change. Is such case,
    // no need to refresh it since it's the same as the tmp one.
    const [tsTaskNoteTreeUpdated, setTsTaskNoteTreeUpdated] = useState<string>(
        getLocalCurrentTimestamp()
    );
    useEffect(() => {
        if (areObjectsEqual(tmpTaskNoteMetaTree, noteManagement.taskNoteMetaTree) === false) {
            setTmpTaskNoteMetaTree(noteManagement.taskNoteMetaTree);
            // Set the timestamp for the key, but also with the index.
            setTsTaskNoteTreeUpdated(
                String(noteManagement.selectedTabIndex) + getLocalCurrentTimestamp()
            );
        }
    }, [noteManagement.taskNoteMetaTree]);

    useEffect(() => {
        // Update only the index prefix of the timestamp variable.
        // Even if the `taskNoteMetaTree` isn't updated, we want to re-render the sidebar tree.
        // The index prefix can achieve the re-rendering.
        setTsTaskNoteTreeUpdated(
            String(noteManagement.selectedTabIndex) + tsTaskNoteTreeUpdated.slice(1)
        );
    }, [noteManagement.selectedTabIndex]);

    useEffect(() => {
        // Init timestamp after 1sec which needs to re-render the tree on the sidebar.
        setTimeout(() => {
            setTsTaskNoteTreeUpdated(
                String(noteManagement.selectedTabIndex) + getLocalCurrentTimestamp()
            );
        }, 1000); // wait Xms
    }, []);

    // When `currentTaskNote` is changed, refresh the Note Chain.
    useEffect(() => {
        setTmpTaskNoteMetaTree(noteManagement.taskNoteMetaTree);
    }, [noteManagement.currentTaskNote]);

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
                            noteManagement.tabItems.some((tabNote) =>
                                noteManagement.allNoteIdChains[
                                    `${tabNote.noteType}-${tabNote.noteId}`
                                ]?.some((chainedNoteId) => chainedNoteId === node.noteId)
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
                        {node.children.length === 0 && createChildNoteList(node)}
                    </NoteTreeToggler>
                </ListItem>
            )}
        </Box>
    );

    //////////////////////////
    // Chat Note related
    //////////////////////////
    const [tmpCurrentChatNoteChain, setTmpCurrentChatNoteChain] =
        useState<ChatNoteMetaTreeNode[]>();
    const [tmpChatNoteMetaTree, setTmpChatNoteMetaTree] = useState<ChatNoteMetaTreeNode[]>(
        noteManagement.chatNoteMetaTree
    );
    useEffect(() => {
        if (
            noteManagement.currentChatNoteChain &&
            noteManagement.currentChatNoteChain.length > 0
        ) {
            setTmpCurrentChatNoteChain(noteManagement.currentChatNoteChain);
        } else {
            setTmpCurrentChatNoteChain([]);
        }
    }, [noteManagement.currentChatNoteChain]);

    // Only when `chatNoteMetaTree` has been updated with new contents, refresh the Note Chain.
    // `chatNoteMetaTree` has been always updated without any contents change. Is such case,
    // no need to refresh it since it's the same as the tmp one.
    const [tsChatNoteTreeUpdated, setTsChatNoteTreeUpdated] = useState<string>(
        getLocalCurrentTimestamp()
    );
    useEffect(() => {
        if (areObjectsEqual(tmpChatNoteMetaTree, noteManagement.chatNoteMetaTree) === false) {
            setTmpChatNoteMetaTree(noteManagement.chatNoteMetaTree);
            // Set the timestamp for the key, but also with the index.
            setTsChatNoteTreeUpdated(
                String(noteManagement.selectedTabIndex) + getLocalCurrentTimestamp()
            );
        }
    }, [noteManagement.chatNoteMetaTree]);

    useEffect(() => {
        // Update only the index prefix of the timestamp variable.
        // Even if the `chatNoteMetaTree` isn't updated, we want to re-render the sidebar tree.
        // The index prefix can achieve the re-rendering.
        setTsChatNoteTreeUpdated(
            String(noteManagement.selectedTabIndex) + tsChatNoteTreeUpdated.slice(1)
        );
    }, [noteManagement.selectedTabIndex]);

    useEffect(() => {
        // Init timestamp after 1sec which needs to re-render the tree on the sidebar.
        setTimeout(() => {
            setTsChatNoteTreeUpdated(
                String(noteManagement.selectedTabIndex) + getLocalCurrentTimestamp()
            );
        }, 1000); // wait Xms
    }, []);

    // When `currentChatNote` is changed, refresh the Note Chain.
    useEffect(() => {
        setTmpChatNoteMetaTree(noteManagement.chatNoteMetaTree);
    }, [noteManagement.currentChatNote]);

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
                            noteManagement.tabItems.some((tabNote) =>
                                noteManagement.allNoteIdChains[
                                    `${tabNote.noteType}-${tabNote.noteId}`
                                ]?.some((chainedNoteId) => chainedNoteId === node.noteId)
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
                        {node.children.length === 0 && createChildNoteList(node)}
                    </NoteTreeToggler>
                </ListItem>
            )}
        </Box>
    );

    //////////////////////////
    // Common
    //////////////////////////
    const createChildNoteList = (node: any) => (
        <List>
            <Box key={`my-note-box-${node.noteId}-${tsMyNoteTreeUpdated}`}>
                <ListItem nested key={`my-note-${node.noteId}-${tsMyNoteTreeUpdated}`}>
                    <ListItemButton
                        variant="plain"
                        sx={{ my: "1px" }}
                        onClick={() => {
                            if (node.noteType === 1) {
                                noteManagement.handleCreateNewMyNote(node.noteId);
                            } else if (node.noteType === 2) {
                                noteManagement.handleCreateNewTaskNote(
                                    node.noteId,
                                    node.projectId,
                                    node.taskId
                                );
                            } else if (node.noteType === 3) {
                                noteManagement.handleCreateNewChatNote(
                                    node.noteId,
                                    node.chatType,
                                    node.chatId,
                                    node.isThread,
                                    node.threadId
                                );
                            }
                        }}
                    >
                        <ListItemContent>
                            <Typography level="title-sm" startDecorator={<AddIcon />}>
                                Child Note
                            </Typography>
                        </ListItemContent>
                    </ListItemButton>
                </ListItem>
            </Box>
        </List>
    );

    const outerRenderToggleListItemButton = (
        taskTypeName: string,
        open: boolean,
        setOpen: (value: boolean) => void,
        noteType: number
    ) => (
        <ListItemButton
            selected={noteManagement.currentNoteType === noteType ? true : false}
            variant="outlined"
            color="primary"
            onClick={() => {
                setOpen(!open);
                noteManagement.setCurrentNoteType(noteType);
                localStorage.setItem("lastOpenNoteType", String(noteType));
            }}
        >
            {noteType === 1 && <WindowIcon />}
            {noteType === 2 && <AssignmentRoundedIcon />}
            {noteType === 3 && <QuestionAnswerRoundedIcon />}
            {noteType === 4 && <ShareIcon />}
            <ListItemContent>
                <Typography
                    level="title-sm"
                    sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                    {taskTypeName}
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

    const innerRenderToggleListItemButton = (
        open: boolean,
        setOpen: (value: boolean) => void,
        noteType: number,
        node: any
    ) => (
        <ListItemButton
            selected={
                noteManagement.currentNoteType === noteType &&
                node.noteId ===
                    (noteType === 1
                        ? noteManagement.currentMyNote?.noteId
                        : noteType === 2
                        ? noteManagement.currentTaskNote?.noteId
                        : noteType === 3
                        ? noteManagement.currentChatNote?.noteId
                        : noteType === 4
                        ? 0 // TODO: This is for shared notes.
                        : 0)
                    ? true
                    : false
            }
            variant="plain"
            sx={{ my: "1px" }}
        >
            <ListItemContent
                onClick={() => {
                    setOpen(!open);
                    noteManagement.setCurrentNoteType(noteType);
                    localStorage.setItem("lastOpenNoteType", String(noteType));
                    noteManagement.loadNote(noteType, node.noteId, -1);
                }}
            >
                <Typography
                    level="title-sm"
                    sx={{
                        ml: "20px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {node.title}
                </Typography>
            </ListItemContent>
            <KeyboardArrowDownIcon
                onClick={() => {
                    setOpen(!open);
                }}
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
                            selected={noteManagement.currentNoteType === 0 ? true : false}
                            onClick={() => {
                                noteManagement.setCurrentNoteType(0);
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
                            defaultExpanded={false}
                            renderToggle={({ open, setOpen }) =>
                                outerRenderToggleListItemButton("My Notes", open, setOpen, 1)
                            }
                        >
                            <List>{tmpMyNoteMetaTree.map((root) => renderMyNoteTree(root))}</List>
                        </NoteTreeToggler>
                    </ListItem>

                    <ListItem nested>
                        <NoteTreeToggler
                            defaultExpanded={false}
                            renderToggle={({ open, setOpen }) =>
                                outerRenderToggleListItemButton("Task Notes", open, setOpen, 2)
                            }
                        >
                            <List>
                                {noteManagement.taskNoteMetaTree.map((root) =>
                                    renderTaskNoteTree(root)
                                )}
                            </List>
                        </NoteTreeToggler>
                    </ListItem>

                    <ListItem nested>
                        <NoteTreeToggler
                            defaultExpanded={false}
                            renderToggle={({ open, setOpen }) =>
                                outerRenderToggleListItemButton("Chat Notes", open, setOpen, 3)
                            }
                        >
                            <List>
                                {noteManagement.chatNoteMetaTree.map((root) =>
                                    renderChatNoteTree(root)
                                )}
                            </List>
                        </NoteTreeToggler>
                    </ListItem>

                    <ListItem nested>
                        <NoteTreeToggler
                            defaultExpanded={false}
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
