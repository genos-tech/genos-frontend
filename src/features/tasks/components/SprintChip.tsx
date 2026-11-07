import { CSSProperties } from "react";

import { useTranslation } from "../../../i18n";

type SprintChipProps = {
    /** Resolved sprint name, or null/undefined when the row/milestone has
     *  no sprint — in which case a muted "No Sprint" is shown. */
    name: string | null | undefined;
};

const chip: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    boxSizing: "border-box",
    maxWidth: 120,
    height: 20,
    padding: "0 6px",
    flexShrink: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    borderRadius: "var(--g-radius-xs, 4px)",
    border: "1px solid var(--g-border, rgba(128,128,128,0.2))",
    background: "var(--g-surface, transparent)",
    fontSize: "var(--g-type-body-xs-size, 0.75rem)",
    fontWeight: 500,
    lineHeight: 1,
};

/**
 * Compact, read-only sprint indicator: the neutral chip the table's sprint
 * column draws (a sprint is a place, not a status), or a muted "No Sprint"
 * when there is none. Shared by the dashboard rows and the milestone card
 * body so the sprint pill reads the same everywhere.
 */
export const SprintChip = ({ name }: SprintChipProps) => {
    const { t } = useTranslation();
    const has = !!(name && name.trim());
    return (
        <span
            data-testid="sprint-chip"
            title={has ? name! : undefined}
            style={{
                ...chip,
                color: has ? "var(--g-text-secondary)" : "var(--g-text-tertiary)",
            }}
        >
            {has ? name : t.tasks.fields.noSprint}
        </span>
    );
};
