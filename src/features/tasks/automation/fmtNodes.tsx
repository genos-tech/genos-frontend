import { Fragment, ReactNode } from "react";

/** `fmt` for React nodes: every `{name}` of the template becomes that node. */
export const fmtNodes = (template: string, vars: Record<string, ReactNode>): ReactNode =>
    template
        .split(/(\{\w+\})/)
        .map((part, i) => (
            <Fragment key={i}>{/^\{\w+\}$/.test(part) ? vars[part.slice(1, -1)] : part}</Fragment>
        ));
