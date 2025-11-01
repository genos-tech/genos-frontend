import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
    Autocomplete,
    AutocompleteOption,
    Chip,
    CircularProgress,
    ListItemContent,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

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
            aria-label="Search Tasks"
            getOptionLabel={(option) => option.title}
            groupBy={(option) => option.projectName}
            isOptionEqualToValue={(option, value) => option.taskId === value.taskId}
            loading={loading}
            open={openSearch}
            options={teamTaskSearchOptions}
            placeholder={"Search Tasks"}
            size="sm"
            startDecorator={<SearchRoundedIcon />}
            sx={{ width: "100%" }}
            variant="soft"
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
                            color="neutral"
                            size="sm"
                            variant="outlined"
                        >
                            ID:{option.taskId}
                        </Chip>
                        <Chip
                            key={`ac-taskhome-search-task-chip-${option.taskId}`}
                            size="sm"
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
                        >
                            {option.status.status}
                        </Chip>
                        {option.title}
                    </ListItemContent>
                </AutocompleteOption>
            )}
            renderTags={(tags, getTagProps) =>
                tags.map((item, index) => {
                    const { key, ...tagProps } = getTagProps({ index }); // spread the 'key'
                    return (
                        <Chip
                            key={`ac-taskhome-search-task-chip-${key}`}
                            size="sm"
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
                        >
                            {item.status.status}
                        </Chip>
                    );
                })
            }
            slotProps={{
                listbox: {
                    sx: {
                        zIndex: 10020,
                    },
                },
            }}
            onChange={(event, value) => onChangeHandler(value)}
            onClose={() => {
                setOpenSearch(false);
            }}
            onOpen={() => {
                setOpenSearch(true);
                // Reset the team task search options to load them again
                setTeamTaskSearchOptions([]);
            }}
        />
    );
};
