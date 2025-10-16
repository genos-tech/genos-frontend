export const ResizeHandleStyles = () => (
    <style>
        {`
            .resize-handle {
                transition: all 0.3s ease-in-out;
            }
            .resize-handle:hover {
                background-color: lightgray !important;
                width: 8px !important;
            }
        `}
    </style>
);
