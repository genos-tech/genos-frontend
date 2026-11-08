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
import { Box, IconButton, Typography } from "@mui/joy";
import { alpha } from "@mui/system";
import dayjs from "dayjs";
import { Socket } from "socket.io-client";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { ResolvedUserName } from "../../../../components/ui/avatars/AvatarContext";
import { BaseAvatar } from "../../../../components/ui/avatars/BaseAvatar";
import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { Clickable } from "../../../../components/ui/Clickable";
import { PulseDot } from "../../../../components/ui/misc/PulseDot";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { g, type } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import {
    CustomFieldOption,
    ProjectCustomFieldDef,
    TagListProps,
    TaskTableProps,
} from "../../../../types/tasks";
import { PrStatusCell } from "../../../integrations/components/PrStatusCell";
import type { TaskGraphScope } from "../../diagram/types";
import { toneSolid } from "../../meta/taskTone";
import {
    parseCustomFieldColKey,
    resolveTagOptions,
    setCustomFieldValue,
} from "../../utils/customFields";
import { deriveDaysLeft } from "../../utils/daysLeft";
import { isDeletingStatus } from "../../utils/deletedStatus";
import { TASK_ROW_CLASS } from "../../utils/familyFocusCss";
import { formatTaskDisplayId } from "../../utils/taskDisplayId";
import { effortLevels, priorities, taskMetaLabel } from "../../utils/taskMeta";
import { computeTaskWeight, MAX_TASK_WEIGHT, weightBand } from "../../utils/taskWeight";
import { PriorityIcon } from "../meta/PriorityIcon";
import { StatusLabel } from "../meta/StatusLabel";
import { ConfirmDeletedStatus } from "../modals/ConfirmDeletedStatus";
import { ProjectTagChip } from "../ProjectTagChip";
import {
    CellButton,
    CellDateInput,
    CellTextInput,
    ChipSelect,
    EffortLabel,
    effortSelectNode,
    MemberAutocomplete,
    PillChip,
    prioritySelectNode,
    statusSelectNode,
    TagAutocomplete,
} from "./cellEditors";
import { depthRowBackground, depthRowLeftBorder } from "./depthTone";
import { ColumnDef, LEADING_GUTTER_WIDTH, statusOptions } from "./DraggableTaskTable";
import { GRID_COL_ATTR, GRID_ROW_ATTR, useGridNav } from "./useGridNav";

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
    rowDepth: number
): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    // The user's row height (Settings > Appearance > Density): 36px by default.
    // A min-height, so a row whose tags wrap still grows.
    minHeight: g.row.current,
    borderBottom: isDragging ? "none" : `1px solid ${g.border.subtle}`,
    backgroundColor: isDragging || isSelected ? g.accent.subtle : depthRowBackground(rowDepth),
    borderLeft: isSelected ? `3px solid ${g.accent.solid}` : depthRowLeftBorder(rowDepth),
    boxShadow: isDragging ? g.shadow.lg : "none",
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
});

export const getTableCellStyles = (
    width: number,
    align: string | undefined
): React.CSSProperties => ({
    minWidth: width,
    width: width,
    // Vertical rhythm comes from the row height, not from padding.
    padding: "0 8px",
    display: "flex",
    alignItems: "center",
    justifyContent: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
    color: g.text.primary,
    fontSize: "var(--g-type-body-sm-size)",
});

