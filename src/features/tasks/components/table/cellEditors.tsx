// The inline editors of the task table (MIP-1121), on Joy and the design tokens.
//
// `DraggableTaskRow` (edit a cell in place) and `QuickAddTaskRow` (the inline
// create row) both used Material `Select` / `TextField` / `Autocomplete` with
// the same ~100 lines of hand-written dark/light styling each, under a Material
// ThemeProvider that had no dark palette (so typed text was near-black on a dark
// row, a bug each row had to patch by hand). Everything here reads the tokens, so
// it follows the theme and mode by variable and needs no `isDark`.
//
// Like for like: same props the rows already passed, same keyboard contract
// (Escape cancels, Enter commits, blur commits), same look at a glance.

import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import {
    Autocomplete,
    AutocompleteOption,
    Box,
    Chip,
    ChipDelete,
    CircularProgress,
    FormControl,
    FormHelperText,
    Input,
    Option,
    Select,
    Typography,
} from "@mui/joy";
import type { SxProps } from "@mui/joy/styles/types";
import { alpha } from "@mui/system";

import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { g } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { EffortLabel } from "../meta/EffortLabel";
import { PriorityIcon } from "../meta/PriorityIcon";
import { StatusLabel } from "../meta/StatusLabel";
import { ProjectTagChip } from "../ProjectTagChip";

// ── shared surfaces ──────────────────────────────────────────────────────────

const fieldSx = {
    // Joy's controls are 2.25rem tall; an inline cell editor is a compact one.
    minHeight: 0,
    borderRadius: g.radius.sm,
    fontSize: "0.8rem",
    "--Input-minHeight": "28px",
    "--Select-minHeight": "28px",
    "--Input-radius": "6px",
    "--Select-radius": "6px",
    // A chip has to fit inside the closed select: Joy's default padding and
    // indicator leave a 105px table cell less than the 70px chip needs.
    "--Select-paddingInline": "4px",
    "--Select-gap": "4px",
    "& .MuiSelect-indicator": { marginInlineStart: 0, "--Icon-fontSize": "0.875rem" },
    "&:hover": { borderColor: g.accent.solid },
    "&:focus-within": {
        borderColor: g.accent.solid,
        "--Input-focusedHighlight": g.accent.solid,
        "--Select-focusedHighlight": g.accent.solid,
    },
} as const;

const popupSx = {
    background: g.surface.raised,
    border: `1px solid ${g.border.default}`,
    borderRadius: g.radius.md,
    boxShadow: g.shadow.md,
    "--List-padding": "4px",
} as const;

const optionSx = {
    py: 0.75,
    px: 1,
    borderRadius: g.radius.sm,
    minHeight: 0,
    "&:hover": { background: g.hover },
} as const;

const asArray = (sx?: SxProps) => (Array.isArray(sx) ? sx : [sx]);

// ── PillChip: the table's read-only/clickable value chips ─────────────────────
//
// A status / priority / effort / weight / sprint pill. Plain spans on purpose: the
// table draws one per row per column (hundreds), and a Joy `Chip` is several
// elements plus the variant machinery each. Takes `label` and an optional leading
// `icon` like the Material chip it replaces, and the callers' `sx` (colors, hover).

export const PillChip = ({
    label,
    icon,
    onClick,
    sx,
    title,
}: {
    label: ReactNode;
    icon?: ReactNode;
    onClick?: (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => void;
    sx?: SxProps;
    title?: string;
}) => (
    <Box
        className="pill-chip"
        component="span"
        title={title}
        sx={[
            {
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                boxSizing: "border-box",
                maxWidth: "100%",
                height: 24,
                px: "8px",
                borderRadius: "16px",
                fontSize: "var(--g-type-body-sm-size, 0.8125rem)",
                fontWeight: 500,
                lineHeight: 1,
                whiteSpace: "nowrap",
                verticalAlign: "middle",
                "& > .pill-icon": { display: "inline-flex", ml: "-2px" },
                "& > .pill-label": { overflow: "hidden", textOverflow: "ellipsis" },
            },
            ...asArray(sx),
        ]}
        {...(onClick
            ? {
                  role: "button",
                  tabIndex: 0,
                  onClick,
                  onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
                      if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onClick(event);
                      }
                  },
              }
            : {})}
    >
        {icon ? <span className="pill-icon">{icon}</span> : null}
        <span className="pill-label">{label}</span>
    </Box>
);

