import { useEffect, useState } from "react";

import { UserProps } from "../../../types/admin";
import { SearchTeamTasksResponse, TaskType } from "../../../types/tasks";
import { loadTeamTaskList } from "../services/loadTaskSearchList";

interface UseTaskSearchProps {
    myself: UserProps;
    currentProject: any;
    accessToken: string;
}

export const useTaskSearch = ({ myself, currentProject, accessToken }: UseTaskSearchProps) => {
    const [openSearch, setOpenSearch] = useState(false);
    const [teamTaskSearchOptions, setTeamTaskOptions] = useState<SearchTeamTasksResponse[]>([]);

    const loading = openSearch && teamTaskSearchOptions.length === 0;

    useEffect(() => {
        let active = true;

        if (!loading) {
            return undefined;
        }

        return () => {
            active = false;
        };
    }, [loading]);

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
