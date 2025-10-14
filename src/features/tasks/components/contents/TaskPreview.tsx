import { useEffect, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import { Divider, Sheet } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ChatProps } from "../../../../types/chat";
import { TaskNoteMetaProps, TaskNoteProps } from "../../../../types/notes";
import {
    AttachmentFileProps,
    ProjectProps,
    TagListProps,
    TaskCommentProps,
    TaskProps,
} from "../../../../types/tasks";
import { loadTaskComments } from "../../services/loadTaskComments";
import { loadTaskNotes } from "../../services/loadTaskNotes";
import { sendUpdatedSpecificTask } from "../../services/sendUpdatedSpecificTask";
import {
    updateProjectOptions,
    updateTagOptions,
    updateTeamMembersOptions,
} from "../../services/updateTaskAutoCompleteOptions";
import { TaskBodyBlock } from "./base/TaskBodyBlock";
import { TaskCommentEditorBlock } from "./base/TaskCommentEditorBlock";
import { TaskCustomBarBlock } from "./base/TaskCustomBarBlock";
import { TaskMainBlock } from "./base/TaskMainBlock";
import { TaskSubTasksBlock } from "./base/TaskSubTasksBlock";
import { TaskTabBlock } from "./base/TaskTabBlock";
import { TaskTitleBlock } from "./base/TaskTitleBlock";

type TaskPreviewProps = {
    teamMembers: UserProps[];
    setTeamMembers: (value: UserProps[]) => void;
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    setCurrentProject: (value: ProjectProps) => void;
    setIsMainChatVisible?: (value: boolean) => void;
    setIsThreadVisible?: (value: boolean) => void;
    isThreadVisible?: boolean;
    setOpenCreateProject: (value: boolean) => void;
    isTaskUpdated?: boolean;
    setIsTaskUpdated?: (value: boolean) => void;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    setIsTaskHomeVisible?: (value: boolean) => void;
    isTaskPreviewVisible?: boolean;
    setIsTaskNoteVisible?: (value: boolean) => void;
    handleCreateNewTaskNote: (
        parentNoteId: number | null,
        projectId: number,
        taskId: number,
        title?: string
    ) => Promise<void>;
    setCurrentTaskNote: (value: TaskNoteProps) => void;
    isTaskNoteVisible: boolean;
    teamProjects: ProjectProps[];
    setTeamProjects: (value: ProjectProps[]) => void;
    taskNoteMeta: TaskNoteMetaProps[];
    setIsTaskVisibleInNote?: (value: boolean) => void;
    moveToSpecificChat: (
        chatType: number,
        chatId: number,
        threadId: number,
        openTaskNoteInChat: boolean,
        openThreadTaskPreview: boolean,
        setOpeningService: (service: number) => void,
        setCurrentPreviewTaskId: (id: number) => void,
        setCurrentProject: (project: any) => void
    ) => void;
    openingService: number;
    TM: TaskManagementState;
};

