import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BlockNoteSchema, PartialBlock } from "@blocknote/core";
import {
    CommentsExtension,
    DefaultThreadStoreAuth,
    YjsThreadStore,
    type User,
} from "@blocknote/core/comments";
import { useCreateBlockNote } from "@blocknote/react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";

import { createYjsPersistence, destroyYjsPersistence } from "../../db/utils/yjsPersistence";
import { getMessages } from "../../i18n";
import { UserProps } from "../../types/admin";
import { resolveInsecureFileUrl } from "../../utils/downloadUtils";

const COLLAB_URL = import.meta.env.VITE_COLLAB_URL;
const MEDIA_URL = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

export type CollaborationUser = {
    name: string;
    color: string;
};

type UseCollaborativeBlockNoteOptions = {
    documentName: string;
    user: CollaborationUser;
    userId: string;
    myself: UserProps;
    accessToken: string | null;
    schema: BlockNoteSchema<any, any, any>;
    /**
     * Optional mention-capable schema for comment bodies. Passed to
     * `CommentsExtension({ schema })`, which BlockNote stores as
     * `commentEditorSchema` and uses to build EVERY comment editor (composer,
     * reply, edit) and to render committed comments. Supply one built with
     * `buildCommentSchema` (see `CommentEditorWithMentions`) so `@`/`#` chips
     * render inside comments; omit it to keep BlockNote's plain default.
     */
    commentSchema?: BlockNoteSchema<any, any, any>;
    dictionary: any;
    uploadFile?: (file: File) => Promise<string>;
    initialBody?: PartialBlock[] | any[];
    enableComments?: boolean;
    teamMemberProfiles?: Record<string, UserProps>;
    /**
     * Additional BlockNote extensions to merge into `useCreateBlockNote`'s
     * options (alongside the comments extension when `enableComments` is on).
     *
     * Identity for editor-rebuild deps is derived from each extension's
     * `key` (BlockNote's `createExtension` enforces this), so callers can
     * pass a fresh `[ext1, ext2]` literal on every render without tearing
     * down the editor — as long as the *set of keys* doesn't change.
     */
    extensions?: any[];
};

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

function buildAvatarUrl(path: string | undefined): string {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return MEDIA_URL ? `${MEDIA_URL}/${path}` : path;
}

