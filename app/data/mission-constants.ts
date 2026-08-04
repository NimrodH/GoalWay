export const MISSION_STATUSES = ["Hide", "For all", "Only Adama", "Only Bazn"] as const;

export type MissionStatus = typeof MISSION_STATUSES[number];

export const DEFAULT_MISSION_STATUS: MissionStatus = "For all";

export const VALID_MISSION_STATUSES: readonly MissionStatus[] = MISSION_STATUSES;
