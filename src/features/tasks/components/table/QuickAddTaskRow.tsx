import { useEffect, useRef, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import SubdirectoryArrowRightRoundedIcon from "@mui/icons-material/SubdirectoryArrowRightRounded";
import { Box, IconButton, Typography } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { useQuickAddRequiredFieldsPreference } from "../../../../hooks/common/useQuickAddRequiredFieldsPreference";
import { fmt, useTranslation } from "../../../../i18n";
import { LimitReachedError } from "../../../../services/limitErrors";
import { g } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { TagListProps, TaskTableProps } from "../../../../types/tasks";
import { QuickAddDraft } from "../../utils/quickAddDraft";
import {
    applyRuleDefaults,
    getQuickAddBlockingFields,
    TaskFieldRules,
} from "../../utils/taskFieldRules";
import { effortLevels, priorities } from "../../utils/taskMeta";
import {
    CellDateInput,
    CellTextInput,
    ChipSelect,
    effortSelectNode,
    MemberAutocomplete,
    prioritySelectNode,
    statusSelectNode,
    TagAutocomplete,
} from "./cellEditors";
import { depthRowLeftBorder } from "./depthTone";
import { getTableCellStyles } from "./DraggableTaskRow";
import { ColumnDef, LEADING_GUTTER_WIDTH, statusOptions } from "./DraggableTaskTable";

export type { QuickAddDraft };

type QuickAddTaskRowProps = {
    parentTask: TaskTableProps;
    // Parent row's depth + 1 — the new row renders indented as a child.
    depth: number;
    // Same `columnsWithWidths` array the sibling rows receive, so the
    // draft row's cells line up with the table grid exactly.
    columns: ColumnDef[];
    /** Unused since the date input follows the theme by token; kept so callers need no change. */
    mode?: "light" | "dark" | undefined;
    teamMembers: UserProps[];
    // The focused project's tags — options for the tags cell and the
    // "tags-required is inactive with zero tags" liveness check.
    projectTags: TagListProps[];
    // Owner-configured field rules for the parent's project (null when
    // none / not loaded — the gate then fails open). Defaults always seed
    // the row's initial state. Required fields block submit only when the
    // user opts in (Settings → Tasks); see `getQuickAddBlockingFields`.
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

// Joy renders Select menus and Autocomplete dropdowns in portals, outside
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
        teamMembers,
        projectTags,
        fieldRules,
        creatorUserId,
        onSubmit,
        onClose,
        onDirtyChange,
    } = props;
    const { t } = useTranslation();
    // Off by default — see `useQuickAddRequiredFieldsPreference`.
    const { enforce: enforceRequiredFields } = useQuickAddRequiredFieldsPreference();

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
        // Project field-rules gate. By default only the structural
        // requirement (a project) blocks here — quick-add is the fast
        // path, and the sub-task quick-add has always created title-only
        // tasks. Users who want the project's creation policy applied to
        // every entry point opt in via Settings → Tasks. Reporter/status
        // are auto-satisfied on this path (createQuickTask pins reporter
        // to the creator, status is always set), and the project is the
        // parent's.
        const missing = getQuickAddBlockingFields(
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
            { kind: "subtask", projectTags },
            { enforceRequiredFields: enforceRequiredFields }
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

    const accent = g.accent.text;
    const dimText = g.text.tertiary;
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
                            color: g.text.tertiary,
                        }}
                    />
                );

            case "id":
                // No id until the backend answers — the accent "+" marks
                // this as the draft row.
                return <AddRoundedIcon sx={{ fontSize: 16, color: accent }} />;

            case "status":
                return (
                    <ChipSelect
                        disabled={isSubmitting}
                        value={status}
                        options={statusOptions.map((opt) => ({
                            value: opt.value,
                            node: statusSelectNode(opt.value),
                        }))}
                        onChange={setStatus}
                    />
                );

            case "title":
                return (
                    <Box sx={{ pl: depth * 1.5, flex: 1, minWidth: 0 }}>
                        <CellTextInput
                            busy={isSubmitting}
                            disabled={isSubmitting}
                            error={error}
                            placeholder={t.tasks.table.quickAddTitlePlaceholder}
                            value={title}
                            autoFocus
                            onChange={handleTitleChange}
                        />
                    </Box>
                );

            case "assigneeId": {
                const currentAssignee =
                    teamMembers.find((member) => member.userId === assigneeId) || null;
                return (
                    <MemberAutocomplete
                        disabled={isSubmitting}
                        members={teamMembers}
                        placeholder={t.tasks.table.searchMembersPlaceholder}
                        value={currentAssignee}
                        onChange={(member) => setAssigneeId(member?.userId ?? null)}
                    />
                );
            }

            case "priority":
                return (
                    <ChipSelect
                        disabled={isSubmitting}
                        empty={emptyValueLabel}
                        value={priority ?? ""}
                        options={priorities.map((opt) => ({
                            value: opt.priority || "",
                            node: prioritySelectNode(opt.priority ?? ""),
                        }))}
                        onChange={(next) => setPriority(next === "" ? null : next)}
                    />
                );

            case "effortLevel":
                return (
                    <ChipSelect
                        disabled={isSubmitting}
                        empty={emptyValueLabel}
                        value={effortLevel ?? ""}
                        options={effortLevels.map((opt) => ({
                            value: opt.level || "",
                            node: effortSelectNode(opt.level ?? ""),
                        }))}
                        onChange={(next) => setEffortLevel(next === "" ? null : next)}
                    />
                );

            case "dueDate":
                return (
                    <CellDateInput
                        ariaLabel={t.tasks.table.columns.dueDate}
                        disabled={isSubmitting}
                        value={dueDate ?? ""}
                        onChange={(next) => setDueDate(next || null)}
                    />
                );

            case "tags":
                return (
                    <TagAutocomplete
                        disabled={isSubmitting}
                        getColor={(tag) => tag.tagColor || "#888"}
                        getLabel={(tag) => tag.tagName}
                        isEqual={(a, b) => a.tagName === b.tagName}
                        options={projectTags}
                        value={tags}
                        onChange={(next) => {
                            setTags(next);
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
                minHeight: g.row.current,
                borderBottom: `1px solid ${g.border.subtle}`,
                borderLeft: depthRowLeftBorder(depth),
                backgroundColor: g.bg.subtle,
                // A ring in the accent marks the row as an uncommitted draft.
                boxShadow: `inset 0 0 0 1px ${g.accent.border}`,
            }}
            onKeyDown={(e) => {
                // Escape discards. When a Select/Autocomplete popup is
                // open, MUI's Modal consumes the first Escape to close
                // the popup (stopPropagation), so only a second Escape
                // reaches here — the correct layering.
                if (e.key === "Escape" && !isSubmittingRef.current) {
                    // An open list closes on the first Escape. Joy's Select and
                    // Autocomplete don't stop the event the way Material's Modal
                    // did, so the same two checks the Enter guard below uses.
                    const popupTarget = e.target as HTMLElement | null;
                    if (popupTarget?.closest(POPUP_SELECTOR)) return;
                    if (popupTarget?.getAttribute("aria-expanded") === "true") return;
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
                <AppTooltip title={t.tasks.table.quickAddConfirm}>
                    <IconButton
                        disabled={isSubmitting || title.trim() === ""}
                        size="sm"
                        variant="plain"
                        sx={{
                            width: 24,
                            height: 24,
                            minWidth: 0,
                            minHeight: 0,
                            p: 0,
                            color: accent,
                            "&.Mui-disabled": { color: dimText },
                        }}
                        onClick={() => void submit()}
                    >
                        <CheckRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </AppTooltip>
            </div>

            {/* Cells — same width/border chrome as DraggableTaskRow so the
                draft row sits flush in the table grid. */}
            {columns.map((column, idx) => (
                <div
                    key={column.field}
                    style={{
                        ...getTableCellStyles(column.width, column.align),
                        borderRight:
                            idx === columns.length - 1 ? "none" : `1px solid ${g.border.subtle}`,
                    }}
                >
                    {renderCellContent(column)}
                </div>
            ))}
        </div>
    );
};
