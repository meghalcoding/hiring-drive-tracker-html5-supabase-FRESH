import { supabase } from "../supabaseClient.js";
import { candidatesStore, settingsStore } from "../store.js";
import { stageBadgeHtml, formatDateTime, exportToCsv, exportToXlsx, escapeHtml, ROLE_LABELS } from "../lib.js";

export function renderAdmin(root) {
  root.innerHTML = `
    <div class="stack">
      <h1 class="page-title">Admin</h1>
      <div id="admin-table-slot"></div>
      <div id="admin-export-slot"></div>
      <div id="admin-settings-slot"></div>
      <div id="admin-roster-slot"></div>
      <div id="admin-reset-slot"></div>
    </div>
  `;

  const tableSlot = document.getElementById("admin-table-slot");
  const exportSlot = document.getElementById("admin-export-slot");
  const settingsSlot = document.getElementById("admin-settings-slot");
  const rosterSlot = document.getElementById("admin-roster-slot");
  const resetSlot = document.getElementById("admin-reset-slot");

  let tableQuery = "";

  function drawTable() {
    const { candidates } = candidatesStore.get();
    const q = tableQuery.trim().toLowerCase();
    const rows = (q
      ? candidates.filter(
          (c) =>
            c.full_name.toLowerCase().includes(q) ||
            c.candidate_code.toLowerCase().includes(q) ||
            c.phone.includes(q) ||
            c.position_applied.toLowerCase().includes(q)
        )
      : candidates
    ).slice().sort((a, b) => new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime());

    tableSlot.innerHTML = `
      <section class="card">
        <div class="row-between">
          <h2 class="section-title">Live Candidate Table <span class="muted" style="font-weight:400;">(${rows.length})</span></h2>
          <input id="admin-search" class="input" style="width:16rem;" placeholder="Search name, code, phone, position…" value="${escapeHtml(tableQuery)}" />
        </div>
        <p class="small muted" style="margin-top:.25rem;">Updates live as staff move candidates through stages. Use this to check the data before exporting.</p>
        <div class="table-wrap" style="margin-top:.75rem; max-height:32rem; overflow:auto; border:1px solid var(--gray-100); border-radius:.375rem;">
          <table>
            <thead><tr>
              <th>Code</th><th>Name</th><th>Phone</th><th>Position</th><th>Exp (yrs)</th><th>Stage</th>
              <th>HR Feedback</th><th>Rating</th><th>Interview Comments</th><th>LOI</th><th>Aadhaar</th><th>Registered</th>
            </tr></thead>
            <tbody>
              ${
                rows.length === 0
                  ? `<tr><td colspan="12" style="text-align:center; padding:1.5rem; color:var(--gray-400);">No candidates match your search.</td></tr>`
                  : rows
                      .map(
                        (c) => `
                        <tr>
                          <td style="font-family:monospace; color:var(--gray-500);">${escapeHtml(c.candidate_code)}</td>
                          <td style="font-weight:500;">${escapeHtml(c.full_name)}</td>
                          <td>${escapeHtml(c.phone)}</td>
                          <td>${escapeHtml(c.position_applied)}</td>
                          <td>${c.experience_years}</td>
                          <td>${stageBadgeHtml(c.stage)}</td>
                          <td class="truncate-cell" title="${escapeHtml(c.hr_feedback ?? "")}">${escapeHtml(c.hr_feedback ?? "—")}</td>
                          <td>${c.interview_rating ? `${c.interview_rating}/5` : "—"}</td>
                          <td class="truncate-cell" title="${escapeHtml(c.interview_comments ?? "")}">${escapeHtml(c.interview_comments ?? "—")}</td>
                          <td>${c.loi_issued ? "Yes" : "No"}</td>
                          <td>${c.aadhaar_received ? "Yes" : "No"}</td>
                          <td style="color:var(--gray-500);">${formatDateTime(c.registered_at)}</td>
                        </tr>`
                      )
                      .join("")
              }
            </tbody>
          </table>
        </div>
        <p class="small muted" style="margin-top:.5rem; font-size:.7rem;">
          Showing the fields most useful for a quick check. Use the export buttons below for the complete record with every field.
        </p>
      </section>`;

    document.getElementById("admin-search").addEventListener("input", (e) => {
      tableQuery = e.target.value;
      drawTable();
      document.getElementById("admin-search").focus();
      const val = document.getElementById("admin-search").value;
      document.getElementById("admin-search").setSelectionRange(val.length, val.length);
    });
  }

  function drawExport() {
    const { candidates } = candidatesStore.get();
    exportSlot.innerHTML = `
      <section class="card">
        <h2 class="section-title">Export Candidates</h2>
        <p class="small muted">${candidates.length} candidates currently in the system. Generated in your browser — no server involved.</p>
        <div style="margin-top:.75rem; display:flex; gap:.5rem;">
          <button id="export-xlsx" class="btn btn-primary">Download .xlsx</button>
          <button id="export-csv" class="btn btn-outline">Download .csv</button>
        </div>
      </section>`;
    document.getElementById("export-xlsx").addEventListener("click", () => exportToXlsx(candidatesStore.get().candidates));
    document.getElementById("export-csv").addEventListener("click", () => exportToCsv(candidatesStore.get().candidates));
  }

  function drawSettings() {
    const { settings } = settingsStore.get();
    const hrWait = settings ? settings.hr_wait_threshold_minutes : 15;
    const interviewDuration = settings ? settings.interview_duration_threshold_minutes : 20;

    settingsSlot.innerHTML = `
      <section class="card">
        <h2 class="section-title">Alert Thresholds</h2>
        <div style="display:grid; grid-template-columns:1fr; gap:1rem; margin-top:.5rem;" id="thresh-grid">
          <div><label class="field-label">HR wait threshold (minutes)</label><input type="number" min="1" class="input" id="thresh-hr" value="${hrWait}" /></div>
          <div><label class="field-label">Interview duration threshold (minutes)</label><input type="number" min="1" class="input" id="thresh-int" value="${interviewDuration}" /></div>
        </div>
        <style>@media (min-width:640px){#thresh-grid{grid-template-columns:1fr 1fr;}}</style>
        <button id="thresh-save" class="btn btn-primary" style="margin-top:.75rem;">Save Thresholds</button>
        <span id="thresh-saved" class="small hidden" style="margin-left:.75rem; color:#16a34a;">Saved.</span>
      </section>`;

    document.getElementById("thresh-save").addEventListener("click", async () => {
      const btn = document.getElementById("thresh-save");
      const savedEl = document.getElementById("thresh-saved");
      savedEl.classList.add("hidden");
      btn.disabled = true;
      btn.textContent = "Saving…";
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("settings")
        .update({
          hr_wait_threshold_minutes: Number(document.getElementById("thresh-hr").value),
          interview_duration_threshold_minutes: Number(document.getElementById("thresh-int").value),
          updated_by: userData.user?.id,
        })
        .eq("id", 1);
      btn.disabled = false;
      btn.textContent = "Save Thresholds";
      if (!error) savedEl.classList.remove("hidden");
    });
  }

  async function drawRoster() {
    rosterSlot.innerHTML = `
      <section class="card">
        <h2 class="section-title">Staff Roster</h2>
        <p class="small muted">
          New sign-ups default to "Reception". Assign the correct role for each staff member below. To add a brand-new
          staff login, create the user in Supabase Auth first (see README) — they'll appear here automatically.
        </p>
        <div class="table-wrap" style="margin-top:.75rem;">
          <table>
            <thead><tr><th>Email</th><th>Role</th></tr></thead>
            <tbody id="roster-body"><tr><td colspan="2" class="muted">Loading…</td></tr></tbody>
          </table>
        </div>
      </section>`;

    const { data } = await supabase.from("profiles").select("*").order("email");
    const profiles = data || [];
    const body = document.getElementById("roster-body");
    body.innerHTML = profiles
      .map(
        (p) => `
        <tr>
          <td>${escapeHtml(p.email)}</td>
          <td>
            <select class="input" style="width:auto; padding:.25rem .5rem;" data-id="${p.id}">
              ${Object.entries(ROLE_LABELS)
                .map(([value, label]) => `<option value="${value}" ${p.role === value ? "selected" : ""}>${label}</option>`)
                .join("")}
            </select>
          </td>
        </tr>`
      )
      .join("");

    body.querySelectorAll("select").forEach((sel) => {
      sel.addEventListener("change", async (e) => {
        await supabase.from("profiles").update({ role: e.target.value }).eq("id", sel.getAttribute("data-id"));
      });
    });
  }

  function drawReset() {
    let confirming = false;
    let resetting = false;
    let done = false;

    function paint() {
      const { candidates } = candidatesStore.get();
      resetSlot.innerHTML = `
        <section class="red-section">
          <h2 class="red-title">Reset for Next Event</h2>
          <p class="red-text">
            Downloads a full .xlsx export, then permanently deletes all candidates and activity log entries. This cannot be undone.
          </p>
          ${
            !confirming
              ? `<button id="reset-open" class="btn btn-danger" style="margin-top:.75rem;">Reset Event Data…</button>`
              : `<div class="stack-sm" style="margin-top:.75rem;">
                  <p class="small" style="color:#991b1b;">Type <strong>RESET</strong> to confirm you want to export and permanently clear all data.</p>
                  <input id="reset-confirm-text" class="input" style="border-color:#fca5a5;" />
                  <div style="display:flex; gap:.5rem;">
                    <button id="reset-confirm-btn" class="btn btn-danger" ${resetting ? "disabled" : ""}>${resetting ? "Resetting…" : "Confirm Export & Reset"}</button>
                    <button id="reset-cancel-btn" class="btn btn-secondary">Cancel</button>
                  </div>
                </div>`
          }
          ${done ? `<p class="small" style="margin-top:.75rem; font-weight:500; color:#15803d;">Reset complete. Export was downloaded first.</p>` : ""}
        </section>`;

      if (!confirming) {
        document.getElementById("reset-open").addEventListener("click", () => {
          confirming = true;
          paint();
        });
      } else {
        document.getElementById("reset-cancel-btn").addEventListener("click", () => {
          confirming = false;
          paint();
        });
        const confirmBtn = document.getElementById("reset-confirm-btn");
        const confirmInput = document.getElementById("reset-confirm-text");
        confirmBtn.disabled = confirmInput.value !== "RESET" || resetting;
        confirmInput.addEventListener("input", () => {
          confirmBtn.disabled = confirmInput.value !== "RESET" || resetting;
        });
        confirmBtn.addEventListener("click", async () => {
          resetting = true;
          paint();
          exportToXlsx(candidates);
          const { error } = await supabase.rpc("reset_event_data");
          resetting = false;
          if (!error) {
            done = true;
            confirming = false;
          }
          paint();
        });
      }
    }

    paint();
  }

  drawTable();
  drawExport();
  drawSettings();
  drawRoster();
  drawReset();

  const unsub1 = candidatesStore.subscribe(() => {
    drawTable();
    drawExport();
  });
  const unsub2 = settingsStore.subscribe(drawSettings);

  return () => {
    unsub1();
    unsub2();
  };
}
