export const MISSION_STATUSES = [
	"Missing instructions",
	"Includes empty instructions",
	"Full instruction - no rewording",
	"Updated rewording",
	"Not updated rewording",
] as const;

export type MissionStatus = typeof MISSION_STATUSES[number];

export const DEFAULT_MISSION_STATUS: MissionStatus = "Missing instructions";

export const VALID_MISSION_STATUSES: readonly MissionStatus[] = MISSION_STATUSES;

export function normalizeMissionStatus(status?: string): MissionStatus {
	return MISSION_STATUSES.includes(status as MissionStatus)
		? (status as MissionStatus)
		: DEFAULT_MISSION_STATUS;
}
