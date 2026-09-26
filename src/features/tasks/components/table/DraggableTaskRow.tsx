import { memo, useEffect, useRef, useState } from "react";
import { Draggable } from "@hello-pangea/dnd";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SubdirectoryArrowRightRoundedIcon from "@mui/icons-material/SubdirectoryArrowRightRounded";
import { Avatar, Box, Typography } from "@mui/joy";
import {
    Autocomplete,
    Chip,
    IconButton,
    MenuItem,
    Paper,
    Select,
    SelectChangeEvent,
    TextField,
} from "@mui/material";
import { alpha } from "@mui/system";
import dayjs from "dayjs";
import { Socket } from "socket.io-client";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { ResolvedUserName } from "../../../../components/ui/avatars/AvatarContext";
import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { PulseDot } from "../../../../components/ui/misc/PulseDot";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import {
    CustomFieldOption,
    ProjectCustomFieldDef,
    TagListProps,
    TaskTableProps,
} from "../../../../types/tasks";
import { stripOwnerState } from "../../../../utils/joyAutocomplete";
import { PrStatusCell } from "../../../integrations/components/PrStatusCell";
import {
    parseCustomFieldColKey,
    resolveTagOptions,
    setCustomFieldValue,
} from "../../utils/customFields";
import { deriveDaysLeft } from "../../utils/daysLeft";
import { TASK_ROW_CLASS } from "../../utils/familyFocusCss";
import { formatTaskDisplayId } from "../../utils/taskDisplayId";
import { effortLevels, priorities, taskMetaLabel } from "../../utils/taskMeta";
import { computeTaskWeight, MAX_TASK_WEIGHT, weightBand } from "../../utils/taskWeight";
import { ProjectTagChip } from "../ProjectTagChip";
import { ColumnDef, LEADING_GUTTER_WIDTH, statusOptions } from "./DraggableTaskTable";

// Depth-based background colors for nested task rows. Exported (along
// with DEPTH_BORDER_COLORS / getTableCellStyles below) so the
// QuickAddTaskRow draft row can render the exact same depth/cell chrome
// as real rows.
export const DEPTH_COLORS_DARK = [
    "transparent",
    "rgba(56, 189, 248, 0.08)",
    "rgba(45, 212, 191, 0.09)",
    "rgba(251, 191, 36, 0.08)",
];
export const DEPTH_COLORS_LIGHT = [
    "transparent",
    "rgba(14, 165, 233, 0.07)",
    "rgba(20, 184, 166, 0.07)",
    "rgba(245, 158, 11, 0.07)",
];
const DEPTH_HOVER_DARK = [
    "rgba(255, 255, 255, 0.04)",
    "rgba(56, 189, 248, 0.16)",
    "rgba(45, 212, 191, 0.17)",
    "rgba(251, 191, 36, 0.15)",
];
const DEPTH_HOVER_LIGHT = [
    "rgba(0, 0, 0, 0.02)",
    "rgba(14, 165, 233, 0.12)",
    "rgba(20, 184, 166, 0.12)",
    "rgba(245, 158, 11, 0.11)",
];
export const DEPTH_BORDER_COLORS = ["transparent", "#38bdf8", "#2dd4bf", "#fbbf24"];

// Style helpers
// NOTE: Do NOT apply transform here - react-beautiful-dnd manages transforms for positioning
//
// Hover handling intentionally lives in CSS (via the row's `sx`) rather
// than React state. Driving it through a `useState(isHovered)` used to
// re-render the entire row on every mouse-enter / mouse-leave, which
// in turn re-evaluated every cell's JSX (assignee `<UserAvatar>` being
// the most expensive). Pure-CSS `:hover` is free for the React tree,
// so we keep these helpers limited to *static* styles that depend only
// on dragging/selection/depth/mode.
const getTableRowStyles = (
    isDragging: boolean,
    isSelected: boolean,
    mode: "light" | "dark" | undefined,
    rowDepth: number
): React.CSSProperties => {
    const depthIdx = Math.min(rowDepth, 3);

    const getBackgroundColor = () => {
        if (isDragging) {
            return mode === "dark" ? "var(--gp-brandalt-950)" : "var(--gp-brand-100)";
        }
        if (isSelected) {
            return mode === "dark"
                ? "rgba(var(--gp-brand-700-rgb), 0.15)"
                : "rgba(var(--gp-brand-700-rgb), 0.08)";
        }
        return mode === "dark" ? DEPTH_COLORS_DARK[depthIdx] : DEPTH_COLORS_LIGHT[depthIdx];
    };

    return {
        display: "flex",
        alignItems: "center",
        minHeight: 36,
        borderBottom: isDragging
            ? "none"
            : mode === "dark"
              ? "1px solid rgba(255, 255, 255, 0.08)"
              : "1px solid rgba(0, 0, 0, 0.08)",
        backgroundColor: getBackgroundColor(),
        borderLeft: isSelected
            ? mode === "dark"
                ? "3px solid var(--gp-brandalt-400)"
                : "3px solid var(--gp-brand-700)"
            : rowDepth > 0
              ? `3px solid ${DEPTH_BORDER_COLORS[depthIdx]}`
              : "3px solid transparent",
        boxShadow: isDragging
            ? mode === "dark"
                ? "0 8px 24px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3)"
                : "0 8px 24px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1)"
            : isSelected
              ? mode === "dark"
                  ? "inset 0 0 0 1px rgba(var(--gp-brandalt-400-rgb), 0.2)"
                  : "inset 0 0 0 1px rgba(var(--gp-brand-700-rgb), 0.1)"
              : "none",
        borderRadius: isDragging ? 6 : 0,
        // Don't use transitions when dragging - it interferes with drag positioning
        //
        // `opacity` / `filter` are here for the hover family-focus dimming
        // (familyFocusCss.ts). They must be in THIS list, not the `sx` below:
        // an inline `transition` shorthand beats the emotion class, so a
        // transition declared only in `sx` never applies to this element.
        transition: isDragging
            ? "none"
            : "background-color 0.15s ease, box-shadow 0.15s ease, border-left 0.15s ease," +
              " opacity 0.15s ease, filter 0.15s ease",
    };
};

export const getTableCellStyles = (
    width: number,
    align: string | undefined,
    mode: "light" | "dark" | undefined
): React.CSSProperties => ({
    minWidth: width,
    width: width,
    padding: "6px 8px",
    display: "flex",
    alignItems: "center",
    justifyContent: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
    color: mode === "dark" ? "#e0e0e0" : "#333333",
    fontSize: "0.8rem",
});

const getDragHandleStyles = (
    isDragging: boolean,
    mode: "light" | "dark" | undefined
): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    minWidth: 28,
    height: 32,
    cursor: isDragging ? "grabbing" : "grab",
    // Base opacity. The row's `:hover` rule (see the wrapper Box's `sx`)
    // bumps this to 0.8 via `&:hover .task-row-drag-handle` so the handle
    // fades in on hover *without* re-rendering the row.
    opacity: isDragging ? 1 : 0.3,
    color: isDragging
        ? mode === "dark"
            ? "var(--gp-brandalt-400)"
            : "var(--gp-brand-700)"
        : mode === "dark"
          ? "#888"
          : "#666",
    transition: "opacity 0.2s ease, color 0.2s ease, transform 0.15s ease",
    transform: isDragging ? "scale(1.1)" : "scale(1)",
    borderRadius: 4,
    backgroundColor: isDragging
        ? mode === "dark"
            ? "rgba(var(--gp-brandalt-400-rgb), 0.15)"
            : "rgba(var(--gp-brand-700-rgb), 0.1)"
        : "transparent",
});

export type DraggableTaskRowProps = {
    task: TaskTableProps;
    index: number;
    columns: ColumnDef[];
    mode: "light" | "dark" | undefined;
    myself: UserProps;
    teamMembers: UserProps[];
    /** The focused project's tags — options for the inline tags-cell editor. */
    projectTags: TagListProps[];
    /** The project's custom field definitions, for `cf_<id>` columns.
     *  Identity-stable per project (module store) — compared by
     *  reference in `areEqual` like `projectTags`. */
    customFieldDefs: ProjectCustomFieldDef[];
    onRowUpdate: (task: TaskTableProps) => Promise<TaskTableProps>;
    // Parent-owned debounced preview switch. Replaces the older
    // `onRowDoubleClick(taskId)` callback — the parent now coalesces
    // rapid clicks so the heavy TaskPreview fetch cascade only fires
    // for the last row the user lands on.
    onRequestPreview: (task: TaskTableProps) => void;
    // Whether this row is the currently selected/previewed one. Resolved
    // by the parent (see `resolveIsSelected` in DraggableTaskTable) from
    // the pending-click IDs and the real useTM.currentPreview* state.
    //
    // This is deliberately a per-row BOOLEAN rather than the global IDs
    // it derives from: a selection change alters the booleans of only the
    // two affected rows, so `areEqual` lets every other row bail out.
    // Comparing the global IDs here instead made every preview switch
    // re-render all N rows — the table's share of the task-switch jank.
    // Mirrors the pattern SprintBoardCard already uses.
    isSelected: boolean;
    // A "ghost" row: a non-matching ancestor the Member filter splices in so a
    // matching subtask's dependency chain stays visible. Rendered dimmed and
    // fully non-interactive (no preview open, no inline edit, no drag) — it's
    // context, not a row the user acts on. Defaults to false everywhere else.
    isGhost?: boolean;
    // Which root-task/milestone family this row belongs to: the id of the
    // root its parent chain ends at (its own id when it IS a root). Rendered
    // as a `data-task-family` attribute and read by the generated hover
    // stylesheet in `familyFocusCss.ts` — hovering any row dims every row
    // outside that family.
    //
    // It is only an attribute, never read at render time, which is the whole
    // point: the cross-row highlight resolves in the browser's selector
    // engine, so mouse movement costs React nothing. Driving it from a
    // hovered-id state in the table would re-render the entire row map on
    // every mouse-enter — the exact cost the hover-in-CSS note above
    // `getTableRowStyles` exists to avoid.
    familyKey?: string;
    useTM: TaskManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    socket: Socket | null;
    setMyself: (value: UserProps) => void;
    expandedRows: Set<string>;
    toggleExpand: (id: string) => void;
    // Whether this row has at least one child in the filtered tree. Passed
    // as a boolean rather than the shared `childrenByParent` Map for the
    // same reason as `isSelected`: the Map is rebuilt whenever `allTasks`
    // identity changes (which happens on every task open), so comparing it
    // by reference in `areEqual` defeated the memo for every row.
    hasChildren: boolean;
    depth: number;
    // sprintId → sprint name lookup for the "Sprint" column. The column
    // is conditionally surfaced by DraggableTaskTable when a milestone
    // is in view; the row falls back to "Sprint #<id>" if a row carries
    // a sprintId we haven't loaded yet.
    sprintNamesById?: Map<number, string>;
    // Opens the inline quick-add child row beneath this row (the hover
    // "+" button in the leading gutter). Excluded from `areEqual` like
    // the other callbacks, so the parent MUST pass an identity-stable
    // function (`useCallback` with `[]` + functional setState) — a
    // closure over changing state would go stale here.
    onQuickAddChild: (task: TaskTableProps) => void;
    // Opens the shared task-graph modal anchored on this row (the hover
    // tree icon in the leading gutter, root tasks / milestones only —
    // sub-task rows never show it). Same identity-stability contract as
    // `onQuickAddChild`: excluded from `areEqual`, so the parent must
    // pass a `useCallback([])`-stable function.
    onOpenDiagram: (task: TaskTableProps) => void;
};

