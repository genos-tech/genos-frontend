import { lazy, Suspense, useEffect, useRef } from "react";
import { useColorScheme } from "@mui/joy/styles";
import { createPortal } from "react-dom";

// The actual emoji-mart picker + its data table is code-split: lazy import
// keeps ~80 kB (gzipped) out of the main bundle. The picker only mounts
// after the user clicks an emoji button, by which time the chunk has
// usually downloaded; first-click latency is the trade-off and feels
// acceptable for a non-critical-path feature.
const EmojiPickerInner = lazy(() => import("./EmojiPickerInner"));

type EmojiPickerProps = {
    editorPos?: any;
    showEmojiPicker: boolean;
    setShowEmojiPicker: (value: boolean) => void;
    setSelectedEmoji: (emoji: any) => void;
    pickerBottomPosition?: number | string;
    pickerRightPosition?: number | string;
    pickerLeftPosition?: number | string;
    pickerTopPosition?: number | string;
    useFixedPosition?: boolean;
};
export const EmojiPicker = ({
    showEmojiPicker,
    setShowEmojiPicker,
    setSelectedEmoji,
    pickerBottomPosition = 210,
    pickerRightPosition = "auto",
    pickerLeftPosition = "auto",
    pickerTopPosition = "auto",
    useFixedPosition = false,
}: EmojiPickerProps) => {
    const { mode } = useColorScheme();
    const emojiPickerRef = useRef<HTMLDivElement>(null);

    const handleEmojiSelect = (emoji: any) => {
        const emojiSymbol = emoji.native;

        // Focus back to textarea after inserting emoji
        setTimeout(() => {
            setSelectedEmoji(emojiSymbol);
            setShowEmojiPicker(false);
        }, 0);
    };

    // Close emoji picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setSelectedEmoji(null);
                setShowEmojiPicker(false);
            }
        };

        if (showEmojiPicker) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showEmojiPicker]);

    const pickerContent = showEmojiPicker && (
        <div
            ref={emojiPickerRef}
            className={
                useFixedPosition
                    ? "fixed z-[99999] bg-white shadow-lg rounded"
                    : "absolute z-[10030] bg-white shadow-lg rounded"
            }
            style={{
                top: pickerTopPosition,
                bottom:
                    pickerBottomPosition !== undefined && pickerTopPosition === "auto"
                        ? pickerBottomPosition
                        : "auto",
                right: pickerRightPosition,
                left: pickerLeftPosition,
                position: useFixedPosition ? "fixed" : "absolute",
                zIndex: useFixedPosition ? 99999 : 10030,
                boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.2)",
            }}
        >
            <Suspense fallback={null}>
                <EmojiPickerInner
                    theme={mode === "dark" ? "dark" : "light"}
                    onEmojiSelect={handleEmojiSelect}
                />
            </Suspense>
        </div>
    );

    if (useFixedPosition && showEmojiPicker) {
        // Use portal to render at document body level when using fixed positioning
        return <>{createPortal(pickerContent, document.body)}</>;
    }

    return <div className="relative">{pickerContent}</div>;
};
