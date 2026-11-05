import {
    Dispatch,
    SetStateAction,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

import {
    createTaskDependency,
    CreateTaskDependencyResult,
} from "../../features/tasks/services/createTaskDependency";
import { deleteTaskDependency } from "../../features/tasks/services/deleteTaskDependency";
import { loadSpecificTask } from "../../features/tasks/services/loadSpecificTask";
import {
    loadTaskDependenciesForTasks,
    loadTaskDependenciesInto,
} from "../../features/tasks/services/loadTaskDependencies";
import { popSpecificProjectTasks } from "../../features/tasks/services/popSpecificProjectTasks";
import { ProjectTemplateDefaults } from "../../features/tasks/services/projectTemplateDefaults";
import {
    applyTreePositionToDescendants,
    resolveRootTaskId,
} from "../../features/tasks/utils/cascadeTreePosition";
import { mergeProjectRows } from "../../features/tasks/utils/mergeProjectRows";
import {
    NO_ROWS,
    ProjectRowsCache,
    projectRowsKey,
    rowsOfProject,
} from "../../features/tasks/utils/projectRowsCache";
import { ProjectTaskFieldRules } from "../../features/tasks/utils/taskFieldRules";
import { CustomTaskTemplate } from "../../features/tasks/utils/taskTemplates";
import { UserProps } from "../../types/admin";
import {
    TaskCommentProps,
    TaskDependencies,
    TaskMetaTreeNode,
    TaskProps,
    TaskTableProps,
    TaskTypesProps,
} from "../../types/tasks";
import { getLocalCurrentDate, getLocalCurrentTimestamp } from "../../utils/dateUtils";

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
    /**
     * How many times `isTaskPreviewVisible` has gone true -> false. Lives here,
     * above the keep-alive screens, because a hidden screen is frozen and never
     * sees the close; `useSurfaceTaskPreviewVisible` compares it on coming back
     * to learn that the preview was closed (and maybe reopened) while away.
     */
    previewCloseCount: number;
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
    /** Set when the by-id `loadTask` for the CURRENTLY selected task finished
     *  without producing that task (empty, errored, or a different task came
     *  back — e.g. a cross-project id the current project can't serve). Lets
     *  a host that hides the outgoing task during a switch give up waiting
     *  instead of showing a permanent loader. Cleared when the next load
     *  starts; only ever meaningful compared against `currentPreviewTaskId`. */
    previewLoadFailedTaskId: number | null;
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

    // Filter the task table / sprint board to a single milestone (its
    // backing task + children). `null` means no milestone-scoped filter.
    //
    // READ THIS as "the scope that applies right now": it reports null
    // whenever the stored scope belongs to a project other than the one
    // the user is currently in. A milestone exists in exactly one
    // project, so a scope carried across a project switch matches
    // nothing and empties the table — which is precisely the bug this
    // shape prevents. The scope is stored WITH its project rather than
    // cleared by whoever happens to switch projects; that clearing was
    // spread across call sites and the ones that forgot (Recents, task
    // search, URL navigation) produced an empty table.
    tableMilestoneFilterId: number | null;
    /** Scope to a milestone, or `null` to clear. The project the
     *  milestone belongs to is required — it is what lets the scope
     *  deactivate itself when the user moves elsewhere. */
    setTableMilestoneFilter: (value: { milestoneId: number; projectId: number } | null) => void;

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
    /**
     * Monotonic counter bumped by every project-tag mutation (create, rename,
     * delete). The project's tag list lives on `usePM.currentProject.projectTags`
     * and is fetched by exactly one effect — TaskSidebarMain's, keyed on the
     * active projectId — so creating a tag left every consumer of that list
     * (most visibly the task filter bar's Tags dropdown) stale until a reload.
     * This is the invalidation signal that effect also watches.
     *
     * A counter rather than a boolean because the mutation can repeat within a
     * session and each occurrence has to re-fire the effect; a latched flag only
     * ever transitions once.
     */
    tagsRevision: number;
    bumpTagsRevision: () => void;

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
    // Push an EDITED copy of a task onto its row in `allTasks` (the table, the
    // board and the dashboards read the row, not the preview). Called by the
    // task preview for each edit; a load or an unchanged copy leaves
    // `allTasks` untouched (same array identity). Stable across renders.
    syncPreviewEdit: (task: TaskProps) => void;

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

    currentTaskChain: TaskMetaTreeNode[];
    setCurrentTaskChain: (chain: TaskMetaTreeNode[]) => void;

    // Task visibility
    isTaskVisibleInNote: boolean;
    setIsTaskVisibleInNote: (visible: boolean) => void;

    // Task dependencies (blocking / blocked-by). Keyed by task id so
    // multiple previews can coexist without thrashing the same slot.
    taskDependencies: Record<number, TaskDependencies>;
    loadTaskDependenciesFor: (taskId: number, land?: (write: () => void) => void) => Promise<void>;
    addTaskDependency: (args: {
        blockerTaskId: number;
        blockedTaskId: number;
        focusedTaskId: number;
    }) => Promise<CreateTaskDependencyResult>;
    removeTaskDependency: (dependencyId: number, focusedTaskId: number) => Promise<boolean>;
    // Re-pull the given tasks' STATUS from the server and patch it into
    // `allTasks` + the open preview. Used after a dependency add/remove so
    // the backend's auto-"Blocked" ↔ "Open" transition (fired synchronously
    // by the dependency signal) is reflected in the UI right away, instead
    // of only after the next full project-tasks sync.
    refreshTaskStatuses: (
        refs: { taskId: number; projectId: number | null | undefined }[]
    ) => Promise<void>;

    // Functions
    loadTask: (projectId: number, taskId: number) => Promise<void>;
    loadUpdatedTask: (projectId: number) => Promise<void>;
    initializeTaskStates: () => void;
    handleCreateTask: () => void;
    fetchProjectTasks: (projectId: number) => Promise<void>;
    // The in-memory copies of the last projects' rows (see `allTasks`). Drop
    // one project's, or everything for projects that are no longer listed.
    dropCachedProjectRows: (projectId: number) => void;
    pruneCachedProjectRows: (keepProjectIds: number[]) => void;
}