/** A status / priority / effort chip as the table colors it (the color at 75%, its own label color). */
export const ValueChip = ({
    label,
    color,
    textColor,
    minWidth,
    icon,
}: {
    label: string;
    color: string;
    textColor: string | null | undefined;
    minWidth: number;
    icon?: ReactNode;
}) => (
    <PillChip
        icon={icon}
        label={label}
        sx={{
            backgroundColor: alpha(color || "#888", 0.75),
            color: textColor ?? undefined,
            fontWeight: "bold",
            borderRadius: "5px",
            minWidth,
        }}
    />
);

// ── The quiet cell values (MIP-1123) ─────────────────────────────────────────
//
// Status, priority and effort in the table are the SHARED components (color in the
// icon, words neutral), not solid colored chips. `CellButton` is the click target
// around one: a plain span (hundreds per table), a real button for the keyboard,
// the row-hover tint on hover.

export const CellButton = ({
    onClick,
    children,
    label,
}: {
    onClick: () => void;
    children: ReactNode;
    /** Accessible name when the content is an icon alone. */
    label?: string;
}) => (
    <Box
        aria-label={label}
        component="span"
        role="button"
        tabIndex={0}
        sx={{
            display: "inline-flex",
            alignItems: "center",
            height: 24,
            maxWidth: "100%",
            px: "6px",
            borderRadius: g.radius.sm,
            cursor: "pointer",
            minWidth: 0,
            "&:hover": { background: g.hover },
            "&:focus-visible": { outline: `2px solid ${g.focus}`, outlineOffset: "-1px" },
        }}
        onClick={(event: MouseEvent<HTMLElement>) => {
            event.stopPropagation();
            onClick();
        }}
        onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onClick();
            }
        }}
    >
        {children}
    </Box>
);

// Re-exported: the label moved to `meta/` so the chat bundle can use it without the table editors.
export { EffortLabel };

/** The three option lists of the cell selects, as the quiet components. */
export const statusSelectNode = (status: string) => <StatusLabel status={status} />;
export const prioritySelectNode = (priority: string) => (
    <PriorityIcon priority={priority} showLabel />
);
export const effortSelectNode = (level: string) => <EffortLabel level={level} />;

// ── ChipSelect: a Select whose value and options are chips ────────────────────

export type ChipSelectOption = { value: string; node: ReactNode };

