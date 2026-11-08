import {
    ChangeEvent,
    KeyboardEvent as ReactKeyboardEvent,
    useEffect,
    useRef,
    useState,
} from "react";
import { PartialBlock } from "@blocknote/core";

import { useEditorDraft } from "../../../hooks/common/useEditorDraft";
import { channelService } from "../../../services/channel/channelService";
import { matchesShortcut, type KeyLike } from "../../../shortcuts";
import { useFileSizeGuard } from "../../ui/feedback/useFileSizeGuard";
import { useUploadCounter } from "../../ui/feedback/useUploadCounter";
import { useBlockNoteDictionary } from "../blockNoteI18n";
import { GenosSchema } from "../genos/genosSchema";
import { useGenosEditor } from "../genos/useGenosEditor";
import { hasSendableContent } from "../utils/messageBlocks";

/* eslint-disable @typescript-eslint/no-explicit-any -- the editor's raw block array, as everywhere */

/**
 * The send / upload / draft logic every chat-style composer shares (MIP-1161): chat, thread,
 * task comment, the v3 composer and the three edit-in-place ones.
 *
 * Before this hook each composer carried its own copy (330 to 570 lines each). They agreed on
 * the core and differed in a handful of places, some deliberate and some accidental; those are
 * the options below, so a fix to uploads or drafts lands once and a difference is visible as an
 * option instead of a pasted branch. The per-composer comparison is in the MIP-1161 PR.
 *
 * What it owns:
 *   - creating the editor (`useGenosEditor`, surface `composer`): `uploadFile` has to exist
 *     before the editor, and the drop loop needs the editor, so one hook builds both;
 *   - the upload pipeline: counter badge, size guard, `uploadFile`, the series upload with its
 *     progress, the hidden file picker handler, the queue of files dropped on the pane;
 *   - the draft (`useEditorDraft`), `canSend`, and the Cmd/Ctrl+Enter chord;
 *   - the send flow around the composer's own transport.
 * What it does not own: schema, toolbar, pickers, the surface-specific transport (`submit`),
 * the edit-in-place re-seeding effects, markup.
 *
 * TYPING PERFORMANCE (the rule this hook exists inside of): nothing here is per-keystroke React
 * state. The draft text is never in state (`useEditorDraft` debounces the write, 400 ms);
 * `onChange` reads the document once and calls two things that are no-ops on a repeated value:
 * the parent's line-count setter and `setCanSend`, so a keystroke re-renders the host only when
 * the composer flips between empty and non-empty.
 */

/** Cmd/Ctrl+Enter, the send chord of every composer. */
export const isSendShortcut = (event: KeyLike) => matchesShortcut("composer.send", event);

/** Rough height of a document in lines, reported to hosts that size around the editor. */
export const countEditorLines = (nodes: any[]): number => {
    let count = 0;
    for (const node of nodes) {
        count += 1; // count the current node itself
        if (node.children?.length) {
            count += countEditorLines(node.children);
        }
        // Guarded: image/file blocks carry no `content` array.
        if (node.content && node.content[0]) {
            if (node.content[0].text) {
                count += node.content[0].text.split("\n").length;
            }
        }
        // Add lines for each image to avoid scroll issues.
        if (node.type === "image") {
            count += 10;
        }
    }
    return count;
};

type GenosDictionary = ReturnType<typeof useBlockNoteDictionary>;

export type ComposerClearMode =
    /** Empty the composer, THEN send in the background; put the text back if the send fails
     *  (chat, thread, task comment). */
    | "before"
    /** Keep the text while the request is in flight (a `busy` flag is raised), empty it only
     *  after a clean send (v3). A second send while one is in flight is ignored. */
    | "after"
    /** Never touch the composer: edit-in-place editors are torn down by their host. */
    | "never";

export interface UseChatComposerOptions<R> {
    schema: GenosSchema;
    dictionary: GenosDictionary;
    /** What an edit-in-place composer opens with. Frozen at the first render, like BlockNote. */
    initialContent?: PartialBlock[];

    /** Inline uploads (paste, drop, slash menu, file picker, dropped-on-pane). Omit entirely for
     *  a composer that has none (v3 stages attachments itself, the task-comment editor). With
     *  `{ channelId: undefined }` the guard still runs but there is no `uploadFile`, so file
     *  inserts stay inert (a task without a project channel). */
    uploads?: { channelId: string | undefined };
    /** Files dropped on the pane around the composer, uploaded in series and inserted as blocks.
     *  The queue is cleared synchronously, before any await, so a remount mid-upload cannot
     *  insert every file twice; the upload is guarded and counted. Ignored without a channel. */
    dropQueue?: { files?: File[]; clear?: () => void };

    /** `null`/omitted: no draft (edit-in-place). */
    draftKey?: string | null;
    /** Edit-in-place starts with Send already enabled. */
    initialCanSend?: boolean;
    /** Called with the line count on every change (hosts that size around the editor). */
    onLinesChange?: (lines: number) => void;

