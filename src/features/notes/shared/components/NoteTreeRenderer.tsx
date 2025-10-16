import { memo, ReactNode } from "react";
import { Box, List, ListItem } from "@mui/joy";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { BaseNoteTreeNode } from "../types/noteTypes";
import { NoteTreeToggler } from "./sub/NoteTreeToggler";

interface NoteTreeRendererProps<T extends BaseNoteTreeNode> {
    node: T;
    timestamp: string;
    currentChain: T[] | undefined;
    noteType: number;
    NM: NoteManagementState;
    renderToggle: (open: boolean, setOpen: (value: boolean) => void, node: T) => ReactNode;
    createChildNoteList: (node: T) => ReactNode;
}

function NoteTreeRendererComponent<T extends BaseNoteTreeNode>({
    node,
    timestamp,
    currentChain,
    noteType,
    NM,
    renderToggle,
    createChildNoteList,
}: NoteTreeRendererProps<T>) {
    const isExpanded =
        currentChain?.some((chainedNote) => chainedNote.noteId === node.noteId) ||
        NM.tabItems.some((tabNote) =>
            NM.allNoteIdChains[`${tabNote.noteType}-${tabNote.noteId}`]?.some(
                (chainedNoteId: number) => chainedNoteId === node.noteId
            )
        );

    return (
        <Box key={`note-box-${node.noteId}-${timestamp}`}>
            {currentChain && (
                <ListItem key={`note-${node.noteId}-${timestamp}`} nested>
                    <NoteTreeToggler
                        defaultExpanded={isExpanded}
                        renderToggle={({ open, setOpen }) => renderToggle(open, setOpen, node)}
                    >
                        {node.children.length > 0 && currentChain && (
                            <List>
                                {node.children.map((child) => (
                                    <NoteTreeRenderer
                                        key={child.noteId}
                                        node={child as T}
                                        timestamp={timestamp}
                                        currentChain={currentChain}
                                        noteType={noteType}
                                        NM={NM}
                                        renderToggle={renderToggle}
                                        createChildNoteList={createChildNoteList}
                                    />
                                ))}
                            </List>
                        )}
                        {node.children.length === 0 && createChildNoteList(node)}
                    </NoteTreeToggler>
                </ListItem>
            )}
        </Box>
    );
}

export const NoteTreeRenderer = memo(NoteTreeRendererComponent) as <T extends BaseNoteTreeNode>(
    props: NoteTreeRendererProps<T>
) => React.JSX.Element;
