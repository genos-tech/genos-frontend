/**
 * Test seam for the chat-style composers (MIP-1161).
 *
 * BlockNote cannot be driven by `fireEvent` in jsdom, so the composers are mounted with
 * `BlockNoteView` replaced by a stub that exposes the props the composer passes it (`onChange`,
 * `onKeyDown`, `onBlur`), and `useGenosEditor` replaced by a fake editor with the few members the
 * composers call (`document`, `replaceBlocks`, `insertBlocks`). Everything else (the upload
 * counter, the size guard, the draft storage, the send flow) is the real code, so the same tests
 * run unchanged against the code before and after the shared hook was extracted.
 *
 * The fake mirrors two BlockNote facts the composers depend on:
 *   - `replaceBlocks` fires the view's `onChange` synchronously (tiptap `update`);
 *   - `useCreateBlockNote` freezes its options at the first render (`editor.options`).
 *
 * Each test file wires it with `vi.mock(path, async () => (await import("./helpers_composerHarness")).<factory>())`.
 */
import { useRef, type ReactNode } from "react";
import { act } from "@testing-library/react";
import { vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const para = (text = "", id = `b-${Math.random().toString(36).slice(2, 8)}`): any => ({
    id,
    type: "paragraph",
    props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
    content: text ? [{ type: "text", text, styles: {} }] : [],
    children: [],
});

export class FakeEditor {
    document: any[] = [para("")];
    options: any;
    view: () => ViewProps | null;
    replaceBlocks = vi.fn((_remove: any[], next: any[]) => {
        this.document = next.length > 0 ? next : [para("")];
        this.view()?.onChange?.();
    });
    insertBlocks = vi.fn((blocks: any[], _ref: any, _placement: string) => {
        this.document = [...this.document, ...blocks];
        this.view()?.onChange?.();
    });
    getTextCursorPosition = () => ({ block: this.document[0] });
    constructor(options: any, view: () => ViewProps | null) {
        this.options = options;
        if (Array.isArray(options?.initialContent)) this.document = options.initialContent;
        this.view = view;
    }
    /** What typing does: replace the text of the first paragraph, then BlockNote reports a change. */
    type(text: string, extraBlocks = 0) {
        this.document = [
            para(text, this.document[0]?.id),
            ...this.document.slice(1, 1 + extraBlocks),
            ...Array.from({ length: Math.max(0, extraBlocks - (this.document.length - 1)) }, () =>
                para("")
            ),
        ];
        this.view()?.onChange?.();
    }
}

export type ViewProps = {
    onChange?: () => void;
    onKeyDown?: (event: any) => void;
    onBlur?: () => void;
};

export const harness: {
    view: ViewProps | null;
    editors: FakeEditor[];
    toolbar: { onAttach?: () => void; isMobile?: boolean } | null;
    reset: () => void;
} = {
    view: null,
    editors: [],
    toolbar: null,
    reset() {
        this.view = null;
        this.editors = [];
        this.toolbar = null;
    },
};

export const lastEditor = (): FakeEditor => harness.editors[harness.editors.length - 1];

/** `act` around what the editor does on its own (type / key chord). */
export const typeInto = (text: string, extraBlocks = 0) =>
    act(() => lastEditor().type(text, extraBlocks));
export const pressChord = (init: { metaKey?: boolean; ctrlKey?: boolean; key?: string }) =>
    act(() => {
        harness.view?.onKeyDown?.({
            key: "Enter",
            metaKey: false,
            ctrlKey: false,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            ...init,
        });
    });

/* ----- vi.mock factories ----- */

export const blockNoteMantineMock = () => ({
    BlockNoteView: ({
        children,
        onChange,
        onKeyDown,
        onBlur,
    }: ViewProps & { children?: ReactNode }) => {
        harness.view = { onChange, onKeyDown, onBlur };
        return <div data-testid="bn-view">{children}</div>;
    },
});

export const useGenosEditorMock = () => ({
    GENOS_SURFACES: {},
    useGenosEditor: (options: any) => {
        const ref = useRef<FakeEditor | null>(null);
        if (!ref.current) {
            // First render only, like `useCreateBlockNote(options, [])`.
            ref.current = new FakeEditor(options, () => harness.view);
            harness.editors.push(ref.current);
        }
        return ref.current;
    },
});

export const genosToolbarsMock = () => ({
    GenosChatToolbar: (props: { onAttach?: () => void; isMobile?: boolean }) => {
        harness.toolbar = { onAttach: props.onAttach, isMobile: props.isMobile };
        return props.onAttach ? (
            <button data-testid="attach" onClick={props.onAttach}>
                attach
            </button>
        ) : null;
    },
});

export const sendButtonMock = () => ({
    EditorSendButton: ({ disabled, onSend }: { disabled: boolean; onSend: () => void }) => (
        <button data-testid="send" disabled={disabled} onClick={onSend}>
            send
        </button>
    ),
});

export const uploadChromeMock = () => ({
    FileUploadStatusBadge: ({ count }: { count: number }) => (
        <div data-count={count} data-testid="badge" />
    ),
    FileUploadOverlay: ({ open, detail }: { open: boolean; detail?: string }) => (
        <div data-detail={detail ?? ""} data-open={String(open)} data-testid="overlay" />
    ),
    UploadingTileBadge: () => null,
});

export const nullComponent = () => null;
