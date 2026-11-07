import { forwardRef, ReactNode } from "react";
import { Avatar, AvatarGroup, AvatarProps } from "@mui/joy";

import { g } from "../../../theme/tokens";
import { AVATAR, AvatarSize } from "../../../theme/tokens/scales";
import { initialOf } from "../../../utils/initials";

/**
 * The one place a Joy `<Avatar>` is rendered (MIP-1133). Everything else in
 * the app asks for this, or for `UserAvatar` / `GMAvatar` / `MDMAvatar` /
 * `ProjectAvatar`, which are built on it, so size, initials and tint can't
 * drift per call site again. `no-restricted-imports` style rule, enforced by
 * `src/__tests__/avatarBase.test.ts`: no file outside this folder imports
 * Avatar from `@mui/joy`.
 */

export { AvatarGroup };
export type { AvatarSize };

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

type Responsive = Partial<Record<"xs" | "sm" | "md" | "lg" | "xl", AvatarSize>>;

export type BaseAvatarProps = Omit<AvatarProps, "size" | "children" | "color"> & {
    /** A step of the avatar scale, or a responsive map of steps. A bare
     *  number is for wrappers that forward a caller-supplied pixel size
     *  (`UserAvatar`); new code uses the scale. Default `md` (32). */
    size?: AvatarSize | Responsive | number;
    /** Shown as its first letter when there is no picture and no `children`. */
    name?: string | null;
    /** An icon (or anything) for the no-picture state; wins over `name`. */
    children?: ReactNode;
    /** Tints the no-picture state with a status color. `neutral` keeps Joy's. */
    tone?: Tone;
    /** `rounded` is for things that are not people (a team's mark). */
    shape?: "circle" | "rounded";
};

const px = (size: AvatarSize | number): string =>
    `${typeof size === "number" ? size : AVATAR[size]}px`;

const cssSize = (size: BaseAvatarProps["size"]) => {
    if (size === undefined) return px("md");
    if (typeof size === "object") {
        return Object.fromEntries(
            Object.entries(size).map(([bp, step]) => [bp, px(step as AvatarSize)])
        );
    }
    return px(size);
};

export const BaseAvatar = forwardRef<HTMLDivElement, BaseAvatarProps>(function BaseAvatar(
    { size, name, children, tone = "neutral", shape = "circle", sx, ...rest },
    ref
) {
    const tint =
        tone === "neutral"
            ? undefined
            : tone === "accent"
              ? {
                    bgcolor: g.accent.subtle,
                    color: g.accent.text,
                    "--Icon-color": g.accent.text,
                }
              : {
                    bgcolor: g[tone].subtle,
                    color: g[tone].text,
                    "--Icon-color": g[tone].text,
                };
    return (
        <Avatar
            ref={ref}
            // Joy's `sm` reads `--Avatar-size`, so one variable sizes the
            // circle, the group overlap and the initials together.
            size="sm"
            sx={[
                {
                    "--Avatar-size": cssSize(size),
                    // Joy scales initials by 0.4375; floor it so a 20px
                    // avatar's letter stays legible.
                    fontSize: "max(10px, calc(var(--Avatar-size) * 0.4375))",
                    // An icon child scales with the circle instead of each
                    // call site picking a pixel size. `:where` keeps the
                    // specificity at zero, so an icon that sets its own
                    // `fontSize` still wins.
                    ":where(&) > svg": { fontSize: "calc(var(--Avatar-size) * 0.75)" },
                    ...(shape === "rounded" ? { "--Avatar-radius": g.radius.md } : null),
                    ...tint,
                },
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
            {...rest}
        >
            {children ?? (name === undefined ? undefined : initialOf(name))}
        </Avatar>
    );
});
