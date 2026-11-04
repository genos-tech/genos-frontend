/*
 * The math block and inline math, with KaTeX loaded on demand (MIP-1025).
 *
 * Adapted from `@blocknote/math-block` 0.57.0 (https://github.com/TypeCellOS/BlockNote,
 * MPL-2.0, Copyright (c) the BlockNote contributors); this file is covered by MPL-2.0 as
 * well. What is kept IDENTICAL on purpose, because a stored document and the Yjs binding
 * depend on it (an editor whose block differs here deletes it from the shared document):
 * the type names (`mathBlock`, `math`), no props, PLAIN-text content, and the node flags
 * (`meta`). `parity.test.ts` checks them against the installed package. What is new: the
 * preview loads KaTeX with `import()` on the first formula that is drawn, so an editor with
 * no formula never downloads it, and `toExternalHTML` (copy) writes MathML with the TeX
 * source as an annotation instead of rendering it with KaTeX (which the package's `parse`
 * reads back).
 */
import { createElement, memo, useEffect, useMemo, useRef, useState } from "react";
/* eslint-disable react-refresh/only-export-components -- a spec module: its exports are specs and menu items, not components to hot-reload */
import {
    createBlockConfig,
    createExtension,
    plainContentToString,
    type BlockNoteEditor,
    type StyleSchema,
} from "@blocknote/core";
import {
    insertOrUpdateBlockForSlashMenu,
    SourceBlockWithPreviewExtension,
} from "@blocknote/core/extensions";
import {
    createReactBlockSpec,
    createReactInlineContentSpec,
    PreviewPlaceholder,
    SourceBlockWithPreview,
    SourceInlineContentWithPreview,
    type BlockTypeSelectItem,
    type DefaultReactSuggestionItem,
    type ReactCustomBlockRenderProps,
    type ReactCustomInlineContentRenderProps,
} from "@blocknote/react";
import { Fragment } from "prosemirror-model";
import { TextSelection } from "prosemirror-state";
import { TbMath } from "react-icons/tb";

import { katexIfLoaded, loadKatex } from "./loadRenderers";
import { getMathDictionary } from "./mathDiagramDictionaries";

const MATHML_NS = "http://www.w3.org/1998/Math/MathML";

export const mathBlockConfig = createBlockConfig(
    () => ({ type: "mathBlock", propSchema: {}, content: "plain" }) as const
);
export const mathInlineConfig = { type: "math", propSchema: {}, content: "plain" } as const;

/** The TeX source a MathML element carries as its annotation, which `toExternalHTML` writes. */
const texOf = (element: HTMLElement): string | undefined =>
    Array.from(element.getElementsByTagName("annotation"))
        .find((a) => a.getAttribute("encoding") === "application/x-tex")
        ?.textContent?.trim();

const parseTexContent = ({
    el,
    schema,
}: {
    el: HTMLElement;
    schema: { text: (text: string) => import("prosemirror-model").Node };
}) => {
    const tex = texOf(el);
    return tex ? Fragment.from(schema.text(tex)) : undefined;
};

/** MathML with the TeX source as an annotation: what copy writes, and what `parse` reads. */
const mathMl = (tex: string, display: "block" | "inline") =>
    createElement(
        "math",
        { xmlns: MATHML_NS, display, alttext: tex },
        createElement(
            "semantics",
            null,
            createElement("mtext", null, tex),
            createElement("annotation", { encoding: "application/x-tex" }, tex)
        )
    );

const Html = memo(function Html({ html }: { html: string }) {
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
});

/**
 * The HTML for a formula. KaTeX is loaded on the first call that has a source; until it
 * arrives the TeX source itself is shown. As in the package, a source that does not render
 * keeps the last good drawing next to the error.
 */
