import { useMemo } from "react";
import { PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";

import { useCollaborativeBlockNote } from "../../../hooks/common/useCollaborativeBlockNote";
import { getUserColor } from "../../../utils/collabUtils";
import { resolveInsecureFileUrl } from "../../../utils/downloadUtils";
import { useBlockNoteDictionary } from "../blockNoteI18n";
import { genosTableOptions } from "../genosBlockSpecs";
import { codeFenceInputRule } from "../sub/codeBlockExtras";
import { buildCommentSchema } from "../sub/CommentEditorWithMentions";
import { linkHostCaption } from "../sub/linkHostCaption";
import { TAB_INDENT_OPTIONS, tabStaysInEditor } from "../sub/tabIndent";
import {
    GenosMentionContext,
    GenosSchema,
    mentionContextDeps,
    useGenosSchema,
} from "./genosSchema";

type GenosDictionary = ReturnType<typeof useBlockNoteDictionary>;

/**
 * How each KIND of Genos editor differs when it is created (MIP-1131). Everything not listed
 * here is the same everywhere: the schema, Tab indents, `resolveFileUrl` upgrading http media,
 * the translated dictionary, the ``` code-fence rule and the link-host caption.
 *
 *  composer   chat, thread, task-comment composers and their edit-in-place twins
 *  todo       the todo body
 *  template   the project body template (a local document)
 *  preview    read-only rendering of a saved body (no editing rules at all)
 *
 * The collaborative document editors (notes, the task body) are `useGenosCollabEditor`.
 */
export const GENOS_SURFACES = {
    composer: { editingRules: true, tabStaysInEditor: false, tables: false },
    todo: { editingRules: true, tabStaysInEditor: true, tables: false },
    template: { editingRules: true, tabStaysInEditor: true, tables: true },
    preview: { editingRules: false, tabStaysInEditor: false, tables: false },
} as const;

export type GenosSurface = keyof typeof GENOS_SURFACES;

/**
 * A local (non-collaborative) Genos editor. A thin `useCreateBlockNote`: the options come from
 * `GENOS_SURFACES`, the caller supplies what is its own (schema, dictionary, its uploader, the
 * body it opens with). Adds no state and no subscription: typing cost is BlockNote's own.
 */
export const useGenosEditor = ({
    surface,
    schema,
    dictionary,
    uploadFile,
    initialContent,
}: {
    surface: GenosSurface;
    schema: GenosSchema;
    dictionary: GenosDictionary;
    uploadFile?: (file: File) => Promise<string>;
    initialContent?: PartialBlock[];
}) => {
    const cfg = GENOS_SURFACES[surface];
    return useCreateBlockNote({
        ...(cfg.editingRules ? TAB_INDENT_OPTIONS : {}),
        ...(cfg.tables ? { tables: genosTableOptions } : {}),
        schema,
        resolveFileUrl: resolveInsecureFileUrl,
        ...(uploadFile ? { uploadFile } : {}),
        // `codeFenceInputRule`: a ``` fence (+ Space or Enter) always makes a code block with
        // a language that exists (see codeBlockExtras.tsx).
        ...(cfg.editingRules
            ? {
                  extensions: [
                      codeFenceInputRule,
                      linkHostCaption,
                      ...(cfg.tabStaysInEditor ? [tabStaysInEditor] : []),
                  ],
              }
            : {}),
        dictionary,
        ...(initialContent ? { initialContent } : {}),
    });
};

/**
 * The collaborative document editors: note (my, task, chat) and the task body. The schema and
 * the comment schema are the shared ones, rebuilt on exactly the values the mention chip
 * closes over (as each wrapper did before); the Yjs / Hocuspocus side stays in
 * `useCollaborativeBlockNote` (sync debounce, reconnect, persistence), untouched.
 */
export const useGenosCollabEditor = ({
    documentName,
    ctx,
    accessToken,
    dictionary,
    uploadFile,
    body,
}: {
    documentName: string;
    ctx: GenosMentionContext;
    accessToken: string | null;
    dictionary: GenosDictionary;
    uploadFile?: (file: File) => Promise<string>;
    body?: PartialBlock[];
}) => {
    const { myself } = ctx;
    const schema = useGenosSchema(ctx, "live");
    // Mention-capable schema for the inline body-COMMENT editors (composer, reply, edit).
    // Same deps as `schema`: `CreateMentionSpec` closes over these values.
    const commentSchema = useMemo(
        () => buildCommentSchema(ctx),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        mentionContextDeps(ctx)
    );
    const collabUser = useMemo(
        () => ({ name: myself.userName, color: getUserColor(myself.userId) }),
        [myself.userName, myself.userId]
    );
    const collab = useCollaborativeBlockNote({
        documentName,
        user: collabUser,
        userId: myself.userId,
        myself,
        accessToken,
        schema,
        commentSchema,
        dictionary,
        uploadFile,
        initialBody: body,
        enableComments: true,
        teamMemberProfiles: ctx.teamMemberProfiles,
        extensions: [codeFenceInputRule, linkHostCaption],
    });
    return { ...collab, schema };
};
