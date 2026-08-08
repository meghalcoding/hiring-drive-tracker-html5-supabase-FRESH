import { candidatesStore, settingsStore } from "../store.js";
import {
  VOLUNTEER_STAGES,
  stageBadgeHtml,
  statusBadgeFor,
  formatTime,
  escapeHtml,
  isHoldDecision,
  isHrScreeningActive,
  isCabinInterviewActive,
  volunteerNameFor,
  volunteerNameForSlot,
} from "../lib.js";

export function renderVolunteer(root) {
  root.innerHTML = `
    <div class="app-shell">
      <header class="header">
        <div class="header-inner" style="display:block;">
          <h1 class="header-title">Live Hiring Queue</h1>
          <p class="small" style="color:rgba(255,255,255,.7); margin:.15rem 0 0;">
            Read-only view — no login required. Updates automatically.
          </p>
        </div>
      </header>
      <main class="main" id="volunteer-body"></main>
    </div>
  `;

  const body = document.getElementById("volunteer-body");

  function deskCard(stage, queue, settings) {
    const label = stage === "loi" ? "LOI Stage" : undefined;

    const items = queue.length
      ? `<ul class="queue-list">${queue
          .map(
            (c) => `
              <li class="queue-item ${isHoldDecision(c) ? "hold-flag" : ""} ${isHrScreeningActive(c) ? "hr-active-flag" : ""} ${isCabinInterviewActive(c) ? "cabin-active-flag" : ""}" style="cursor:default;">
                <p class="queue-item-name">${escapeHtml(c.full_name)}</p>
                <p class="queue-item-meta">${escapeHtml(c.candidate_code)} · ${formatTime(c.registered_at)}</p>
                <div style="margin-top:.25rem;">${statusBadgeFor(c, settings)}</div>
              </li>`
          )
          .join("")}</ul>`
      : '<p class="muted small">Empty</p>';

    return `
      <div class="card">
        <div class="row-between" style="margin-bottom:.25rem;">
          ${stageBadgeHtml(stage, label)}
          <span class="small" style="font-weight:600; color:var(--gray-400);">${queue.length}</span>
        </div>
        <p class="small" style="font-weight:600; color:var(--gray-500); margin:0 0 .75rem;">${escapeHtml(volunteerNameFor(stage, settings))}</p>
        ${items}
      </div>`;
  }

  function outcomeCard(title, colorClass, list, timeField, extraFn) {
    const items = list.length
      ? `<ul class="queue-list">${list
          .map(
            (c) => `
              <li class="queue-item" style="cursor:default;">
                <p class="queue-item-name">${escapeHtml(c.full_name)}</p>
                <p class="queue-item-meta">${escapeHtml(c.candidate_code)} · ${formatTime(c[timeField])}</p>
                ${extraFn ? `<p class="queue-item-meta">${escapeHtml(extraFn(c))}</p>` : ""}
              </li>`
          )
          .join("")}</ul>`
      : '<p class="muted small">Empty</p>';

    return `
      <div class="card">
        <div class="row-between" style="margin-bottom:.75rem;">
          <span class="badge-stage ${colorClass}">${title}</span>
          <span class="small" style="font-weight:600; color:var(--gray-400);">${list.length}</span>
        </div>
        ${items}
      </div>`;
  }

  function infoCard(title, name, note) {
    return `
      <div class="card">
        <div class="row-between" style="margin-bottom:.75rem;">
          <span class="badge-stage" style="background:var(--gray-500);">${escapeHtml(title)}</span>
        </div>
        <p class="small" style="font-weight:600; color:var(--gray-700); margin:0;">${escapeHtml(name)}</p>
        <p class="muted small" style="margin-top:.25rem;">${escapeHtml(note)}</p>
      </div>`;
  }

  function draw() {
    const { candidates, loading } = candidatesStore.get();
    const { settings } = settingsStore.get();

    if (loading) {
      body.innerHTML = '<p class="muted small">Loading…</p>';
      return;
    }

    const deskCols = VOLUNTEER_STAGES.map((stage) =>
      deskCard(
        stage,
        candidates.filter((c) => c.stage === stage),
        settings
      )
    ).join("");

    const completed = candidates.filter((c) => c.stage === "completed");
    const rejected = candidates.filter((c) => c.stage === "rejected");

    const outcomeCols =
      outcomeCard(
        "Offer Received",
        "bg-completed",
        completed,
        "completed_at",
        (c) => `Offer completed · ${c.position_applied}`
      ) +
      outcomeCard(
        "Rejected / Declined",
        "bg-rejected",
        rejected,
        "updated_at",
        (c) =>
          c.rejection_reason
            ? `Reason: ${c.rejection_reason}`
            : "No reason logged"
      );

    const infoCols =
      infoCard("WA1", volunteerNameForSlot(5, settings), "Seated desk") +
      infoCard(
        "Floating",
        volunteerNameForSlot(6, settings),
        "Relieving duties on the floor"
      );

    body.innerHTML = `
      <div class="volunteer-grid">${deskCols}${outcomeCols}${infoCols}</div>
      <p class="muted small center" style="margin-top:1.5rem;">
        Stages: Reception → HR Screening → Cabin 1-4 → LOI Stage → Offer Received / Rejected
      </p>
    `;
  }

  const unsub1 = candidatesStore.subscribe(draw);
  const unsub2 = settingsStore.subscribe(draw);

  return () => {
    unsub1();
    unsub2();
  };
}