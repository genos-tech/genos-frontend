import { MyNoteProps } from "../../types/notes";
import { GenosNoteEditor, GenosNoteEditorProps } from "./genos/GenosNoteEditor";

type BnMyNoteEditorProps = Omit<GenosNoteEditorProps, "note"> & {
    currentMyNote: MyNoteProps;
};

/**
 * A personal or team note (collaborative, comments, attachments). The editor is `GenosNoteEditor`; this is only what is particular to the kind.
 */
export const BnMyNoteEditor = ({ currentMyNote, ...rest }: BnMyNoteEditorProps) => (
    <GenosNoteEditor
        {...rest}
        note={{
            noteId: currentMyNote.noteId,
            title: currentMyNote.title,
            documentPrefix: "my-note",
            uploadPath: "/note/personal/attachment/",
            commentHost: { surfaceType: 6 },
            imageFilenameStem: "image",
        }}
    />
);