const DraggableTaskRowImpl = (props: DraggableTaskRowProps) => {
    const {
        task,
        index,
        columns,
        mode,
        myself,
        teamMembers,
        onRowUpdate,
        onRequestPreview,
        isSelected,
        isGhost = false,
        familyKey,
        projectTags,
        customFieldDefs,
        useTM,
        useTEM,
        useCM,
        useUISM,
        socket,
        setMyself,
        expandedRows,
        toggleExpand,
        hasChildren,
        depth,
        sprintNamesById,
        onQuickAddChild,
        onOpenDiagram,
    } = props;

    const { t } = useTranslation();
    const { accessToken } = useAuth();
    const isChild = depth > 0;
    const taskIdStr = String(task.id);
    const isExpanded = expandedRows.has(taskIdStr);

    // Row DOM ref so we can pull the selected row into view when the
    // preview pane swings open from somewhere other than the row's
    // own click (sidebar / deep-link / keyboard nav). `scrollIntoView`
    // with `block: "nearest"` is a no-op when the row is already in
    // the viewport, so we don't churn scroll position on the click
    // path that's already centered.
    const rowRef = useRef<HTMLDivElement | null>(null);

    // Whether this row is the currently selected/previewed task is
    // resolved by the parent and arrives as the `isSelected` prop — see
    // `resolveIsSelected` in DraggableTaskTable for the milestone /
    // pending-click precedence rules.
    const isMilestoneRow = task.isMilestone === true;

    // When this row becomes the selected/previewed one, nudge it into
    // view if the user can't already see it. Scoped to the false→true
    // transition (depending on `isSelected` only) so re-renders that
    // keep the same selection don't trigger gratuitous scrolls. The
    // `requestAnimationFrame` defers to the next paint so layout
    // changes that often pair with selection (parent auto-expand,
    // virtualised re-mounts) settle before we measure offsets.
    useEffect(() => {
        if (!isSelected) return;
        const node = rowRef.current;
        if (!node) return;
        const id = window.requestAnimationFrame(() => {
            node.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
        return () => window.cancelAnimationFrame(id);
    }, [isSelected]);

    // Open-preview path routes through the parent's debounced
    // `onRequestPreview` so rapid clicks collapse into a single
    // TaskPreview fetch cascade instead of fanning out one per click.
    const openPreview = () => {
        // Ghost rows are inert context — never open a preview from them.
        // (Belt-and-suspenders: the row also carries `pointer-events: none`.)
        if (isGhost) return;
        onRequestPreview(task);
    };

    // Edit states for different fields
    const [editingField, setEditingField] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>("");
    // Tags is multi-value, so it needs its own array edit buffer (the shared
    // `editValue` above is single-string). Committed once, on blur.
    const [editTags, setEditTags] = useState<TagListProps[]>([]);
    // Set on Escape so the blur that follows the editor unmounting doesn't
    // commit the (discarded) selection.
    const revertTagsRef = useRef(false);

    const handleStartEdit = (field: string, value: string) => {
        setEditingField(field);
        setEditValue(value);
    };

    const handleCancelEdit = () => {
        setEditingField(null);
        setEditValue("");
    };

    const handleSaveEdit = async (field: string) => {
        if (editingField) {
            const updatedTask = { ...task, [field]: editValue };
            await onRowUpdate(updatedTask);
            setEditingField(null);
            setEditValue("");
        }
    };

    const handleSelectChange = async (field: string, value: string) => {
        const updatedTask = { ...task, [field]: value };
        await onRowUpdate(updatedTask);
    };

    const handleStartEditTags = () => {
        setEditingField("tags");
        setEditTags(task.tags ?? []);
    };

    // Custom tag-type fields get their own multi-value buffer (options
    // are CustomFieldOption, not TagListProps) — committed on blur like
    // the tags cell; Escape reverts via the shared revertTagsRef.
    const [editCustomOptions, setEditCustomOptions] = useState<CustomFieldOption[]>([]);

    // Commit one custom field's value and persist through the shared
    // row-update pipeline (same PUT path as every other inline edit).
    const commitCustomField = async (fieldId: number, value: string | string[] | null) => {
        setEditingField(null);
        setEditValue("");
        await onRowUpdate({
            ...task,
            customFieldValues: setCustomFieldValue(task.customFieldValues, fieldId, value),
        });
    };

    // Commit the accumulated tag selection once (on blur / Enter), not on
    // every toggle. Recompute `concatTags` locally so the tag filter reacts
    // immediately; `updateTaskFromTable` persists the same set via the task PUT.
    const handleSaveTags = async () => {
        const nextConcat =
            editTags.length > 0 ? "/" + editTags.map((tg) => tg.tagName).join("/") + "/" : null;
        setEditingField(null);
        await onRowUpdate({ ...task, tags: editTags, concatTags: nextConcat });
    };

    // Shared "click to edit" read-view shell for custom-field cells —
    // same hover treatment as the tags/assignee cells.
    const customReadCellSx = {
        display: "flex",
        gap: 0.5,
        flexWrap: "wrap" as const,
        alignItems: "center",
        width: "100%",
        minHeight: 24,
        cursor: "pointer",
        borderRadius: "6px",
        px: 0.5,
        transition: "background-color 0.15s ease",
        "&:hover": {
            backgroundColor: mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
        },
    };

    const emptyCellPlaceholder = (
        <Typography sx={{ fontSize: "0.72rem", color: mode === "dark" ? "#6b7280" : "#9ca3af" }}>
            -
        </Typography>
    );

    // Dropdown option row for tag-type fields (built-in Tags + custom
    // tag). Renders the option as its colored ProjectTagChip so options
    // read the same as the selected chips; `aria-selected` (set by MUI on
    // already-picked options in the multi-select) gets the accent bg.
    const tagOptionRowSx = {
        py: 0.5,
        px: 1,
        mx: 0.5,
        my: 0.25,
        borderRadius: "6px",
        display: "flex",
        alignItems: "center",
        cursor: "pointer",
        "&:hover": {
            backgroundColor: mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
        },
        '&[aria-selected="true"]': {
            backgroundColor:
                mode === "dark"
                    ? "rgba(var(--gp-brandalt-400-rgb), 0.15)"
                    : "rgba(var(--gp-brand-700-rgb), 0.08)",
        },
    } as const;

    // One cell of a `cf_<id>` column. Editing mirrors the built-in
    // cells per type: text ≈ title (buffered, commit on blur/Enter),
    // date ≈ dueDate (commit on change), tag ≈ tags (multi buffer,
    // commit on blur), member ≈ assignee (commit on select). All
    // persistence funnels through `commitCustomField` → onRowUpdate.
    const renderCustomFieldCell = (def: ProjectCustomFieldDef) => {
        const editKey = `cf_${def.fieldId}`;
        const stored = task.customFieldValues?.[String(def.fieldId)];
        const storedString = typeof stored === "string" ? stored : "";
        const accent = mode === "dark" ? "var(--gp-brandalt-400)" : "var(--gp-brand-700)";

        if (def.fieldType === "tag") {
            const selected = resolveTagOptions(def, stored);
            if (editingField === editKey) {
                return (
                    <Box
                        sx={{ width: "100%" }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <Autocomplete
                            autoHighlight
                            disableCloseOnSelect
                            multiple
                            openOnFocus
                            getOptionLabel={(option: CustomFieldOption) => option.label}
                            isOptionEqualToValue={(option, val) => option.id === val?.id}
                            options={def.options}
                            size="small"
                            sx={{ width: "100%", minWidth: 160 }}
                            value={editCustomOptions}
                            onChange={(_, newValue) => setEditCustomOptions(newValue)}
                            onBlur={() => {
                                if (revertTagsRef.current) {
                                    revertTagsRef.current = false;
                                    return;
                                }
                                void commitCustomField(
                                    def.fieldId,
                                    editCustomOptions.map((o) => o.id)
                                );
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                    e.stopPropagation();
                                    revertTagsRef.current = true;
                                    handleCancelEdit();
                                }
                            }}
                            renderTags={(tagValue, getTagProps) =>
                                tagValue.map((option, idx) => {
                                    const { key, ...chipProps } = getTagProps({ index: idx });
                                    return (
                                        <Chip
                                            key={key}
                                            {...chipProps}
                                            label={option.label}
                                            size="small"
                                            sx={{
                                                height: 20,
                                                fontSize: "0.7rem",
                                                fontWeight: 600,
                                                color: mode === "dark" ? "white" : "black",
                                                borderColor: alpha(option.color, 0.6),
                                                backgroundColor: alpha(option.color, 0.12),
                                            }}
                                        />
                                    );
                                })
                            }
                            PaperComponent={({ children, ...paperProps }) => (
                                <Paper
                                    {...paperProps}
                                    sx={{
                                        backgroundColor: mode === "dark" ? "#1a1a2e" : "#ffffff",
                                        borderRadius: "10px",
                                        border:
                                            mode === "dark"
                                                ? "1px solid rgba(255, 255, 255, 0.1)"
                                                : "1px solid rgba(0, 0, 0, 0.08)",
                                        boxShadow:
                                            mode === "dark"
                                                ? "0 8px 32px rgba(0, 0, 0, 0.5)"
                                                : "0 8px 32px rgba(0, 0, 0, 0.12)",
                                        mt: 0.5,
                                    }}
                                >
                                    {children}
                                </Paper>
                            )}
                            renderOption={(optionProps, option) => {
                                const { key, ...restProps } = stripOwnerState(optionProps);
                                return (
                                    <Box
                                        key={key}
                                        component="li"
                                        {...restProps}
                                        sx={tagOptionRowSx}
                                    >
                                        <ProjectTagChip
                                            isDark={mode === "dark"}
                                            label={option.label}
                                            tagColor={option.color}
                                        />
                                    </Box>
                                );
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    autoFocus
                                    placeholder={selected.length === 0 ? "Select…" : ""}
                                    sx={{
                                        "& .MuiOutlinedInput-root": {
                                            borderRadius: "6px",
                                            fontSize: "0.8rem",
                                            padding: "2px 6px",
                                            "&:hover fieldset": { borderColor: accent },
                                            "&.Mui-focused fieldset": {
                                                borderColor: accent,
                                                borderWidth: "1.5px",
                                            },
                                        },
                                    }}
                                />
                            )}
                        />
                    </Box>
                );
            }
            return (
                <Box
                    sx={customReadCellSx}
                    onClick={(e) => {
                        e.stopPropagation();
                        setEditCustomOptions(selected);
                        setEditingField(editKey);
                    }}
                >
                    {selected.length === 0
                        ? emptyCellPlaceholder
                        : selected.map((option) => (
                              <ProjectTagChip
                                  key={option.id}
                                  isDark={mode === "dark"}
                                  label={option.label}
                                  tagColor={option.color}
                              />
                          ))}
                </Box>
            );
        }

        if (def.fieldType === "member") {
            // Mirrors the built-in Assignee cell exactly — same dropdown
            // Paper, listbox scrollbar, accent-focus input, and rich
            // option rows (avatar + name + email + hover + selected).
            if (editingField === editKey) {
                const current = teamMembers.find((m) => String(m.userId) === storedString);
                return (
                    <Autocomplete
                        blurOnSelect={true}
                        clearOnBlur={false}
                        getOptionLabel={(option) => `${option.userName} ${option.userEmail}`}
                        open={true}
                        options={teamMembers}
                        size="small"
                        value={current || null}
                        filterOptions={(options, { inputValue }) => {
                            const searchTerm = inputValue.toLowerCase();
                            return options.filter(
                                (option) =>
                                    option.userName.toLowerCase().includes(searchTerm) ||
                                    option.userEmail.toLowerCase().includes(searchTerm)
                            );
                        }}
                        isOptionEqualToValue={(option, val) => option.userId === val?.userId}
                        ListboxProps={{
                            sx: {
                                maxHeight: 280,
                                overflow: "auto",
                                padding: "4px 0",
                                "&::-webkit-scrollbar": {
                                    width: "6px",
                                },
                                "&::-webkit-scrollbar-track": {
                                    background: "transparent",
                                },
                                "&::-webkit-scrollbar-thumb": {
                                    background:
                                        mode === "dark"
                                            ? "rgba(255, 255, 255, 0.15)"
                                            : "rgba(0, 0, 0, 0.15)",
                                    borderRadius: "3px",
                                },
                            },
                        }}
                        PaperComponent={({ children, ...props }) => (
                            <Paper
                                {...props}
                                sx={{
                                    backgroundColor: mode === "dark" ? "#1a1a2e" : "#ffffff",
                                    backgroundImage:
                                        mode === "dark"
                                            ? "linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01))"
                                            : "none",
                                    borderRadius: "10px",
                                    border:
                                        mode === "dark"
                                            ? "1px solid rgba(255, 255, 255, 0.1)"
                                            : "1px solid rgba(0, 0, 0, 0.08)",
                                    boxShadow:
                                        mode === "dark"
                                            ? "0 8px 32px rgba(0, 0, 0, 0.5)"
                                            : "0 8px 32px rgba(0, 0, 0, 0.12)",
                                    mt: 0.5,
                                    overflow: "hidden",
                                }}
                            >
                                {children}
                            </Paper>
                        )}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                placeholder={t.tasks.table.searchMembersPlaceholder}
                                sx={{
                                    minWidth: 180,
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: "8px",
                                        backgroundColor:
                                            mode === "dark"
                                                ? "rgba(255, 255, 255, 0.03)"
                                                : "rgba(0, 0, 0, 0.01)",
                                        "& fieldset": {
                                            borderColor:
                                                mode === "dark"
                                                    ? "rgba(255, 255, 255, 0.15)"
                                                    : "rgba(0, 0, 0, 0.12)",
                                        },
                                        "&:hover fieldset": {
                                            borderColor: accent,
                                        },
                                        "&.Mui-focused fieldset": {
                                            borderColor: accent,
                                            borderWidth: "1.5px",
                                        },
                                    },
                                    "& .MuiInputBase-input": {
                                        color: mode === "dark" ? "#e8e8e8" : "#1a1a1a",
                                        fontSize: "0.875rem",
                                        padding: "6px 12px",
                                        "&::placeholder": {
                                            color:
                                                mode === "dark"
                                                    ? "rgba(255, 255, 255, 0.4)"
                                                    : "rgba(0, 0, 0, 0.4)",
                                            opacity: 1,
                                        },
                                    },
                                }}
                                autoFocus
                            />
                        )}
                        renderOption={(props, option) => {
                            const isSelected = String(option.userId) === storedString;
                            const { key, ...restProps } = stripOwnerState(props);
                            return (
                                <Box
                                    key={key}
                                    component="li"
                                    {...restProps}
                                    sx={{
                                        py: 1,
                                        px: 1.5,
                                        mx: 0.5,
                                        my: 0.25,
                                        borderRadius: "8px",
                                        transition: "all 0.15s ease",
                                        backgroundColor: isSelected
                                            ? mode === "dark"
                                                ? "rgba(var(--gp-brandalt-400-rgb), 0.15)"
                                                : "rgba(var(--gp-brand-700-rgb), 0.08)"
                                            : "transparent",
                                        "&:hover": {
                                            backgroundColor:
                                                mode === "dark"
                                                    ? "rgba(var(--gp-brandalt-400-rgb), 0.2)"
                                                    : "rgba(var(--gp-brand-700-rgb), 0.12)",
                                        },
                                        display: "flex",
                                        gap: 1.5,
                                        alignItems: "center",
                                        cursor: "pointer",
                                    }}
                                >
                                    <UserAvatar
                                        clickable={false}
                                        showPulseDot={false}
                                        userId={option.userId}
                                    />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography
                                            level="body-sm"
                                            sx={{
                                                fontWeight: isSelected ? 600 : 500,
                                                color: mode === "dark" ? "#e8e8e8" : "#1a1a1a",
                                                lineHeight: 1.3,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {option.userName}
                                        </Typography>
                                        <Typography
                                            level="body-xs"
                                            sx={{
                                                color:
                                                    mode === "dark"
                                                        ? "rgba(255, 255, 255, 0.5)"
                                                        : "rgba(0, 0, 0, 0.5)",
                                                fontSize: "0.7rem",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {option.userEmail}
                                        </Typography>
                                    </Box>
                                </Box>
                            );
                        }}
                        sx={{
                            "& .MuiAutocomplete-popupIndicator": {
                                color:
                                    mode === "dark"
                                        ? "rgba(255, 255, 255, 0.5)"
                                        : "rgba(0, 0, 0, 0.5)",
                            },
                            "& .MuiAutocomplete-clearIndicator": {
                                color:
                                    mode === "dark"
                                        ? "rgba(255, 255, 255, 0.5)"
                                        : "rgba(0, 0, 0, 0.5)",
                            },
                        }}
                        fullWidth
                        onChange={(_, newValue) => {
                            if (newValue) {
                                void commitCustomField(def.fieldId, String(newValue.userId));
                                handleCancelEdit();
                            }
                        }}
                        onClose={(_, reason) => {
                            if (reason === "blur" || reason === "escape") {
                                handleCancelEdit();
                            }
                        }}
                    />
                );
            }
            // Read view mirrors the built-in Assignee cell: avatar + name,
            // or the neutral "?" placeholder avatar + muted dash when unset.
            const memberName =
                teamMembers.find((m) => String(m.userId) === storedString)?.userName ?? "";
            return (
                <Box
                    sx={{
                        display: "flex",
                        gap: 1,
                        alignItems: "center",
                        cursor: "pointer",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        transition: "background-color 0.15s ease",
                        "&:hover": {
                            backgroundColor:
                                mode === "dark"
                                    ? "rgba(255, 255, 255, 0.08)"
                                    : "rgba(0, 0, 0, 0.04)",
                        },
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        setEditingField(editKey);
                    }}
                >
                    <Box sx={{ position: "relative", display: "inline-flex" }}>
                        {storedString !== "" ? (
                            <UserAvatar showPulseDot={false} userId={storedString} />
                        ) : (
                            <Avatar
                                size="sm"
                                sx={{
                                    bgcolor:
                                        mode === "dark"
                                            ? "rgba(255,255,255,0.08)"
                                            : "rgba(0,0,0,0.06)",
                                    color:
                                        mode === "dark"
                                            ? "rgba(255,255,255,0.45)"
                                            : "rgba(0,0,0,0.45)",
                                    fontSize: "0.7rem",
                                }}
                            >
                                ?
                            </Avatar>
                        )}
                    </Box>
                    <Box sx={{ overflow: "hidden" }}>
                        <Typography
                            level="body-xs"
                            sx={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                fontWeight: 500,
                                fontStyle: storedString !== "" ? "normal" : "italic",
                                color:
                                    storedString !== ""
                                        ? undefined
                                        : mode === "dark"
                                          ? "rgba(255,255,255,0.5)"
                                          : "rgba(0,0,0,0.5)",
                            }}
                        >
                            {storedString !== "" ? (
                                <ResolvedUserName
                                    fallbackName={memberName}
                                    userId={storedString}
                                />
                            ) : (
                                "—"
                            )}
                        </Typography>
                    </Box>
                </Box>
            );
        }

        if (def.fieldType === "date") {
            // Mirrors the built-in Due Date cell: native date input on
            // edit (buffered via editValue, commit on blur/Enter), and a
            // hover-accent Typography read view with a "-" when unset.
            if (editingField === editKey) {
                const commitDate = () =>
                    void commitCustomField(def.fieldId, editValue.trim() || null);
                return (
                    <input
                        type="date"
                        value={editValue}
                        style={{
                            width: "100%",
                            padding: "6px 10px",
                            fontSize: "0.875rem",
                            border: `1px solid ${mode === "dark" ? "#555" : "#ccc"}`,
                            borderRadius: "6px",
                            backgroundColor: mode === "dark" ? "#1e1e1e" : "#fff",
                            color: mode === "dark" ? "#e0e0e0" : "#333",
                        }}
                        autoFocus
                        onBlur={commitDate}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") commitDate();
                            if (e.key === "Escape") handleCancelEdit();
                        }}
                    />
                );
            }
            return (
                <Typography
                    level="body-sm"
                    sx={{
                        cursor: "pointer",
                        fontWeight: 500,
                        "&:hover": {
                            color: accent,
                        },
                    }}
                    onClick={() => handleStartEdit(editKey, storedString)}
                >
                    {storedString !== "" ? storedString : "-"}
                </Typography>
            );
        }

        // text — mirrors the built-in Title cell's input styling.
        if (editingField === editKey) {
            return (
                <TextField
                    autoFocus
                    fullWidth
                    size="small"
                    value={editValue}
                    sx={{
                        "& .MuiInputBase-input": {
                            color: mode === "dark" ? "white" : "black",
                            fontSize: "0.875rem",
                            padding: "6px 10px",
                        },
                        "& .MuiOutlinedInput-root": {
                            borderRadius: "6px",
                        },
                    }}
                    onBlur={() => {
                        void commitCustomField(def.fieldId, editValue.trim() || null);
                    }}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            void commitCustomField(def.fieldId, editValue.trim() || null);
                        } else if (e.key === "Escape") {
                            handleCancelEdit();
                        }
                    }}
                />
            );
        }
        return (
            <Box
                sx={customReadCellSx}
                onClick={(e) => {
                    e.stopPropagation();
                    handleStartEdit(editKey, storedString);
                }}
            >
                {storedString === "" ? (
                    emptyCellPlaceholder
                ) : (
                    <AppTooltip title={storedString}>
                        <Typography
                            level="body-sm"
                            sx={{
                                fontSize: "0.8rem",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {storedString}
                        </Typography>
                    </AppTooltip>
                )}
            </Box>
        );
    };

    const renderCellContent = (column: ColumnDef) => {
        const value = task[column.field as keyof TaskTableProps];

        switch (column.field) {
            case "__expand":
                if (isChild && !hasChildren) {
                    return (
                        <SubdirectoryArrowRightRoundedIcon
                            sx={{
                                fontSize: 15,
                                color:
                                    mode === "dark" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.18)",
                            }}
                        />
                    );
                }
                if (!hasChildren) return null;
                return (
                    <IconButton
                        size="small"
                        sx={{
                            color: mode === "dark" ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)",
                            p: 0,
                            minWidth: 24,
                            minHeight: 24,
                            "&:hover": {
                                color:
                                    mode === "dark" ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.8)",
                            },
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(taskIdStr);
                        }}
                    >
                        {isExpanded ? (
                            <KeyboardArrowDownRoundedIcon sx={{ fontSize: 18 }} />
                        ) : (
                            <KeyboardArrowRightRoundedIcon sx={{ fontSize: 18 }} />
                        )}
                    </IconButton>
                );

            case "id":
                return (
                    <IconButton
                        size="small"
                        sx={{
                            color: isMilestoneRow
                                ? "#f97316"
                                : mode === "dark"
                                  ? "var(--gp-brandalt-400)"
                                  : "var(--gp-brand-700)",
                            fontWeight: 600,
                            "&:hover": {
                                backgroundColor: isMilestoneRow
                                    ? "rgba(249, 115, 22, 0.12)"
                                    : mode === "dark"
                                      ? "rgba(var(--gp-brandalt-400-rgb), 0.15)"
                                      : "rgba(var(--gp-brand-700-rgb), 0.1)",
                            },
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            openPreview();
                        }}
                    >
                        <Typography
                            fontSize="13px"
                            sx={{
                                fontWeight: 600,
                                color: isMilestoneRow
                                    ? "#f97316"
                                    : mode === "dark"
                                      ? "var(--gp-brandalt-400)"
                                      : "var(--gp-brand-700)",
                            }}
                        >
                            {formatTaskDisplayId(task)}
                        </Typography>
                        <OpenInNewIcon sx={{ ml: 0.5, fontSize: 14 }} />
                    </IconButton>
                );

            case "status":
                const statusOption = statusOptions.find((opt) => opt.value === value);
                if (editingField === "status") {
                    return (
                        <Select
                            open={true}
                            size="small"
                            value={(value as string) || ""}
                            MenuProps={{
                                PaperProps: {
                                    sx: {
                                        backgroundColor: mode === "dark" ? "#1a1a2e" : "#ffffff",
                                        borderRadius: "8px",
                                        border:
                                            mode === "dark"
                                                ? "1px solid rgba(255, 255, 255, 0.1)"
                                                : "1px solid rgba(0, 0, 0, 0.08)",
                                        boxShadow:
                                            mode === "dark"
                                                ? "0 8px 24px rgba(0, 0, 0, 0.4)"
                                                : "0 8px 24px rgba(0, 0, 0, 0.1)",
                                        mt: 0.5,
                                    },
                                },
                            }}
                            renderValue={(selected) => {
                                const opt = statusOptions.find((o) => o.value === selected);
                                return opt ? (
                                    <Chip
                                        icon={opt.icon}
                                        label={taskMetaLabel(opt.value, t.tasks.filters)}
                                        size="small"
                                        sx={{
                                            backgroundColor: alpha(opt.color, 0.75),
                                            color: opt.textColor,
                                            fontWeight: "bold",
                                            borderRadius: "5px",
                                            minWidth: 70,
                                        }}
                                    />
                                ) : null;
                            }}
                            sx={{
                                minWidth: 110,
                                "& .MuiSelect-select": {
                                    display: "flex",
                                    alignItems: "center",
                                    padding: "4px 8px",
                                    minHeight: "unset",
                                },
                                "& .MuiOutlinedInput-notchedOutline": {
                                    borderColor:
                                        mode === "dark"
                                            ? "rgba(255, 255, 255, 0.15)"
                                            : "rgba(0, 0, 0, 0.12)",
                                    borderRadius: "6px",
                                },
                                "&:hover .MuiOutlinedInput-notchedOutline": {
                                    borderColor:
                                        mode === "dark"
                                            ? "var(--gp-brandalt-400)"
                                            : "var(--gp-brand-700)",
                                },
                            }}
                            onClose={handleCancelEdit}
                            onChange={(e: SelectChangeEvent) => {
                                handleSelectChange("status", e.target.value);
                                handleCancelEdit();
                            }}
                        >
                            {statusOptions.map((opt) => (
                                <MenuItem
                                    key={opt.value}
                                    value={opt.value}
                                    sx={{
                                        py: 0.75,
                                        px: 1,
                                        mx: 0.5,
                                        my: 0.25,
                                        borderRadius: "6px",
                                        "&:hover": {
                                            backgroundColor:
                                                mode === "dark"
                                                    ? "rgba(255, 255, 255, 0.08)"
                                                    : "rgba(0, 0, 0, 0.04)",
                                        },
                                    }}
                                >
                                    <Chip
                                        icon={opt.icon}
                                        label={taskMetaLabel(opt.value, t.tasks.filters)}
                                        size="small"
                                        sx={{
                                            backgroundColor: alpha(opt.color, 0.75),
                                            color: opt.textColor,
                                            fontWeight: "bold",
                                            borderRadius: "5px",
                                            minWidth: 70,
                                        }}
                                    />
                                </MenuItem>
                            ))}
                        </Select>
                    );
                }
                return statusOption ? (
                    <Chip
                        icon={statusOption.icon}
                        label={taskMetaLabel(statusOption.value, t.tasks.filters)}
                        size="small"
                        sx={{
                            cursor: "pointer",
                            backgroundColor: alpha(
                                statusOption.color,
                                mode === "dark" ? 0.5 : 0.75
                            ),
                            color: statusOption.textColor,
                            fontWeight: "bold",
                            borderRadius: "6px",
                            transition: "transform 0.1s ease, box-shadow 0.1s ease",
                            "&:hover": {
                                transform: "scale(1.02)",
                                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                                backgroundColor:
                                    mode === "dark"
                                        ? "rgba(36, 167, 0, 0.25)"
                                        : "rgba(36, 167, 0, 0.53)",
                            },
                        }}
                        onClick={() => handleStartEdit("status", value as string)}
                    />
                ) : null;

            case "pr": {
                // Auto-linked PRs: PRs whose head branch contains the
                // task's display ID. The cell handles its own async
                // fetch + the empty case (no display ID, no GitHub
                // connection, no matching PRs → renders nothing).
                if (task.id == null) return null;
                return <PrStatusCell accessToken={accessToken} taskId={task.id} />;
            }

            case "tags": {
                const tags = task.tags || [];
                const tagAccent =
                    mode === "dark" ? "var(--gp-brandalt-400)" : "var(--gp-brand-700)";
                if (editingField === "tags") {
                    return (
                        // Stop mouse events reaching the row (drag / preview).
                        <Box
                            sx={{ width: "100%" }}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <Autocomplete
                                autoHighlight
                                disableCloseOnSelect
                                multiple
                                openOnFocus
                                getOptionLabel={(option: TagListProps) => option.tagName}
                                isOptionEqualToValue={(option, value) =>
                                    option.tagName === value?.tagName
                                }
                                options={projectTags}
                                size="small"
                                sx={{ width: "100%", minWidth: 160 }}
                                value={editTags}
                                onChange={(_, newValue) => setEditTags(newValue)}
                                onBlur={() => {
                                    if (revertTagsRef.current) {
                                        revertTagsRef.current = false;
                                        return;
                                    }
                                    handleSaveTags();
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Escape") {
                                        e.stopPropagation();
                                        revertTagsRef.current = true;
                                        handleCancelEdit();
                                    }
                                }}
                                renderTags={(value, getTagProps) =>
                                    value.map((tag, idx) => {
                                        const { key, ...chipProps } = getTagProps({ index: idx });
                                        return (
                                            <Chip
                                                key={key}
                                                {...chipProps}
                                                label={tag.tagName}
                                                size="small"
                                                sx={{
                                                    height: 20,
                                                    fontSize: "0.7rem",
                                                    fontWeight: 600,
                                                    color: mode === "dark" ? "white" : "black",
                                                    borderColor: alpha(tag.tagColor, 0.6),
                                                    backgroundColor: alpha(tag.tagColor, 0.12),
                                                }}
                                            />
                                        );
                                    })
                                }
                                PaperComponent={({ children, ...paperProps }) => (
                                    <Paper
                                        {...paperProps}
                                        sx={{
                                            backgroundColor:
                                                mode === "dark" ? "#1a1a2e" : "#ffffff",
                                            borderRadius: "10px",
                                            border:
                                                mode === "dark"
                                                    ? "1px solid rgba(255, 255, 255, 0.1)"
                                                    : "1px solid rgba(0, 0, 0, 0.08)",
                                            boxShadow:
                                                mode === "dark"
                                                    ? "0 8px 32px rgba(0, 0, 0, 0.5)"
                                                    : "0 8px 32px rgba(0, 0, 0, 0.12)",
                                            mt: 0.5,
                                        }}
                                    >
                                        {children}
                                    </Paper>
                                )}
                                renderOption={(optionProps, option) => {
                                    const { key, ...restProps } = stripOwnerState(optionProps);
                                    return (
                                        <Box
                                            key={key}
                                            component="li"
                                            {...restProps}
                                            sx={tagOptionRowSx}
                                        >
                                            <ProjectTagChip
                                                isDark={mode === "dark"}
                                                label={option.tagName}
                                                tagColor={option.tagColor}
                                            />
                                        </Box>
                                    );
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        autoFocus
                                        placeholder={
                                            tags.length === 0
                                                ? t.tasks.table.addTagsPlaceholder
                                                : ""
                                        }
                                        sx={{
                                            "& .MuiOutlinedInput-root": {
                                                borderRadius: "6px",
                                                fontSize: "0.8rem",
                                                padding: "2px 6px",
                                                "&:hover fieldset": { borderColor: tagAccent },
                                                "&.Mui-focused fieldset": {
                                                    borderColor: tagAccent,
                                                    borderWidth: "1.5px",
                                                },
                                            },
                                        }}
                                    />
                                )}
                            />
                        </Box>
                    );
                }
                // Read view: chips, click anywhere in the cell to edit.
                return (
                    <Box
                        sx={{
                            display: "flex",
                            gap: 0.5,
                            flexWrap: "wrap",
                            alignItems: "center",
                            width: "100%",
                            minHeight: 24,
                            cursor: "pointer",
                            borderRadius: "6px",
                            px: 0.5,
                            transition: "background-color 0.15s ease",
                            "&:hover": {
                                backgroundColor:
                                    mode === "dark"
                                        ? "rgba(255,255,255,0.06)"
                                        : "rgba(0,0,0,0.04)",
                            },
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleStartEditTags();
                        }}
                    >
                        {tags.length === 0 ? (
                            <Typography
                                sx={{
                                    fontSize: "0.72rem",
                                    color: mode === "dark" ? "#6b7280" : "#9ca3af",
                                }}
                            >
                                {t.tasks.table.addTagsMenuItem}
                            </Typography>
                        ) : (
                            [...tags]
                                .sort((a, b) => (a.tagName || "").localeCompare(b.tagName || ""))
                                .map((tag, idx) => (
                                    <ProjectTagChip
                                        key={idx}
                                        isDark={mode === "dark"}
                                        label={tag.tagName}
                                        tagColor={tag.tagColor}
                                    />
                                ))
                        )}
                    </Box>
                );
            }

            case "title":
                if (editingField === "title") {
                    return (
                        <TextField
                            size="small"
                            value={editValue}
                            sx={{
                                "& .MuiInputBase-input": {
                                    color: mode === "dark" ? "white" : "black",
                                    fontSize: "0.875rem",
                                    padding: "6px 10px",
                                },
                                "& .MuiOutlinedInput-root": {
                                    borderRadius: "6px",
                                },
                                ml: depth > 0 ? depth * 1.5 : 0,
                            }}
                            autoFocus
                            fullWidth
                            onBlur={() => handleSaveEdit("title")}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveEdit("title");
                                if (e.key === "Escape") handleCancelEdit();
                            }}
                        />
                    );
                }
                return (
                    <Box
                        sx={{
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                            pl: depth > 0 ? depth * 1.5 : 0,
                            width: "100%",
                            "&:hover .task-row-title": {
                                color: isMilestoneRow
                                    ? "#f97316"
                                    : mode === "dark"
                                      ? "var(--gp-brandalt-400)"
                                      : "var(--gp-brand-700)",
                            },
                        }}
                        onClick={() => handleStartEdit("title", task.title || "")}
                    >
                        {isMilestoneRow && (
                            <FlagRoundedIcon
                                sx={{ fontSize: 14, color: "#f97316", flexShrink: 0 }}
                            />
                        )}
                        <Typography
                            className="task-row-title"
                            level="body-sm"
                            sx={{
                                fontWeight: isMilestoneRow ? 600 : depth > 0 ? 400 : 500,
                                opacity: depth > 0 ? 0.85 : 1,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                                transition: "color 0.15s ease",
                            }}
                        >
                            {task.title}
                        </Typography>
                    </Box>
                );

            case "assigneeId":
                if (editingField === "assigneeId") {
                    const currentAssignee = teamMembers.find(
                        (member) => member.userId === task.assigneeId
                    );
                    return (
                        <Autocomplete
                            blurOnSelect={true}
                            clearOnBlur={false}
                            getOptionLabel={(option) => `${option.userName} ${option.userEmail}`}
                            open={true}
                            options={teamMembers}
                            size="small"
                            value={currentAssignee || null}
                            filterOptions={(options, { inputValue }) => {
                                const searchTerm = inputValue.toLowerCase();
                                return options.filter(
                                    (option) =>
                                        option.userName.toLowerCase().includes(searchTerm) ||
                                        option.userEmail.toLowerCase().includes(searchTerm)
                                );
                            }}
                            isOptionEqualToValue={(option, value) =>
                                option.userId === value?.userId
                            }
                            ListboxProps={{
                                sx: {
                                    maxHeight: 280,
                                    overflow: "auto",
                                    padding: "4px 0",
                                    "&::-webkit-scrollbar": {
                                        width: "6px",
                                    },
                                    "&::-webkit-scrollbar-track": {
                                        background: "transparent",
                                    },
                                    "&::-webkit-scrollbar-thumb": {
                                        background:
                                            mode === "dark"
                                                ? "rgba(255, 255, 255, 0.15)"
                                                : "rgba(0, 0, 0, 0.15)",
                                        borderRadius: "3px",
                                    },
                                },
                            }}
                            PaperComponent={({ children, ...props }) => (
                                <Paper
                                    {...props}
                                    sx={{
                                        backgroundColor: mode === "dark" ? "#1a1a2e" : "#ffffff",
                                        backgroundImage:
                                            mode === "dark"
                                                ? "linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01))"
                                                : "none",
                                        borderRadius: "10px",
                                        border:
                                            mode === "dark"
                                                ? "1px solid rgba(255, 255, 255, 0.1)"
                                                : "1px solid rgba(0, 0, 0, 0.08)",
                                        boxShadow:
                                            mode === "dark"
                                                ? "0 8px 32px rgba(0, 0, 0, 0.5)"
                                                : "0 8px 32px rgba(0, 0, 0, 0.12)",
                                        mt: 0.5,
                                        overflow: "hidden",
                                    }}
                                >
                                    {children}
                                </Paper>
                            )}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    placeholder={t.tasks.table.searchMembersPlaceholder}
                                    sx={{
                                        minWidth: 180,
                                        "& .MuiOutlinedInput-root": {
                                            borderRadius: "8px",
                                            backgroundColor:
                                                mode === "dark"
                                                    ? "rgba(255, 255, 255, 0.03)"
                                                    : "rgba(0, 0, 0, 0.01)",
                                            "& fieldset": {
                                                borderColor:
                                                    mode === "dark"
                                                        ? "rgba(255, 255, 255, 0.15)"
                                                        : "rgba(0, 0, 0, 0.12)",
                                            },
                                            "&:hover fieldset": {
                                                borderColor:
                                                    mode === "dark"
                                                        ? "var(--gp-brandalt-400)"
                                                        : "var(--gp-brand-700)",
                                            },
                                            "&.Mui-focused fieldset": {
                                                borderColor:
                                                    mode === "dark"
                                                        ? "var(--gp-brandalt-400)"
                                                        : "var(--gp-brand-700)",
                                                borderWidth: "1.5px",
                                            },
                                        },
                                        "& .MuiInputBase-input": {
                                            color: mode === "dark" ? "#e8e8e8" : "#1a1a1a",
                                            fontSize: "0.875rem",
                                            padding: "6px 12px",
                                            "&::placeholder": {
                                                color:
                                                    mode === "dark"
                                                        ? "rgba(255, 255, 255, 0.4)"
                                                        : "rgba(0, 0, 0, 0.4)",
                                                opacity: 1,
                                            },
                                        },
                                    }}
                                    autoFocus
                                />
                            )}
                            renderOption={(props, option) => {
                                const isSelected = option.userId === task.assigneeId;
                                // stripOwnerState: bespoke <li> rows must not
                                // forward Joy's internal ownerState to the DOM
                                // (React warns on every rendered option).
                                const { key, ...restProps } = stripOwnerState(props);
                                return (
                                    <Box
                                        key={key}
                                        component="li"
                                        {...restProps}
                                        sx={{
                                            py: 1,
                                            px: 1.5,
                                            mx: 0.5,
                                            my: 0.25,
                                            borderRadius: "8px",
                                            transition: "all 0.15s ease",
                                            backgroundColor: isSelected
                                                ? mode === "dark"
                                                    ? "rgba(var(--gp-brandalt-400-rgb), 0.15)"
                                                    : "rgba(var(--gp-brand-700-rgb), 0.08)"
                                                : "transparent",
                                            "&:hover": {
                                                backgroundColor:
                                                    mode === "dark"
                                                        ? "rgba(var(--gp-brandalt-400-rgb), 0.2)"
                                                        : "rgba(var(--gp-brand-700-rgb), 0.12)",
                                            },
                                            display: "flex",
                                            gap: 1.5,
                                            alignItems: "center",
                                            cursor: "pointer",
                                        }}
                                    >
                                        <UserAvatar
                                            clickable={false}
                                            showPulseDot={false}
                                            userId={option.userId}
                                        />
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography
                                                level="body-sm"
                                                sx={{
                                                    fontWeight: isSelected ? 600 : 500,
                                                    color: mode === "dark" ? "#e8e8e8" : "#1a1a1a",
                                                    lineHeight: 1.3,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {option.userName}
                                            </Typography>
                                            <Typography
                                                level="body-xs"
                                                sx={{
                                                    color:
                                                        mode === "dark"
                                                            ? "rgba(255, 255, 255, 0.5)"
                                                            : "rgba(0, 0, 0, 0.5)",
                                                    fontSize: "0.7rem",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {option.userEmail}
                                            </Typography>
                                        </Box>
                                    </Box>
                                );
                            }}
                            sx={{
                                "& .MuiAutocomplete-popupIndicator": {
                                    color:
                                        mode === "dark"
                                            ? "rgba(255, 255, 255, 0.5)"
                                            : "rgba(0, 0, 0, 0.5)",
                                },
                                "& .MuiAutocomplete-clearIndicator": {
                                    color:
                                        mode === "dark"
                                            ? "rgba(255, 255, 255, 0.5)"
                                            : "rgba(0, 0, 0, 0.5)",
                                },
                            }}
                            fullWidth
                            onChange={(_, newValue) => {
                                if (newValue) {
                                    handleSelectChange("assigneeId", newValue.userId);
                                    handleCancelEdit();
                                }
                                // Don't close when clearing - let user continue typing
                            }}
                            onClose={(_, reason) => {
                                // Only close when clicking outside or pressing escape
                                // Don't close when clearing the input
                                if (reason === "blur" || reason === "escape") {
                                    handleCancelEdit();
                                }
                            }}
                        />
                    );
                }
                return (
                    <Box
                        sx={{
                            display: "flex",
                            gap: 1,
                            alignItems: "center",
                            cursor: "pointer",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            transition: "background-color 0.15s ease",
                            "&:hover": {
                                backgroundColor:
                                    mode === "dark"
                                        ? "rgba(255, 255, 255, 0.08)"
                                        : "rgba(0, 0, 0, 0.04)",
                            },
                        }}
                        onClick={() => handleStartEdit("assigneeId", task.assigneeId || "")}
                    >
                        <Box sx={{ position: "relative", display: "inline-flex" }}>
                            {task.assigneeId ? (
                                <UserAvatar showPulseDot={false} userId={task.assigneeId} />
                            ) : (
                                // Unassigned task — render a neutral
                                // placeholder, NOT `myself`'s avatar (the
                                // old fallback was a leftover from when
                                // every task was forced to have an
                                // assignee on create).
                                <Avatar
                                    size="sm"
                                    sx={{
                                        bgcolor:
                                            mode === "dark"
                                                ? "rgba(255,255,255,0.08)"
                                                : "rgba(0,0,0,0.06)",
                                        color:
                                            mode === "dark"
                                                ? "rgba(255,255,255,0.45)"
                                                : "rgba(0,0,0,0.45)",
                                        fontSize: "0.7rem",
                                    }}
                                >
                                    ?
                                </Avatar>
                            )}
                        </Box>
                        <Box sx={{ overflow: "hidden" }}>
                            <Typography
                                level="body-xs"
                                sx={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    fontWeight: 500,
                                    // Italicize + dim the placeholder
                                    // so "Unassigned" reads as a
                                    // state, not a name.
                                    fontStyle: task.assigneeId ? "normal" : "italic",
                                    color: task.assigneeId
                                        ? undefined
                                        : mode === "dark"
                                          ? "rgba(255,255,255,0.5)"
                                          : "rgba(0,0,0,0.5)",
                                }}
                            >
                                {task.assigneeId ? (
                                    <ResolvedUserName
                                        fallbackName={task.assigneeName || ""}
                                        userId={task.assigneeId}
                                    />
                                ) : (
                                    t.tasks.messageTemplate.unassigned
                                )}
                            </Typography>
                        </Box>
                    </Box>
                );

            case "priority":
                const priorityOption = priorities.find((p) => p.priority === value);
                if (editingField === "priority") {
                    return (
                        <Select
                            open={true}
                            size="small"
                            value={(value as string) || ""}
                            MenuProps={{
                                PaperProps: {
                                    sx: {
                                        backgroundColor: mode === "dark" ? "#1a1a2e" : "#ffffff",
                                        borderRadius: "8px",
                                        border:
                                            mode === "dark"
                                                ? "1px solid rgba(255, 255, 255, 0.1)"
                                                : "1px solid rgba(0, 0, 0, 0.08)",
                                        boxShadow:
                                            mode === "dark"
                                                ? "0 8px 24px rgba(0, 0, 0, 0.4)"
                                                : "0 8px 24px rgba(0, 0, 0, 0.1)",
                                        mt: 0.5,
                                    },
                                },
                            }}
                            renderValue={(selected) => {
                                const opt = priorities.find((p) => p.priority === selected);
                                return opt ? (
                                    <Chip
                                        label={taskMetaLabel(opt.priority, t.tasks.filters)}
                                        size="small"
                                        sx={{
                                            backgroundColor: alpha(opt.color || "#888", 0.75),
                                            color: opt.textColor,
                                            fontWeight: "bold",
                                            borderRadius: "5px",
                                            minWidth: 60,
                                        }}
                                    />
                                ) : null;
                            }}
                            sx={{
                                minWidth: 100,
                                "& .MuiSelect-select": {
                                    display: "flex",
                                    alignItems: "center",
                                    padding: "4px 8px",
                                    minHeight: "unset",
                                },
                                "& .MuiOutlinedInput-notchedOutline": {
                                    borderColor:
                                        mode === "dark"
                                            ? "rgba(255, 255, 255, 0.15)"
                                            : "rgba(0, 0, 0, 0.12)",
                                    borderRadius: "6px",
                                },
                                "&:hover .MuiOutlinedInput-notchedOutline": {
                                    borderColor:
                                        mode === "dark"
                                            ? "var(--gp-brandalt-400)"
                                            : "var(--gp-brand-700)",
                                },
                            }}
                            onClose={handleCancelEdit}
                            onChange={(e: SelectChangeEvent) => {
                                handleSelectChange("priority", e.target.value);
                                handleCancelEdit();
                            }}
                        >
                            {priorities.map((opt) => (
                                <MenuItem
                                    key={opt.priority || ""}
                                    value={opt.priority || ""}
                                    sx={{
                                        py: 0.75,
                                        px: 1,
                                        mx: 0.5,
                                        my: 0.25,
                                        borderRadius: "6px",
                                        "&:hover": {
                                            backgroundColor:
                                                mode === "dark"
                                                    ? "rgba(255, 255, 255, 0.08)"
                                                    : "rgba(0, 0, 0, 0.04)",
                                        },
                                    }}
                                >
                                    <Chip
                                        label={taskMetaLabel(opt.priority, t.tasks.filters)}
                                        size="small"
                                        sx={{
                                            backgroundColor: alpha(opt.color || "#888", 0.75),
                                            color: opt.textColor,
                                            fontWeight: "bold",
                                            borderRadius: "5px",
                                            minWidth: 60,
                                        }}
                                    />
                                </MenuItem>
                            ))}
                        </Select>
                    );
                }
                return priorityOption ? (
                    <Chip
                        label={taskMetaLabel(priorityOption.priority, t.tasks.filters)}
                        size="small"
                        sx={{
                            cursor: "pointer",
                            backgroundColor: alpha(
                                priorityOption.color || "#888",
                                mode === "dark" ? 0.5 : 0.75
                            ),
                            color: priorityOption.textColor,
                            fontWeight: "bold",
                            borderRadius: "6px",
                            transition: "transform 0.1s ease",
                            "&:hover": {
                                transform: "scale(1.02)",
                                backgroundColor:
                                    mode === "dark"
                                        ? "rgba(36, 167, 0, 0.25)"
                                        : "rgba(36, 167, 0, 0.53)",
                            },
                        }}
                        onClick={() => handleStartEdit("priority", value as string)}
                    />
                ) : null;

            case "effortLevel":
                const effortOption = effortLevels.find((e) => e.level === value);
                if (editingField === "effortLevel") {
                    return (
                        <Select
                            open={true}
                            size="small"
                            value={(value as string) || ""}
                            MenuProps={{
                                PaperProps: {
                                    sx: {
                                        backgroundColor: mode === "dark" ? "#1a1a2e" : "#ffffff",
                                        borderRadius: "8px",
                                        border:
                                            mode === "dark"
                                                ? "1px solid rgba(255, 255, 255, 0.1)"
                                                : "1px solid rgba(0, 0, 0, 0.08)",
                                        boxShadow:
                                            mode === "dark"
                                                ? "0 8px 24px rgba(0, 0, 0, 0.4)"
                                                : "0 8px 24px rgba(0, 0, 0, 0.1)",
                                        mt: 0.5,
                                    },
                                },
                            }}
                            renderValue={(selected) => {
                                const opt = effortLevels.find((e) => e.level === selected);
                                return opt ? (
                                    <Chip
                                        label={taskMetaLabel(opt.level, t.tasks.filters)}
                                        size="small"
                                        sx={{
                                            backgroundColor: alpha(opt.color || "#888", 0.75),
                                            color: opt.textColor,
                                            fontWeight: "bold",
                                            borderRadius: "5px",
                                            minWidth: 50,
                                        }}
                                    />
                                ) : null;
                            }}
                            sx={{
                                minWidth: 90,
                                "& .MuiSelect-select": {
                                    display: "flex",
                                    alignItems: "center",
                                    padding: "4px 8px",
                                    minHeight: "unset",
                                },
                                "& .MuiOutlinedInput-notchedOutline": {
                                    borderColor:
                                        mode === "dark"
                                            ? "rgba(255, 255, 255, 0.15)"
                                            : "rgba(0, 0, 0, 0.12)",
                                    borderRadius: "6px",
                                },
                                "&:hover .MuiOutlinedInput-notchedOutline": {
                                    borderColor:
                                        mode === "dark"
                                            ? "var(--gp-brandalt-400)"
                                            : "var(--gp-brand-700)",
                                },
                            }}
                            onClose={handleCancelEdit}
                            onChange={(e: SelectChangeEvent) => {
                                handleSelectChange("effortLevel", e.target.value);
                                handleCancelEdit();
                            }}
                        >
                            {effortLevels.map((opt) => (
                                <MenuItem
                                    key={opt.level || ""}
                                    value={opt.level || ""}
                                    sx={{
                                        py: 0.75,
                                        px: 1,
                                        mx: 0.5,
                                        my: 0.25,
                                        borderRadius: "6px",
                                        "&:hover": {
                                            backgroundColor:
                                                mode === "dark"
                                                    ? "rgba(255, 255, 255, 0.08)"
                                                    : "rgba(0, 0, 0, 0.04)",
                                        },
                                    }}
                                >
                                    <Chip
                                        label={taskMetaLabel(opt.level, t.tasks.filters)}
                                        size="small"
                                        sx={{
                                            backgroundColor: alpha(opt.color || "#888", 0.75),
                                            color: opt.textColor,
                                            fontWeight: "bold",
                                            borderRadius: "5px",
                                            minWidth: 50,
                                        }}
                                    />
                                </MenuItem>
                            ))}
                        </Select>
                    );
                }
                return effortOption ? (
                    <Chip
                        label={taskMetaLabel(effortOption.level, t.tasks.filters)}
                        size="small"
                        sx={{
                            cursor: "pointer",
                            backgroundColor: alpha(
                                effortOption.color || "#888",
                                mode === "dark" ? 0.5 : 1
                            ),
                            color: effortOption.textColor,
                            fontWeight: "bold",
                            borderRadius: "6px",
                            transition: "transform 0.1s ease",
                            "&:hover": {
                                transform: "scale(1.02)",
                                backgroundColor:
                                    mode === "dark"
                                        ? "rgba(36, 167, 0, 0.25)"
                                        : "rgba(36, 167, 0, 0.53)",
                            },
                        }}
                        onClick={() => handleStartEdit("effortLevel", value as string)}
                    />
                ) : null;

            case "weight": {
                // Derived Task Weight (priority × urgency). Read-only; it
                // tracks the priority + due-date cells rather than a stored
                // value. When BOTH are unset the number is just the floor
                // (1) with no real signal, so render a muted dash instead —
                // mirrors the "no due date" dash on the daysLeft cell.
                if (!task.priority && !task.dueDate) {
                    return (
                        <Typography
                            level="body-sm"
                            sx={{
                                fontStyle: "italic",
                                color: mode === "dark" ? "#888" : "#999",
                            }}
                        >
                            —
                        </Typography>
                    );
                }
                const weight = computeTaskWeight(task);
                const { band, color } = weightBand(weight);
                return (
                    <AppTooltip
                        title={`${fmt(t.tasks.table.weightTooltip, {
                            weight,
                            max: MAX_TASK_WEIGHT,
                        })} · ${t.tasks.table.weightBands[band]}`}
                    >
                        <Chip
                            label={weight}
                            size="small"
                            sx={{
                                backgroundColor: alpha(color, mode === "dark" ? 0.5 : 0.75),
                                color: "white",
                                fontWeight: "bold",
                                borderRadius: "6px",
                                minWidth: 30,
                            }}
                        />
                    </AppTooltip>
                );
            }

            case "daysLeft": {
                // Derive FRESH from `dueDate` — the row's `daysLeft` field is
                // a server-snapshot (cached in Redis + IDB) that goes stale
                // across a day boundary / on a cache hit. `null` = no or
                // unparseable due date → dash (an unscheduled task can't be
                // "expired"); `-1` = the overdue "Expired" sentinel.
                const dl = deriveDaysLeft(task.dueDate);
                if (dl === null) {
                    return (
                        <Typography
                            level="body-sm"
                            sx={{
                                fontStyle: "italic",
                                color: mode === "dark" ? "#888" : "#999",
                            }}
                        >
                            —
                        </Typography>
                    );
                }
                return dl === -1 ? (
                    <Chip
                        label={t.tasks.filters.expired}
                        size="small"
                        sx={{
                            backgroundColor: alpha("#ff2323", mode === "dark" ? 0.5 : 0.75),
                            color: "white",
                            fontWeight: "bold",
                            borderRadius: "6px",
                        }}
                    />
                ) : (
                    <Typography
                        level="body-sm"
                        sx={{
                            fontWeight: 500,
                            color:
                                dl <= 3
                                    ? "#f44336"
                                    : dl <= 7
                                      ? "#ff9800"
                                      : mode === "dark"
                                        ? "#e0e0e0"
                                        : "#333",
                        }}
                    >
                        {dl}
                    </Typography>
                );
            }

            case "dueDate":
                if (editingField === "dueDate") {
                    return (
                        <input
                            type="date"
                            value={editValue}
                            style={{
                                width: "100%",
                                padding: "6px 10px",
                                fontSize: "0.875rem",
                                border: `1px solid ${mode === "dark" ? "#555" : "#ccc"}`,
                                borderRadius: "6px",
                                backgroundColor: mode === "dark" ? "#1e1e1e" : "#fff",
                                color: mode === "dark" ? "#e0e0e0" : "#333",
                            }}
                            autoFocus
                            onBlur={() => handleSaveEdit("dueDate")}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveEdit("dueDate");
                                if (e.key === "Escape") handleCancelEdit();
                            }}
                        />
                    );
                }
                return (
                    <Typography
                        level="body-sm"
                        sx={{
                            cursor: "pointer",
                            fontWeight: 500,
                            "&:hover": {
                                color:
                                    mode === "dark"
                                        ? "var(--gp-brandalt-400)"
                                        : "var(--gp-brand-700)",
                            },
                        }}
                        onClick={() =>
                            handleStartEdit(
                                "dueDate",
                                task.dueDate ? dayjs(task.dueDate).format("YYYY-MM-DD") : ""
                            )
                        }
                    >
                        {task.dueDate ? dayjs(task.dueDate).format("YYYY-MM-DD") : "-"}
                    </Typography>
                );

            case "sprint": {
                if (task.sprintId == null) {
                    return (
                        <Typography
                            level="body-sm"
                            sx={{
                                color: mode === "dark" ? "#666" : "#aaa",
                                fontStyle: "italic",
                                fontSize: "0.8rem",
                            }}
                        >
                            —
                        </Typography>
                    );
                }
                const name = sprintNamesById?.get(task.sprintId) ?? `Sprint #${task.sprintId}`;
                const resolved = sprintNamesById?.has(task.sprintId) ?? false;
                return (
                    <AppTooltip title={name}>
                        <Chip
                            label={name}
                            size="small"
                            sx={{
                                maxWidth: "100%",
                                // Composed with rgba() rather than MUI's `alpha()`:
                                // brand colors are CSS variables now, and
                                // `alpha()` runs `decomposeColor`, which throws on
                                // a `var()`.
                                backgroundColor:
                                    mode === "dark"
                                        ? "rgba(var(--gp-brandalt-400-rgb), 0.18)"
                                        : "rgba(var(--gp-brand-700-rgb), 0.1)",
                                color:
                                    mode === "dark"
                                        ? "var(--gp-brandalt-300)"
                                        : "var(--gp-brand-900)",
                                fontWeight: 600,
                                fontSize: "0.72rem",
                                borderRadius: "6px",
                                border: `1px solid ${
                                    mode === "dark"
                                        ? "rgba(var(--gp-brandalt-400-rgb), 0.32)"
                                        : "rgba(var(--gp-brand-700-rgb), 0.22)"
                                }`,
                                // Italicize the fallback so the user can tell at a
                                // glance that the sprint hasn't been loaded yet.
                                fontStyle: resolved ? "normal" : "italic",
                                "& .MuiChip-label": {
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    px: 1,
                                },
                            }}
                        />
                    </AppTooltip>
                );
            }

            case "updatedAt":
                return (
                    <Typography
                        level="body-sm"
                        sx={{
                            color: mode === "dark" ? "#999" : "#666",
                            fontSize: "0.8rem",
                        }}
                    >
                        {task.updatedAt ? dayjs(task.updatedAt).format("YYYY-MM-DD HH:mm") : "-"}
                    </Typography>
                );

            case "createdDate":
                return (
                    <Typography
                        level="body-sm"
                        sx={{
                            color: mode === "dark" ? "#999" : "#666",
                            fontSize: "0.8rem",
                        }}
                    >
                        {task.createdDate ? dayjs(task.createdDate).format("YYYY-MM-DD") : "-"}
                    </Typography>
                );

            default: {
                // Custom-field columns (`cf_<fieldId>`). A def can be
                // missing when a saved column pref references a field
                // deleted since (or another project's field) — render a
                // plain dash; the column itself disappears on the next
                // visibleColumns resolution.
                const customFieldId = parseCustomFieldColKey(column.field);
                if (customFieldId != null) {
                    const def = customFieldDefs.find((d) => d.fieldId === customFieldId);
                    if (!def) return emptyCellPlaceholder;
                    return renderCustomFieldCell(def);
                }
                return <Typography level="body-sm">{String(value || "-")}</Typography>;
            }
        }
    };

    // Pre-compute the depth-keyed hover background so the `sx` rule
    // below stays a plain object literal (no per-render conditionals
    // inside CSS-in-JS). Hover is a no-op visually when the row is
    // already dragging or selected, so we strip the rule in those
    // states by leaving the `&:hover` selector with an empty body.
    const depthIdx = Math.min(depth, 3);
    const hoverBg = mode === "dark" ? DEPTH_HOVER_DARK[depthIdx] : DEPTH_HOVER_LIGHT[depthIdx];

    return (
        <Draggable
            draggableId={String(task.id)}
            index={index}
            isDragDisabled={task.isMilestone === true || isGhost}
        >
            {(provided, snapshot) => {
                const showHoverBg = !snapshot.isDragging && !isSelected;
                // `react-beautiful-dnd` populates `combineTargetFor`
                // on the row that's about to absorb the dragged task
                // (the cursor is hovering over its centre, not its
                // edge). `isCombining` is the mirror state on the
                // dragged row. We use both to make the "drop to nest"
                // intent visible — without these cues the user can't
                // tell whether releasing the mouse will reparent or
                // just reorder.
                const isCombineTarget = snapshot.combineTargetFor != null;
                const isCombineSource = snapshot.combineWith != null;
                const isDark = mode === "dark";
                // Two-stop palette so the pulse can breathe between a
                // calm and a bright accent — feels alive instead of
                // just "highlighted".
                const accent = isDark ? "var(--gp-brandalt-400)" : "var(--gp-brand-700)";
                const accentHot = isDark ? "var(--gp-brandalt-300)" : "var(--gp-brand-500)";
                const accentHotRgb = isDark
                    ? "var(--gp-brandalt-300-rgb)"
                    : "var(--gp-brand-500-rgb)";
                const pulseBgLow = isDark
                    ? "rgba(var(--gp-brandalt-400-rgb), 0.08)"
                    : "rgba(var(--gp-brand-700-rgb), 0.05)";
                const pulseBgHigh = isDark
                    ? "rgba(var(--gp-brandalt-400-rgb), 0.22)"
                    : "rgba(var(--gp-brand-700-rgb), 0.16)";
                const pulseShadowLow = isDark
                    ? "inset 0 0 0 2px rgba(var(--gp-brandalt-400-rgb), 0.6), 0 0 8px rgba(var(--gp-brandalt-400-rgb), 0.25)"
                    : "inset 0 0 0 2px rgba(var(--gp-brand-700-rgb), 0.55), 0 0 6px rgba(var(--gp-brand-700-rgb), 0.2)";
                const pulseShadowHigh = isDark
                    ? "inset 0 0 0 2px var(--gp-brandalt-300), 0 0 26px rgba(var(--gp-brandalt-400-rgb), 0.65), 0 0 12px rgba(var(--gp-brandalt-300-rgb), 0.5)"
                    : "inset 0 0 0 2px var(--gp-brand-500), 0 0 22px rgba(var(--gp-brand-700-rgb), 0.55), 0 0 10px rgba(var(--gp-brand-500-rgb), 0.45)";
                const shimmerGradient = isDark
                    ? "linear-gradient(90deg, transparent 0%, transparent 35%, rgba(var(--gp-brandalt-300-rgb), 0.35) 50%, transparent 65%, transparent 100%)"
                    : "linear-gradient(90deg, transparent 0%, transparent 35%, rgba(var(--gp-brand-500-rgb), 0.28) 50%, transparent 65%, transparent 100%)";
                return (
                    <Box
                        // `react-beautiful-dnd`'s `innerRef` is a callback
                        // ref — fan it out to ours so the dnd machinery
                        // still gets the node while we keep a handle for
                        // `scrollIntoView` above.
                        ref={(el: HTMLDivElement | null) => {
                            provided.innerRef(el);
                            rowRef.current = el;
                        }}
                        {...provided.draggableProps}
                        // Hooks for the generated family-focus stylesheet
                        // (see `familyFocusCss.ts`). The class makes this row
                        // both a `:hover` probe and a dim target; the family
                        // attribute is what the rules match on. `selected` is
                        // published so the dim rules can exempt the row whose
                        // preview pane is open.
                        className={TASK_ROW_CLASS}
                        data-task-family={familyKey}
                        data-task-selected={isSelected ? "true" : undefined}
                        // Base layout/colors come from the helper.
                        // `provided.draggableProps.style` carries dnd's
                        // transform / transition during drag and must
                        // win over our defaults — same merge order as
                        // before.
                        style={{
                            ...getTableRowStyles(snapshot.isDragging, isSelected, mode, depth),
                            ...provided.draggableProps.style,
                        }}
                        // Hover lives entirely in CSS so toggling the
                        // cursor over a row no longer triggers a React
                        // re-render of the row + every cell + the
                        // assignee `<UserAvatar>` subtree.
                        sx={{
                            position: "relative",
                            transition: "transform 150ms ease, opacity 150ms ease",
                            // Ghost (Member-filter ancestor) rows are dimmed and
                            // inert: no clicks reach the cells (preview / inline
                            // edit), and the drag handle is already disabled via
                            // `isDragDisabled`. They exist only to keep the
                            // matching subtask's dependency chain legible.
                            ...(isGhost && {
                                opacity: 0.4,
                                pointerEvents: "none",
                            }),
                            ...(isCombineTarget && {
                                zIndex: 2,
                                animation: "combineTargetPulse 1.1s ease-in-out infinite",
                                "@keyframes combineTargetPulse": {
                                    "0%, 100%": {
                                        backgroundColor: pulseBgLow,
                                        boxShadow: pulseShadowLow,
                                    },
                                    "50%": {
                                        backgroundColor: pulseBgHigh,
                                        boxShadow: pulseShadowHigh,
                                    },
                                },
                                // Shimmer sweep — a soft accent stripe
                                // slides left → right across the row to
                                // reinforce "this is the live drop zone".
                                "&::after": {
                                    content: '""',
                                    position: "absolute",
                                    inset: 0,
                                    background: shimmerGradient,
                                    backgroundSize: "200% 100%",
                                    pointerEvents: "none",
                                    animation: "combineTargetSweep 1.6s linear infinite",
                                    zIndex: 1,
                                },
                                "@keyframes combineTargetSweep": {
                                    "0%": { backgroundPosition: "200% 0" },
                                    "100%": { backgroundPosition: "-100% 0" },
                                },
                            }),
                            ...(isCombineSource && {
                                opacity: 0.55,
                                transform: "scale(0.97)",
                            }),
                            "&:hover":
                                showHoverBg && !isCombineTarget
                                    ? { backgroundColor: hoverBg }
                                    : {},
                            "&:hover .task-row-drag-handle": {
                                opacity: snapshot.isDragging ? 1 : 0.8,
                            },
                            "&:hover .task-row-quick-add": {
                                opacity: snapshot.isDragging ? 0 : 0.8,
                            },
                            "&:hover .task-row-open-diagram": {
                                opacity: snapshot.isDragging ? 0 : 0.8,
                            },
                        }}
                        onDoubleClick={() => {
                            // Single debounced path for both task and
                            // milestone rows — the parent's
                            // onRequestPreview owns the routing.
                            openPreview();
                        }}
                    >
                        {/* Floating hint that pops in when this row will
                            absorb the dragged task — anchors to the row
                            via `position: relative` on the Box above. */}
                        {isCombineTarget && (
                            <Box
                                sx={{
                                    position: "absolute",
                                    top: "50%",
                                    right: 12,
                                    px: 1.25,
                                    py: 0.4,
                                    borderRadius: "8px",
                                    background: `linear-gradient(135deg, ${accent} 0%, ${accentHot} 100%)`,
                                    color: "#fff",
                                    fontSize: "0.7rem",
                                    fontWeight: 700,
                                    letterSpacing: "0.04em",
                                    textTransform: "uppercase",
                                    pointerEvents: "none",
                                    zIndex: 4,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    animation:
                                        "dropToNestPop 180ms ease-out, dropToNestBreathe 1.1s ease-in-out 180ms infinite",
                                    "@keyframes dropToNestPop": {
                                        from: {
                                            opacity: 0,
                                            transform: "translateY(-50%) scale(0.8)",
                                        },
                                        to: {
                                            opacity: 1,
                                            transform: "translateY(-50%) scale(1)",
                                        },
                                    },
                                    "@keyframes dropToNestBreathe": {
                                        "0%, 100%": {
                                            transform: "translateY(-50%) scale(1)",
                                            boxShadow: `0 4px 10px rgba(0,0,0,0.2), 0 0 0 0 rgba(${accentHotRgb}, 0.333)`,
                                        },
                                        "50%": {
                                            transform: "translateY(-50%) scale(1.06)",
                                            boxShadow: `0 6px 16px rgba(0,0,0,0.28), 0 0 0 6px rgba(${accentHotRgb}, 0.0)`,
                                        },
                                    },
                                }}
                            >
                                {t.tasks.table.dropToNest}
                            </Box>
                        )}
                        {/* Leading gutter: drag handle + hover "+" quick-add.
                            Fixed LEADING_GUTTER_WIDTH keeps cells aligned with
                            the header and the QuickAddTaskRow draft row. */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                width: LEADING_GUTTER_WIDTH,
                                minWidth: LEADING_GUTTER_WIDTH,
                            }}
                        >
                            <AppTooltip title={t.tasks.table.dragToReorder}>
                                <div
                                    {...provided.dragHandleProps}
                                    className="task-row-drag-handle"
                                    style={getDragHandleStyles(snapshot.isDragging, mode)}
                                >
                                    <DragIndicatorIcon sx={{ fontSize: 20 }} />
                                </div>
                            </AppTooltip>
                            {/* Open the task graph anchored on this row.
                                Root tasks / milestones only: a sub-task's
                                graph is reachable from its root, and the
                                icon on every nested row would just be
                                gutter noise. Same hover-reveal CSS as the
                                quick-add "+" (zero-re-render pattern). */}
                            {!isChild && (
                                <AppTooltip title={t.tasks.tooltips.openTaskGraph}>
                                    <IconButton
                                        className="task-row-open-diagram"
                                        size="small"
                                        sx={{
                                            width: 20,
                                            height: 20,
                                            p: 0,
                                            borderRadius: "4px",
                                            opacity: 0,
                                            color:
                                                mode === "dark"
                                                    ? "var(--gp-brandalt-400)"
                                                    : "var(--gp-brand-700)",
                                            transition: "opacity 0.2s ease",
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenDiagram(task);
                                        }}
                                    >
                                        <AccountTreeRoundedIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                </AppTooltip>
                            )}
                            <AppTooltip title={t.tasks.table.quickAddTooltip}>
                                <IconButton
                                    className="task-row-quick-add"
                                    size="small"
                                    sx={{
                                        width: 20,
                                        height: 20,
                                        p: 0,
                                        borderRadius: "4px",
                                        // Hidden until the row is hovered — see the
                                        // `&:hover .task-row-quick-add` rule in the
                                        // wrapper Box's sx (same zero-re-render CSS
                                        // pattern as the drag handle).
                                        opacity: 0,
                                        color:
                                            mode === "dark"
                                                ? "var(--gp-brandalt-400)"
                                                : "var(--gp-brand-700)",
                                        transition: "opacity 0.2s ease",
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onQuickAddChild(task);
                                    }}
                                >
                                    <AddRoundedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            </AppTooltip>
                        </div>

                        {/* Table Cells */}
                        {/* `columns` is already filtered for visibility
                            by the parent (DraggableTaskTable's
                            `visibleColumns` honors user overrides on top
                            of the column's `hidden` default). Re-applying
                            `!col.hidden` here would silently strip
                            user-enabled columns whose default is hidden
                            (e.g. the PR column after the user opts in)
                            and produce a header/row column mismatch. */}
                        {columns.map((column, idx) => (
                            <div
                                key={column.field}
                                style={{
                                    ...getTableCellStyles(column.width, column.align, mode),
                                    borderRight:
                                        idx === columns.length - 1
                                            ? "none"
                                            : mode === "dark"
                                              ? "1px solid rgba(255, 255, 255, 0.04)"
                                              : "1px solid rgba(0, 0, 0, 0.04)",
                                }}
                            >
                                {renderCellContent(column)}
                            </div>
                        ))}
                    </Box>
                );
            }}
        </Draggable>
    );
};

