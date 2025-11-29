import { ReactNode } from "react";
import { List, ListItem } from "@mui/joy";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { NoteTreeToggler } from "./sub/NoteTreeToggler";

interface NoteTypeSectionProps {
    title: string;
    noteType: number;
    icon: ReactNode;
    children: ReactNode;
    useNM: NoteManagementState;
    renderToggle: (
        open: boolean,
        setOpen: (value: boolean) => void,
        noteType: number
    ) => ReactNode;
}

export function NoteTypeSection({
    title,
    noteType,
    icon,
    children,
    useNM,
    renderToggle,
}: NoteTypeSectionProps) {
    return (
        <ListItem nested>
            <NoteTreeToggler
                defaultExpanded={false}
                renderToggle={({ open, setOpen }) => renderToggle(open, setOpen, noteType)}
            >
                <List>{children}</List>
            </NoteTreeToggler>
        </ListItem>
    );
}
