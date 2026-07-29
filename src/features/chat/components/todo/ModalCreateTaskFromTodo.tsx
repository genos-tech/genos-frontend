import { useEffect, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    CircularProgress,
    FormControl,
    FormLabel,
    Input,
    Modal,
    ModalDialog,
    Stack,
    Typography,
} from "@mui/joy";

import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../../../hooks/common/UrlLinkModalContext";
import { useSprintMilestoneManagement } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { useTranslation } from "../../../../i18n";
import { LimitReachedError } from "../../../../services/limitErrors";
import { UserProps } from "../../../../types/admin";
import { ProjectProps } from "../../../../types/tasks";
import { stripOwnerState } from "../../../../utils/joyAutocomplete";
import { ProjectIdentityRow } from "../../../tasks/components/ProjectIdentityRow";
import { createQuickTask } from "../../../tasks/services/createQuickTask";
import { loadTeamProjects } from "../../../tasks/services/loadTeamProjects";
import { emitTasksBulkChanged } from "../../../tasks/services/taskEvents";
import { SprintMilestonePicker } from "../../../tasks/sprint-milestone/components/SprintMilestonePicker";
import { projectAvatarSrc } from "../../../tasks/utils/projectAvatar";

// Remembers the last project a to-do was promoted into. Most people
// funnel their to-dos into the same project, and the picker defaulting
// to it turns the flow into open-menu → Enter.
const LAST_PROJECT_KEY = "genos-todo-to-task-last-project";

/**
 * Whether the to-do's notes are worth carrying over.
 *
 * BlockNote refuses an empty document, so an untouched notes editor
 * still holds one empty paragraph. Treating that as real content would
 * open the task to a blank body instead of the default template — the
 * same "effectively empty" rule `TodoItemRow` applies when it decides
 * whether to persist notes at all.
 */
const hasRealNotes = (notes: PartialBlock[] | null): boolean => {
    if (!notes || notes.length === 0) return false;
    if (notes.length > 1) return true;
    const only = notes[0];
    if (only.type !== "paragraph") return true;
    const content = only.content;
    if (!content) return false;
    return !(Array.isArray(content) && content.length === 0);
};

type ModalCreateTaskFromTodoProps = {
    open: boolean;
    onClose: () => void;
    myself: UserProps;
    /** The to-do's title — seeds the (editable) task title. */
    todoTitle: string;
    /** The to-do's notes, carried over as the task body when non-empty. */
    todoNotes: PartialBlock[] | null;
    /** Fires with the created task's id after a successful create. */
    onCreated?: (taskId: number | null) => void;
    /** Chat list — resolves each project option's avatar from its PM
     *  chat, so the picker matches the task sidebar / TaskPreview. */
    useCM?: ChatManagementState;
};

/**
 * Promote a to-do into a real task.
 *
 * A to-do is a private, day-scoped scratch item; a task is shared,
 * tracked work in a project. The gap between them is exactly one
 * decision — WHICH project — so that is all this modal asks, with the
 * title pre-filled and editable.
 *
 * Self-contained on purpose: the to-do pane lives in the chat tree and
 * has neither `usePM` nor `useTM` in scope, so the modal loads the
 * project list itself rather than forcing a prop-drill through
 * ToDoPane → TodoGroupCard → TodoCategorySection → TodoItemRow.
 *
 * The copy is one-way. The to-do is left exactly as it was — not
 * completed, not deleted, not back-linked — because "I made a task out
 * of this" says nothing about whether the to-do itself is done, and
 * silently ticking it off would lose the user's own state.
 */
