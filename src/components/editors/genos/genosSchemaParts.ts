import { codeBlockOptions } from "@blocknote/code-block";
import {
    createCodeBlockSpec,
    defaultBlockSpecs,
    defaultInlineContentSpecs,
} from "@blocknote/core";

import { resolveCodeLanguage } from "../codeBlockLanguage";
import { genosExtraBlockSpecs, genosExtraInlineContentSpecs } from "../genosBlockSpecs";

/**
 * The highlighted code block, made safe against a language it has no id for (MIP-1601).
 * BlockNote's own render throws "Language ts is not supported." for any `props.language`
 * that is not one of its `supportedLanguages` ids, and a throw inside a ProseMirror node
 * view leaves the whole editor, and so the whole body, unrendered. The stored block is
 * not rewritten; what the editor draws (and what the picker shows) is the language the
 * name resolves to: an alias gets its id (`ts` → `typescript`), anything else plain text.
 * This covers a body that is already stored in a Yjs doc or the REST body.
 */
const createSafeCodeBlockSpec = (): ReturnType<typeof createCodeBlockSpec> => {
    const spec = createCodeBlockSpec(codeBlockOptions);
    const implementation = spec.implementation as {
        render: (...a: any[]) => unknown;
        parse?: (...a: any[]) => Record<string, unknown> | undefined;
    };
    const render = implementation.render;
    const parse = implementation.parse;
    const meta = (spec.implementation as { meta?: { highlight?: (b: any) => unknown } }).meta;
    const highlight = meta?.highlight;
    return {
        ...spec,
        implementation: {
            ...spec.implementation,
            // The colouring reads the language off the stored block as well, so a block that
            // still says `ts` is coloured as typescript and `go` (no grammar) is left plain.
            ...(highlight && {
                meta: {
                    ...meta,
                    highlight: (block: { props?: Record<string, unknown> }) =>
                        highlight({
                            ...block,
                            props: {
                                ...block.props,
                                language: resolveCodeLanguage(block.props?.language),
                            },
                        }),
                },
            }),
            // A pasted `<pre><code class="language-ts">` carries its name as the language too.
            ...(parse && {
                parse(this: unknown, element: unknown) {
                    const props = parse.call(this, element);
                    return props && "language" in props
                        ? { ...props, language: resolveCodeLanguage(props.language) }
                        : props;
                },
            }),
            render(this: unknown, block: any, editor: unknown) {
                const language = resolveCodeLanguage(block.props?.language);
                return render.call(
                    this,
                    language === block.props?.language
                        ? block
                        : { ...block, props: { ...block.props, language } },
                    editor
                );
            },
        },
    } as ReturnType<typeof createCodeBlockSpec>;
};

/**
 * The part of the Genos editor schema that has no React and no per-surface state: the
 * block types and the inline types that are not chips. `createGenosSchema` (the editors)
 * and `createHeadlessNoteSchema` (markdown / Yjs conversion, plain Node) both start here, so
 * a block type added to this file is in every schema at once.
 *
 * The rule (MIP-1019): an editor whose schema lacks a type DELETES that block from the
 * shared Yjs document it opens, and a body with an unknown type makes BlockNote reject the
 * whole body. So no surface gets a smaller set; surfaces differ in menus and toolbars only.
 * The one deliberate exception is the paragraph-only comment schema
 * (`buildCommentSchema`), whose documents the API never writes anything else into.
 */

/** Block types every schema has, `alert` aside (its spec is React, so each side adds its own). */
export const genosBaseBlockSpecs = () => {
    // The editors offer no audio or video blocks.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { audio, video, ...remaining } = defaultBlockSpecs;
    return {
        ...remaining,
        ...genosExtraBlockSpecs,
        // BlockNote 0.49 moved the code-block options out of `useCreateBlockNote` and into the
        // schema: the syntax-highlighted `codeBlock` replaces the default plain-text one.
        codeBlock: createSafeCodeBlockSpec(),
    };
};

/** Inline content every schema has, chips aside. */
export const genosBaseInlineContentSpecs = () => ({
    ...defaultInlineContentSpecs,
    ...genosExtraInlineContentSpecs,
});

/** The chip types every schema registers on top of the base set. */
export const GENOS_CHIP_TYPES = [
    "mention",
    "mentionGroup",
    "customEmoji",
    "hashTask",
    "hashNote",
    "hashChat",
    "hashProject",
] as const;
