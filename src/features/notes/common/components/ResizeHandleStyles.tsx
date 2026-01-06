export const ResizeHandleStyles = () => (
    <style>
        {`
            .note-resize-handle {
                transition: all 0.3s ease-in-out;
            }
            .note-resize-handle:hover {
                background-color: grey !important;
                width: 8px !important;
            }
        `}
    </style>
);
