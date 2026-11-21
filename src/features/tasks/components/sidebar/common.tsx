import * as React from "react";
import { Box, ListItem } from "@mui/joy";

import { useSidebarOpen } from "./useSidebarOpen";

export function Toggler({
    defaultExpanded,
    storageKey,
    renderToggle,
    children,
    asListItem = false,
}: {
    defaultExpanded: boolean;
    /** The Toggler is a direct child of a `<List>`: wrap it in a nested `<li>` so the `ul`
     *  holds only list items (MIP-1955). Its toggle row must then render `as="div"`. */
    asListItem?: boolean;
    /** Remembers the folder's open / closed state on this device (MIP-1055). */
    storageKey?: string;
    children: React.ReactNode;
    renderToggle: (params: {
        open: boolean;
        setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    }) => React.ReactNode;
}) {
    const [open, setOpen] = useSidebarOpen(storageKey, defaultExpanded);
    const body = (
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
    return asListItem ? (
        <ListItem sx={{ p: 0 }} nested>
            {body}
        </ListItem>
    ) : (
        body
    );
}
