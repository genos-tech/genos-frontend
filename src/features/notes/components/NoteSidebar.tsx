import * as React from "react";
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

function Toggler({
    defaultExpanded,
    renderToggle,
    children,
}: {
    defaultExpanded: boolean;
    children: React.ReactNode;
    renderToggle: (params: {
        open: boolean;
        setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    }) => React.ReactNode;
}) {
    const [open, setOpen] = React.useState(defaultExpanded);
    return (
        <React.Fragment>
            {renderToggle({ open, setOpen })}
            <Box
                sx={[
                    {
                        display: "grid",
                        transition: "0.2s ease",
                        "& > *": {
                            overflow: "hidden",
                        },
                    },
                    open ? { gridTemplateRows: "1fr" } : { gridTemplateRows: "0fr" },
                ]}
            >
                {children}
            </Box>
        </React.Fragment>
    );
}

type NoteSidebarProps = {
    myself: UserProps;
    currentNoteType: number;
    setCurrentNoteType: (value: number) => void;
    myNoteMetaTree: MyNoteMetaTreeNode[];
    currentMyNote: MyNoteProps | null;
    setCurrentMyNote: (value: MyNoteProps) => void;
    handleCreateNewMyNote: (parentNoteId: number | null) => Promise<void>;
    currentMyNoteChain?: MyNoteMetaTreeNode[];
    taskNoteMetaTree: TaskNoteMetaTreeNode[];
    currentTaskNote: TaskNoteProps | null;
    setCurrentTaskNote: (value: TaskNoteProps) => void;
    currentTaskNoteChain?: TaskNoteMetaTreeNode[];
    chatNoteMetaTree: ChatNoteMetaTreeNode[];
    currentChatNote: ChatNoteProps | null;
    setCurrentChatNote: (value: ChatNoteProps) => void;
    tabNotes: any[];
    currentChatNoteChain?: ChatNoteMetaTreeNode[];
    allNoteIdChains: Record<number, number[]>;
};
export const NoteSidebar = (props: NoteSidebarProps) => {
    const {
        myself,
        currentNoteType,
        setCurrentNoteType,
        myNoteMetaTree,
        currentMyNote,
        setCurrentMyNote,
        handleCreateNewMyNote,
        currentMyNoteChain,
        taskNoteMetaTree,
        currentTaskNote,
        setCurrentTaskNote,
        currentTaskNoteChain,
        chatNoteMetaTree,
        currentChatNote,
        setCurrentChatNote,
        tabNotes,
        currentChatNoteChain,
        allNoteIdChains,
    } = props;
    const { accessToken } = useAuth();

    const [tsMyNoteChainUpdated, setTsMyNoteChainUpdated] = useState<string>(
        getCurrentTimestamp()
    );
    const [tmpCurrentMyNoteChain, setTmpCurrentMyNoteChain] = useState<MyNoteMetaTreeNode[]>();
    useEffect(() => {
        if (currentMyNoteChain) {
            setTmpCurrentMyNoteChain(currentMyNoteChain);
            setTsMyNoteChainUpdated(getCurrentTimestamp());
        }
    }, [currentMyNoteChain]);

    const [tsTaskNoteChainUpdated, setTsTaskNoteChainUpdated] = useState<string>(
        getCurrentTimestamp()
    );
    const [tmpCurrentTaskNoteChain, setTmpCurrentTaskNoteChain] =
        useState<TaskNoteMetaTreeNode[]>();
    useEffect(() => {
        if (currentTaskNoteChain) {
            setTmpCurrentTaskNoteChain(currentTaskNoteChain);
            setTsTaskNoteChainUpdated(getCurrentTimestamp());
        }
    }, [currentTaskNoteChain]);

    const [tsChatNoteChainUpdated, setTsChatNoteChainUpdated] = useState<string>(
        getCurrentTimestamp()
    );
    const [tmpCurrentChatNoteChain, setTmpCurrentChatNoteChain] =
        useState<ChatNoteMetaTreeNode[]>();
    useEffect(() => {
        if (currentChatNoteChain) {
            setTmpCurrentChatNoteChain(currentChatNoteChain);
            setTsChatNoteChainUpdated(getCurrentTimestamp());
        }
    }, [currentChatNoteChain]);

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

    const renderMyNoteTree = (node: MyNoteMetaTreeNode) => (
        <Box key={`my-note-box-${node.noteId}-${tsMyNoteChainUpdated}`}>
            {tmpCurrentMyNoteChain && (
                <ListItem nested key={`my-note-${node.noteId}-${tsMyNoteChainUpdated}`}>
                    <Toggler
                        // Expanding toggle when the target note is in the tab.
                        defaultExpanded={
                            tmpCurrentMyNoteChain.some(
                                (chainedNote) => chainedNote.noteId === node.noteId
                            ) ||
                            tabNotes.some((tabNote) =>
                                allNoteIdChains[tabNote.noteId]?.some(
                                    (chainedNoteId) => chainedNoteId === node.noteId
                                )
                            )
                                ? true
                                : false
                        }
                        renderToggle={({ open, setOpen }) => (
                            <ListItemButton
                                selected={
                                    currentNoteType === 1 && node.noteId === currentMyNote?.noteId
                                        ? true
                                        : false
                                }
                                variant="plain"
                                sx={{ my: "1px" }}
                                onClick={() => {
                                    setOpen(!open);
                                    setCurrentNoteType(1);
                                    localStorage.setItem("currentNoteType", "1");
                                    LoadNote(1, node.noteId);
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
                        )}
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
                    </Toggler>
                </ListItem>
            )}
        </Box>
    );

    const renderTaskNoteTree = (node: TaskNoteMetaTreeNode) => (
        <Box key={`task-note-box-${node.noteId}-${tsTaskNoteChainUpdated}`}>
            {tmpCurrentTaskNoteChain && (
                <ListItem nested key={`task-note-${node.noteId}-${tsTaskNoteChainUpdated}`}>
                    <Toggler
                        // Expanding toggle when the target note is in the tab.
                        defaultExpanded={
                            tmpCurrentTaskNoteChain.some(
                                (chainedNote) => chainedNote.noteId === node.noteId
                            ) ||
                            tabNotes.some((tabNote) =>
                                allNoteIdChains[tabNote.noteId]?.some(
                                    (chainedNoteId) => chainedNoteId === node.noteId
                                )
                            )
                                ? true
                                : false
                        }
                        renderToggle={({ open, setOpen }) => (
                            <ListItemButton
                                selected={
                                    currentNoteType === 2 &&
                                    node.noteId === currentTaskNote?.noteId
                                        ? true
                                        : false
                                }
                                variant="plain"
                                sx={{ my: "1px" }}
                                onClick={() => {
                                    setOpen(!open);
                                    setCurrentNoteType(2);
                                    localStorage.setItem("currentNoteType", "2");
                                    LoadNote(2, node.noteId);
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
                        )}
                    >
                        {node.children.length > 0 && (
                            <List>{node.children.map((child) => renderTaskNoteTree(child))}</List>
                        )}
                    </Toggler>
                </ListItem>
            )}
        </Box>
    );

    const renderChatNoteTree = (node: ChatNoteMetaTreeNode) => (
        <Box key={`chat-note-box-${node.noteId}-${tsChatNoteChainUpdated}`}>
            {tmpCurrentChatNoteChain && (
                <ListItem nested key={`chat-note-${node.noteId}-${tsChatNoteChainUpdated}`}>
                    <Toggler
                        // Expanding toggle when the target note is in the tab.
                        defaultExpanded={
                            tmpCurrentChatNoteChain.some(
                                (chainedNote) => chainedNote.noteId === node.noteId
                            ) ||
                            tabNotes.some((tabNote) =>
                                allNoteIdChains[tabNote.noteId]?.some(
                                    (chainedNoteId) => chainedNoteId === node.noteId
                                )
                            )
                                ? true
                                : false
                        }
                        renderToggle={({ open, setOpen }) => (
                            <ListItemButton
                                selected={
                                    currentNoteType === 3 &&
                                    node.noteId === currentChatNote?.noteId
                                        ? true
                                        : false
                                }
                                variant="plain"
                                sx={{ my: "1px" }}
                                onClick={() => {
                                    setOpen(!open);
                                    setCurrentNoteType(3);
                                    localStorage.setItem("currentNoteType", "3");
                                    LoadNote(3, node.noteId);
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
                        )}
                    >
                        {node.children.length > 0 && (
                            <List>{node.children.map((child) => renderChatNoteTree(child))}</List>
                        )}
                    </Toggler>
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
                                localStorage.setItem("currentNoteType", "0");
                            }}
                        >
                            <HomeIcon />
                            <ListItemContent>
                                <Typography level="title-sm">Home</Typography>
                            </ListItemContent>
                        </ListItemButton>
                    </ListItem>

                    <ListItem nested>
                        <Toggler
                            defaultExpanded={true}
                            renderToggle={({ open, setOpen }) => (
                                <ListItemButton
                                    selected={currentNoteType === 1 ? true : false}
                                    variant="outlined"
                                    color="primary"
                                    onClick={() => {
                                        setOpen(!open);
                                        setCurrentNoteType(1);
                                        localStorage.setItem("currentNoteType", "1");
                                    }}
                                >
                                    <WindowIcon />
                                    <ListItemContent>
                                        <Typography level="title-sm">My Notes</Typography>
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
                            )}
                        >
                            <List>{myNoteMetaTree.map((root) => renderMyNoteTree(root))}</List>
                        </Toggler>
                    </ListItem>

                    <ListItem nested>
                        <Toggler
                            defaultExpanded={true}
                            renderToggle={({ open, setOpen }) => (
                                <ListItemButton
                                    selected={currentNoteType === 2 ? true : false}
                                    variant="outlined"
                                    color="primary"
                                    onClick={() => {
                                        setOpen(!open);
                                        setCurrentNoteType(2);
                                        localStorage.setItem("currentNoteType", "2");
                                    }}
                                >
                                    <AssignmentRoundedIcon />
                                    <ListItemContent>
                                        <Typography level="title-sm">Task Notes</Typography>
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
                            )}
                        >
                            <List>{taskNoteMetaTree.map((root) => renderTaskNoteTree(root))}</List>
                        </Toggler>
                    </ListItem>

                    <ListItem nested>
                        <Toggler
                            defaultExpanded={true}
                            renderToggle={({ open, setOpen }) => (
                                <ListItemButton
                                    selected={currentNoteType === 3 ? true : false}
                                    variant="outlined"
                                    color="primary"
                                    onClick={() => {
                                        setOpen(!open);
                                        setCurrentNoteType(3);
                                        localStorage.setItem("currentNoteType", "3");
                                    }}
                                >
                                    <QuestionAnswerRoundedIcon />
                                    <ListItemContent>
                                        <Typography level="title-sm">Chat Notes</Typography>
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
                            )}
                        >
                            <List>{chatNoteMetaTree.map((root) => renderChatNoteTree(root))}</List>
                        </Toggler>
                    </ListItem>

                    <ListItem nested>
                        <Toggler
                            defaultExpanded={true}
                            renderToggle={({ open, setOpen }) => (
                                <ListItemButton
                                    selected={currentNoteType === 4 ? true : false}
                                    variant="outlined"
                                    color="primary"
                                    onClick={() => {
                                        setOpen(!open);
                                        setCurrentNoteType(4);
                                        localStorage.setItem("currentNoteType", "4");
                                    }}
                                >
                                    <ShareIcon />
                                    <ListItemContent>
                                        <Typography level="title-sm">
                                            Shared Notes (TBD)
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
                            )}
                        >
                            <ListItemContent>
                                <Typography level="title-sm"></Typography>
                            </ListItemContent>
                        </Toggler>
                    </ListItem>
                </List>
            </Box>
            <Divider />
        </Sheet>
    );
};
