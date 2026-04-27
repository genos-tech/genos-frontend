import { useEffect, useMemo, useRef, useState } from "react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { BlockNoteSchema, PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { codeBlock } from "@blocknote/code-block";

const COLLAB_URL = import.meta.env.VITE_COLLAB_URL;

export type CollaborationUser = {
    name: string;
    color: string;
};

type UseCollaborativeBlockNoteOptions = {
    documentName: string;
    user: CollaborationUser;
    accessToken: string | null;
    schema: BlockNoteSchema<any, any, any>;
    dictionary: any;
    uploadFile?: (file: File) => Promise<string>;
    initialBody?: PartialBlock[] | any[];
};

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function useCollaborativeBlockNote({
    documentName,
    user,
    accessToken,
    schema,
    dictionary,
    uploadFile,
    initialBody,
}: UseCollaborativeBlockNoteOptions) {
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
    const seededRef = useRef(false);

    const { doc, provider } = useMemo(() => {
        const yjsDoc = new Y.Doc();
        if (!COLLAB_URL || !accessToken) {
            return { doc: yjsDoc, provider: null };
        }

        const hocuspocusProvider = new HocuspocusProvider({
            url: COLLAB_URL,
            name: documentName,
            document: yjsDoc,
            token: accessToken,
            onConnect: () => setConnectionStatus("connected"),
            onDisconnect: () => setConnectionStatus("disconnected"),
            onSynced: () => setConnectionStatus("connected"),
        });

        return { doc: yjsDoc, provider: hocuspocusProvider };
    }, [documentName, accessToken]);

    useEffect(() => {
        seededRef.current = false;
        return () => {
            provider?.destroy();
        };
    }, [provider]);

    const fragment = doc.getXmlFragment("document-store");

    const editor = useCreateBlockNote(
        provider
            ? {
                  schema,
                  codeBlock,
                  dictionary,
                  uploadFile,
                  collaboration: {
                      provider,
                      fragment,
                      user,
                  },
              }
            : {
                  schema,
                  codeBlock,
                  dictionary,
                  uploadFile,
                  initialContent:
                      initialBody && initialBody.length > 0 ? initialBody : undefined,
              },
        [provider, documentName]
    );

    useEffect(() => {
        if (
            provider &&
            connectionStatus === "connected" &&
            !seededRef.current &&
            initialBody &&
            initialBody.length > 0
        ) {
            const content = fragment.toJSON();
            const isEmpty = !content || content === "" || content === "<undefined></undefined>";
            if (isEmpty) {
                try {
                    editor.replaceBlocks(editor.document, initialBody as PartialBlock[]);
                } catch {
                    // Seeding failed gracefully; document will start empty
                }
            }
            seededRef.current = true;
        }
    }, [connectionStatus, provider, initialBody]);

    return {
        editor,
        provider,
        connectionStatus,
    };
}
