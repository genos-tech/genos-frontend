import { Box, Avatar, Grid, IconButton, ListItem, List, Typography } from "@mui/joy";
import AddIcon from '@mui/icons-material/Add';

import { TaskDueDateInput } from './common/TaskDueDateInput';
import { GitHubURLManager } from './common/GitHubURLManager';
import { GeneralURLManager } from './common/GeneralURLManager';
import { ACProjectTags } from '../autocompletes/ACProjectTags';
import { ACTeamUsers } from '../autocompletes/ACTeamUsers';
import { ACTeamProjects } from '../autocompletes/ACTeamProjects';
import { ACTaskPriority } from '../autocompletes/ACTaskPriority';
import { ACTaskEffortLevel } from '../autocompletes/ACTaskEffortLevel';
import { ACTaskStatus } from '../autocompletes/ACTaskStatus';
import {
    TaskProps,
    ProjectProps,
    TagListProps,
} from "../../../../types/tasks";
import { UserProps } from '../../../../types/admin';

type TaskMainBlockProps = {
    taskContents: TaskProps,
    setTaskContents: (value: TaskProps) => void,
    teamMembers: UserProps[],
    teamProjects: ProjectProps[],
    projectTags: TagListProps[],
    myself: UserProps,
    assigneeName: string,
    setAssigneeName: (value: string) => void,
    reporterName: string,
    setReporterName: (value: string) => void,
    isOpenTeamMembersList: boolean,
    setIsOpenTeamMembersList: (value: boolean) => void,
    isOpenProjectList: boolean,
    setIsOpenProjectList: (value: boolean) => void,
    isOpenTagList: boolean,
    setIsOpenTagList: (value: boolean) => void,
    setOpenCreateTag: (value: boolean) => void,
    setCurrentProject: (value: ProjectProps) => void,
    isPreviewMode: boolean,
    setTaskUpdated?: (value: boolean) => void,
}
export const TaskMainBlock = (props: TaskMainBlockProps) => {
    const {
        taskContents,
        setTaskContents,
        teamMembers,
        teamProjects,
        projectTags,
        myself,
        assigneeName,
        setAssigneeName,
        reporterName,
        setReporterName,
        isOpenTeamMembersList,
        setIsOpenTeamMembersList,
        isOpenProjectList,
        setIsOpenProjectList,
        isOpenTagList,
        setIsOpenTagList,
        setOpenCreateTag,
        setCurrentProject,
        isPreviewMode,
        setTaskUpdated
    } = props

    return (
        <Box
            sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
            }}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <List aria-labelledby="decorated-list-demo">
                    <ListItem sx={{ display: "flex", alignItems: "center", width: '65%' }}>
                        <Typography sx={{ minWidth: "80px" }}>Assignee:</Typography>
                        <Avatar size="sm">{assigneeName !== "" ? assigneeName[0] : ""}</Avatar>
                        <ACTeamUsers
                            myself={myself}
                            initialUser={taskContents.assignee}
                            teamMembers={teamMembers}
                            taskContents={taskContents}
                            setTaskContents={setTaskContents}
                            setUserName={setAssigneeName}
                            isOpenTeamMembersList={isOpenTeamMembersList}
                            setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                            isAssignee={true}
                            setTaskUpdated={setTaskUpdated}
                        />
                    </ListItem>

                    <ListItem sx={{ display: "flex", alignItems: "center", width: '65%' }}>
                        <Typography sx={{ minWidth: "80px" }}>Reporter:</Typography>
                        <Avatar size="sm">{reporterName !== "" ? reporterName[0] : ""}</Avatar>
                        <ACTeamUsers
                            myself={myself}
                            initialUser={taskContents.reporter}
                            teamMembers={teamMembers}
                            taskContents={taskContents}
                            setTaskContents={setTaskContents}
                            setUserName={setReporterName}
                            isOpenTeamMembersList={isOpenTeamMembersList}
                            setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                            isAssignee={false}
                            setTaskUpdated={setTaskUpdated}
                        />
                    </ListItem>

                    <Grid container spacing={2}>
                        <Grid key={1} xs={6}>
                            <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                <Typography sx={{ minWidth: "80px" }}>Project:</Typography>
                                <ACTeamProjects
                                    teamProjects={teamProjects}
                                    taskContents={taskContents}
                                    setTaskContents={setTaskContents}
                                    isOpenProjectList={isOpenProjectList}
                                    setIsOpenProjectList={setIsOpenProjectList}
                                    setCurrentProject={setCurrentProject}
                                    setTaskUpdated={setTaskUpdated}
                                />
                            </ListItem>
                        </Grid>
                        <Grid key={2} xs={6}>
                            <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                <Typography sx={{ minWidth: "40px" }}>Tags:</Typography>
                                <ACProjectTags
                                    projectTags={projectTags}
                                    taskContents={taskContents}
                                    setTaskContents={setTaskContents}
                                    isOpenTagList={isOpenTagList}
                                    setIsOpenTagList={setIsOpenTagList}
                                    setTaskUpdated={setTaskUpdated}
                                />
                                <IconButton
                                    size="sm"
                                    variant="soft"
                                    color="neutral"
                                    onClick={() => { setOpenCreateTag(true) }}
                                >
                                    <AddIcon />
                                </IconButton>
                            </ListItem>
                        </Grid>
                    </Grid>

                    <Grid container spacing={2}>
                        <Grid key={1} xs={6}>
                            <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                <Typography sx={{ minWidth: "80px" }}>Priority:</Typography>
                                <ACTaskPriority
                                    taskContents={taskContents}
                                    setTaskContents={setTaskContents}
                                    setTaskUpdated={setTaskUpdated}
                                />
                            </ListItem>
                        </Grid>
                        <Grid key={2} xs={6}>

                            <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                <Typography sx={{ minWidth: "100px" }}>Effort Level:</Typography>
                                <ACTaskEffortLevel
                                    taskContents={taskContents}
                                    setTaskContents={setTaskContents}
                                    setTaskUpdated={setTaskUpdated}
                                />
                            </ListItem>

                        </Grid>
                    </Grid>

                    {isPreviewMode === true && (
                        <ListItem sx={{ width: '50%' }}>
                            <Typography sx={{ minWidth: "80px" }}>Status:</Typography>
                            <ACTaskStatus
                                taskContents={taskContents}
                                setTaskContents={setTaskContents}
                                setTaskUpdated={setTaskUpdated}
                            />
                        </ListItem>
                    )}

                    <ListItem>
                        <TaskDueDateInput
                            taskContents={taskContents}
                            setTaskContents={setTaskContents}
                        />
                    </ListItem>

                    <ListItem>
                        <GitHubURLManager
                            githubLink={taskContents.githubLink}
                            taskContents={taskContents}
                            setTaskContents={setTaskContents}
                            isPreviewMode={isPreviewMode}
                        />
                    </ListItem>
                    <ListItem>
                        <GeneralURLManager
                            generalLink={taskContents.generalLink}
                            taskContents={taskContents}
                            setTaskContents={setTaskContents}
                            isPreviewMode={isPreviewMode}
                        />
                    </ListItem>
                </List>
            </Box>
        </Box>
    )
}