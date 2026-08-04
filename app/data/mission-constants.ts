export const MISSION_STATUSES = ["Hide", "Active"] as const;

export type MissionStatus = typeof MISSION_STATUSES[number];

export const DEFAULT_MISSION_STATUS: MissionStatus = "Active";

export const VALID_MISSION_STATUSES: readonly MissionStatus[] = MISSION_STATUSES;
