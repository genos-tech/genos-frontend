import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
    Autocomplete,
    AutocompleteOption,
    Box,
    Chip,
    CircularProgress,
    ListItemContent,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { SearchTeamTasksResponse } from "../../../../types/tasks";
import { CopyableTaskIdChip } from "../CopyableTaskId";

type TaskSidebarSearchBoxProps = {
    openSearch: boolean;
    setOpenSearch: (value: boolean) => void;
    teamTaskSearchOptions: SearchTeamTasksResponse[];
    setTeamTaskSearchOptions: (value: SearchTeamTasksResponse[]) => void;
    loading: boolean;
    useTM: TaskManagementState;
};

export const TaskSidebarSearchBox = (props: TaskSidebarSearchBoxProps) => {
    const {
        openSearch,
        setOpenSearch,
        teamTaskSearchOptions,
        setTeamTaskSearchOptions,
        loading,
        useTM,
    } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();

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
            getOptionLabel={(option) => option.title}
            groupBy={(option) => option.projectName}
            isOptionEqualToValue={(option, value) => option.taskId === value.taskId}
            loading={loading}
            open={openSearch}
            options={teamTaskSearchOptions}
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
                        <Stack alignItems="center" direction="row" spacing={1}>
                            {/* Milestone rows get the flag glyph on the far
                                left — same orange as the header's "New
                                Milestone" menu item. */}
                            {option.isMilestone === true && (
                                <FlagRoundedIcon
                                    sx={{ color: "#f97316", flexShrink: 0, fontSize: 16 }}
                                />
                            )}
                            <CopyableTaskIdChip
                                key={`ac-taskhome-search-task-id-chip-${option.taskId}`}
                                size="sm"
                                task={option}
                                variant="soft"
                                sx={{
                                    fontSize: "0.65rem",
                                    fontWeight: 600,
                                    height: 20,
                                    minHeight: 20,
                                    borderRadius: "6px",
                                    background: isDark
                                        ? "rgba(255,255,255,0.08)"
                                        : "rgba(0,0,0,0.06)",
                                    color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
                                }}
                            />
                            <Chip
                                key={`ac-taskhome-search-task-chip-${option.taskId}`}
                                size="sm"
                                variant="soft"
                                sx={{
                                    fontSize: "0.65rem",
                                    fontWeight: 600,
                                    height: 20,
                                    minHeight: 20,
                                    borderRadius: "6px",
                                    backgroundColor: alpha(
                                        option.status.color || "#0044c2",
                                        isDark ? 0.35 : 0.6
                                    ),
                                    color: option.status.textColor || "#ffffff",
                                    border: "1px solid",
                                    borderColor: alpha(
                                        option.status.color || "#0044c2",
                                        isDark ? 0.4 : 0.25
                                    ),
                                }}
                            >
                                {option.status.status}
                            </Chip>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        fontWeight: 500,
                                        color: isDark
                                            ? "rgba(255,255,255,0.9)"
                                            : "rgba(0,0,0,0.85)",
                                    }}
                                    noWrap
                                >
                                    {option.title}
                                </Typography>
                            </Box>
                        </Stack>
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
                            {item.status.status}
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
