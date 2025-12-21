import { useState } from "react";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PendingIcon from "@mui/icons-material/Pending";
import { Avatar, Box, Typography } from "@mui/joy";
import { Chip, IconButton, MenuItem, Select, SelectChangeEvent, TextField } from "@mui/material";
import { alpha } from "@mui/system";
import dayjs from "dayjs";
import { Draggable } from "react-beautiful-dnd";

import { PulseDot } from "../../../../components/ui/misc/PulseDot";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { TaskTableProps } from "../../../../types/tasks";
import { effortLevels, priorities } from "../../utils/taskMeta";
import { ColumnDef, statusOptions } from "./DraggableTaskTable";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

// Style helpers
// NOTE: Do NOT apply transform here - react-beautiful-dnd manages transforms for positioning
const getTableRowStyles = (
    isDragging: boolean,
    isHovered: boolean,
    mode: "light" | "dark" | undefined
): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    minHeight: 36,
    borderBottom: isDragging
        ? "none"
        : mode === "dark"
          ? "1px solid rgba(255, 255, 255, 0.08)"
          : "1px solid rgba(0, 0, 0, 0.08)",
    backgroundColor: isDragging
        ? mode === "dark"
            ? "#1e3a5f"
            : "#e3f2fd"
        : isHovered
          ? mode === "dark"
              ? "rgba(255, 255, 255, 0.04)"
              : "rgba(0, 0, 0, 0.02)"
          : "transparent",
    boxShadow: isDragging
        ? mode === "dark"
            ? "0 8px 24px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3)"
            : "0 8px 24px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1)"
        : "none",
    borderRadius: isDragging ? 6 : 0,
    // Don't use transitions when dragging - it interferes with drag positioning
    transition: isDragging ? "none" : "background-color 0.15s ease, box-shadow 0.15s ease",
});

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
    isHovered: boolean,
    mode: "light" | "dark" | undefined
): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    minWidth: 28,
    height: 32,
    cursor: isDragging ? "grabbing" : "grab",
    opacity: isDragging ? 1 : isHovered ? 0.8 : 0.3,
    color: isDragging
        ? mode === "dark"
            ? "#90caf9"
            : "#1976d2"
        : mode === "dark"
          ? "#888"
          : "#666",
    transition: "opacity 0.2s ease, color 0.2s ease, transform 0.15s ease",
    transform: isDragging ? "scale(1.1)" : "scale(1)",
    borderRadius: 4,
    backgroundColor: isDragging
        ? mode === "dark"
            ? "rgba(144, 202, 249, 0.15)"
            : "rgba(25, 118, 210, 0.1)"
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
};

