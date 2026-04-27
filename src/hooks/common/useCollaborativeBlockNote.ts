import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { codeBlockOptions } from "@blocknote/code-block";
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

import { UserProps } from "../../types/admin";

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
    dictionary: any;
    uploadFile?: (file: File) => Promise<string>;
    initialBody?: PartialBlock[] | any[];
    enableComments?: boolean;
    teamMemberProfiles?: Record<string, UserProps>;
};

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

function buildAvatarUrl(path: string | undefined): string {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return MEDIA_URL ? `${MEDIA_URL}/${path}` : path;
}

function buildResolveUsers(profiles: Record<string, UserProps>, myself: UserProps) {
    return async (userIds: string[]): Promise<User[]> => {
        const allProfiles: Record<string, UserProps> = {
            ...profiles,
            [myself.userId]: myself,
        };
        const result = userIds.map((id) => {
            const profile = allProfiles[id];
            if (profile) {
                return {
                    id,
                    username: profile.userName,
                    avatarUrl: buildAvatarUrl(profile.avatarImgPath),
                };
            }
            return { id, username: "Unknown User", avatarUrl: "" };
        });
        return result;
    };
}

export function useCollaborativeBlockNote({
    documentName,
    user,
    userId,
    myself,
    accessToken,
    schema,
    dictionary,
    uploadFile,
    initialBody,
    enableComments = false,
    teamMemberProfiles,
}: UseCollaborativeBlockNoteOptions) {
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
    const seededRef = useRef(false);
    const editorRef = useRef<any>(null);
    const initialBodyRef = useRef(initialBody);
    initialBodyRef.current = initialBody;

    const syncedRef = useRef(false);
    const fragmentRef = useRef<Y.XmlFragment | null>(null);

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

    const { doc, provider, fragment } = useMemo(() => {
        seededRef.current = false;
        syncedRef.current = false;
        fragmentRef.current = null;

        const yjsDoc = new Y.Doc();
        const frag = yjsDoc.getXmlFragment("document-store");

        if (!COLLAB_URL || !accessToken) {
            return { doc: yjsDoc, provider: null, fragment: frag };
        }

        const hocuspocusProvider = new HocuspocusProvider({
            url: COLLAB_URL,
            name: documentName,
            document: yjsDoc,
            token: accessToken,
            onConnect: () => setConnectionStatus("connected"),
            onDisconnect: () => setConnectionStatus("disconnected"),
            onSynced: () => {
                setConnectionStatus("connected");
                syncedRef.current = true;
                fragmentRef.current = frag;
                seedDocument(frag);
            },
        });

        return { doc: yjsDoc, provider: hocuspocusProvider, fragment: frag };
    }, [documentName, accessToken, seedDocument]);

    // Retry seeding when initialBody arrives after onSynced already fired
    useEffect(() => {
        if (
            syncedRef.current &&
            !seededRef.current &&
            fragmentRef.current &&
            initialBody &&
            initialBody.length > 0
        ) {
            seedDocument(fragmentRef.current);
        }
    }, [initialBody, seedDocument]);

    // Fallback: if provider hasn't synced within 3s, seed from initialBody anyway
    useEffect(() => {
        if (!provider || !fragment) return;
        const timer = setTimeout(() => {
            if (!syncedRef.current && !seededRef.current && initialBody && initialBody.length > 0) {
                console.warn("[collab] Provider did not sync in time, seeding from local data");
                seedDocument(fragment);
            }
        }, 3000);
        return () => clearTimeout(timer);
    }, [provider, fragment, initialBody, seedDocument]);

    const threadStore = useMemo(() => {
        if (!enableComments || !provider) return null;
        return new YjsThreadStore(
            userId,
            doc.getMap("threads"),
            new DefaultThreadStoreAuth(userId, "editor")
        );
    }, [doc, provider, userId, enableComments]);

    const resolveUsers = useMemo(
        () => (teamMemberProfiles ? buildResolveUsers(teamMemberProfiles, myself) : undefined),
        [teamMemberProfiles, myself]
    );

    useEffect(() => {
        return () => {
            provider?.destroy();
        };
    }, [provider]);

    const commentsExtension = useMemo(() => {
        if (!threadStore || !resolveUsers) return null;
        return CommentsExtension({ threadStore, resolveUsers });
    }, [threadStore, resolveUsers]);

    const editorOptions = useMemo(() => {
        if (!provider) {
            return {
                schema,
                codeBlock: codeBlockOptions,
                dictionary,
                uploadFile,
                initialContent: initialBody && initialBody.length > 0 ? initialBody : undefined,
            };
        }

        const opts: Record<string, any> = {
            schema,
            codeBlock: codeBlockOptions,
            dictionary,
            uploadFile,
            collaboration: {
                provider,
                fragment,
                user,
            },
        };

        if (commentsExtension) {
            opts.extensions = [commentsExtension];
        }

        return opts;
    }, [provider, schema, dictionary, uploadFile, fragment, user, commentsExtension]);

    const editor = useCreateBlockNote(editorOptions as any, [
        provider,
        documentName,
        commentsExtension,
    ]);

    editorRef.current = editor;

    return {
        editor,
        provider,
        connectionStatus,
        threadStore,
    };
}
