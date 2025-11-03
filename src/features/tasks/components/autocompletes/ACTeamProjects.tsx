import Autocomplete from "@mui/joy/Autocomplete";

import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskProps } from "../../../../types/tasks";

type ACTeamProjectsProps = {
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    isOpenProjectList: boolean;
    setIsOpenProjectList: (value: boolean) => void;
    setTaskUpdated?: (value: boolean) => void;
    PM: ProjectManagementState;
};
export const ACTeamProjects = (props: ACTeamProjectsProps) => {
    const {
        PM,
        taskContent,
        setTaskContent,
        isOpenProjectList,
        setIsOpenProjectList,
        setTaskUpdated,
    } = props;

    return (
        <Autocomplete
            key={taskContent.id}
            getOptionLabel={(option) => option.projectName}
            isOptionEqualToValue={(option, value) => option.projectId === value.projectId}
            options={PM.teamProjects}
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
                        PM.setCurrentProject({
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
