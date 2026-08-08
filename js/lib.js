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

export function stageBadgeHtml(stage) {
  return `<span class="badge-stage ${STAGE_COLOR_CLASS[stage] || ""}">${STAGE_LABELS[stage] || stage}</span>`;
}

export function alertBadgeHtml(kind, label) {
  return `<span class="badge-alert badge-${kind}">${escapeHtml(label)}</span>`;
}

// Mirrors statusBadgeFor() from src/pages/Dashboard.tsx
export function statusBadgeFor(c, thresholds) {
  if (c.stage === "completed") return alertBadgeHtml("completed", "Completed");
  if (c.stage === "reception" && (!c.resume_received || !c.registration_complete)) {
    return alertBadgeHtml("incomplete", "Incomplete fields");
  }
  if (c.stage === "hr_screening" && !c.hr_started_at && thresholds) {
    const waited = minutesSince(c.registered_at) ?? 0;
    if (waited > thresholds.hr_wait_threshold_minutes) return alertBadgeHtml("waiting", `Waiting ${waited}m`);
  }
  if (["cabin_1", "cabin_2", "cabin_3", "cabin_4"].includes(c.stage) && c.cabin_started_at && thresholds) {
    const elapsed = minutesSince(c.cabin_started_at) ?? 0;
    if (elapsed > thresholds.interview_duration_threshold_minutes)
      return alertBadgeHtml("interview", `In cabin ${elapsed}m`);
  }
  return alertBadgeHtml("ok", "On track");
}

// ---- Export helpers (mirrors src/lib/export.ts, uses global XLSX from CDN) ----

function toRow(c) {
  return {
    "Candidate Code": c.candidate_code,
    "Full Name": c.full_name,
    Phone: c.phone,
    Email: c.email ?? "",
    "Position Applied": c.position_applied,
    "Experience (yrs)": c.experience_years,
    Stage: STAGE_LABELS[c.stage] || c.stage,
    "Resume Received": c.resume_received ? "Yes" : "No",
    "Registration Complete": c.registration_complete ? "Yes" : "No",
    "HR Feedback": c.hr_feedback ?? "",
    "HR Interviewer": c.hr_interviewer ?? "",
    "HR Started": c.hr_started_at ?? "",
    "HR Completed": c.hr_completed_at ?? "",
    "Cabin Number": c.cabin_number ?? "",
    "Cabin Started": c.cabin_started_at ?? "",
    "Cabin Completed": c.cabin_completed_at ?? "",
    "Interview Rating": c.interview_rating ?? "",
    "Interview Recommendation": c.interview_recommendation ?? "",
    "Interview Comments": c.interview_comments ?? "",
    "LOI Issued": c.loi_issued ? "Yes" : "No",
    "Aadhaar Received": c.aadhaar_received ? "Yes" : "No",
    "Exit Time": c.exit_time ?? "",
    "Rejected At Stage": c.rejected_at_stage ? (STAGE_LABELS[c.rejected_at_stage] || c.rejected_at_stage) : "",
    "Rejection Reason": c.rejection_reason ?? "",
    "Registered At": c.registered_at,
    "Completed At": c.completed_at ?? "",
  };
}

function filename(ext) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `candidates-export-${ts}.${ext}`;
}

export function exportToXlsx(candidates) {
  const rows = candidates.map(toRow);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Candidates");
  XLSX.writeFile(wb, filename("xlsx"));
}

export function exportToCsv(candidates) {
  const rows = candidates.map(toRow);
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename("csv");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