export function useCollaborativeBlockNote({
    documentName,
    user,
    userId,
    myself,
    accessToken,
    schema,
    commentSchema,
    dictionary,
    uploadFile,
    initialBody,
    enableComments = false,
    teamMemberProfiles,
    extensions,
}: UseCollaborativeBlockNoteOptions) {
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
    const seededRef = useRef(false);
    const editorRef = useRef<any>(null);
    const initialBodyRef = useRef(initialBody);
    initialBodyRef.current = initialBody;

    const syncedRef = useRef(false);
    const fragmentRef = useRef<Y.XmlFragment | null>(null);

    // Hocuspocus + IDB callbacks fire async. If the host component
    // unmounts (or the provider gets rebuilt due to a documentName /
    // accessToken change) before `onConnect` / `onSynced` /
    // `onDisconnect` returns, calling `setConnectionStatus` triggers
    // React's "state update on unmounted component" warning. Guard the
    // setter with this ref so callbacks for the prior provider are no-ops
    // after teardown.
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);
    const safeSetConnectionStatus = useCallback((s: ConnectionStatus) => {
        if (mountedRef.current) setConnectionStatus(s);
    }, []);

    const isDocumentEmpty = useCallback((fragment: Y.XmlFragment, editor: any): boolean => {
        const content = fragment.toJSON();
        if (!content || content === "" || content === "<undefined></undefined>") return true;

        // Tiptap initializes Yjs with a default empty paragraph before sync.
        // Check via the editor's document if the content is just a single empty block.
        if (editor) {
            const doc = editor.document;
            if (!doc || doc.length === 0) return true;
            if (doc.length === 1) {
                const block = doc[0];
                const hasNoContent =
                    !block.content ||
                    block.content.length === 0 ||
                    (block.content.length === 1 &&
                        block.content[0].type === "text" &&
                        block.content[0].text === "");
                const hasNoChildren = !block.children || block.children.length === 0;
                if (hasNoContent && hasNoChildren) return true;
            }
        }
        return false;
    }, []);

    const seedDocument = useCallback(
        (fragment: Y.XmlFragment) => {
            if (seededRef.current) return;

            const body = initialBodyRef.current;
            if (!body || body.length === 0) return;

            const editor = editorRef.current;
            if (!isDocumentEmpty(fragment, editor)) {
                seededRef.current = true;
                return;
            }

            seededRef.current = true;
            setTimeout(() => {
                if (!editor) return;
                try {
                    editor.replaceBlocks(editor.document, body as PartialBlock[]);
                } catch {
                    // Seeding failed; document starts empty
                }
            }, 0);
        },
        [isDocumentEmpty]
    );

    const { doc, provider, idbProvider, fragment } = useMemo(() => {
        seededRef.current = false;
        syncedRef.current = false;
        fragmentRef.current = null;

        const yjsDoc = new Y.Doc();
        const frag = yjsDoc.getXmlFragment("document-store");

        if (!COLLAB_URL || !accessToken) {
            return { doc: yjsDoc, provider: null, idbProvider: null, fragment: frag };
        }

        // Persist Yjs update history to IndexedDB keyed by documentName.
        // On the next open the stored updates are replayed into the doc
        // synchronously (in IndexedDB terms: before the WebSocket round-trip),
        // so the editor renders with content on the first frame instead of
        // showing blank for the ~200-300 ms the Hocuspocus connection takes.
        // New write-updates are forwarded automatically; no manual sync needed.
        //
        // Via `createYjsPersistence`, not the y-indexeddb constructor: the
        // raw provider writes from inside a Yjs update observer and lets
        // IndexedDB errors escape into the transaction, which takes the
        // Hocuspocus observer and the editor's own sync down with it. See
        // that module for the failure it removes.
        const idb = createYjsPersistence(documentName, yjsDoc);

        const trySeedFallback = () => {
            if (!seededRef.current) {
                seedDocument(frag);
            }
        };

        const hocuspocusProvider = new HocuspocusProvider({
            url: COLLAB_URL,
            name: documentName,
            document: yjsDoc,
            token: accessToken,
            onConnect: () => safeSetConnectionStatus("connected"),
            onDisconnect: () => {
                safeSetConnectionStatus("disconnected");
                // If we disconnected before ever syncing, seed immediately
                if (!syncedRef.current) trySeedFallback();
            },
            onAuthenticationFailed: () => {
                safeSetConnectionStatus("disconnected");
                trySeedFallback();
            },
            onSynced: () => {
                safeSetConnectionStatus("connected");
                syncedRef.current = true;
                fragmentRef.current = frag;
                seedDocument(frag);
            },
        });

        return { doc: yjsDoc, provider: hocuspocusProvider, idbProvider: idb, fragment: frag };
    }, [documentName, accessToken, seedDocument]);

    // Retry seeding when initialBody arrives after sync or connection failure
    useEffect(() => {
        if (!seededRef.current && fragment && initialBody && initialBody.length > 0) {
            // Seed if we've already synced or if connection already failed
            if (syncedRef.current || connectionStatus === "disconnected") {
                seedDocument(fragment);
            }
        }
    }, [initialBody, seedDocument, fragment, connectionStatus]);

    const threadStore = useMemo(() => {
        if (!enableComments || !provider) return null;
        return new YjsThreadStore(
            userId,
            doc.getMap("threads"),
            new DefaultThreadStoreAuth(userId, "editor")
        );
    }, [doc, provider, userId, enableComments]);

    // `resolveUsers` is invoked by the comments extension on demand to look up
    // display info for a given user id. We MUST keep its identity stable across
    // re-renders, otherwise `commentsExtension` (which depends on it) becomes a
    // new reference, which makes `useCreateBlockNote`'s deps array change,
    // which destroys and rebuilds the entire BlockNote editor — caret + Yjs
    // awareness included.
    //
    // `teamMemberProfiles` is refreshed every 60s by `useTeamManagement` (a
    // setInterval that re-runs the `popTeamUsers` worker). Without the ref
    // indirection here, every minute that ticked the editor was being torn
    // down mid-typing and the cursor disappeared.
    const teamMemberProfilesRef = useRef(teamMemberProfiles);
    const myselfRef = useRef(myself);
    useEffect(() => {
        teamMemberProfilesRef.current = teamMemberProfiles;
    }, [teamMemberProfiles]);
    useEffect(() => {
        myselfRef.current = myself;
    }, [myself]);

    const resolveUsers = useCallback(async (userIds: string[]): Promise<User[]> => {
        const profiles = teamMemberProfilesRef.current ?? {};
        const me = myselfRef.current;
        const allProfiles: Record<string, UserProps> = {
            ...profiles,
            [me.userId]: me,
        };
        return userIds.map((id) => {
            const profile = allProfiles[id];
            if (profile) {
                return {
                    id,
                    username: profile.userName,
                    avatarUrl: buildAvatarUrl(profile.avatarImgPath),
                };
            }
            return { id, username: getMessages().app.collaboration.unknownUser, avatarUrl: "" };
        });
    }, []);

    // Lifecycle cleanup runs in the order WebSocket → IndexedDB persistence
    // → Y.Doc. The provider must come down before its underlying doc is
    // destroyed (otherwise it can attempt to post a final awareness frame to
    // a freed structure); IndexedDB persistence is independent but is closed
    // first so its in-flight transactions finish against a live doc. The
    // Yjs doc itself was never being destroyed previously — Hocuspocus and
    // y-indexeddb both hold references to it, but neither calls `destroy()`,
    // so its internal stores leaked across tab switches until garbage
    // collection caught up.
    useEffect(() => {
        return () => {
            provider?.destroy();
        };
    }, [provider]);

    useEffect(() => {
        return () => {
            // Resolves once the connection is closed; never rejects. An
            // unmount has nothing to wait for, so don't.
            void destroyYjsPersistence(idbProvider);
        };
    }, [idbProvider]);

    useEffect(() => {
        return () => {
            doc?.destroy();
        };
    }, [doc]);

    // Snapshot `commentSchema` in a ref for the same reason as
    // `teamMemberProfiles`/`extensions` above: it's rebuilt whenever the
    // mention spec's deps change (notably the 60s `teamMemberProfiles`
    // refresh), and baking its identity into `commentsExtension`'s deps would
    // tear down and rebuild the WHOLE editor every minute. The comment editors
    // read it (as `commentEditorSchema`) at their own build time; a stale
    // capture is fine because the `mention` spec resolves the CURRENT display
    // name via `useResolvedUserName` at render — exactly how the main editor's
    // own `schema` (also excluded from the rebuild deps) already behaves.
    const commentSchemaRef = useRef(commentSchema);
    commentSchemaRef.current = commentSchema;

    const commentsExtension = useMemo(() => {
        if (!threadStore) return null;
        return CommentsExtension({
            threadStore,
            resolveUsers,
            schema: commentSchemaRef.current,
        });
    }, [threadStore, resolveUsers]);

    // The caller passes `extensions` as a fresh array literal on every
    // render; reading the latest value from a ref (rather than baking the
    // array reference into the editor-options memo deps) keeps the editor
    // from being rebuilt every render while still letting us include the
    // current extension list when the options are recomputed.
    const extensionsRef = useRef(extensions);
    extensionsRef.current = extensions;

    // Stable fingerprint that only changes when the *set* of extensions
    // (by `key`) changes — see the JSDoc on `extensions` for why this is
    // safe to use as the editor-rebuild dep.
    const extensionsFingerprint = (extensions ?? []).map((ext: any) => ext?.key ?? "").join("|");

    // NOTE: BlockNote 0.49 removed the `codeBlock` option from
    // `useCreateBlockNote`. Syntax-highlighted code blocks are now
    // configured via `createCodeBlockSpec(codeBlockOptions)` on the
    // schema instead, so callers of this hook must add it themselves
    // (see `bnMyNoteEditor`, `bnChatNoteEditor`, `bnTaskNoteEditor`,
    // `bnTaskPreview`).
    const editorOptions = useMemo(() => {
        const extraExtensions = extensionsRef.current ?? [];

        if (!provider) {
            const opts: Record<string, any> = {
                schema,
                resolveFileUrl: resolveInsecureFileUrl,
                dictionary,
                uploadFile,
                initialContent: initialBody && initialBody.length > 0 ? initialBody : undefined,
            };
            if (extraExtensions.length > 0) {
                opts.extensions = [...extraExtensions];
            }
            return opts;
        }

        const opts: Record<string, any> = {
            schema,
            dictionary,
            uploadFile,
            collaboration: {
                provider,
                fragment,
                user,
            },
        };

        const allExtensions = [...extraExtensions];
        if (commentsExtension) {
            allExtensions.push(commentsExtension);
        }
        if (allExtensions.length > 0) {
            opts.extensions = allExtensions;
        }

        return opts;
    }, [
        provider,
        schema,
        dictionary,
        uploadFile,
        fragment,
        user,
        commentsExtension,
        extensionsFingerprint,
    ]);

    const editor = useCreateBlockNote(editorOptions as any, [
        provider,
        documentName,
        commentsExtension,
        extensionsFingerprint,
    ]);

    editorRef.current = editor;

    return {
        editor,
        provider,
        connectionStatus,
        threadStore,
    };
}
