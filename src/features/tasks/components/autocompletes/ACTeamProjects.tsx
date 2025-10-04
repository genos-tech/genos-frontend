import Autocomplete from "@mui/joy/Autocomplete";

import { ProjectProps, TaskProps } from "../../../../types/tasks";

type ACTeamProjectsProps = {
    teamProjects: ProjectProps[];
    taskContents: TaskProps;
    setTaskContents: (value: TaskProps) => void;
    isOpenProjectList: boolean;
    setIsOpenProjectList: (value: boolean) => void;
    setCurrentProject: (value: ProjectProps) => void;
    setTaskUpdated?: (value: boolean) => void;
};
export const ACTeamProjects = (props: ACTeamProjectsProps) => {
    const {
        teamProjects,
        taskContents,
        setTaskContents,
        isOpenProjectList,
        setIsOpenProjectList,
        setCurrentProject,
        setTaskUpdated,
    } = props;

    return (
        <Autocomplete
            key={taskContents.id}
            options={teamProjects}
            getOptionLabel={(option) => option.projectName}
            value={taskContents.project?.projectId ? taskContents.project : undefined}
            isOptionEqualToValue={(option, value) => option.projectId === value.projectId}
            onChange={(event, value) => {
                if (value !== null) {
                    setTaskContents({
                        ...taskContents,
                        project: {
                            projectId: value.projectId,
                            projectName: value.projectName,
                            projectTags: [],
                            systemUserId: value.systemUserId,
                        },
                        tags: [],
                    });
                    if (value.projectId) {
                        setCurrentProject({
                            projectId: value.projectId,
                            projectName: value.projectName,
                            projectTags: [],
                            systemUserId: value.systemUserId,
                        });
                    } else {
                        console.error("Failed to set the current project");
                    }
                    if (setTaskUpdated) {
                        setTaskUpdated(true);
                    }
                }
            }}
            onOpen={() => setIsOpenProjectList(!isOpenProjectList)}
            size="sm"
            sx={{ width: "100%" }}
        />
    );
};
