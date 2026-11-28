/**
 * The sentence's own choices (what it acts on, its trigger, a condition's field and operator):
 * short fixed lists. The values (people, tags, statuses…) are the app's pickers: `pickers.tsx`.
 */
import { ReactNode } from "react";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { Box, Option, Select } from "@mui/joy";

import { focusRing, g, type } from "../../../theme/tokens";
import { useLookups } from "./lookups";
import { useAutomationWords } from "./words";

export type SlotOption = {
    value: string;
    label: string;
    /** How the option and the closed slot draw it, when more than its label. */
    node?: ReactNode;
    /** Why it cannot be picked. */
    disabledReason?: string;
};

type SlotProps = {
    /** The accessible name: the sentence around the slot says it to the eye. */
    label: string;
    value: string;
    options: SlotOption[];
    onChange: (value: string) => void;
    invalid?: boolean;
    describedBy?: string;
    /** Marks the control the editor moves the focus to. */
    slotId?: string;
};

const slotSx = (invalid: boolean) => ({
    ...type("body-sm"),
    fontWeight: 500,
    maxWidth: "100%",
    minWidth: 0,
    minHeight: g.control.sm,
    background: g.surface.raised,
    color: g.text.primary,
    border: "1px solid",
    borderColor: invalid ? g.danger.border : g.border.default,
    borderRadius: g.radius.sm,
    boxShadow: "none",
    "&:hover": { borderColor: invalid ? g.danger.border : g.border.strong },
    // The size of the text fields beside them (16px, so a phone does not zoom in).
    "@media (pointer: coarse)": { minHeight: 44, fontSize: "1rem" },
});

const popup = (zIndex: number) => ({
    sx: { zIndex, maxHeight: 280, maxWidth: "min(320px, 90vw)" },
});

const OptionBody = ({ option }: { option: SlotOption }) => (
    <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Box component="span" sx={{ overflowWrap: "anywhere" }}>
            {option.node ?? option.label}
        </Box>
        {option.disabledReason && (
            <Box component="span" sx={{ ...type("body-xs"), color: g.text.tertiary }}>
                {option.disabledReason}
            </Box>
        )}
    </Box>
);

export const SlotSelect = ({
    label,
    value,
    options,
    onChange,
    invalid = false,
    describedBy,
    slotId,
}: SlotProps) => {
    const words = useAutomationWords();
    const { popupZ } = useLookups();
    const picked = options.find((o) => o.value === value);
    return (
        <Select
            indicator={<ExpandMoreRoundedIcon sx={{ fontSize: 16, color: g.text.tertiary }} />}
            placeholder={words.choose}
            size="sm"
            value={value || null}
            variant="plain"
            renderValue={() => (
                <Box
                    component="span"
                    title={picked?.label}
                    sx={{
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {picked?.node ?? picked?.label ?? words.unknown}
                </Box>
            )}
            slotProps={{
                button: {
                    "aria-label": picked ? `${label}: ${picked.label}` : label,
                    "aria-invalid": invalid || undefined,
                    "aria-describedby": describedBy,
                    "data-slot": slotId,
                },
                listbox: popup(popupZ),
            }}
            sx={{
                ...slotSx(invalid),
                "&.Mui-focusVisible": focusRing,
            }}
            onChange={(_e, next) => {
                if (typeof next === "string") onChange(next);
            }}
        >
            {options.map((o) => (
                <Option
                    key={o.value}
                    disabled={Boolean(o.disabledReason)}
                    label={o.label}
                    value={o.value}
                >
                    <OptionBody option={o} />
                </Option>
            ))}
        </Select>
    );
};
