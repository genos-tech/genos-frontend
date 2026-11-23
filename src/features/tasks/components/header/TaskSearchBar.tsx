import { memo, useCallback, type UIEvent } from "react";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Autocomplete, AutocompleteOption, Box, ListSubheader } from "@mui/joy";

import { Spinner } from "../../../../components/ui/feedback/Skeleton";
import { searchSurfaceSx } from "../../../../components/ui/fields/searchFieldStyles";
import { useTranslation } from "../../../../i18n";
import { g, type } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { useTaskSearchBar, type TaskSearchOption } from "../../hooks/useTaskSearchBar";
import { AssigneeAvatar, MilestoneFlag, TaskIdText } from "../card";
import { StatusLabel } from "../meta/StatusLabel";
import { highlightParts } from "./highlightParts";

type TaskSearchBarProps = {
    myself: Pick<UserProps, "teamId"> | undefined;
    accessToken?: string | null;
    /** The project in view: its open tasks fill the starting list. */
    projectId: number | undefined;
    /** What the task manager needs to open a task in the preview. */
    openTask: (taskId: number) => void;
};

/** Load the next page when the highlighted row is this close to the end of the list. */
const NEAR_END = 3;

const Marked = ({ text, query }: { text: string; query: string }) => (
    <>
        {highlightParts(text, query).map((part, i) =>
            part.match ? (
                <Box
                    key={i}
                    component="mark"
                    sx={{
                        background: g.accent.subtle,
                        color: g.accent.text,
                        borderRadius: g.radius.xs,
                        fontWeight: 600,
                    }}
                >
                    {part.text}
                </Box>
            ) : (
                <span key={i}>{part.text}</span>
            )
        )}
    </>
);

/** Who the task is assigned to, or nothing when it is unassigned (no "?" placeholder). */
export const SearchRowAssignee = ({
    assigneeId,
    assigneeName,
}: {
    assigneeId?: string | null;
    assigneeName?: string | null;
}) =>
    assigneeId ? (
        <Box
            component="span"
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                minWidth: 0,
                marginInlineStart: "auto",
            }}
        >
            <AssigneeAvatar name={assigneeName} size="xs" userId={assigneeId} />
            {assigneeName && (
                <Box
                    component="span"
                    sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 120,
                    }}
                >
                    {assigneeName}
                </Box>
            )}
        </Box>
    ) : null;

/**
 * The one task search (MIP-1990), in the table/board header. Focus shows a short starting
 * list (recently opened tasks, then the open tasks of the project in view) without loading
 * any list; typing asks the server (debounced, cancellable, paged) across every task the
 * person can reach, Closed ones included, by title or display id.
 */
export const TaskSearchBar = memo(function TaskSearchBar({
    myself,
    accessToken,
    projectId,
    openTask,
}: TaskSearchBarProps) {
    const { t } = useTranslation();
    const s = t.tasks.sidebar;
    const bar = useTaskSearchBar({ myself, accessToken, projectId });
    const { options, loadMore, setQuery, setActive } = bar;

    const groupLabel = (option: TaskSearchOption) =>
        option.section === "recent"
            ? s.searchRecent
            : option.section === "project"
              ? s.searchInProject
              : "";

    const onListScroll = useCallback(
        (event: UIEvent<HTMLElement>) => {
            const el = event.currentTarget;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 96) loadMore();
        },
        [loadMore]
    );

    const noOptionsText = bar.error
        ? s.searchError
        : bar.isSearching
          ? s.searchEmpty.replace("{query}", bar.query.trim())
          : s.searchEmptyStart;

    return (
        <Autocomplete<TaskSearchOption>
            aria-label={s.searchAriaLabel}
            autoHighlight={bar.current}
            endDecorator={bar.loading || bar.loadingMore ? <Spinner /> : null}
            filterOptions={(opts) => opts}
            getOptionLabel={(o) => `${o.displayId ?? ""} ${o.title}`.trim()}
            groupBy={groupLabel}
            inputValue={bar.query}
            isOptionEqualToValue={(a, b) => a.taskId === b.taskId}
            loading={bar.loading && options.length === 0}
            loadingText={s.searchLoading}
            noOptionsText={noOptionsText}
            options={options}
            placeholder={s.searchPlaceholder}
            size="sm"
            startDecorator={<SearchRoundedIcon sx={{ fontSize: 18 }} />}
            sx={{ ...searchSurfaceSx, width: "100%" }}
            value={null}
            renderGroup={(params) => (
                <li key={params.key} role="presentation">
                    {params.group && (
                        <ListSubheader sx={{ ...type("caption"), color: g.text.tertiary }} sticky>
                            {params.group}
                        </ListSubheader>
                    )}
                    <ul
                        aria-label={params.group || undefined}
                        role={params.group ? "group" : "presentation"}
                        style={{ padding: 0, margin: 0 }}
                    >
                        {params.children}
                    </ul>
                </li>
            )}
            renderOption={(props, option) => (
                <AutocompleteOption {...props} key={`task-search-${option.taskId}`}>
                    <Box
                        sx={{
                            minWidth: 0,
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            gap: 0.25,
                        }}
                    >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                            {option.isMilestone === true && <MilestoneFlag size={16} />}
                            <TaskIdText copyable={false} task={option} />
                            <Box
                                component="span"
                                sx={{
                                    ...type("body-sm"),
                                    color: g.text.primary,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    minWidth: 0,
                                }}
                            >
                                <Marked query={bar.highlight} text={option.title} />
                            </Box>
                        </Box>
                        <Box
                            sx={{
                                ...type("body-xs"),
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                minWidth: 0,
                                color: g.text.tertiary,
                            }}
                        >
                            <Box
                                component="span"
                                sx={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    minWidth: 0,
                                }}
                            >
                                {option.projectName}
                            </Box>
                            <StatusLabel status={option.status?.status} />
                            <SearchRowAssignee
                                assigneeId={option.assigneeId}
                                assigneeName={option.assigneeName}
                            />
                        </Box>
                    </Box>
                </AutocompleteOption>
            )}
            slotProps={{
                listbox: {
                    onScroll: onListScroll,
                    sx: {
                        zIndex: 10020,
                        maxHeight: "min(60vh, 440px)",
                        borderRadius: g.radius.lg,
                        boxShadow: g.shadow.lg,
                        border: `1px solid ${g.border.default}`,
                        "& .MuiAutocomplete-option": {
                            borderRadius: g.radius.md,
                            mx: 0.5,
                            my: 0.25,
                        },
                    },
                },
                input: { enterKeyHint: "search" },
            }}
            blurOnSelect
            clearOnEscape
            openOnFocus
            onClose={() => setActive(false)}
            onOpen={() => setActive(true)}
            onChange={(_event, value) => {
                if (!value || !bar.current) return;
                setQuery("");
                openTask(value.taskId);
            }}
            onHighlightChange={(_event, option) => {
                if (!option) return;
                if (options.length - options.indexOf(option) <= NEAR_END) loadMore();
            }}
            onInputChange={(_event, value, reason) => {
                // "reset" is the box echoing a picked option into the field: keep it empty.
                if (reason !== "reset") setQuery(value);
            }}
        />
    );
});
