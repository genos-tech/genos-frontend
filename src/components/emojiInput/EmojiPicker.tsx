import { useEffect, useRef } from "react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { useColorScheme } from "@mui/joy/styles";
import { createPortal } from "react-dom";

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
            <Picker
                data={data}
                theme={mode === "dark" ? "dark" : "light"}
                onEmojiSelect={handleEmojiSelect}
            />
        </div>
    );

    if (useFixedPosition && showEmojiPicker) {
        // Use portal to render at document body level when using fixed positioning
        return <>{createPortal(pickerContent, document.body)}</>;
    }

    return <div className="relative">{pickerContent}</div>;
};
