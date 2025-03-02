import { useState } from "react";
import "./Md.css";
import { MarkdownEditor } from "../components/markdownEditor/MarkdownEditor";
import pullRequestMarkdown from "../components/markdownEditor/data";

function MDEditor() {
    const [content, setContent] = useState(pullRequestMarkdown);

    return (
        <div className="md-content">
            <MarkdownEditor content={content} setContent={setContent} />
        </div>
    );
}

export default MDEditor;