export const ModalCreateTaskFromTodo = (props: ModalCreateTaskFromTodoProps) => {
    const { open, onClose, myself, todoTitle, todoNotes, onCreated, useCM } = props;
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    // Present on the chat surface (the to-do pane renders inside the
    // provider); null on any surface without it, where we just close.
    const urlLinkModal = useUrlLinkModal();
    const tc = t.chat.todoPane.createTask;

    const [projects, setProjects] = useState<ProjectProps[]>([]);
    const [projectId, setProjectId] = useState<number | null>(null);
    const [title, setTitle] = useState(todoTitle);
    const [loadingProjects, setLoadingProjects] = useState(false);
    // Milestone is project-scoped, so it lives next to `projectId` and is
    // cleared whenever that changes (see `pickProject`). `milestoneTaskId`
    // is the milestone's BACKING task — the create needs it, see submit.
    const [milestoneId, setMilestoneId] = useState<number | null>(null);
    const [milestoneTaskId, setMilestoneTaskId] = useState<number | null>(null);
    // Own instance rather than a threaded `useSM`: the to-do pane has no
    // sprint/milestone state in scope, and the modal mounts only while
    // open, so a local one costs a single fetch per use. Giving
    // `SprintMilestonePicker` its state this way is what keeps the picker
    // literally the same component TaskPreview uses.
    const useSM = useSprintMilestoneManagement(accessToken);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Re-seed on every open: the row's title may have been edited since
    // the last time this modal was opened from it.
    useEffect(() => {
        if (!open) return;
        setTitle(todoTitle);
        setError(null);
        setIsSubmitting(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (!open || !accessToken) return;
        let cancelled = false;
        setLoadingProjects(true);
        void (async () => {
            const loaded = await loadTeamProjects(myself, accessToken);
            if (cancelled) return;
            const list: ProjectProps[] = Array.isArray(loaded) ? loaded : [];
            setProjects(list);
            setLoadingProjects(false);
            // Default to the last project used, falling back to the
            // first available one. A stale id (project deleted / left)
            // is dropped rather than pre-selecting something invisible.
            const remembered = Number(localStorage.getItem(LAST_PROJECT_KEY));
            const rememberedIsLive =
                Number.isFinite(remembered) && list.some((p) => p.projectId === remembered);
            pickProject(rememberedIsLive ? remembered : (list[0]?.projectId ?? null));
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, accessToken]);

    // Selecting a project invalidates any milestone chosen under the
    // previous one — milestones belong to a project, so keeping the old
    // selection would POST a milestone from a different project. Mirrors
    // `ACTeamProjects`' `resetMilestoneOnChange` in the create form.
    const pickProject = (nextProjectId: number | null) => {
        setProjectId(nextProjectId);
        setMilestoneId(null);
        setMilestoneTaskId(null);
        if (nextProjectId != null) {
            void useSM.loadMilestonesForProject(nextProjectId, {
                statuses: ["Open", "WIP", "Pending", "Closed"],
            });
        }
    };

    const submit = async () => {
        const trimmed = title.trim();
        if (trimmed === "" || projectId == null || isSubmitting) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const { taskId } = await createQuickTask({
                myself,
                accessToken,
                projectId,
                title: trimmed,
                // No milestone: top-level work, both null = root task.
                // With one: the milestone's BACKING task is the parent and
                // the root. The POST's own bridge only promotes the parent
                // (`root_task_id` is taken verbatim, and the milestone→root
                // bridge lives in the PUT handler this path never hits), so
                // sending both explicitly is what makes a task created here
                // match one created from the milestone preview instead of
                // landing with a NULL root.
                parentTaskId: milestoneTaskId,
                rootTaskId: milestoneTaskId,
                milestoneId,
                // Carry the to-do's notes over as the task body when it
                // has any; otherwise createQuickTask's default template
                // gives the user something to flesh out.
                content: hasRealNotes(todoNotes) ? todoNotes : undefined,
            });
            localStorage.setItem(LAST_PROJECT_KEY, String(projectId));
            // A task created from here lands outside every task-surface
            // flow, so an already-open table / board / milestone list for
            // that project would show stale data until a reload. This is
            // the same project-scoped invalidator the agent's bulk writes
            // use; the to-do pane has no `useTM` to set the usual flag.
            emitTasksBulkChanged(projectId);
            onCreated?.(taskId);
            onClose();
            // Open the new task. Without this the modal just closes and
            // a successful create is indistinguishable from a no-op —
            // there is no list on this surface for the row to appear in,
            // so opening it is both the confirmation and the way to
            // reach it. Same href shape the sub-task rows use.
            if (taskId != null) {
                urlLinkModal?.openModalByHref(
                    `/workspace/tasks/project/${projectId}/task/${taskId}`
                );
            }
        } catch (err) {
            // Plan-limit rejections explain themselves; anything else
            // gets the generic copy.
            setError(err instanceof LimitReachedError ? err.message : tc.failed);
        } finally {
            setIsSubmitting(false);
        }
    };

    const noProjects = !loadingProjects && projects.length === 0;

    return (
        <Modal open={open} onClose={onClose}>
            <ModalDialog sx={{ width: 420, maxWidth: "92vw" }}>
                <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                    <TaskAltRoundedIcon />
                    <Typography level="title-md">{tc.heading}</Typography>
                </Stack>
                <Typography level="body-xs" sx={{ mb: 1.5 }}>
                    {tc.description}
                </Typography>

                {error && (
                    <Alert color="danger" size="sm" sx={{ mb: 1.5 }}>
                        {error}
                    </Alert>
                )}
                {noProjects && (
                    <Alert color="warning" size="sm" sx={{ mb: 1.5 }}>
                        {tc.noProjects}
                    </Alert>
                )}

                <Stack spacing={1.5}>
                    <FormControl>
                        <FormLabel>{tc.titleLabel}</FormLabel>
                        <Input
                            disabled={isSubmitting}
                            placeholder={tc.titlePlaceholder}
                            value={title}
                            autoFocus
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    void submit();
                                }
                            }}
                        />
                    </FormControl>

                    <FormControl>
                        <FormLabel>{tc.projectLabel}</FormLabel>
                        {/* Same Autocomplete shape as the task pickers —
                            avatar, label chips, lock, name — so a project
                            looks the same here as in TaskPreview and the
                            sidebar. `getOptionLabel` stays the plain name:
                            that is what type-to-filter matches on. */}
                        <Autocomplete
                            disabled={isSubmitting || loadingProjects || noProjects}
                            getOptionLabel={(option) => option.projectName}
                            isOptionEqualToValue={(option, value) =>
                                option.projectId === value.projectId
                            }
                            options={projects}
                            placeholder={loadingProjects ? tc.loadingProjects : tc.projectLabel}
                            size="sm"
                            value={projects.find((p) => p.projectId === projectId) ?? null}
                            renderOption={(optionProps, option) => (
                                <Box
                                    component="li"
                                    {...stripOwnerState(optionProps)}
                                    key={option.projectId}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        minWidth: 0,
                                    }}
                                >
                                    <ProjectIdentityRow
                                        avatarSrc={projectAvatarSrc(
                                            option.projectId,
                                            useCM?.allChats
                                        )}
                                        maxLabels={2}
                                        project={option}
                                    />
                                </Box>
                            )}
                            onChange={(_, value) => pickProject(value?.projectId ?? null)}
                        />
                    </FormControl>

                    {/* Milestone — the same picker TaskPreview uses, so the
                        options, ordering and "No milestone" entry match.
                        Sprint is hidden: it is a milestone roll-up on tasks
                        and the backend derives it from the milestone. */}
                    <FormControl>
                        <FormLabel>{tc.milestoneLabel}</FormLabel>
                        <SprintMilestonePicker
                            disabled={isSubmitting || projectId == null}
                            milestoneId={milestoneId}
                            projectId={projectId ?? undefined}
                            showMilestone={true}
                            showSprint={false}
                            sprintId={null}
                            useSM={useSM}
                            onChangeMilestone={(mid, taskId) => {
                                setMilestoneId(mid);
                                setMilestoneTaskId(taskId);
                            }}
                            onChangeSprint={() => undefined}
                        />
                    </FormControl>

                    <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 0.5 }}>
                        <Button
                            disabled={isSubmitting}
                            variant="plain"
                            color="neutral"
                            onClick={onClose}
                        >
                            {tc.cancel}
                        </Button>
                        <Button
                            disabled={isSubmitting || title.trim() === "" || projectId == null}
                            startDecorator={
                                isSubmitting ? <CircularProgress size="sm" /> : undefined
                            }
                            onClick={submit}
                        >
                            {tc.submit}
                        </Button>
                    </Stack>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
