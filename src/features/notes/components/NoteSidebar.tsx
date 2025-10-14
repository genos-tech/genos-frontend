import AddIcon from "@mui/icons-material/Add";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import HomeIcon from "@mui/icons-material/Home";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import ShareIcon from "@mui/icons-material/Share";
import WindowIcon from "@mui/icons-material/Window";
import {
    Box,
    Divider,
    GlobalStyles,
    List,
    ListItem,
    ListItemContent,
    Sheet,
    Typography,
} from "@mui/joy";
import ListItemButton, { listItemButtonClasses } from "@mui/joy/ListItemButton";
import { useEffect, useState } from "react";

import { NoteManagementState } from "../../../hooks/notes/useNoteManagement";
import {
    ChatNoteMetaTreeNode,
    MyNoteMetaTreeNode,
    TaskNoteMetaTreeNode,
} from "../../../types/notes";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { NoteTreeToggler } from "./sub/NoteTreeToggler";

type NoteSidebarProps = {
    NM: NoteManagementState;
};
export const NoteSidebar = (props: NoteSidebarProps) => {
    const { NM } = props;

    function areObjectsEqual(objA: object, objB: object): boolean {
        return JSON.stringify(objA) === JSON.stringify(objB);
    }

    //////////////////////////
    // My Note related
    //////////////////////////
    const [tmpCurrentMyNoteChain, setTmpCurrentMyNoteChain] = useState<MyNoteMetaTreeNode[]>();
    const [tmpMyNoteMetaTree, setTmpMyNoteMetaTree] = useState<MyNoteMetaTreeNode[]>(
        NM.myNoteMetaTree
    );
    useEffect(() => {
        if (NM.currentMyNoteChain && NM.currentMyNoteChain.length > 0) {
            setTmpCurrentMyNoteChain(NM.currentMyNoteChain);
        } else {
            setTmpCurrentMyNoteChain([]);
        }
    }, [NM.currentMyNoteChain]);

    // Only when `myNoteMetaTree` has been updated with new contents, refresh the Note Chain.
    // `myNoteMetaTree` has been always updated without any contents change. Is such case,
    // no need to refresh it since it's the same as the tmp one.
    const [tsMyNoteTreeUpdated, setTsMyNoteTreeUpdated] = useState<string>(
        getLocalCurrentTimestamp()
    );
    useEffect(() => {
        if (areObjectsEqual(tmpMyNoteMetaTree, NM.myNoteMetaTree) === false) {
            setTmpMyNoteMetaTree(NM.myNoteMetaTree);
            // Set the timestamp for the key, but also with the index.
            setTsMyNoteTreeUpdated(String(NM.selectedTabIndex) + getLocalCurrentTimestamp());
        }
    }, [NM.myNoteMetaTree]);

    useEffect(() => {
        // Update only the index prefix of the timestamp variable.
        // Even if the `myNoteMetaTree` isn't updated, we want to re-render the sidebar tree.
        // The index prefix can achieve the re-rendering.
        setTsMyNoteTreeUpdated(String(NM.selectedTabIndex) + tsMyNoteTreeUpdated.slice(1));
    }, [NM.selectedTabIndex]);

    useEffect(() => {
        // Init timestamp after 1sec which needs to re-render the tree on the sidebar.
        setTimeout(() => {
            setTsMyNoteTreeUpdated(String(NM.selectedTabIndex) + getLocalCurrentTimestamp());
        }, 1000); // wait Xms
    }, []);

    // When `currentMyNote` is changed, refresh the Note Chain.
    useEffect(() => {
        setTmpMyNoteMetaTree(NM.myNoteMetaTree);
    }, [NM.currentMyNote]);

    const renderMyNoteTree = (node: MyNoteMetaTreeNode) => (
        <Box key={`my-note-box-${node.noteId}-${tsMyNoteTreeUpdated}`}>
            {tmpCurrentMyNoteChain && NM.currentMyNoteChain && (
                <ListItem key={`my-note-${node.noteId}-${tsMyNoteTreeUpdated}`} nested>
                    <NoteTreeToggler
                        // Expanding toggle when the target note is in the tab.
                        defaultExpanded={
                            tmpCurrentMyNoteChain.some(
                                (chainedNote) => chainedNote.noteId === node.noteId
                            ) ||
                            NM.tabItems.some((tabNote) =>
                                NM.allNoteIdChains[`${tabNote.noteType}-${tabNote.noteId}`]?.some(
                                    (chainedNoteId: number) => chainedNoteId === node.noteId
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
        NM.taskNoteMetaTree
    );
    useEffect(() => {
        if (NM.currentTaskNoteChain && NM.currentTaskNoteChain.length > 0) {
            setTmpCurrentTaskNoteChain(NM.currentTaskNoteChain);
        } else {
            setTmpCurrentTaskNoteChain([]);
        }
    }, [NM.currentTaskNoteChain]);

    // Only when `taskNoteMetaTree` has been updated with new contents, refresh the Note Chain.
    // `taskNoteMetaTree` has been always updated without any contents change. Is such case,
    // no need to refresh it since it's the same as the tmp one.
    const [tsTaskNoteTreeUpdated, setTsTaskNoteTreeUpdated] = useState<string>(
        getLocalCurrentTimestamp()
    );
    useEffect(() => {
        if (areObjectsEqual(tmpTaskNoteMetaTree, NM.taskNoteMetaTree) === false) {
            setTmpTaskNoteMetaTree(NM.taskNoteMetaTree);
            // Set the timestamp for the key, but also with the index.
            setTsTaskNoteTreeUpdated(String(NM.selectedTabIndex) + getLocalCurrentTimestamp());
        }
    }, [NM.taskNoteMetaTree]);

    useEffect(() => {
        // Update only the index prefix of the timestamp variable.
        // Even if the `taskNoteMetaTree` isn't updated, we want to re-render the sidebar tree.
        // The index prefix can achieve the re-rendering.
        setTsTaskNoteTreeUpdated(String(NM.selectedTabIndex) + tsTaskNoteTreeUpdated.slice(1));
    }, [NM.selectedTabIndex]);

    useEffect(() => {
        // Init timestamp after 1sec which needs to re-render the tree on the sidebar.
        setTimeout(() => {
            setTsTaskNoteTreeUpdated(String(NM.selectedTabIndex) + getLocalCurrentTimestamp());
        }, 1000); // wait Xms
    }, []);

    // When `currentTaskNote` is changed, refresh the Note Chain.
    useEffect(() => {
        setTmpTaskNoteMetaTree(NM.taskNoteMetaTree);
    }, [NM.currentTaskNote]);

    const renderTaskNoteTree = (node: TaskNoteMetaTreeNode) => (
        <Box key={`task-note-box-${node.noteId}-${tsTaskNoteTreeUpdated}`}>
            {tmpCurrentTaskNoteChain && (
                <ListItem key={`task-note-${node.noteId}-${tsTaskNoteTreeUpdated}`} nested>
                    <NoteTreeToggler
                        // Expanding toggle when the target note is in the tab.
                        defaultExpanded={
                            tmpCurrentTaskNoteChain.some(
                                (chainedNote) => chainedNote.noteId === node.noteId
                            ) ||
                            NM.tabItems.some((tabNote) =>
                                NM.allNoteIdChains[`${tabNote.noteType}-${tabNote.noteId}`]?.some(
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
        NM.chatNoteMetaTree
    );
    useEffect(() => {
        if (NM.currentChatNoteChain && NM.currentChatNoteChain.length > 0) {
            setTmpCurrentChatNoteChain(NM.currentChatNoteChain);
        } else {
            setTmpCurrentChatNoteChain([]);
        }
    }, [NM.currentChatNoteChain]);

    // Only when `chatNoteMetaTree` has been updated with new contents, refresh the Note Chain.
    // `chatNoteMetaTree` has been always updated without any contents change. Is such case,
    // no need to refresh it since it's the same as the tmp one.
    const [tsChatNoteTreeUpdated, setTsChatNoteTreeUpdated] = useState<string>(
        getLocalCurrentTimestamp()
    );
    useEffect(() => {
        if (areObjectsEqual(tmpChatNoteMetaTree, NM.chatNoteMetaTree) === false) {
            setTmpChatNoteMetaTree(NM.chatNoteMetaTree);
            // Set the timestamp for the key, but also with the index.
            setTsChatNoteTreeUpdated(String(NM.selectedTabIndex) + getLocalCurrentTimestamp());
        }
    }, [NM.chatNoteMetaTree]);

    useEffect(() => {
        // Update only the index prefix of the timestamp variable.
        // Even if the `chatNoteMetaTree` isn't updated, we want to re-render the sidebar tree.
        // The index prefix can achieve the re-rendering.
        setTsChatNoteTreeUpdated(String(NM.selectedTabIndex) + tsChatNoteTreeUpdated.slice(1));
    }, [NM.selectedTabIndex]);

    useEffect(() => {
        // Init timestamp after 1sec which needs to re-render the tree on the sidebar.
        setTimeout(() => {
            setTsChatNoteTreeUpdated(String(NM.selectedTabIndex) + getLocalCurrentTimestamp());
        }, 1000); // wait Xms
    }, []);

    // When `currentChatNote` is changed, refresh the Note Chain.
    useEffect(() => {
        setTmpChatNoteMetaTree(NM.chatNoteMetaTree);
    }, [NM.currentChatNote]);

    const renderChatNoteTree = (node: ChatNoteMetaTreeNode) => (
        <Box key={`chat-note-box-${node.noteId}-${tsChatNoteTreeUpdated}`}>
            {tmpCurrentChatNoteChain && (
                <ListItem key={`chat-note-${node.noteId}-${tsChatNoteTreeUpdated}`} nested>
                    <NoteTreeToggler
                        // Expanding toggle when the target note is in the tab.
                        defaultExpanded={
                            tmpCurrentChatNoteChain.some(
                                (chainedNote) => chainedNote.noteId === node.noteId
                            ) ||
                            NM.tabItems.some((tabNote) =>
                                NM.allNoteIdChains[`${tabNote.noteType}-${tabNote.noteId}`]?.some(
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
                <ListItem key={`my-note-${node.noteId}-${tsMyNoteTreeUpdated}`} nested>
                    <ListItemButton
                        sx={{ my: "1px" }}
                        variant="plain"
                        onClick={() => {
                            if (node.noteType === 1) {
                                NM.handleCreateNewMyNote(node.noteId);
                            } else if (node.noteType === 2) {
                                NM.handleCreateNewTaskNote(
                                    node.noteId,
                                    node.projectId,
                                    node.taskId
                                );
                            } else if (node.noteType === 3) {
                                NM.handleCreateNewChatNote(
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
            color="primary"
            selected={NM.currentNoteType === noteType ? true : false}
            variant="outlined"
            onClick={() => {
                setOpen(!open);
                NM.setCurrentNoteType(noteType);
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
                    sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
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
            sx={{ my: "1px" }}
            variant="plain"
            selected={
                NM.currentNoteType === noteType &&
                node.noteId ===
                    (noteType === 1
                        ? NM.currentMyNote?.noteId
                        : noteType === 2
                          ? NM.currentTaskNote?.noteId
                          : noteType === 3
                            ? NM.currentChatNote?.noteId
                            : noteType === 4
                              ? 0 // TODO: This is for shared notes.
                              : 0)
                    ? true
                    : false
            }
        >
            <ListItemContent
                onClick={() => {
                    setOpen(!open);
                    NM.setCurrentNoteType(noteType);
                    localStorage.setItem("lastOpenNoteType", String(noteType));
                    NM.loadNote(noteType, node.noteId, -1);
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
                sx={[
                    open
                        ? {
                              transform: "rotate(180deg)",
                          }
                        : {
                              transform: "none",
                          },
                ]}
                onClick={() => {
                    setOpen(!open);
                }}
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
                            selected={NM.currentNoteType === 0 ? true : false}
                            onClick={() => {
                                NM.setCurrentNoteType(0);
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
                                {NM.taskNoteMetaTree.map((root) => renderTaskNoteTree(root))}
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
                                {NM.chatNoteMetaTree.map((root) => renderChatNoteTree(root))}
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
