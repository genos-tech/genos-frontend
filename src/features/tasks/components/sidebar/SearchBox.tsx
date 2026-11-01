import { useEffect, useMemo, useState } from "react";
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

import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { SearchTeamTasksResponse } from "../../../../types/tasks";
import { lookupTaskByDisplayId } from "../../services/lookupTaskByDisplayId";
import { displayIdEquals, displayIdMatches, fullDisplayIdIn } from "../../utils/taskDisplayId";
import { taskMetaLabel } from "../../utils/taskMeta";
import { TaskIdentityRow } from "../TaskIdentityRow";

type TaskSidebarSearchBoxProps = {
    openSearch: boolean;
    setOpenSearch: (value: boolean) => void;
    teamTaskSearchOptions: SearchTeamTasksResponse[];
    setTeamTaskSearchOptions: (value: SearchTeamTasksResponse[]) => void;
    loading: boolean;
    useTM: TaskManagementState;
    // For finding a closed task by its exact id (the options hold open work).
    myself?: Pick<UserProps, "teamId">;
    accessToken?: string | null;
};

// A task matches by title or by display id ("MIP-739", "mip739", "739").
export const filterTaskSearchOptions = (
    options: SearchTeamTasksResponse[],
    input: string
): SearchTeamTasksResponse[] => {
    const q = input.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
        (o) => (o.title ?? "").toLowerCase().includes(q) || displayIdMatches(q, o.displayId)
    );
};

// Put a looked-up task beside its project's other tasks: the list is
// grouped by project, and a group split in two shows its header twice.
const withLookedUpTask = (
    options: SearchTeamTasksResponse[],
    row: SearchTeamTasksResponse | null
): SearchTeamTasksResponse[] => {
    if (!row || options.some((o) => o.taskId === row.taskId)) return options;
    const at = options.findIndex((o) => o.projectId === row.projectId);
    return at === -1 ? [...options, row] : [...options.slice(0, at), row, ...options.slice(at)];
};

// How long typing must pause before an exact id is looked up.
const LOOKUP_DELAY_MS = 250;

export const TaskSidebarSearchBox = (props: TaskSidebarSearchBoxProps) => {
    const {
        openSearch,
        setOpenSearch,
        teamTaskSearchOptions,
        setTeamTaskSearchOptions,
        loading,
        useTM,
        myself,
        accessToken,
    } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();
    const [inputValue, setInputValue] = useState("");
    const [lookedUp, setLookedUp] = useState<SearchTeamTasksResponse | null>(null);

    // A whole id that matches no listed task may be a closed one.
    useEffect(() => {
        const id = fullDisplayIdIn(inputValue);
        if (
            !id ||
            !myself ||
            teamTaskSearchOptions.some((o) => displayIdEquals(id, o.displayId))
        ) {
            setLookedUp(null);
            return;
        }
        let live = true;
        const timer = setTimeout(() => {
            void lookupTaskByDisplayId(myself, id, accessToken ?? null).then((row) => {
                if (live) setLookedUp(row);
            });
        }, LOOKUP_DELAY_MS);
        return () => {
            live = false;
            clearTimeout(timer);
        };
    }, [inputValue, teamTaskSearchOptions, myself, accessToken]);

    const options = useMemo(
        () => withLookedUpTask(teamTaskSearchOptions, lookedUp),
        [teamTaskSearchOptions, lookedUp]
    );

    function onChangeHandler(value: any) {
        if (value !== null) {
            setOpenSearch(false);
            useTM.setCurrentPreviewTaskId(value.taskId);
            useTM.setIsTaskPreviewVisible(true);
        }
    }

    return (
        <Autocomplete
            key={`ac-project-tags-${useTM.currentPreviewTaskId}`}
            aria-label={t.tasks.sidebar.searchAriaLabel}
            filterOptions={(opts, state) => filterTaskSearchOptions(opts, state.inputValue)}
            getOptionLabel={(option) => option.title}
            groupBy={(option) => option.projectName}
            isOptionEqualToValue={(option, value) => option.taskId === value.taskId}
            loading={loading}
            open={openSearch}
            options={options}
            placeholder={t.tasks.sidebar.searchPlaceholder}
            size="sm"
            endDecorator={
                loading ? (
                    <CircularProgress
                        size="sm"
                        sx={{
                            "--CircularProgress-size": "16px",
                            "--CircularProgress-trackThickness": "2px",
                            "--CircularProgress-progressThickness": "2px",
                        }}
                    />
                ) : null
            }
            renderOption={(props, option) => (
                <AutocompleteOption {...props} key={`ac-taskhome-search-task-${option.taskId}`}>
                    <ListItemContent sx={{ fontSize: "sm" }}>
                        <TaskIdentityRow
                            isMilestone={option.isMilestone}
                            status={option.status}
                            task={option}
                            title={option.title}
                        />
                    </ListItemContent>
                </AutocompleteOption>
            )}
            renderTags={(tags, getTagProps) =>
                tags.map((item, index) => {
                    const { key, ...tagProps } = getTagProps({ index });
                    return (
                        <Chip
                            key={`ac-taskhome-search-task-chip-${key}`}
                            size="sm"
                            variant="soft"
                            sx={{
                                fontSize: "0.65rem",
                                fontWeight: 600,
                                height: 20,
                                minHeight: 20,
                                borderRadius: "6px",
                                backgroundColor: alpha(
                                    item.status.color || "#0044c2",
                                    isDark ? 0.35 : 0.6
                                ),
                                color: isDark
                                    ? item.status.color || "var(--gp-brandalt-400)"
                                    : item.status.textColor || item.status.color,
                                border: "1px solid",
                                borderColor: alpha(
                                    item.status.color || "#0044c2",
                                    isDark ? 0.4 : 0.25
                                ),
                            }}
                        >
                            {taskMetaLabel(item.status.status, t.tasks.filters)}
                        </Chip>
                    );
                })
            }
            slotProps={{
                listbox: {
                    sx: {
                        zIndex: 10020,
                        borderRadius: "12px",
                        boxShadow: isDark
                            ? "0 8px 32px rgba(0,0,0,0.5)"
                            : "0 8px 32px rgba(0,0,0,0.12)",
                        border: "1px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                        "& .MuiAutocomplete-option": {
                            borderRadius: "8px",
                            mx: 0.5,
                            my: 0.25,
                        },
                    },
                },
            }}
            startDecorator={
                <SearchRoundedIcon
                    sx={{
                        fontSize: 18,
                        color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)",
                    }}
                />
            }
            sx={{
                width: "100%",
                "--Input-focusedThickness": "0px",
                borderRadius: "12px",
                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                border: "1px solid",
                borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                transition: "all 0.2s ease",
                "&:hover": {
                    background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                    borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                },
                "&.Mui-focused": {
                    background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.9)",
                    borderColor: isDark
                        ? "rgba(var(--gp-brandalt-500-rgb), 0.4)"
                        : "rgba(var(--gp-brand-700-rgb), 0.3)",
                    boxShadow: isDark
                        ? "0 0 0 3px rgba(var(--gp-brandalt-500-rgb), 0.15)"
                        : "0 0 0 3px rgba(var(--gp-brand-700-rgb), 0.1)",
                },
                "& .MuiAutocomplete-input": {
                    fontSize: "0.85rem",
                    "&::placeholder": {
                        color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
                        opacity: 1,
                    },
                },
            }}
            onChange={(event, value) => onChangeHandler(value)}
            onInputChange={(_event, value) => setInputValue(value)}
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
