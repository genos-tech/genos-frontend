import type React from "react";

/** Inline code, as the developers page sets it (`lp-code` in kit/lp.css). */
export const Code = ({ children }: { children: React.ReactNode }) => (
    <code className="lp-code">{children}</code>
);
