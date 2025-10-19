import { useEffect, useState } from "react";

import { popSpecificProjectTasks } from "../../features/chat/services/popSpecificProjectTasks";
import { loadTaskMeta } from "../../features/notes/task-notes/services/loadTaskMeta";
import { loadSpecificTask } from "../../features/tasks/services/loadSpecificTask";
import { buildTaskTree } from "../../features/tasks/utils/buildTaskTree";
import { UserProps } from "../../types/admin";
import {
    ProjectProps,
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

    // Task creation state
    isCreatingTask: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    };
    setIsCreatingTask: (creating: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    }) => void;

    // Project state
    tsLastLoadProjectTasks: number | undefined;
    setTsLastLoadProjectTasks: (ts: number | undefined) => void;

    // Current task state
    currentPreviewTaskId: number;
    setCurrentPreviewTaskId: (id: number) => void;
    currentPreviewTask: TaskProps | undefined;
    setCurrentPreviewTask: (task: TaskProps | undefined) => void;

    // Task update state
    isTaskCommentUpdated: { isUpdate: boolean; scrollToBottom: boolean };
    setIsTaskCommentUpdated: (updated: { isUpdate: boolean; scrollToBottom: boolean }) => void;

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
    ongoingTasks: TaskTableProps[];
    setOngoingTasks: (tasks: TaskTableProps[]) => void;
    closedTasks: TaskTableProps[];
    setClosedTasks: (tasks: TaskTableProps[]) => void;
    deletedTasks: TaskTableProps[];
    setDeletedTasks: (tasks: TaskTableProps[]) => void;
    expiredTasks: TaskTableProps[];
    setExpiredTasks: (tasks: TaskTableProps[]) => void;

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
    fetchProjectTasks: (projectId: number) => Promise<void>;
}

export const useTaskManagement = (
    myself: UserProps,
    accessToken: string | null
): TaskManagementState => {
    // Task preview state
    const [isTaskPreviewVisible, setIsTaskPreviewVisible] = useState(false);

    // Task creation state
    const [isCreatingTask, setIsCreatingTask] = useState<{
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    }>({
        flag: false,
        parentTaskId: null,
        rootTaskId: null,
    });

    // Current task state
    const [currentPreviewTaskId, setCurrentPreviewTaskId] = useState<number>(-1);
    const [currentPreviewTask, setCurrentPreviewTask] = useState<TaskProps | undefined>(undefined);

    // Task update state
    const [isTaskCommentUpdated, setIsTaskCommentUpdated] = useState({
        isUpdate: false,
        scrollToBottom: true,
    });

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
        ongoing: { id: 1, statuses: ["Open", "WIP", "Pending"], name: "Ongoing" },
        closed: { id: 2, statuses: ["Closed"], name: "Closed" },
        deleted: { id: 3, statuses: ["Deleted"], name: "Deleted" },
    };
    const [ongoingTasks, setOngoingTasks] = useState<TaskTableProps[]>([]);
    const [closedTasks, setClosedTasks] = useState<TaskTableProps[]>([]);
    const [deletedTasks, setDeletedTasks] = useState<TaskTableProps[]>([]);
    const [expiredTasks, setExpiredTasks] = useState<TaskTableProps[]>([]);

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
        setOngoingTasks([]);
        setClosedTasks([]);
        setDeletedTasks([]);
        setExpiredTasks([]);
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
                setIsTaskPreviewVisible(true);
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

            setIsTaskPreviewVisible(true);

            // Add a new ongoing task
            if (isNewTaskCreated === true || isTaskUpdatedBySomeone === true) {
                setOngoingTasks([
                    ...ongoingTasks,
                    {
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
                        parentTaskId: String(loadedTask[0].parentTaskId) || null,
                        threadId: loadedTask[0].threadId || null,
                        tags: loadedTask[0].tags || [],
                        concatTags: loadedTask[0].concatTags || "//",
                        teamId: myself.teamId || null,
                        projectId: loadedTask[0].project?.projectId || null,
                    },
                ]);
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

    const getExpiredTasks = async (ongoingTasks: TaskTableProps[]) => {
        return ongoingTasks.filter((task) => {
            if (task.daysLeft && task.daysLeft < 0 && task.parentTaskId === null) {
                return true;
            }
            return false;
        });
    };

    const fetchProjectTasks = async (projectId: number) => {
        setTsLastLoadProjectTasks(Date.now());
        const _onGoingTasks: TaskTableProps[] = await popSpecificProjectTasks(
            projectId,
            taskTypes.ongoing.statuses
        );
        const _closedTasks: TaskTableProps[] = await popSpecificProjectTasks(
            projectId,
            taskTypes.closed.statuses
        );
        const _deletedTasks: TaskTableProps[] = await popSpecificProjectTasks(
            projectId,
            taskTypes.deleted.statuses
        );
        const _expiredTasks: TaskTableProps[] = await getExpiredTasks(_onGoingTasks);
        setOngoingTasks(_onGoingTasks);
        setClosedTasks(_closedTasks);
        setDeletedTasks(_deletedTasks);
        setExpiredTasks(_expiredTasks);
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
        // Update an ongoing task
        if (isTaskUpdated && currentPreviewTask) {
            setOngoingTasks((prevTasks) =>
                prevTasks.map((task) =>
                    task.id === String(currentPreviewTask.id)
                        ? {
                              id: String(currentPreviewTask.id) || null,
                              title: currentPreviewTask.title || null,
                              priority: currentPreviewTask.priority.priority || null,
                              effortLevel: currentPreviewTask.effortLevel.level || null,
                              createdDate: currentPreviewTask.createdDate || getLocalCurrentDate(),
                              updatedAt:
                                  currentPreviewTask.updatedAt || getLocalCurrentTimestamp(),
                              dueDate: currentPreviewTask.dueDate || null,
                              daysLeft: currentPreviewTask.daysLeft || null,
                              status: currentPreviewTask.status.status || null,
                              assigneeId: currentPreviewTask.assignee.userId || null,
                              assigneeEmail: currentPreviewTask.assignee.userEmail || null,
                              assigneeName: currentPreviewTask.assignee.userName || null,
                              assigneeImgPath: currentPreviewTask.assignee.avatarImgPath || null,
                              parentTaskId: currentPreviewTask.parentTaskId
                                  ? String(currentPreviewTask.parentTaskId)
                                  : null,
                              rootTaskId: currentPreviewTask.rootTaskId,
                              threadId: currentPreviewTask.threadId || null,
                              tags: currentPreviewTask.tags || [],
                              concatTags: currentPreviewTask.concatTags || "//",
                              teamId: myself.teamId || null,
                              projectId: currentPreviewTask.project?.projectId || null,
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

        // Task update state
        isTaskCommentUpdated,
        setIsTaskCommentUpdated,

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
        ongoingTasks,
        setOngoingTasks,
        closedTasks,
        setClosedTasks,
        deletedTasks,
        setDeletedTasks,
        expiredTasks,
        setExpiredTasks,

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
        fetchProjectTasks,
    };
};
