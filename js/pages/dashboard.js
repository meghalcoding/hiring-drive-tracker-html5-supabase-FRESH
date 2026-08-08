import { candidatesStore, settingsStore } from "../store.js";
import {
  FUNNEL_STAGES, STAGE_LABELS, stageBadgeHtml, statusBadgeFor, formatMinutes, formatTime,
  avgMinutes, escapeHtml,
} from "../lib.js";

const TOUCHPOINT_STAGES = FUNNEL_STAGES.filter((s) => s !== "reception" && s !== "completed");
const PIE_COLORS = { Selected: "#16a34a", Rejected: "#6b7280", "In Progress": "#2563eb" };

export function renderDashboard(root) {
  root.innerHTML = `
    <div class="stack">
      <div class="row-between">
        <h1 class="page-title">Live Dashboard</h1>
        <input type="text" id="dash-search" class="input" style="width:20rem;" placeholder="Search by ID, name, phone, position…" />
      </div>
      <div id="dash-body"></div>
    </div>
  `;

  const body = document.getElementById("dash-body");
  const searchInput = document.getElementById("dash-search");
  let query = "";
  let funnelChart = null;
  let outcomeChart = null;
  let hourlyChart = null;

  function computeKpis(candidates) {
    const registered = candidates.length;
    const waitingHr = candidates.filter((c) => c.stage === "hr_screening" && !c.hr_started_at).length;
    const hrInProgress = candidates.filter((c) => c.stage === "hr_screening" && c.hr_started_at && !c.hr_completed_at).length;
    const cabinStages = ["cabin_1", "cabin_2", "cabin_3", "cabin_4"];
    const waitingInterview = candidates.filter((c) => cabinStages.includes(c.stage) && !c.cabin_started_at).length;
    const interviewInProgress = candidates.filter(
      (c) => cabinStages.includes(c.stage) && c.cabin_started_at && !c.cabin_completed_at
    ).length;
    const loi = candidates.filter((c) => c.stage === "loi").length;
    const rejected = candidates.filter((c) => c.stage === "rejected").length;
    const completed = candidates.filter((c) => c.stage === "completed").length;

    const avgHrTime = avgMinutes(candidates.map((c) => [c.hr_started_at, c.hr_completed_at]));
    const avgInterviewTime = avgMinutes(candidates.map((c) => [c.cabin_started_at, c.cabin_completed_at]));
    const avgTotalTime = avgMinutes(candidates.map((c) => [c.registered_at, c.completed_at]));

    const activeCabins = new Set(
      candidates
        .filter((c) => cabinStages.includes(c.stage) && c.cabin_started_at && !c.cabin_completed_at)
        .map((c) => c.cabin_number)
    ).size;
    const cabinUtilizationPct = Math.round((activeCabins / 4) * 100);

    return {
      registered, waitingHr, hrInProgress, waitingInterview, interviewInProgress,
      loi, rejected, completed, avgHrTime, avgInterviewTime, avgTotalTime, cabinUtilizationPct,
    };
  }

  function kpiCard(label, value, sub) {
    return `
      <div class="kpi-card">
        <p class="kpi-label">${label}</p>
        <p class="kpi-value">${value}</p>
        ${sub ? `<p class="kpi-sub">${sub}</p>` : ""}
      </div>`;
  }

  function draw() {
    const { candidates, loading } = candidatesStore.get();
    const { settings } = settingsStore.get();

    if (loading) {
      body.innerHTML = '<p class="muted small">Loading…</p>';
      return;
    }

    const filtered = query.trim()
      ? candidates.filter((c) => {
          const q = query.toLowerCase();
          return (
            c.candidate_code.toLowerCase().includes(q) ||
            c.full_name.toLowerCase().includes(q) ||
            c.phone.includes(q) ||
            c.position_applied.toLowerCase().includes(q)
          );
        })
      : candidates;

    const kpis = computeKpis(candidates);

    const funnelData = FUNNEL_STAGES.map((stage) => ({
      stage: STAGE_LABELS[stage],
      count: candidates.filter((c) => c.stage === stage).length,
    }));

    const outcomeData = [
      { name: "Selected", value: candidates.filter((c) => c.stage === "completed").length },
      { name: "Rejected", value: candidates.filter((c) => c.stage === "rejected").length },
      { name: "In Progress", value: candidates.filter((c) => c.stage !== "completed" && c.stage !== "rejected").length },
    ];

    const bucketMap = new Map();
    candidates.forEach((c) => {
      const d = new Date(c.registered_at);
      const key = `${d.getHours().toString().padStart(2, "0")}:00`;
      bucketMap.set(key, (bucketMap.get(key) ?? 0) + 1);
    });
    const hourlyData = Array.from(bucketMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, count]) => ({ hour, count }));

    const currentPerTouchpoint = TOUCHPOINT_STAGES.map((stage) => ({
      stage,
      candidate: candidates.find((c) => c.stage === stage) ?? null,
    }));

    body.innerHTML = `
      <div class="stack">
        <div class="kpi-grid">
          ${kpiCard("Registered", kpis.registered)}
          ${kpiCard("Waiting HR", kpis.waitingHr)}
          ${kpiCard("HR In Progress", kpis.hrInProgress)}
          ${kpiCard("Waiting Interview", kpis.waitingInterview)}
          ${kpiCard("Interview In Progress", kpis.interviewInProgress)}
          ${kpiCard("Offered / LOI", kpis.loi)}
          ${kpiCard("Rejected", kpis.rejected)}
          ${kpiCard("Completed", kpis.completed)}
          ${kpiCard("Avg HR Time", formatMinutes(kpis.avgHrTime))}
          ${kpiCard("Avg Interview Time", formatMinutes(kpis.avgInterviewTime))}
          ${kpiCard("Avg Total Time", formatMinutes(kpis.avgTotalTime))}
          ${kpiCard("Cabin Utilization", `${kpis.cabinUtilizationPct}%`, "of 4 cabins active")}
        </div>

        <div class="card">
          <h2 class="section-title">Current Candidate per Touchpoint</h2>
          <div class="touchpoint-grid">
            ${currentPerTouchpoint
              .map(
                ({ stage, candidate }) => `
                <div class="touchpoint-cell">
                  ${stageBadgeHtml(stage)}
                  ${
                    candidate
                      ? `<div style="margin-top:.5rem;">
                          <p class="small" style="font-weight:500; color:var(--gray-800); margin:0;">${escapeHtml(candidate.full_name)}</p>
                          <p class="small muted" style="margin:0;">${escapeHtml(candidate.candidate_code)}</p>
                        </div>`
                      : '<p class="small muted" style="margin-top:.5rem;">Empty</p>'
                  }
                </div>`
              )
              .join("")}
          </div>
        </div>

        <div class="charts-grid">
          <div class="card chart-col-2">
            <h2 class="section-title">Pipeline Funnel</h2>
            <div class="chart-wrap"><canvas id="funnel-chart"></canvas></div>
          </div>
          <div class="card">
            <h2 class="section-title">Outcome Split</h2>
            <div class="chart-wrap"><canvas id="outcome-chart"></canvas></div>
          </div>
          <div class="card chart-col-3">
            <h2 class="section-title">Hourly Registrations</h2>
            <div class="chart-wrap-sm"><canvas id="hourly-chart"></canvas></div>
          </div>
        </div>

        ${
          query.trim()
            ? `<div class="card">
                <h2 class="section-title">Search results (${filtered.length})</h2>
                <div class="table-wrap">
                  <table>
                    <thead><tr>
                      <th>Code</th><th>Name</th><th>Phone</th><th>Position</th><th>Stage</th><th>Status</th><th>Registered</th>
                    </tr></thead>
                    <tbody>
                      ${filtered
                        .map(
                          (c) => `
                          <tr>
                            <td style="font-family:monospace;">${escapeHtml(c.candidate_code)}</td>
                            <td style="font-weight:500;">${escapeHtml(c.full_name)}</td>
                            <td>${escapeHtml(c.phone)}</td>
                            <td>${escapeHtml(c.position_applied)}</td>
                            <td>${stageBadgeHtml(c.stage)}</td>
                            <td>${statusBadgeFor(c, settings)}</td>
                            <td>${formatTime(c.registered_at)}</td>
                          </tr>`
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>
              </div>`
            : ""
        }
      </div>
    `;

    if (funnelChart) funnelChart.destroy();
    if (outcomeChart) outcomeChart.destroy();
    if (hourlyChart) hourlyChart.destroy();

    funnelChart = new Chart(document.getElementById("funnel-chart"), {
      type: "bar",
      data: {
        labels: funnelData.map((d) => d.stage),
        datasets: [{ label: "Candidates", data: funnelData.map((d) => d.count), backgroundColor: "#1e3a8a", borderRadius: 4 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { font: { size: 11 } } }, y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });

    outcomeChart = new Chart(document.getElementById("outcome-chart"), {
      type: "pie",
      data: {
        labels: outcomeData.map((d) => d.name),
        datasets: [{ data: outcomeData.map((d) => d.value), backgroundColor: outcomeData.map((d) => PIE_COLORS[d.name]) }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
    });

    hourlyChart = new Chart(document.getElementById("hourly-chart"), {
      type: "bar",
      data: {
        labels: hourlyData.map((d) => d.hour),
        datasets: [{ label: "Registrations", data: hourlyData.map((d) => d.count), backgroundColor: "#2563eb", borderRadius: 4 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }

  function onSearchInput(e) {
    query = e.target.value;
    draw();
  }
  searchInput.addEventListener("input", onSearchInput);

  const unsub1 = candidatesStore.subscribe(draw);
  const unsub2 = settingsStore.subscribe(draw);

  return () => {
    searchInput.removeEventListener("input", onSearchInput);
    unsub1();
    unsub2();
    if (funnelChart) funnelChart.destroy();
    if (outcomeChart) outcomeChart.destroy();
    if (hourlyChart) hourlyChart.destroy();
  };
}
