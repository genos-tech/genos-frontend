import { Box } from "@mui/joy";
import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";



export function App() {

    const editor = useCreateBlockNote({
        initialContent: [
            {
                type: "paragraph",
                content: "Welcome to this demo!",
            },
            {
                type: "paragraph",
                content: [
                    {
                        type: "text",
                        text: "You can now toggle ",
                        styles: {},
                    },
                    {
                        type: "text",
                        text: "blue",
                        styles: { textColor: "blue", backgroundColor: "blue" },
                    },
                    {
                        type: "text",
                        text: " and ",
                        styles: {},
                    },
                    {
                        type: "text",
                        text: "code",
                        styles: { code: true },
                    },
                    {
                        type: "text",
                        text: " styles with new buttons in the Formatting Toolbar",
                        styles: {},
                    },
                ],
            },
            {
                type: "paragraph",
                content: "Select some text to try them out",
            },
            {
                type: "paragraph",
            },
            {
                type: "paragraph",
                content: "Welcome to this demo!",
            },
        ],
    });

    return (
        <Box className="bn-preview-box">
            <BlockNoteView
                className="blocknote-editor"
                editor={editor}
                formattingToolbar={false}
                linkToolbar={false}
                filePanel={false}
                sideMenu={false}
                slashMenu={false}
                tableHandles={false}
            >
            </BlockNoteView>
        </Box>

    );
}

export default App;


