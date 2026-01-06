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
import { ChildNoteCreator } from "../../chat-notes/components/ChildNoteCreator";
import { useNoteTreeState } from "../hooks/useNoteTreeState";
import { NoteToggleButton } from "./NoteToggleButton";
import { NoteTreeRenderer } from "./NoteTreeRenderer";
import { NoteTypeSection } from "./NoteTypeSection";

type NoteSidebarProps = {
    useNM: NoteManagementState;
};

export const NoteSidebar = (props: NoteSidebarProps) => {
    const { useNM } = props;

    // Use custom hooks for each note type
    const myNoteState = useNoteTreeState({
        metaTree: useNM.myNoteMetaTree,
        currentChain: useNM.currentMyNoteChain,
        selectedTabIndex: useNM.selectedTabIndex,
        currentNote: useNM.currentMyNote,
    });

    const taskNoteState = useNoteTreeState({
        metaTree: useNM.taskNoteMetaTree,
        currentChain: useNM.currentTaskNoteChain,
        selectedTabIndex: useNM.selectedTabIndex,
        currentNote: useNM.currentTaskNote,
    });

    const chatNoteState = useNoteTreeState({
        metaTree: useNM.chatNoteMetaTree,
        currentChain: useNM.currentChatNoteChain,
        selectedTabIndex: useNM.selectedTabIndex,
        currentNote: useNM.currentChatNote,
    });

    // Render functions for each note type
    const renderMyNoteTree = (node: any) => (
        <NoteTreeRenderer
            key={node.noteId}
            currentChain={myNoteState.tmpCurrentChain}
            useNM={useNM}
            node={node}
            noteType={1}
            timestamp={myNoteState.timestamp}
            createChildNoteList={(node) => (
                <ChildNoteCreator useNM={useNM} node={node} timestamp={myNoteState.timestamp} />
            )}
            renderToggle={(open, setOpen, node) => (
                <NoteToggleButton
                    useNM={useNM}
                    node={node}
                    noteType={1}
                    open={open}
                    setOpen={setOpen}
                />
            )}
        />
    );

    const renderTaskNoteTree = (node: any) => (
        <NoteTreeRenderer
            key={node.noteId}
            currentChain={taskNoteState.tmpCurrentChain}
            useNM={useNM}
            node={node}
            noteType={2}
            timestamp={taskNoteState.timestamp}
            createChildNoteList={(node) => (
                <ChildNoteCreator useNM={useNM} node={node} timestamp={taskNoteState.timestamp} />
            )}
            renderToggle={(open, setOpen, node) => (
                <NoteToggleButton
                    useNM={useNM}
                    node={node}
                    noteType={2}
                    open={open}
                    setOpen={setOpen}
                />
            )}
        />
    );

    const renderChatNoteTree = (node: any) => (
        <NoteTreeRenderer
            key={node.noteId}
            currentChain={chatNoteState.tmpCurrentChain}
            useNM={useNM}
            node={node}
            noteType={3}
            timestamp={chatNoteState.timestamp}
            createChildNoteList={(node) => (
                <ChildNoteCreator useNM={useNM} node={node} timestamp={chatNoteState.timestamp} />
            )}
            renderToggle={(open, setOpen, node) => (
                <NoteToggleButton
                    useNM={useNM}
                    node={node}
                    noteType={3}
                    open={open}
                    setOpen={setOpen}
                />
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
                icon={getIcon()}
                isOuter={true}
                useNM={useNM}
                noteType={noteType}
                open={open}
                setOpen={setOpen}
                title={getTitle()}
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
                            selected={useNM.currentNoteType === 0}
                            onClick={() => {
                                useNM.setCurrentNoteType(0);
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
                        icon={<WindowIcon />}
                        useNM={useNM}
                        noteType={1}
                        renderToggle={renderOuterToggle}
                        title="My Notes"
                    >
                        {myNoteState.tmpMetaTree.map((root) => renderMyNoteTree(root))}
                    </NoteTypeSection>

                    <NoteTypeSection
                        icon={<AssignmentRoundedIcon />}
                        useNM={useNM}
                        noteType={2}
                        renderToggle={renderOuterToggle}
                        title="Task Notes"
                    >
                        {taskNoteState.tmpMetaTree.map((root) => renderTaskNoteTree(root))}
                    </NoteTypeSection>

                    <NoteTypeSection
                        icon={<QuestionAnswerRoundedIcon />}
                        useNM={useNM}
                        noteType={3}
                        renderToggle={renderOuterToggle}
                        title="Chat Notes"
                    >
                        {chatNoteState.tmpMetaTree.map((root) => renderChatNoteTree(root))}
                    </NoteTypeSection>

                    <NoteTypeSection
                        icon={<ShareIcon />}
                        useNM={useNM}
                        noteType={4}
                        renderToggle={renderOuterToggle}
                        title="Shared Notes (TBD)"
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