    /** Replaces `hasSendableContent` (v3: its own rule, and staged attachments count). */
    isSendable?: (blocks: any[]) => boolean;
    /** An extra guard before anything is touched (no socket, no task id). */
    canSubmit?: () => boolean;
    clear?: ComposerClearMode;
    /** The transport. Receives the document read synchronously at the moment of the send (an
     *  edit-in-place host unmounts the editor right after firing it, so there must be no await
     *  before this call). Resolve `false` for a failed send: with `clear: "before"` the text is
     *  put back when the composer is still empty, with `"after"` it is not cleared. */
    submit: (blocks: any[]) => Promise<R | false | void> | R | false | void;
    /** After a clean send and the clear (`clear: "after"`): the v3 composer's own cleanup. */
    onSent?: (result: R) => void;
    /** Called synchronously right after the chord or `trigger()` has started a send, whether or
     *  not the guards let it through (edit-in-place hosts close their editor here, as they
     *  always did, even when there was nothing to save). */
    onSendAttempt?: () => void;
}

const fileBlock = (file: File, url: string) =>
    file.type.startsWith("image/")
        ? { type: "image", props: { url, name: file.name } }
        : { type: "file", props: { url, name: file.name } };

export const useChatComposer = <R = void>(options: UseChatComposerOptions<R>) => {
    const {
        schema,
        dictionary,
        initialContent,
        uploads,
        dropQueue,
        draftKey = null,
        initialCanSend = false,
        onLinesChange,
        isSendable = hasSendableContent,
        canSubmit,
        clear = "before",
        submit,
        onSent,
        onSendAttempt,
    } = options;

    // Counter wraps every `uploadFile` call so the "Uploading n files" pill reflects in-flight
    // work both for BlockNote's own inserts (slash menu, drag, paste: it calls `uploadFile`
    // directly) and for the drop loop. The guard rejects oversize files before any fetch and
    // feeds the snackbar.
    const { activeCount: editorUploadCount, wrap: trackUpload } = useUploadCounter();
    const { rejection, dismissRejection, filterFiles, guardUploadFile } = useFileSizeGuard({
        enabled: uploads !== undefined,
    });

    const uploadChannelId = uploads?.channelId;
    const uploadFile = uploadChannelId
        ? guardUploadFile(
              trackUpload(async (file: File) =>
                  channelService.uploadInlineFile(uploadChannelId, file)
              )
          )
        : undefined;

    // `useCreateBlockNote` keeps the options of the FIRST render, and the composer is not keyed
    // per chat, so a paste or drag after switching chats used to upload to the channel of the
    // chat opened FIRST (MIP-1223). BlockNote therefore gets a thin function that calls the
    // CURRENT render's `uploadFile` through a ref; whether BlockNote has one at all is still
    // decided at mount (no channel at mount: its own file inserts stay inert, as before).
    const latestUpload = useRef(uploadFile);
    latestUpload.current = uploadFile;
    const editorUploadFile = uploadFile
        ? (file: File) => {
              const upload = latestUpload.current;
              return upload
                  ? upload(file)
                  : Promise.reject(new Error("There is no chat to upload this file to."));
          }
        : undefined;
    const editor = useGenosEditor({
        surface: "composer",
        schema,
        dictionary,
        uploadFile: editorUploadFile,
        initialContent,
    });

    const { saveDraft, clearDraft } = useEditorDraft(editor, draftKey);

    // The chat-pane drop loop is separate from BlockNote's own `uploadFile` placeholder: this
    // drives the dim overlay with "Uploading 2 / 5: large.pdf".
    const [pendingUpload, setPendingUpload] = useState<{
        index: number;
        total: number;
        name: string;
    } | null>(null);

    // Upload files in series and insert each as an image/file block at the end of the doc.
    const insertFiles = async (files: File[], upload: (file: File) => Promise<string>) => {
        try {
            for (let i = 0; i < files.length; i += 1) {
                const file = files[i];
                setPendingUpload({ index: i + 1, total: files.length, name: file.name });
                try {
                    const url = await upload(file);
                    editor.insertBlocks(
                        [fileBlock(file, url) as any],
                        editor.document[editor.document.length - 1],
                        "after"
                    );
                } catch (err) {
                    console.error("Failed to insert file:", err);
                }
            }
        } finally {
            setPendingUpload(null);
        }
    };

    // Shared by the pane drop loop (`after`) and the mobile "attach" picker. Oversize files are
    // dropped up-front so the overlay only counts files we will try to upload.
    const uploadAndInsertFiles = async (files: File[]) => {
        if (!uploadFile) return;
        const accepted = filterFiles(files);
        if (accepted.length === 0) return;
        await insertFiles(accepted, uploadFile);
    };

    // Hidden native picker behind the mobile "attach" toolbar button: on a phone BlockNote's
    // drag-drop / side-menu insert paths are not reachable, so this is the only way to send an
    // image or file.
    const attachInputRef = useRef<HTMLInputElement>(null);
    const onAttachInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files ? Array.from(event.target.files) : [];
        // Reset so picking the same file twice in a row re-fires change.
        event.target.value = "";
        if (files.length > 0) void uploadAndInsertFiles(files);
    };

    const dropFiles = dropQueue?.files;
    useEffect(() => {
        if (!dropQueue || !dropFiles || dropFiles.length === 0 || !dropQueue.clear) return;
        // Capture + clear the queue SYNCHRONOUSLY, before any await, in every composer. Clearing
        // in a `finally` leaves the parent's queue populated for the whole upload; if this editor
        // remounts meanwhile (tab switch, edit-mode toggle), the fresh mount would re-run this
        // effect against the same array and insert every file a second time (MIP-1224: chat and
        // thread cleared late, only the task comment cleared first). The upload then goes
        // through the guarded, counted uploader, so every composer shows the "Uploading n files"
        // pill and refuses oversize files while a drop runs.
        const queued = dropFiles;
        dropQueue.clear();
        void uploadAndInsertFiles(queued);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run per queue, as before
    }, [dropFiles]);

    // Whether there is anything to send. A block count meant "typed something" only while
    // BlockNote kept a real empty block at the end (MIP-1039).
    const [canSend, setCanSend] = useState<boolean>(initialCanSend);

    // While a dropped/pasted image or file is still uploading, BlockNote has already inserted
    // its block (so the composer looks non-empty and Send would light up) but the block's `url`
    // is still empty: sending now ships an empty/broken attachment. `editorUploadCount` covers
    // BlockNote's own inserts, `pendingUpload` the drop / picker loop.
    const uploadInProgress = editorUploadCount > 0 || pendingUpload !== null;

    const [busy, setBusy] = useState(false);
    // The ref answers at once (a second chord lands before the re-render that sets `busy`).
    const sendingRef = useRef(false);

    const clearComposer = () => {
        editor.replaceBlocks(editor.document, []);
        clearDraft();
        setCanSend(false);
    };

    const send = async (): Promise<void> => {
        // The document is read synchronously: nothing may be awaited before `submit` is called.
        const blocks: any[] = editor.document;
        if (!isSendable(blocks)) return;
        if (canSubmit && !canSubmit()) return;
        if (uploadInProgress) return;

        if (clear === "never") {
            await submit(blocks);
            return;
        }

        if (clear === "after") {
            // One request at a time: a second Cmd+Enter while the first is in flight used to
            // send the same text again (MIP-1224).
            if (sendingRef.current) return;
            sendingRef.current = true;
            setBusy(true);
            try {
                const result = await submit(blocks);
                if (result !== false) {
                    clearComposer();
                    onSent?.(result as R);
                }
            } finally {
                sendingRef.current = false;
                setBusy(false);
            }
            return;
        }

        // "before": capture, empty the composer IMMEDIATELY (do not freeze it on the server
        // round-trip, up to the backend's 10 s read timeout), send in the background.
        clearComposer();
        const result = await submit(blocks);
        // On failure (the transport has already surfaced a toast) put the text back so it is
        // not lost, but only if the user has not started a new message meanwhile. Re-insert a
        // JSON deep-clone, NOT the live block objects just removed: that mirrors how
        // `useEditorDraft` restores a draft from storage, the path BlockNote re-hydrates cleanly,
        // so there is no id-reuse rejection.
        if (result === false && !isSendable(editor.document)) {
            try {
                editor.replaceBlocks(editor.document, JSON.parse(JSON.stringify(blocks)));
            } catch {
                /* stale block shape: nothing else we can do */
            }
        }
    };

    /** What the chord and an edit-in-place Save button do: start the send, then `onSendAttempt`. */
    const trigger = () => {
        // An image or file still uploading has an empty url: saving now would store a broken
        // attachment. Do nothing, and do not let an edit-in-place host close the editor over the
        // upload either (MIP-1224: only the new-message composers held back before).
        if (uploadInProgress) return;
        void send();
        onSendAttempt?.();
    };

    /** Props for `BlockNoteView`. */
    const viewProps = {
        onChange: () => {
            const doc = editor.document;
            onLinesChange?.(countEditorLines(doc));
            setCanSend(isSendable(doc));
            saveDraft(doc);
        },
        onKeyDown: (event: ReactKeyboardEvent) => {
            if (isSendShortcut(event)) trigger();
        },
    };

    return {
        editor,
        send,
        trigger,
        clear: clearComposer,
        viewProps,
        canSend,
        busy,
        uploadInProgress,
        /** For the Send button: nothing to send, or an upload still running. */
        sendDisabled: !canSend || uploadInProgress,
        /** The "Uploading n files" pill. */
        editorUploadCount,
        /** The drop / picker overlay. */
        overlay: {
            open: pendingUpload !== null,
            detail: pendingUpload
                ? `${pendingUpload.name} (${pendingUpload.index} / ${pendingUpload.total})`
                : undefined,
        },
        /** For `FileSizeRejectionSnackbar`. */
        rejection,
        dismissRejection,
        attachInputRef,
        onAttachInputChange,
        /** Opens the native picker; `undefined` for a composer without inline uploads. */
        openAttach: uploadFile ? () => attachInputRef.current?.click() : undefined,
    };
};
