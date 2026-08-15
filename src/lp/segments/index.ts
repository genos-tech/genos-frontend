import { projects } from "./projects";
import { research } from "./research";
import { students } from "./students";
import { teams } from "./teams";
import type { SegmentConfig, SegmentKey } from "./types";

export type { SegmentKey, SegmentConfig, Lang } from "./types";

export const SEGMENTS: Record<SegmentKey, SegmentConfig> = {
    research,
    teams,
    projects,
    students,
};

export const SEGMENT_ORDER: SegmentKey[] = ["research", "teams", "projects", "students"];
