import { forwardRef, useCallback, useRef, type KeyboardEvent, type Ref } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { IconButton, Input } from "@mui/joy";
import type { SxProps } from "@mui/joy/styles/types";

import { useTranslation } from "../../../i18n";
import { g, type } from "../../../theme/tokens";
import { isImeComposing } from "../../../utils/ime";
import { Spinner } from "../feedback/Skeleton";
import { searchSurfaceSx } from "./searchFieldStyles";

/**
 * The one search box (MIP-1129). Chat lists, the Genos sidebar, the GIF picker,
 * the member pickers and the modals' people lists each had their own `Input`
 * with their own icon, radius, colours and clear button (or none).
 *
 *     [search icon] [ query ............. ] [spinner] [x]
 *
 * - Controlled, like the boxes it replaces: `value` + `onChange(string)`. It
 *   adds no state of its own, so typing re-renders the host exactly as before.
 * - Escape CLEARS a non-empty box (and stops there, so the modal or overlay
 *   around it stays open); on an empty box it is not handled, so the same
 *   Escape closes the surface. Ignored while an input-method composition is
 *   active, where Escape belongs to the IME.
 * - The clear button is a real button with a localized name and gives the focus
 *   back to the field.
 * - `loading` shows the shared `Spinner` before the clear button.
 * - Sizes are the control scale (`g.control`): sm 28, md 32, lg 36 px.
 * - `dir="auto"`: a query typed in Arabic starts at the right, one in English
 *   at the left, whatever the UI direction. Decorators sit on logical sides.
 * - Everything follows the tokens; no `isDark`.
 *
 * Autocomplete boxes (a search that opens a popup list) are not this
 * component: they keep Joy's `Autocomplete` and borrow `searchSurfaceSx` (searchFieldStyles.ts) so
 * the field looks the same.
 */

export type SearchFieldSize = "sm" | "md" | "lg";

const HEIGHT: Record<SearchFieldSize, string> = {
    sm: g.control.sm,
    md: g.control.md,
    lg: g.control.lg,
};

export type SearchFieldProps = {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    /** The field's accessible name; falls back to the placeholder. */
    ariaLabel?: string;
    size?: SearchFieldSize;
    /** A search is in flight: shows the spinner. */
    loading?: boolean;
    autoFocus?: boolean;
    disabled?: boolean;
    /** Accessible name of the clear button; defaults to the localized "Clear search". */
    clearLabel?: string;
    /** Runs after the clear button or Escape emptied the field. */
    onClear?: () => void;
    /** Called first; `preventDefault()` keeps Escape from clearing. */
    onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
    fullWidth?: boolean;
    testId?: string;
    name?: string;
    sx?: SxProps;
    inputRef?: Ref<HTMLInputElement>;
};

export const SearchField = forwardRef<HTMLDivElement, SearchFieldProps>(function SearchField(
    {
        value,
        onChange,
        placeholder,
        ariaLabel,
        size = "md",
        loading = false,
        autoFocus,
        disabled,
        clearLabel,
        onClear,
        onKeyDown,
        fullWidth = true,
        testId,
        name,
        sx,
        inputRef,
    },
    ref
) {
    const { t } = useTranslation();
    const ownRef = useRef<HTMLInputElement | null>(null);
    const setInputRef = useCallback(
        (node: HTMLInputElement | null) => {
            ownRef.current = node;
            if (typeof inputRef === "function") inputRef(node);
            else if (inputRef) (inputRef as { current: HTMLInputElement | null }).current = node;
        },
        [inputRef]
    );

    const clear = () => {
        onChange("");
        onClear?.();
        ownRef.current?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key !== "Escape" || isImeComposing(event) || value === "") return;
        // Clear this box only: the surface around it keeps its own Escape.
        event.preventDefault();
        event.stopPropagation();
        clear();
    };

    const hasValue = value !== "";
    const wide = size === "lg";

    return (
        <Input
            ref={ref}
            disabled={disabled}
            placeholder={placeholder}
            size="sm"
            startDecorator={<SearchRoundedIcon sx={{ fontSize: 18 }} />}
            value={value}
            endDecorator={
                loading || hasValue ? (
                    <>
                        {loading ? <Spinner /> : null}
                        {hasValue ? (
                            <IconButton
                                aria-label={clearLabel ?? t.common.searchField.clear}
                                disabled={disabled}
                                size="sm"
                                variant="plain"
                                sx={{
                                    "--IconButton-size": "20px",
                                    minWidth: 20,
                                    minHeight: 20,
                                    borderRadius: g.radius.full,
                                    color: g.text.tertiary,
                                    "--Icon-color": g.text.tertiary,
                                }}
                                // Keep the field's focus: pressing the button must not blur
                                // the input first (a host that closes on blur would lose it).
                                onClick={clear}
                                onMouseDown={(event) => event.preventDefault()}
                            >
                                <CloseRoundedIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                        ) : null}
                    </>
                ) : null
            }
            slotProps={{
                input: {
                    ref: setInputRef,
                    "aria-label": ariaLabel ?? placeholder,
                    "data-testid": testId,
                    autoComplete: "off",
                    autoFocus,
                    dir: "auto",
                    enterKeyHint: "search",
                    name,
                    type: "search",
                    // `type=search` draws the browser's own clear X in Chromium and
                    // Safari; ours is the one.
                    style: { WebkitAppearance: "none" },
                },
            }}
            sx={[
                searchSurfaceSx,
                {
                    width: fullWidth ? "100%" : undefined,
                    minWidth: 0,
                    "--Input-minHeight": HEIGHT[size],
                    minHeight: HEIGHT[size],
                    "--Input-paddingInline": "8px",
                    "--Input-gap": "6px",
                    ...type(wide ? "body-md" : "body-sm"),
                    "& input::-webkit-search-cancel-button, & input::-webkit-search-decoration": {
                        display: "none",
                    },
                },
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
        />
    );
});
