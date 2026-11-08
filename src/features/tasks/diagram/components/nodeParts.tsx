/**
 * The small pieces the task graph's two node cards are made of (MIP-1124 3/3).
 * The card surface is the family's `TaskCardFrame`; the id, status, priority,
 * due text and flag are the family's parts. What is here is only what a graph
 * node adds: the connection handles, the quiet badges, the icon buttons and the
 * schedule editor.
 *
 * Plain `var(--g-*)` styles through `g`: nothing here asks `isDark`, so a mode
 * change does not re-render the nodes (the date editor, which is mounted only
 * while it is open, is the one exception).
 */

import { ReactNode, useState } from "react";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import { Box, Button, FormControl, FormLabel, IconButton, Input, Stack } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Handle, Position } from "@xyflow/react";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { g, type } from "../../../../theme/tokens";
import { DEPENDENCY_COLOR, HANDLE } from "../types";
import type { ScheduleHealthTone } from "../utils/scheduleStatus";
import { HEALTH_COLOR } from "./nodeTone";

// --- handles -----------------------------------------------------------------

const HANDLE_BASE = {
    width: 10,
    height: 10,
    border: "2px solid",
    borderRadius: "50%",
    borderColor: g.surface.default,
} as const;

const STRUCTURE_STYLE = { ...HANDLE_BASE, background: g.accent.solid } as const;
const DEPENDENCY_STYLE = { ...HANDLE_BASE, background: DEPENDENCY_COLOR } as const;

/**
 * The four connection points of a node: parent and child on the top and bottom
 * (structure), blocker and blocked on the left and right (dependency). A ghost
 * (a task from outside the tree) is a read-only window, so all four are inert
 * and dimmed there. Handle positions are physical on purpose: the edges are
 * drawn in the same physical space, in `ar` too.
 */
export const NodeHandles = ({
    structureConnectable,
    dependencyConnectable,
    dim = false,
}: {
    structureConnectable: boolean;
    dependencyConnectable: boolean;
    dim?: boolean;
}) => {
    const opacity = dim ? 0.35 : undefined;
    return (
        <>
            <Handle
                id={HANDLE.structureTop}
                isConnectable={structureConnectable}
                position={Position.Top}
                style={{ ...STRUCTURE_STYLE, opacity }}
                type="target"
            />
            <Handle
                id={HANDLE.structureBottom}
                isConnectable={structureConnectable}
                position={Position.Bottom}
                style={{ ...STRUCTURE_STYLE, opacity }}
                type="source"
            />
            <Handle
                id={HANDLE.dependencyLeft}
                isConnectable={dependencyConnectable}
                position={Position.Left}
                style={{ ...DEPENDENCY_STYLE, opacity }}
                type="target"
            />
            <Handle
                id={HANDLE.dependencyRight}
                isConnectable={dependencyConnectable}
                position={Position.Right}
                style={{ ...DEPENDENCY_STYLE, opacity }}
                type="source"
            />
        </>
    );
};

// --- quiet badges --------------------------------------------------------------

const badgeText = { ...type("body-xs"), whiteSpace: "nowrap" } as const;

/** The open-blocker count: a small "blocked" mark and the number, in the
 *  warning color (the count is what needs attention). */
export const BlockerCount = ({ count, tooltip }: { count: number; tooltip: string }) => (
    <AppTooltip title={tooltip}>
        <Box
            component="span"
            data-testid="node-blockers"
            sx={{
                ...badgeText,
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                flexShrink: 0,
                fontWeight: 500,
                color: g.warning.text,
                "--Icon-color": g.warning.text,
            }}
        >
            <BlockRoundedIcon aria-hidden="true" sx={{ fontSize: 12 }} />
            {count}
        </Box>
    </AppTooltip>
);

/** A milestone's pace verdict: a dot in the verdict's color and the words in
 *  the neutral text color, the same split the status label makes. */
export const HealthLabel = ({
    tone,
    label,
    tooltip,
}: {
    tone: ScheduleHealthTone;
    label: string;
    tooltip: string;
}) => (
    <AppTooltip title={tooltip}>
        <Box
            component="span"
            data-health={tone}
            data-testid="node-health"
            sx={{
                ...badgeText,
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                minWidth: 0,
                fontWeight: 500,
                color: g.text.secondary,
            }}
        >
            <Box
                aria-hidden="true"
                component="span"
                sx={{
                    width: 6,
                    height: 6,
                    flexShrink: 0,
                    borderRadius: g.radius.full,
                    background: HEALTH_COLOR[tone],
                }}
            />
            {label}
        </Box>
    </AppTooltip>
);

