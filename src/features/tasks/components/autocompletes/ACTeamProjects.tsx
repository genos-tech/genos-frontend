import Autocomplete from "@mui/joy/Autocomplete";

import { ProjectProps, TaskProps } from "../../../../types/tasks";

type ACTeamProjectsProps = {
    teamProjects: ProjectProps[];
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    isOpenProjectList: boolean;
    setIsOpenProjectList: (value: boolean) => void;
    setCurrentProject: (value: ProjectProps) => void;
    setTaskUpdated?: (value: boolean) => void;
};
export const ACTeamProjects = (props: ACTeamProjectsProps) => {
    const {
        teamProjects,
        taskContent,
        setTaskContent,
        isOpenProjectList,
        setIsOpenProjectList,
        setCurrentProject,
        setTaskUpdated,
    } = props;

    return (
        <Autocomplete
            key={taskContent.id}
            getOptionLabel={(option) => option.projectName}
            isOptionEqualToValue={(option, value) => option.projectId === value.projectId}
            options={teamProjects}
            size="sm"
            sx={{ width: "100%" }}
            value={taskContent.project?.projectId ? taskContent.project : undefined}
            onOpen={() => setIsOpenProjectList(!isOpenProjectList)}
            onChange={(event, value) => {
                if (value !== null) {
                    setTaskContent({
                        ...taskContent,
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
        />
    );
};
