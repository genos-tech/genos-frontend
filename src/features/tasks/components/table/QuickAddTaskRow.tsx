import { useEffect, useRef, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import SubdirectoryArrowRightRoundedIcon from "@mui/icons-material/SubdirectoryArrowRightRounded";
import { Box, Typography } from "@mui/joy";
import {
    Autocomplete,
    Chip,
    CircularProgress,
    IconButton,
    MenuItem,
    Paper,
    Select,
    SelectChangeEvent,
    TextField,
} from "@mui/material";
import { alpha } from "@mui/system";

import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { TaskTableProps } from "../../../../types/tasks";
import { effortLevels, priorities } from "../../utils/taskMeta";
import {
    DEPTH_BORDER_COLORS,
    DEPTH_COLORS_DARK,
    DEPTH_COLORS_LIGHT,
    getTableCellStyles,
} from "./DraggableTaskRow";
import { ColumnDef, LEADING_GUTTER_WIDTH, statusOptions } from "./DraggableTaskTable";

// Draft the quick-add row hands back on submit. Every field the table
// can edit inline is here; tags/sprint are intentionally absent (they
// aren't table-editable today either).
export type QuickAddDraft = {
    title: string;
    assigneeId: string | null;
    status: string;
    priority: string | null;
    effortLevel: string | null;
    // "YYYY-MM-DD"
    dueDate: string | null;
};

type QuickAddTaskRowProps = {
    parentTask: TaskTableProps;
    // Parent row's depth + 1 — the new row renders indented as a child.
    depth: number;
    // Same `columnsWithWidths` array the sibling rows receive, so the
    // draft row's cells line up with the table grid exactly.
    columns: ColumnDef[];
    mode: "light" | "dark" | undefined;
    myself: UserProps;
    teamMembers: UserProps[];
    // The table owns the actual create call (createQuickTask + optimistic
    // allTasks insert). Rejections surface here as an inline error.
    onSubmit: (draft: QuickAddDraft) => Promise<void>;
    onClose: () => void;
    // Lets the table know whether the row holds unsaved input, so e.g.
    // drag-start only auto-dismisses a pristine row.
    onDirtyChange: (dirty: boolean) => void;
};

// Inline creation row rendered directly beneath a parent row in the
// task table. Unlike DraggableTaskRow's cells there's no display/edit
// toggle — the row is a transient form, so every field is a compact
// always-editable input. Enter (or the ✓ button) creates and keeps the
// row open with cleared fields for rapid consecutive adds; Escape
// discards; clicking outside discards only while the title is empty.
//
// Deliberately NOT memoized and NOT a dnd Draggable: at most one
// instance is mounted at a time, and it must not consume a Draggable
// index (the table's drag-end math is based on displayRows positions).
export const QuickAddTaskRow = (props: QuickAddTaskRowProps) => {
    const { depth, columns, mode, myself, teamMembers, onSubmit, onClose, onDirtyChange } = props;
    const { t } = useTranslation();

    const [title, setTitle] = useState("");
    const [assigneeId, setAssigneeId] = useState<string | null>(myself.userId);
    const [status, setStatus] = useState("Open");
    const [priority, setPriority] = useState<string | null>(null);
    const [effortLevel, setEffortLevel] = useState<string | null>(null);
    const [dueDate, setDueDate] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const rootRef = useRef<HTMLDivElement | null>(null);
    // Mirrors of state/props read from the document-level mousedown
    // listener, which is registered exactly once — refs keep it from
    // rebinding per keystroke while still seeing current values.
    const titleValueRef = useRef("");
    const isSubmittingRef = useRef(false);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    // Click-outside: discard the row only while the title is empty. A
    // typed title means unsaved work — a stray click must not create
    // or destroy it (Enter/✓ is the only create path).
    useEffect(() => {
        const onDocMouseDown = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;
            if (rootRef.current?.contains(target)) return;
            // MUI Select/Autocomplete popups render in portals outside
            // this row's DOM subtree. A click on a menu option (or the
            // Select's modal backdrop) is an interaction WITH the row,
            // not outside it — never treat those as a dismissal.
            if (
                target.closest(
                    '.MuiPopover-root, .MuiModal-root, .MuiAutocomplete-popper, [role="listbox"], [role="option"]'
                )
            ) {
                return;
            }
            if (isSubmittingRef.current) return;
            if (titleValueRef.current.trim() !== "") return;
            onCloseRef.current();
        };
        document.addEventListener("mousedown", onDocMouseDown);
        return () => document.removeEventListener("mousedown", onDocMouseDown);
    }, []);

    const handleTitleChange = (value: string) => {
        setTitle(value);
        titleValueRef.current = value;
        onDirtyChange(value.trim() !== "");
        if (error) setError(null);
    };

    const submit = async () => {
        const trimmed = title.trim();
        // In-flight guard: a second Enter while the first POST is out
        // must not create a duplicate task.
        if (trimmed === "" || isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setIsSubmitting(true);
        setError(null);
        try {
            await onSubmit({ title: trimmed, assigneeId, status, priority, effortLevel, dueDate });
            // Close the row once the task is created — it should disappear
            // on create rather than persist for rapid consecutive adds
            // (re-opening is one hover-"+" click away). The finally below
            // still runs and resets the flags; the setState lands on the
            // about-to-unmount row and is a harmless no-op.
            onDirtyChange(false);
            onClose();
        } catch {
            setError(t.tasks.table.quickAddError);
        } finally {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
        }
    };

    const accent = mode === "dark" ? "#a78bfa" : "#7c3aed";
    const depthIdx = Math.min(depth, 3);
    const dimText = mode === "dark" ? "#666" : "#aaa";

    const menuPaperSx = {
        backgroundColor: mode === "dark" ? "#1a1a2e" : "#ffffff",
        borderRadius: "8px",
        border:
            mode === "dark"
                ? "1px solid rgba(255, 255, 255, 0.1)"
                : "1px solid rgba(0, 0, 0, 0.08)",
        boxShadow:
            mode === "dark" ? "0 8px 24px rgba(0, 0, 0, 0.4)" : "0 8px 24px rgba(0, 0, 0, 0.1)",
        mt: 0.5,
    };
    const menuItemSx = {
        py: 0.75,
        px: 1,
        mx: 0.5,
        my: 0.25,
        borderRadius: "6px",
        "&:hover": {
            backgroundColor: mode === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)",
        },
    };
    const compactSelectSx = {
        width: "100%",
        "& .MuiSelect-select": {
            display: "flex",
            alignItems: "center",
            padding: "4px 8px",
            minHeight: "unset",
        },
        "& .MuiOutlinedInput-notchedOutline": {
            borderColor: mode === "dark" ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.12)",
            borderRadius: "6px",
        },
        "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: accent,
        },
    };
    const emptyValueLabel = (
        <Typography level="body-sm" sx={{ color: dimText, fontStyle: "italic" }}>
            —
        </Typography>
    );

    const renderCellContent = (column: ColumnDef) => {
        switch (column.field) {
            case "__expand":
                return (
                    <SubdirectoryArrowRightRoundedIcon
                        sx={{
                            fontSize: 15,
                            color: mode === "dark" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.18)",
                        }}
                    />
                );

            case "id":
                // No id until the backend answers — the accent "+" marks
                // this as the draft row.
                return <AddRoundedIcon sx={{ fontSize: 16, color: accent }} />;

            case "status":
                return (
                    <Select
                        disabled={isSubmitting}
                        size="small"
                        sx={compactSelectSx}
                        value={status}
                        MenuProps={{ PaperProps: { sx: menuPaperSx } }}
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
                        onChange={(e: SelectChangeEvent) => setStatus(e.target.value)}
                    >
                        {statusOptions.map((opt) => (
                            <MenuItem key={opt.value} sx={menuItemSx} value={opt.value}>
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

            case "title":
                return (
                    <TextField
                        disabled={isSubmitting}
                        error={!!error}
                        helperText={error}
                        placeholder={t.tasks.table.quickAddTitlePlaceholder}
                        size="small"
                        value={title}
                        InputProps={{
                            endAdornment: isSubmitting ? <CircularProgress size={14} /> : null,
                        }}
                        sx={{
                            ml: depth * 1.5,
                            flex: 1,
                            minWidth: 0,
                            "& .MuiOutlinedInput-root": {
                                borderRadius: "6px",
                                fontSize: "0.8rem",
                                "&:hover fieldset": { borderColor: accent },
                                "&.Mui-focused fieldset": {
                                    borderColor: accent,
                                    borderWidth: "1.5px",
                                },
                            },
                            "& .MuiInputBase-input": { padding: "5px 10px" },
                            "& .MuiFormHelperText-root": { mx: 0.5, my: 0 },
                        }}
                        autoFocus
                        onChange={(e) => handleTitleChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                void submit();
                            }
                        }}
                    />
                );

            case "assigneeId": {
                const currentAssignee =
                    teamMembers.find((member) => member.userId === assigneeId) || null;
                return (
                    <Autocomplete
                        disabled={isSubmitting}
                        getOptionLabel={(option) => `${option.userName} ${option.userEmail}`}
                        options={teamMembers}
                        size="small"
                        value={currentAssignee}
                        filterOptions={(options, { inputValue }) => {
                            const searchTerm = inputValue.toLowerCase();
                            return options.filter(
                                (option) =>
                                    option.userName.toLowerCase().includes(searchTerm) ||
                                    option.userEmail.toLowerCase().includes(searchTerm)
                            );
                        }}
                        isOptionEqualToValue={(option, value) => option.userId === value?.userId}
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
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: "6px",
                                        fontSize: "0.8rem",
                                        "&:hover fieldset": { borderColor: accent },
                                        "&.Mui-focused fieldset": {
                                            borderColor: accent,
                                            borderWidth: "1.5px",
                                        },
                                    },
                                }}
                            />
                        )}
                        renderOption={(optionProps, option) => {
                            const { key, ...restProps } = optionProps;
                            return (
                                <Box
                                    key={key}
                                    component="li"
                                    {...restProps}
                                    sx={{
                                        py: 0.75,
                                        px: 1.5,
                                        display: "flex",
                                        gap: 1,
                                        alignItems: "center",
                                        cursor: "pointer",
                                    }}
                                >
                                    <UserAvatar clickable={false} userId={option.userId} />
                                    <Typography
                                        level="body-sm"
                                        sx={{
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {option.userName}
                                    </Typography>
                                </Box>
                            );
                        }}
                        sx={{ width: "100%" }}
                        onChange={(_, newValue) => setAssigneeId(newValue?.userId ?? null)}
                    />
                );
            }

            case "priority":
                return (
                    <Select
                        disabled={isSubmitting}
                        size="small"
                        sx={compactSelectSx}
                        value={priority ?? ""}
                        MenuProps={{ PaperProps: { sx: menuPaperSx } }}
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
                            ) : (
                                emptyValueLabel
                            );
                        }}
                        displayEmpty
                        onChange={(e: SelectChangeEvent) =>
                            setPriority(e.target.value === "" ? null : e.target.value)
                        }
                    >
                        <MenuItem sx={menuItemSx} value="">
                            {emptyValueLabel}
                        </MenuItem>
                        {priorities.map((opt) => (
                            <MenuItem
                                key={opt.priority || ""}
                                sx={menuItemSx}
                                value={opt.priority || ""}
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

            case "effortLevel":
                return (
                    <Select
                        disabled={isSubmitting}
                        size="small"
                        sx={compactSelectSx}
                        value={effortLevel ?? ""}
                        MenuProps={{ PaperProps: { sx: menuPaperSx } }}
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
                                        minWidth: 60,
                                    }}
                                />
                            ) : (
                                emptyValueLabel
                            );
                        }}
                        displayEmpty
                        onChange={(e: SelectChangeEvent) =>
                            setEffortLevel(e.target.value === "" ? null : e.target.value)
                        }
                    >
                        <MenuItem sx={menuItemSx} value="">
                            {emptyValueLabel}
                        </MenuItem>
                        {effortLevels.map((opt) => (
                            <MenuItem
                                key={opt.level || ""}
                                sx={menuItemSx}
                                value={opt.level || ""}
                            >
                                <Chip
                                    label={opt.level}
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

            case "dueDate":
                return (
                    <input
                        disabled={isSubmitting}
                        type="date"
                        value={dueDate ?? ""}
                        style={{
                            width: "100%",
                            padding: "5px 8px",
                            fontSize: "0.8rem",
                            border: `1px solid ${mode === "dark" ? "#555" : "#ccc"}`,
                            borderRadius: "6px",
                            backgroundColor: mode === "dark" ? "#1e1e1e" : "#fff",
                            color: mode === "dark" ? "#e0e0e0" : "#333",
                        }}
                        onChange={(e) => setDueDate(e.target.value || null)}
                    />
                );

            default:
                // Columns the quick row can't fill (tags, pr, daysLeft,
                // sprint, updatedAt, createdDate, ...) — dim placeholder.
                return (
                    <Typography level="body-sm" sx={{ color: dimText, fontStyle: "italic" }}>
                        —
                    </Typography>
                );
        }
    };

    return (
        <div
            ref={rootRef}
            style={{
                display: "flex",
                alignItems: "center",
                minHeight: 36,
                borderBottom:
                    mode === "dark"
                        ? "1px solid rgba(255, 255, 255, 0.08)"
                        : "1px solid rgba(0, 0, 0, 0.08)",
                borderLeft: `3px solid ${DEPTH_BORDER_COLORS[depthIdx]}`,
                backgroundColor:
                    mode === "dark" ? DEPTH_COLORS_DARK[depthIdx] : DEPTH_COLORS_LIGHT[depthIdx],
                // Subtle accent ring marks the row as an uncommitted draft.
                boxShadow: `inset 0 0 0 1px ${alpha(accent, 0.25)}`,
            }}
            onKeyDown={(e) => {
                // Escape discards. When a Select/Autocomplete popup is
                // open, MUI's Modal consumes the first Escape to close
                // the popup (stopPropagation), so only a second Escape
                // reaches here — the correct layering.
                if (e.key === "Escape" && !isSubmittingRef.current) {
                    e.preventDefault();
                    onClose();
                }
            }}
        >
            {/* Leading gutter, same width as the drag-handle gutter on
                sibling rows; holds the ✓ confirm in place of a handle. */}
            <div
                style={{
                    width: LEADING_GUTTER_WIDTH,
                    minWidth: LEADING_GUTTER_WIDTH,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <IconButton
                    disabled={isSubmitting || title.trim() === ""}
                    size="small"
                    title={t.tasks.table.quickAddConfirm}
                    sx={{
                        width: 24,
                        height: 24,
                        p: 0,
                        color: accent,
                        "&.Mui-disabled": { color: dimText },
                    }}
                    onClick={() => void submit()}
                >
                    <CheckRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </div>

            {/* Cells — same width/border chrome as DraggableTaskRow so the
                draft row sits flush in the table grid. */}
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
        </div>
    );
};
