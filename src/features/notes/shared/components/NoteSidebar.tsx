import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import HomeIcon from "@mui/icons-material/Home";
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

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useNoteTreeState } from "../hooks/useNoteTreeState";
import { ChildNoteCreator } from "../../chat-notes/components/ChildNoteCreator";
import { NoteToggleButton } from "./NoteToggleButton";
import { NoteTreeRenderer } from "./NoteTreeRenderer";
import { NoteTypeSection } from "./NoteTypeSection";

type NoteSidebarProps = {
    NM: NoteManagementState;
};

export const NoteSidebar = (props: NoteSidebarProps) => {
    const { NM } = props;

    // Use custom hooks for each note type
    const myNoteState = useNoteTreeState({
        metaTree: NM.myNoteMetaTree,
        currentChain: NM.currentMyNoteChain,
        selectedTabIndex: NM.selectedTabIndex,
        currentNote: NM.currentMyNote,
    });

    const taskNoteState = useNoteTreeState({
        metaTree: NM.taskNoteMetaTree,
        currentChain: NM.currentTaskNoteChain,
        selectedTabIndex: NM.selectedTabIndex,
        currentNote: NM.currentTaskNote,
    });

    const chatNoteState = useNoteTreeState({
        metaTree: NM.chatNoteMetaTree,
        currentChain: NM.currentChatNoteChain,
        selectedTabIndex: NM.selectedTabIndex,
        currentNote: NM.currentChatNote,
    });

    // Render functions for each note type
    const renderMyNoteTree = (node: any) => (
        <NoteTreeRenderer
            key={node.noteId}
            node={node}
            timestamp={myNoteState.timestamp}
            currentChain={myNoteState.tmpCurrentChain}
            noteType={1}
            NM={NM}
            renderToggle={(open, setOpen, node) => (
                <NoteToggleButton open={open} setOpen={setOpen} noteType={1} node={node} NM={NM} />
            )}
            createChildNoteList={(node) => (
                <ChildNoteCreator node={node} timestamp={myNoteState.timestamp} NM={NM} />
            )}
        />
    );

    const renderTaskNoteTree = (node: any) => (
        <NoteTreeRenderer
            key={node.noteId}
            node={node}
            timestamp={taskNoteState.timestamp}
            currentChain={taskNoteState.tmpCurrentChain}
            noteType={2}
            NM={NM}
            renderToggle={(open, setOpen, node) => (
                <NoteToggleButton open={open} setOpen={setOpen} noteType={2} node={node} NM={NM} />
            )}
            createChildNoteList={(node) => (
                <ChildNoteCreator node={node} timestamp={taskNoteState.timestamp} NM={NM} />
            )}
        />
    );

    const renderChatNoteTree = (node: any) => (
        <NoteTreeRenderer
            key={node.noteId}
            node={node}
            timestamp={chatNoteState.timestamp}
            currentChain={chatNoteState.tmpCurrentChain}
            noteType={3}
            NM={NM}
            renderToggle={(open, setOpen, node) => (
                <NoteToggleButton open={open} setOpen={setOpen} noteType={3} node={node} NM={NM} />
            )}
            createChildNoteList={(node) => (
                <ChildNoteCreator node={node} timestamp={chatNoteState.timestamp} NM={NM} />
            )}
        />
    );

    // Outer toggle button renderer
    const renderOuterToggle = (
        open: boolean,
        setOpen: (value: boolean) => void,
        noteType: number
    ) => {
        const getIcon = () => {
            switch (noteType) {
                case 1:
                    return <WindowIcon />;
                case 2:
                    return <AssignmentRoundedIcon />;
                case 3:
                    return <QuestionAnswerRoundedIcon />;
                case 4:
                    return <ShareIcon />;
                default:
                    return null;
            }
        };

        const getTitle = () => {
            switch (noteType) {
                case 1:
                    return "My Notes";
                case 2:
                    return "Task Notes";
                case 3:
                    return "Chat Notes";
                case 4:
                    return "Shared Notes (TBD)";
                default:
                    return "";
            }
        };

        return (
            <NoteToggleButton
                open={open}
                setOpen={setOpen}
                noteType={noteType}
                title={getTitle()}
                icon={getIcon()}
                NM={NM}
                isOuter={true}
            />
        );
    };

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
                            selected={NM.currentNoteType === 0}
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

                    <NoteTypeSection
                        title="My Notes"
                        noteType={1}
                        icon={<WindowIcon />}
                        NM={NM}
                        renderToggle={renderOuterToggle}
                    >
                        {myNoteState.tmpMetaTree.map((root) => renderMyNoteTree(root))}
                    </NoteTypeSection>

                    <NoteTypeSection
                        title="Task Notes"
                        noteType={2}
                        icon={<AssignmentRoundedIcon />}
                        NM={NM}
                        renderToggle={renderOuterToggle}
                    >
                        {taskNoteState.tmpMetaTree.map((root) => renderTaskNoteTree(root))}
                    </NoteTypeSection>

                    <NoteTypeSection
                        title="Chat Notes"
                        noteType={3}
                        icon={<QuestionAnswerRoundedIcon />}
                        NM={NM}
                        renderToggle={renderOuterToggle}
                    >
                        {chatNoteState.tmpMetaTree.map((root) => renderChatNoteTree(root))}
                    </NoteTypeSection>

                    <NoteTypeSection
                        title="Shared Notes (TBD)"
                        noteType={4}
                        icon={<ShareIcon />}
                        NM={NM}
                        renderToggle={renderOuterToggle}
                    >
                        <ListItemContent>
                            <Typography level="title-sm"></Typography>
                        </ListItemContent>
                    </NoteTypeSection>
                </List>
            </Box>
            <Divider />
        </Sheet>
    );
};
