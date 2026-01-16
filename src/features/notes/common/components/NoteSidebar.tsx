import { useMemo } from "react";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import WindowRoundedIcon from "@mui/icons-material/WindowRounded";
import { Box, Divider, List, ListItem, ListItemContent, Sheet, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { ChildNoteCreator } from "../../chat-notes/components/ChildNoteCreator";
import { useNoteTreeState } from "../hooks/useNoteTreeState";
import { ChatNoteMetaTreeNode, TaskNoteMetaTreeNode } from "../types/noteTypes";
import { GroupedNoteSection } from "./GroupedNoteSection";
import { NoteTreeRenderer } from "./NoteTreeRenderer";
import { NoteTypeSection } from "./NoteTypeSection";

// Types for grouped notes
interface TaskGroup {
    taskId: number;
    taskTitle: string;
    notes: TaskNoteMetaTreeNode[];
}

interface ProjectGroup {
    projectId: number;
    projectName: string;
    tasks: TaskGroup[];
}

interface ChatGroup {
    chatId: number;
    chatName: string;
    notes: ChatNoteMetaTreeNode[];
}

interface ChatTypeGroup {
    chatType: number;
    chatTypeName: string;
    chats: ChatGroup[];
}

// Utility function to group task notes by project, then by task
function groupTaskNotes(notes: TaskNoteMetaTreeNode[]): ProjectGroup[] {
    const projectMap: Map<number, ProjectGroup> = new Map();

    for (const note of notes) {
        // Get or create project group
        if (!projectMap.has(note.projectId)) {
            projectMap.set(note.projectId, {
                projectId: note.projectId,
                projectName: note.projectName || `Project ${note.projectId}`,
                tasks: [],
            });
        }
        const projectGroup = projectMap.get(note.projectId)!;

        // Find or create task group within project
        let taskGroup = projectGroup.tasks.find((t) => t.taskId === note.taskId);
        if (!taskGroup) {
            taskGroup = {
                taskId: note.taskId,
                taskTitle: note.taskTitle || `Task #${note.taskId}`,
                notes: [],
            };
            projectGroup.tasks.push(taskGroup);
        }

        taskGroup.notes.push(note);
    }

    return Array.from(projectMap.values());
}

// Utility function to group chat notes by chat type, then by chat name
function groupChatNotes(notes: ChatNoteMetaTreeNode[]): ChatTypeGroup[] {
    const chatTypeMap: Map<number, ChatTypeGroup> = new Map();

    for (const note of notes) {
        const chatTypeName = note.chatTypeName || getChatTypeLabel(note.chatType);

        // Get or create chat type group
        if (!chatTypeMap.has(note.chatType)) {
            chatTypeMap.set(note.chatType, {
                chatType: note.chatType,
                chatTypeName,
                chats: [],
            });
        }
        const chatTypeGroup = chatTypeMap.get(note.chatType)!;

        // Find or create chat group within chat type
        let chatGroup = chatTypeGroup.chats.find((c) => c.chatId === note.chatId);
        if (!chatGroup) {
            chatGroup = {
                chatId: note.chatId,
                chatName: note.chatName || `${chatTypeName} ${note.chatId}`,
                notes: [],
            };
            chatTypeGroup.chats.push(chatGroup);
        }

        chatGroup.notes.push(note);
    }

    return Array.from(chatTypeMap.values());
}

function getChatTypeLabel(chatType: number): string {
    switch (chatType) {
        case 1:
            return "DM";
        case 2:
            return "GM";
        case 3:
            return "PM";
        default:
            return "Chat";
    }
}

type NoteSidebarProps = {
    useNM: NoteManagementState;
};

export const NoteSidebar = (props: NoteSidebarProps) => {
    const { useNM } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

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
        />
    );

    const renderTaskNoteTreeItem = (node: any) => (
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
        />
    );

    const renderChatNoteTreeItem = (node: any) => (
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
        />
    );

    // Grouped task notes by project and task
    const groupedTaskNotes = useMemo(
        () => groupTaskNotes(taskNoteState.tmpMetaTree as TaskNoteMetaTreeNode[]),
        [taskNoteState.tmpMetaTree]
    );

    // Grouped chat notes by chat type and name
    const groupedChatNotes = useMemo(
        () => groupChatNotes(chatNoteState.tmpMetaTree as ChatNoteMetaTreeNode[]),
        [chatNoteState.tmpMetaTree]
    );

    // Render grouped task notes (Project → Task → Notes)
    const renderGroupedTaskNotes = () =>
        groupedTaskNotes.map((projectGroup) => (
            <GroupedNoteSection
                key={`project-${projectGroup.projectId}`}
                groupKey={`project-${projectGroup.projectId}`}
                groupLabel={projectGroup.projectName}
                defaultExpanded={projectGroup.tasks.some((taskGroup) =>
                    taskGroup.notes.some((note) => note.noteId === useNM.currentTaskNote?.noteId)
                )}
            >
                {projectGroup.tasks.map((taskGroup) => (
                    <GroupedNoteSection
                        key={`task-${projectGroup.projectId}-${taskGroup.taskId}`}
                        groupKey={`task-${projectGroup.projectId}-${taskGroup.taskId}`}
                        groupLabel={`#${taskGroup.taskId}`}
                        subLabel={taskGroup.taskTitle}
                        defaultExpanded={taskGroup.notes.some(
                            (note) => note.noteId === useNM.currentTaskNote?.noteId
                        )}
                    >
                        {taskGroup.notes.map((note) => renderTaskNoteTreeItem(note))}
                    </GroupedNoteSection>
                ))}
            </GroupedNoteSection>
        ));

    // Render grouped chat notes (Chat Type → Chat Name → Notes)
    const renderGroupedChatNotes = () =>
        groupedChatNotes.map((chatTypeGroup) => (
            <GroupedNoteSection
                key={`chatType-${chatTypeGroup.chatType}`}
                groupKey={`chatType-${chatTypeGroup.chatType}`}
                groupLabel={chatTypeGroup.chatTypeName}
                defaultExpanded={chatTypeGroup.chats.some((chatGroup) =>
                    chatGroup.notes.some((note) => note.noteId === useNM.currentChatNote?.noteId)
                )}
            >
                {chatTypeGroup.chats.map((chatGroup) => (
                    <GroupedNoteSection
                        key={`chat-${chatTypeGroup.chatType}-${chatGroup.chatId}`}
                        groupKey={`chat-${chatTypeGroup.chatType}-${chatGroup.chatId}`}
                        groupLabel={chatGroup.chatName}
                        defaultExpanded={chatGroup.notes.some(
                            (note) => note.noteId === useNM.currentChatNote?.noteId
                        )}
                    >
                        {chatGroup.notes.map((note) => renderChatNoteTreeItem(note))}
                    </GroupedNoteSection>
                ))}
            </GroupedNoteSection>
        ));

    // Note type configurations for cleaner code
    const noteTypesConfig = [
        {
            noteType: 1,
            icon: <WindowRoundedIcon sx={{ fontSize: 18 }} />,
            title: "My Notes",
            state: myNoteState,
            renderTree: renderMyNoteTree,
            isGrouped: false,
        },
        {
            noteType: 2,
            icon: <AssignmentRoundedIcon sx={{ fontSize: 18 }} />,
            title: "Task Notes",
            state: taskNoteState,
            renderTree: null,
            renderGrouped: renderGroupedTaskNotes,
            isGrouped: true,
        },
        {
            noteType: 3,
            icon: <QuestionAnswerRoundedIcon sx={{ fontSize: 18 }} />,
            title: "Chat Notes",
            state: chatNoteState,
            renderTree: null,
            renderGrouped: renderGroupedChatNotes,
            isGrouped: true,
        },
        {
            noteType: 4,
            icon: <ShareRoundedIcon sx={{ fontSize: 18 }} />,
            title: "Shared Notes",
            state: null,
            renderTree: null,
            isDisabled: true,
            isGrouped: false,
        },
    ];

    return (
        <Sheet
            className="NoteSidebar"
            sx={{
                position: { xs: "fixed", md: "sticky" },
                transform: {
                    xs: "translateX(calc(100% * (var(--SideNavigation-slideIn, 0) - 1)))",
                    md: "none",
                },
                transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                height: "100dvh",
                width: "100%",
                top: 0,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
            }}
        >
            {/* Content */}
            <Box
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                sx={{
                    minHeight: 0,
                    overflow: "hidden auto",
                    flexGrow: 1,
                    display: "flex",
                    flexDirection: "column",
                    px: 1.5,
                    py: 1.5,
                }}
            >
                <List
                    size="sm"
                    sx={{
                        gap: 0.5,
                        "--List-nestedInsetStart": "24px",
                        "--ListItem-radius": "8px",
                    }}
                >
                    {/* Home Item */}
                    <ListItem>
                        <ListItemButton
                            selected={useNM.currentNoteType === 0}
                            onClick={() => {
                                useNM.setCurrentNoteType(0);
                                localStorage.setItem("lastOpenNoteType", "0");
                            }}
                            sx={{
                                borderRadius: "10px",
                                py: 1,
                                px: 1.5,
                                gap: 1.5,
                                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                "&:hover": {
                                    backgroundColor: isDark
                                        ? "rgba(255,255,255,0.06)"
                                        : "rgba(0,0,0,0.04)",
                                },
                                "&.Mui-selected": {
                                    backgroundColor: isDark
                                        ? "rgba(99,102,241,0.15)"
                                        : "rgba(79,70,229,0.1)",
                                    "&:hover": {
                                        backgroundColor: isDark
                                            ? "rgba(99,102,241,0.2)"
                                            : "rgba(79,70,229,0.15)",
                                    },
                                },
                            }}
                        >
                            <Box
                                sx={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: "8px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: isDark
                                        ? "rgba(255,255,255,0.08)"
                                        : "rgba(0,0,0,0.05)",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                <HomeRoundedIcon
                                    sx={{
                                        fontSize: 16,
                                        color: isDark
                                            ? "rgba(255,255,255,0.75)"
                                            : "rgba(0,0,0,0.65)",
                                    }}
                                />
                            </Box>
                            <ListItemContent>
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        fontWeight: 500,
                                        color: isDark
                                            ? "rgba(255,255,255,0.9)"
                                            : "rgba(0,0,0,0.8)",
                                    }}
                                >
                                    Home
                                </Typography>
                            </ListItemContent>
                        </ListItemButton>
                    </ListItem>

                    {/* Section Divider */}
                    <Box sx={{ pt: 1.5, pb: 0.5, px: 1 }}>
                        <Typography
                            level="body-xs"
                            sx={{
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                fontSize: 10,
                                color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
                            }}
                        >
                            Workspaces
                        </Typography>
                    </Box>

                    {/* Note Type Sections */}
                    {noteTypesConfig.map((config) => (
                        <NoteTypeSection
                            key={config.noteType}
                            icon={config.icon}
                            useNM={useNM}
                            noteType={config.noteType}
                            title={config.title}
                            isDisabled={config.isDisabled}
                        >
                            {config.isGrouped && config.renderGrouped ? (
                                config.renderGrouped()
                            ) : config.state && config.renderTree ? (
                                config.state.tmpMetaTree.map((root) => config.renderTree!(root))
                            ) : config.isDisabled ? (
                                <Box sx={{ px: 2, py: 1 }}>
                                    <Typography
                                        level="body-xs"
                                        sx={{
                                            color: isDark
                                                ? "rgba(255,255,255,0.35)"
                                                : "rgba(0,0,0,0.35)",
                                            fontStyle: "italic",
                                        }}
                                    >
                                        Coming soon
                                    </Typography>
                                </Box>
                            ) : null}
                        </NoteTypeSection>
                    ))}
                </List>
            </Box>

            {/* Footer */}
            <Divider sx={{ opacity: isDark ? 0.08 : 0.12 }} />
            <Box
                sx={{
                    px: 2,
                    py: 1.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Typography
                    level="body-xs"
                    sx={{
                        color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
                        fontSize: 10,
                    }}
                >
                    Organize your thoughts
                </Typography>
            </Box>
        </Sheet>
    );
};
