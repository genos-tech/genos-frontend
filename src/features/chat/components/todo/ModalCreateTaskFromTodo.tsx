import { useEffect, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import {
    Alert,
    Button,
    CircularProgress,
    FormControl,
    FormLabel,
    Input,
    Modal,
    ModalDialog,
    Option,
    Select,
    Stack,
    Typography,
} from "@mui/joy";

import { useAuth } from "../../../../context/AuthContext";
import { useTranslation } from "../../../../i18n";
import { LimitReachedError } from "../../../../services/limitErrors";
import { UserProps } from "../../../../types/admin";
import { ProjectProps } from "../../../../types/tasks";
import { createQuickTask } from "../../../tasks/services/createQuickTask";
import { loadTeamProjects } from "../../../tasks/services/loadTeamProjects";

// Remembers the last project a to-do was promoted into. Most people
// funnel their to-dos into the same project, and the picker defaulting
// to it turns the flow into open-menu → Enter.
const LAST_PROJECT_KEY = "genos-todo-to-task-last-project";

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
    const { open, onClose, myself, todoTitle, todoNotes, onCreated } = props;
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const tc = t.chat.todoPane.createTask;

    const [projects, setProjects] = useState<ProjectProps[]>([]);
    const [projectId, setProjectId] = useState<number | null>(null);
    const [title, setTitle] = useState(todoTitle);
    const [loadingProjects, setLoadingProjects] = useState(false);
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
            setProjectId(rememberedIsLive ? remembered : (list[0]?.projectId ?? null));
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, accessToken]);

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
                // A promoted to-do is top-level work, not a sub-task of
                // anything — both null makes it a root task.
                parentTaskId: null,
                rootTaskId: null,
                milestoneId: null,
                // Carry the to-do's notes over as the task body when it
                // has any; otherwise createQuickTask's default template
                // gives the user something to flesh out.
                content: todoNotes && todoNotes.length > 0 ? todoNotes : undefined,
            });
            localStorage.setItem(LAST_PROJECT_KEY, String(projectId));
            onCreated?.(taskId);
            onClose();
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
                        <Select
                            disabled={isSubmitting || loadingProjects || noProjects}
                            placeholder={loadingProjects ? tc.loadingProjects : tc.projectLabel}
                            value={projectId}
                            onChange={(_, value) => setProjectId(value as number | null)}
                        >
                            {projects.map((project) => (
                                <Option key={project.projectId} value={project.projectId}>
                                    {project.projectName}
                                </Option>
                            ))}
                        </Select>
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
