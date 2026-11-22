import { useState } from "react";

import { SearchTeamTasksResponse } from "../../../types/tasks";

export const useTaskSearch = () => {
    const [openSearch, setOpenSearch] = useState(false);
    const [teamTaskSearchOptions, setTeamTaskOptions] = useState<SearchTeamTasksResponse[]>([]);

    const loading = openSearch && teamTaskSearchOptions.length === 0;

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
