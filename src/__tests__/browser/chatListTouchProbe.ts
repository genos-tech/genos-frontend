/**
 * The measurement run IN the page by `TouchTargetsChatListMIP1515.test.ts`. A string, because it is
 * sent to the browser as an expression. Every number is a CSS px measured from the laid-out page by
 * `elementFromPoint`, i.e. by what a finger would actually reach.
 *
 * For each chat row it reports the row's rect and, for the avatar, the pin and the "...":
 *   rect   the control's own box
 *   hit    the bounding box of every point (1px grid, +-40px around the control) that resolves to it
 *   centre what `elementFromPoint` returns at the control's centre (must be the control)
 *   miss   what it returns 20px beyond the 44px region (must NOT be the control)
 * plus `rowCentre` (what the middle of the row resolves to) and `stray`: how many points of an 8px
 * grid over the left 60% of the row resolve to an action button (the MIP-1455 bug: all of them).
 */
export const PROBE = `(() => {
  const FINGER = 44;
  const list = document.querySelector('[data-testid="chat-list"]');
  const rows = [...list.children];
  const id = (el) => !el ? 'null'
    : el.closest('.NavItem-actions') ? 'action:' + (el.closest('button')?.getAttribute('aria-label') ?? 'pin')
    : el.closest('[role="button"]') ? (el.closest('[role="button"]').parentElement.parentElement === list ? 'row' : 'avatar')
    : 'other:' + el.tagName;
  const box = (r) => ({ x: +r.left.toFixed(1), y: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
  const owns = (el, hit) => !!hit && (hit === el || el.contains(hit));
  const region = (el) => {
    const r = el.getBoundingClientRect();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let y = Math.floor(r.top) - 40; y <= Math.ceil(r.bottom) + 40; y++) {
      for (let x = Math.floor(r.left) - 40; x <= Math.ceil(r.right) + 40; x++) {
        if (owns(el, document.elementFromPoint(x + 0.5, y + 0.5))) {
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
        }
      }
    }
    return x0 === 1e9 ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };
  const probe = (el, name) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = region(el);
    const top = cy - FINGER / 2;
    const left = cx - Math.max(r.width, FINGER) / 2;
    return {
      name, rect: box(r), hit,
      centre: id(document.elementFromPoint(cx, cy)),
      centreOwned: owns(el, document.elementFromPoint(cx, cy)),
      // 20px above the 44px region, and (avatar only: it is 44 wide) 20px to its right
      missAbove: owns(el, document.elementFromPoint(cx, top - 20)),
      missRight: owns(el, document.elementFromPoint(left + Math.max(r.width, FINGER) + 20, cy)),
      pseudo: getComputedStyle(el, '::after').content,
      contain: getComputedStyle(el).contain,
      position: getComputedStyle(el).position,
    };
  };
  return {
    pointerCoarse: matchMedia('(pointer: coarse)').matches,
    hoverNone: matchMedia('(hover: none)').matches,
    viewport: { w: innerWidth, h: innerHeight },
    scrollW: document.documentElement.scrollWidth,
    rows: rows.map((li, i) => {
      const rowBtn = li.querySelector(':scope > [role="button"]');
      const actions = li.querySelector('.NavItem-actions');
      const btns = [...actions.querySelectorAll(':scope > button')];
      const more = btns[btns.length - 1];
      const pin = btns[btns.length - 2];
      const avatar = rowBtn.querySelector('[role="button"]');
      const rr = li.getBoundingClientRect();
      const mid = rowBtn.querySelector('.NavItem-label, [class*="label"]') ?? rowBtn;
      const mr = mid.getBoundingClientRect();
      const rowCentre = document.elementFromPoint(mr.left + Math.min(mr.width / 2, 60), rr.top + rr.height / 2);
      const counts = {};
      let stray = 0;
      for (let y = rr.top + 4; y < rr.bottom; y += 8) for (let x = rr.left + 4; x < rr.right; x += 8) {
        const k = id(document.elementFromPoint(x, y));
        counts[k] = (counts[k] || 0) + 1;
        if (k.startsWith('action:') && x < rr.left + rr.width * 0.6) stray++;
      }
      return {
        i, row: box(rr), rowBtn: box(rowBtn.getBoundingClientRect()),
        rowGeoCentre: id(document.elementFromPoint(rr.left + rr.width / 2, rr.top + rr.height / 2)),
        rowCentre: id(rowCentre), rowCentreXY: [Math.round(mr.left + Math.min(mr.width / 2, 60)), Math.round(rr.top + rr.height / 2)],
        counts, stray,
        pin: probe(pin, 'pin'), more: probe(more, 'more'), avatar: avatar ? probe(avatar, 'avatar') : null,
      };
    }),
    search: (() => {
      const input = document.querySelector('input[role="combobox"], .MuiAutocomplete-root input');
      const root = input?.closest('.MuiAutocomplete-root');
      const arrow = root?.querySelector('.MuiAutocomplete-popupIndicator');
      return arrow ? probe(arrow, 'open-arrow') : null;
    })(),
  };
})()`;
