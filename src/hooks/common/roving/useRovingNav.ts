// Roving tab stops for a board and a calendar (MIP-1402), applied to the DOM.
//
// Same idea as the task table's `useGridNav` (MIP-1230): every card / day / event is a real
// control and a surface with hundreds of them is hundreds of Tab presses. Here the unit is a
// GROUP (a board column, a day column of the timeline, the month grid): each group has ONE
// tab stop, its active item; the arrow keys move between items and groups; Tab leaves.
// `rovingMoves.ts` is the pure key model; this file reads the DOM into it.
//
// The markup contract (the host spells it, a source test pins it):
//   - an item carries `data-roving-item="<id>"` and `data-roving-group="<group id>"` and IS the
//     focus target (a card, a day cell, an event block);
//   - optionally `data-roving-sort="<number>"` to order a group's items by something other than
//     the DOM order (the timeline puts all-day events first, then by start time), and
//     `data-roving-default` on the item a group should start on (today in the month).
//   - the other focusable elements inside an item (a button on a card, a chip in a day) are
//     taken out of the Tab order, unless `keepInner` is set: then they stay tabbable for the
//     ACTIVE item only (a card's own controls), so nothing becomes unreachable.
//
// No React state: the active item per group lives in this object, the tabindex values are
// written to the DOM, and a MutationObserver (child lists only) re-applies them after a card
// moved, an event arrived or the month changed. A board is a render-storm hot spot (memory
// perf-render-storm-mip904): moving the focus re-renders nothing.

import { useCallback, useEffect, useMemo, useRef } from "react";

import {
    intentForKey,
    type RovingModel,
    type RovingMove,
    type RovingPos,
    type RovingTarget,
} from "./rovingMoves";

export const ROVING_ITEM_ATTR = "data-roving-item";
export const ROVING_GROUP_ATTR = "data-roving-group";
export const ROVING_SORT_ATTR = "data-roving-sort";
export const ROVING_DEFAULT_ATTR = "data-roving-default";
/** Where an item's own tabindex of an interior control is kept while it is -1. */
const ORIGINAL_ATTR = "data-roving-tabindex";

const ITEM = `[${ROVING_ITEM_ATTR}]`;
const FOCUSABLE =
    'button:not([disabled]), [role="button"], a[href], input:not([disabled]):not([type="hidden"]),' +
    ' select:not([disabled]), textarea:not([disabled]), [role="combobox"], [tabindex]';
const TEXT_ENTRY = 'input, textarea, select, [contenteditable="true"], [role="combobox"]';
/** A target that did not exist yet (another month): give the host this long to show it. */
const PENDING_MS = 1500;
/** The focused item was unmounted (a card dropped into another column): the focus is put
 *  back on it only when a key was pressed on the surface this recently. */
const REFOCUS_MS = 5000;

export type RovingConfig = {
    move: RovingMove;
    /** Groups in the order they first appear in the DOM (a board), or sorted by id (days). */
    groupOrder?: "dom" | "sorted";
    /** Keep the controls inside the ACTIVE item in the Tab order (a card's own buttons). */
    keepInner?: boolean;
    /** True while the surface owns the keys (a card is lifted by the drag library). */
    paused?: (container: HTMLElement) => boolean;
    /** Enter pressed on an item itself (not on something inside it). */
    activate?: (pos: RovingPos, event: KeyboardEvent) => void;
    /** A move to an item that is not in the model: show it (change the month); the focus
     *  follows when it appears. */
    onOutside?: (target: RovingPos) => void;
};

const posOf = (el: Element): RovingPos | null => {
    const group = el.getAttribute(ROVING_GROUP_ATTR);
    const item = el.getAttribute(ROVING_ITEM_ATTR);
    return group !== null && item !== null ? { group, item } : null;
};

const isTextEntry = (node: Element) => node.matches(TEXT_ENTRY) || !!node.closest(TEXT_ENTRY);

