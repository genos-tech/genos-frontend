import { useEffect, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import { Divider, Sheet } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { TaskNoteProps } from "../../../../types/notes";
import {
    AttachmentFileProps,
    TagListProps,
    TaskCommentProps,
    TaskProps,
} from "../../../../types/tasks";
import { loadTaskNotes } from "../../../notes/task-notes/services/loadTaskNotes";
import { loadTaskComments } from "../../services/loadTaskComments";
import { sendUpdatedSpecificTask } from "../../services/sendUpdatedSpecificTask";
import {
    updateProjectOptions,
    updateTagOptions,
    updateTeamMembersOptions,
} from "../../services/updateTaskAutoCompleteOptions";
import { TaskBodyBlock } from "./base/TaskBodyBlock";
import { TaskCustomBarBlock } from "./base/TaskCustomBarBlock";
import { TaskMainBlock } from "./base/TaskMainBlock";
import { TaskSubTasksBlock } from "./base/TaskSubTasksBlock";
import { TaskTabBlock } from "./base/TaskTabBlock";
import { TaskTitleBlock } from "./base/TaskTitleBlock";

type TaskPreviewProps = {
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    usePM: ProjectManagementState;
    useUISM: UIStateManagementState;
    useTM: TaskManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useNM: NoteManagementState;
};

export const TaskPreview = (props: TaskPreviewProps) => {
    const { socket, myself, setMyself, usePM, useNM, useTM, useUISM, useTEM, useCM } = props;
    const { accessToken } = useAuth();
    const [taskClosed, setTaskClosed] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<AttachmentFileProps[]>(
        useTM.currentPreviewTask?.attachments || []
    );
    const [taskUpdated, setTaskUpdated] = useState(false);
    const [startIntervalUpdatingTask, setStartIntervalUpdatingTask] = useState(false);
    const [taskStatusUpdated, setTaskStatusUpdated] = useState(false);
    const [taskBodyEdited, setTaskBodyEdited] = useState(false);
    const [taskBodySaved, setTaskBodySaved] = useState(false);
    const [isAttachmentDeleted, setIsAttachmentDeleted] = useState(false);
    const [deletedAttachmentId, setDeletedAttachmentId] = useState<number>(-1);
    const [tmpCurrentTaskContent, setTmpCurrentTaskContent] = useState<TaskProps>(
        useTM.currentPreviewTask || ({} as TaskProps)
    );
    const [taskTitle, setTaskTitle] = useState<string>(useTM.currentPreviewTask?.title || "");
    const [body, setBody] = useState<PartialBlock[]>(useTM.currentPreviewTask?.body || []);
    const [assignee, setAssignee] = useState<UserProps>(
        useTM.currentPreviewTask?.assignee || myself
    );
    const [reporter, setReporter] = useState<UserProps>(
        useTM.currentPreviewTask?.reporter || myself
    );
    const [currentTaskId, setCurrentTaskId] = useState<number | undefined>(
        useTM.currentPreviewTask?.id
    );

    const [tabIndex, setTabIndex] = useState(0);

    // Save initial task title to restore it when use input empty title
    const [initTaskTitle, setInitTaskTitle] = useState<string>(
        useTM.currentPreviewTask?.title || ""
    );

    // For task comments
    const [isInEdit, setIsInEdit] = useState<boolean>(false);
    const [editTargetComment, setEditTargetComment] = useState<TaskCommentProps>();

    // Set the current preview task when the component is mounted
    useEffect(() => {
        setTmpCurrentTaskContent(useTM.currentPreviewTask || ({} as TaskProps));
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

        if (taskSwitched && useTM.currentPreviewTask) {
            // Initialize the following variable when user switches the previewing task
            setTmpCurrentTaskContent(useTM.currentPreviewTask);
            useTM.setCurrentPreviewTask(useTM.currentPreviewTask);
            setCurrentTaskId(useTM.currentPreviewTask.id);
            setBody(useTM.currentPreviewTask.body || []);
        } else {
            // Update only the tmpCurrentTaskContent when user updated the task content
            // (Not switched the previewing task)
            setTmpCurrentTaskContent(newTaskContent);
            useTM.setCurrentPreviewTask(newTaskContent);
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
            if (useTM.currentPreviewTask) {
                setTmpCurrentTaskContent(useTM.currentPreviewTask);
                setCurrentTaskId(useTM.currentPreviewTask.id);
                setBody(useTM.currentPreviewTask.body || []);
            }
        }

        // setUploadedFiles(currentPreviewTask.attachments);
    }, [useTM.currentPreviewTask]);

    // Update task title/attachments when the visible task Id is changed
    // This will be executed after the above useEffect is executed
    //  (i.e., after `setCurrentTaskId` is executed)
    useEffect(() => {
        if (currentTaskId) {
            setTaskTitle(useTM.currentPreviewTask?.title || "");
            setInitTaskTitle(useTM.currentPreviewTask?.title || "");
            setUploadedFiles(useTM.currentPreviewTask?.attachments || []);
        }
    }, [currentTaskId]);

    useEffect(() => {
        // Save task before the opening task preview is closed.
        if (taskClosed)
            if (taskBodyEdited) {
                const execute = async () => {
                    await sendUpdatedTask(false);
                    if (useTM.setIsTaskPreviewVisible) {
                        useTM.setIsTaskPreviewVisible(false);
                    }
                };
                execute();
            } else {
                if (useTM.setIsTaskPreviewVisible) {
                    useTM.setIsTaskPreviewVisible(false);
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
        if (useTM.isTaskUpdated === false) {
            useTM.setCurrentPreviewTask(tmpCurrentTaskContent);
            useTM.setIsTaskUpdated(true);
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
                Number(useTM.currentPreviewTask?.id),
                accessToken
            );
            if (loadedTaskComments.length > 0) {
                setTaskComments(loadedTaskComments);
            } else {
                setTaskComments([]);
            }
        })();
    }, [useTM.isTaskCommentUpdated, currentTaskId]);

    // Get Task Notes
    const [taskNotes, setTaskNotes] = useState<TaskNoteProps[]>([]);
    useEffect(() => {
        (async () => {
            if (useTM.currentPreviewTask?.project) {
                const loadedTaskNotes: TaskNoteProps[] = await loadTaskNotes(
                    myself,
                    Number(useTM.currentPreviewTask.project.projectId),
                    Number(useTM.currentPreviewTask.id),
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
    }, [currentTaskId, useNM.taskNoteMeta]);

    // Get team members
    const [isOpenTeamMembersList, setIsOpenTeamMembersList] = useState(false);
    useEffect(() => {
        updateTeamMembersOptions({
            myself: myself,
            accessToken: accessToken,
            setTeamMembers: useTEM.setTeamMembers,
        });
    }, [isOpenTeamMembersList]);

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

    // This is for auto scrolling to the bottom when an user switches the tab.
    useEffect(() => {
        const sheet = sheetRef.current;
        if (sheet) {
            sheet.scrollTop = sheet.scrollHeight; // scroll to bottom
        }
    }, [tabIndex]); // re-run whenever content changes

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
                        useCM={useCM}
                        isPreviewMode={true}
                        myself={myself}
                        setTaskClosed={setTaskClosed}
                        setTaskContent={setTmpCurrentTaskContent}
                        setTaskStatusUpdated={setTaskStatusUpdated}
                        setTaskTitle={setTaskTitle}
                        setTaskUpdated={setTaskUpdated}
                        taskContent={tmpCurrentTaskContent}
                        taskTitle={taskTitle}
                        useTM={useTM}
                        useUISM={useUISM}
                        useNM={useNM}
                        usePM={usePM}
                    />

                    <Divider sx={{ mt: 1, mb: 1 }} />

                    <TaskMainBlock
                        assignee={assignee}
                        useCM={useCM}
                        isOpenProjectList={isOpenProjectList}
                        isOpenTagList={isOpenTagList}
                        isOpenTeamMembersList={isOpenTeamMembersList}
                        isPreviewMode={true}
                        myself={myself}
                        projectTags={projectTags}
                        reporter={reporter}
                        setAssignee={setAssignee}
                        setIsOpenProjectList={setIsOpenProjectList}
                        setIsOpenTagList={setIsOpenTagList}
                        setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                        setMyself={setMyself}
                        setReporter={setReporter}
                        setTaskContent={setTmpCurrentTaskContent}
                        setTaskStatusUpdated={setTaskStatusUpdated}
                        setTaskUpdated={setTaskUpdated}
                        socket={socket}
                        taskContent={tmpCurrentTaskContent}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                        usePM={usePM}
                    />

                    <Divider sx={{ mt: 1, mb: 1 }} />

                    <TaskCustomBarBlock
                        setTaskContent={setTmpCurrentTaskContent}
                        setTaskStatusUpdated={setTaskStatusUpdated}
                        setTaskUpdated={setTaskUpdated}
                        taskBodySaved={taskBodySaved}
                        taskContent={tmpCurrentTaskContent}
                    />

                    <TaskBodyBlock
                        key={`TaskBodyBlock-${tmpCurrentTaskContent.id}`}
                        body={body}
                        useCM={useCM}
                        myself={myself}
                        setBody={setBody}
                        setMyself={setMyself}
                        setTaskBodyEdited={setTaskBodyEdited}
                        setTaskBodySaved={setTaskBodySaved}
                        socket={socket}
                        taskId={tmpCurrentTaskContent.id}
                        useTEM={useTEM}
                        useUISM={useUISM}
                    />

                    <Divider sx={{ mt: 2 }} />

                    <TaskSubTasksBlock
                        useCM={useCM}
                        useTM={useTM}
                        currentTaskContent={tmpCurrentTaskContent}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useTEM={useTEM}
                        useUISM={useUISM}
                    />

                    <TaskTabBlock
                        useCM={useCM}
                        editTargetComment={editTargetComment}
                        isInEdit={isInEdit}
                        myself={myself}
                        setDeletedAttachmentId={setDeletedAttachmentId}
                        setEditTargetComment={setEditTargetComment}
                        setIsAttachmentDeleted={setIsAttachmentDeleted}
                        setIsInEdit={setIsInEdit}
                        setMyself={setMyself}
                        setTabIndex={setTabIndex}
                        setTaskCommentLines={setTaskCommentLines}
                        setTaskComments={setTaskComments}
                        setTaskContent={setTmpCurrentTaskContent}
                        setTaskUpdated={setTaskUpdated}
                        setUploadedFiles={setUploadedFiles}
                        socket={socket}
                        tabIndex={tabIndex}
                        taskCommentLines={taskCommentLines}
                        taskComments={taskComments}
                        taskContent={tmpCurrentTaskContent}
                        taskNotes={taskNotes}
                        useTEM={useTEM}
                        useTM={useTM}
                        tmpCurrentTaskContent={tmpCurrentTaskContent}
                        useUISM={useUISM}
                        uploadedFiles={uploadedFiles}
                        useNM={useNM}
                    />
                </Sheet>
            )}
        </>
    );
};
