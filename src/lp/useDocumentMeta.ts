import { useEffect } from "react";

interface DocumentMeta {
    title: string;
    description: string;
    ogTitle: string;
    ogDescription: string;
}

function upsertMetaTag(attr: "name" | "property", key: string, content: string) {
    let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
    if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute(attr, key);
        document.head.appendChild(tag);
    }
    tag.setAttribute("content", content);
}

export function useDocumentMeta(meta: DocumentMeta) {
    useEffect(() => {
        const previousTitle = document.title;
        document.title = meta.title;
        upsertMetaTag("name", "description", meta.description);
        upsertMetaTag("property", "og:title", meta.ogTitle);
        upsertMetaTag("property", "og:description", meta.ogDescription);

        return () => {
            document.title = previousTitle;
        };
    }, [meta.title, meta.description, meta.ogTitle, meta.ogDescription]);
}