export class RovingNav {
    private container: HTMLElement | null = null;
    private active = new Map<string, string>();
    /** The index the active item had, for the nearest-item fallback when it unmounts. */
    private lastIndex = new Map<string, number>();
    private pending: RovingPos | null = null;
    private pendingTimer: ReturnType<typeof setTimeout> | null = null;
    private frame = 0;
    /** The item that has the focus, and when a key was last pressed on the surface: a
     *  card that is dropped into another column is a new element, and the drag library
     *  does not always manage to focus it. */
    private focused: { el: HTMLElement; item: string } | null = null;
    private lastKeyAt = 0;
    /** What the mutations since the last frame touched: items that came or went (everything is
     *  read again), or only the content of some items (just those are fixed up). */
    private structural = false;
    private dirty = new Set<HTMLElement>();

    constructor(private readonly getConfig: () => RovingConfig) {}

    attach(container: HTMLElement): () => void {
        this.container = container;
        const onKeyDown = (event: KeyboardEvent) => this.onKeyDown(event);
        const onFocusIn = (event: FocusEvent) => this.activateFrom(event.target);
        container.addEventListener("keydown", onKeyDown);
        container.addEventListener("focusin", onFocusIn);
        const observer = new MutationObserver((records) => this.onMutations(records));
        observer.observe(container, { childList: true, subtree: true });
        this.sync();
        return () => {
            observer.disconnect();
            container.removeEventListener("keydown", onKeyDown);
            container.removeEventListener("focusin", onFocusIn);
            if (this.frame) cancelAnimationFrame(this.frame);
            this.frame = 0;
            this.clearPending();
            if (this.container === container) this.container = null;
        };
    }

    /** The active item of a group, for tests. */
    getActive(group: string): string | undefined {
        return this.active.get(group);
    }

    // ── model ────────────────────────────────────────────────────────────────

    private itemEls(): HTMLElement[] {
        return this.container
            ? Array.from(this.container.querySelectorAll<HTMLElement>(ITEM))
            : [];
    }

    /** The groups and their items, read from the DOM now. */
    private read(): { model: RovingModel; els: Map<string, HTMLElement>; defaults: Set<string> } {
        const config = this.getConfig();
        const byGroup = new Map<string, { id: string; sort: number; el: HTMLElement }[]>();
        const els = new Map<string, HTMLElement>();
        const defaults = new Set<string>();
        for (const el of this.itemEls()) {
            const pos = posOf(el);
            if (!pos) continue;
            const sortAttr = el.getAttribute(ROVING_SORT_ATTR);
            const key = `${pos.group}\u0000${pos.item}`;
            els.set(key, el);
            if (el.hasAttribute(ROVING_DEFAULT_ATTR)) defaults.add(key);
            const list = byGroup.get(pos.group) ?? [];
            list.push({ id: pos.item, sort: sortAttr === null ? 0 : Number(sortAttr), el });
            byGroup.set(pos.group, list);
        }
        const groups = Array.from(byGroup.keys());
        if (config.groupOrder === "sorted") groups.sort();
        const items = new Map<string, string[]>();
        for (const [group, list] of byGroup) {
            // Array.prototype.sort is stable: equal keys stay in DOM order.
            const sorted = list.some((x) => x.sort !== 0)
                ? [...list].sort((a, b) => a.sort - b.sort)
                : list;
            items.set(
                group,
                sorted.map((x) => x.id)
            );
        }
        return {
            model: { groups, itemsOf: (group) => items.get(group) ?? [] },
            els,
            defaults,
        };
    }

    // ── the tab stops ────────────────────────────────────────────────────────

    private schedule() {
        if (this.frame || !this.container) return;
        this.frame = requestAnimationFrame(() => {
            this.frame = 0;
            const structural = this.structural;
            const dirty = Array.from(this.dirty);
            this.structural = false;
            this.dirty.clear();
            if (structural) {
                this.sync();
                return;
            }
            // Only the inside of some items changed (a button re-mounted in a card): fix those.
            const keepInner = !!this.getConfig().keepInner;
            for (const el of dirty) {
                const pos = el.isConnected ? posOf(el) : null;
                if (pos) this.applyStop(el, this.active.get(pos.group) === pos.item, keepInner);
            }
        });
    }