export const ChipSelect = ({
    value,
    options,
    onChange,
    onClose,
    open,
    disabled,
    empty,
    minWidth,
    fullWidth = true,
}: {
    value: string;
    options: ChipSelectOption[];
    onChange: (value: string) => void;
    /** Called when the list closes (pick, Escape, click away). */
    onClose?: () => void;
    /** Controlled list visibility; the table opens the editor already open. */
    open?: boolean;
    disabled?: boolean;
    /** When set, a leading "no value" option (value "") is offered and shown as this. */
    empty?: ReactNode;
    minWidth?: number;
    fullWidth?: boolean;
}) => {
    const all: ChipSelectOption[] = empty ? [{ value: "", node: empty }, ...options] : options;

    // The table mounts this already open, with focus still on the cell that was
    // clicked, so Joy never sees an Escape or a click-away and the editor stayed
    // open when nothing was picked (MIP-1175). While it is controlled-open, close it
    // ourselves: Escape anywhere, or a press outside the select and its list.
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: globalThis.KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            onCloseRef.current?.();
        };
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Element | null;
            if (target?.closest?.('[role="listbox"], [role="combobox"]')) return;
            onCloseRef.current?.();
        };
        document.addEventListener("keydown", onKeyDown, true);
        document.addEventListener("pointerdown", onPointerDown, true);
        return () => {
            document.removeEventListener("keydown", onKeyDown, true);
            document.removeEventListener("pointerdown", onPointerDown, true);
        };
    }, [open]);

    return (
        <Select
            disabled={disabled}
            size="sm"
            value={value}
            {...(open !== undefined ? { listboxOpen: open } : {})}
            sx={[fieldSx, { minWidth, width: fullWidth ? "100%" : undefined }]}
            renderValue={(selected) =>
                all.find((o) => o.value === (selected?.value ?? value))?.node ?? null
            }
            slotProps={{
                listbox: { sx: popupSx },
                // The closed select shows the chip at its natural width: a chip's own
                // minimum (for the option list) would truncate it in a narrow cell.
                button: { sx: { "& .pill-chip": { minWidth: 0, px: "4px", gap: "2px" } } },
            }}
            onChange={(_, next) => {
                if (next !== null && next !== undefined) onChange(next);
            }}
            onListboxOpenChange={(isOpen) => {
                if (!isOpen) onClose?.();
            }}
        >
            {all.map((opt) => (
                <Option
                    key={opt.value || "__empty"}
                    label={opt.value}
                    sx={optionSx}
                    value={opt.value}
                >
                    {opt.node}
                </Option>
            ))}
        </Select>
    );
};

// ── CellTextInput: the title / text-field editor ──────────────────────────────

// A title is typed into this field, so it is taller than the 28px a select or
// picker in a cell is (MIP-1156: "so tight when editing the title").
// (`fieldSx` sets `minHeight: 0`, so the height has to be a real min-height: the
// `--Input-minHeight` variable alone is not read.)
const titleFieldSx = { minHeight: 34, fontSize: "0.875rem" } as const;

export const CellTextInput = ({
    value,
    onChange,
    onBlur,
    onKeyDown,
    placeholder,
    disabled,
    busy,
    error,
    autoFocus,
    sx,
}: {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
    placeholder?: string;
    disabled?: boolean;
    /** Shows a spinner at the end while a save is in flight. */
    busy?: boolean;
    /** An error message: turns the field red and is shown under it. */
    error?: string | null;
    autoFocus?: boolean;
    sx?: SxProps;
}) => (
    <FormControl error={!!error} sx={{ width: "100%", minWidth: 0 }}>
        <Input
            autoFocus={autoFocus}
            disabled={disabled}
            error={!!error}
            placeholder={placeholder}
            size="sm"
            sx={[fieldSx, titleFieldSx, ...asArray(sx)]}
            value={value}
            endDecorator={
                busy ? (
                    <CircularProgress size="sm" sx={{ "--CircularProgress-size": "14px" }} />
                ) : null
            }
            onBlur={onBlur}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
        />
        {error ? (
            <FormHelperText sx={{ mx: 0.5, my: 0, fontSize: "0.7rem" }}>{error}</FormHelperText>
        ) : null}
    </FormControl>
);

// ── MemberAutocomplete: pick one team member ──────────────────────────────────

const matchesMember = (member: UserProps, term: string) =>
    member.userName.toLowerCase().includes(term) || member.userEmail.toLowerCase().includes(term);

