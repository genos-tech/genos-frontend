/**
 * A very small diagram: boxes in order, joined by arrows (a row on a wide screen, a column on a
 * phone; `kit/lp.css`). Used by the docs guides and by ```flow blocks in blog posts. A list, so a
 * screen reader hears the steps in order.
 */
export function Flow({ steps, set = false }: { steps: readonly string[]; set?: boolean }) {
    // A set (the four roles) has no order, so it gets no arrows.
    const List = set ? "ul" : "ol";
    return (
        <List className={set ? "lp-flow lp-flow--set" : "lp-flow"}>
            {steps.map((step) => (
                <li key={step}>
                    <span>{step}</span>
                </li>
            ))}
        </List>
    );
}
