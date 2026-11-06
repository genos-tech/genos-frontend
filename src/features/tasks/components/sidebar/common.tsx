import * as React from "react";
import { Box } from "@mui/joy";

import { useSidebarOpen } from "./useSidebarOpen";

export function Toggler({
    defaultExpanded,
    storageKey,
    renderToggle,
    children,
}: {
    defaultExpanded: boolean;
    /** Remembers the folder's open / closed state on this device (MIP-1055). */
    storageKey?: string;
    children: React.ReactNode;
    renderToggle: (params: {
        open: boolean;
        setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    }) => React.ReactNode;
}) {
    const [open, setOpen] = useSidebarOpen(storageKey, defaultExpanded);
    return (
        <React.Fragment>
            {renderToggle({ open, setOpen })}
            <Box
                sx={[
                    {
                        display: "grid",
                        transition: "0.2s ease",
                        "& > *": {
                            overflow: "hidden",
                        },
                    },
                    open ? { gridTemplateRows: "1fr" } : { gridTemplateRows: "0fr" },
                ]}
            >
                {children}
            </Box>
        </React.Fragment>
    );
}