const useLatexPreview = (source: string, inline: boolean) => {
    const [katex, setKatex] = useState(() => katexIfLoaded());
    useEffect(() => {
        if (katex || !source) return;
        let cancelled = false;
        loadKatex()
            .then((module) => {
                if (!cancelled) setKatex(module);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [katex, source]);

    const rendered = useMemo(
        () => (katex && source ? katex.katexToHtml(source, inline) : undefined),
        [katex, source, inline]
    );
    const last = useRef("");
    if (rendered && !(rendered.error && last.current !== "")) last.current = rendered.html;

    return {
        error: rendered?.error,
        preview: !source
            ? undefined
            : !katex
              ? ((<span aria-busy="true">{source}</span>) as React.ReactNode)
              : last.current
                ? ((<Html html={last.current} />) as React.ReactNode)
                : undefined,
    };
};

const MathBlockView = (props: ReactCustomBlockRenderProps<typeof mathBlockConfig>) => {
    const source = plainContentToString(props.block.content).trim();
    const { preview, error } = useLatexPreview(source, false);
    const dictionary = getMathDictionary(props.editor).block;
    return (
        <SourceBlockWithPreview
            block={props.block}
            contentRef={props.contentRef}
            editor={props.editor}
            error={error}
            preview={preview}
            source={source}
            sourcePlaceholder={dictionary.input_placeholder}
            emptySourcePlaceholder={
                <PreviewPlaceholder icon={<TbMath />} text={dictionary.add_source_text} />
            }
            errorPreview={
                <PreviewPlaceholder icon={<TbMath />} text={dictionary.preview_error_text} error />
            }
        />
    );
};

const MathInlineView = (
    props: ReactCustomInlineContentRenderProps<typeof mathInlineConfig, StyleSchema>
) => {
    const source = props.inlineContent.content.trim();
    const { preview, error } = useLatexPreview(source, true);
    const dictionary = getMathDictionary(props.editor).inline;
    return (
        <SourceInlineContentWithPreview
            contentRef={props.contentRef}
            editor={props.editor}
            error={error}
            getPos={props.getPos}
            node={props.node}
            preview={preview}
            source={source}
            sourcePlaceholder={dictionary.input_placeholder}
            emptySourcePlaceholder={
                <PreviewPlaceholder icon={<TbMath />} text={dictionary.add_source_text} />
            }
            errorPreview={
                <PreviewPlaceholder icon={<TbMath />} text={dictionary.preview_error_text} error />
            }
        />
    );
};

/** `$$ ` or `\[ ` at the start of a line turns it into a math block. */
const mathBlockInputRules = createExtension({
    key: "math-block-input-rules",
    inputRules: [
        { find: /^\$\$\s$/, replace: () => ({ type: "mathBlock", props: {}, content: [] }) },
        { find: /^\\\[\s$/, replace: () => ({ type: "mathBlock", props: {}, content: [] }) },
    ],
});

export const createMathBlockSpec = () =>
    createReactBlockSpec(
        mathBlockConfig,
        {
            meta: {
                code: true,
                defining: true,
                isolating: false,
                highlight: () => "latex",
                hasPreview: true,
            },
            parse: (el) =>
                el.nodeName.toLowerCase() === "math" && el.getAttribute("display") === "block"
                    ? {}
                    : undefined,
            parseContent: parseTexContent,
            render: (props) => <MathBlockView {...props} />,
            toExternalHTML: ({ block }) => mathMl(plainContentToString(block.content), "block"),
        },
        [mathBlockInputRules]
    )();

/**
 * Inline math. NO `$...$` input rule (the package has one): it converts what was typed
 * between two dollar signs the moment the second is typed, so "costs $5 and $" would turn
 * "5 and " into a formula. The slash item still inserts it.
 */
export const createMathInlineSpec = () =>
    createReactInlineContentSpec(mathInlineConfig, {
        meta: { code: true, highlight: () => "latex", hasPreview: true },
        parse: (el) =>
            el.nodeName.toLowerCase() === "math" && el.getAttribute("display") === "inline"
                ? {}
                : undefined,
        parseContent: parseTexContent,
        render: (props) => <MathInlineView {...props} />,
        toExternalHTML: ({ inlineContent }) => mathMl(inlineContent.content, "inline"),
    });

// The same signature as BlockNote's own menu helpers: the editor is generic over its schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditor = BlockNoteEditor<any, any, any>;

/** The slash menu items for the math block and inline math, when the schema has them. */
export const getMathSlashMenuItems = (
    editor: AnyEditor
): Omit<DefaultReactSuggestionItem, "key">[] => {
    const dictionary = getMathDictionary(editor);
    const items: Omit<DefaultReactSuggestionItem, "key">[] = [];
    if ("mathBlock" in editor.schema.blockSchema) {
        items.push({
            ...dictionary.slash_menu.math_block,
            aliases: [...dictionary.slash_menu.math_block.aliases],
            icon: <TbMath size={18} />,
            onItemClick: () => {
                const block = insertOrUpdateBlockForSlashMenu(editor, { type: "mathBlock" });
                // Open the source popup on the new block, ready to type.
                editor.getExtension(SourceBlockWithPreviewExtension)?.store.setState((state) => ({
                    ...state,
                    popupOpen: block.id,
                }));
                requestAnimationFrame(() => {
                    editor.setTextCursorPosition(block.id, "end");
                    editor.focus();
                });
            },
        });
    }
    if ("math" in editor.schema.inlineContentSchema) {
        items.push({
            ...dictionary.slash_menu.inline_math,
            aliases: [...dictionary.slash_menu.inline_math.aliases],
            icon: <TbMath size={18} />,
            onItemClick: () => {
                const view = editor.prosemirrorView;
                const from = view.state.selection.from;
                editor.insertInlineContent([{ type: "math", content: "" } as never, " "]);
                requestAnimationFrame(() => {
                    view.dispatch(
                        view.state.tr.setSelection(TextSelection.create(view.state.doc, from + 1))
                    );
                    editor.focus();
                });
            },
        });
    }
    return items;
};

/** The toolbar's block type list entry for the math block. */
export const getMathBlockTypeSelectItems = (editor: AnyEditor): BlockTypeSelectItem[] => [
    { name: getMathDictionary(editor).block_type_select.name, type: "mathBlock", icon: TbMath },
];
