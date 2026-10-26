/**
 * Show where a link in a note, task body, comment or chat message really goes
 * (MIP-737).
 *
 * MIP-723 prints the host after an external link in rendered MODEL output, so
 * `[the design doc](https://attacker.example/x)` reads "the design doc
 * (attacker.example)". A note the agent writes through an approved
 * `create_note` / `update_note`, or through MCP, becomes a real BlockNote
 * document, where the same link is an ordinary one with the host shown nowhere,
 * for everyone who opens it from then on. A planted instruction could therefore
 * leave a phishing link that reads like an internal one. The approval preview
 * shows the host, so the person approving can see it; later readers could not.
 *
 * This marks every external link in every editor, not only agent-written ones, so
 * a link a person pasted is covered too. It sets `data-link-host` on the anchor
 * and a rule in `App.css` prints it. One document-level observer covers all
 * twenty places BlockNote renders; wiring each editor would miss the next one.
 *
 * **The host comes from the `href`, never from the label.** The label is the
 * author's text (`[internal.company.com](https://attacker.example)`); the
 * attribute is derived from the URL the browser will actually open.
 *
 * It is a label, not a gate: the link still works. (A `javascript:` URL is a
 * different problem, handled where links are stored and rendered: MIP-821.)
 */

import { externalHost } from "../features/agentQA/agentMarkdown";

export const LINK_HOST_ATTRIBUTE = "data-link-host";

const EDITOR_SELECTOR = ".bn-editor";
const ANCHOR_SELECTOR = "a[href]";

/** Set, change or clear the host label on one anchor. Returns whether it changed. */
export const labelAnchor = (anchor: HTMLAnchorElement): boolean => {
    const host = externalHost(anchor.getAttribute("href") ?? undefined);
    const current = anchor.getAttribute(LINK_HOST_ATTRIBUTE);
    if (host === null) {
        if (current === null) return false;
        anchor.removeAttribute(LINK_HOST_ATTRIBUTE);
        return true;
    }
    if (current === host) return false;
    anchor.setAttribute(LINK_HOST_ATTRIBUTE, host);
    return true;
};

/** Label every anchor under `root` that sits inside an editor. */
export const labelExternalLinksIn = (root: ParentNode): number => {
    let changed = 0;
    const anchors =
        root instanceof Element && root.matches(ANCHOR_SELECTOR)
            ? [root as HTMLAnchorElement]
            : Array.from(root.querySelectorAll<HTMLAnchorElement>(ANCHOR_SELECTOR));
    for (const anchor of anchors) {
        // Only links inside an editor: the rest of the app has its own link
        // styling and a host printed after a sidebar link would be noise.
        if (!anchor.closest(EDITOR_SELECTOR)) continue;
        if (labelAnchor(anchor)) changed += 1;
    }
    return changed;
};

/**
 * Start labelling. Returns a function that stops it.
 *
 * The editor DOM changes on every keystroke and every remote edit, so the observer
 * only records WHICH subtrees changed and a single animation frame later labels
 * those, not the whole document. An `href` edited in place is caught by watching
 * that one attribute.
 */
export const startLabellingExternalLinks = (doc: Document = document): (() => void) => {
    // A caption on a link must never be able to stop the app, so anything that goes
    // wrong starting it (no body yet, no MutationObserver) means "no labels", not
    // an exception in the entry file.
    try {
        return observe(doc);
    } catch {
        return () => {};
    }
};

const observe = (doc: Document): (() => void) => {
    if (typeof MutationObserver === "undefined" || !doc.body) return () => {};
    const pending = new Set<Node>();
    let frame = 0;

    const flush = () => {
        frame = 0;
        const roots = Array.from(pending);
        pending.clear();
        for (const node of roots) {
            if (!node.isConnected) continue;
            if (node instanceof Element) labelExternalLinksIn(node);
        }
    };

    const schedule = () => {
        if (frame) return;
        frame = window.requestAnimationFrame(flush);
    };

    const observer = new MutationObserver((records) => {
        for (const record of records) {
            if (record.type === "attributes") {
                pending.add(record.target);
            } else {
                record.addedNodes.forEach((node) => {
                    if (node instanceof Element) pending.add(node);
                });
            }
        }
        if (pending.size > 0) schedule();
    });

    observer.observe(doc.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["href"],
    });

    // Anything already on the page when this starts.
    labelExternalLinksIn(doc.body);

    return () => {
        observer.disconnect();
        if (frame) window.cancelAnimationFrame(frame);
        pending.clear();
    };
};
