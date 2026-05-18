import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

// Thin wrapper that pairs the emoji-mart data set with the picker
// component. Kept in its own module so that the parent EmojiPicker can
// `React.lazy(() => import("./EmojiPickerInner"))` and pull both
// dependencies (~80 kB gzipped combined) on demand rather than shipping
// them in the main app bundle. Without this split they ended up in the
// startup chunk because every chat / task surface that *could* show the
// picker eagerly imported the picker component.

type Props = {
    theme: "light" | "dark";
    onEmojiSelect: (emoji: { native: string }) => void;
};

export const EmojiPickerInner = ({ theme, onEmojiSelect }: Props) => (
    <Picker data={data} theme={theme} onEmojiSelect={onEmojiSelect} />
);

export default EmojiPickerInner;
