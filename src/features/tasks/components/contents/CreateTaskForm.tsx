import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import StarOutlineRoundedIcon from "@mui/icons-material/StarOutlineRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {
    Box,
    Button,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    ListDivider,
    Modal,
    ModalDialog,
    Option,
    Select,
    Sheet,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { LimitReachedError } from "../../../../services/limitErrors";
import { UserProps } from "../../../../types/admin";
import { TagListProps, TaskProps } from "../../../../types/tasks";
import { isMac } from "../../../../utils/platform";
import { LinkedPrCard } from "../../../integrations/components/LinkedPrCard";
import { parsePrUrl } from "../../../integrations/utils/parsePrUrl";
import { createEmptyTask } from "../../services/createEmptyTask";
import { loadProjectTaskTemplates } from "../../services/loadProjectTaskTemplates";
import {
    loadProjectTemplateDefaults,
    ProjectTemplateDefaults,
    saveProjectTemplateDefault,
} from "../../services/projectTemplateDefaults";
import {
    updateProjectOptions,
    updateTagOptions,
    updateTeamMembersOptions,
} from "../../services/updateTaskAutoCompleteOptions";
import { sendMilestoneCreatedMessage } from "../../sprint-milestone/services";
import { isNoMainPanelVisible } from "../../utils/mainPanelVisibility";
import { getCreationKind } from "../../utils/taskKind";
import {
    CustomTaskTemplate,
    customTemplateValue,
    parseCustomTemplateValue,
    TASK_TEMPLATE_OPTIONS,
    TASK_TEMPLATES,
    taskContentTemplate,
    TaskTemplateId,
} from "../../utils/taskTemplates";
import { ModalManageTaskTemplates } from "../modals/ModalManageTaskTemplates";
import { TaskCreateAttachmentBlock } from "./base/TaskCreateAttachmentBlock";
import { TaskCreateBodyBlock } from "./base/TaskCreateBodyBlock";
import { TaskCreateFooter, type TaskCreateFooterHandle } from "./base/TaskCreateFooter";
import { TaskMainBlock } from "./base/TaskMainBlock";
import { TaskPaneError } from "./base/TaskPaneError";
import { TaskPaneLoading } from "./base/TaskPaneLoading";
import { TaskTitleBlock } from "./base/TaskTitleBlock";

// How long to wait for the empty-task POST before treating it as failed.
// Generous on purpose: this is a backstop against a request that never
// settles (which no try/catch can see), not a latency budget — a cold
// create legitimately takes a second or two.
const BOOTSTRAP_TIMEOUT_MS = 25_000;

// Sentinel picker value for the "Manage templates…" action row. Never a
// real template id — selecting it opens the manage modal instead of
// applying a body.
const TEMPLATE_MANAGE_ACTION = "__manage_templates__";

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

// Body templates live in `utils/taskTemplates.ts` so the title-only
// `createQuickTask` service can share the same default scaffold without
// importing this whole modal.

type CreateTaskProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    useUISM: UIStateManagementState;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    useSM?: SprintMilestoneManagementState;
    useCM: ChatManagementState;
    useNM: NoteManagementState;
};

