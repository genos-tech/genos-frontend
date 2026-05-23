import { DragDropContext, Draggable, Droppable, DropResult } from "@hello-pangea/dnd";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import {
    Box,
    Button,
    Divider,
    IconButton,
    Modal,
    ModalDialog,
    Option,
    Select,
    Stack,
    Switch,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { SortTier, useTaskSortPreferences } from "../../../../hooks/common/useTaskSortPreferences";
import { useTaskTableColumnPreferences } from "../../../../hooks/common/useTaskTableColumnPreferences";
import { useTranslation } from "../../../../i18n";
import { isSortDirection, isSortField, SORT_FIELD_OPTIONS } from "../../utils/sortTask";
import { ColumnDef, defaultColumns, FIXED_LEADING_FIELDS } from "./DraggableTaskTable";

type Props = {
    open: boolean;
    onClose: () => void;
};

// One row in the 2-tier sort UI. Migrated from `SettingsModal` so the
// task-side sort config lives next to the column settings (its
// nearest neighbour in user intent) rather than the global user
// preferences tab. The pick-a-field + pick-a-direction shape is
// unchanged from the prior settings panel; only the host is new.
const SortTierRow = ({
    label,
    tier,
    onChange,
    /** Disable the entire row (used to grey out the secondary tier
     *  when no primary is selected). */
    disabled,
}: {
    label: string;
    tier: SortTier | undefined;
    onChange: (next: SortTier | null) => void;
    disabled?: boolean;
}) => {
    const { t } = useTranslation();
    const field = tier?.field ?? "none";
    const direction = tier?.direction ?? "asc";
    return (
        <Stack alignItems="center" direction="row" spacing={1} sx={{ minWidth: 0 }}>
            <Typography
                level="body-sm"
                sx={{ minWidth: 80, color: disabled ? "neutral.500" : undefined }}
            >
                {label}
            </Typography>
            <Select
                disabled={disabled}
                size="sm"
                sx={{ minWidth: 140 }}
                value={field}
                onChange={(_e, value) => {
                    if (value === "none") {
                        onChange(null);
                        return;
                    }
                    if (!isSortField(value)) return;
                    onChange({ field: value, direction });
                }}
            >
                <Option value="none">{t.settings.taskSort.fieldNone}</Option>
                {SORT_FIELD_OPTIONS.map((opt) => (
                    <Option key={opt.value} value={opt.value}>
                        {t.tasks.table.columns[opt.labelKey]}
                    </Option>
                ))}
            </Select>
            <Select
                disabled={disabled || tier == null}
                size="sm"
                sx={{ minWidth: 110 }}
                value={direction}
                onChange={(_e, value) => {
                    if (!isSortDirection(value)) return;
                    if (tier == null) return;
                    onChange({ field: tier.field, direction: value });
                }}
            >
                <Option value="asc">{t.settings.taskSort.directionAsc}</Option>
                <Option value="desc">{t.settings.taskSort.directionDesc}</Option>
            </Select>
        </Stack>
    );
};

// Helper: build a new tier array after a single row's edit. If the
// primary is cleared, the secondary collapses up (or also clears).
// If the secondary equals the new primary's field, drop it to avoid
// useless duplicate sorts.
const setTierAtIndex = (current: SortTier[], index: 0 | 1, next: SortTier | null): SortTier[] => {
    const primary = index === 0 ? next : (current[0] ?? null);
    let secondary = index === 1 ? next : (current[1] ?? null);
    if (primary && secondary && primary.field === secondary.field) {
        secondary = null;
    }
    if (!primary && secondary) {
        // No primary → promote secondary to primary so the user's
        // intent (sort by something) isn't silently lost.
        return [secondary];
    }
    const result: SortTier[] = [];
    if (primary) result.push(primary);
    if (secondary) result.push(secondary);
    return result;
};

/**
 * Settings modal for the task table's column layout.
 *
 * Two interactions:
 *   1. **Toggle** each toggleable column's visibility via a Switch.
 *   2. **Reorder** by drag-and-drop. The list shown here is exactly the
 *      same one `DraggableTaskTable.visibleColumns` derives its order
 *      from — drag a row, the underlying `fieldOrder` in localStorage
 *      gets updated, and the table re-renders with the new order.
 *
 * The fixed leading columns (`__expand`, `id`) are intentionally not
 * shown — they're pinned and not user-controllable.
 *
 * "Reset to defaults" wipes the per-device pref entirely; everything
 * falls back to the order and `hidden` flags declared in
 * `DraggableTaskTable.defaultColumns`.
 */
export const TaskTableColumnSettings = ({ open, onClose }: Props) => {
    const { t } = useTranslation();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { fieldOrder, visibilityOverrides, setVisibility, setFieldOrder, reset } =
        useTaskTableColumnPreferences();
    const { sprintBoardSortTiers, setSprintBoardSortTiers, tableSortTiers, setTableSortTiers } =
        useTaskSortPreferences();

    // Toggleable columns in their current displayed order. Mirrors the
    // resolution logic in `DraggableTaskTable.visibleColumns` so users
    // see exactly what they're rearranging.
    const byField = new Map<string, ColumnDef>(
        defaultColumns.map((c): [string, ColumnDef] => [c.field, c])
    );
    const toggleableInDefaultOrder = defaultColumns.filter(
        (c) => !FIXED_LEADING_FIELDS.includes(c.field)
    );
    const seen = new Set<string>();
    const orderedColumns: ColumnDef[] = [];
    for (const field of fieldOrder) {
        const col = byField.get(field);
        if (!col || FIXED_LEADING_FIELDS.includes(field)) continue;
        orderedColumns.push(col);
        seen.add(field);
    }
    for (const col of toggleableInDefaultOrder) {
        if (!seen.has(col.field)) orderedColumns.push(col);
    }

    const labelFor = (col: ColumnDef): string =>
        col.headerLabelKey ? t.tasks.table.columns[col.headerLabelKey] : col.headerName;

    const isVisible = (col: ColumnDef): boolean => {
        if (col.field in visibilityOverrides) return visibilityOverrides[col.field];
        return !col.hidden;
    };

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        // Compute the new full order from the modal's current displayed
        // list. Submitting the full list (rather than a sparse "move
        // field X to index Y" diff) lets the hook stay dumb: it just
        // stores what we give it, and `visibleColumns` in the table can
        // trust `fieldOrder` as authoritative when non-empty.
        //
        // This is also what avoids the "PR jumps to top when toggled"
        // bug — visibility toggles never write to `fieldOrder`, so the
        // displayed positions only move when the user actually drags.
        const nextOrder = orderedColumns.map((c) => c.field);
        const [moved] = nextOrder.splice(result.source.index, 1);
        nextOrder.splice(result.destination.index, 0, moved);
        setFieldOrder(nextOrder);
    };

    return (
        <Modal open={open} onClose={onClose}>
            <ModalDialog
                size="md"
                sx={{
                    // Wider than the original 440px so the two sections
                    // ("Customize columns" + "Task sort") can sit side
                    // by side at md+ without crowding either side.
                    // Below md the layout falls back to a single column.
                    width: "92vw",
                    maxWidth: 820,
                    maxHeight: "85vh",
                    overflowY: "auto",
                    borderRadius: "xl",
                    p: 2.5,
                }}
            >
                {/* Action row — no modal-level title here. The left/right
                    section headings inside the body label the modal's
                    two halves, and a duplicate "Customize columns"
                    above the left column would just be noise. */}
                <Stack
                    alignItems="center"
                    direction="row"
                    spacing={1}
                    sx={{ mb: 2, justifyContent: "flex-end" }}
                >
                    <AppTooltip title={t.tasks.table.columnSettings.resetTooltip}>
                        <IconButton
                            size="sm"
                            variant="plain"
                            onClick={reset}
                            aria-label={t.tasks.table.columnSettings.resetTooltip}
                        >
                            <RestartAltRoundedIcon />
                        </IconButton>
                    </AppTooltip>
                    <IconButton
                        size="sm"
                        variant="plain"
                        onClick={onClose}
                        aria-label={t.common.actions.close}
                    >
                        <CloseRoundedIcon />
                    </IconButton>
                </Stack>

                <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={2}
                    sx={{ alignItems: "flex-start" }}
                >
                    {/* LEFT — Customize columns */}
                    <Box sx={{ flex: 1, minWidth: 0, width: { xs: "100%", md: "auto" } }}>
                        <Typography level="title-md" sx={{ mb: 0.5 }}>
                            {t.tasks.table.columnSettings.heading}
                        </Typography>
                        <Typography level="body-xs" sx={{ mb: 1.5 }}>
                            {t.tasks.table.columnSettings.description}
                        </Typography>

                        <DragDropContext onDragEnd={handleDragEnd}>
                            <Droppable droppableId="column-settings-list">
                                {(provided) => (
                                    <Stack
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        spacing={0}
                                        sx={{
                                            border: "1px solid",
                                            borderColor: isDark
                                                ? "rgba(255,255,255,0.08)"
                                                : "rgba(0,0,0,0.08)",
                                            borderRadius: "lg",
                                            overflow: "hidden",
                                        }}
                                    >
                                        {orderedColumns.map((col, index) => (
                                            <Draggable
                                                key={col.field}
                                                draggableId={col.field}
                                                index={index}
                                            >
                                                {(dragProvided, snapshot) => (
                                                    <Stack
                                                        ref={dragProvided.innerRef}
                                                        {...dragProvided.draggableProps}
                                                        direction="row"
                                                        alignItems="center"
                                                        spacing={1}
                                                        sx={{
                                                            px: 1.25,
                                                            py: 1,
                                                            borderBottom:
                                                                index === orderedColumns.length - 1
                                                                    ? "none"
                                                                    : "1px solid",
                                                            borderColor: isDark
                                                                ? "rgba(255,255,255,0.06)"
                                                                : "rgba(0,0,0,0.06)",
                                                            background: snapshot.isDragging
                                                                ? isDark
                                                                    ? "rgba(167,139,250,0.12)"
                                                                    : "rgba(124,58,237,0.08)"
                                                                : "transparent",
                                                            transition:
                                                                "background-color 0.1s ease",
                                                        }}
                                                    >
                                                        <Box
                                                            {...dragProvided.dragHandleProps}
                                                            sx={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                cursor: "grab",
                                                                color: isDark
                                                                    ? "rgba(255,255,255,0.4)"
                                                                    : "rgba(0,0,0,0.35)",
                                                                "&:active": { cursor: "grabbing" },
                                                            }}
                                                            title={
                                                                t.tasks.table.columnSettings
                                                                    .dragHandle
                                                            }
                                                        >
                                                            <DragIndicatorRoundedIcon
                                                                sx={{ fontSize: 18 }}
                                                            />
                                                        </Box>
                                                        <Typography
                                                            level="body-sm"
                                                            sx={{ flex: 1, fontWeight: 500 }}
                                                        >
                                                            {labelFor(col)}
                                                        </Typography>
                                                        <Switch
                                                            size="sm"
                                                            checked={isVisible(col)}
                                                            onChange={(e) =>
                                                                setVisibility(
                                                                    col.field,
                                                                    e.target.checked
                                                                )
                                                            }
                                                        />
                                                    </Stack>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </Stack>
                                )}
                            </Droppable>
                        </DragDropContext>
                    </Box>

                    {/* Vertical divider between the two sections at md+.
                        Hidden on xs/sm where the layout falls back to a
                        stacked column and the section title alone gives
                        enough visual break. */}
                    <Divider
                        orientation="vertical"
                        sx={{
                            display: { xs: "none", md: "block" },
                            alignSelf: "stretch",
                        }}
                    />

                    {/* RIGHT — Task sort. Translation keys live under
                        `t.settings.taskSort.*` since they were shared
                        with the older copy site and there's no win in
                        duplicating them. */}
                    <Box sx={{ flex: 1, minWidth: 0, width: { xs: "100%", md: "auto" } }}>
                        <Typography level="title-md" sx={{ mb: 0.5 }}>
                            {t.settings.taskSort.heading}
                        </Typography>
                        <Typography level="body-xs" sx={{ mb: 1.5 }}>
                            {t.settings.taskSort.description}
                        </Typography>

                        {/* Task table — up to 2 tiers. Listed first since
                        this modal is "the" task-table settings dialog. */}
                        <Box sx={{ mb: 1.5 }}>
                            <Typography level="title-sm">
                                {t.settings.taskSort.tableLabel}
                            </Typography>
                            <Typography level="body-xs" sx={{ mb: 1 }}>
                                {t.settings.taskSort.tableHelper}
                            </Typography>
                            <Stack spacing={1}>
                                <SortTierRow
                                    label={t.settings.taskSort.primaryLabel}
                                    tier={tableSortTiers[0]}
                                    onChange={(next) =>
                                        setTableSortTiers(setTierAtIndex(tableSortTiers, 0, next))
                                    }
                                />
                                <SortTierRow
                                    disabled={tableSortTiers.length === 0}
                                    label={t.settings.taskSort.secondaryLabel}
                                    tier={tableSortTiers[1]}
                                    onChange={(next) =>
                                        setTableSortTiers(setTierAtIndex(tableSortTiers, 1, next))
                                    }
                                />
                            </Stack>
                        </Box>

                        <Divider />

                        {/* Sprint board — up to 2 tiers, default = []. */}
                        <Box sx={{ mt: 1.5 }}>
                            <Typography level="title-sm">
                                {t.settings.taskSort.sprintBoardLabel}
                            </Typography>
                            <Typography level="body-xs" sx={{ mb: 1 }}>
                                {t.settings.taskSort.sprintBoardHelper}
                            </Typography>
                            <Stack spacing={1}>
                                <SortTierRow
                                    label={t.settings.taskSort.primaryLabel}
                                    tier={sprintBoardSortTiers[0]}
                                    onChange={(next) =>
                                        setSprintBoardSortTiers(
                                            setTierAtIndex(sprintBoardSortTiers, 0, next)
                                        )
                                    }
                                />
                                <SortTierRow
                                    disabled={sprintBoardSortTiers.length === 0}
                                    label={t.settings.taskSort.secondaryLabel}
                                    tier={sprintBoardSortTiers[1]}
                                    onChange={(next) =>
                                        setSprintBoardSortTiers(
                                            setTierAtIndex(sprintBoardSortTiers, 1, next)
                                        )
                                    }
                                />
                            </Stack>
                        </Box>
                    </Box>
                </Stack>

                <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                    <Button size="sm" variant="solid" onClick={onClose}>
                        {t.common.actions.done}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