export const MemberAutocomplete = ({
    members,
    value,
    onChange,
    onClose,
    placeholder,
    disabled,
    autoFocus,
    open,
    blurOnSelect,
    clearOnBlur,
    showEmail,
    minWidth,
}: {
    members: UserProps[];
    value: UserProps | null;
    onChange: (member: UserProps | null) => void;
    onClose?: (reason: string) => void;
    placeholder?: string;
    disabled?: boolean;
    autoFocus?: boolean;
    open?: boolean;
    blurOnSelect?: boolean;
    clearOnBlur?: boolean;
    /** A second line with the address under each name (the row's own editor has it). */
    showEmail?: boolean;
    minWidth?: number;
}) => (
    <Autocomplete
        autoFocus={autoFocus}
        blurOnSelect={blurOnSelect}
        clearOnBlur={clearOnBlur}
        disabled={disabled}
        getOptionLabel={(option) => `${option.userName} ${option.userEmail}`}
        isOptionEqualToValue={(option, selected) => option.userId === selected?.userId}
        options={members}
        placeholder={placeholder}
        size="sm"
        slotProps={{ listbox: { sx: { ...popupSx, maxHeight: 280 } } }}
        sx={[fieldSx, { width: "100%", minWidth }]}
        value={value}
        {...(open !== undefined ? { open } : {})}
        filterOptions={(options, { inputValue }) => {
            const term = inputValue.toLowerCase();
            return options.filter((option) => matchesMember(option, term));
        }}
        renderOption={(optionProps, option) => (
            <AutocompleteOption
                {...optionProps}
                key={option.userId}
                sx={{ ...optionSx, gap: 1.5 }}
            >
                <UserAvatar clickable={false} showPulseDot={false} userId={option.userId} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                        level="body-sm"
                        sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                        {option.userName}
                    </Typography>
                    {showEmail ? (
                        <Typography
                            level="body-xs"
                            sx={{
                                color: g.text.tertiary,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {option.userEmail}
                        </Typography>
                    ) : null}
                </Box>
            </AutocompleteOption>
        )}
        onChange={(_, next) => onChange(next)}
        onClose={(_, reason) => onClose?.(reason)}
    />
);

// ── TagAutocomplete: pick several tags / options ──────────────────────────────

export const TagAutocomplete = <T,>({
    options,
    value,
    onChange,
    getLabel,
    getColor,
    isEqual,
    placeholder,
    disabled,
    autoFocus,
    minWidth,
    persistent,
    onBlur,
    onKeyDown,
}: {
    options: T[];
    value: T[];
    onChange: (next: T[]) => void;
    getLabel: (option: T) => string;
    getColor: (option: T) => string;
    isEqual: (a: T, b: T) => boolean;
    placeholder?: string;
    disabled?: boolean;
    autoFocus?: boolean;
    minWidth?: number;
    /** Keep the list open after a pick and open it on focus (the in-row editor). */
    persistent?: boolean;
    onBlur?: () => void;
    onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
}) => (
    <Autocomplete
        autoFocus={autoFocus}
        disabled={disabled}
        getOptionLabel={getLabel}
        isOptionEqualToValue={isEqual}
        options={options}
        placeholder={value.length === 0 ? placeholder : ""}
        size="sm"
        slotProps={{ listbox: { sx: popupSx } }}
        sx={[fieldSx, { width: "100%", minWidth, py: "2px", px: "6px" }]}
        value={value}
        multiple
        {...(persistent
            ? { autoHighlight: true, disableCloseOnSelect: true, openOnFocus: true }
            : {})}
        renderOption={(optionProps, option) => (
            <AutocompleteOption
                {...optionProps}
                key={getLabel(option)}
                sx={{
                    ...optionSx,
                    py: 0.5,
                    '&[aria-selected="true"]': { background: g.accent.subtle },
                }}
            >
                <ProjectTagChip label={getLabel(option)} tagColor={getColor(option)} />
            </AutocompleteOption>
        )}
        renderTags={(tagValue, getTagProps) =>
            tagValue.map((option, index) => {
                const { key, onClick, disabled: tagDisabled } = getTagProps({ index });
                return (
                    <Chip
                        key={key}
                        endDecorator={<ChipDelete disabled={tagDisabled} onClick={onClick} />}
                        size="sm"
                        variant="outlined"
                        sx={{
                            minHeight: 0,
                            height: 22,
                            fontSize: "var(--g-type-body-xs-size, 0.75rem)",
                            fontWeight: 600,
                            borderColor: getColor(option),
                            borderStyle: "solid",
                            borderWidth: 1,
                            background: g.surface.default,
                            color: g.text.primary,
                        }}
                    >
                        {getLabel(option)}
                    </Chip>
                );
            })
        }
        onBlur={onBlur}
        onChange={(_, next) => onChange(next as T[])}
        onKeyDown={onKeyDown}
    />
);
