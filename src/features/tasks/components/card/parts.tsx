/**
 * The small pieces every task surface is made of (MIP-1124). `TaskCard` and
 * `TaskListItem` are built from these plus the shared `StatusLabel`,
 * `PriorityIcon`, `Tag` and `BaseAvatar`, so no surface draws its own id,
 * flag, due date or tag strip.
 *
 * Plain `var(--g-*)` styles through the token object `g`: nothing here asks
 * `isDark`, and a theme or mode change needs no re-render.
 */

import { ReactNode } from "react";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import { Box } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { BaseAvatar } from "../../../../components/ui/avatars/BaseAvatar";
import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { useTranslation } from "../../../../i18n";
import { g, type } from "../../../../theme/tokens";
import { TagListProps } from "../../../../types/tasks";
import { formatTaskDisplayId } from "../../utils/taskDisplayId";
import { Tag } from "../meta/Tag";
import { useCopyState } from "../useCopyState";
import type { DueTone } from "./due";

type TaskIdSource = {
    displayId?: string | null;
    id?: number | string | null;
    taskId?: number | string | null;
};

const idSx = {
    ...type("body-xs"),
    color: g.text.tertiary,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
    flexShrink: 0,
} as const;

const CopyableId = ({ text }: { text: string }) => {
    const { copied, onClick } = useCopyState();
    const { t } = useTranslation();
    return (
        <AppTooltip title={copied ? t.common.ui.copy.copied : t.common.ui.copy.clickToCopy}>
            <Box
                component="span"
                sx={{
                    ...idSx,
                    cursor: "pointer",
                    transition: `color ${g.motion.fast}`,
                    "&:hover": { color: g.accent.text },
                }}
                onClick={onClick(text)}
            >
                {text}
            </Box>
        </AppTooltip>
    );
};

/**
 * A task's display id: quiet tertiary text, the accent only on hover (it is a
 * reference, not the loudest thing in the row). Click copies it. Pass
 * `copyable={false}` where a surface must stay cheap (no tooltip, no state):
 * that is a bare `<span>`.
 */
export const TaskIdText = ({
    task,
    text,
    copyable = true,
}: {
    task?: TaskIdSource | null;
    /** An already-formatted id (milestones format their own). Wins over `task`. */
    text?: string;
    copyable?: boolean;
}) => {
    const label = text ?? formatTaskDisplayId(task);
    if (!label) return null;
    return copyable ? (
        <CopyableId text={label} />
    ) : (
        <Box component="span" sx={idSx}>
            {label}
        </Box>
    );
};

/**
 * The milestone marker. ONE color for it everywhere a milestone is drawn: the
 * orange the table and the sidebar already use, kept as a single constant
 * instead of a literal in each surface. (Not `g.warning`: that is WIP's amber,
 * and a flag must not read as a status.)
 */
const MILESTONE_COLOR = "#f97316";

export const MilestoneFlag = ({ size = 14 }: { size?: number }) => (
    <FlagRoundedIcon
        aria-hidden="true"
        data-testid="MilestoneFlag"
        sx={{ fontSize: size, color: MILESTONE_COLOR, flexShrink: 0 }}
    />
);

const DUE_COLOR: Record<DueTone, string> = {
    overdue: g.danger.text,
    today: g.warning.text,
    soon: g.warning.text,
    later: g.text.tertiary,
    none: g.text.tertiary,
};

/** A due date: tertiary text, amber when it is today or soon, red when overdue. */
export const DueText = ({
    text,
    tone,
    icon = false,
}: {
    text: string;
    tone: DueTone;
    /** The small clock, for cards (rows carry the text alone). */
    icon?: boolean;
}) => (
    <Box
        component="span"
        data-tone={tone}
        sx={{
            ...type("body-xs"),
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            minWidth: 0,
            color: DUE_COLOR[tone],
            fontWeight: tone === "overdue" ? 500 : 400,
            whiteSpace: "nowrap",
        }}
    >
        {icon && <AccessTimeRoundedIcon aria-hidden="true" sx={{ fontSize: 12, flexShrink: 0 }} />}
        <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {text}
        </Box>
    </Box>
);

/** The assignee as a 24px (row) or 20px (card) avatar. No presence dot, and not
 *  clickable: the surface around it is what opens the task. */
export const AssigneeAvatar = ({
    userId,
    size = "sm",
}: {
    userId: string | number | null | undefined;
    size?: "xs" | "sm";
}) =>
    userId != null && userId !== "" ? (
        <UserAvatar clickable={false} showPulseDot={false} size={size} userId={userId} />
    ) : (
        <BaseAvatar
            aria-hidden="true"
            size={size}
            sx={{
                bgcolor: "transparent",
                border: `1px dashed ${g.border.strong}`,
                color: g.text.tertiary,
            }}
        >
            ?
        </BaseAvatar>
    );

/** Up to `max` tags as the neutral `Tag` chip, then "+N". */
export const TagStrip = ({
    tags,
    max = 3,
}: {
    tags: TagListProps[] | null | undefined;
    max?: number;
}) => {
    if (!tags || tags.length === 0) return null;
    return (
        <Box
            data-testid="task-tags"
            sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.5, minWidth: 0 }}
        >
            {tags.slice(0, max).map((tag, i) => (
                <Tag key={`${tag.tagName}-${i}`} color={tag.tagColor} label={tag.tagName} />
            ))}
            {tags.length > max && (
                <Box component="span" sx={{ ...type("body-xs"), color: g.text.tertiary }}>
                    +{tags.length - max}
                </Box>
            )}
        </Box>
    );
};

/** A title: body-sm medium, one line (rows) or clamped to two (cards). */
export const TaskTitle = ({ children, lines = 1 }: { children: ReactNode; lines?: 1 | 2 }) => (
    <Box
        component="span"
        data-testid="task-title"
        sx={{
            ...type("body-sm"),
            fontWeight: 500,
            color: g.text.primary,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            ...(lines === 1
                ? { whiteSpace: "nowrap" }
                : {
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflowWrap: "anywhere",
                  }),
        }}
    >
        {children}
    </Box>
);
