import type React from "react";

/** Inline code, as the developers page sets it. */
export const Code = ({ children }: { children: React.ReactNode }) => (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.8125rem] text-violet-700 dark:bg-slate-800 dark:text-violet-300">
        {children}
    </code>
);
