import { memo, useEffect, useRef, useState } from "react";
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
import { Draggable } from "@hello-pangea/dnd";
import { Socket } from "socket.io-client";

import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { PulseDot } from "../../../../components/ui/misc/PulseDot";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { TaskTableProps } from "../../../../types/tasks";
import { effortLevels, priorities } from "../../utils/taskMeta";
import { ColumnDef, statusOptions } from "./DraggableTaskTable";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

// Depth-based background colors for nested task rows
const DEPTH_COLORS_DARK = [
    "transparent",
    "rgba(56, 189, 248, 0.08)",
    "rgba(45, 212, 191, 0.09)",
    "rgba(251, 191, 36, 0.08)",
];
const DEPTH_COLORS_LIGHT = [
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
const DEPTH_BORDER_COLORS = ["transparent", "#38bdf8", "#2dd4bf", "#fbbf24"];

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
            return mode === "dark" ? "#2e1065" : "#f3e8ff";
        }
        if (isSelected) {
            return mode === "dark" ? "rgba(124,58,237,0.15)" : "rgba(124,58,237,0.08)";
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
                ? "3px solid #a78bfa"
                : "3px solid #7c3aed"
            : rowDepth > 0
              ? `3px solid ${DEPTH_BORDER_COLORS[depthIdx]}`
              : "3px solid transparent",
        boxShadow: isDragging
            ? mode === "dark"
                ? "0 8px 24px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3)"
                : "0 8px 24px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1)"
            : isSelected
              ? mode === "dark"
                  ? "inset 0 0 0 1px rgba(167,139,250,0.2)"
                  : "inset 0 0 0 1px rgba(124,58,237,0.1)"
              : "none",
        borderRadius: isDragging ? 6 : 0,
        // Don't use transitions when dragging - it interferes with drag positioning
        transition: isDragging
            ? "none"
            : "background-color 0.15s ease, box-shadow 0.15s ease, border-left 0.15s ease",
    };
};

const getTableCellStyles = (
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
            ? "#a78bfa"
            : "#7c3aed"
        : mode === "dark"
          ? "#888"
          : "#666",
    transition: "opacity 0.2s ease, color 0.2s ease, transform 0.15s ease",
    transform: isDragging ? "scale(1.1)" : "scale(1)",
    borderRadius: 4,
    backgroundColor: isDragging
        ? mode === "dark"
            ? "rgba(167,139,250,0.15)"
            : "rgba(124,58,237,0.1)"
        : "transparent",
});

