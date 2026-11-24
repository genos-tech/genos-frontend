import type { ManualTopic } from "../../manual/manualSource";
import { DOCS_GROUPS, type DocsGroupId } from "../copy/docs";

export type TopicGroup = { id: DocsGroupId | "more"; topics: ManualTopic[] };

/** The topics in hub order: the groups of `DOCS_GROUPS`, then anything not listed there. */
export const groupTopics = (topics: readonly ManualTopic[]): TopicGroup[] => {
    const byId = new Map(topics.map((t) => [t.id, t]));
    const listed = new Set<string>();
    const groups: TopicGroup[] = [];
    for (const group of DOCS_GROUPS) {
        const inGroup = group.topics.flatMap((id) => {
            const topic = byId.get(id);
            if (topic) listed.add(id);
            return topic ? [topic] : [];
        });
        if (inGroup.length) groups.push({ id: group.id, topics: inGroup });
    }
    const rest = topics.filter((t) => !listed.has(t.id));
    if (rest.length) groups.push({ id: "more", topics: rest });
    return groups;
};

/** Every topic once, in hub order: what "previous" and "next" walk through. */
export const topicOrder = (topics: readonly ManualTopic[]): ManualTopic[] =>
    groupTopics(topics).flatMap((g) => g.topics);
