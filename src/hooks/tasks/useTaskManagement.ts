import { Dispatch, SetStateAction, useEffect, useState } from "react";

import { popSpecificProjectTasks } from "../../features/chat/services/popSpecificProjectTasks";
import { loadTaskMeta } from "../../features/notes/task-notes/services/loadTaskMeta";
import { loadSpecificTask } from "../../features/tasks/services/loadSpecificTask";
import { buildTaskTree } from "../../features/tasks/utils/buildTaskTree";
import { UserProps } from "../../types/admin";
import {
    TaskCommentProps,
    TaskMetaProps,
    TaskMetaTreeNode,
    TaskProps,
    TaskTableProps,
    TaskTypesProps,
} from "../../types/tasks";
import { getLocalCurrentDate, getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { initCurrentTaskChain } from "./sidebar";

export interface TaskManagementState {
    // Task preview state
    isTaskPreviewVisible: boolean;
    setIsTaskPreviewVisible: (visible: boolean) => void;
    isTaskTableVisible: boolean;
    setIsTaskTableVisible: (visible: boolean) => void;
    isTaskDashboardVisible: boolean;
    setIsTaskDashboardVisible: (visible: boolean) => void;
    isSprintBoardVisible: boolean;
    setIsSprintBoardVisible: (visible: boolean) => void;

    // Task creation state
    isCreatingTask: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
        creationKind: "task" | "milestone";
        // When set, the new task is being created inside a milestone:
        // the create form pre-selects this milestone and hides the
        // "Create as Milestone" toggle (milestones can't have child
        // milestones).
        milestoneId: number | null;
    };
    setIsCreatingTask: (creating: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
        creationKind: "task" | "milestone";
        milestoneId: number | null;
    }) => void;

    // Project state
    tsLastLoadProjectTasks: number | undefined;
    setTsLastLoadProjectTasks: (ts: number | undefined) => void;

    // Current task state
    currentPreviewTaskId: number;
    setCurrentPreviewTaskId: (id: number) => void;
    currentPreviewTask: TaskProps | undefined;
    setCurrentPreviewTask: (task: TaskProps | undefined) => void;
    // Whether the right-hand preview pane is showing a task or a
    // milestone. When `milestone`, `currentPreviewMilestoneId` carries
    // which milestone to render and `currentPreviewTask*` are unused.
    currentPreviewKind: "task" | "milestone";
    setCurrentPreviewKind: (kind: "task" | "milestone") => void;
    currentPreviewMilestoneId: number;
    setCurrentPreviewMilestoneId: (id: number) => void;

    // Filter the task table to a single milestone (its backing task +
    // children). `null` means no milestone-scoped filter.
    tableMilestoneFilterId: number | null;
    setTableMilestoneFilterId: (id: number | null) => void;

    // Reset the task / milestone preview pane (closes the pane and
    // clears `currentPreview*` ids). Use this on project changes so the
    // right-hand pane doesn't hold a stale milestone/task from the
    // previous project.
    closeTaskPreview: () => void;

    // Task update state
    isTaskCommentUpdated: { isUpdate: boolean; scrollToBottom: boolean };
    setIsTaskCommentUpdated: (updated: { isUpdate: boolean; scrollToBottom: boolean }) => void;

    // Comments for the currently-previewed task. Hoisted to the hook
    // (was local in TaskPreview) so the chat thread's "Comments" tab
    // and TaskTabBlock's existing comments tab stay in sync without
    // either side double-fetching. Repopulated automatically by an
    // effect below whenever `currentPreviewTaskId` or
    // `isTaskCommentUpdated.isUpdate` changes.
    taskComments: TaskCommentProps[];
    setTaskComments: Dispatch<SetStateAction<TaskCommentProps[]>>;
    taskCommentLines: number;
    setTaskCommentLines: Dispatch<SetStateAction<number>>;

    // Tag and project creation
    openCreateTag: boolean;
    setOpenCreateTag: (open: boolean) => void;
    isNewTagCreated: boolean;
    setIsNewTagCreated: (created: boolean) => void;

    // Initial empty task
    initialEmptyTaskId: number | undefined;
    setInitialEmptyTaskId: (id: number | undefined) => void;

    // Task state management
    isNewTaskCreated: boolean;
    setIsNewTaskCreated: (created: boolean) => void;
    isTaskUpdated: boolean;
    setIsTaskUpdated: (updated: boolean) => void;
    isTaskUpdatedBySomeone: boolean;
    setIsTaskUpdatedBySomeone: (updated: boolean) => void;

    // Task lists
    allTasks: TaskTableProps[];
    // Exposed as a full SetStateAction so callers (e.g. the milestone
    // preview's persistFromTaskContent) can patch a single row by id
    // without a full reload.
    setAllTasks: Dispatch<SetStateAction<TaskTableProps[]>>;

    // Task list loading state (true while we are actively fetching tasks for the
    // current project). Used by the table UI to show a "waiting to load tasks"
    // spinner instead of the empty state during the load.
    isLoadingTasks: boolean;
    setIsLoadingTasks: (loading: boolean) => void;

    // Task metadata
    taskMetaTree: TaskMetaTreeNode[];
    setTaskMetaTree: (tree: TaskMetaTreeNode[]) => void;
    currentTaskChain: TaskMetaTreeNode[];
    setCurrentTaskChain: (chain: TaskMetaTreeNode[]) => void;

    // Task visibility
    isTaskVisibleInNote: boolean;
    setIsTaskVisibleInNote: (visible: boolean) => void;

    // Functions
    loadTask: (projectId: number, taskId: number) => Promise<void>;
    loadUpdatedTask: (projectId: number) => Promise<void>;
    initializeTaskStates: () => void;
    getTaskMeta: () => Promise<void>;
    handleCreateTask: () => void;
    fetchProjectTasks: (projectId: number) => Promise<void>;
}

