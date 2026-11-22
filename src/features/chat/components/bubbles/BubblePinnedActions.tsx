import { ReactNode } from "react";
import { IconButton, useColorScheme } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { PinnableBubbleAction } from "../../../../hooks/common/bubbleActionsPreferenceState";
import { MARK_DONE_ACTION } from "./markDoneAction";

/** One action on the hover toolbar: one the user pinned (MIP-803), or Mark done. */
export type PinnedBubbleAction = {
    id: PinnableBubbleAction | typeof MARK_DONE_ACTION;
    label: string;
    icon: ReactNode;
    onClick: () => void;
    /** Shown in the accent colour, like the matching row in the "…" menu. */
    active?: boolean;
    danger?: boolean;
};

/**
 * The pinned buttons, drawn like the "…" trigger beside them (28px, same
 * hover). They sit in the hover toolbar's own flex row, so a click is stopped
 * here: the bubble underneath treats a click as "open the thread".
 */
export const BubblePinnedActions = ({ actions }: { actions: PinnedBubbleAction[] }) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    return (
        <>
            {actions.map((action) => (
                <AppTooltip key={action.id} size="sm" title={action.label}>
                    <IconButton
                        aria-label={action.label}
                        aria-pressed={action.active === true ? true : undefined}
                        size="sm"
                        sx={{
                            width: 28,
                            height: 28,
                            borderRadius: "8px",
                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                            color: action.danger
                                ? isDark
                                    ? "var(--gp-tint-danger)"
                                    : "var(--gp-tint-danger-alt)"
                                : action.active
                                  ? isDark
                                      ? "var(--gp-brandalt-300)"
                                      : "var(--gp-brand-700)"
                                  : isDark
                                    ? "rgba(255,255,255,0.55)"
                                    : "rgba(0,0,0,0.45)",
                            background: action.active
                                ? isDark
                                    ? "rgba(var(--gp-brand-700-rgb), 0.22)"
                                    : "rgba(var(--gp-brand-700-rgb), 0.12)"
                                : "transparent",
                            "&:hover": {
                                background: isDark
                                    ? "rgba(var(--gp-brand-700-rgb), 0.28)"
                                    : "rgba(var(--gp-brand-700-rgb), 0.15)",
                                color: isDark ? "var(--gp-brandalt-300)" : "var(--gp-brand-700)",
                                transform: "scale(1.08)",
                            },
                            "&:active": { transform: "scale(0.95)" },
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            action.onClick();
                        }}
                    >
                        {action.icon}
                    </IconButton>
                </AppTooltip>
            ))}
        </>
    );
};
