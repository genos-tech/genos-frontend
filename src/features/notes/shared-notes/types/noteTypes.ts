export interface BaseNoteTreeNode {
    noteId: number;
    title: string;
    children: BaseNoteTreeNode[];
    noteType: number;
    [key: string]: any;
}

export interface MyNoteMetaTreeNode extends BaseNoteTreeNode {
    noteType: 1;
}

export interface TaskNoteMetaTreeNode extends BaseNoteTreeNode {
    noteType: 2;
    projectId: number;
    taskId: number;
}

export interface ChatNoteMetaTreeNode extends BaseNoteTreeNode {
    noteType: 3;
    chatType: string;
    chatId: number;
    isThread: boolean;
    threadId?: number;
}

export type NoteMetaTreeNode = MyNoteMetaTreeNode | TaskNoteMetaTreeNode | ChatNoteMetaTreeNode;

export interface NoteTreeState<T extends BaseNoteTreeNode> {
    tmpCurrentChain: T[] | undefined;
    tmpMetaTree: T[];
    timestamp: string;
}

export interface UseNoteTreeStateProps<T extends BaseNoteTreeNode> {
    metaTree: T[];
    currentChain: T[] | undefined;
    selectedTabIndex: number;
    currentNote: any;
}
