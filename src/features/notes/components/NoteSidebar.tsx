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

import { useAuth } from "../../../context/AuthContext";
import { UserProps } from "../../../types/admin";
import { NoteMetaProps, NoteMetaTreeNode, NoteProps } from "../../../types/notes";
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
    noteMetaTree: NoteMetaTreeNode[];
    noteType: number;
    setNoteType: (value: number) => void;
    noteMeta: NoteMetaProps[];
    currentNote: NoteProps | null;
    setCurrentNote: (value: NoteProps) => void;
    tabContents: NoteProps[];
    handleCreateNewNote: (parentNoteId: number | null) => Promise<void>;
    currentNoteChain: NoteMetaTreeNode[];
    allNoteIdChains: Record<number, number[]>;
};
export const NoteSidebar = (props: NoteSidebarProps) => {
    const {
        myself,
        noteMetaTree,
        noteType,
        setNoteType,
        noteMeta,
        currentNote,
        setCurrentNote,
        tabContents,
        handleCreateNewNote,
        currentNoteChain,
        allNoteIdChains,
    } = props;
    const { accessToken } = useAuth();

    const [tsNoteChainUpdated, setTsNoteChainUpdated] = useState<string>(getCurrentTimestamp());
    const [tmpCurrentNoteChain, setTmpCurrentNoteChain] =
        useState<NoteMetaTreeNode[]>(currentNoteChain);

    useEffect(() => {
        setTmpCurrentNoteChain(currentNoteChain);
        setTsNoteChainUpdated(getCurrentTimestamp());
    }, [currentNoteChain]);

    const LoadNote = async (noteId: number) => {
        const note: NoteProps = await getData({ storeName: STORES.NOTES, key: noteId });
        if (note) {
            setCurrentNote(note);
        } else {
            const note: NoteProps = await loadSpecificNote(myself, noteId, accessToken);
            if (!note.error) {
                addNote(note);
                setCurrentNote(note);
            }
        }
    };

    const renderTree = (node: NoteMetaTreeNode) => (
        <ListItem nested key={`${node.noteId}-${tsNoteChainUpdated}`}>
            <Toggler
                // Expanding toggle when the target note is in the tab.
                defaultExpanded={
                    tmpCurrentNoteChain.some(
                        (chainedNote) => chainedNote.noteId === node.noteId
                    ) ||
                    tabContents.some((tabNote) =>
                        allNoteIdChains[tabNote.noteId]?.some(
                            (chainedNoteId) => chainedNoteId === node.noteId
                        )
                    )
                        ? true
                        : false
                }
                renderToggle={({ open, setOpen }) => (
                    <ListItemButton
                        selected={node.noteId === currentNote?.noteId ? true : false}
                        variant="soft"
                        onClick={() => {
                            setOpen(!open);
                            setNoteType(1);
                            LoadNote(node.noteId);
                        }}
                    >
                        <ListItemContent>
                            <Typography level="title-sm">{node.title}</Typography>
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
                    <List>{node.children.map((child) => renderTree(child))}</List>
                )}

                {node.children.length === 0 && (
                    <Typography
                        level="title-sm"
                        component="button"
                        onClick={() => {
                            handleCreateNewNote(node.noteId);
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
                            selected={noteType === 0 ? true : false}
                            onClick={() => {
                                setNoteType(0);
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
                                    selected={noteType === 1 ? true : false}
                                    variant="outlined"
                                    color="primary"
                                    onClick={() => {
                                        setOpen(!open);
                                        setNoteType(1);
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
                            <List>{noteMetaTree.map((root) => renderTree(root))}</List>
                        </Toggler>
                    </ListItem>
                    <ListItem>
                        <ListItemButton
                            selected={noteType === 2 ? true : false}
                            onClick={() => {
                                setNoteType(2);
                            }}
                        >
                            <AssignmentRoundedIcon />
                            <ListItemContent>
                                <Typography level="title-sm">Task Notes (TBD)</Typography>
                            </ListItemContent>
                        </ListItemButton>
                    </ListItem>
                    <ListItem>
                        <ListItemButton
                            selected={noteType === 3 ? true : false}
                            onClick={() => {
                                setNoteType(3);
                            }}
                        >
                            <QuestionAnswerRoundedIcon />
                            <ListItemContent>
                                <Typography level="title-sm">Chat Notes (TBD)</Typography>
                            </ListItemContent>
                        </ListItemButton>
                    </ListItem>
                </List>
            </Box>
            <Divider />
        </Sheet>
    );
};
