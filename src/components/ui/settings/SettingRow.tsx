import type { MouseEvent } from "react";
import { Stack, StackProps } from "@mui/joy";

import { SETTING_ROW_CLASS, settingRowSx } from "./settingRowStyles";
import { toggleRowSwitch } from "./toggleRowSwitch";

type SettingRowProps = StackProps & {
    /** The row's control is disabled: no hover or focus plate. */
    disabled?: boolean;
    /** The row has its own fill (a muted-list row): the plate mixes over it. */
    filled?: boolean;
};

/**
 * One row of a Settings panel: text on the start side, a control on the end.
 * Carries the shared quiet hover and keyboard-focus plate (see `settingRowStyles`), and a click on
 * its text flips its switch (see `toggleRowSwitch`).
 * Lays out like the `Stack` it wraps, so a caller keeps its own direction and alignment.
 */
export const SettingRow = ({
    disabled = false,
    filled = false,
    className,
    sx,
    onClick,
    ...rest
}: SettingRowProps) => (
    <Stack
        className={className ? `${SETTING_ROW_CLASS} ${className}` : SETTING_ROW_CLASS}
        sx={[settingRowSx({ disabled, filled }), ...(Array.isArray(sx) ? sx : [sx])]}
        onClick={(event: MouseEvent<HTMLDivElement>) => {
            onClick?.(event);
            if (!disabled) toggleRowSwitch(event);
        }}
        {...rest}
    />
);
