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

function buildResolveUsers(profiles: Record<string, UserProps>, myself: UserProps) {
    return async (userIds: string[]): Promise<User[]> => {
        const allProfiles: Record<string, UserProps> = {
            ...profiles,
            [myself.userId]: myself,
        };
        return userIds
            .filter((id) => allProfiles[id])
            .map((id) => ({
                id,
                username: allProfiles[id].userName,
                avatarUrl: allProfiles[id].avatarImgPath || "",
            }));
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

    const seedDocument = useCallback((fragment: Y.XmlFragment) => {
        if (seededRef.current) return;
        seededRef.current = true;

        const body = initialBodyRef.current;
        if (!body || body.length === 0) return;

        const content = fragment.toJSON();
        const isEmpty = !content || content === "" || content === "<undefined></undefined>";
        if (!isEmpty) return;

        setTimeout(() => {
            const editor = editorRef.current;
            if (!editor) return;
            try {
                editor.replaceBlocks(editor.document, body as PartialBlock[]);
            } catch {
                // Seeding failed; document starts empty
            }
        }, 0);
    }, []);

    const { doc, provider, fragment } = useMemo(() => {
        seededRef.current = false;

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
                seedDocument(frag);
            },
        });

        return { doc: yjsDoc, provider: hocuspocusProvider, fragment: frag };
    }, [documentName, accessToken, seedDocument]);

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
