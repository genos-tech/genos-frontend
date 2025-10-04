import { alpha } from "@mui/system";
import {
    ListItemContent,
    Autocomplete,
    AutocompleteOption,
    CircularProgress,
    Chip,
} from "@mui/joy";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { useColorScheme } from "@mui/joy/styles";

import { SearchTeamTasksResponse } from "../../../../types/tasks";

type TaskSidebarSearchBoxProps = {
    currentPreviewTaskId: number;
    openSearch: boolean;
    setOpenSearch: (value: boolean) => void;
    teamTaskSearchOptions: SearchTeamTasksResponse[];
    setTeamTaskSearchOptions: (value: SearchTeamTasksResponse[]) => void;
    loading: boolean;
    setCurrentPreviewTaskId: (value: number) => void;
    setIsTaskPreviewVisible: (value: boolean) => void;
};
export const TaskSidebarSearchBox = (props: TaskSidebarSearchBoxProps) => {
    const {
        currentPreviewTaskId,
        openSearch,
        setOpenSearch,
        teamTaskSearchOptions,
        setTeamTaskSearchOptions,
        loading,
        setCurrentPreviewTaskId,
        setIsTaskPreviewVisible,
    } = props;
    const { mode } = useColorScheme();

    function onChangeHandler(value: any) {
        if (value !== null) {
            setOpenSearch(false);
            setCurrentPreviewTaskId(value.taskId);
            setIsTaskPreviewVisible(true);
        }
    }

    return (
        <Autocomplete
            key={`ac-project-tags-${currentPreviewTaskId}`}
            sx={{ width: "100%" }}
            placeholder={"Search"}
            variant="soft"
            open={openSearch}
            onOpen={() => {
                setOpenSearch(true);
                // Reset the team task search options to load them again
                setTeamTaskSearchOptions([]);
            }}
            onClose={() => {
                setOpenSearch(false);
            }}
            isOptionEqualToValue={(option, value) => option.taskId === value.taskId}
            getOptionLabel={(option) => option.title}
            renderTags={(tags, getTagProps) =>
                tags.map((item, index) => {
                    const { key, ...tagProps } = getTagProps({ index }); // spread the 'key'
                    return (
                        <Chip
                            key={`ac-taskhome-search-task-chip-${key}`}
                            variant="soft"
                            sx={{
                                backgroundColor: alpha(
                                    item.status.color || "#0044c2",
                                    mode === "dark" ? 0.5 : 0.75
                                ),
                                color: item.status.textColor,
                                fontWeight: "bold",
                                borderRadius: "5px",
                            }}
                            size="sm"
                        >
                            {item.status.status}
                        </Chip>
                    );
                })
            }
            renderOption={(props, option) => (
                <AutocompleteOption {...props} key={`ac-taskhome-search-task-${option.taskId}`}>
                    <ListItemContent
                        sx={{
                            fontSize: "sm",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            width: "100%", // take full width of button
                        }}
                    >
                        <Chip
                            key={`ac-taskhome-search-task-id-chip-${option.taskId}`}
                            variant="outlined"
                            color="neutral"
                            size="sm"
                        >
                            ID:{option.taskId}
                        </Chip>
                        <Chip
                            key={`ac-taskhome-search-task-chip-${option.taskId}`}
                            variant="soft"
                            sx={{
                                backgroundColor: alpha(
                                    option.status.color || "#0044c2",
                                    mode === "dark" ? 0.5 : 0.75
                                ),
                                color: option.status.textColor,
                                fontWeight: "bold",
                                borderRadius: "5px",
                                m: "3px",
                            }}
                            size="sm"
                        >
                            {option.status.status}
                        </Chip>
                        {option.title}
                    </ListItemContent>
                </AutocompleteOption>
            )}
            options={teamTaskSearchOptions}
            loading={loading}
            endDecorator={
                loading ? (
                    <CircularProgress
                        size="sm"
                        sx={{
                            bgcolor: "background.surface",
                        }}
                    />
                ) : null
            }
            slotProps={{
                listbox: {
                    sx: {
                        zIndex: 10020,
                    },
                },
            }}
            onChange={(event, value) => onChangeHandler(value)}
            size="sm"
            startDecorator={<SearchRoundedIcon />}
            aria-label="Search"
            groupBy={(option) => option.projectName}
        />
    );
};
