// Shared listbox slot styling for both autocompletes. Joy's default
// listbox lays options flush against each other with no breathing room
// and only a faint focus background, which felt cramped (see user
// feedback). This pads each option, separates them slightly, rounds the
// corners, and adds a real hover/selected colour that adapts to dark
// and light mode via Joy palette CSS variables.
export const OPTION_LISTBOX_SLOT_PROPS = {
    listbox: {
        sx: {
            py: 0.5,
            "& > li[role='option']": {
                px: 1.25,
                py: 0.6,
                mx: 0.5,
                my: 0.25,
                borderRadius: "8px",
                cursor: "pointer",
                transition: "background-color 0.15s ease, color 0.15s ease, transform 0.15s ease",
                "&:hover": {
                    backgroundColor: "var(--joy-palette-neutral-plainHoverBg)",
                    transform: "translateX(1px)",
                },
                "&.Mui-focused, &.Mui-focusVisible": {
                    backgroundColor: "var(--joy-palette-neutral-plainHoverBg)",
                },
                "&[aria-selected='true']": {
                    backgroundColor: "var(--joy-palette-primary-softBg)",
                    color: "var(--joy-palette-primary-softColor)",
                    "&:hover": {
                        backgroundColor: "var(--joy-palette-primary-softHoverBg)",
                    },
                },
            },
        },
    },
} as const;
