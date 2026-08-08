import { candidatesStore, settingsStore } from "../store.js";
import { VOLUNTEER_STAGES, STAGE_LABELS, stageBadgeHtml, statusBadgeFor, formatTime, escapeHtml } from "../lib.js";

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

  function draw() {
    const { candidates, loading } = candidatesStore.get();
    const { settings } = settingsStore.get();

    if (loading) {
      body.innerHTML = '<p class="muted small">Loading…</p>';
      return;
    }

    const cols = VOLUNTEER_STAGES.map((stage) => {
      const queue = candidates.filter((c) => c.stage === stage);
      const items = queue.length
        ? `<ul class="queue-list">${queue
            .map(
              (c) => `
              <li class="queue-item" style="cursor:default;">
                <p class="queue-item-name">${escapeHtml(c.full_name)}</p>
                <p class="queue-item-meta">${escapeHtml(c.candidate_code)} · ${formatTime(c.registered_at)}</p>
                <div style="margin-top:.25rem;">${statusBadgeFor(c, settings)}</div>
              </li>`
            )
            .join("")}</ul>`
        : '<p class="muted small">Empty</p>';

      return `
        <div class="card">
          <div class="row-between" style="margin-bottom:.75rem;">
            ${stageBadgeHtml(stage)}
            <span class="small" style="font-weight:600; color:var(--gray-400);">${queue.length}</span>
          </div>
          ${items}
        </div>`;
    }).join("");

    body.innerHTML = `
      <div class="volunteer-grid">${cols}</div>
      <p class="muted small center" style="margin-top:1.5rem;">
        Stages: ${VOLUNTEER_STAGES.map((s) => STAGE_LABELS[s]).join(" → ")} → Completed
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