/** A neutral outlined label ("External", "Milestone"): the chip of the family's
 *  `Tag`, without a color dot. */
export const NodeBadge = ({ children }: { children: ReactNode }) => (
    <Box
        component="span"
        sx={{
            ...badgeText,
            display: "inline-flex",
            alignItems: "center",
            boxSizing: "border-box",
            height: 20,
            px: 0.625,
            flexShrink: 0,
            borderRadius: g.radius.xs,
            border: `1px solid ${g.border.default}`,
            color: g.text.secondary,
            fontWeight: 500,
        }}
    >
        {children}
    </Box>
);

/** Duration ("5d"): plain tertiary text beside the dates. */
export const DurationText = ({ children }: { children: ReactNode }) => (
    <Box
        component="span"
        data-testid="node-duration"
        sx={{ ...badgeText, color: g.text.tertiary, fontVariantNumeric: "tabular-nums" }}
    >
        {children}
    </Box>
);

// --- icon button ---------------------------------------------------------------

/** The quiet icon button of a node ("open", "add"): tertiary, the primary text
 *  color on hover. */
export const NodeIconButton = ({
    onClick,
    children,
    size = 22,
}: {
    onClick: () => void;
    children: ReactNode;
    size?: number;
}) => (
    <IconButton
        size="sm"
        variant="plain"
        sx={{
            "--IconButton-size": `${size}px`,
            color: g.text.tertiary,
            "--Icon-color": g.text.tertiary,
            borderRadius: g.radius.sm,
            "&:hover": {
                background: g.hover,
                color: g.text.primary,
                "--Icon-color": g.text.primary,
            },
        }}
        onClick={onClick}
    >
        {children}
    </IconButton>
);

// --- the schedule editor ---------------------------------------------------------

/**
 * The start / due editor a node opens from its date text. Mounted only while it
 * is open (the drafts start from the task's dates each time), so it is also the
 * only part of a node that follows the color scheme by hook: a mode change
 * re-renders the open editor, never the graph.
 *
 * `zIndex` is the graph's popup layer (host z + 1): Joy's default modal z would
 * put it behind the enclosing diagram dialog.
 */
export const NodeDateEditor = ({
    startDate,
    dueDate,
    zIndex,
    onClose,
    onSave,
}: {
    startDate: string | null | undefined;
    dueDate: string | null | undefined;
    zIndex: number;
    onClose: () => void;
    onSave: (patch: { startDate: string | null; dueDate: string | null }) => void;
}) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const [draftStart, setDraftStart] = useState<string>(startDate ?? "");
    const [draftDue, setDraftDue] = useState<string>(dueDate ?? "");
    const labelSx = { color: g.text.tertiary, fontWeight: 600 } as const;
    const pickerSx = {
        "& input::-webkit-calendar-picker-indicator": {
            filter: isDark ? "invert()" : "none",
            cursor: "pointer",
        },
    } as const;
    return (
        // Empty inputs flow through as `null`, so a date is cleared by blanking
        // the field.
        <ModalFrame
            icon={<CalendarMonthRoundedIcon sx={{ fontSize: 18, color: g.accent.text }} />}
            size="sm"
            title="Edit schedule"
            zIndex={zIndex}
            actions={
                <>
                    <Button color="neutral" size="sm" variant="plain" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        variant="solid"
                        onClick={() =>
                            onSave({ startDate: draftStart || null, dueDate: draftDue || null })
                        }
                    >
                        Save
                    </Button>
                </>
            }
            open
            onClose={onClose}
        >
            <Stack spacing={1.5}>
                <FormControl size="sm">
                    <FormLabel sx={labelSx}>Start date</FormLabel>
                    <Input
                        sx={pickerSx}
                        type="date"
                        value={draftStart}
                        onChange={(e) => setDraftStart(e.target.value)}
                    />
                </FormControl>
                <FormControl size="sm">
                    <FormLabel sx={labelSx}>Due date</FormLabel>
                    <Input
                        sx={pickerSx}
                        type="date"
                        value={draftDue}
                        onChange={(e) => setDraftDue(e.target.value)}
                    />
                </FormControl>
            </Stack>
        </ModalFrame>
    );
};