export const TaskPreview = (props: TaskPreviewProps) => {
    const {
        teamMembers,
        setTeamMembers,
        teamMemberProfiles,
        socket,
        myself,
        setMyself,
        setCurrentProject,
        setIsMainChatVisible,
        setIsThreadVisible,
        isThreadVisible,
        setOpenCreateProject,
        isTaskUpdated,
        setIsTaskUpdated,
        setOpeningService,
        setCurrentMainChat,
        setIsTaskHomeVisible,
        isTaskPreviewVisible,
        setIsTaskNoteVisible,
        handleCreateNewTaskNote,
        setCurrentTaskNote,
        isTaskNoteVisible,
        teamProjects,
        setTeamProjects,
        taskNoteMeta,
        setIsTaskVisibleInNote,
        moveToSpecificChat,
        openingService,
        TM,
    } = props;
    const { accessToken } = useAuth();
    const [taskClosed, setTaskClosed] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<AttachmentFileProps[]>(
        TM.currentPreviewTask?.attachments || []
    );
    const [taskUpdated, setTaskUpdated] = useState(false);
    const [startIntervalUpdatingTask, setStartIntervalUpdatingTask] = useState(false);
    const [taskStatusUpdated, setTaskStatusUpdated] = useState(false);
    const [taskBodyEdited, setTaskBodyEdited] = useState(false);
    const [taskBodySaved, setTaskBodySaved] = useState(false);
    const [isAttachmentDeleted, setIsAttachmentDeleted] = useState(false);
    const [deletedAttachmentId, setDeletedAttachmentId] = useState<number>(-1);
    const [tmpCurrentTaskContent, setTmpCurrentTaskContent] = useState<TaskProps>(
        TM.currentPreviewTask || ({} as TaskProps)
    );
    const [taskTitle, setTaskTitle] = useState<string>(TM.currentPreviewTask?.title || "");
    const [body, setBody] = useState<PartialBlock[]>(TM.currentPreviewTask?.body || []);
    const [assignee, setAssignee] = useState<UserProps>(TM.currentPreviewTask?.assignee || myself);
    const [reporter, setReporter] = useState<UserProps>(TM.currentPreviewTask?.reporter || myself);
    const [currentTaskId, setCurrentTaskId] = useState<number | undefined>(
        TM.currentPreviewTask?.id
    );

    // Save initial task title to restore it when use input empty title
    const [initTaskTitle, setInitTaskTitle] = useState<string>(TM.currentPreviewTask?.title || "");

    // For task comments
    const [isInEdit, setIsInEdit] = useState<boolean>(false);
    const [editTargetComment, setEditTargetComment] = useState<TaskCommentProps>();

    // Set the current preview task when the component is mounted
    useEffect(() => {
        setTmpCurrentTaskContent(TM.currentPreviewTask || ({} as TaskProps));
    }, []);

    // Send updated task to the backend when task is updated
    const sendUpdatedTask = async (taskSwitched: boolean) => {
        const newTaskContent: TaskProps = {
            ...tmpCurrentTaskContent,
            title: taskTitle === "" ? initTaskTitle : taskTitle,
            body: body,
        };

        const uploadAttachments = await sendUpdatedSpecificTask(
            socket,
            myself,
            newTaskContent,
            taskBodyEdited,
            taskStatusUpdated,
            accessToken
        );

        if (uploadAttachments && uploadAttachments.length > 0) {
            let uploadedAttachments: AttachmentFileProps[] = [];
            uploadAttachments.map((attachment: any) => {
                if (attachment.attachment_id) {
                    uploadedAttachments = [
                        ...uploadedAttachments,
                        {
                            attachment_id: attachment.attachment_id,
                            file: attachment.attached_file,
                            file_base64: attachment.file_base64,
                            name: attachment.name,
                            type: attachment.attached_type,
                        },
                    ];
                }
            });
            setUploadedFiles([...uploadedFiles, ...uploadedAttachments]);
        }

        if (taskSwitched && TM.currentPreviewTask) {
            // Initialize the following variable when user switches the previewing task
            setTmpCurrentTaskContent(TM.currentPreviewTask);
            TM.setCurrentPreviewTask(TM.currentPreviewTask);
            setCurrentTaskId(TM.currentPreviewTask.id);
            setBody(TM.currentPreviewTask.body || []);
        } else {
            // Update only the tmpCurrentTaskContent when user updated the task content
            // (Not switched the previewing task)
            setTmpCurrentTaskContent(newTaskContent);
            TM.setCurrentPreviewTask(newTaskContent);
        }
        setTaskUpdated(false);
        setTaskBodySaved(true);
        setTaskStatusUpdated(false);
        setTaskBodyEdited(false);
        setStartIntervalUpdatingTask(false);
    };

    useEffect(() => {
        // Save updated task (title, assignee, status, ..., but not task body)
        if (taskUpdated === true) {
            sendUpdatedTask(false);
        }
    }, [taskUpdated]);

    useEffect(() => {
        if (startIntervalUpdatingTask) {
            sendUpdatedTask(false);
        }
    }, [startIntervalUpdatingTask]);

    // Auto save task body every Nms if needed
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (taskBodyEdited === true) {
                setStartIntervalUpdatingTask(true);
            }
        }, 3000);

        // Clean up the interval when the component unmounts
        return () => clearInterval(intervalId);
    }, [taskBodyEdited]);

    // Update variables when an user change the target task
    useEffect(() => {
        if (taskBodyEdited) {
            sendUpdatedTask(true);
        } else {
            if (TM.currentPreviewTask) {
                setTmpCurrentTaskContent(TM.currentPreviewTask);
                setCurrentTaskId(TM.currentPreviewTask.id);
                setBody(TM.currentPreviewTask.body || []);
            }
        }

        // setUploadedFiles(currentPreviewTask.attachments);
    }, [TM.currentPreviewTask]);

    // Update task title/attachments when the visible task Id is changed
    // This will be executed after the above useEffect is executed
    //  (i.e., after `setCurrentTaskId` is executed)
    useEffect(() => {
        if (currentTaskId) {
            setTaskTitle(TM.currentPreviewTask?.title || "");
            setInitTaskTitle(TM.currentPreviewTask?.title || "");
            setUploadedFiles(TM.currentPreviewTask?.attachments || []);
        }
    }, [currentTaskId]);

    useEffect(() => {
        // Save task before the opening task preview is closed.
        if (taskClosed)
            if (taskBodyEdited) {
                const execute = async () => {
                    await sendUpdatedTask(false);
                    if (TM.setIsTaskPreviewVisible) {
                        TM.setIsTaskPreviewVisible(false);
                    }
                };
                execute();
            } else {
                if (TM.setIsTaskPreviewVisible) {
                    TM.setIsTaskPreviewVisible(false);
                }
            }
    }, [taskClosed]);

    // Update attachments
    useEffect(() => {
        if (
            tmpCurrentTaskContent !== null &&
            tmpCurrentTaskContent !== undefined &&
            uploadedFiles.length > 0
        ) {
            (async () => {
                setTmpCurrentTaskContent({
                    ...tmpCurrentTaskContent,
                    attachments: uploadedFiles,
                });
                setAssignee(tmpCurrentTaskContent.assignee);
                setReporter(tmpCurrentTaskContent.reporter);
            })();
        }
    }, [uploadedFiles]);

    useEffect(() => {
        if (setIsTaskUpdated && isTaskUpdated === false) {
            TM.setCurrentPreviewTask(tmpCurrentTaskContent);
            setIsTaskUpdated(true);
            setAssignee(tmpCurrentTaskContent?.assignee || myself);
            setReporter(tmpCurrentTaskContent?.reporter || myself);
        }
    }, [tmpCurrentTaskContent]);

    useEffect(() => {
        if (deletedAttachmentId !== -1 && isAttachmentDeleted === true) {
            setUploadedFiles((prev) =>
                prev.filter((attachment) => attachment.attachment_id !== deletedAttachmentId)
            );
            setIsAttachmentDeleted(false);
            setDeletedAttachmentId(-1);
        }
    }, [isAttachmentDeleted, deletedAttachmentId]);

    // Get Task Comments
    const [taskComments, setTaskComments] = useState<TaskCommentProps[]>([]);
    useEffect(() => {
        (async () => {
            const loadedTaskComments: TaskCommentProps[] = await loadTaskComments(
                myself,
                Number(TM.currentPreviewTask?.id),
                accessToken
            );
            if (loadedTaskComments.length > 0) {
                setTaskComments(loadedTaskComments);
            } else {
                setTaskComments([]);
            }
        })();
    }, [TM.isTaskCommentUpdated, currentTaskId]);

    // Get Task Notes
    const [taskNotes, setTaskNotes] = useState<TaskNoteProps[]>([]);
    useEffect(() => {
        (async () => {
            if (TM.currentPreviewTask?.project) {
                const loadedTaskNotes: TaskNoteProps[] = await loadTaskNotes(
                    myself,
                    Number(TM.currentPreviewTask.project.projectId),
                    Number(TM.currentPreviewTask.id),
                    accessToken
                );
                if (loadedTaskNotes.length > 0) {
                    setTaskNotes(loadedTaskNotes);
                } else {
                    setTaskNotes([]);
                }
            } else {
                setTaskNotes([]);
            }
        })();
    }, [TM.isTaskCommentUpdated, currentTaskId, taskNoteMeta]);

    // Get team members
    const [isOpenTeamMembersList, setIsOpenTeamMembersList] = useState(false);
    useEffect(() => {
        updateTeamMembersOptions({
            myself: myself,
            accessToken: accessToken,
            setTeamMembers: setTeamMembers,
        });
    }, [isOpenTeamMembersList]);

    // Get team projects
    const [isOpenProjectList, setIsOpenProjectList] = useState(false);
    useEffect(() => {
        updateProjectOptions({
            myself: myself,
            accessToken: accessToken,
            setTeamProjects: setTeamProjects,
        });
    }, [isOpenProjectList]);

    // Get Project tags
    const [projectTags, setProjectTags] = useState<TagListProps[]>([]);
    const [isOpenTagList, setIsOpenTagList] = useState(false);
    useEffect(() => {
        if (tmpCurrentTaskContent?.project) {
            updateTagOptions({
                myself: myself,
                accessToken: accessToken,
                projectId: tmpCurrentTaskContent.project.projectId,
                setProjectTags: setProjectTags,
            });
        }
    }, [isOpenTagList]);

    // This is for auto scrolling to the bottom when an user writes comment.
    const [taskCommentLines, setTaskCommentLines] = useState(0);
    const sheetRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const sheet = sheetRef.current;
        if (sheet && taskCommentLines > 1) {
            sheet.scrollTop = sheet.scrollHeight; // always scroll to bottom
        }
    }, [taskCommentLines]); // re-run whenever content changes

    return (
        <>
            {tmpCurrentTaskContent?.id && (
                <Sheet
                    ref={sheetRef}
                    className="custom-scrollbar"
                    variant="outlined"
                    sx={{
                        minHeight: 500,
                        borderRadius: "sm",
                        p: 2,
                        overflowY: "auto",
                        overflowX: "hidden",
                    }}
                >
                    <TaskTitleBlock
                        myself={myself}
                        taskContents={tmpCurrentTaskContent}
                        taskTitle={taskTitle}
                        setTaskTitle={setTaskTitle}
                        setOpenCreateProject={setOpenCreateProject}
                        setOpenCreateTag={TM.setOpenCreateTag}
                        setTaskClosed={setTaskClosed}
                        setTaskUpdated={setTaskUpdated}
                        isPreviewMode={true}
                        setIsMainChatVisible={setIsMainChatVisible}
                        setIsThreadVisible={setIsThreadVisible}
                        setIsTaskHomeVisible={setIsTaskHomeVisible}
                        setCurrentTaskContent={setTmpCurrentTaskContent}
                        setTaskStatusUpdated={setTaskStatusUpdated}
                        isTaskNoteVisible={isTaskNoteVisible}
                        setIsTaskVisibleInNote={setIsTaskVisibleInNote}
                        moveToSpecificChat={moveToSpecificChat}
                        openingService={openingService}
                        setOpeningService={setOpeningService}
                        setCurrentProject={setCurrentProject}
                        TM={TM}
                    />

                    <Divider sx={{ mt: 1, mb: 1 }} />

                    <TaskMainBlock
                        teamMemberProfiles={teamMemberProfiles}
                        socket={socket}
                        taskContents={tmpCurrentTaskContent}
                        setTaskContents={setTmpCurrentTaskContent}
                        teamMembers={teamMembers}
                        teamProjects={teamProjects}
                        projectTags={projectTags}
                        myself={myself}
                        setMyself={setMyself}
                        assignee={assignee}
                        setAssignee={setAssignee}
                        reporter={reporter}
                        setReporter={setReporter}
                        isOpenTeamMembersList={isOpenTeamMembersList}
                        setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                        isOpenProjectList={isOpenProjectList}
                        setIsOpenProjectList={setIsOpenProjectList}
                        isOpenTagList={isOpenTagList}
                        setIsOpenTagList={setIsOpenTagList}
                        setOpenCreateTag={TM.setOpenCreateTag}
                        setCurrentProject={setCurrentProject}
                        isPreviewMode={true}
                        setTaskUpdated={setTaskUpdated}
                        setOpeningService={setOpeningService}
                        setCurrentMainChat={setCurrentMainChat}
                        setCurrentPreviewTaskId={TM.setCurrentPreviewTaskId}
                        setTaskStatusUpdated={setTaskStatusUpdated}
                    />

                    <Divider sx={{ mt: 1, mb: 1 }} />

                    <TaskCustomBarBlock
                        currentTaskContent={tmpCurrentTaskContent}
                        setCurrentTaskContent={setTmpCurrentTaskContent}
                        setTaskStatusUpdated={setTaskStatusUpdated}
                        setTaskUpdated={setTaskUpdated}
                        setIsCreatingTask={TM.setIsCreatingTask}
                        taskBodySaved={taskBodySaved}
                        setIsTaskHomeVisible={setIsTaskHomeVisible}
                    />

                    <TaskBodyBlock
                        key={`TaskBodyBlock-${tmpCurrentTaskContent.id}`}
                        teamMemberProfiles={teamMemberProfiles}
                        socket={socket}
                        myself={myself}
                        setMyself={setMyself}
                        teamMembers={teamMembers}
                        taskId={tmpCurrentTaskContent.id}
                        body={body}
                        setBody={setBody}
                        setTaskBodyEdited={setTaskBodyEdited}
                        setTaskBodySaved={setTaskBodySaved}
                        setCurrentChat={setCurrentMainChat}
                        setOpeningService={setOpeningService}
                    />

                    <Divider sx={{ mt: 2 }} />

                    <TaskSubTasksBlock
                        teamMemberProfiles={teamMemberProfiles}
                        socket={socket}
                        myself={myself}
                        setMyself={setMyself}
                        currentPreviewTaskId={TM.currentPreviewTaskId}
                        currentTaskContent={tmpCurrentTaskContent}
                        setCurrentProject={setCurrentProject}
                        setCurrentPreviewTaskId={TM.setCurrentPreviewTaskId}
                        setOpeningService={setOpeningService}
                        setCurrentMainChat={setCurrentMainChat}
                    />

                    <TaskTabBlock
                        socket={socket}
                        myself={myself}
                        setMyself={setMyself}
                        teamMemberProfiles={teamMemberProfiles}
                        setCurrentChat={setCurrentMainChat}
                        setOpeningService={setOpeningService}
                        uploadedFiles={uploadedFiles}
                        setUploadedFiles={setUploadedFiles}
                        currentPreviewTaskId={TM.currentPreviewTaskId}
                        taskContents={tmpCurrentTaskContent}
                        setTaskContents={setTmpCurrentTaskContent}
                        setTaskUpdated={setTaskUpdated}
                        setIsAttachmentDeleted={setIsAttachmentDeleted}
                        setDeletedAttachmentId={setDeletedAttachmentId}
                        taskComments={taskComments}
                        isCommentUpdated={TM.isTaskCommentUpdated}
                        setIsInEdit={setIsInEdit}
                        setEditTargetComment={setEditTargetComment}
                        setIsTaskHomeVisible={setIsTaskHomeVisible}
                        setIsTaskNoteVisible={setIsTaskNoteVisible}
                        handleCreateNewTaskNote={handleCreateNewTaskNote}
                        taskNotes={taskNotes}
                        setCurrentTaskNote={setCurrentTaskNote}
                    />

                    <Divider sx={{ m: 2 }} />

                    <TaskCommentEditorBlock
                        teamMemberProfiles={teamMemberProfiles}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        teamMembers={teamMembers}
                        task={tmpCurrentTaskContent}
                        taskComments={taskComments}
                        setTaskComments={setTaskComments}
                        isCommentUpdated={TM.isTaskCommentUpdated}
                        setIsCommentUpdated={TM.setIsTaskCommentUpdated}
                        setCurrentChat={setCurrentMainChat}
                        setOpeningService={setOpeningService}
                        taskCommentLines={taskCommentLines}
                        setTaskCommentLines={setTaskCommentLines}
                        isInEdit={isInEdit}
                        setIsInEdit={setIsInEdit}
                        editTargetComment={editTargetComment}
                    />
                </Sheet>
            )}
        </>
    );
};
