// ---- Constants (mirrors the original src/types.ts) ----

export const STAGE_LABELS = {
  reception: "Reception",
  hr_screening: "HR Screening",
  cabin_1: "Cabin 1",
  cabin_2: "Cabin 2",
  cabin_3: "Cabin 3",
  cabin_4: "Cabin 4",
  loi: "LOI / Offer",
  completed: "Completed",
  rejected: "Rejected",
};

export const STAGE_COLOR_CLASS = {
  reception: "bg-reception",
  hr_screening: "bg-hr",
  cabin_1: "bg-cabin1",
  cabin_2: "bg-cabin2",
  cabin_3: "bg-cabin3",
  cabin_4: "bg-cabin4",
  loi: "bg-loi",
  completed: "bg-completed",
  rejected: "bg-rejected",
};

export const ROLE_LABELS = {
  admin: "Admin",
  reception: "Reception",
  hr: "HR Screening",
  cabin_1: "Cabin 1",
  cabin_2: "Cabin 2",
  cabin_3: "Cabin 3",
  cabin_4: "Cabin 4 (Experienced only)",
  loi_desk: "LOI Desk",
  viewer: "Volunteer (read-only)",
};

export const ROLE_OWNED_STAGE = {
  reception: "reception",
  hr: "hr_screening",
  cabin_1: "cabin_1",
  cabin_2: "cabin_2",
  cabin_3: "cabin_3",
  cabin_4: "cabin_4",
  loi_desk: "loi",
};

export const FUNNEL_STAGES = [
  "reception", "hr_screening", "cabin_1", "cabin_2", "cabin_3", "cabin_4", "loi", "completed",
];

export const VOLUNTEER_STAGES = [
  "reception", "hr_screening", "cabin_1", "cabin_2", "cabin_3", "cabin_4", "loi",
];

// Which volunteer slot (V1-V4) mans each stage's desk. V2 covers both
// HR Screening and the LOI desk; V3 covers Cabin 1 & 2; V4 covers Cabin 3 & 4.
export const VOLUNTEER_SLOTS = {
  reception: 1,
  hr_screening: 2,
  cabin_1: 3,
  cabin_2: 3,
  cabin_3: 4,
  cabin_4: 4,
  loi: 2,
};

// Returns the assigned volunteer's name for a stage, or falls back to "V1".."V4".
export function volunteerNameFor(stage, settings) {
  const slot = VOLUNTEER_SLOTS[stage];
  if (!slot) return "";
  const name = settings ? settings[`v${slot}_name`] : null;
  return (name && String(name).trim()) || `V${slot}`;
}

// Same fallback logic for the standalone V5 (WA1) / V6 (floating) slots.
export function volunteerNameForSlot(slot, settings) {
  const name = settings ? settings[`v${slot}_name`] : null;
  return (name && String(name).trim()) || `V${slot}`;
}

// ---- Time helpers (mirrors src/lib/time.ts) ----

export function minutesSince(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  return Math.floor((Date.now() - then) / 60000);
}

export function formatMinutes(mins) {
  if (mins === null || mins === undefined) return "—";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short",
  });
}

export function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function avgMinutes(pairs) {
  const durations = pairs
    .filter(([a, b]) => a && b)
    .map(([a, b]) => (new Date(b).getTime() - new Date(a).getTime()) / 60000);
  if (durations.length === 0) return null;
  return Math.round(durations.reduce((s, v) => s + v, 0) / durations.length);
}

// ---- Small UI helpers ----

export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function stageBadgeHtml(stage, labelOverride) {
  return `<span class="badge-stage ${STAGE_COLOR_CLASS[stage] || ""}">${labelOverride || STAGE_LABELS[stage] || stage}</span>`;
}

export function alertBadgeHtml(kind, label) {
  return `<span class="badge-alert badge-${kind}">${escapeHtml(label)}</span>`;
}

// True when a Cabin manager sent this candidate to LOI with a "Hold" recommendation
// (as opposed to a straight "Select"). Used to visually flag hold decisions at LOI.
export function isHoldDecision(c) {
  return c.stage === "loi" && c.interview_recommendation === "hold";
}

// True while an HR screening or Cabin interview is actively in progress for this
// candidate (i.e. "Start Screening" / "Start Interview" was clicked and not yet
// finished or cancelled). Used to flag the candidate currently in the room.
export function isHrScreeningActive(c) {
  return c.stage === "hr_screening" && !!c.hr_started_at;
}

export function isCabinInterviewActive(c) {
  return ["cabin_1", "cabin_2", "cabin_3", "cabin_4"].includes(c.stage) && !!c.cabin_started_at;
}

// Extra CSS class to visually flag the queue-item row for a candidate currently
// in an active HR screening or Cabin interview. Returns "" otherwise.
export function activeFlagClass(c) {
  if (isHrScreeningActive(c)) return "hr-active-flag";
  if (isCabinInterviewActive(c)) return "cabin-active-flag";
  return "";
}

// Mirrors statusBadgeFor() from