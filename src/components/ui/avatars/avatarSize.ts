import { AVATAR, AvatarSize } from "../../../theme/tokens/scales";

/** Pixel diameter for a size that is not responsive. For wrappers that lay
 *  out around the avatar (`UserAvatar`'s presence dot) and for tests. */
export const avatarPx = (size: AvatarSize | number | undefined): number =>
    size === undefined ? AVATAR.md : typeof size === "number" ? size : AVATAR[size];