// Memoized export. The comparator covers every prop that affects this
// row's visible output. State-manager objects (`useTM`, `useTEM`, `useCM`,
// `useUISM`) and callbacks (`onRowUpdate`, `onRequestPreview`,
// `toggleExpand`, `setMyself`, `onQuickAddChild`) are intentionally
// excluded — they're recreated on every parent render but only their
// stable setter methods are invoked from this component's handlers,
// never read at render time. `onQuickAddChild` in particular must stay
// identity-stable in the parent (`useCallback([])` + functional
// setState) since a memo-skipped render would otherwise keep invoking a
// stale closure.
//
// Every remaining prop is either per-row (so a change genuinely concerns
// THIS row) or identity-stable across a preview switch. That is the whole
// point: opening a task must not re-render rows it doesn't touch.
//
// Two props exist purely to keep that property, and must NOT be replaced
// by the shared structures they're derived from:
//
//  * `isSelected` — previously the row compared the global
//    `useTM.currentPreview{TaskId,MilestoneId,Kind}` + `isTaskPreviewVisible`
//    and the parent's `pendingTaskId` / `pendingMilestoneId`. All six change
//    on every preview switch, so every row failed equality and re-rendered.
//    A single click flips them several times (pending set → debounced real
//    setter → pending clear), so an N-row table paid N full row renders
//    three times over per click.
//
//  * `hasChildren` — previously the `childrenByParent` Map, compared by
//    reference. It is rebuilt whenever `useTM.allTasks` identity changes,
//    and opening a task changes that identity (see the preview→row mirror
//    in useTaskManagement), so this alone re-rendered every row per click
//    even when the selection comparison was satisfied.
//
// `task` is compared by reference: useTaskManagement replaces a task via
// `next[existingIdx] = nextRow` with a fresh object, so any real content
// change produces a new reference. `columnsWithWidths` is memoized in
// DraggableTaskTable for the same reason.
// Exported for direct unit testing — see TaskRowSelectionMemo.test.ts.
// The row is far too heavy to assert this invariant by rendering N of
// them, and the comparator IS the invariant.
export const draggableTaskRowPropsAreEqual = (
    prev: DraggableTaskRowProps,
    next: DraggableTaskRowProps
): boolean =>
    prev.task === next.task &&
    prev.index === next.index &&
    prev.columns === next.columns &&
    prev.mode === next.mode &&
    prev.depth === next.depth &&
    prev.myself.userId === next.myself.userId &&
    prev.teamMembers === next.teamMembers &&
    prev.expandedRows === next.expandedRows &&
    prev.hasChildren === next.hasChildren &&
    prev.sprintNamesById === next.sprintNamesById &&
    prev.isSelected === next.isSelected &&
    prev.projectTags === next.projectTags &&
    prev.customFieldDefs === next.customFieldDefs &&
    (prev.isGhost ?? false) === (next.isGhost ?? false) &&
    // A reparent (drag-to-nest) moves a row to a different root, so its
    // family attribute must be re-rendered or the hover dimming would keep
    // grouping it with its previous root.
    prev.familyKey === next.familyKey;

export const DraggableTaskRow = memo(DraggableTaskRowImpl, draggableTaskRowPropsAreEqual);
