import { KeyboardEvent, useRef } from "react";
import { Box, Chip } from "@mui/joy";

import { focusRing, g } from "../../../theme/tokens";

/**
 * The one 2-3 way switch (Day/Week, By weight/By urgency, ...): a radio group where the
 * selected chip is solid primary and the rest soft neutral, 28 px high. Arrow keys move
 * and select (mirrored in right-to-left), Home / End jump.
 */
export type SegmentedOption<T extends string> = { value: T; label: string };

export const SegmentedChips = <T extends string>({
    options,
    value,
    onChange,
    ariaLabel,
}: {
    options: SegmentedOption<T>[];
    value: T;
    onChange: (v: T) => void;
    ariaLabel: string;
}) => {
    const active = Math.max(
        0,
        options.findIndex((o) => o.value === value)
    );
    const refs = useRef<(HTMLButtonElement | null)[]>([]);
    const move = (to: number) => {
        const i = (to + options.length) % options.length;
        onChange(options[i].value);
        refs.current[i]?.focus();
    };
    const onKeyDown = (e: KeyboardEvent, i: number) => {
        const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
        const next = rtl ? "ArrowLeft" : "ArrowRight";
        const prev = rtl ? "ArrowRight" : "ArrowLeft";
        if (e.key === next || e.key === "ArrowDown") move(i + 1);
        else if (e.key === prev || e.key === "ArrowUp") move(i - 1);
        else if (e.key === "Home") move(0);
        else if (e.key === "End") move(options.length - 1);
        else return;
        e.preventDefault();
    };
    return (
        <Box aria-label={ariaLabel} role="radiogroup" sx={{ display: "flex", gap: 0.5 }}>
            {options.map((o, i) => {
                const selected = o.value === value;
                return (
                    <Chip
                        key={o.value}
                        color={selected ? "primary" : "neutral"}
                        size="sm"
                        variant={selected ? "solid" : "soft"}
                        slotProps={{
                            action: {
                                ref: (el: HTMLButtonElement | null) => {
                                    refs.current[i] = el;
                                },
                                role: "radio",
                                "aria-checked": selected,
                                tabIndex: i === active ? 0 : -1,
                                onClick: () => onChange(o.value),
                                onKeyDown: (e: KeyboardEvent) => onKeyDown(e, i),
                            },
                        }}
                        sx={{
                            minHeight: g.control.sm,
                            "&:has(:focus-visible)": focusRing,
                            "& .MuiChip-action:focus-visible": { outline: "none" },
                        }}
                    >
                        {o.label}
                    </Chip>
                );
            })}
        </Box>
    );
};
