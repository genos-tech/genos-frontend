import {
    Dispatch,
    SetStateAction,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { loadTaskMeta } from "../../features/notes/task-notes/services/loadTaskMeta";
import {
    createTaskDependency,
    CreateTaskDependencyResult,
} from "../../features/tasks/services/createTaskDependency";
import { deleteTaskDependency } from "../../features/tasks/services/deleteTaskDependency";
import { loadSpecificTask } from "../../features/tasks/services/loadSpecificTask";
import {
    loadTaskDependencies,
    loadTaskDependenciesForTasks,
} from "../../features/tasks/services/loadTaskDependencies";
import { popSpecificProjectTasks } from "../../features/tasks/services/popSpecificProjectTasks";
import { ProjectTemplateDefaults } from "../../features/tasks/services/projectTemplateDefaults";
import { buildTaskTree } from "../../features/tasks/utils/buildTaskTree";
import { ProjectTaskFieldRules } from "../../features/tasks/utils/taskFieldRules";
import { CustomTaskTemplate } from "../../features/tasks/utils/taskTemplates";
import { UserProps } from "../../types/admin";
import {
    TaskCommentProps,
    TaskDependencies,
    TaskMetaProps,
    TaskMetaTreeNode,
    TaskProps,
    TaskTableProps,
    TaskTypesProps,
} from "../../types/tasks";
import { getLocalCurrentDate, getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { initCurrentTaskChain } from "./sidebar";

// Draft snapshot of an in-progress CreateTaskForm. Persisted to
// localStorage in `setTaskDraft` below so navigating away from the
// task page (or even reloading the browser) doesn't lose the user's
// typing. Attachments are intentionally excluded — they're uploaded
// files tied to a backend empty-task id, which doesn't survive
// re-mount cleanly.
export type TaskDraft = {
    taskContent: TaskProps;
    taskTitle: string;
    body: any[];
    assignee: UserProps | null;
    reporter: UserProps;
    // A built-in TaskTemplateId or a namespaced `custom:{id}` value.
    templateId: string;
    savedAt: string;
};

const TASK_DRAFT_KEY = "createTaskForm:draft:v1";
const TASK_DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Field-wise equality for a table row. Used by the preview→row mirror to
// recognise a no-op patch and hand back the previous `allTasks` array
// unchanged, so a plain task OPEN doesn't churn the array identity that
// the filter pipeline, the table's tree indexes and the sprint board all
// key off. See the mirror effect for the full rationale.
//
// `patched` is built as `{ ...task, ...overrides }`, so its key set covers
// the row; every field compares by `===` except `tags`, which the preview
// always supplies as a fresh array instance even when the tag set is
// identical — comparing that by reference would report "changed" on every
// single open and defeat the whole guard.
const isSameTableRow = (a: TaskTableProps, b: TaskTableProps): boolean => {
    for (const key of Object.keys(b) as (keyof TaskTableProps)[]) {
        if (key === "tags") continue;
        if (a[key] !== b[key]) return false;
    }
    const aTags = a.tags ?? [];
    const bTags = b.tags ?? [];
    if (aTags.length !== bTags.length) return false;
    return aTags.every(
        (tag, i) => tag?.tagName === bTags[i]?.tagName && tag?.tagColor === bTags[i]?.tagColor
    );
};

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
        // Chat-thread origin, captured AT CLICK TIME by the thread
        // header's "Create task" action — the ONLY entry point that may
        // set it. Every other opener leaves it absent, which is what
        // makes the linkage trustworthy: the create submit reads this
        // (via the form's taskContent seed) instead of sniffing
        // useCM.currentThreadChat at submit time, which still holds the
        // LAST thread after the pane closes (the close handler writes a
        // dummy that keeps the ids) and silently linked tasks created
        // from the tasks page / PM header to an unrelated thread.
        fromThread?: {
            chatType: number;
            chatId: string;
            threadId: string;
        } | null;
    };
    // Widened to `Dispatch<SetStateAction<...>>` so callers can patch a
    // single field via functional updates (`(prev) => ({ ...prev, flag: false })`)
    // without reading `useTM.isCreatingTask` at render time. That older
    // read-then-capture pattern produced a stale-closure trap once
    // `React.memo` was added to message bubbles / task rows that own
    // those click handlers.
    setIsCreatingTask: Dispatch<
        SetStateAction<{
            flag: boolean;
            parentTaskId: number | null;
            rootTaskId: number | null;
            creationKind: "task" | "milestone";
            milestoneId: number | null;
            fromThread?: {
                chatType: number;
                chatId: string;
                threadId: string;
            } | null;
        }>
    >;

    // Project state
    tsLastLoadProjectTasks: number | undefined;
    setTsLastLoadProjectTasks: (ts: number | undefined) => void;

    // Current task state
    currentPreviewTaskId: number;
    setCurrentPreviewTaskId: (id: number) => void;
    currentPreviewTask: TaskProps | undefined;
    setCurrentPreviewTask: (
        task: TaskProps | undefined | ((prev: TaskProps | undefined) => TaskProps | undefined)
    ) => void;
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

    // Custom project body templates (create-form picker + manage modal)
    projectTaskTemplates: CustomTaskTemplate[];
    setProjectTaskTemplates: (templates: CustomTaskTemplate[]) => void;
    openManageTemplates: boolean;
    setOpenManageTemplates: (open: boolean) => void;
    // Bumped after any create/edit/delete so the create form refetches.
    templatesDirty: boolean;
    setTemplatesDirty: (dirty: boolean) => void;
    // Per-project default template applied to new tasks/milestones.
    templateDefaults: ProjectTemplateDefaults;
    setTemplateDefaults: (defaults: ProjectTemplateDefaults) => void;

    // Owner-configured per-project field rules (required metadata +
    // default values for task/milestone creation). Tagged with the
    // projectId they belong to so consumers detect staleness; null
    // until first load. No dirty flag: the customize modal writes the
    // PUT response straight back into this slot.
    taskFieldRules: ProjectTaskFieldRules | null;
    setTaskFieldRules: (value: ProjectTaskFieldRules | null) => void;

    // Initial empty task
    initialEmptyTaskId: number | undefined;
    setInitialEmptyTaskId: (id: number | undefined) => void;

    // In-progress draft of the CreateTaskForm. Backed by a ref + localStorage
    // — intentionally NOT React state — so saving on every keystroke doesn't
    // trigger a re-render cascade across every consumer of `useTM`. Call
    // `getTaskDraft()` to read the latest value; CreateTaskForm only needs
    // it once on mount for hydration.
    getTaskDraft: () => TaskDraft | null;
    setTaskDraft: (draft: TaskDraft | null) => void;

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

    // Task metadata. `taskMetaTree` is derived from `taskMeta` via useMemo;
    // callers that need to clear the tree should clear `taskMeta` instead.
    taskMeta: TaskMetaProps[];
    setTaskMeta: Dispatch<SetStateAction<TaskMetaProps[]>>;
    taskMetaTree: TaskMetaTreeNode[];
    currentTaskChain: TaskMetaTreeNode[];
    setCurrentTaskChain: (chain: TaskMetaTreeNode[]) => void;

    // Task visibility
    isTaskVisibleInNote: boolean;
    setIsTaskVisibleInNote: (visible: boolean) => void;

    // Task dependencies (blocking / blocked-by). Keyed by task id so
    // multiple previews can coexist without thrashing the same slot.
    taskDependencies: Record<number, TaskDependencies>;
    loadTaskDependenciesFor: (taskId: number) => Promise<void>;
    addTaskDependency: (args: {
        blockerTaskId: number;
        blockedTaskId: number;
        focusedTaskId: number;
    }) => Promise<CreateTaskDependencyResult>;
    removeTaskDependency: (dependencyId: number, focusedTaskId: number) => Promise<boolean>;

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
        // See TaskManagementState.isCreatingTask — optional so the many
        // full-object writers (open/teardown sites) reset it to absent
        // just by omitting the key.
        fromThread?: {
            chatType: number;
            chatId: string;
            threadId: string;
        } | null;
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

    // Synchronous mirror of the LATEST selected preview task id. The async
    // loaders (`loadTask` / `loadUpdatedTask`) read this AFTER their await
    // to decide whether their result is still the task the user has
    // selected. Updated synchronously inside the setters below (NOT via an
    // effect) so a load resolving after a rapid switch sees the final
    // selection. This is the identity invariant: the preview is written
    // only with the task currently selected — so a stale-id load (e.g.
    // `loadUpdatedTask` firing from an older render closure) can't clobber
    // the final selection, and a same-id refresh can't orphan the switch's
    // own write. `-1` is the "nothing selected" sentinel.
    const currentPreviewTaskIdRef = useRef<number>(-1);

    // The preview pane shows either a task or a milestone, never both.
    // Picking one resets the other so old state can't bleed through and
    // freeze the pane on a stale entity (was the root cause of the
    // "stuck on milestone, can't open another task" bug).
    const setCurrentPreviewTaskId = (id: number) => {
        currentPreviewTaskIdRef.current = id;
        _setCurrentPreviewTaskId(id);
        if (id !== -1) {
            setCurrentPreviewKind("task");
            _setCurrentPreviewMilestoneId(-1);
        } else {
            // Deselecting (e.g. closing the preview) must also drop the
            // loaded task object. Otherwise a stale `currentPreviewTask`
            // lingers, and on the NEXT open — which sets the id first and
            // loads the object a beat later — the URL-sync effect publishes
            // the OLD task's id to the URL (it navigates off
            // `currentPreviewTask.id`, not the freshly-set id). The
            // URL→state effect then reads that stale id back and reverts the
            // pane to the previously-viewed task. Mirrors
            // `setCurrentPreviewMilestoneId`, which already clears it.
            setCurrentPreviewTask(undefined);
        }
    };
    const setCurrentPreviewMilestoneId = (id: number) => {
        _setCurrentPreviewMilestoneId(id);
        if (id !== -1) {
            currentPreviewTaskIdRef.current = -1;
            setCurrentPreviewKind("milestone");
            _setCurrentPreviewTaskId(-1);
            setCurrentPreviewTask(undefined);
        }
    };

    const closeTaskPreview = () => {
        currentPreviewTaskIdRef.current = -1;
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

    // Custom project body templates
    const [projectTaskTemplates, setProjectTaskTemplates] = useState<CustomTaskTemplate[]>([]);
    const [openManageTemplates, setOpenManageTemplates] = useState(false);
    const [templatesDirty, setTemplatesDirty] = useState(false);
    const [templateDefaults, setTemplateDefaults] = useState<ProjectTemplateDefaults>({
        task: null,
        milestone: null,
    });

    // Owner-configured per-project field rules (see interface note).
    const [taskFieldRules, setTaskFieldRules] = useState<ProjectTaskFieldRules | null>(null);

    // Initial empty task
    const [initialEmptyTaskId, setInitialEmptyTaskId] = useState<number | undefined>(undefined);

    // CreateTaskForm draft — stored in a ref (not React state) so the
    // per-keystroke save in CreateTaskForm doesn't trigger a re-render
    // cascade through every `useTM` consumer. localStorage is the durable
    // backing; the ref just caches the parsed value to avoid re-parsing
    // JSON on every read. `getTaskDraft()` is the read API.
    const taskDraftRef = useRef<TaskDraft | null | undefined>(undefined);

    const getTaskDraft = useCallback((): TaskDraft | null => {
        if (taskDraftRef.current !== undefined) return taskDraftRef.current;
        try {
            const raw = localStorage.getItem(TASK_DRAFT_KEY);
            if (!raw) {
                taskDraftRef.current = null;
                return null;
            }
            const parsed = JSON.parse(raw) as TaskDraft;
            // Drop stale drafts so we don't surprise the user weeks later
            // with content from a project they may have forgotten about.
            const ageMs = Date.now() - new Date(parsed.savedAt).getTime();
            if (!Number.isFinite(ageMs) || ageMs > TASK_DRAFT_TTL_MS) {
                localStorage.removeItem(TASK_DRAFT_KEY);
                taskDraftRef.current = null;
                return null;
            }
            taskDraftRef.current = parsed;
            return parsed;
        } catch {
            taskDraftRef.current = null;
            return null;
        }
    }, []);

    const setTaskDraft = useCallback((next: TaskDraft | null) => {
        taskDraftRef.current = next;
        try {
            if (next) {
                localStorage.setItem(TASK_DRAFT_KEY, JSON.stringify(next));
            } else {
                localStorage.removeItem(TASK_DRAFT_KEY);
            }
        } catch {
            // localStorage might be disabled / full / private mode — fall
            // back silently; the ref still holds the value for this session.
        }
    }, []);

    // Task state management
    const [isNewTaskCreated, setIsNewTaskCreated] = useState(false);
    const [isTaskUpdated, setIsTaskUpdated] = useState(false);
    const [isTaskUpdatedBySomeone, setIsTaskUpdatedBySomeone] = useState(false);

    // Task lists
    const taskTypes: TaskTypesProps = {
        all: {
            id: 0,
            statuses: ["Open", "WIP", "Blocked", "Pending", "Closed", "Deleted"],
            name: "All",
        },
        ongoing: { id: 1, statuses: ["Open", "WIP", "Blocked", "Pending"], name: "Ongoing" },
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
    // Derived: same-render compute via useMemo. Previously a `useState` +
    // `useEffect(() => setTaskMetaTree(buildTaskTree(taskMeta)), [taskMeta])`
    // pair, which cost an extra commit per meta update.
    const taskMetaTree = useMemo<TaskMetaTreeNode[]>(() => buildTaskTree(taskMeta), [taskMeta]);
    const [currentTaskChain, setCurrentTaskChain] = useState<TaskMetaTreeNode[]>([]);

    // Task visibility
    const [isTaskVisibleInNote, setIsTaskVisibleInNote] = useState(false);

    // Initialize task states
    const initializeTaskStates = () => {
        setIsNewTaskCreated(false);
        setIsTaskUpdated(false);
        setAllTasks([]);
        // Clear `taskMeta`; `taskMetaTree` is derived and will refresh.
        setTaskMeta([]);
        setCurrentTaskChain([]);
        setIsTaskVisibleInNote(false);
    };

    // Look up the canonical `updatedAt` for a task from the (freshly
    // refreshed) project task list. Returned as `string | null` so it
    // can be passed straight through `loadSpecificTask`'s freshness
    // guard — null disables the guard for tasks not yet in the list.
    const expectedUpdatedAtFromList = (taskId: number): string | null => {
        const row = allTasks.find((t) => t.id != null && String(t.id) === String(taskId));
        return row?.updatedAt ?? null;
    };

    // Load specific task
    const loadTask = async (projectId: number, taskId: number) => {
        try {
            const loadedTask: TaskProps[] = await loadSpecificTask(
                myself,
                projectId,
                taskId,
                accessToken,
                { expectedMinUpdatedAt: expectedUpdatedAtFromList(taskId) }
            );

            // Identity guard: only write the preview if the task we loaded is
            // STILL the one the user has selected. Without this, a load that
            // resolves after a rapid switch (or a stale-closure loadUpdatedTask)
            // overwrites the final selection with the wrong task. The ref holds
            // the latest selected id, updated synchronously on every switch.
            if (
                loadedTask.length > 0 &&
                String(loadedTask[0].id) === String(currentPreviewTaskIdRef.current)
            ) {
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
                accessToken,
                { expectedMinUpdatedAt: expectedUpdatedAtFromList(currentPreviewTaskId) }
            );

            // No need to update the current preview task when a new tag is
            // created. Same identity guard as `loadTask`: only write the
            // preview when the loaded task is still the selected one (the
            // `allTasks` upsert below stays unconditional — a superseded
            // refresh must still land in the table).
            if (
                isNewTagCreated === false &&
                loadedTask.length > 0 &&
                String(loadedTask[0].id) === String(currentPreviewTaskIdRef.current)
            ) {
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
                    // Carry the backend displayId ("TP-1110") onto the
                    // table row. Without it the freshly-created task (this
                    // upsert IS the row the table renders right after
                    // create) falls back to "#<id>" in `formatTaskDisplayId`
                    // until the next full project-tasks reload replaces it.
                    displayId: loadedTask[0].displayId ?? null,
                    title: loadedTask[0].title || "",
                    priority: loadedTask[0].priority.priority || null,
                    effortLevel: loadedTask[0].effortLevel.level || null,
                    createdDate: loadedTask[0].createdDate || null,
                    updatedAt: loadedTask[0].updatedAt || null,
                    dueDate: loadedTask[0].dueDate || null,
                    daysLeft: loadedTask[0].daysLeft || null,
                    status: loadedTask[0].status.status || null,
                    assigneeId: loadedTask[0].assignee?.userId ?? null,
                    assigneeEmail: loadedTask[0].assignee?.userEmail ?? null,
                    assigneeName: loadedTask[0].assignee?.userName ?? null,
                    assigneeImgPath: loadedTask[0].assignee?.avatarImgPath ?? null,
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

    // Task dependencies state. Refetch is the only way to mutate this
    // — add/remove call through and re-pull the affected task's entry.
    // We deliberately refresh BOTH endpoints when we have them so the
    // other task's preview (if it's also open in the table or another
    // pane) sees the new edge without a manual reload.
    const [taskDependencies, setTaskDependencies] = useState<Record<number, TaskDependencies>>({});

    const loadTaskDependenciesFor = useCallback(
        async (taskId: number) => {
            const result = await loadTaskDependencies(taskId, accessToken);
            if (result) {
                setTaskDependencies((prev) => ({ ...prev, [taskId]: result }));
            }
        },
        [accessToken]
    );

    const addTaskDependency = useCallback(
        async (args: {
            blockerTaskId: number;
            blockedTaskId: number;
            focusedTaskId: number;
        }): Promise<CreateTaskDependencyResult> => {
            const result = await createTaskDependency(
                args.blockerTaskId,
                args.blockedTaskId,
                accessToken
            );
            if (result.ok) {
                // Refresh both endpoints plus the explicit focused id
                // (covers the rare case where the focused id is neither
                // — shouldn't happen but cheap to be safe). One batched
                // request instead of three sequential round-trips.
                const refreshed = await loadTaskDependenciesForTasks(
                    [args.focusedTaskId, args.blockerTaskId, args.blockedTaskId],
                    accessToken
                );
                if (refreshed) {
                    setTaskDependencies((prev) => ({ ...prev, ...refreshed }));
                }
            }
            return result;
        },
        [accessToken]
    );

    const removeTaskDependency = useCallback(
        async (dependencyId: number, focusedTaskId: number): Promise<boolean> => {
            const result = await deleteTaskDependency(dependencyId, accessToken);
            if (result.ok) {
                await loadTaskDependenciesFor(focusedTaskId);
            }
            return result.ok;
        },
        [accessToken, loadTaskDependenciesFor]
    );

    const fetchProjectTasks = async (projectId: number) => {
        setTsLastLoadProjectTasks(Date.now());
        setIsLoadingTasks(true);
        try {
            const _allTasks: TaskTableProps[] = await popSpecificProjectTasks(
                projectId,
                taskTypes.all.statuses
            );
            // Stable-identity guard. After the SWR pre-read in
            // ProjectsListItem paints stale rows from IDB, the network
            // round-trip completes and the `tsTasksLoadedToIDB` effect calls
            // us again — at which point the fresh IDB read often matches the
            // already-painted set exactly. Returning `prev` in that case keeps
            // the array identity stable and avoids bouncing every downstream
            // memo (childrenByParent / allChildrenByParent / displayRows /
            // sort comparators) and re-rendering every row.
            setAllTasks((prev) => {
                if (prev.length !== _allTasks.length) return _allTasks;
                for (let i = 0; i < prev.length; i++) {
                    if (
                        prev[i].id !== _allTasks[i].id ||
                        prev[i].updatedAt !== _allTasks[i].updatedAt
                    ) {
                        return _allTasks;
                    }
                }
                return prev;
            });
        } finally {
            setIsLoadingTasks(false);
        }
    };

    initCurrentTaskChain({
        taskMeta: taskMeta,
        currentTaskChain: currentTaskChain,
        setCurrentTaskChain: setCurrentTaskChain,
    });

    // taskMetaTree is derived from taskMeta via useMemo above; the redundant
    // effect that mirrored it into local state has been removed.

    useEffect(() => {
        // Update an ongoing task. We spread the existing row first so
        // milestone-only fields (`isMilestone`, `milestoneId`, `sprintId`)
        // — which `currentPreviewTask` doesn't always carry — survive the
        // patch. Without this, clicking a milestone backing row would
        // strip those fields and break TaskFilterMenu's milestone-scope
        // filter (the chip falls back to "Milestone: #<id>" and the row
        // disappears from a scoped SprintBoard).
        //
        // Identity discipline: this effect fires on every task OPEN, not
        // just on a real edit (TaskPreview flips `isTaskUpdated` as part of
        // its mount/sync cycle). The patch below is then a no-op — it
        // rewrites the row to the values it already had. The old `.map`
        // nonetheless allocated a fresh array every time, and a new
        // `allTasks` identity is expensive downstream: TaskFilterMenu
        // re-runs `applyFilters` (O(N)) plus a sort (O(N log N)), the table
        // rebuilds `childrenByParent` / `displayRows`, and the sprint board
        // re-runs its column-organizing effect. That whole cascade ran on
        // every task open and scaled with the project's task count — the
        // shared half of the task-switch jank.
        //
        // So: patch in place, and when nothing actually changed return the
        // PREVIOUS array so its identity is preserved and the cascade never
        // starts. A real edit still produces a new array exactly as before.
        if (isTaskUpdated && currentPreviewTask) {
            setAllTasks((prevTasks) => {
                const targetId = String(currentPreviewTask.id);
                const idx = prevTasks.findIndex((task) => task.id === targetId);
                if (idx === -1) return prevTasks;
                const task = prevTasks[idx];
                const patched: TaskTableProps = {
                    ...task,
                    id: String(currentPreviewTask.id) || task.id,
                    title: currentPreviewTask.title || task.title,
                    priority: currentPreviewTask.priority.priority || task.priority,
                    effortLevel: currentPreviewTask.effortLevel.level || task.effortLevel,
                    createdDate:
                        currentPreviewTask.createdDate ||
                        task.createdDate ||
                        getLocalCurrentDate(),
                    updatedAt: currentPreviewTask.updatedAt || getLocalCurrentTimestamp(),
                    dueDate: currentPreviewTask.dueDate ?? task.dueDate,
                    daysLeft: currentPreviewTask.daysLeft ?? task.daysLeft,
                    status: currentPreviewTask.status.status || task.status,
                    assigneeId: currentPreviewTask.assignee?.userId ?? task.assigneeId,
                    assigneeEmail: currentPreviewTask.assignee?.userEmail ?? task.assigneeEmail,
                    assigneeName: currentPreviewTask.assignee?.userName ?? task.assigneeName,
                    assigneeImgPath:
                        currentPreviewTask.assignee?.avatarImgPath ?? task.assigneeImgPath,
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
                    isMilestone: currentPreviewTask.isMilestone ?? task.isMilestone ?? false,
                    milestoneId: currentPreviewTask.milestoneId ?? task.milestoneId ?? null,
                    sprintId: currentPreviewTask.sprintId ?? task.sprintId ?? null,
                };
                if (isSameTableRow(task, patched)) return prevTasks;
                const next = prevTasks.slice();
                next[idx] = patched;
                return next;
            });
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

        // Custom project body templates
        projectTaskTemplates,
        setProjectTaskTemplates,
        openManageTemplates,
        setOpenManageTemplates,
        templatesDirty,
        setTemplatesDirty,
        templateDefaults,
        setTemplateDefaults,
        taskFieldRules,
        setTaskFieldRules,

        // Initial empty task
        initialEmptyTaskId,
        setInitialEmptyTaskId,

        // CreateTaskForm draft
        getTaskDraft,
        setTaskDraft,

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

        // Task metadata (taskMetaTree derived from taskMeta via useMemo)
        setTaskMeta,
        taskMeta,
        taskMetaTree,
        currentTaskChain,
        setCurrentTaskChain,

        // Task visibility
        isTaskVisibleInNote,
        setIsTaskVisibleInNote,

        // Task dependencies
        taskDependencies,
        loadTaskDependenciesFor,
        addTaskDependency,
        removeTaskDependency,

        // Functions
        loadTask,
        loadUpdatedTask,
        initializeTaskStates,
        getTaskMeta,
        handleCreateTask,
        fetchProjectTasks,
    };
};
