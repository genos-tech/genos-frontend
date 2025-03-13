import { useRef, useEffect } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useColorScheme } from '@mui/joy/styles';

type EmojiInputProps = {
    editorPos: any;
    showEmojiPicker: boolean;
    setShowEmojiPicker: (value: boolean) => void;
    setSelectedEmoji: (emoji: any) => void;
};

export const EmojiInput = ({
    editorPos,
    showEmojiPicker,
    setShowEmojiPicker,
    setSelectedEmoji
}: EmojiInputProps) => {
    const { mode } = useColorScheme();
    const emojiPickerRef = useRef<HTMLDivElement>(null);

    const handleEmojiSelect = (emoji: any) => {
        const emojiSymbol = emoji.native;

        // Focus back to textarea after inserting emoji
        setTimeout(() => {
            setSelectedEmoji(emojiSymbol)
            setShowEmojiPicker(false)
        }, 0);
    };

    // Close emoji picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                emojiPickerRef.current &&
                !emojiPickerRef.current.contains(event.target as Node)
            ) {
                setSelectedEmoji(null);
                setShowEmojiPicker(false);
            }
        };

        if (showEmojiPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showEmojiPicker]);

    return (
        <div className="relative">
            {showEmojiPicker && (
                <div
                    ref={emojiPickerRef}
                    className="absolute z-[9999] bg-white shadow-lg rounded"
                    style={{
                        top: editorPos.top,
                        position: 'absolute',
                        zIndex: 9999,
                        boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.2)',
                    }}
                >
                    <Picker
                        data={data}
                        onEmojiSelect={handleEmojiSelect}
                        theme={mode === 'dark' ? 'dark' : 'light'}
                    />
                </div>
            )}
        </div>
    );
};

export default EmojiInput;
