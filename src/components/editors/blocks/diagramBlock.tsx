/*
 * The diagram block, with Mermaid loaded on demand (MIP-1025).
 *
 * Adapted from `@blocknote/diagram-block` 0.57.0 (https://github.com/TypeCellOS/BlockNote,
 * MPL-2.0, Copyright (c) the BlockNote contributors); this file is covered by MPL-2.0 as
 * well. Kept IDENTICAL on purpose (a stored document and the Yjs binding depend on it): the
 * type name (`diagram`), no props, PLAIN-text content, the node flags (`meta`) and
 * `runsBefore: ["codeBlock"]`. `parity.test.ts` checks them against the installed package.
 * New: the preview loads Mermaid with `import()` on the first diagram that is drawn.
 */
import { useEffect, useState } from "react";
/* eslint-disable react-refresh/only-export-components -- a spec module: its exports are specs and menu items, not components to hot-reload */
import {
    createBlockConfig,
    parsePreCodeContent,
    plainContentToString,
    type BlockNoteEditor,
} from "@blocknote/core";
import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core/extensions";
import {
    createReactBlockSpec,
    PreviewPlaceholder,
    SourceBlockWithPreview,
    type BlockTypeSelectItem,
    type DefaultReactSuggestionItem,
    type ReactCustomBlockRenderProps,
} from "@blocknote/react";
import { TbSitemap } from "react-icons/tb";

import { loadMermaid } from "./loadRenderers";
import { getDiagramDictionary } from "./mathDiagramDictionaries";

export const diagramBlockConfig = createBlockConfig(
    () => ({ type: "diagram", propSchema: {}, content: "plain" }) as const
);

/**
 * Mermaid's drawing of a source. It is loaded on the first non-empty source. As in the
 * package, a source that does not render keeps the last good drawing next to the error.
 */
const useDiagramSvg = (source: string, element: HTMLElement | undefined) => {
    const [svg, setSvg] = useState("");
    const [error, setError] = useState<string | undefined>();
    useEffect(() => {
        if (!source.trim()) {
            setSvg("");
            setError(undefined);
            return;
        }
        const fontFamily = element ? getComputedStyle(element).fontFamily : undefined;
        let cancelled = false;
        (async () => {
            try {
                const { renderDiagramSvg } = await loadMermaid();
                const drawn = await renderDiagramSvg(source, fontFamily);
                if (!cancelled) {
                    setSvg(drawn);
                    setError(undefined);
                }
            } catch (failure) {
                if (!cancelled)
                    setError(failure instanceof Error ? failure.message : String(failure));
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [source, element]);
    return { svg, error };
};

const DiagramBlockView = (props: ReactCustomBlockRenderProps<typeof diagramBlockConfig>) => {
    const source = plainContentToString(props.block.content).trim();
    const { svg, error } = useDiagramSvg(source, props.editor.domElement);
    const dictionary = getDiagramDictionary(props.editor).block;
    return (
        <SourceBlockWithPreview
            block={props.block}
            contentRef={props.contentRef}
            editor={props.editor}
            error={error}
            source={source}
            sourcePlaceholder={dictionary.input_placeholder}
            emptySourcePlaceholder={
                <PreviewPlaceholder icon={<TbSitemap />} text={dictionary.add_source_text} />
            }
            errorPreview={
                <PreviewPlaceholder
                    icon={<TbSitemap />}
                    text={dictionary.preview_error_text}
                    error
                />
            }
            preview={
                svg ? (
                    <div
                        aria-label={dictionary.preview_label}
                        role="img"
                        dangerouslySetInnerHTML={{ __html: svg }}
                        style={{ display: "flex", justifyContent: "center" }}
                    />
                ) : source ? (
                    <span aria-busy="true" />
                ) : undefined
            }
        />
    );
};

/** A `<pre><code class="language-mermaid">` is a diagram (what `toExternalHTML` writes, and a paste). */
const parseDiagramCode = (element: HTMLElement) => {
    if (element.tagName !== "PRE") return undefined;
    const code = element.firstElementChild;
    if (element.childElementCount === 1 && code?.tagName === "CODE") {
        const language =
            code.getAttribute("data-language") ||
            code.className
                .split(" ")
                .find((name) => name.startsWith("language-"))
                ?.replace("language-", "");
        return language === "mermaid" ? {} : undefined;
    }
    return undefined;
};

export const createDiagramBlockSpec = () =>
    createReactBlockSpec(diagramBlockConfig, {
        meta: {
            code: true,
            defining: true,
            isolating: false,
            highlight: () => "mermaid",
            hasPreview: true,
        },
        experimental_keyboard: { enter: "line-break" },
        parse: parseDiagramCode,
        parseContent: (args) => parsePreCodeContent(args, "diagram"),
        runsBefore: ["codeBlock"],
        render: (props) => <DiagramBlockView {...props} />,
        toExternalHTML: (props) => (
            <pre>
                <code
                    ref={props.contentRef}
                    className="language-mermaid"
                    data-language="mermaid"
                />
            </pre>
        ),
    })();

// The same signature as BlockNote's own menu helpers: the editor is generic over its schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditor = BlockNoteEditor<any, any, any>;

export const getDiagramSlashMenuItems = (
    editor: AnyEditor
): Omit<DefaultReactSuggestionItem, "key">[] =>
    "diagram" in editor.schema.blockSchema
        ? [
              {
                  ...getDiagramDictionary(editor).slash_menu.diagram,
                  aliases: [...getDiagramDictionary(editor).slash_menu.diagram.aliases],
                  icon: <TbSitemap size={18} />,
                  onItemClick: () => {
                      insertOrUpdateBlockForSlashMenu(editor, {
                          type: "diagram",
                          content: "graph TD\n    A[Start] --> B[Stop]",
                      });
                  },
              },
          ]
        : [];

export const getDiagramBlockTypeSelectItems = (editor: AnyEditor): BlockTypeSelectItem[] => [
    {
        name: getDiagramDictionary(editor).block_type_select.name,
        type: "diagram",
        icon: TbSitemap,
    },
];