// Which view of which team the rows were read for. `myself.teamId` and the
// workspace's team do not flip in the same commit during a team switch, so both
// are part of it: any change of either starts from nothing.
const teamScopeOf = (teamId: string | undefined, currentTeamId: string | undefined): string =>
    `${teamId ?? ""}|${currentTeamId ?? ""}`;

// The rows in `allTasks` and whose they are.
type RowsState = {
    teamScope: string;
    // The project the rows belong to (null: no project is open).
    projectKey: string | null;
    rows: TaskTableProps[];
    // A read of the project has landed in `rows`. An empty list can be a real
    // answer (a project with no tasks) or only "not read yet"; this tells them
    // apart, and only rows that were read are worth remembering.
    loaded: boolean;
};

export const useTaskManagement = (
    myself: UserProps,
    accessToken: string | null,
    /** The workspace's active project id. Optional: an instance built
     *  without project context simply never invalidates the milestone
     *  scope. */
    currentProjectId?: number | null,
    options?: {
        /** The team the workspace is showing. It can flip a commit before or
         *  after `myself.teamId` during a team switch, so a read is judged
         *  against both. */
        currentTeamId?: string;
        /** True only when the open project is in the team's list AND belongs
         *  to the user's own team. Rows of another team are then stale
         *  leftovers and are not shown. Anything else (a project shared from
         *  another team, where every row belongs to the HOST team, or one this
         *  hook cannot place) is shown as read: `undefined` must never empty a
         *  table. */
        isOwnTeamProject?: boolean;
    }
): TaskManagementState => {
    // Task visible states
    const [isTaskPreviewVisible, setIsTaskPreviewVisible] = useState(false);
    const [previewCloseCount, setPreviewCloseCount] = useState(0);
    const wasPreviewVisibleRef = useRef(false);
    useEffect(() => {
        if (wasPreviewVisibleRef.current && !isTaskPreviewVisible) {
            setPreviewCloseCount((n) => n + 1);
        }
        wasPreviewVisibleRef.current = isTaskPreviewVisible;
    }, [isTaskPreviewVisible]);
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
    const [previewLoadFailedTaskId, setPreviewLoadFailedTaskId] = useState<number | null>(null);
    const [currentPreviewTask, setCurrentPreviewTask] = useState<TaskProps | undefined>(undefined);
    const [currentPreviewKind, setCurrentPreviewKind] = useState<"task" | "milestone">("task");
    const [currentPreviewMilestoneId, _setCurrentPreviewMilestoneId] = useState<number>(-1);
    const [tableMilestoneFilter, setTableMilestoneFilter] = useState<{
        milestoneId: number;
        projectId: number;
    } | null>(null);
    // The scope applies only inside the project it was set for. Derived
    // rather than cleared by an effect: comparing stored-against-current
    // has no ordering hazard, where "clear when the project changes"
    // would race the one flow that switches project and scopes in the
    // same gesture (the sidebar's cross-project milestone click).
    //
    // `currentProjectId == null` means we have no project context — a
    // useTM built outside the task workspace, or the brief gap during a
    // switch while `loadProjectsAndTasks` runs. Treated as "don't
    // invalidate", so a scope about to be legitimately set survives.
    const tableMilestoneFilterId =
        tableMilestoneFilter != null &&
        (currentProjectId == null || tableMilestoneFilter.projectId === currentProjectId)
            ? tableMilestoneFilter.milestoneId
            : null;

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
        // A genuinely new selection forgets an earlier failed load, so the
        // pane can't flash a stale task for one render before `loadTask`
        // starts. A same-id re-click must NOT clear it: no load re-runs for an
        // unchanged id, and clearing would turn a failed load into a permanent
        // loader.
        if (id !== currentPreviewTaskIdRef.current) setPreviewLoadFailedTaskId(null);
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
    const [tagsRevision, setTagsRevision] = useState(0);
    // Functional update so two tag mutations in the same tick can't collapse
    // into one bump, and stable so consumers can hold it across renders.
    const bumpTagsRevision = useCallback(() => setTagsRevision((n) => n + 1), []);

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
    // --- The open project's rows -------------------------------------------
    //
    // `allTasks` holds the rows of the OPEN project, and it changes with the
    // open project in the very render the project changes: a project the user
    // saw lately paints its remembered rows at once (the reconcile read that
    // follows corrects them), any other starts empty with the spinner. So no
    // commit ever shows one project with another project's rows, whichever way
    // the project was changed (sidebar click, Recents, Back/Forward, chat).
    //
    // This is React's "adjust state while rendering" pattern, on purpose NOT an
    // effect: an effect would commit once with the new project and the old rows.
    // React discards the render it was made in and renders again straight away,
    // so nothing renders from the discarded pass. And on purpose HERE, in the
    // one hook instance the whole workspace reads, not in a component: Homes
    // are kept mounted while hidden, and a copy per component would swap against
    // each other.
    const teamScope = teamScopeOf(myself.teamId, options?.currentTeamId);
    const projectKey = currentProjectId != null ? String(currentProjectId) : null;
    const [rowsState, setRowsState] = useState<RowsState>(() => ({
        teamScope,
        projectKey,
        rows: NO_ROWS,
        loaded: false,
    }));
    const [isLoadingTasks, setIsLoadingTasks] = useState<boolean>(false);
    // The remembered rows of the last five projects: a plain Map behind a ref,
    // not state, because dropping an entry must not cost a render.
    const rowCacheRef = useRef<ProjectRowsCache | null>(null);
    if (rowCacheRef.current === null) rowCacheRef.current = new ProjectRowsCache();
    const rowCache = rowCacheRef.current;

    if (rowsState.teamScope !== teamScope || rowsState.projectKey !== projectKey) {
        // Reading the memory is the only thing done while rendering. It is
        // changed at commit (below), so a render that React repeats or throws
        // away (the swap itself, Strict Mode) leaves it alone.
        const hit =
            projectKey === null ? undefined : rowCache.peek(projectRowsKey(teamScope, projectKey));
        setRowsState({
            teamScope,
            projectKey,
            rows: hit ?? NO_ROWS,
            loaded: hit !== undefined,
        });
        // A miss shows the spinner in the same commit; the read that follows
        // turns it off.
        if (projectKey !== null && hit === undefined) setIsLoadingTasks(true);
    }

    // At commit: what the rows were a moment ago goes into memory under the
    // project they belonged to, and the project that is open now leaves it (its
    // rows are `allTasks`). One project is in memory once, the open one plus the
    // others never exceed `MAX_CACHED_PROJECTS`.
    const committedRowsRef = useRef<RowsState | null>(null);
    useLayoutEffect(() => {
        const before = committedRowsRef.current;
        committedRowsRef.current = rowsState;
        if (before === null) return;
        if (before.teamScope !== rowsState.teamScope) {
            // Another team: nothing remembered belongs to this view, and the rows
            // that were on screen (the old team's) are not stored.
            rowCache.clear();
            return;
        }
        if (before.projectKey === rowsState.projectKey) return;
        if (before.projectKey !== null) {
            const leaving = projectRowsKey(before.teamScope, before.projectKey);
            if (before.loaded) {
                // Only this project's own rows, and only because a read of them
                // landed: a table that never got its read (switched away from
                // at once) must not come back as an answer.
                rowCache.put(leaving, rowsOfProject(before.rows, Number(before.projectKey)));
            } else {
                rowCache.delete(leaving);
            }
        }
        if (rowsState.projectKey !== null) {
            rowCache.take(projectRowsKey(rowsState.teamScope, rowsState.projectKey));
        }
    });

    const allTasks = rowsState.rows;
    // Same signature as before (a state setter), applied to the rows of the
    // open project. A functional update sees those rows.
    const setAllTasks = useCallback<Dispatch<SetStateAction<TaskTableProps[]>>>((action) => {
        setRowsState((prev) => {
            const next = typeof action === "function" ? action(prev.rows) : action;
            if (next === prev.rows) return prev;
            // Emptied by a caller (a wipe, the last task deleted): not an answer
            // from a read any more.
            return { ...prev, rows: next, loaded: prev.loaded && next.length > 0 };
        });
    }, []);
    const dropCachedProjectRows = useCallback(
        (projectId: number) => rowCache.deleteProject(projectId),
        [rowCache]
    );
    const pruneCachedProjectRows = useCallback(
        (keepProjectIds: number[]) => rowCache.retainProjects(keepProjectIds),
        [rowCache]
    );

    // What `fetchProjectTasks` checks its answer against. Written every render
    // (the latest committed props), read after the await.
    const scopeRef = useRef({
        projectId: currentProjectId ?? null,
        teamId: myself.teamId,
        currentTeamId: options?.currentTeamId,
        isOwnTeamProject: options?.isOwnTeamProject,
    });
    scopeRef.current = {
        projectId: currentProjectId ?? null,
        teamId: myself.teamId,
        currentTeamId: options?.currentTeamId,
        isOwnTeamProject: options?.isOwnTeamProject,
    };
    // Counts the reads; a read that is no longer the newest does not land.
    const readSeqRef = useRef(0);

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

    const [currentTaskChain, setCurrentTaskChain] = useState<TaskMetaTreeNode[]>([]);

    // Task visibility
    const [isTaskVisibleInNote, setIsTaskVisibleInNote] = useState(false);

    // Initialize task states
    const initializeTaskStates = () => {
        setIsNewTaskCreated(false);
        setAllTasks([]);
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
        // A new attempt: forget the previous failure so a retry of the same id
        // (URL re-entry) shows the loader again instead of the stale task.
        setPreviewLoadFailedTaskId(null);
        // Record "the selected task did not load". Only for the task that is
        // STILL selected — a stale load for a task the user already left says
        // nothing about the current selection.
        const markFailedIfSelected = () => {
            if (String(taskId) === String(currentPreviewTaskIdRef.current)) {
                setPreviewLoadFailedTaskId(taskId);
            }
        };
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
            } else {
                markFailedIfSelected();
            }
        } catch (error) {
            console.error("Error loading task:", error);
            markFailedIfSelected();
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

            // Upsert the row in `allTasks` when a brand-new task arrives
            // (`isNewTaskCreated`). Previously we unconditionally appended,
            // which silently duplicated the same id on a repeat — corrupting
            // every dashboard metric that reads `allTasks`. Match by id
            // first; replace if found, otherwise append.
            //
            // Milestone-related fields are included so a freshly-merged
            // row doesn't bypass TaskFilterMenu's milestone-scope filter
            // or the chip's title lookup.
            if (isNewTaskCreated === true) {
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
        (taskId: number, land?: (write: () => void) => void) =>
            loadTaskDependenciesInto(
                taskId,
                accessToken,
                (result) => setTaskDependencies((prev) => ({ ...prev, [taskId]: result })),
                land
            ),
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

    // Force-refetch each task's canonical status and patch it into local
    // state. `forceRefresh` bypasses the IDB full-task cache (which would
    // still hold the pre-dependency status) and re-hydrates it, so a page
    // reload keeps the fresh status too. Status-only patches: never touches
    // body / attachments / other fields, so an in-flight edit in the open
    // preview isn't clobbered (mirrors the advisor guidance on the
    // dependency-status sync). Best-effort per task — a failed refetch just
    // leaves that row to self-heal on the next project-tasks sync.
    const refreshTaskStatuses = useCallback(
        async (
            refs: { taskId: number; projectId: number | null | undefined }[]
        ): Promise<void> => {
            await Promise.all(
                refs.map(async ({ taskId, projectId }) => {
                    if (taskId == null || projectId == null) return;
                    const loaded: TaskProps[] | undefined = await loadSpecificTask(
                        myself,
                        projectId,
                        taskId,
                        accessToken,
                        { forceRefresh: true }
                    );
                    if (!loaded || loaded.length === 0) return;
                    const fresh = loaded[0];
                    const freshStatusLabel = fresh.status?.status ?? null;

                    // 1) Patch the table row (drives table / filters / dashboard).
                    setAllTasks((prev) => {
                        const idx = prev.findIndex(
                            (r) => r.id != null && String(r.id) === String(taskId)
                        );
                        if (idx === -1 || prev[idx].status === freshStatusLabel) return prev;
                        const next = prev.slice();
                        next[idx] = {
                            ...next[idx],
                            status: freshStatusLabel,
                            updatedAt: fresh.updatedAt ?? next[idx].updatedAt,
                        };
                        return next;
                    });

                    // 2) Patch the open preview's status chip, status-only, and
                    //    only when this task IS the open preview (identity guard
                    //    against a switch landing before the refetch resolves).
                    setCurrentPreviewTask((prev) =>
                        prev &&
                        String(prev.id) === String(taskId) &&
                        prev.status?.status !== freshStatusLabel
                            ? { ...prev, status: fresh.status }
                            : prev
                    );
                })
            );
        },
        [myself, accessToken, setAllTasks]
    );

    // Read the project's rows from IndexedDB into the table.
    //
    // An answer only lands if it still describes what the user is looking at:
    //   - the project it was read for is still the open one, in the team it
    //     was asked in (a slow read for A used to write A's rows under B, and
    //     an old team's rows under the new team), and
    //   - no newer read has started (two reads of one project can come back in
    //     either order; the newer one saw the later data).
    // The loading flag follows the same rule: only the newest read turns it off,
    // so an older answer cannot end the spinner while the newer is in flight.
    const fetchProjectTasks = async (projectId: number) => {
        const seq = ++readSeqRef.current;
        const askedIn = scopeRef.current;
        setTsLastLoadProjectTasks(Date.now());
        setIsLoadingTasks(true);
        try {
            const _allTasks: TaskTableProps[] = await popSpecificProjectTasks(
                projectId,
                taskTypes.all.statuses
            );
            const now = scopeRef.current;
            if (
                seq !== readSeqRef.current ||
                now.projectId !== projectId ||
                now.teamId !== askedIn.teamId ||
                now.currentTeamId !== askedIn.currentTeamId
            ) {
                return;
            }
            // Team guard. IndexedDB outlives a team switch, so the store can
            // still hold rows filed under the previous team; in a project of
            // the user's own team those are not shown. (Project ids are global,
            // so this is about leftovers, not about two teams sharing an id.)
            // A shared project is exempt: every row in it belongs to the host.
            // `myself.teamId` and the workspace's team do not flip in the same
            // commit during a switch, so a row of either is the user's own.
            const ownTeams = [now.teamId, now.currentTeamId]
                .filter((id): id is string => !!id)
                .map(String);
            const rows =
                now.isOwnTeamProject === true && ownTeams.length > 0
                    ? _allTasks.filter(
                          (task) => task.teamId == null || ownTeams.includes(String(task.teamId))
                      )
                    : _allTasks;
            // Keyed merge. The answer usually matches what is on screen (it
            // follows the network refresh of rows already painted, or the
            // remembered rows of a switch back), and then `prev` comes back
            // untouched: array identity stays put, so every downstream memo
            // (childrenByParent / displayRows / the sort) and every row is left
            // alone. When some rows did change, the rest keep their objects and
            // only the changed ones render again.
            const readKey = String(projectId);
            const readScope = teamScopeOf(now.teamId, now.currentTeamId);
            setRowsState((prev) => {
                // Defensive: the rows on screen must be this project's.
                if (prev.projectKey !== readKey || prev.teamScope !== readScope) return prev;
                const merged = mergeProjectRows(prev.rows, rows);
                if (merged === prev.rows && prev.loaded) return prev;
                return { ...prev, rows: merged, loaded: true };
            });
        } finally {
            if (seq === readSeqRef.current) setIsLoadingTasks(false);
        }
    };

    // Push an edited task onto its row in `allTasks`. We spread the existing
    // row first so milestone-only fields (`isMilestone`, `milestoneId`,
    // `sprintId`) — which the edited copy doesn't always carry — survive the
    // patch. Without this, clicking a milestone backing row would strip those
    // fields and break TaskFilterMenu's milestone-scope filter (the chip falls
    // back to "Milestone: #<id>" and the row disappears from a scoped
    // SprintBoard).
    //
    // Replaces the `isTaskUpdated` flag loop (MIP-968). TaskPreview used to set
    // the flag and an effect here patched the row and reset it: that ran on
    // every task OPEN (two extra commits, plus a `/task/meta/` request), and an
    // edit that landed while the flag was still set was dropped. Now the preview
    // calls this once per edit, with the edited task itself.
    //
    // Identity discipline: the patch below is a no-op when the row already has
    // these values, and a new `allTasks` identity is expensive downstream:
    // TaskFilterMenu re-runs `applyFilters` (O(N)) plus a sort (O(N log N)), the
    // table rebuilds `childrenByParent` / `displayRows`, and the sprint board
    // re-runs its column-organizing effect, all scaling with the project's task
    // count. So: patch in place, and when nothing actually changed return the
    // PREVIOUS array so its identity is preserved and the cascade never starts.
    // A real edit still produces a new array.
    const syncPreviewEdit = useCallback(
        (edited: TaskProps) => {
            // The empty working copy a preview mounts with has no id.
            if (edited?.id == null) return;
            setAllTasks((prevTasks) => {
                const targetId = String(edited.id);
                const idx = prevTasks.findIndex((task) => task.id === targetId);
                if (idx === -1) return prevTasks;
                const task = prevTasks[idx];
                const patched: TaskTableProps = {
                    ...task,
                    id: String(edited.id) || task.id,
                    title: edited.title || task.title,
                    priority: edited.priority.priority || task.priority,
                    effortLevel: edited.effortLevel.level || task.effortLevel,
                    createdDate: edited.createdDate || task.createdDate || getLocalCurrentDate(),
                    updatedAt: edited.updatedAt || getLocalCurrentTimestamp(),
                    dueDate: edited.dueDate ?? task.dueDate,
                    daysLeft: edited.daysLeft ?? task.daysLeft,
                    status: edited.status.status || task.status,
                    assigneeId: edited.assignee?.userId ?? task.assigneeId,
                    assigneeEmail: edited.assignee?.userEmail ?? task.assigneeEmail,
                    assigneeName: edited.assignee?.userName ?? task.assigneeName,
                    assigneeImgPath: edited.assignee?.avatarImgPath ?? task.assigneeImgPath,
                    parentTaskId: edited.parentTaskId ? String(edited.parentTaskId) : null,
                    rootTaskId: edited.rootTaskId ?? task.rootTaskId,
                    threadId: edited.threadId ?? task.threadId,
                    tags: edited.tags || task.tags,
                    concatTags: edited.concatTags || task.concatTags,
                    teamId: myself.teamId || task.teamId,
                    projectId: edited.project?.projectId ?? task.projectId,
                    // Carry milestone metadata through. Prefer the
                    // value from `edited` so a task->
                    // milestone promotion still propagates, but
                    // fall back to the existing row when the
                    // preview payload doesn't include it.
                    isMilestone: edited.isMilestone ?? task.isMilestone ?? false,
                    // `null` is an explicit "no milestone" (the picker's clear,
                    // which the PUT sends to the server as `milestone: null`);
                    // only `undefined` means the payload didn't say. `??` read
                    // both as "not provided", so clearing a milestone from the
                    // preview left the row filed under it in the table.
                    milestoneId:
                        edited.milestoneId === undefined
                            ? (task.milestoneId ?? null)
                            : edited.milestoneId,
                    sprintId: edited.sprintId ?? task.sprintId ?? null,
                };
                // The sprint is always the milestone's (there is no sprint
                // picker on a task), or none. When the milestone changed, the
                // preview's sprint is the new answer, `null` ("no sprint")
                // included: the picker always hands one over. `??` above read
                // that `null` as "not provided" and kept the old sprint on the
                // row, so a task moved into a milestone without a sprint stayed
                // in its old sprint's bucket until a reload (MIP-1035). A task
                // with no milestone has none, whatever the copy still carries.
                // An edit that is not a milestone change keeps the `??`: a copy
                // that doesn't know the sprint must not clear the row's.
                if (
                    !task.isMilestone &&
                    (task.milestoneId ?? null) !== (patched.milestoneId ?? null)
                ) {
                    patched.sprintId =
                        patched.milestoneId == null ? null : (edited.sprintId ?? null);
                }
                // A move: the task now sits under another milestone or another
                // parent. Its root follows where it hangs (the preview never
                // sends one: the server re-derives it), and everything beneath
                // it has to follow too. The server does exactly that; without
                // it here, the sub-tasks keep the milestone and root they had,
                // and a milestone-scoped table drops them from under their own
                // parent until a full reload (MIP-1026). Not on every edit: a
                // title save must not rewrite the whole sub-tree.
                const moved =
                    !task.isMilestone &&
                    (String(task.milestoneId ?? "") !== String(patched.milestoneId ?? "") ||
                        String(task.parentTaskId ?? "") !== String(patched.parentTaskId ?? ""));
                if (moved) {
                    patched.rootTaskId = resolveRootTaskId(
                        prevTasks,
                        patched.id!,
                        patched.parentTaskId
                    );
                }
                if (isSameTableRow(task, patched)) return prevTasks;
                const next = prevTasks.slice();
                next[idx] = patched;
                if (!moved) return next;
                return applyTreePositionToDescendants(next, patched.id!, {
                    milestoneId: patched.milestoneId ?? null,
                    sprintId: patched.sprintId ?? null,
                    rootTaskId: patched.rootTaskId ?? null,
                });
            });
        },
        [myself.teamId, setAllTasks]
    );

    return {
        // Task preview state
        isTaskPreviewVisible,
        setIsTaskPreviewVisible,
        previewCloseCount,
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
        previewLoadFailedTaskId,
        setCurrentPreviewTaskId,
        currentPreviewTask,
        setCurrentPreviewTask,
        currentPreviewKind,
        setCurrentPreviewKind,
        currentPreviewMilestoneId,
        setCurrentPreviewMilestoneId,
        tableMilestoneFilterId,
        setTableMilestoneFilter,
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
        tagsRevision,
        bumpTagsRevision,

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
        syncPreviewEdit,

        // Task lists
        allTasks,
        setAllTasks,
        isLoadingTasks,
        setIsLoadingTasks,

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
        refreshTaskStatuses,

        // Functions
        loadTask,
        loadUpdatedTask,
        initializeTaskStates,
        handleCreateTask,
        fetchProjectTasks,
        dropCachedProjectRows,
        pruneCachedProjectRows,
    };
};
