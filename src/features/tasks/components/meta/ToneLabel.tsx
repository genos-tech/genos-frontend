import type { CSSProperties, ReactNode } from "react";

import { useTranslation } from "../../../../i18n";
import { SPRINT_TONE, toneCss, type Tone } from "../../meta/taskTone";

type ToneLabelProps = {
    tone: Tone;
    /** A small glyph (12px) in the tone's color, before the words. */
    icon?: ReactNode;
    /** A dot in the tone's color instead of a glyph (a state, not an action). */
    dot?: boolean;
    /** `sm` for a headline verdict, `xs` (default) inside a dense strip. */
    size?: "xs" | "sm";
    children: ReactNode;
};

/**
 * A quiet verdict or state that is not a task status (MIP-1191): schedule health
 * ("Behind"), the overdue / due-soon / blocked counts in the graph header, a
 * sprint's lifecycle. It speaks the same visual language as `StatusLabel` and the
 * table's due text: no fill, no border, the color in the glyph (and in the words
 * for the hot tones, as the due date is), the shape of a chip gone.
 *
 * `var(--g-*)` only, so it follows theme and mode with no `isDark`. Plain spans:
 * it renders inside Material subtrees (the table) as well as Joy ones.
 */
export const ToneLabel = ({ tone, icon, dot = false, size = "xs", children }: ToneLabelProps) => {
    const color = toneCss(tone).text;
    const hot = tone === "danger" || tone === "warning";
    return (
        <span
            data-tone={tone}
            style={
                {
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    minWidth: 0,
                    color: hot ? color : "var(--g-text-secondary)",
                    fontSize: `var(--g-type-body-${size}-size, ${size === "sm" ? "0.8125rem" : "0.75rem"})`,
                    fontWeight: tone === "danger" ? 500 : 400,
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                    // Joy's SvgIcon colors itself from --Icon-color, not from `color`.
                    "--Icon-color": color,
                } as CSSProperties
            }
        >
            {dot && (
                <span
                    aria-hidden="true"
                    style={{
                        width: 8,
                        height: 8,
                        flexShrink: 0,
                        borderRadius: "50%",
                        background: color,
                    }}
                    data-tone-dot
                />
            )}
            {icon && (
                <span aria-hidden="true" style={{ display: "inline-flex", flexShrink: 0, color }}>
                    {icon}
                </span>
            )}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{children}</span>
        </span>
    );
};

/**
 * A sprint's lifecycle (upcoming / active / completed / archived): its own small
 * vocabulary, drawn as a dot and a word in the tone `SPRINT_TONE` gives it. ONE
 * component for the sprint manager and the sprint/milestone picker.
 */
export const SprintStatusLabel = ({ status }: { status: string | null | undefined }) => {
    const { t } = useTranslation();
    const key = (status ?? "").trim();
    if (!key) return null;
    const own = Object.prototype.hasOwnProperty;
    const label = own.call(t.tasks.sprint.status, key)
        ? t.tasks.sprint.status[key as keyof typeof t.tasks.sprint.status]
        : key;
    const tone = own.call(SPRINT_TONE, key) ? SPRINT_TONE[key] : "neutral";
    return (
        <ToneLabel tone={tone} dot>
            {label}
        </ToneLabel>
    );
};
