import React from "react";

// GitHub Primer Octicon SVG paths. Sourced from the open-source Primer
// Octicons (MIT). Inline so we don't carry an extra runtime dep for the
// 5-6 icons we actually render. Color comes from `currentColor` so MUI
// `sx={{ color: ... }}` works on the wrapping <Box>.

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

const Octicon = ({ size = 16, children, ...rest }: IconProps & { children: React.ReactNode }) => (
    <svg
        aria-hidden="true"
        fill="currentColor"
        height={size}
        viewBox="0 0 16 16"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
        {...rest}
    >
        {children}
    </svg>
);

// PR state icons -- one per (open / draft / merged / closed) state.

export const PrOpenIcon = (props: IconProps) => (
    <Octicon {...props}>
        <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
    </Octicon>
);

export const PrDraftIcon = (props: IconProps) => (
    <Octicon {...props}>
        <path d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 14a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM14 7.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0-3a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1.50 6a1 1 0 0 1-1-1V8a1 1 0 0 1 2 0v1.5a1 1 0 0 1-1 1Z" />
    </Octicon>
);

export const PrMergedIcon = (props: IconProps) => (
    <Octicon {...props}>
        <path d="M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z" />
    </Octicon>
);

export const PrClosedIcon = (props: IconProps) => (
    <Octicon {...props}>
        <path d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.22.22a.75.75 0 1 1 1.06 1.06L12.06 3.75l1.47 1.47a.75.75 0 1 1-1.06 1.06L11 4.81 9.53 6.28a.75.75 0 0 1-1.06-1.06l1.47-1.47-1.47-1.47a.75.75 0 0 1 1.06-1.06L11 2.69l1.47-1.47ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25-.5a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5Zm0 1.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
    </Octicon>
);

// CI status icons.

export const CheckPassingIcon = (props: IconProps) => (
    <Octicon {...props}>
        <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
    </Octicon>
);

export const CheckFailingIcon = (props: IconProps) => (
    <Octicon {...props}>
        <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
    </Octicon>
);

export const CheckPendingIcon = (props: IconProps) => (
    <Octicon {...props}>
        <path d="M8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
    </Octicon>
);

export const CheckNoneIcon = (props: IconProps) => (
    <Octicon {...props}>
        <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" opacity="0.5" />
    </Octicon>
);
