import { useCallback, useEffect, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import { Box, Button, Divider, Option, Select, Sheet, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { TagListProps, TaskProps } from "../../../../types/tasks";
import { getFormattedTodayDateStr } from "../../../../utils/dateUtils";
import { createEmptyTask } from "../../services/createEmptyTask";
import {
    updateProjectOptions,
    updateTagOptions,
    updateTeamMembersOptions,
} from "../../services/updateTaskAutoCompleteOptions";
import { sendMilestoneCreatedMessage } from "../../sprint-milestone/services";
import { getCreationKind } from "../../utils/taskKind";
import { TaskCreateAttachmentBlock } from "./base/TaskCreateAttachmentBlock";
import { TaskCreateBodyBlock } from "./base/TaskCreateBodyBlock";
import { TaskCreateFooter } from "./base/TaskCreateFooter";
import { TaskMainBlock } from "./base/TaskMainBlock";
import { TaskTitleBlock } from "./base/TaskTitleBlock";

// Section divider component
const SectionDivider = ({ isDark }: { isDark: boolean }) => (
    <Divider
        sx={{
            my: 2,
            opacity: isDark ? 0.08 : 0.12,
        }}
    />
);

// Section header component
const SectionHeader = ({ children, isDark }: { children: React.ReactNode; isDark: boolean }) => (
    <Typography
        level="body-xs"
        sx={{
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontSize: 10,
            color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
            mb: 1,
        }}
    >
        {children}
    </Typography>
);

// ---------------------------------------------------------------------------
// Body templates
// ---------------------------------------------------------------------------
//
// Each template is a small builder so we can vary headings/placeholders
// without copy-pasting BlockNote's verbose `props` blob. Placeholders use
// `italic + textColor: "gray"` instead of inline `code` styling, because
// inline-code stickiness used to bleed into whatever the user typed next.

const HEADING_PROPS = {
    level: 3,
    textColor: "default",
    textAlignment: "left",
    backgroundColor: "default",
} as const;

const PARA_PROPS = {
    textColor: "default",
    textAlignment: "left",
    backgroundColor: "default",
} as const;

const heading = (text: string): PartialBlock => ({
    type: "heading",
    props: HEADING_PROPS,
    content: [{ text, type: "text", styles: {} }],
    children: [],
});

const placeholder = (text: string): PartialBlock => ({
    type: "paragraph",
    props: PARA_PROPS,
    content: [{ text, type: "text", styles: { italic: true, textColor: "gray" } }],
    children: [],
});

const blank = (): PartialBlock => ({
    type: "paragraph",
    props: PARA_PROPS,
    content: [],
    children: [],
});

const bullet = (text: string): PartialBlock => ({
    type: "bulletListItem",
    props: PARA_PROPS,
    content: [{ text, type: "text", styles: { italic: true, textColor: "gray" } }],
    children: [],
});

const section = (title: string, ...body: PartialBlock[]): PartialBlock[] => [
    heading(title),
    ...body,
    blank(),
];

export type TaskTemplateId = "default" | "bug" | "spike" | "milestone";

interface TaskTemplate {
    id: TaskTemplateId;
    label: string;
    description: string;
    blocks: PartialBlock[];
}

const TASK_TEMPLATES: Record<TaskTemplateId, TaskTemplate> = {
    default: {
        id: "default",
        label: "Standard task",
        description: "Goal, context, and acceptance criteria.",
        blocks: [
            ...section("🧾 Summary", placeholder("One or two lines on what this task delivers.")),
            ...section(
                "🪜 Motivation",
                placeholder("Why does this matter? What problem are we solving?")
            ),
            ...section(
                "✅ Acceptance criteria",
                bullet("First condition that must be true when this is done."),
                bullet("Second condition…"),
                bullet("Third condition…")
            ),
            ...section("🎯 Notes & links", placeholder("Anything else worth pinning here.")),
        ],
    },
    bug: {
        id: "bug",
        label: "Bug report",
        description: "Repro steps, expected vs. actual behavior.",
        blocks: [
            ...section("🐞 Summary", placeholder("One-line description of the bug.")),
            ...section(
                "🔁 Steps to reproduce",
                bullet("Go to …"),
                bullet("Click on …"),
                bullet("Observe that …")
            ),
            ...section("🎯 Expected behavior", placeholder("What should happen?")),
            ...section(
                "💥 Actual behavior",
                placeholder("What actually happens? Include error messages, screenshots.")
            ),
            ...section(
                "🧪 Environment",
                placeholder("Browser, OS, app version, user, team, anything that narrows it down.")
            ),
        ],
    },
    spike: {
        id: "spike",
        label: "Research / spike",
        description: "Question-led investigation with a timebox.",
        blocks: [
            ...section("❓ Question", placeholder("What are we trying to learn or decide?")),
            ...section("💡 Hypothesis", placeholder("What do we currently believe is true?")),
            ...section(
                "🧭 Approach",
                bullet("Where to look first…"),
                bullet("Experiments / prototypes to try…"),
                bullet("People to talk to…")
            ),
            ...section("⏱ Timebox", placeholder("How long are we willing to spend on this?")),
            ...section(
                "📌 Findings",
                placeholder("Fill in as you learn — link out to docs, PRs, threads.")
            ),
            ...section(
                "🚧 Out of scope",
                placeholder("Explicitly things we are NOT answering here.")
            ),
        ],
    },
    milestone: {
        id: "milestone",
        label: "Milestone",
        description: "Goal, scope, success criteria, risks.",
        blocks: [
            ...section(
                "🎯 Goal",
                placeholder("What outcome does this milestone deliver, and for whom?")
            ),
            ...section(
                "✅ Success criteria",
                bullet("Measurable signal #1 that we hit the goal."),
                bullet("Measurable signal #2."),
                bullet("Measurable signal #3.")
            ),
            ...section(
                "📦 In scope",
                bullet("Workstream / feature 1"),
                bullet("Workstream / feature 2")
            ),
            ...section("🚫 Out of scope", bullet("Thing we are explicitly NOT doing.")),
            ...section(
                "⚠️ Risks & dependencies",
                placeholder("What could derail this? Who/what are we waiting on?")
            ),
        ],
    },
};

const TASK_TEMPLATE_OPTIONS: TaskTemplate[] = [
    TASK_TEMPLATES.default,
    TASK_TEMPLATES.bug,
    TASK_TEMPLATES.spike,
    TASK_TEMPLATES.milestone,
];

const taskContentTemplate: PartialBlock[] = TASK_TEMPLATES.default.blocks;

type CreateTaskProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    chatType: number;
    useUISM: UIStateManagementState;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    useSM?: SprintMilestoneManagementState;
    useCM: ChatManagementState;
    useNM: NoteManagementState;
};

export const CreateTaskForm = (props: CreateTaskProps) => {
    const {
        useTEM,
        socket,
        myself,
        setMyself,
        chatType,
        useCM,
        useUISM,
        usePM,
        useTM,
        useSM,
        useNM,
    } = props;
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    // Init task contents
    const [taskContent, setTaskContent] = useState<TaskProps>();
    const [taskTitle, setTaskTitle] = useState<string>("");
    const [body, setBody] = useState<PartialBlock[]>(taskContentTemplate);
    const [assignee, setAssignee] = useState<UserProps>(myself);
    const [reporter, setReporter] = useState<UserProps>(myself);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isCreatingMilestone, setIsCreatingMilestone] = useState(false);
    // The effective creation kind ("task" | "milestone" | "subtask")
    // is derived from `useTM.isCreatingTask` plus the project's task
    // table — see `getCreationKind` for the rules.
    const creationKind = getCreationKind(useTM.isCreatingTask, useTM.allTasks);

    // Body template picker. Default to the milestone template when the user
    // is creating a milestone; otherwise use the standard task template.
    const [templateId, setTemplateId] = useState<TaskTemplateId>(
        creationKind === "milestone" ? "milestone" : "default"
    );
    // The BlockNote editor seeds itself once from `body` and afterwards
    // manages its own state, so re-applying a template requires calling
    // `editor.replaceBlocks` directly. The editor instance is forwarded
    // here via `BnTaskPreview`'s `onEditorReady` callback.
    const editorRef = useRef<any>(null);
    const handleEditorReady = useCallback((editor: any) => {
        editorRef.current = editor;
    }, []);

    const applyTemplate = (nextId: TaskTemplateId) => {
        const next = TASK_TEMPLATES[nextId];
        if (!next) return;
        setTemplateId(nextId);
        setBody(next.blocks);
        const editor = editorRef.current;
        if (editor) {
            try {
                editor.replaceBlocks(editor.document, next.blocks);
            } catch {
                // Editor not ready yet — the next render's seed will pick
                // up the new body via `initialBody`.
            }
        }
    };

    // When the user toggles the creationKind chip (task ↔ milestone) we
    // surface a sensible default template, but only if they haven't picked
    // a different one themselves yet — if they're already on a non-default
    // template, leave their choice alone.
    useEffect(() => {
        if (creationKind === "milestone" && templateId === "default") {
            applyTemplate("milestone");
        } else if (creationKind === "task" && templateId === "milestone") {
            applyTemplate("default");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [creationKind]);

    const switchKind = (kind: "task" | "milestone") => {
        useTM.setIsCreatingTask({
            ...useTM.isCreatingTask,
            creationKind: kind,
        });
    };

    useEffect(() => {
        createEmptyTask({
            myself: myself,
            projectId: usePM.currentProject?.projectId || 0,
            accessToken: accessToken,
            setInitialEmptyTaskId: useTM.setInitialEmptyTaskId,
        });
    }, []);

    useEffect(() => {
        if (useTM.initialEmptyTaskId) {
            setTaskContent({
                id: useTM.initialEmptyTaskId,
                project: usePM.currentProject,
                title: "",
                body: taskContentTemplate,
                assignee: myself,
                reporter: myself,
                chatType: chatType,
                chatId: useCM.currentMainChat?.chatId || null,
                threadId: useCM.currentThreadChat?.threadId || null,
                dueDate: getFormattedTodayDateStr(),
                status: {
                    code: 0,
                    status: "Open",
                    color: "#0044c2",
                    textColor: "white",
                },
                priority: { code: -1, priority: "", color: "", textColor: "" },
                effortLevel: { code: -1, level: "", color: "", textColor: "" },
                tags: [],
                links: [],
                attachments: [],
                parentTaskId: useTM.isCreatingTask.parentTaskId,
                rootTaskId: useTM.isCreatingTask.rootTaskId,
                // When created from inside a milestone, pre-select that
                // milestone in SprintMilestonePicker. The backend also
                // infers milestone_id from parent_task_id, so the value
                // here is mostly to drive the picker UI.
                milestoneId: useTM.isCreatingTask.milestoneId ?? null,
            } as TaskProps);
        }
    }, [useTM.initialEmptyTaskId]);

    // Update task title when it changes
    useEffect(() => {
        if (taskContent && taskTitle !== "") {
            setTaskContent({
                ...taskContent,
                title: taskTitle,
            });
        }
    }, [taskTitle]);

    // Update task body when it changes
    useEffect(() => {
        if (taskContent && body.length > 0) {
            setTaskContent({
                ...taskContent,
                body: body,
            });
        }
    }, [body]);

    // Update status once task is created
    useEffect(() => {
        if (isSubmitted) {
            if (useTM.setIsCreatingTask) {
                useTM.setIsCreatingTask({
                    flag: false,
                    parentTaskId: null,
                    rootTaskId: null,
                    creationKind: "task",
                    milestoneId: null,
                });
            }
            if (useTM.setIsNewTaskCreated) {
                setTimeout(() => {
                    useTM.setIsNewTaskCreated(true);
                }, 500);
            }
        }
    }, [isSubmitted]);

    const handleCreateMilestone = async () => {
        if (!useSM || !taskContent || !taskContent.project?.projectId) return;
        if (!taskTitle.trim()) return;
        setIsCreatingMilestone(true);
        const projectId = taskContent.project.projectId;
        const created = await useSM.createNewMilestone({
            projectId,
            title: taskTitle.trim(),
            description: body,
            sprintId: (taskContent as any)?.sprintId ?? null,
            dueDate: taskContent.dueDate || null,
            priority: taskContent.priority?.priority || null,
            // Mirror the priority pattern: backend stores both the
            // human-readable label and the numeric code, and was
            // silently dropping `effort_level` here because we never
            // sent it. Treat empty `level`/`code` as null so an
            // unselected dropdown doesn't write blanks to the row.
            effortLevel: taskContent.effortLevel?.level || null,
            effortLevelCode:
                typeof taskContent.effortLevel?.code === "number" &&
                taskContent.effortLevel.code >= 0
                    ? taskContent.effortLevel.code
                    : null,
            tags: taskContent.tags || [],
            reporterId: myself.userId,
            assigneeIds: assignee?.userId ? [assignee.userId] : [],
        });
        setIsCreatingMilestone(false);
        if (created) {
            // Reset creation pane and refresh milestones list. We
            // include "Closed" so the dashboard's SprintMilestonesSection
            // can keep showing milestones that flip to Closed without
            // them vanishing on the next refresh.
            useTM.setIsCreatingTask({
                flag: false,
                parentTaskId: null,
                rootTaskId: null,
                creationKind: "task",
                milestoneId: null,
            });
            await useSM.loadMilestonesForProject(projectId, {
                statuses: ["Open", "WIP", "Pending", "Closed"],
            });
            // Pull the freshest copy (backing task / aggregates / assignees)
            // before opening the preview so MilestonePreviewInner doesn't
            // briefly land on its "Loading milestone…" early-return.
            await useSM.refreshMilestone(created.milestoneId);
            // Pull the new milestone's backing task into `useTM.allTasks`
            // (via IDB → fetchProjectTasks chain in useProjectTaskManagement).
            // Without this, TaskFilterMenu's milestone-scope chip can't
            // resolve the title and falls back to "Milestone: #<id>",
            // and the table/sprint board can't enumerate the milestone's
            // children either.
            await usePM.loadProjectsAndTasks(projectId);
            // Mirror the "task created" socket fan-out for milestones so
            // teammates see a chat bubble in the project's PM channel
            // (and any open thread) when a new milestone lands. Wrapped
            // defensively because a chat hiccup must not block the
            // milestone preview from opening below.
            try {
                if (taskContent.project) {
                    const linkedSprint =
                        created.sprintId != null
                            ? useSM.projectSprints[projectId]?.find(
                                  (s) => s.sprintId === created.sprintId
                              )
                            : null;
                    const resolvedAssignees: UserProps[] = (created.assignees ?? [])
                        .map((a) =>
                            a.userId != null
                                ? useTEM.teamMemberProfiles[String(a.userId)]
                                : undefined
                        )
                        .filter((u): u is UserProps => !!u);
                    sendMilestoneCreatedMessage({
                        socket,
                        myself,
                        project: taskContent.project,
                        milestone: created,
                        sprintName: linkedSprint?.name ?? "No sprint",
                        reporter: myself,
                        assignees:
                            resolvedAssignees.length > 0
                                ? resolvedAssignees
                                : assignee
                                  ? [assignee]
                                  : [myself],
                        useCM,
                    });
                }
            } catch (err) {
                console.error("Failed to send 'milestone created' chat message:", err);
            }
            // Auto-open the new milestone for parity with the task
            // creation flow (which routes via `setCurrentPreviewTaskId`
            // inside `uploadNewTask`).
            useTM.setCurrentPreviewMilestoneId(created.milestoneId);
            useTM.setIsTaskPreviewVisible(true);
            // "+ Add milestone" from the sidebar hides the task home
            // panel; if no other main panel is visible, restore the task
            // home so the user always lands somewhere sensible.
            if (
                !useTM.isTaskHomeVisible &&
                !useTM.isDashboardVisible &&
                !useTM.isSprintBoardVisible
            ) {
                useTM.setIsTaskHomeVisible(true);
            }
        }
    };

    const [titleErrorOpen, setTitleErrorOpen] = useState(false);
    const [titleError, setTitleError] = useState("");

    // Get team members
    const [isOpenTeamMembersList, setIsOpenTeamMembersList] = useState(false);
    useEffect(() => {
        updateTeamMembersOptions({
            myself: myself,
            accessToken: accessToken,
            setTeamMembers: useTEM.setTeamMembers,
        });
    }, [myself, isOpenTeamMembersList]);

    // Get team projects
    const [isOpenProjectList, setIsOpenProjectList] = useState(false);
    useEffect(() => {
        updateProjectOptions({
            myself: myself,
            accessToken: accessToken,
            setTeamProjects: usePM.setTeamProjects,
        });
    }, [isOpenProjectList]);

    // Get Project tags
    const [projectTags, setProjectTags] = useState<TagListProps[]>([]);
    const [isOpenTagList, setIsOpenTagList] = useState(false);
    useEffect(() => {
        if (usePM.currentProject) {
            updateTagOptions({
                myself: myself,
                accessToken: accessToken,
                projectId: usePM.currentProject.projectId,
                setProjectTags: setProjectTags,
            });
        }
    }, [isOpenTagList]);

    return (
        <>
            {taskContent && taskContent.id && (
                <Sheet
                    className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                    sx={{
                        minHeight: 500,
                        borderRadius: "16px",
                        p: 0,
                        overflowY: "auto",
                        overflowX: "hidden",
                        background: isDark
                            ? "linear-gradient(180deg, rgba(22,22,28,0.98) 0%, rgba(18,18,24,1) 100%)"
                            : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(252,252,255,1) 100%)",
                        border: "1px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                        boxShadow: isDark
                            ? "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)"
                            : "0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)",
                        position: "relative",
                        animation: "slideIn 0.3s ease-out",
                        "@keyframes slideIn": {
                            from: { opacity: 0, transform: "translateY(8px)" },
                            to: { opacity: 1, transform: "translateY(0)" },
                        },
                    }}
                >
                    {/* Gradient accent at top - purple for new task */}
                    <Box
                        sx={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: "3px",
                            background: isDark
                                ? "linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)"
                                : "linear-gradient(90deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)",
                            borderRadius: "16px 16px 0 0",
                            opacity: 0.8,
                        }}
                    />

                    {/* Task vs Milestone toggle (only visible when sprint
                        management is wired in for this surface). Hidden
                        entirely when the form is opened inside a milestone
                        or under a parent task, because milestones can't
                        be a child of either. */}
                    {useSM &&
                        useTM.isCreatingTask.milestoneId == null &&
                        useTM.isCreatingTask.parentTaskId == null && (
                            <Box
                                sx={{
                                    px: 2.5,
                                    pt: 2,
                                    pb: 0.5,
                                }}
                            >
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                                        Create:
                                    </Typography>
                                    <Button
                                        size="sm"
                                        variant={creationKind === "task" ? "solid" : "soft"}
                                        color={creationKind === "task" ? "primary" : "neutral"}
                                        startDecorator={
                                            <AssignmentRoundedIcon sx={{ fontSize: 14 }} />
                                        }
                                        onClick={() => switchKind("task")}
                                    >
                                        Task
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={creationKind === "milestone" ? "solid" : "soft"}
                                        color={
                                            creationKind === "milestone" ? "warning" : "neutral"
                                        }
                                        startDecorator={<FlagRoundedIcon sx={{ fontSize: 14 }} />}
                                        onClick={() => switchKind("milestone")}
                                    >
                                        Milestone
                                    </Button>
                                </Stack>
                            </Box>
                        )}

                    {/* Header with Task Title Block */}
                    <Box
                        sx={{
                            p: 2.5,
                            pt: 3,
                            borderBottom: "1px solid",
                            borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                        }}
                    >
                        <TaskTitleBlock
                            useCM={useCM}
                            isPreviewMode={false}
                            myself={myself}
                            usePM={usePM}
                            setTaskTitle={setTaskTitle}
                            setTitleErrorOpen={setTitleErrorOpen}
                            taskContent={taskContent}
                            taskTitle={taskTitle}
                            useNM={useNM}
                            titleError={titleError}
                            titleErrorOpen={titleErrorOpen}
                            useTM={useTM}
                            useUISM={useUISM}
                            isMilestone={creationKind === "milestone"}
                            isSubTask={creationKind === "subtask"}
                        />
                    </Box>

                    {/* Main Content Section */}
                    <Box sx={{ p: 2.5 }}>
                        <SectionHeader isDark={isDark}>Task Details</SectionHeader>
                        <Box
                            sx={{
                                p: 2,
                                borderRadius: "12px",
                                background: isDark
                                    ? "rgba(255,255,255,0.02)"
                                    : "rgba(0,0,0,0.015)",
                                border: "1px solid",
                                borderColor: isDark
                                    ? "rgba(255,255,255,0.04)"
                                    : "rgba(0,0,0,0.04)",
                            }}
                        >
                            <TaskMainBlock
                                assignee={assignee}
                                useCM={useCM}
                                isOpenProjectList={isOpenProjectList}
                                isOpenTagList={isOpenTagList}
                                isOpenTeamMembersList={isOpenTeamMembersList}
                                isPreviewMode={false}
                                myself={myself}
                                projectTags={projectTags}
                                setProjectTags={setProjectTags}
                                reporter={reporter}
                                setAssignee={setAssignee}
                                setIsOpenProjectList={setIsOpenProjectList}
                                setIsOpenTagList={setIsOpenTagList}
                                setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                                setMyself={setMyself}
                                setReporter={setReporter}
                                setTaskContent={setTaskContent}
                                socket={socket}
                                taskContent={taskContent}
                                useTEM={useTEM}
                                useTM={useTM}
                                useSM={useSM}
                                useUISM={useUISM}
                                usePM={usePM}
                                isMilestone={creationKind === "milestone"}
                                isSubTask={creationKind === "subtask"}
                            />
                        </Box>

                        <SectionDivider isDark={isDark} />

                        {/* Body Section */}
                        <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            sx={{ mb: 1, gap: 1 }}
                        >
                            <SectionHeader isDark={isDark}>Description</SectionHeader>
                            <Select
                                size="sm"
                                value={templateId}
                                onChange={(_e, value) => {
                                    if (value) applyTemplate(value as TaskTemplateId);
                                }}
                                startDecorator={<DescriptionRoundedIcon sx={{ fontSize: 16 }} />}
                                renderValue={(opt) => {
                                    const tpl = opt
                                        ? TASK_TEMPLATES[opt.value as TaskTemplateId]
                                        : null;
                                    return (
                                        <Typography level="body-xs" sx={{ fontWeight: 600 }}>
                                            Template: {tpl?.label ?? "Standard task"}
                                        </Typography>
                                    );
                                }}
                                slotProps={{
                                    listbox: { sx: { maxWidth: 320 } },
                                }}
                                sx={{
                                    minWidth: 220,
                                    fontSize: 12,
                                    "--Select-paddingInline": "10px",
                                    background: isDark
                                        ? "rgba(255,255,255,0.04)"
                                        : "rgba(0,0,0,0.025)",
                                }}
                            >
                                {TASK_TEMPLATE_OPTIONS.map((tpl) => (
                                    <Option key={tpl.id} value={tpl.id}>
                                        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                                            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                                                {tpl.label}
                                            </Typography>
                                            <Typography
                                                level="body-xs"
                                                sx={{
                                                    color: isDark
                                                        ? "rgba(255,255,255,0.6)"
                                                        : "rgba(0,0,0,0.6)",
                                                }}
                                            >
                                                {tpl.description}
                                            </Typography>
                                        </Stack>
                                    </Option>
                                ))}
                            </Select>
                        </Stack>
                        <Box
                            sx={{
                                p: 2,
                                borderRadius: "12px",
                                background: isDark
                                    ? "rgba(255,255,255,0.02)"
                                    : "rgba(0,0,0,0.015)",
                                border: "1px solid",
                                borderColor: isDark
                                    ? "rgba(255,255,255,0.04)"
                                    : "rgba(0,0,0,0.04)",
                                minHeight: 200,
                            }}
                        >
                            <TaskCreateBodyBlock
                                body={body}
                                useCM={useCM}
                                myself={myself}
                                setBody={setBody}
                                setMyself={setMyself}
                                socket={socket}
                                taskId={taskContent.id}
                                useTEM={useTEM}
                                useUISM={useUISM}
                                onEditorReady={handleEditorReady}
                            />
                        </Box>

                        <SectionDivider isDark={isDark} />

                        {/* Attachments Section */}
                        <SectionHeader isDark={isDark}>Attachments</SectionHeader>
                        <TaskCreateAttachmentBlock
                            setTaskContent={setTaskContent}
                            taskContent={taskContent}
                        />
                    </Box>

                    {/* Footer Section */}
                    <Box
                        sx={{
                            p: 2.5,
                            borderTop: "1px solid",
                            borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                            background: isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)",
                        }}
                    >
                        {creationKind === "milestone" ? (
                            <Stack direction="row" sx={{ justifyContent: "flex-end", gap: 1.5 }}>
                                <Button
                                    size="sm"
                                    variant="plain"
                                    color="neutral"
                                    onClick={() => {
                                        useTM.setIsCreatingTask({
                                            flag: false,
                                            parentTaskId: null,
                                            rootTaskId: null,
                                            creationKind: "task",
                                            milestoneId: null,
                                        });
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    color="primary"
                                    startDecorator={<FlagRoundedIcon sx={{ fontSize: 14 }} />}
                                    disabled={!taskTitle.trim() || !taskContent.project?.projectId}
                                    loading={isCreatingMilestone}
                                    onClick={handleCreateMilestone}
                                >
                                    Create Milestone
                                </Button>
                            </Stack>
                        ) : (
                            <TaskCreateFooter
                                accessToken={accessToken}
                                useCM={useCM}
                                useTM={useTM}
                                myself={myself}
                                usePM={usePM}
                                setIsSubmitted={setIsSubmitted}
                                setTitleError={setTitleError}
                                setTitleErrorOpen={setTitleErrorOpen}
                                socket={socket}
                                taskContent={taskContent}
                                taskTitle={taskTitle}
                            />
                        )}
                    </Box>
                </Sheet>
            )}
        </>
    );
};