export const DraggableTaskRow = (props: DraggableTaskRowProps) => {
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
    } = props;

    // Hover state for better UX
    const [isHovered, setIsHovered] = useState(false);

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
            case "id":
                return (
                    <IconButton
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            useTM.setIsTaskPreviewVisible(true);
                            useTM.setCurrentPreviewTaskId(Number(task.id));
                        }}
                        sx={{
                            color: mode === "dark" ? "#90caf9" : "#1976d2",
                            fontWeight: 600,
                            "&:hover": {
                                backgroundColor:
                                    mode === "dark"
                                        ? "rgba(144, 202, 249, 0.15)"
                                        : "rgba(25, 118, 210, 0.1)",
                            },
                        }}
                    >
                        <Typography
                            fontSize="13px"
                            sx={{
                                fontWeight: 600,
                                color: mode === "dark" ? "#90caf9" : "#1976d2",
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
                            autoFocus
                            onClose={handleCancelEdit}
                            onChange={(e: SelectChangeEvent) => {
                                handleSelectChange("status", e.target.value);
                                handleCancelEdit();
                            }}
                            sx={{ minWidth: 90 }}
                        >
                            {statusOptions.map((opt) => (
                                <MenuItem key={opt.value} value={opt.value}>
                                    <Chip
                                        icon={opt.icon}
                                        label={opt.label}
                                        size="small"
                                        sx={{
                                            backgroundColor: alpha(opt.color, 0.75),
                                            color: opt.textColor,
                                            fontWeight: "bold",
                                            borderRadius: "5px",
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
                        {tags.map((tag, idx) => (
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
                                    borderColor: alpha(tag.tagColor, mode === "dark" ? 0.6 : 0.8),
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
                            }}
                        />
                    );
                }
                return (
                    <Typography
                        level="body-sm"
                        onClick={() => handleStartEdit("title", task.title || "")}
                        sx={{
                            cursor: "pointer",
                            fontWeight: 500,
                            "&:hover": {
                                color: mode === "dark" ? "#90caf9" : "#1976d2",
                            },
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            width: "100%",
                            transition: "color 0.15s ease",
                        }}
                    >
                        {task.title}
                    </Typography>
                );

            case "assigneeId":
                if (editingField === "assigneeId") {
                    return (
                        <Select
                            value={task.assigneeId || ""}
                            size="small"
                            autoFocus
                            fullWidth
                            onClose={handleCancelEdit}
                            onChange={(e: SelectChangeEvent) => {
                                handleSelectChange("assigneeId", e.target.value);
                                handleCancelEdit();
                            }}
                        >
                            {teamMembers.map((member) => (
                                <MenuItem key={member.userId} value={member.userId}>
                                    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                                        <Avatar
                                            size="sm"
                                            src={`${media_url}/${member.avatarImgPath}`}
                                        >
                                            {member.userName[0].toUpperCase()}
                                        </Avatar>
                                        <Typography level="body-xs">{member.userName}</Typography>
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
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
                            <Avatar
                                size="sm"
                                src={
                                    task.assigneeId === myself.userId
                                        ? `${media_url}/${myself.avatarImgPath}`
                                        : `${media_url}/${task.assigneeImgPath}`
                                }
                            >
                                {task.assigneeName?.[0]?.toUpperCase() || "?"}
                            </Avatar>
                            <Box
                                sx={{
                                    position: "absolute",
                                    bottom: 0,
                                    right: 0,
                                }}
                            >
                                <PulseDot
                                    color={
                                        myself.userId === task.assigneeId
                                            ? myself?.isOfflineForced !== "true"
                                                ? "#4caf50"
                                                : "#999"
                                            : "#999"
                                    }
                                />
                            </Box>
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
                                {task.assigneeName} | {task.assigneeEmail}
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
                            autoFocus
                            onClose={handleCancelEdit}
                            onChange={(e: SelectChangeEvent) => {
                                handleSelectChange("priority", e.target.value);
                                handleCancelEdit();
                            }}
                            sx={{ minWidth: 80 }}
                        >
                            {priorities.map((opt) => (
                                <MenuItem key={opt.priority || ""} value={opt.priority || ""}>
                                    <Chip
                                        label={opt.priority}
                                        size="small"
                                        sx={{
                                            backgroundColor: alpha(opt.color || "#888", 0.75),
                                            color: opt.textColor,
                                            fontWeight: "bold",
                                            borderRadius: "5px",
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
                            autoFocus
                            onClose={handleCancelEdit}
                            onChange={(e: SelectChangeEvent) => {
                                handleSelectChange("effortLevel", e.target.value);
                                handleCancelEdit();
                            }}
                            sx={{ minWidth: 80 }}
                        >
                            {effortLevels.map((opt) => (
                                <MenuItem key={opt.level || ""} value={opt.level || ""}>
                                    <Chip
                                        label={opt.level}
                                        size="small"
                                        sx={{
                                            backgroundColor: alpha(opt.color || "#888", 0.75),
                                            color: opt.textColor,
                                            fontWeight: "bold",
                                            borderRadius: "5px",
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
                                color: mode === "dark" ? "#90caf9" : "#1976d2",
                            },
                        }}
                    >
                        {task.dueDate ? dayjs(task.dueDate).format("YYYY-MM-DD") : "-"}
                    </Typography>
                );

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

    return (
        <Draggable draggableId={String(task.id)} index={index} isDragDisabled={false}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    style={{
                        ...getTableRowStyles(snapshot.isDragging, isHovered, mode),
                        ...provided.draggableProps.style,
                    }}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onDoubleClick={() => onRowDoubleClick(Number(task.id))}
                >
                    {/* Drag Handle */}
                    <div
                        {...provided.dragHandleProps}
                        style={getDragHandleStyles(snapshot.isDragging, isHovered, mode)}
                        title="Drag to reorder"
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
                </div>
            )}
        </Draggable>
    );
};
