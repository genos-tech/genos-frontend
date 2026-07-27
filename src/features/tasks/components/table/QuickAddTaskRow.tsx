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
import { fmt, useTranslation } from "../../../../i18n";
import { LimitReachedError } from "../../../../services/limitErrors";
import { UserProps } from "../../../../types/admin";
import { TagListProps, TaskTableProps } from "../../../../types/tasks";
import { stripOwnerState } from "../../../../utils/joyAutocomplete";
import {
    applyRuleDefaults,
    getMissingRequiredFields,
    TaskFieldRules,
} from "../../utils/taskFieldRules";
import { effortLevels, priorities } from "../../utils/taskMeta";
import { ProjectTagChip } from "../ProjectTagChip";
import {
    DEPTH_BORDER_COLORS,
    DEPTH_COLORS_DARK,
    DEPTH_COLORS_LIGHT,
    getTableCellStyles,
} from "./DraggableTaskRow";
import { ColumnDef, LEADING_GUTTER_WIDTH, statusOptions } from "./DraggableTaskTable";

// Draft the quick-add row hands back on submit. Every field the table
// can edit inline is here plus tags (quick-add grew its own tag editor
// for the project field-rules feature); sprint remains absent (not
// table-editable, and a child inherits it from the parent chain anyway).
export type QuickAddDraft = {
    title: string;
    assigneeId: string | null;
    status: string;
    priority: string | null;
    effortLevel: string | null;
    // "YYYY-MM-DD"
    dueDate: string | null;
    tags: TagListProps[];
};

type QuickAddTaskRowProps = {
    parentTask: TaskTableProps;
    // Parent row's depth + 1 — the new row renders indented as a child.
    depth: number;
    // Same `columnsWithWidths` array the sibling rows receive, so the
    // draft row's cells line up with the table grid exactly.
    columns: ColumnDef[];
    mode: "light" | "dark" | undefined;
    teamMembers: UserProps[];
    // The focused project's tags — options for the tags cell and the
    // "tags-required is inactive with zero tags" liveness check.
    projectTags: TagListProps[];
    // Owner-configured field rules for the parent's project (null when
    // none / not loaded — the gate then fails open). Defaults seed the
    // row's initial state; required fields block submit inline.
    fieldRules: TaskFieldRules | null;
    creatorUserId: string;
    // The table owns the actual create call (createQuickTask + optimistic
    // allTasks insert). Rejections surface here as an inline error.
    onSubmit: (draft: QuickAddDraft) => Promise<void>;
    onClose: () => void;
    // Lets the table know whether the row holds unsaved input, so e.g.
    // drag-start only auto-dismisses a pristine row.
    onDirtyChange: (dirty: boolean) => void;
};

// MUI renders Select menus and Autocomplete dropdowns in portals, outside
// this row's DOM subtree. Both the click-outside dismissal and the
// Enter-to-submit guard need to treat an interaction with one of those
// popups as an interaction WITH the row, so they share one selector.
const POPUP_SELECTOR =
    '.MuiPopover-root, .MuiModal-root, .MuiAutocomplete-popper, [role="listbox"], [role="option"]';

