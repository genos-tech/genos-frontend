import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey } from "prosemirror-state";

import { externalHost } from "../../../features/agentQA/agentMarkdown";
import { LINK_HOST_ATTRIBUTE } from "../../../utils/labelExternalLinks";

/**
 * Where an external link goes, printed after it, inside an EDITABLE editor
 * (MIP-737 caption, MIP-990 fix).
 *
 * MIP-737 prints the host with a document-level observer that writes
 * `data-link-host` onto every link from outside. In an editable editor that
 * write is a DOM change ProseMirror did not make: it re-reads the link, redraws
 * it as a new `<a>` without the attribute, the observer labels the new one, and
 * that repeats about once a frame. Every link in an editable editor was
 * replaced many times a second, so it showed no caption and a click on it
 * landed on an element that was already gone (MIP-990). A read-only editor is
 * not affected: ProseMirror does not watch the DOM of a view it can't edit.
 *
 * So inside an editable editor the attribute is not written from outside; the
 * editor draws it. This gives the link mark a view whose `<a>` is built with
 * `data-link-host` already on it, from the mark's own `href`, never from the
 * label (the MIP-737 rule). `labelExternalLinks` leaves anchors in an editable
 * region alone, and still labels everything else (read-only previews, bubbles).
 *
 * The anchor is built from the mark's own `toDOM`, so it has exactly the
 * attributes, class and target BlockNote gives a link, and a change of `href`
 * is a different mark, so it gets a new view with the new host. If the spec
 * ever has a shape this does not understand, it returns nothing and
 * ProseMirror draws the link its usual way (no caption, but no loop either).
 *
 * Add this to every editable BlockNote editor (a source-scan test fails the
 * build when one is missing).
 */
type MarkSpec = readonly [string, Record<string, unknown>, 0];

const isSimpleSpec = (spec: unknown): spec is MarkSpec =>
    Array.isArray(spec) &&
    spec.length === 3 &&
    typeof spec[0] === "string" &&
    typeof spec[1] === "object" &&
    spec[1] !== null &&
    !Array.isArray(spec[1]) &&
    spec[2] === 0 &&
    // An attribute name with a space is a namespaced one; leave those to ProseMirror.
    Object.keys(spec[1] as object).every((name) => !name.includes(" "));

export const linkMarkView = (
    mark: {
        attrs: Record<string, unknown>;
        type: { spec: { toDOM?: (...args: unknown[]) => unknown } };
    },
    _view: unknown,
    inline: boolean
) => {
    const spec = mark.type.spec.toDOM?.(mark, inline);
    if (!isSimpleSpec(spec)) return {};
    const dom = document.createElement(spec[0]);
    for (const [name, value] of Object.entries(spec[1])) {
        if (value != null) dom.setAttribute(name, String(value));
    }
    const href = typeof mark.attrs.href === "string" ? mark.attrs.href : undefined;
    const host = externalHost(href);
    if (host) dom.setAttribute(LINK_HOST_ATTRIBUTE, host);
    return { dom, contentDOM: dom };
};

export const linkHostCaption = createExtension({
    key: "link-host-caption",
    prosemirrorPlugins: [
        new Plugin({
            key: new PluginKey("linkHostCaption"),
            props: { markViews: { link: linkMarkView as never } },
        }),
    ],
});
