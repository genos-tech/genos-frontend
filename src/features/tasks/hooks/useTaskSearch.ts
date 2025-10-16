import { useEffect, useState } from "react";

import { UserProps } from "../../../types/admin";
import { SearchTeamTasksResponse, TaskType } from "../../../types/tasks";
import { loadTeamTaskList } from "../services/loadTaskSearchList";

interface UseTaskSearchProps {
    myself: UserProps;
    currentProject: any;
    displayTaskType: TaskType;
    accessToken: string;
}

export const useTaskSearch = ({
    myself,
    currentProject,
    displayTaskType,
    accessToken,
}: UseTaskSearchProps) => {
    const [openSearch, setOpenSearch] = useState(false);
    const [teamTaskSearchOptions, setTeamTaskOptions] = useState<SearchTeamTasksResponse[]>([]);

    const loading = openSearch && teamTaskSearchOptions.length === 0;

    const updateTeamTaskSearchOptions = async (active: boolean) => {
        if (currentProject && currentProject.projectId) {
            const loadedTeamTasks: SearchTeamTasksResponse[] = await loadTeamTaskList(
                myself,
                currentProject?.projectId || -1,
                displayTaskType.statuses.join(","),
                -1,
                accessToken
            );

            if (active) {
                setTeamTaskOptions([...loadedTeamTasks]);
            }
        }
    };

    useEffect(() => {
        let active = true;

        if (!loading) {
            return undefined;
        }

        updateTeamTaskSearchOptions(active);

        return () => {
            active = false;
        };
    }, [loading]);

    useEffect(() => {
        updateTeamTaskSearchOptions(true);
    }, [displayTaskType]);

    const handleSearchOpen = () => {
        setOpenSearch(true);
        setTeamTaskOptions([]);
    };

    const handleSearchClose = () => {
        setOpenSearch(false);
    };

    return {
        openSearch,
        teamTaskSearchOptions,
        loading,
        handleSearchOpen,
        handleSearchClose,
    };
};