export const CreateTaskForm = (props: CreateTaskProps) => {
    const { useTEM, socket, myself, setMyself, useCM, useUISM, usePM, useTM, useSM, useNM } =
        props;
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();

    // Init task contents
    const [taskContent, setTaskContent] = useState<TaskProps>();
    const [taskTitle, setTaskTitle] = useState<string>("");
    // Seed the body with the correct kind's built-in template on mount so a
    // milestone form doesn't briefly show the task scaffold. The project
    // default (possibly a custom template) is applied once the async load
    // resolves; a restored draft overrides both.
    const [body, setBody] = useState<PartialBlock[]>(
        useTM.isCreatingTask.creationKind === "milestone"
            ? TASK_TEMPLATES.milestone.blocks
            : taskContentTemplate
    );
    // New tasks/milestones/subtasks start unassigned by design — the
    // creator picks an assignee if/when they're ready. Reporter still
    // defaults to the creator (the form has no obvious other choice).
    const [assignee, setAssignee] = useState<UserProps | null>(null);
    const [reporter, setReporter] = useState<UserProps>(myself);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isCreatingMilestone, setIsCreatingMilestone] = useState(false);
    // Mirrors `TaskCreateFooter`'s in-flight `uploadNewTask` state so
    // `TaskCreateAttachmentBlock` can render its overlay/per-tile spinner
    // while the staged files are being POSTed to /task/attachment/.
    const [isCreatingTask, setIsCreatingTask] = useState(false);
    // The effective creation kind ("task" | "milestone" | "subtask")
    // is derived from `useTM.isCreatingTask` plus the project's task
    // table — see `getCreationKind` for the rules.
    const creationKind = getCreationKind(useTM.isCreatingTask, useTM.allTasks);

    // Body template picker. The value is a string: built-ins use their
    // `TaskTemplateId` verbatim, custom project templates use the
    // namespaced `custom:{id}` value (see `taskTemplates.ts`). Default to
    // the milestone template when creating a milestone, else the standard
    // task template.
    const [templateId, setTemplateId] = useState<string>(
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

    // Seed the editor's body with `blocks` and remember which picker option
    // is active. Shared by the built-in and custom-template paths.
    const applyBlocks = (value: string, blocks: PartialBlock[]) => {
        setTemplateId(value);
        setBody(blocks);
        const editor = editorRef.current;
        if (editor) {
            try {
                editor.replaceBlocks(editor.document, blocks);
            } catch {
                // Editor not ready yet — the next render's seed will pick
                // up the new body via `initialBody`.
            }
        }
    };

    // Resolve a picker value (built-in id or `custom:{id}`) to its blocks.
    // A `custom:{id}` whose template no longer exists (deleted after being
    // set as a default) falls back to the current kind's built-in. The
    // `templates` list is a param so the load-callback path can resolve
    // against freshly-fetched data before React state has committed.
    const resolveTemplateBlocks = (
        value: string,
        templates: CustomTaskTemplate[] = useTM.projectTaskTemplates
    ): { value: string; blocks: PartialBlock[] } => {
        const customId = parseCustomTemplateValue(value);
        if (customId !== null) {
            const custom = templates.find((tpl) => tpl.id === customId);
            if (custom) return { value, blocks: custom.body };
        } else {
            const builtin = TASK_TEMPLATES[value as TaskTemplateId];
            if (builtin) return { value, blocks: builtin.blocks };
        }
        const fallback = creationKind === "milestone" ? "milestone" : "default";
        return { value: fallback, blocks: TASK_TEMPLATES[fallback].blocks };
    };

    // The project's saved default for a kind, or the built-in fallback.
    // Tasks and subtasks share the "task" default (milestone is the only
    // distinct kind).
    const defaultValueForKind = (
        kind: string,
        defaults: ProjectTemplateDefaults = useTM.templateDefaults
    ): string =>
        kind === "milestone" ? (defaults.milestone ?? "milestone") : (defaults.task ?? "default");

    const applyDefaultForKind = (
        kind: string,
        defaults?: ProjectTemplateDefaults,
        templates?: CustomTaskTemplate[]
    ) => {
        const { value, blocks } = resolveTemplateBlocks(
            defaultValueForKind(kind, defaults),
            templates
        );
        applyBlocks(value, blocks);
    };

    // Set once the user picks a template themselves (or a draft is
    // restored). Guards the "apply the project default" effects from
    // clobbering a deliberate choice when defaults/templates load late.
    const userPickedTemplateRef = useRef(false);

    // Picker `onChange`: a `custom:{id}` value resolves against the loaded
    // project templates; anything else is a built-in id.
    const handleTemplateChange = (value: string) => {
        userPickedTemplateRef.current = true;
        const resolved = resolveTemplateBlocks(value);
        applyBlocks(resolved.value, resolved.blocks);
    };

    // Persist the currently-selected template as this project's default for
    // the current kind (task/subtask → "task"; milestone → "milestone").
    const [isSavingDefault, setIsSavingDefault] = useState(false);
    const defaultKind = creationKind === "milestone" ? "milestone" : "task";
    // Filled star only when the project has actually pinned this exact
    // template as the kind's default — NOT when the selection merely
    // matches the built-in fallback (no default set yet).
    const isCurrentDefault =
        useTM.templateDefaults[defaultKind] != null &&
        useTM.templateDefaults[defaultKind] === templateId;
    const handleSetAsDefault = async () => {
        const projectId = usePM.currentProject?.projectId;
        if (!projectId || templateId === TEMPLATE_MANAGE_ACTION) return;
        setIsSavingDefault(true);
        const updated = await saveProjectTemplateDefault(
            projectId,
            defaultKind,
            templateId,
            accessToken
        );
        if (updated) useTM.setTemplateDefaults(updated);
        setIsSavingDefault(false);
    };

    // The project default is applied to the body exactly ONCE per form
    // session — see the load effect. A ref (not state) so a `templatesDirty`
    // refetch (user opened the manage modal mid-create) can't re-fire it
    // and wipe the body they're typing.
    const defaultAppliedRef = useRef(false);

    // Load this project's custom templates + defaults for the picker: on
    // mount, when the project changes, and after any create/edit/delete
    // (the manage modal flips `templatesDirty`).
    useEffect(() => {
        const projectId = usePM.currentProject?.projectId;
        if (!projectId) return;
        let cancelled = false;
        (async () => {
            const [templates, defaults] = await Promise.all([
                loadProjectTaskTemplates(myself, projectId, accessToken),
                loadProjectTemplateDefaults(myself, projectId, accessToken),
            ]);
            if (cancelled) return;
            useTM.setProjectTaskTemplates(templates);
            useTM.setTemplateDefaults(defaults);
            if (useTM.templatesDirty) useTM.setTemplatesDirty(false);
            // Apply the project default to the body once, right after the
            // first load — unless the user already picked a template or a
            // draft was restored. Resolved against the freshly-fetched data
            // (state hasn't committed yet). One-shot so later refetches
            // never clobber an in-progress body.
            if (!defaultAppliedRef.current && !userPickedTemplateRef.current) {
                defaultAppliedRef.current = true;
                applyDefaultForKind(creationKind, defaults, templates);
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usePM.currentProject?.projectId, useTM.templatesDirty]);

    // An EXPLICIT task↔milestone toggle is fresh intent: apply that kind's
    // project default. Keyed on milestone-ness (via a ref), NOT the
    // tri-state creationKind — `getCreationKind` flips "subtask"→"task" on
    // its own as `allTasks` loads (both non-milestone, same default), and
    // reacting to that would wipe a body the user had started. The initial
    // mount apply is owned by the load effect above; a manual pick /
    // restored draft is respected.
    const prevIsMilestoneRef = useRef<boolean | null>(null);
    useEffect(() => {
        const isMilestone = creationKind === "milestone";
        const prev = prevIsMilestoneRef.current;
        prevIsMilestoneRef.current = isMilestone;
        if (prev === null || prev === isMilestone) return;
        if (userPickedTemplateRef.current) return;
        applyDefaultForKind(creationKind);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [creationKind]);

    const switchKind = (kind: "task" | "milestone") => {
        useTM.setIsCreatingTask({
            ...useTM.isCreatingTask,
            creationKind: kind,
        });
    };

    // Track the empty-task id created during THIS mount of the form.
    //
    // `useTM.initialEmptyTaskId` is shared global state: after a successful
    // submit, the form unmounts but the (now-consumed) id stays around.
    // On the next mount, the watcher effect below would otherwise fire
    // synchronously with that stale id and seed `taskContent` (and thus
    // `BnTaskPreview`'s collaborative BlockNote doc, which is keyed by
    // `task-body:${taskId}`) against the previous task's Yjs document —
    // so the form re-opens pre-filled with the prior task's body, and any
    // keystroke here fans back out to that earlier task. Reproduces in
    // `TaskHomeLayout` because the "+ Create task" button is reachable
    // before the new `createEmptyTask` POST returns.
    const freshEmptyTaskIdRef = useRef<number | undefined>(undefined);

    // Bootstrap failure surfaces as `TaskPaneError` instead of the pane
    // spinning forever. Previously the call below was fire-and-forget with
    // no catch, so a rejected POST (offline, !ok, malformed body) — or a
    // missing token, which the service used to swallow silently — left the
    // loading pane up permanently with no way out.
    const [bootstrapError, setBootstrapError] = useState<string | null>(null);
    const [bootstrapRetryNonce, setBootstrapRetryNonce] = useState(0);
    // One create per mount (or per explicit retry). Guards the effect below
    // from re-running on an `accessToken` refresh — each POST writes a real
    // backend row, so a re-run would orphan one.
    const bootstrapStartedRef = useRef(false);
    const bootstrapAbortRef = useRef<AbortController | null>(null);
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            // Abort only on unmount — NOT from the effect below's cleanup,
            // which would kill an in-flight POST every time the token
            // refreshed mid-request.
            bootstrapAbortRef.current?.abort();
            // Refs survive an unmount/remount of the same element (and a
            // StrictMode double-invoke), so without this reset a remount
            // would see `started === true`, skip the create, and sit on the
            // loading pane forever — the very hang this is guarding.
            bootstrapStartedRef.current = false;
        };
    }, []);

    useEffect(() => {
        // Wait for a token rather than failing on it: this form can mount in
        // the same tick as the Cmd+T shortcut, before auth resolves. The
        // timeout below is what stops "waiting" from becoming "hanging".
        if (!accessToken) return;
        if (bootstrapStartedRef.current) return;
        bootstrapStartedRef.current = true;

        const controller = new AbortController();
        bootstrapAbortRef.current = controller;
        // A fetch that never settles can't be caught — only aborted. Generous
        // because a cold by-id load legitimately takes a second or two; this
        // is a backstop against hanging, not a latency budget.
        const abortTimer = setTimeout(() => controller.abort(), BOOTSTRAP_TIMEOUT_MS);

        // Drop any leftover id from a previously consumed creation flow
        // before kicking off the bootstrap. Belt-and-suspenders with the
        // ref guard in the watcher below — if anything else races to set the
        // id (e.g. a cancelled prior mount), the watcher still won't seed
        // until it sees the id we created here.
        setBootstrapError(null);
        useTM.setInitialEmptyTaskId(undefined);

        void (async () => {
            try {
                const id = await createEmptyTask({
                    myself: myself,
                    projectId: usePM.currentProject?.projectId || 0,
                    accessToken: accessToken,
                    signal: controller.signal,
                });
                if (!mountedRef.current) return;
                freshEmptyTaskIdRef.current = id;
                useTM.setInitialEmptyTaskId(id);
            } catch (err) {
                if (!mountedRef.current) return;
                console.error("[CreateTaskForm] empty-task bootstrap failed:", err);
                // Plan-limit rejections carry a user-facing "why" —
                // show it in the error pane instead of the generic
                // bootstrap-failure copy (retry won't help there).
                setBootstrapError(
                    err instanceof LimitReachedError && err.message
                        ? err.message
                        : t.tasks.createForm.bootstrapFailed
                );
            } finally {
                clearTimeout(abortTimer);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken, bootstrapRetryNonce]);

    // Manual retry only — never automatic. Every attempt POSTs a new backend
    // row, so a retry loop would spray orphaned empty tasks and could mask a
    // real outage. One orphan per deliberate retry is the accepted cost.
    const retryBootstrap = () => {
        bootstrapStartedRef.current = false;
        setBootstrapRetryNonce((n) => n + 1);
    };

    // Give up: tear the form down properly rather than stranding the user in
    // the error pane (which has no header, hence no X of its own).
    const cancelBootstrap = () => {
        useTM.setIsCreatingTask({
            flag: false,
            parentTaskId: null,
            rootTaskId: null,
            creationKind: "task",
            milestoneId: null,
        });
        if (isNoMainPanelVisible(useTM)) {
            useTM.setIsTaskTableVisible(true);
        }
    };

    // Default due date for a freshly-created task: inherit from the
    // immediate parent so a child can't outlast its container. Mental
    // model the user asked for: "the task must be done by the milestone's
    // due date". Fall-through chain is intentional:
    //   1. Parent task's `dueDate` — covers both "task under milestone"
    //      (the parent here is the milestone's backing task, which the
    //      backend keeps synced to the milestone's own due date) and
    //      "sub-task under a regular task".
    //   2. Milestone's `dueDate` — direct lookup for the rare case the
    //      backing task isn't yet in `allTasks` (e.g. a fresh milestone
    //      created moments earlier and selected from the picker before
    //      the project tasks have re-fetched).
    //   3. Empty string ("TBD") — top-level tasks with no parent /
    //      milestone context, or where the parent itself has no due
    //      date set, should leave the field unscheduled so the user
    //      can pick something later instead of being silently anchored
    //      to "today". `TaskCreateFooter` / `uploadNewTask` already
    //      treat empty as null when sending to the backend.
    // We slice to 10 chars so a backend value like
    // "2026-05-10T00:00:00Z" still feeds the YYYY-MM-DD shape the date
    // input (`TaskDueDateInput`) expects.
    const computeInheritedDueDate = (): string => {
        const toIsoDate = (raw: string | null | undefined): string | null => {
            if (!raw) return null;
            const trimmed = raw.length >= 10 ? raw.slice(0, 10) : raw;
            return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
        };

        const parentId = useTM.isCreatingTask.parentTaskId;
        if (parentId != null) {
            const parent = useTM.allTasks.find((t) => String(t.id) === String(parentId));
            const inherited = toIsoDate(parent?.dueDate ?? null);
            if (inherited) return inherited;
        }

        const milestoneIdForCreate = useTM.isCreatingTask.milestoneId;
        const projectId = usePM.currentProject?.projectId;
        if (milestoneIdForCreate != null && useSM && projectId != null) {
            const milestone = (useSM.projectMilestones[projectId] ?? []).find(
                (m) => m.milestoneId === milestoneIdForCreate
            );
            const inherited = toIsoDate(milestone?.dueDate ?? null);
            if (inherited) return inherited;
        }

        return "";
    };

    // Chat-thread origin of this create, captured at click time by the
    // thread header (the only setter of `fromThread`). This is the SOLE
    // source of the task's chat linkage — reading useCM.currentThreadChat
    // here instead (the old behavior) picked up whatever thread was open
    // LAST, even on the tasks page, and wrote its ids onto unrelated
    // tasks. TaskProps' chat slots are `number`-typed but carry the v3
    // UUID strings via the same legacy-slot cast the adapters use.
    const fromThread = useTM.isCreatingTask.fromThread ?? null;
    const threadLinkage = {
        chatType: fromThread?.chatType ?? null,
        chatId: (fromThread?.chatId ?? null) as unknown as number | null,
        threadId: (fromThread?.threadId ?? null) as unknown as number | null,
    };

    useEffect(() => {
        // Only seed `taskContent` once the global id matches the one we
        // created in this mount; see the bootstrap effect above for why
        // accepting any non-null id here would surface the previous
        // task's body in the editor.
        if (useTM.initialEmptyTaskId && useTM.initialEmptyTaskId === freshEmptyTaskIdRef.current) {
            // If a draft exists (user typed something, navigated away, came
            // back — or reloaded the browser with content still in flight),
            // hydrate every form field from the persisted snapshot instead
            // of resetting to defaults. The `id` is always overridden with
            // the freshly-created empty-task id from this mount: the draft's
            // original empty-task on the backend is now orphaned and not
            // reusable. Attachments are dropped (see TaskDraft docstring).
            const draft = useTM.getTaskDraft();
            if (draft) {
                // A restored draft is a deliberate prior choice — pin it so
                // the "apply project default" effects don't overwrite the
                // restored body/template when defaults resolve.
                userPickedTemplateRef.current = true;
                setTaskTitle(draft.taskTitle);
                setBody(draft.body);
                setAssignee(draft.assignee ?? myself);
                setReporter(draft.reporter ?? myself);
                setTemplateId(draft.templateId);
                setTaskContent({
                    ...draft.taskContent,
                    id: useTM.initialEmptyTaskId,
                    attachments: [],
                    // Thread linkage follows THIS create intent, never
                    // the draft's — a draft typed in one thread and
                    // resumed from another (or from no thread) must not
                    // resurrect the old linkage.
                    ...threadLinkage,
                } as TaskProps);
                // BlockNote seeded itself from `body` on mount; if a draft
                // restores a different body, we have to push it through
                // replaceBlocks because the editor's already initialized.
                const editor = editorRef.current;
                if (editor) {
                    try {
                        editor.replaceBlocks(editor.document, draft.body);
                    } catch {
                        // Editor not ready yet — the next render's seed
                        // will pick up the new body via `initialBody`.
                    }
                }
                return;
            }
            setTaskContent({
                id: useTM.initialEmptyTaskId,
                project: usePM.currentProject,
                title: "",
                body: taskContentTemplate,
                // New tasks start unassigned; reporter is the creator.
                assignee: null,
                reporter: myself,
                ...threadLinkage,
                dueDate: computeInheritedDueDate(),
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

    // Persist the draft to localStorage on every meaningful change, but
    // DEBOUNCED — `JSON.stringify(body)` + `localStorage.setItem` on every
    // keystroke is what was causing typing lag in the editor. Each
    // keystroke restarts the 500ms timer; a save only fires after the user
    // pauses. If they navigate away mid-debounce the last <500ms of input
    // is lost, which is an explicit trade we accepted for smooth typing.
    useEffect(() => {
        if (!taskContent || !taskContent.id) return;
        const timer = setTimeout(() => {
            useTM.setTaskDraft({
                taskContent: { ...taskContent, attachments: [] },
                taskTitle,
                body,
                assignee,
                reporter,
                templateId,
                savedAt: new Date().toISOString(),
            });
        }, 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taskTitle, body, taskContent, assignee, reporter, templateId]);

    // Backfill the project from `usePM.currentProject` when the seeder
    // ran before the project store had resolved. Hits the Ctrl+Cmd+T /
    // Ctrl+Alt+T shortcut path: the form mounts inside the same tick the
    // shortcut fires, so if `currentProject` is still loading (e.g. the
    // ~500ms post-mount delay in `loadProjectsAndTasks`), the seeder at
    // L318 sets `project: null` and never reacts when it populates a
    // moment later. Guard on `project?.projectId` so we don't clobber a
    // draft-restored project or a user pick.
    useEffect(() => {
        if (!taskContent) return;
        if (taskContent.project?.projectId) return;
        if (!usePM.currentProject?.projectId) return;
        setTaskContent({ ...taskContent, project: usePM.currentProject });
    }, [taskContent, usePM.currentProject]);

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
            // The submitted task is now persisted to the backend — the
            // draft no longer represents in-progress work.
            useTM.setTaskDraft(null);
            if (useTM.setIsCreatingTask) {
                useTM.setIsCreatingTask({
                    flag: false,
                    parentTaskId: null,
                    rootTaskId: null,
                    creationKind: "task",
                    milestoneId: null,
                });
            }
            // The empty-task id we just consumed via `uploadNewTask` is
            // no longer a valid bootstrap target — it's now a real task
            // with the user's content. Clear the global so the next form
            // mount starts from a clean slate; the bootstrap effect's
            // ref guard backstops this, but keeping the global truthful
            // avoids confusing other readers.
            if (useTM.setInitialEmptyTaskId) {
                useTM.setInitialEmptyTaskId(undefined);
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
            // Thread origin (milestone created from a DM/GM/MDM thread).
            // Persisted on the backing task row server-side; drives the
            // milestone preview's "Check thread" button.
            chatType: fromThread?.chatType ?? null,
            chatId: fromThread?.chatId ?? null,
            threadId: fromThread?.threadId ?? null,
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
            // Forward any links the user added in the create form so a
            // milestone can be created with its URL/Link section
            // already populated (matches how a regular task carries
            // `links` straight through `addTask`).
            links: taskContent.links || [],
            reporterId: myself.userId,
            assigneeIds: assignee?.userId ? [assignee.userId] : [],
        });
        setIsCreatingMilestone(false);
        if (created) {
            // Milestone landed — the draft no longer represents in-progress
            // work, so drop it before we close the form.
            useTM.setTaskDraft(null);
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
                    await sendMilestoneCreatedMessage({
                        myself,
                        project: taskContent.project,
                        milestone: created,
                        sprintName: linkedSprint?.name ?? t.tasks.createForm.sprintFallback,
                        reporter: myself,
                        assignees:
                            resolvedAssignees.length > 0
                                ? resolvedAssignees
                                : assignee
                                  ? [assignee]
                                  : [myself],
                        fromThread,
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
            if (isNoMainPanelVisible(useTM)) {
                useTM.setIsTaskTableVisible(true);
            }
        }
    };

    const [titleErrorOpen, setTitleErrorOpen] = useState(false);
    const [titleError, setTitleError] = useState("");

    // Cmd/Ctrl + Enter submit shortcut.
    //
    // Routes through the same code path the buttons use so disabled
    // gating, the create-in-flight lock, and side effects (table /
    // preview reveal) all behave identically. The handler is held in
    // a ref so a single stable `keydown` listener can call the latest
    // closure without re-binding on every render.
    const taskFooterRef = useRef<TaskCreateFooterHandle>(null);
    const shortcutLabel = isMac() ? "⌘ + Enter" : "Ctrl + Enter";
    const isMilestoneSubmitDisabled =
        isCreatingMilestone || !taskTitle.trim() || !taskContent?.project?.projectId;
    const shortcutHandlerRef = useRef<() => void>(() => {});
    shortcutHandlerRef.current = () => {
        // Suppress while any confirmation dialog is open — the user is
        // mid-decision in the modal, hijacking their Enter would be
        // surprising. Joy's `ModalDialog` carries `role="alertdialog"`.
        if (document.querySelector('[role="alertdialog"]')) return;
        if (creationKind === "milestone") {
            if (isMilestoneSubmitDisabled) return;
            void handleCreateMilestone();
        } else {
            taskFooterRef.current?.submit();
        }
    };
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Enter") return;
            const modifier = isMac() ? e.metaKey : e.ctrlKey;
            if (!modifier) return;
            e.preventDefault();
            shortcutHandlerRef.current();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    // "Has the user actually entered anything worth confirming before
    // discarding?" The Cancel buttons short-circuit straight to teardown
    // when this is false, so an untouched form doesn't pop a modal.
    //
    // Body comparison goes against ALL templates — built-in AND this
    // project's custom ones — not just the selected one: switching a
    // template (or seeding the project default) swaps the body wholesale
    // to that template's blocks, and a user who only browsed templates or
    // landed on a custom default hasn't entered content of their own.
    const isDirty = useMemo(() => {
        if (taskTitle.trim() !== "") return true;
        if ((taskContent?.attachments?.length || 0) > 0) return true;
        const bodyStr = JSON.stringify(body);
        const matchesAnyTemplate =
            TASK_TEMPLATE_OPTIONS.some((t) => JSON.stringify(t.blocks) === bodyStr) ||
            useTM.projectTaskTemplates.some((t) => JSON.stringify(t.body) === bodyStr);
        return !matchesAnyTemplate;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taskTitle, taskContent?.attachments, body, useTM.projectTaskTemplates]);

    // Separate state from TaskCreateFooter's modal because the milestone
    // Cancel button lives inline in this component (the footer is task-only).
    const [showMilestoneDiscardConfirm, setShowMilestoneDiscardConfirm] = useState(false);

    const performMilestoneCancel = () => {
        useTM.setTaskDraft(null);
        useTM.setIsCreatingTask({
            flag: false,
            parentTaskId: null,
            rootTaskId: null,
            creationKind: "task",
            milestoneId: null,
        });
    };

    const handleMilestoneCancelClick = () => {
        if (isDirty) {
            setShowMilestoneDiscardConfirm(true);
        } else {
            performMilestoneCancel();
        }
    };

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
            {taskContent && taskContent.id ? (
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
                                ? "linear-gradient(90deg, #a78bfa 0%, #8b5cf6 50%, #c084fc 100%)"
                                : "linear-gradient(90deg, #6d28d9 0%, #7c3aed 50%, #9333ea 100%)",
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
                                <Stack alignItems="center" direction="row" spacing={1}>
                                    <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                                        Create:
                                    </Typography>
                                    <Button
                                        color={creationKind === "task" ? "primary" : "neutral"}
                                        size="sm"
                                        variant={creationKind === "task" ? "solid" : "soft"}
                                        startDecorator={
                                            <AssignmentRoundedIcon sx={{ fontSize: 14 }} />
                                        }
                                        onClick={() => switchKind("task")}
                                    >
                                        Task
                                    </Button>
                                    <Button
                                        size="sm"
                                        startDecorator={<FlagRoundedIcon sx={{ fontSize: 14 }} />}
                                        variant={creationKind === "milestone" ? "solid" : "soft"}
                                        color={
                                            creationKind === "milestone" ? "warning" : "neutral"
                                        }
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
                            isDirty={isDirty}
                            isMilestone={creationKind === "milestone"}
                            isPreviewMode={false}
                            isSubTask={creationKind === "subtask"}
                            myself={myself}
                            setTaskTitle={setTaskTitle}
                            setTitleErrorOpen={setTitleErrorOpen}
                            taskContent={taskContent}
                            taskTitle={taskTitle}
                            titleError={titleError}
                            titleErrorOpen={titleErrorOpen}
                            useCM={useCM}
                            useNM={useNM}
                            usePM={usePM}
                            useTM={useTM}
                            useUISM={useUISM}
                        />
                    </Box>

                    {/* Main Content Section */}
                    <Box sx={{ p: 2.5 }}>
                        <SectionHeader isDark={isDark}>
                            {t.tasks.createForm.taskDetails}
                        </SectionHeader>
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
                                isMilestone={creationKind === "milestone"}
                                isOpenProjectList={isOpenProjectList}
                                isOpenTagList={isOpenTagList}
                                isOpenTeamMembersList={isOpenTeamMembersList}
                                isPreviewMode={false}
                                isSubTask={creationKind === "subtask"}
                                myself={myself}
                                projectTags={projectTags}
                                reporter={reporter}
                                setAssignee={setAssignee}
                                setIsOpenProjectList={setIsOpenProjectList}
                                setIsOpenTagList={setIsOpenTagList}
                                setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                                setMyself={setMyself}
                                setProjectTags={setProjectTags}
                                setReporter={setReporter}
                                setTaskContent={setTaskContent}
                                socket={socket}
                                taskContent={taskContent}
                                useCM={useCM}
                                usePM={usePM}
                                useSM={useSM}
                                useTEM={useTEM}
                                useTM={useTM}
                                useUISM={useUISM}
                            />
                        </Box>

                        {/* Linked PRs — auto-detected from the body
                            (via TaskMainBlock's debounced effect) and
                            also from URLs the user pasted into the
                            Links field. Mirrors TaskPreview's layout. */}
                        {(() => {
                            const prUrls = (taskContent.links ?? [])
                                .map((l) => l.url)
                                .filter((u) => parsePrUrl(u) !== null);
                            if (prUrls.length === 0) return null;
                            return (
                                <>
                                    <SectionDivider isDark={isDark} />
                                    <SectionHeader isDark={isDark}>
                                        {t.tasks.linkedPr.header}
                                    </SectionHeader>
                                    <Stack spacing={1}>
                                        {prUrls.map((url) => (
                                            <LinkedPrCard
                                                key={url}
                                                accessToken={accessToken ?? ""}
                                                url={url}
                                            />
                                        ))}
                                    </Stack>
                                </>
                            );
                        })()}

                        <SectionDivider isDark={isDark} />

                        {/* Body Section */}
                        <Stack
                            alignItems="center"
                            direction="row"
                            justifyContent="space-between"
                            sx={{ mb: 1, gap: 1 }}
                        >
                            <SectionHeader isDark={isDark}>
                                {t.tasks.createForm.description}
                            </SectionHeader>
                            <Stack alignItems="center" direction="row" spacing={0.5}>
                                {/* Pin the current template as this project's
                                    default for the current kind (task/subtask
                                    vs milestone). Filled star = already the
                                    default. */}
                                <AppTooltip
                                    title={
                                        isCurrentDefault
                                            ? t.tasks.createForm.templates.isDefault
                                            : defaultKind === "milestone"
                                              ? t.tasks.createForm.templates.setDefaultMilestone
                                              : t.tasks.createForm.templates.setDefaultTask
                                    }
                                >
                                    <IconButton
                                        aria-label={t.tasks.createForm.templates.setDefaultTask}
                                        disabled={
                                            isSavingDefault ||
                                            isCurrentDefault ||
                                            templateId === TEMPLATE_MANAGE_ACTION
                                        }
                                        size="sm"
                                        variant="plain"
                                        sx={{
                                            "--IconButton-size": "28px",
                                            color: isCurrentDefault
                                                ? "#f5c518"
                                                : isDark
                                                  ? "rgba(255,255,255,0.5)"
                                                  : "rgba(0,0,0,0.45)",
                                        }}
                                        onClick={handleSetAsDefault}
                                    >
                                        {isCurrentDefault ? (
                                            <StarRoundedIcon sx={{ fontSize: 18 }} />
                                        ) : (
                                            <StarOutlineRoundedIcon sx={{ fontSize: 18 }} />
                                        )}
                                    </IconButton>
                                </AppTooltip>
                                <Select
                                    size="sm"
                                    startDecorator={
                                        <DescriptionRoundedIcon sx={{ fontSize: 16 }} />
                                    }
                                    value={templateId}
                                    renderValue={(opt) => {
                                        if (!opt) return null;
                                        const builtin =
                                            TASK_TEMPLATES[opt.value as TaskTemplateId];
                                        const customId = parseCustomTemplateValue(opt.value);
                                        const tplLabel = builtin
                                            ? t.tasks.createForm.templates[builtin.labelKey]
                                            : customId !== null
                                              ? (useTM.projectTaskTemplates.find(
                                                    (tpl) => tpl.id === customId
                                                )?.templateName ??
                                                t.tasks.createForm.templates.defaultLabel)
                                              : t.tasks.createForm.templates.defaultLabel;
                                        return (
                                            <Typography level="body-xs" sx={{ fontWeight: 600 }}>
                                                {t.tasks.createForm.templatePrefix}
                                                {tplLabel}
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
                                    onChange={(_e, value) => {
                                        if (!value) return;
                                        if (value === TEMPLATE_MANAGE_ACTION) {
                                            useTM.setOpenManageTemplates(true);
                                            return;
                                        }
                                        handleTemplateChange(value);
                                    }}
                                >
                                    {TASK_TEMPLATE_OPTIONS.map((tpl) => (
                                        <Option key={tpl.id} value={tpl.id}>
                                            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                                                <Typography
                                                    level="body-sm"
                                                    sx={{ fontWeight: 600 }}
                                                >
                                                    {t.tasks.createForm.templates[tpl.labelKey]}
                                                </Typography>
                                                <Typography
                                                    level="body-xs"
                                                    sx={{
                                                        color: isDark
                                                            ? "rgba(255,255,255,0.6)"
                                                            : "rgba(0,0,0,0.6)",
                                                    }}
                                                >
                                                    {
                                                        t.tasks.createForm.templates[
                                                            tpl.descriptionKey
                                                        ]
                                                    }
                                                </Typography>
                                            </Stack>
                                        </Option>
                                    ))}

                                    {/* Project-scoped custom templates, when any
                                    exist for the current project. */}
                                    {useTM.projectTaskTemplates.length > 0 && (
                                        <ListDivider role="none" />
                                    )}
                                    {useTM.projectTaskTemplates.length > 0 && (
                                        <Typography
                                            level="body-xs"
                                            sx={{
                                                px: 1.5,
                                                py: 0.5,
                                                fontWeight: 600,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.06em",
                                                fontSize: 10,
                                                color: isDark
                                                    ? "rgba(255,255,255,0.4)"
                                                    : "rgba(0,0,0,0.4)",
                                            }}
                                        >
                                            {t.tasks.createForm.templates.projectGroup}
                                        </Typography>
                                    )}
                                    {useTM.projectTaskTemplates.map((tpl) => (
                                        <Option
                                            key={customTemplateValue(tpl.id)}
                                            value={customTemplateValue(tpl.id)}
                                        >
                                            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                                                {tpl.templateName}
                                            </Typography>
                                        </Option>
                                    ))}

                                    <ListDivider role="none" />
                                    <Option value={TEMPLATE_MANAGE_ACTION}>
                                        <SettingsRoundedIcon sx={{ fontSize: 15, mr: 0.75 }} />
                                        <Typography level="body-sm">
                                            {t.tasks.createForm.templates.manageAction}
                                        </Typography>
                                    </Option>
                                </Select>
                            </Stack>
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
                                myself={myself}
                                setBody={setBody}
                                setMyself={setMyself}
                                socket={socket}
                                taskId={taskContent.id}
                                useCM={useCM}
                                useTEM={useTEM}
                                useUISM={useUISM}
                                onEditorReady={handleEditorReady}
                            />
                        </Box>

                        <SectionDivider isDark={isDark} />

                        {/* Attachments Section */}
                        <SectionHeader isDark={isDark}>
                            {t.tasks.createForm.attachments}
                        </SectionHeader>
                        <TaskCreateAttachmentBlock
                            isUploading={isCreatingTask}
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
                                    color="neutral"
                                    size="sm"
                                    variant="plain"
                                    onClick={handleMilestoneCancelClick}
                                >
                                    Cancel
                                </Button>
                                <AppTooltip
                                    title={
                                        isMilestoneSubmitDisabled
                                            ? "Create Milestone"
                                            : `Create Milestone (${shortcutLabel})`
                                    }
                                >
                                    <Button
                                        disabled={isMilestoneSubmitDisabled}
                                        loading={isCreatingMilestone}
                                        loadingPosition="start"
                                        size="sm"
                                        startDecorator={<FlagRoundedIcon sx={{ fontSize: 16 }} />}
                                        variant="solid"
                                        sx={{
                                            fontWeight: 600,
                                            fontSize: "13px",
                                            borderRadius: "10px",
                                            px: 2.5,
                                            py: 0.75,
                                            background: isMilestoneSubmitDisabled
                                                ? isDark
                                                    ? "rgba(255,255,255,0.08)"
                                                    : "rgba(0,0,0,0.08)"
                                                : "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                                            color: isMilestoneSubmitDisabled
                                                ? isDark
                                                    ? "rgba(255,255,255,0.3)"
                                                    : "rgba(0,0,0,0.3)"
                                                : "white",
                                            boxShadow: isMilestoneSubmitDisabled
                                                ? "none"
                                                : "0 2px 8px rgba(124,58,237,0.3)",
                                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                            "&:hover": {
                                                background: isMilestoneSubmitDisabled
                                                    ? isDark
                                                        ? "rgba(255,255,255,0.08)"
                                                        : "rgba(0,0,0,0.08)"
                                                    : "linear-gradient(135deg, #a78bfa 0%, #c084fc 100%)",
                                                boxShadow: isMilestoneSubmitDisabled
                                                    ? "none"
                                                    : "0 4px 12px rgba(124,58,237,0.4)",
                                                transform: isMilestoneSubmitDisabled
                                                    ? "none"
                                                    : "translateY(-1px)",
                                            },
                                            "&:active": {
                                                transform: isMilestoneSubmitDisabled
                                                    ? "none"
                                                    : "translateY(0)",
                                                boxShadow: isMilestoneSubmitDisabled
                                                    ? "none"
                                                    : "0 2px 6px rgba(124,58,237,0.25)",
                                            },
                                            "&:disabled": {
                                                background: isDark
                                                    ? "rgba(255,255,255,0.08)"
                                                    : "rgba(0,0,0,0.08)",
                                                color: isDark
                                                    ? "rgba(255,255,255,0.3)"
                                                    : "rgba(0,0,0,0.3)",
                                            },
                                        }}
                                        onClick={handleCreateMilestone}
                                    >
                                        {isCreatingMilestone ? "Creating…" : "Create Milestone"}
                                    </Button>
                                </AppTooltip>
                            </Stack>
                        ) : (
                            <TaskCreateFooter
                                ref={taskFooterRef}
                                accessToken={accessToken}
                                isCreatingTask={isCreatingTask}
                                isDirty={isDirty}
                                myself={myself}
                                setIsCreatingTask={setIsCreatingTask}
                                setIsSubmitted={setIsSubmitted}
                                setTitleError={setTitleError}
                                setTitleErrorOpen={setTitleErrorOpen}
                                socket={socket}
                                taskContent={taskContent}
                                taskTitle={taskTitle}
                                useCM={useCM}
                                usePM={usePM}
                                useTM={useTM}
                            />
                        )}
                    </Box>

                    {/* Milestone-path discard confirmation. TaskCreateFooter
                        renders its own equivalent for the task path. */}
                    <Modal
                        open={showMilestoneDiscardConfirm}
                        onClose={() => setShowMilestoneDiscardConfirm(false)}
                    >
                        <ModalDialog role="alertdialog" variant="outlined">
                            <DialogTitle>
                                <WarningRoundedIcon sx={{ color: "#f59e0b" }} />
                                Discard this milestone draft?
                            </DialogTitle>
                            <Divider />
                            <DialogContent>
                                Your title, description, and any other changes will be lost. This
                                can&apos;t be undone.
                            </DialogContent>
                            <DialogActions>
                                <Button
                                    color="danger"
                                    startDecorator={<CloseRoundedIcon sx={{ fontSize: 16 }} />}
                                    variant="solid"
                                    onClick={() => {
                                        setShowMilestoneDiscardConfirm(false);
                                        performMilestoneCancel();
                                    }}
                                >
                                    Discard draft
                                </Button>
                                <Button
                                    color="neutral"
                                    variant="plain"
                                    onClick={() => setShowMilestoneDiscardConfirm(false)}
                                >
                                    Keep editing
                                </Button>
                            </DialogActions>
                        </ModalDialog>
                    </Modal>
                </Sheet>
            ) : bootstrapError ? (
                <TaskPaneError
                    cancelLabel={t.tasks.createForm.bootstrapCancel}
                    isDark={isDark}
                    message={bootstrapError}
                    retryLabel={t.tasks.createForm.bootstrapRetry}
                    onCancel={cancelBootstrap}
                    onRetry={retryBootstrap}
                />
            ) : (
                <TaskPaneLoading isDark={isDark} label={t.tasks.createForm.preparing} />
            )}

            <ModalManageTaskTemplates
                myself={myself}
                open={useTM.openManageTemplates}
                setMyself={setMyself}
                socket={socket}
                useCM={useCM}
                usePM={usePM}
                useTEM={useTEM}
                useTM={useTM}
                useUISM={useUISM}
                onClose={() => useTM.setOpenManageTemplates(false)}
            />
        </>
    );
};
