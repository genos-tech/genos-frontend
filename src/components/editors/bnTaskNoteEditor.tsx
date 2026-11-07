import { TaskNoteProps } from "../../types/notes";
import { GenosNoteEditor, GenosNoteEditorProps } from "./genos/GenosNoteEditor";

type BnTaskNoteEditorProps = Omit<GenosNoteEditorProps, "note"> & {
    currentTaskNote: TaskNoteProps;
};

/**
 * A task note. The editor is `GenosNoteEditor`; this is only what is particular to the kind.
 */
export const BnTaskNoteEditor = ({ currentTaskNote, ...rest }: BnTaskNoteEditorProps) => (
    <GenosNoteEditor
        {...rest}
        note={{
            noteId: currentTaskNote.noteId,
            title: currentTaskNote.title,
            documentPrefix: "task-note",
            uploadPath: "/note/task/attachment/",
            commentHost: {
                surfaceType: 7,
                taskId: currentTaskNote.taskId,
                projectId: currentTaskNote.projectId,
            },
            imageFilenameStem: "task-note-image",
        }}
    />
);
