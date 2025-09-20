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

import { useAuth } from "../../../context/AuthContext";
import { UserProps } from "../../../types/admin";
import { NoteProps } from "../../../types/notes";

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
    noteType: number;
    setNoteType: (value: number) => void;
    notes: NoteProps[];
    currentNote: NoteProps | null;
    setCurrentNote: (value: NoteProps) => void;
};
export const NoteSidebar = (props: NoteSidebarProps) => {
    const { myself, noteType, setNoteType, notes, currentNote, setCurrentNote } = props;
    const { accessToken } = useAuth();

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
                            <List>
                                {notes.map((note, index) => {
                                    return (
                                        <ListItem key={`personal-note-${note.noteId}`}>
                                            <ListItemButton
                                                selected={
                                                    currentNote &&
                                                    currentNote.noteId === note.noteId
                                                        ? true
                                                        : false
                                                }
                                                onClick={() => {
                                                    setCurrentNote(note);
                                                }}
                                                sx={{ overflow: "hidden" }} // ensure children don't overflow
                                            >
                                                <Typography
                                                    noWrap
                                                    sx={{
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                        width: "100%", // take full width of button
                                                        fontSize: "15px",
                                                    }}
                                                >
                                                    {note.title}
                                                </Typography>
                                            </ListItemButton>
                                        </ListItem>
                                    );
                                })}
                            </List>
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
                                <Typography level="title-sm">Task Notes</Typography>
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
                                <Typography level="title-sm">Thread Notes</Typography>
                            </ListItemContent>
                        </ListItemButton>
                    </ListItem>
                </List>
            </Box>
            <Divider />
        </Sheet>
    );
};
