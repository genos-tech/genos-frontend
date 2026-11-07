/**
 * The DOM props a family component passes on to its root. A wrapping Tooltip
 * also hands down its own `sx` (the tooltip chip's border and background),
 * `className` and `style`; they would replace the component's own look, so they
 * are dropped here. There is deliberately no way to re-style a family component.
 */
export const domPropsOf = (rest: object): Record<string, unknown> => {
    const props: Record<string, unknown> = { ...rest };
    delete props.className;
    delete props.style;
    delete props.sx;
    return props;
};