    /** A drag, a placeholder, a text change: most mutations on a board are not about the
     *  tab stops, and a card in a drag is re-measured every frame. Only items that were added
     *  or removed, and the inside of an item, count. */
    private onMutations(records: MutationRecord[]) {
        const container = this.container;
        if (!container) return;
        const holdsItem = (node: Node) =>
            node instanceof HTMLElement &&
            (node.matches(ITEM) || node.querySelector(ITEM) !== null);
        let touched = false;
        for (const record of records) {
            const target = record.target;
            const own = target instanceof Element ? target.closest<HTMLElement>(ITEM) : null;
            if (own && container.contains(own)) {
                this.dirty.add(own);
                touched = true;
            }
            if (!this.structural) {
                const changed = (nodes: NodeList) => Array.from(nodes).some(holdsItem);
                if (changed(record.addedNodes) || changed(record.removedNodes)) {
                    this.structural = true;
                    touched = true;
                }
            }
        }
        if (touched) this.schedule();
    }

    /** Make every group's active item its tab stop, and take the rest out of the Tab order. */
    private sync() {
        if (!this.container) return;
        const keepInner = !!this.getConfig().keepInner;
        const { model, els, defaults } = this.read();
        const present = new Set(model.groups);
        for (const group of Array.from(this.active.keys())) {
            if (!present.has(group)) {
                this.active.delete(group);
                this.lastIndex.delete(group);
            }
        }
        for (const group of model.groups) {
            const items = model.itemsOf(group);
            let current = this.active.get(group);
            if (current === undefined || !items.includes(current)) {
                // The group's own default first (today, or the 1st, when the month changed),
                // else the nearest to where the stop was, else the first.
                const remembered = this.lastIndex.get(group);
                current =
                    items.find((id) => defaults.has(`${group}\u0000${id}`)) ??
                    (remembered !== undefined
                        ? items[Math.min(remembered, items.length - 1)]
                        : items[0]);
                this.active.set(group, current);
            }
            this.lastIndex.set(group, Math.max(0, items.indexOf(current)));
            for (const id of items) {
                const el = els.get(`${group}\u0000${id}`);
                if (el) this.applyStop(el, id === current, keepInner);
            }
        }
        this.resolvePending(model, els);
        this.refocusMoved(els);
    }

    private applyStop(el: HTMLElement, isActive: boolean, keepInner: boolean) {
        const own = isActive ? "0" : "-1";
        if (el.getAttribute("tabindex") !== own) el.setAttribute("tabindex", own);
        const restore = keepInner && isActive;
        for (const inner of el.querySelectorAll<HTMLElement>(FOCUSABLE)) {
            // An item nested in an item is its own stop (none today); a text field keeps its own tabindex.
            if (inner.closest(ITEM) !== el || isTextEntry(inner)) continue;
            if (restore) {
                if (inner.hasAttribute(ORIGINAL_ATTR)) {
                    const original = inner.getAttribute(ORIGINAL_ATTR);
                    if (original) inner.setAttribute("tabindex", original);
                    else inner.removeAttribute("tabindex");
                    inner.removeAttribute(ORIGINAL_ATTR);
                }
            } else if (!inner.hasAttribute(ORIGINAL_ATTR)) {
                inner.setAttribute(ORIGINAL_ATTR, inner.getAttribute("tabindex") ?? "");
                inner.setAttribute("tabindex", "-1");
            } else if (inner.getAttribute("tabindex") !== "-1") {
                // React wrote its own value over ours: ours wins while the item is not active.
                inner.setAttribute("tabindex", "-1");
            }
        }
    }

    private setActive(pos: RovingPos) {
        if (this.active.get(pos.group) === pos.item) return;
        this.active.set(pos.group, pos.item);
        this.sync();
    }

    private elFor(pos: RovingPos): HTMLElement | null {
        return (
            this.itemEls().find((el) => {
                const p = posOf(el);
                return p !== null && p.group === pos.group && p.item === pos.item;
            }) ?? null
        );
    }

