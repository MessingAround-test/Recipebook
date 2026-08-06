/**
 * Version marker for the weekly planner data shape.
 * New plans are always stamped with this version.
 *
 * This number should rarely change. Bumping it intentionally discards all
 * existing plan data (old-version plans are returned empty / reset) — a
 * deliberate "nuke old data" switch.
 */
export const CURRENT_PLAN_VERSION = 3;