export const useTaskManagement = (
    myself: UserProps,
    accessToken: string | null
): TaskManagementState => {
    // Task visible states
    const [isTaskPreviewVisible, setIsTaskPreviewVisible] = useState(false);
    const [isTaskTableVisible, _setIsTaskTableVisible] = useState(true);
    const [isTaskDashboardVisible, _setIsTaskDashboardVisible] = useState(false);
    const [isSprintBoardVisible, _setIsSprintBoardVisible] = useState(false);

    // Wrapper functions to ensure mutual exclusivity of main view panels
    // Only one of TaskHome (Table), Dashboard, or SprintBoard can be visible at a time
    const setIsTaskTableVisible = (visible: boolean) => {
        if (visible) {
            _setIsTaskDashboardVisible(false);
            _setIsSprintBoardVisible(false);
        }
        _setIsTaskTableVisible(visible);
    };

    const setIsTaskDashboardVisible = (visible: boolean) => {
        if (visible) {
            _setIsTaskTableVisible(false);
            _setIsSprintBoardVisible(false);
        }
        _setIsTaskDashboardVisible(visible);
    };

    const setIsSprintBoardVisible = (visible: boolean) => {
        if (visible) {
            _setIsTaskTableVisible(false);
            _setIsTaskDashboardVisible(false);
        }
        _setIsSprintBoardVisible(visible);
    };

    // Task creation state
    const [isCreatingTask, setIsCreatingTask] = useState<{
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
        creationKind: "task" | "milestone";
        milestoneId: number | null;
    }>({
        flag: false,
        parentTaskId: null,
        rootTaskId: null,
        creationKind: "task",
        milestoneId: null,
    });

    // Current task state
    const [currentPreviewTaskId, _setCurrentPreviewTaskId] = useState<number>(-1);
    const [currentPreviewTask, setCurrentPreviewTask] = useState<TaskProps | undefined>(undefined);
    const [currentPreviewKind, setCurrentPreviewKind] = useState<"task" | "milestone">("task");
    const [currentPreviewMilestoneId, _setCurrentPreviewMilestoneId] = useState<number>(-1);
    const [tableMilestoneFilterId, setTableMilestoneFilterId] = useState<number | null>(null);

    // The preview pane shows either a task or a milestone, never both.
    // Picking one resets the other so old state can't bleed through and
    // freeze the pane on a stale entity (was the root cause of the
    // "stuck on milestone, can't open another task" bug).
    const setCurrentPreviewTaskId = (id: number) => {
        _setCurrentPreviewTaskId(id);
        if (id !== -1) {
            setCurrentPreviewKind("task");
            _setCurrentPreviewMilestoneId(-1);
        }
    };
    const setCurrentPreviewMilestoneId = (id: number) => {
        _setCurrentPreviewMilestoneId(id);
        if (id !== -1) {
            setCurrentPreviewKind("milestone");
            _setCurrentPreviewTaskId(-1);
            setCurrentPreviewTask(undefined);
        }
    };

    const closeTaskPreview = () => {
        _setCurrentPreviewTaskId(-1);
        _setCurrentPreviewMilestoneId(-1);
        setCurrentPreviewKind("task");
        setCurrentPreviewTask(undefined);
        setIsTaskPreviewVisible(false);
    };

    // Task update state
    const [isTaskCommentUpdated, setIsTaskCommentUpdated] = useState({
        isUpdate: false,
        scrollToBottom: true,
    });

    // Hoisted task-comment state. See the type-side comment for
    // rationale; the load effect lives further down so both
    // TaskTabBlock's Comments tab and the new chat-thread Comments
    // tab share a single source of truth.
    const [taskComments, setTaskComments] = useState<TaskCommentProps[]>([]);
    const [taskCommentLines, setTaskCommentLines] = useState<number>(0);

    const [tsLastLoadProjectTasks, setTsLastLoadProjectTasks] = useState<number | undefined>(
        undefined
    );

    // Tag and project creation
    const [openCreateTag, setOpenCreateTag] = useState(false);
    const [isNewTagCreated, setIsNewTagCreated] = useState(false);

    // Initial empty task
    const [initialEmptyTaskId, setInitialEmptyTaskId] = useState<number | undefined>(undefined);

    // Task state management
    const [isNewTaskCreated, setIsNewTaskCreated] = useState(false);
    const [isTaskUpdated, setIsTaskUpdated] = useState(false);
    const [isTaskUpdatedBySomeone, setIsTaskUpdatedBySomeone] = useState(false);

    // Task lists
    const taskTypes: TaskTypesProps = {
        all: { id: 0, statuses: ["Open", "WIP", "Pending", "Closed", "Deleted"], name: "All" },
        ongoing: { id: 1, statuses: ["Open", "WIP", "Pending"], name: "Ongoing" },
        closed: { id: 2, statuses: ["Closed"], name: "Closed" },
        deleted: { id: 3, statuses: ["Deleted"], name: "Deleted" },
    };
    const [allTasks, setAllTasks] = useState<TaskTableProps[]>([]);
    const [isLoadingTasks, setIsLoadingTasks] = useState<boolean>(false);

    // Safety timeout: if isLoadingTasks stays true for too long (e.g. the new team
    // has no projects so fetchProjectTasks never runs), force it back to false so
    // the UI doesn't show a stuck spinner forever.
    useEffect(() => {
        if (!isLoadingTasks) return;
        const timer = setTimeout(() => {
            setIsLoadingTasks(false);
        }, 8000);
        return () => clearTimeout(timer);
    }, [isLoadingTasks]);

    // Task metadata
    const [taskMeta, setTaskMeta] = useState<TaskMetaProps[]>([]);
    const [taskMetaTree, setTaskMetaTree] = useState<TaskMetaTreeNode[]>(buildTaskTree(taskMeta));
    const [currentTaskChain, setCurrentTaskChain] = useState<TaskMetaTreeNode[]>([]);

    // Task visibility
    const [isTaskVisibleInNote, setIsTaskVisibleInNote] = useState(false);

    // Initialize task states
    const initializeTaskStates = () => {
        setIsNewTaskCreated(false);
        setIsTaskUpdated(false);
        setAllTasks([]);
        setTaskMetaTree([]);
        setCurrentTaskChain([]);
        setIsTaskVisibleInNote(false);
    };

    // Load specific task
    const loadTask = async (projectId: number, taskId: number) => {
        try {
            const loadedTask: TaskProps[] = await loadSpecificTask(
                myself,
                projectId,
                taskId,
                accessToken
            );

            if (loadedTask.length > 0) {
                setCurrentPreviewTask(loadedTask[0]);
            }
        } catch (error) {
            console.error("Error loading task:", error);
        }
    };

    const loadUpdatedTask = async (projectId: number) => {
        if (projectId && currentPreviewTaskId !== -1) {
            const loadedTask: TaskProps[] = await loadSpecificTask(
                myself,
                projectId,
                currentPreviewTaskId,
                accessToken
            );

            // No need to update the current preview task when a new tag is created.
            if (isNewTagCreated === false && loadedTask.length > 0) {
                setCurrentPreviewTask(loadedTask[0]);
            }

            // setIsTaskPreviewVisible(true);

            // Upsert the row in `allTasks`. This branch fires both when a
            // brand-new task arrives (`isNewTaskCreated`) AND when an
            // existing task is updated by someone else
            // (`isTaskUpdatedBySomeone` — pushed via socket). Previously
            // we unconditionally appended, which silently duplicated the
            // same id every time a teammate edited a task — corrupting
            // every dashboard metric that reads `allTasks`. Match by id
            // first; replace if found, otherwise append.
            //
            // Milestone-related fields are included so a freshly-merged
            // row doesn't bypass TaskFilterMenu's milestone-scope filter
            // or the chip's title lookup.
            if (isNewTaskCreated === true || isTaskUpdatedBySomeone === true) {
                const nextRow: TaskTableProps = {
                    id: String(loadedTask[0].id) || null,
                    title: loadedTask[0].title || "",
                    priority: loadedTask[0].priority.priority || null,
                    effortLevel: loadedTask[0].effortLevel.level || null,
                    createdDate: loadedTask[0].createdDate || null,
                    updatedAt: loadedTask[0].updatedAt || null,
                    dueDate: loadedTask[0].dueDate || null,
                    daysLeft: loadedTask[0].daysLeft || null,
                    status: loadedTask[0].status.status || null,
                    assigneeId: loadedTask[0].assignee.userId || null,
                    assigneeEmail: loadedTask[0].assignee.userEmail || null,
                    assigneeName: loadedTask[0].assignee.userName || null,
                    assigneeImgPath: loadedTask[0].assignee.avatarImgPath || null,
                    parentTaskId: loadedTask[0].parentTaskId
                        ? String(loadedTask[0].parentTaskId)
                        : null,
                    rootTaskId: loadedTask[0].rootTaskId ?? null,
                    threadId: loadedTask[0].threadId || null,
                    tags: loadedTask[0].tags || [],
                    concatTags: loadedTask[0].concatTags || "//",
                    teamId: myself.teamId || null,
                    projectId: loadedTask[0].project?.projectId || null,
                    isMilestone: loadedTask[0].isMilestone ?? false,
                    milestoneId: loadedTask[0].milestoneId ?? null,
                    sprintId: loadedTask[0].sprintId ?? null,
                };
                setAllTasks((prev) => {
                    const existingIdx = prev.findIndex((t) => t.id != null && t.id === nextRow.id);
                    if (existingIdx === -1) return [...prev, nextRow];
                    const next = prev.slice();
                    next[existingIdx] = nextRow;
                    return next;
                });
            }
            setIsNewTaskCreated(false);
            setIsTaskUpdatedBySomeone(false);
        }
    };

    const getTaskMeta = async () => {
        const loadedTaskMeta: TaskMetaProps[] = await loadTaskMeta(myself, accessToken);
        if (loadedTaskMeta.length > 0) {
            setTaskMeta(loadedTaskMeta);
        }
    };

    const handleCreateTask = () => {
        setIsCreatingTask({
            flag: true,
            parentTaskId: null,
            rootTaskId: null,
            creationKind: "task",
            milestoneId: null,
        });

        if (isTaskPreviewVisible === true) {
            setIsTaskTableVisible(false);
        }
    };

    const fetchProjectTasks = async (projectId: number) => {
        setTsLastLoadProjectTasks(Date.now());
        setIsLoadingTasks(true);
        try {
            const _allTasks: TaskTableProps[] = await popSpecificProjectTasks(
                projectId,
                taskTypes.all.statuses
            );
            setAllTasks(_allTasks);
        } finally {
            setIsLoadingTasks(false);
        }
    };

    initCurrentTaskChain({
        taskMeta: taskMeta,
        currentTaskChain: currentTaskChain,
        setCurrentTaskChain: setCurrentTaskChain,
    });

    useEffect(() => {
        const newTaskMetaTree = buildTaskTree(taskMeta);
        setTaskMetaTree([...newTaskMetaTree]);
    }, [taskMeta]);

    useEffect(() => {
        // Update an ongoing task. We spread the existing row first so
        // milestone-only fields (`isMilestone`, `milestoneId`, `sprintId`)
        // — which `currentPreviewTask` doesn't always carry — survive the
        // patch. Without this, clicking a milestone backing row would
        // strip those fields and break TaskFilterMenu's milestone-scope
        // filter (the chip falls back to "Milestone: #<id>" and the row
        // disappears from a scoped SprintBoard).
        if (isTaskUpdated && currentPreviewTask) {
            setAllTasks((prevTasks) =>
                prevTasks.map((task) =>
                    task.id === String(currentPreviewTask.id)
                        ? {
                              ...task,
                              id: String(currentPreviewTask.id) || task.id,
                              title: currentPreviewTask.title || task.title,
                              priority: currentPreviewTask.priority.priority || task.priority,
                              effortLevel:
                                  currentPreviewTask.effortLevel.level || task.effortLevel,
                              createdDate:
                                  currentPreviewTask.createdDate ||
                                  task.createdDate ||
                                  getLocalCurrentDate(),
                              updatedAt:
                                  currentPreviewTask.updatedAt || getLocalCurrentTimestamp(),
                              dueDate: currentPreviewTask.dueDate ?? task.dueDate,
                              daysLeft: currentPreviewTask.daysLeft ?? task.daysLeft,
                              status: currentPreviewTask.status.status || task.status,
                              assigneeId: currentPreviewTask.assignee.userId ?? task.assigneeId,
                              assigneeEmail:
                                  currentPreviewTask.assignee.userEmail ?? task.assigneeEmail,
                              assigneeName:
                                  currentPreviewTask.assignee.userName ?? task.assigneeName,
                              assigneeImgPath:
                                  currentPreviewTask.assignee.avatarImgPath ??
                                  task.assigneeImgPath,
                              parentTaskId: currentPreviewTask.parentTaskId
                                  ? String(currentPreviewTask.parentTaskId)
                                  : null,
                              rootTaskId: currentPreviewTask.rootTaskId ?? task.rootTaskId,
                              threadId: currentPreviewTask.threadId ?? task.threadId,
                              tags: currentPreviewTask.tags || task.tags,
                              concatTags: currentPreviewTask.concatTags || task.concatTags,
                              teamId: myself.teamId || task.teamId,
                              projectId: currentPreviewTask.project?.projectId ?? task.projectId,
                              // Carry milestone metadata through. Prefer the
                              // value from `currentPreviewTask` so a task->
                              // milestone promotion still propagates, but
                              // fall back to the existing row when the
                              // preview payload doesn't include it.
                              isMilestone:
                                  currentPreviewTask.isMilestone ?? task.isMilestone ?? false,
                              milestoneId:
                                  currentPreviewTask.milestoneId ?? task.milestoneId ?? null,
                              sprintId: currentPreviewTask.sprintId ?? task.sprintId ?? null,
                          }
                        : task
                )
            );
            getTaskMeta();
            setIsTaskUpdated(false);
        }
    }, [isTaskUpdated, currentPreviewTask]);

    return {
        // Task preview state
        isTaskPreviewVisible,
        setIsTaskPreviewVisible,
        isTaskTableVisible,
        setIsTaskTableVisible,
        isTaskDashboardVisible,
        setIsTaskDashboardVisible,
        isSprintBoardVisible,
        setIsSprintBoardVisible,

        // Task creation state
        isCreatingTask,
        setIsCreatingTask,

        // Project state
        tsLastLoadProjectTasks,
        setTsLastLoadProjectTasks,

        // Current task state
        currentPreviewTaskId,
        setCurrentPreviewTaskId,
        currentPreviewTask,
        setCurrentPreviewTask,
        currentPreviewKind,
        setCurrentPreviewKind,
        currentPreviewMilestoneId,
        setCurrentPreviewMilestoneId,
        tableMilestoneFilterId,
        setTableMilestoneFilterId,
        closeTaskPreview,

        // Task update state
        isTaskCommentUpdated,
        setIsTaskCommentUpdated,
        taskComments,
        setTaskComments,
        taskCommentLines,
        setTaskCommentLines,

        // Tag and project creation
        openCreateTag,
        setOpenCreateTag,
        isNewTagCreated,
        setIsNewTagCreated,

        // Initial empty task
        initialEmptyTaskId,
        setInitialEmptyTaskId,

        // Task state management
        isNewTaskCreated,
        setIsNewTaskCreated,
        isTaskUpdated,
        setIsTaskUpdated,
        isTaskUpdatedBySomeone,
        setIsTaskUpdatedBySomeone,

        // Task lists
        allTasks,
        setAllTasks,
        isLoadingTasks,
        setIsLoadingTasks,

        // Task metadata
        taskMetaTree,
        setTaskMetaTree,
        currentTaskChain,
        setCurrentTaskChain,

        // Task visibility
        isTaskVisibleInNote,
        setIsTaskVisibleInNote,

        // Functions
        loadTask,
        loadUpdatedTask,
        initializeTaskStates,
        getTaskMeta,
        handleCreateTask,
        fetchProjectTasks,
    };
};
