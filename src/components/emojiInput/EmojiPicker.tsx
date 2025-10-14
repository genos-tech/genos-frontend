import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { useColorScheme } from "@mui/joy/styles";
import { useEffect, useRef } from "react";

type EmojiPickerProps = {
    editorPos?: any;
    showEmojiPicker: boolean;
    setShowEmojiPicker: (value: boolean) => void;
    setSelectedEmoji: (emoji: any) => void;
    pickerBottomPosition?: number;
    pickerRightPosition?: number | string;
};
export const EmojiPicker = ({
    showEmojiPicker,
    setShowEmojiPicker,
    setSelectedEmoji,
    pickerBottomPosition = 210,
    pickerRightPosition = "auto",
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

    return (
        <div className="relative">
            {showEmojiPicker && (
                <div
                    ref={emojiPickerRef}
                    className="absolute z-[9999] bg-white shadow-lg rounded"
                    style={{
                        bottom: pickerBottomPosition,
                        right: pickerRightPosition,
                        position: "absolute",
                        zIndex: 9999,
                        boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.2)",
                    }}
                >
                    <Picker
                        data={data}
                        theme={mode === "dark" ? "dark" : "light"}
                        onEmojiSelect={handleEmojiSelect}
                    />
                </div>
            )}
        </div>
    );
};