// Inline creation row rendered directly beneath a parent row in the
// task table. Unlike DraggableTaskRow's cells there's no display/edit
// toggle — the row is a transient form, so every field is a compact
// always-editable input. Enter (from any field) or the ✓ button creates;
// Escape discards; clicking outside discards only while the title is
// empty.
//
// Deliberately NOT memoized and NOT a dnd Draggable: at most one
// instance is mounted at a time, and it must not consume a Draggable
// index (the table's drag-end math is based on displayRows positions).
export const QuickAddTaskRow = (props: QuickAddTaskRowProps) => {
    const {
        parentTask,
        depth,
        columns,
        mode,
        teamMembers,
        projectTags,
        fieldRules,
        creatorUserId,
        onSubmit,
        onClose,
        onDirtyChange,
    } = props;
    const { t } = useTranslation();

    // Seed the row's initial state from the project's configured field
    // defaults, computed once on mount (lazy initializer — the row is
    // transient, remounting per open). Status stays "Open" unless a
    // default overrides it; assignee stays unassigned unless defaulted.
    const [seed] = useState(() =>
        applyRuleDefaults(
            {
                projectId: parentTask.projectId != null ? Number(parentTask.projectId) : null,
                dueDate: null,
                status: null,
                priority: null,
                effortLevel: null,
                tags: [],
                assigneeId: null,
                reporterId: null,
            },
            fieldRules ?? {},
            {
                creatorUserId,
                teamMemberIds: teamMembers.map((member) => member.userId),
                projectTags,
            }
        )
    );

    const [title, setTitle] = useState("");
    const [assigneeId, setAssigneeId] = useState<string | null>(seed.assigneeId);
    const [status, setStatus] = useState(seed.status ?? "Open");
    const [priority, setPriority] = useState<string | null>(seed.priority);
    const [effortLevel, setEffortLevel] = useState<string | null>(seed.effortLevel);
    const [dueDate, setDueDate] = useState<string | null>(seed.dueDate);
    const [tags, setTags] = useState<TagListProps[]>(seed.tags);
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
            if (target.closest(POPUP_SELECTOR)) {
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
        // Project field-rules gate — same evaluator as the full create
        // form. Reporter/status/project are auto-satisfied on this path
        // (createQuickTask pins reporter to the creator, status is always
        // set, the project is the parent's).
        const missing = getMissingRequiredFields(
            {
                projectId: parentTask.projectId != null ? Number(parentTask.projectId) : null,
                dueDate,
                status,
                priority,
                effortLevel,
                tags,
                assigneeId,
                reporterId: creatorUserId,
            },
            fieldRules ?? {},
            { kind: "subtask", projectTags }
        );
        if (missing.length > 0) {
            setError(
                fmt(t.tasks.table.quickAddMissingRequired, {
                    fields: missing.map((field) => t.tasks.fields[field]).join(", "),
                })
            );
            return;
        }
        isSubmittingRef.current = true;
        setIsSubmitting(true);
        setError(null);
        try {
            await onSubmit({
                title: trimmed,
                assigneeId,
                status,
                priority,
                effortLevel,
                dueDate,
                tags,
            });
            // Close the row once the task is created — it should disappear
            // on create rather than persist for rapid consecutive adds
            // (re-opening is one hover-"+" click away). The finally below
            // still runs and resets the flags; the setState lands on the
            // about-to-unmount row and is a harmless no-op.
            onDirtyChange(false);
            onClose();
        } catch (err) {
            // Plan-limit rejections explain themselves — show the limit
            // message inline; anything else keeps the generic copy.
            setError(
                err instanceof LimitReachedError && err.message
                    ? err.message
                    : t.tasks.table.quickAddError
            );
        } finally {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
        }
    };

    const accent = mode === "dark" ? "var(--gp-brandalt-400)" : "var(--gp-brand-700)";
    // rgba() rather than MUI's `alpha()`: the brand is a CSS variable and
    // `alpha()` runs `decomposeColor`, which throws on a `var()`.
    const accentRgb = mode === "dark" ? "var(--gp-brandalt-400-rgb)" : "var(--gp-brand-700-rgb)";
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
                        MenuProps={{ PaperProps: { sx: menuPaperSx } }}
                        size="small"
                        sx={compactSelectSx}
                        value={status}
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
                    />
                );

            case "assigneeId": {
                const currentAssignee =
                    teamMembers.find((member) => member.userId === assigneeId) || null;
                return (
                    <Autocomplete
                        disabled={isSubmitting}
                        getOptionLabel={(option) => `${option.userName} ${option.userEmail}`}
                        isOptionEqualToValue={(option, value) => option.userId === value?.userId}
                        options={teamMembers}
                        size="small"
                        sx={{ width: "100%" }}
                        value={currentAssignee}
                        filterOptions={(options, { inputValue }) => {
                            const searchTerm = inputValue.toLowerCase();
                            return options.filter(
                                (option) =>
                                    option.userName.toLowerCase().includes(searchTerm) ||
                                    option.userEmail.toLowerCase().includes(searchTerm)
                            );
                        }}
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
                                    <UserAvatar
                                        clickable={false}
                                        showPulseDot={false}
                                        userId={option.userId}
                                    />
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
                        onChange={(_, newValue) => setAssigneeId(newValue?.userId ?? null)}
                    />
                );
            }

            case "priority":
                return (
                    <Select
                        disabled={isSubmitting}
                        MenuProps={{ PaperProps: { sx: menuPaperSx } }}
                        size="small"
                        sx={compactSelectSx}
                        value={priority ?? ""}
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
                        MenuProps={{ PaperProps: { sx: menuPaperSx } }}
                        size="small"
                        sx={compactSelectSx}
                        value={effortLevel ?? ""}
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

            case "tags":
                return (
                    <Autocomplete
                        disabled={isSubmitting}
                        getOptionLabel={(option: TagListProps) => option.tagName}
                        isOptionEqualToValue={(option, value) => option.tagName === value?.tagName}
                        options={projectTags}
                        size="small"
                        sx={{ width: "100%" }}
                        value={tags}
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
                        renderOption={(optionProps, option) => {
                            const { key, ...restProps } = stripOwnerState(optionProps);
                            return (
                                <Box
                                    key={key}
                                    component="li"
                                    {...restProps}
                                    sx={{
                                        py: 0.5,
                                        px: 1,
                                        mx: 0.5,
                                        my: 0.25,
                                        borderRadius: "6px",
                                        display: "flex",
                                        alignItems: "center",
                                        cursor: "pointer",
                                        "&:hover": {
                                            backgroundColor:
                                                mode === "dark"
                                                    ? "rgba(255,255,255,0.06)"
                                                    : "rgba(0,0,0,0.04)",
                                        },
                                        '&[aria-selected="true"]': {
                                            backgroundColor:
                                                mode === "dark"
                                                    ? "rgba(var(--gp-brandalt-400-rgb), 0.15)"
                                                    : "rgba(var(--gp-brand-700-rgb), 0.08)",
                                        },
                                    }}
                                >
                                    <ProjectTagChip
                                        isDark={mode === "dark"}
                                        label={option.tagName}
                                        tagColor={option.tagColor}
                                    />
                                </Box>
                            );
                        }}
                        renderTags={(value, getTagProps) =>
                            value.map((tag, index) => {
                                // Pull `key` out of the spread — React 19
                                // warns when a spread object carries it.
                                const { key, ...tagProps } = getTagProps({ index });
                                return (
                                    <Chip
                                        key={key ?? tag.tagName}
                                        {...tagProps}
                                        label={tag.tagName}
                                        size="small"
                                        sx={{
                                            backgroundColor: alpha(tag.tagColor || "#888", 0.75),
                                            color: tag.tagTextColor || "white",
                                            fontWeight: "bold",
                                            borderRadius: "5px",
                                            height: 20,
                                            fontSize: "0.7rem",
                                        }}
                                    />
                                );
                            })
                        }
                        multiple
                        onChange={(_, newValue) => {
                            setTags(newValue);
                            if (error) setError(null);
                        }}
                    />
                );

            default:
                // Columns the quick row can't fill (pr, daysLeft, sprint,
                // updatedAt, createdDate, ...) — dim placeholder.
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
                boxShadow: `inset 0 0 0 1px rgba(${accentRgb}, 0.25)`,
            }}
            onKeyDown={(e) => {
                // Escape discards. When a Select/Autocomplete popup is
                // open, MUI's Modal consumes the first Escape to close
                // the popup (stopPropagation), so only a second Escape
                // reaches here — the correct layering.
                if (e.key === "Escape" && !isSubmittingRef.current) {
                    e.preventDefault();
                    onClose();
                    return;
                }
                // Enter creates the task from ANYWHERE in the row, not
                // just the title box. Editing the assignee or the due
                // date and pressing Enter used to do nothing, because the
                // only handler lived on the title's TextField.
                //
                // The guard is the whole trick: Enter inside an open
                // Select / Autocomplete means "take the highlighted
                // option", so it must not also submit.
                //   - An open Select moves focus into a portal — and
                //     React portals bubble through the REACT tree, so
                //     those keydowns DO reach this handler despite
                //     sitting outside the row in the DOM. Same selector
                //     list the click-outside guard above uses.
                //   - An open Autocomplete keeps focus in its input, so
                //     it is NOT in a portal; `aria-expanded` is what
                //     catches it. MUI sets that attribute explicitly on
                //     both widgets, so the check is safe for a closed
                //     Select too (it reads "false", not absent).
                if (e.key === "Enter") {
                    const target = e.target as HTMLElement | null;
                    if (target?.closest(POPUP_SELECTOR)) return;
                    if (target?.getAttribute("aria-expanded") === "true") return;
                    e.preventDefault();
                    void submit();
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