const getDragHandleStyles = (isDragging: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    minWidth: 28,
    // Shorter than the Compact row (32px), or it sets the row's height.
    height: 28,
    cursor: isDragging ? "grabbing" : "grab",
    // Base opacity. The row's `:hover` rule (see the wrapper Box's `sx`)
    // bumps this to 0.8 via `&:hover .task-row-drag-handle` so the handle
    // fades in on hover *without* re-rendering the row.
    opacity: isDragging ? 1 : 0.3,
    color: isDragging ? g.accent.text : g.text.tertiary,
    transition: "opacity 0.2s ease, color 0.2s ease, transform 0.15s ease",
    transform: isDragging ? "scale(1.1)" : "scale(1)",
    borderRadius: 4,
    backgroundColor: isDragging ? g.accent.subtle : "transparent",
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
    // as a `data-task-family` attribute and read by the hover handler in
    // `familyFocusCss.ts` — hovering any row dims every row outside that
    // family.
    //
    // It is only an attribute, never read at render time, which is the whole
    // point: the table body's pointer handler reads it from the DOM and sets
    // `data-dim` on the other rows imperatively, so mouse movement costs React
    // nothing. Driving it from a hovered-id state in the table would
    // re-render the entire row map on every mouse-enter — the exact cost the
    // hover-in-CSS note above `getTableRowStyles` exists to avoid.
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
    onOpenDiagram: (task: TaskTableProps, scope: TaskGraphScope) => void;
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

    // The keyboard comes back to the cell when its editor closes (Escape, Enter, a
    // pick): the editor unmounts with focus in it, so focus would drop to <body>
    // and the user would lose their place in the grid (MIP-1230). The editor's
    // key is the column's key for every built-in and `cf_<id>` cell. Only the
    // close counts, not a switch to another editor, and the grid only moves focus
    // when it was left on <body> by a keyboard interaction.
    const grid = useGridNav();
    const lastEditingRef = useRef<string | null>(null);
    useEffect(() => {
        const previous = lastEditingRef.current;
        lastEditingRef.current = editingField;
        if (previous && !editingField) grid?.restoreFocus({ rowId: taskIdStr, col: previous });
    }, [editingField, grid, taskIdStr]);

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

    // Picking "Deleted" asks first (MIP-1301); the dialog is mounted only while a
    // choice is pending, so a table of rows carries no closed dialogs.
    const [pendingDeleted, setPendingDeleted] = useState(false);

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
        <Typography sx={{ fontSize: "var(--g-type-body-xs-size)", color: g.text.tertiary }}>
            -
        </Typography>
    );

    // One cell of a `cf_<id>` column. Editing mirrors the built-in
    // cells per type: text ≈ title (buffered, commit on blur/Enter),
    // date ≈ dueDate (commit on change), tag ≈ tags (multi buffer,
    // commit on blur), member ≈ assignee (commit on select). All
    // persistence funnels through `commitCustomField` → onRowUpdate.
    const renderCustomFieldCell = (def: ProjectCustomFieldDef) => {
        const editKey = `cf_${def.fieldId}`;
        const stored = task.customFieldValues?.[String(def.fieldId)];
        const storedString = typeof stored === "string" ? stored : "";
        const accent = g.accent.text;

        if (def.fieldType === "tag") {
            const selected = resolveTagOptions(def, stored);
            if (editingField === editKey) {
                return (
                    <Box
                        sx={{ width: "100%" }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <TagAutocomplete<CustomFieldOption>
                            getColor={(option) => option.color}
                            getLabel={(option) => option.label}
                            isEqual={(a, b) => a.id === b.id}
                            minWidth={160}
                            options={def.options}
                            placeholder={selected.length === 0 ? "Select…" : ""}
                            value={editCustomOptions}
                            autoFocus
                            persistent
                            onChange={setEditCustomOptions}
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
                        />
                    </Box>
                );
            }
            return (
                <Clickable
                    sx={customReadCellSx}
                    onActivate={(e) => {
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
                </Clickable>
            );
        }

        if (def.fieldType === "member") {
            // Mirrors the built-in Assignee cell exactly — same dropdown
            // Paper, listbox scrollbar, accent-focus input, and rich
            // option rows (avatar + name + email + hover + selected).
            if (editingField === editKey) {
                const current = teamMembers.find((m) => String(m.userId) === storedString);
                return (
                    <MemberAutocomplete
                        clearOnBlur={false}
                        members={teamMembers}
                        minWidth={180}
                        placeholder={t.tasks.table.searchMembersPlaceholder}
                        value={current || null}
                        autoFocus
                        blurOnSelect
                        open
                        showEmail
                        onChange={(member) => {
                            if (member) {
                                void commitCustomField(def.fieldId, String(member.userId));
                                handleCancelEdit();
                            }
                        }}
                        onClose={(reason) => {
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
                <Clickable
                    sx={{
                        display: "flex",
                        gap: 1,
                        alignItems: "center",
                        cursor: "pointer",
                        padding: "2px 6px",
                        borderRadius: g.radius.sm,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        transition: "background-color 0.15s ease",
                        "&:hover": { backgroundColor: g.hover },
                    }}
                    onActivate={(e) => {
                        e.stopPropagation();
                        setEditingField(editKey);
                    }}
                >
                    <Box sx={{ position: "relative", display: "inline-flex" }}>
                        {storedString !== "" ? (
                            <UserAvatar
                                clickable={false}
                                showPulseDot={false}
                                size={24}
                                userId={storedString}
                            />
                        ) : (
                            <BaseAvatar size={24} sx={{ color: g.text.tertiary }}>
                                ?
                            </BaseAvatar>
                        )}
                    </Box>
                    <Box sx={{ overflow: "hidden" }}>
                        <Typography
                            level="body-sm"
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
                </Clickable>
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
                    <CellDateInput
                        ariaLabel={def.fieldName}
                        value={editValue}
                        autoFocus
                        onBlur={commitDate}
                        onChange={setEditValue}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") commitDate();
                            if (e.key === "Escape") handleCancelEdit();
                        }}
                    />
                );
            }
            return (
                <Clickable
                    sx={{
                        ...type("body-sm"),
                        cursor: "pointer",
                        fontWeight: 500,
                        "&:hover": {
                            color: accent,
                        },
                    }}
                    onActivate={() => handleStartEdit(editKey, storedString)}
                >
                    {storedString !== "" ? storedString : "-"}
                </Clickable>
            );
        }

        // text — mirrors the built-in Title cell's input styling.
        if (editingField === editKey) {
            return (
                <CellTextInput
                    value={editValue}
                    autoFocus
                    onChange={setEditValue}
                    onBlur={() => {
                        void commitCustomField(def.fieldId, editValue.trim() || null);
                    }}
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
            <Clickable
                sx={customReadCellSx}
                onActivate={(e) => {
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
                                fontSize: "var(--g-type-body-sm-size)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {storedString}
                        </Typography>
                    </AppTooltip>
                )}
            </Clickable>
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
                        size="sm"
                        variant="plain"
                        aria-label={
                            isExpanded
                                ? t.tasks.diagram.tooltips.collapse
                                : t.tasks.diagram.tooltips.expand
                        }
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
                            <KeyboardArrowRightRoundedIcon
                                sx={{ fontSize: 18, '[dir="rtl"] &': { transform: "scaleX(-1)" } }}
                            />
                        )}
                    </IconButton>
                );

            case "id":
                return (
                    <IconButton
                        size="sm"
                        variant="plain"
                        sx={{
                            // Quiet: an ID is a reference, not the loudest thing in the row
                            // (it was orange). The accent appears on hover.
                            color: g.text.tertiary,
                            fontWeight: 500,
                            minWidth: 0,
                            minHeight: 0,
                            height: 24,
                            px: 0.75,
                            // One line, whatever the key's length (it wrapped, MIP-1175).
                            whiteSpace: "nowrap",
                            "&:hover": { backgroundColor: g.hover, color: g.accent.text },
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            openPreview();
                        }}
                    >
                        <Typography
                            fontSize="var(--g-type-body-sm-size)"
                            sx={{
                                fontWeight: 500,
                                color: "inherit",
                                fontVariantNumeric: "tabular-nums",
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
                        <ChipSelect
                            fullWidth={false}
                            minWidth={110}
                            value={(value as string) || ""}
                            options={statusOptions.map((opt) => ({
                                value: opt.value,
                                node: statusSelectNode(opt.value),
                            }))}
                            autoFocus
                            open
                            onClose={handleCancelEdit}
                            onChange={(next) => {
                                if (isDeletingStatus(next, task.status)) setPendingDeleted(true);
                                else handleSelectChange("status", next);
                                handleCancelEdit();
                            }}
                        />
                    );
                }
                return statusOption ? (
                    <>
                        <CellButton onClick={() => handleStartEdit("status", value as string)}>
                            <StatusLabel status={statusOption.value} />
                        </CellButton>
                        {pendingDeleted && (
                            <ConfirmDeletedStatus
                                entityName={task.title ?? undefined}
                                isMilestone={task.isMilestone === true}
                                open
                                onClose={() => setPendingDeleted(false)}
                                onConfirm={() => void handleSelectChange("status", "Deleted")}
                            />
                        )}
                    </>
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
                if (editingField === "tags") {
                    return (
                        // Stop mouse events reaching the row (drag / preview).
                        <Box
                            sx={{ width: "100%" }}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <TagAutocomplete<TagListProps>
                                getColor={(tag) => tag.tagColor}
                                getLabel={(tag) => tag.tagName}
                                isEqual={(a, b) => a.tagName === b.tagName}
                                minWidth={160}
                                options={projectTags}
                                value={editTags}
                                placeholder={
                                    tags.length === 0 ? t.tasks.table.addTagsPlaceholder : ""
                                }
                                autoFocus
                                persistent
                                onChange={setEditTags}
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
                            />
                        </Box>
                    );
                }
                // Read view: chips, click anywhere in the cell to edit.
                return (
                    <Clickable
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
                        onActivate={(e) => {
                            e.stopPropagation();
                            handleStartEditTags();
                        }}
                    >
                        {tags.length === 0 ? (
                            <Typography
                                sx={{
                                    fontSize: "var(--g-type-body-xs-size)",
                                    color: g.text.tertiary,
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
                    </Clickable>
                );
            }

            case "title":
                if (editingField === "title") {
                    return (
                        <Box sx={{ pl: depth > 0 ? depth * 1.5 : 0, width: "100%" }}>
                            <CellTextInput
                                value={editValue}
                                autoFocus
                                onBlur={() => handleSaveEdit("title")}
                                onChange={setEditValue}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveEdit("title");
                                    if (e.key === "Escape") handleCancelEdit();
                                }}
                            />
                        </Box>
                    );
                }
                return (
                    <Clickable
                        sx={{
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                            pl: depth > 0 ? depth * 1.5 : 0,
                            width: "100%",
                            "&:hover .task-row-title": {
                                color: isMilestoneRow ? "#f97316" : g.accent.text,
                            },
                        }}
                        onActivate={() => handleStartEdit("title", task.title || "")}
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
                    </Clickable>
                );

            case "assigneeId":
                if (editingField === "assigneeId") {
                    const currentAssignee = teamMembers.find(
                        (member) => member.userId === task.assigneeId
                    );
                    return (
                        <MemberAutocomplete
                            clearOnBlur={false}
                            members={teamMembers}
                            minWidth={180}
                            placeholder={t.tasks.table.searchMembersPlaceholder}
                            value={currentAssignee || null}
                            autoFocus
                            blurOnSelect
                            open
                            showEmail
                            onChange={(member) => {
                                if (member) {
                                    handleSelectChange("assigneeId", member.userId);
                                    handleCancelEdit();
                                }
                                // Don't close when clearing - let user continue typing
                            }}
                            onClose={(reason) => {
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
                    <Clickable
                        sx={{
                            display: "flex",
                            gap: 1,
                            alignItems: "center",
                            cursor: "pointer",
                            // 24px avatar + this padding keep the row at the density height.
                            padding: "2px 6px",
                            borderRadius: g.radius.sm,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            transition: "background-color 0.15s ease",
                            "&:hover": { backgroundColor: g.hover },
                        }}
                        onActivate={() => handleStartEdit("assigneeId", task.assigneeId || "")}
                    >
                        <Box sx={{ position: "relative", display: "inline-flex" }}>
                            {task.assigneeId ? (
                                <UserAvatar
                                    clickable={false}
                                    showPulseDot={false}
                                    size={24}
                                    userId={task.assigneeId}
                                />
                            ) : (
                                // Unassigned task — render a neutral
                                // placeholder, NOT `myself`'s avatar (the
                                // old fallback was a leftover from when
                                // every task was forced to have an
                                // assignee on create).
                                <BaseAvatar size={24} sx={{ color: g.text.tertiary }}>
                                    ?
                                </BaseAvatar>
                            )}
                        </Box>
                        <Box sx={{ overflow: "hidden" }}>
                            <Typography
                                level="body-sm"
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
                    </Clickable>
                );

            case "priority":
                const priorityOption = priorities.find((p) => p.priority === value);
                if (editingField === "priority") {
                    return (
                        <ChipSelect
                            fullWidth={false}
                            minWidth={100}
                            value={(value as string) || ""}
                            options={priorities.map((opt) => ({
                                value: opt.priority || "",
                                node: prioritySelectNode(opt.priority ?? ""),
                            }))}
                            autoFocus
                            open
                            onClose={handleCancelEdit}
                            onChange={(next) => {
                                handleSelectChange("priority", next);
                                handleCancelEdit();
                            }}
                        />
                    );
                }
                return priorityOption ? (
                    <CellButton onClick={() => handleStartEdit("priority", value as string)}>
                        <PriorityIcon priority={priorityOption.priority ?? ""} showLabel />
                    </CellButton>
                ) : null;

            case "effortLevel":
                const effortOption = effortLevels.find((e) => e.level === value);
                if (editingField === "effortLevel") {
                    return (
                        <ChipSelect
                            fullWidth={false}
                            minWidth={90}
                            value={(value as string) || ""}
                            options={effortLevels.map((opt) => ({
                                value: opt.level || "",
                                node: effortSelectNode(opt.level ?? ""),
                            }))}
                            autoFocus
                            open
                            onClose={handleCancelEdit}
                            onChange={(next) => {
                                handleSelectChange("effortLevel", next);
                                handleCancelEdit();
                            }}
                        />
                    );
                }
                return effortOption ? (
                    <CellButton onClick={() => handleStartEdit("effortLevel", value as string)}>
                        <EffortLabel level={effortOption.level ?? ""} />
                    </CellButton>
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
                        <PillChip
                            label={weight}
                            sx={{
                                backgroundColor: alpha(color, mode === "dark" ? 0.5 : 0.75),
                                color: "white",
                                fontWeight: "bold",
                                borderRadius: "6px",
                                minWidth: 30,
                                // A one-digit weight sat at the left of its 30px chip.
                                justifyContent: "center",
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
                    <PillChip
                        label={t.tasks.filters.expired}
                        sx={{
                            // Past due is the danger tone (it was "#ff2323"), not Deleted's gray.
                            backgroundColor: alpha(
                                toneSolid("danger").bg,
                                mode === "dark" ? 0.5 : 0.75
                            ),
                            color: toneSolid("danger").fg,
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
                        <CellDateInput
                            ariaLabel={t.tasks.table.columns.dueDate}
                            value={editValue}
                            autoFocus
                            onBlur={() => handleSaveEdit("dueDate")}
                            onChange={setEditValue}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveEdit("dueDate");
                                if (e.key === "Escape") handleCancelEdit();
                            }}
                        />
                    );
                }
                return (
                    <Clickable
                        sx={{
                            ...type("body-sm"),
                            cursor: "pointer",
                            fontWeight: 500,
                            "&:hover": {
                                color: g.accent.text,
                            },
                        }}
                        onActivate={() =>
                            handleStartEdit(
                                "dueDate",
                                task.dueDate ? dayjs(task.dueDate).format("YYYY-MM-DD") : ""
                            )
                        }
                    >
                        {task.dueDate ? dayjs(task.dueDate).format("YYYY-MM-DD") : "-"}
                    </Clickable>
                );

            case "sprint": {
                if (task.sprintId == null) {
                    return (
                        <Typography
                            level="body-sm"
                            sx={{
                                color: g.text.tertiary,
                                fontStyle: "italic",
                                fontSize: "var(--g-type-body-sm-size)",
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
                        <PillChip
                            label={name}
                            sx={{
                                maxWidth: "100%",
                                // Neutral, like a tag: a sprint is a place, not a status.
                                backgroundColor: g.surface.default,
                                color: g.text.secondary,
                                border: `1px solid ${g.border.default}`,
                                fontWeight: 500,
                                fontSize: "var(--g-type-body-xs-size)",
                                borderRadius: g.radius.xs,
                                height: 20,
                                // Italicize the fallback so the user can tell at a
                                // glance that the sprint hasn't been loaded yet.
                                fontStyle: resolved ? "normal" : "italic",
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
                            color: g.text.tertiary,
                            fontSize: "var(--g-type-body-sm-size)",
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
                            color: g.text.tertiary,
                            fontSize: "var(--g-type-body-sm-size)",
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
                        // Treegrid row (MIP-1230): the roving-tabindex model finds its
                        // rows and cells by these attributes (`role="row"` below). A
                        // ghost row is inert context: out of the Tab order and out of
                        // the keyboard model.
                        aria-expanded={hasChildren ? isExpanded : undefined}
                        aria-level={depth + 1}
                        // Hooks for the family-focus handler and rules
                        // (see `familyFocusCss.ts`). The class makes this row
                        // both the hover probe and a dim target; the family
                        // attribute is what the handler compares. `selected`
                        // is published so the dim rule can exempt the row
                        // whose preview pane is open.
                        className={TASK_ROW_CLASS}
                        data-task-family={familyKey}
                        data-task-selected={isSelected ? "true" : undefined}
                        role="row"
                        {...(isGhost ? { inert: true } : { [GRID_ROW_ATTR]: taskIdStr })}
                        // Base layout/colors come from the helper.
                        // `provided.draggableProps.style` carries dnd's
                        // transform / transition during drag and must
                        // win over our defaults — same merge order as
                        // before.
                        style={{
                            ...getTableRowStyles(snapshot.isDragging, isSelected, depth),
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
                                    ? { backgroundColor: g.hover }
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
                            // A button that only shows on hover must show when the keyboard
                            // is on it (MIP-1230), or the ring is on nothing. `!important`:
                            // the handle's own opacity is an inline style.
                            "& .task-row-drag-handle:focus-visible, & .task-row-open-diagram:focus-visible, & .task-row-quick-add:focus-visible":
                                { opacity: "1 !important" },
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
                                    fontSize: "var(--g-type-body-xs-size)",
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
                            role="gridcell"
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
                                    // The library gives the handle tabIndex 0: in the
                                    // grid it is one cell among the others (Space still
                                    // lifts the row from it).
                                    {...{ [GRID_COL_ATTR]: "__drag" }}
                                    className="task-row-drag-handle"
                                    style={getDragHandleStyles(snapshot.isDragging)}
                                    tabIndex={-1}
                                >
                                    <DragIndicatorIcon sx={{ fontSize: 20 }} />
                                </div>
                            </AppTooltip>
                            {/* Open the task graph anchored on this row.
                                A top-level row (root task / milestone) opens
                                its whole tree. A nested row opens the graph
                                of just that task and its subtasks, so it
                                gets the icon only when it HAS subtasks: a
                                leaf would open a single card (MIP-1094).
                                Same hover-reveal CSS as the quick-add "+"
                                (zero-re-render pattern). */}
                            {(!isChild || hasChildren) && (
                                <AppTooltip title={t.tasks.tooltips.openTaskGraph}>
                                    <IconButton
                                        {...{ [GRID_COL_ATTR]: "__graph" }}
                                        className="task-row-open-diagram"
                                        size="sm"
                                        variant="plain"
                                        sx={{
                                            minWidth: 0,
                                            minHeight: 0,
                                            width: 20,
                                            height: 20,
                                            p: 0,
                                            borderRadius: "4px",
                                            opacity: 0,
                                            color: g.accent.text,
                                            transition: "opacity 0.2s ease",
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenDiagram(task, isChild ? "task" : "tree");
                                        }}
                                    >
                                        <AccountTreeRoundedIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                </AppTooltip>
                            )}
                            <AppTooltip title={t.tasks.table.quickAddTooltip}>
                                <IconButton
                                    {...{ [GRID_COL_ATTR]: "__add" }}
                                    className="task-row-quick-add"
                                    size="sm"
                                    variant="plain"
                                    sx={{
                                        minWidth: 0,
                                        minHeight: 0,
                                        width: 20,
                                        height: 20,
                                        p: 0,
                                        borderRadius: "4px",
                                        // Hidden until the row is hovered — see the
                                        // `&:hover .task-row-quick-add` rule in the
                                        // wrapper Box's sx (same zero-re-render CSS
                                        // pattern as the drag handle).
                                        opacity: 0,
                                        color: g.accent.text,
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
                                role="gridcell"
                                // An expand cell with nothing in it is not a place to stop.
                                {...(column.field === "__expand" && !hasChildren
                                    ? {}
                                    : { [GRID_COL_ATTR]: column.field })}
                                style={{
                                    ...getTableCellStyles(column.width, column.align),
                                    borderRight:
                                        idx === columns.length - 1
                                            ? "none"
                                            : `1px solid ${g.border.subtle}`,
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