    private activateFrom(node: EventTarget | null) {
        if (!(node instanceof Element) || !this.container) return;
        const item = node.closest<HTMLElement>(ITEM);
        if (!item || !this.container.contains(item)) return;
        const pos = posOf(item);
        if (pos) {
            this.focused = { el: item, item: pos.item };
            this.setActive(pos);
        }
    }

    /** The focused card was unmounted and mounted again elsewhere by a keyboard move. */
    private refocusMoved(els: Map<string, HTMLElement>) {
        const focused = this.focused;
        if (!focused || focused.el.isConnected) return;
        this.focused = null;
        const current = document.activeElement;
        if (current && current !== document.body) return;
        if (Date.now() - this.lastKeyAt > REFOCUS_MS) return;
        for (const [key, el] of els) {
            const [group, item] = key.split("\u0000");
            if (item !== focused.item) continue;
            this.active.set(group, item);
            this.sync();
            el.focus();
            return;
        }
    }

    // ── pending target (the month that has to be shown first) ─────────────────

    private clearPending() {
        this.pending = null;
        if (this.pendingTimer) clearTimeout(this.pendingTimer);
        this.pendingTimer = null;
    }

    private resolvePending(model: RovingModel, els: Map<string, HTMLElement>) {
        const pending = this.pending;
        if (!pending) return;
        if (!model.itemsOf(pending.group).includes(pending.item)) return;
        const el = els.get(`${pending.group}\u0000${pending.item}`);
        this.clearPending();
        if (!el) return;
        this.active.set(pending.group, pending.item);
        this.sync();
        el.focus();
    }

    // ── keys ─────────────────────────────────────────────────────────────────

    private onKeyDown(event: KeyboardEvent) {
        const container = this.container;
        // A key somebody already handled (the drag library while a card is lifted, an
        // editor) is not ours.
        if (!container) return;
        this.lastKeyAt = Date.now();
        if (event.defaultPrevented) return;
        const config = this.getConfig();
        if (config.paused?.(container)) return;
        const node = event.target;
        if (!(node instanceof HTMLElement)) return;
        const itemEl = node.closest<HTMLElement>(ITEM);
        if (!itemEl || !container.contains(itemEl)) return;
        // Inside a field (a quick-add title, a select) the keys are the field's.
        if (isTextEntry(node) || itemEl.querySelector(TEXT_ENTRY) !== null) return;
        const from = posOf(itemEl);
        if (!from) return;

        if (event.key === "Enter" && node === itemEl && config.activate) {
            if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
                return;
            event.preventDefault();
            config.activate(from, event);
            return;
        }

        const intent = intentForKey(event, getComputedStyle(container).direction === "rtl");
        if (!intent) return;
        const { model } = this.read();
        const target: RovingTarget | null = config.move(model, from, intent);
        if (!target) return;
        event.preventDefault();
        if (target.outside) {
            if (!config.onOutside) return;
            this.clearPending();
            this.pending = { group: target.group, item: target.item };
            this.pendingTimer = setTimeout(() => this.clearPending(), PENDING_MS);
            config.onOutside({ group: target.group, item: target.item });
            // The host may not change anything (the day is on this grid already): look now.
            this.structural = true;
            this.schedule();
            return;
        }
        if (target.group === from.group && target.item === from.item) return;
        const el = this.elFor(target);
        if (!el) return;
        this.setActive(target);
        el.focus();
    }
}

/** The controller and the ref callback that attaches it to the surface's element.
 *  `config` may change every render; the latest one is what the keys use. */
export const useRovingNav = (
    config: RovingConfig,
    /** A ref of the host's own that must hold the same element (a stable ref object). */
    target?: { current: HTMLElement | null }
) => {
    const latest = useRef(config);
    useEffect(() => {
        latest.current = config;
    });
    const nav = useMemo(() => new RovingNav(() => latest.current), []);
    const cleanup = useRef<(() => void) | null>(null);
    const ref = useCallback(
        (element: HTMLElement | null) => {
            cleanup.current?.();
            cleanup.current = element ? nav.attach(element) : null;
            if (target) target.current = element;
        },
        [nav, target]
    );
    return { nav, ref };
};