type DraggableTaskRowProps = {
    task: TaskTableProps;
    index: number;
    columns: ColumnDef[];
    mode: "light" | "dark" | undefined;
    myself: UserProps;
    teamMembers: UserProps[];
    onRowUpdate: (task: TaskTableProps) => Promise<TaskTableProps>;
    onRowDoubleClick: (taskId: number) => void;
    useTM: TaskManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    socket: Socket | null;
    setMyself: (value: UserProps) => void;
    expandedRows: Set<string>;
    toggleExpand: (id: string) => void;
    childrenByParent: Map<string, TaskTableProps[]>;
    depth: number;
    // sprintId → sprint name lookup for the "Sprint" column. The column
    // is conditionally surfaced by DraggableTaskTable when a milestone
    // is in view; the row falls back to "Sprint #<id>" if a row carries
    // a sprintId we haven't loaded yet.
    sprintNamesById?: Map<number, string>;
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
        onRowDoubleClick,
        useTM,
        useTEM,
        useCM,
        useUISM,
        socket,
        setMyself,
        expandedRows,
        toggleExpand,
        childrenByParent,
        depth,
        sprintNamesById,
    } = props;

    const { t } = useTranslation();
    const isChild = depth > 0;
    const taskIdStr = String(task.id);
    const hasChildren = childrenByParent.has(taskIdStr);
    const isExpanded = expandedRows.has(taskIdStr);

    // Row DOM ref so we can pull the selected row into view when the
    // preview pane swings open from somewhere other than the row's
    // own click (sidebar / deep-link / keyboard nav). `scrollIntoView`
    // with `block: "nearest"` is a no-op when the row is already in
    // the viewport, so we don't churn scroll position on the click
    // path that's already centered.
    const rowRef = useRef<HTMLDivElement | null>(null);

    // Check if this row is the currently selected/previewed task.
    // Milestone rows are selected when the milestone preview is open
    // for this task's milestoneId.
    const isMilestoneRow = task.isMilestone === true;
    const isSelected = isMilestoneRow
        ? useTM.isTaskPreviewVisible &&
          useTM.currentPreviewKind === "milestone" &&
          useTM.currentPreviewMilestoneId === task.milestoneId
        : useTM.isTaskPreviewVisible && useTM.currentPreviewTaskId === Number(task.id);

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

    // Centralized click handler for opening either a task or a
    // milestone preview, keeping the bug-fix invariants from
    // useTaskManagement (mutual exclusivity of preview kinds).
    const openPreview = () => {
        useTM.setIsTaskPreviewVisible(true);
        if (isMilestoneRow && task.milestoneId != null) {
            useTM.setCurrentPreviewKind("milestone");
            useTM.setCurrentPreviewMilestoneId(task.milestoneId);
        } else {
            useTM.setCurrentPreviewKind("task");
            useTM.setCurrentPreviewTaskId(Number(task.id));
        }
    };

    // Edit states for different fields
    const [editingField, setEditingField] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>("");

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
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(taskIdStr);
                        }}
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
                        onClick={(e) => {
                            e.stopPropagation();
                            openPreview();
                        }}
                        sx={{
                            color: isMilestoneRow
                                ? "#f97316"
                                : mode === "dark"
                                  ? "#a78bfa"
                                  : "#7c3aed",
                            fontWeight: 600,
                            "&:hover": {
                                backgroundColor: isMilestoneRow
                                    ? "rgba(249, 115, 22, 0.12)"
                                    : mode === "dark"
                                      ? "rgba(167,139,250,0.15)"
                                      : "rgba(124,58,237,0.1)",
                            },
                        }}
                    >
                        <Typography
                            fontSize="13px"
                            sx={{
                                fontWeight: 600,
                                color: isMilestoneRow
                                    ? "#f97316"
                                    : mode === "dark"
                                      ? "#a78bfa"
                                      : "#7c3aed",
                            }}
                        >
                            #{task.id}
                        </Typography>
                        <OpenInNewIcon sx={{ ml: 0.5, fontSize: 14 }} />
                    </IconButton>
                );

            case "status":
                const statusOption = statusOptions.find((opt) => opt.value === value);
                if (editingField === "status") {
                    return (
                        <Select
                            value={(value as string) || ""}
                            size="small"
                            open={true}
                            onClose={handleCancelEdit}
                            onChange={(e: SelectChangeEvent) => {
                                handleSelectChange("status", e.target.value);
                                handleCancelEdit();
                            }}
                            renderValue={(selected) => {
                                const opt = statusOptions.find((o) => o.value === selected);
                                return opt ? (
                                    <Chip
                                        icon={opt.icon}
                                        label={opt.label}
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
                                    borderColor: mode === "dark" ? "#a78bfa" : "#7c3aed",
                                },
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
                                        label={opt.label}
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
                        label={statusOption.label}
                        size="small"
                        onClick={() => handleStartEdit("status", value as string)}
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
                    />
                ) : null;

            case "tags":
                const tags = task.tags || [];
                return (
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        {[...tags]
                            .sort((a, b) => (a.tagName || "").localeCompare(b.tagName || ""))
                            .map((tag, idx) => (
                                <Chip
                                    key={idx}
                                    label={tag.tagName}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                        color: mode === "dark" ? "white" : "black",
                                        fontWeight: 600,
                                        borderRadius: "6px",
                                        borderWidth: "2px",
                                        borderColor: alpha(
                                            tag.tagColor,
                                            mode === "dark" ? 0.6 : 0.8
                                        ),
                                        fontSize: "0.7rem",
                                        backgroundColor: alpha(
                                            tag.tagColor,
                                            mode === "dark" ? 0.1 : 0.05
                                        ),
                                    }}
                                />
                            ))}
                    </Box>
                );

            case "title":
                if (editingField === "title") {
                    return (
                        <TextField
                            value={editValue}
                            size="small"
                            autoFocus
                            fullWidth
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleSaveEdit("title")}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveEdit("title");
                                if (e.key === "Escape") handleCancelEdit();
                            }}
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
                        />
                    );
                }
                return (
                    <Box
                        onClick={() => handleStartEdit("title", task.title || "")}
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
                                      ? "#a78bfa"
                                      : "#7c3aed",
                            },
                        }}
                    >
                        {isMilestoneRow && (
                            <FlagRoundedIcon
                                sx={{ fontSize: 14, color: "#f97316", flexShrink: 0 }}
                            />
                        )}
                        <Typography
                            level="body-sm"
                            className="task-row-title"
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
                            open={true}
                            size="small"
                            fullWidth
                            options={teamMembers}
                            value={currentAssignee || null}
                            getOptionLabel={(option) => `${option.userName} ${option.userEmail}`}
                            isOptionEqualToValue={(option, value) =>
                                option.userId === value?.userId
                            }
                            clearOnBlur={false}
                            blurOnSelect={true}
                            filterOptions={(options, { inputValue }) => {
                                const searchTerm = inputValue.toLowerCase();
                                return options.filter(
                                    (option) =>
                                        option.userName.toLowerCase().includes(searchTerm) ||
                                        option.userEmail.toLowerCase().includes(searchTerm)
                                );
                            }}
                            onClose={(_, reason) => {
                                // Only close when clicking outside or pressing escape
                                // Don't close when clearing the input
                                if (reason === "blur" || reason === "escape") {
                                    handleCancelEdit();
                                }
                            }}
                            onChange={(_, newValue) => {
                                if (newValue) {
                                    handleSelectChange("assigneeId", newValue.userId);
                                    handleCancelEdit();
                                }
                                // Don't close when clearing - let user continue typing
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
                            renderOption={(props, option) => {
                                const isSelected = option.userId === task.assigneeId;
                                const { key, ...restProps } = props;
                                return (
                                    <Box
                                        component="li"
                                        key={key}
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
                                                    ? "rgba(167,139,250,0.15)"
                                                    : "rgba(124,58,237,0.08)"
                                                : "transparent",
                                            "&:hover": {
                                                backgroundColor:
                                                    mode === "dark"
                                                        ? "rgba(167,139,250,0.2)"
                                                        : "rgba(124,58,237,0.12)",
                                            },
                                            display: "flex",
                                            gap: 1.5,
                                            alignItems: "center",
                                            cursor: "pointer",
                                        }}
                                    >
                                        <UserAvatar userId={option.userId} clickable={false} />
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography
                                                level="body-sm"
                                                sx={{
                                                    fontWeight: isSelected ? 600 : 500,
                                                    color: mode === "dark" ? "#e8e8e8" : "#1a1a1a",
                                                    lineHeight: 1.3,
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
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    autoFocus
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
                                                    mode === "dark" ? "#a78bfa" : "#7c3aed",
                                            },
                                            "&.Mui-focused fieldset": {
                                                borderColor:
                                                    mode === "dark" ? "#a78bfa" : "#7c3aed",
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
                                />
                            )}
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
                            {task.assigneeId && <UserAvatar userId={task.assigneeId} />}
                            {task.assigneeId === null && (
                                <Avatar size="sm" src={`${media_url}/${myself.avatarImgPath}`}>
                                    {myself.userName[0].toUpperCase()}
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
                                }}
                            >
                                {task.assigneeName}
                            </Typography>
                        </Box>
                    </Box>
                );

            case "priority":
                const priorityOption = priorities.find((p) => p.priority === value);
                if (editingField === "priority") {
                    return (
                        <Select
                            value={(value as string) || ""}
                            size="small"
                            open={true}
                            onClose={handleCancelEdit}
                            onChange={(e: SelectChangeEvent) => {
                                handleSelectChange("priority", e.target.value);
                                handleCancelEdit();
                            }}
                            renderValue={(selected) => {
                                const opt = priorities.find((p) => p.priority === selected);
                                return opt ? (
                                    <Chip
                                        label={opt.priority}
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
                                    borderColor: mode === "dark" ? "#a78bfa" : "#7c3aed",
                                },
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
                                        label={opt.priority}
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
                        label={priorityOption.priority}
                        size="small"
                        onClick={() => handleStartEdit("priority", value as string)}
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
                    />
                ) : null;

            case "effortLevel":
                const effortOption = effortLevels.find((e) => e.level === value);
                if (editingField === "effortLevel") {
                    return (
                        <Select
                            value={(value as string) || ""}
                            size="small"
                            open={true}
                            onClose={handleCancelEdit}
                            onChange={(e: SelectChangeEvent) => {
                                handleSelectChange("effortLevel", e.target.value);
                                handleCancelEdit();
                            }}
                            renderValue={(selected) => {
                                const opt = effortLevels.find((e) => e.level === selected);
                                return opt ? (
                                    <Chip
                                        label={opt.level}
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
                                    borderColor: mode === "dark" ? "#a78bfa" : "#7c3aed",
                                },
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
                                        label={opt.level}
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
                        label={effortOption.level}
                        size="small"
                        onClick={() => handleStartEdit("effortLevel", value as string)}
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
                    />
                ) : null;

            case "daysLeft":
                // A task with no due date can't be "expired" — guard the
                // chip on `dueDate` so a stale `daysLeft === -1` left
                // behind by an earlier expired-state row (e.g. user just
                // toggled the due date to TBD and the IDB write hasn't
                // refreshed yet) doesn't mislabel an unscheduled task.
                if (!task.dueDate) {
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
                return task.daysLeft === -1 ? (
                    <Chip
                        label="Expired"
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
                                (task.daysLeft ?? 0) <= 3
                                    ? "#f44336"
                                    : (task.daysLeft ?? 0) <= 7
                                      ? "#ff9800"
                                      : mode === "dark"
                                        ? "#e0e0e0"
                                        : "#333",
                        }}
                    >
                        {task.daysLeft}
                    </Typography>
                );

            case "dueDate":
                if (editingField === "dueDate") {
                    return (
                        <input
                            type="date"
                            value={editValue}
                            autoFocus
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleSaveEdit("dueDate")}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveEdit("dueDate");
                                if (e.key === "Escape") handleCancelEdit();
                            }}
                            style={{
                                width: "100%",
                                padding: "6px 10px",
                                fontSize: "0.875rem",
                                border: `1px solid ${mode === "dark" ? "#555" : "#ccc"}`,
                                borderRadius: "6px",
                                backgroundColor: mode === "dark" ? "#1e1e1e" : "#fff",
                                color: mode === "dark" ? "#e0e0e0" : "#333",
                            }}
                        />
                    );
                }
                return (
                    <Typography
                        level="body-sm"
                        onClick={() =>
                            handleStartEdit(
                                "dueDate",
                                task.dueDate ? dayjs(task.dueDate).format("YYYY-MM-DD") : ""
                            )
                        }
                        sx={{
                            cursor: "pointer",
                            fontWeight: 500,
                            "&:hover": {
                                color: mode === "dark" ? "#a78bfa" : "#7c3aed",
                            },
                        }}
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
                    <Chip
                        label={name}
                        size="small"
                        title={name}
                        sx={{
                            maxWidth: "100%",
                            backgroundColor:
                                mode === "dark" ? alpha("#a78bfa", 0.18) : alpha("#7c3aed", 0.1),
                            color: mode === "dark" ? "#c4b5fd" : "#5b21b6",
                            fontWeight: 600,
                            fontSize: "0.72rem",
                            borderRadius: "6px",
                            border: `1px solid ${
                                mode === "dark" ? alpha("#a78bfa", 0.32) : alpha("#7c3aed", 0.22)
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

            default:
                return <Typography level="body-sm">{String(value || "-")}</Typography>;
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
            isDragDisabled={task.isMilestone === true}
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
                const accent = isDark ? "#a78bfa" : "#7c3aed";
                const accentHot = isDark ? "#c4b5fd" : "#a855f7";
                const pulseBgLow = isDark ? "rgba(167,139,250,0.08)" : "rgba(124,58,237,0.05)";
                const pulseBgHigh = isDark ? "rgba(167,139,250,0.22)" : "rgba(124,58,237,0.16)";
                const pulseShadowLow = isDark
                    ? "inset 0 0 0 2px rgba(167,139,250,0.6), 0 0 8px rgba(167,139,250,0.25)"
                    : "inset 0 0 0 2px rgba(124,58,237,0.55), 0 0 6px rgba(124,58,237,0.2)";
                const pulseShadowHigh = isDark
                    ? "inset 0 0 0 2px #c4b5fd, 0 0 26px rgba(167,139,250,0.65), 0 0 12px rgba(196,181,253,0.5)"
                    : "inset 0 0 0 2px #a855f7, 0 0 22px rgba(124,58,237,0.55), 0 0 10px rgba(168,85,247,0.45)";
                const shimmerGradient = isDark
                    ? "linear-gradient(90deg, transparent 0%, transparent 35%, rgba(196,181,253,0.35) 50%, transparent 65%, transparent 100%)"
                    : "linear-gradient(90deg, transparent 0%, transparent 35%, rgba(168,85,247,0.28) 50%, transparent 65%, transparent 100%)";
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
                        }}
                        onDoubleClick={() => {
                            // Milestone rows always go through the milestone
                            // preview path; regular tasks fall through to
                            // the table-level handler.
                            if (isMilestoneRow) {
                                openPreview();
                            } else {
                                onRowDoubleClick(Number(task.id));
                            }
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
                                            boxShadow: `0 4px 10px rgba(0,0,0,0.2), 0 0 0 0 ${accentHot}55`,
                                        },
                                        "50%": {
                                            transform: "translateY(-50%) scale(1.06)",
                                            boxShadow: `0 6px 16px rgba(0,0,0,0.28), 0 0 0 6px ${accentHot}00`,
                                        },
                                    },
                                }}
                            >
                                {t.tasks.table.dropToNest}
                            </Box>
                        )}
                        {/* Drag Handle */}
                        <div
                            {...provided.dragHandleProps}
                            className="task-row-drag-handle"
                            style={getDragHandleStyles(snapshot.isDragging, mode)}
                            title={t.tasks.table.dragToReorder}
                        >
                            <DragIndicatorIcon sx={{ fontSize: 20 }} />
                        </div>

                        {/* Table Cells */}
                        {columns
                            .filter((col) => !col.hidden)
                            .map((column, idx) => (
                                <div
                                    key={column.field}
                                    style={{
                                        ...getTableCellStyles(column.width, column.align, mode),
                                        borderRight:
                                            idx === columns.filter((c) => !c.hidden).length - 1
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
// `useUISM`) and callbacks (`onRowUpdate`, `onRowDoubleClick`,
// `toggleExpand`, `setMyself`) are intentionally excluded — they're
// recreated on every parent render but only their stable setter methods
// are invoked from this component's handlers, never read at render time.
//
// The four useTM fields that DO affect rendering — they drive the
// "this row is selected" highlight — are compared explicitly so the row
// re-renders when the preview pane opens/closes against a different
// task/milestone.
//
// `task` is compared by reference: useTaskManagement replaces a task via
// `next[existingIdx] = nextRow` with a fresh object, so any real content
// change produces a new reference. `columnsWithWidths` is memoized in
// DraggableTaskTable for the same reason.
const areEqual = (prev: DraggableTaskRowProps, next: DraggableTaskRowProps): boolean =>
    prev.task === next.task &&
    prev.index === next.index &&
    prev.columns === next.columns &&
    prev.mode === next.mode &&
    prev.depth === next.depth &&
    prev.myself.userId === next.myself.userId &&
    prev.teamMembers === next.teamMembers &&
    prev.expandedRows === next.expandedRows &&
    prev.childrenByParent === next.childrenByParent &&
    prev.sprintNamesById === next.sprintNamesById &&
    prev.useTM.isTaskPreviewVisible === next.useTM.isTaskPreviewVisible &&
    prev.useTM.currentPreviewKind === next.useTM.currentPreviewKind &&
    prev.useTM.currentPreviewTaskId === next.useTM.currentPreviewTaskId &&
    prev.useTM.currentPreviewMilestoneId === next.useTM.currentPreviewMilestoneId;

export const DraggableTaskRow = memo(DraggableTaskRowImpl, areEqual);
