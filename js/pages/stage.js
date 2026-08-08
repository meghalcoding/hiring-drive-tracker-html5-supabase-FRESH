import { supabase } from "../supabaseClient.js";
import { authStore, candidatesStore, settingsStore } from "../store.js";
import { STAGE_LABELS, stageBadgeHtml, statusBadgeFor, formatTime, formatDateTime, escapeHtml, isHoldDecision } from "../lib.js";

const HR_NAMES = ["Rushi", "Nirali"];

export function renderStage(root, stage) {
  if (!stage) return () => {};

  root.innerHTML = `
    <div class="stage-grid">
      <div>
        <div class="row-between" style="margin-bottom:1rem;">
          <h1 class="page-title" style="display:flex; align-items:center; gap:.5rem;">
            ${stageBadgeHtml(stage)} <span id="queue-count">Queue</span>
          </h1>
        </div>
        <div id="reception-form-slot"></div>
        <div class="card"><div id="queue-slot"></div></div>
      </div>
      <div>
        <div class="card sticky-panel">
          <h2 class="section-title">Actions</h2>
          <div id="actions-slot"><p class="muted small">Select a candidate from the queue to act on them.</p></div>
        </div>
      </div>
    </div>
    <div id="log-slot"></div>
  `;

  const queueCountEl = document.getElementById("queue-count");
  const receptionSlot = document.getElementById("reception-form-slot");
  const queueSlot = document.getElementById("queue-slot");
  const actionsSlot = document.getElementById("actions-slot");
  const logSlot = document.getElementById("log-slot");

  let selected = null;

  if (stage === "reception") {
    receptionSlot.innerHTML = `
      <div class="card" style="margin-bottom:1.5rem;">
        <h2 class="section-title">Register New Candidate</h2>
        <div id="reception-form-mount"></div>
      </div>`;
    mountReceptionForm(document.getElementById("reception-form-mount"));
  }

  function selectCandidate(candidate) {
    selected = candidate;
    drawQueue();
    drawActions();
  }

  function clearSelection() {
    selected = null;
    drawActions();
  }

  function drawQueue() {
    const { candidates, loading } = candidatesStore.get();
    const { settings } = settingsStore.get();
    const queue = candidates
      .filter((c) => c.stage === stage)
      .sort((a, b) => new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime());

    queueCountEl.textContent = `Queue (${queue.length})`;

    if (loading) {
      queueSlot.innerHTML = '<p class="muted small">Loading…</p>';
      return;
    }

    if (queue.length === 0) {
      queueSlot.innerHTML = `<p class="empty-box">No candidates currently at ${STAGE_LABELS[stage]}.</p>`;
      return;
    }

    queueSlot.innerHTML = `
      <ul class="queue-list">
        ${queue
          .map(
            (c) => `
            <li class="queue-item ${selected && selected.id === c.id ? "selected" : ""} ${isHoldDecision(c) ? "hold-flag" : ""}" data-id="${c.id}">
              <div class="row-between">
                <div>
                  <p class="queue-item-name">${escapeHtml(c.full_name)}<span class="queue-item-code">${escapeHtml(c.candidate_code)}</span></p>
                  <p class="queue-item-meta">${escapeHtml(c.position_applied)} · ${escapeHtml(c.phone)} · Registered ${formatTime(c.registered_at)}</p>
                  ${isHoldDecision(c) ? `<p class="small" style="color:#92400e; font-weight:600; margin:.2rem 0 0;">⏸ On hold — Cabin ${c.cabin_number ?? ""} manager marked this candidate "Hold" before sending to LOI.</p>` : ""}
                </div>
                ${statusBadgeFor(c, settings)}
              </div>
            </li>`
          )
          .join("")}
      </ul>`;

    queueSlot.querySelectorAll(".queue-item").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.getAttribute("data-id");
        const candidate = candidatesStore.get().candidates.find((c) => c.id === id);
        if (candidate) selectCandidate(candidate);
      });
    });
  }

  function drawActions() {
    if (!selected) {
      actionsSlot.innerHTML = '<p class="muted small">Select a candidate from the queue to act on them.</p>';
      return;
    }
    if (stage === "reception") return mountReceptionActions(actionsSlot, selected, clearSelection);
    if (stage === "hr_screening") return mountHrPanel(actionsSlot, selected, clearSelection);
    if (["cabin_1", "cabin_2", "cabin_3", "cabin_4"].includes(stage)) return mountCabinPanel(actionsSlot, selected, clearSelection);
    if (stage === "loi") return mountLoiPanel(actionsSlot, selected, clearSelection);
    actionsSlot.innerHTML = '<p class="muted small">No actions available for this stage.</p>';
  }

  function drawLog() {
    const { candidates } = candidatesStore.get();
    const rows = buildLog(stage, candidates);
    const title = stage === "reception" ? "All Registered Candidates" : `Recent Decisions from ${STAGE_LABELS[stage]}`;
    const emptyText =
      stage === "reception" ? "No candidates registered yet." : "No decisions recorded yet from this desk.";
    logSlot.innerHTML = `
      <div class="card" style="margin-top:2rem;">
        <h2 class="section-title">${title} <span class="muted" style="font-weight:400;">(${rows.length})</span></h2>
        ${
          rows.length === 0
            ? `<p class="muted small" style="margin-top:.75rem;">${emptyText}</p>`
            : `<div style="margin-top:.75rem;">
                ${rows
                  .map(
                    (row) => `
                    <div class="decision-item">
                      <div class="row-between">
                        <div style="display:flex; align-items:center; gap:.5rem;">
                          <span class="small" style="font-weight:500; color:var(--gray-800);">${escapeHtml(row.candidate.full_name)}</span>
                          <span class="small" style="font-family:monospace; color:var(--gray-400);">${escapeHtml(row.candidate.candidate_code)}</span>
                          <span class="small muted">→</span>
                          ${stageBadgeHtml(row.destination)}
                        </div>
                        <span class="small muted">${formatDateTime(row.when)}</span>
                      </div>
                      ${row.feedback ? `<p class="decision-feedback">${escapeHtml(row.feedback)}</p>` : ""}
                      ${row.extra ? `<p class="decision-extra">${escapeHtml(row.extra)}</p>` : ""}
                    </div>`
                  )
                  .join("")}
              </div>`
        }
      </div>`;
  }

  drawQueue();
  drawActions();
  drawLog();

  const unsub1 = candidatesStore.subscribe(() => {
    drawQueue();
    drawLog();
  });
  const unsub2 = settingsStore.subscribe(drawQueue);

  return () => {
    unsub1();
    unsub2();
  };
}

// ---- Decision log (mirrors src/components/QueueLog.tsx) ----

function buildLog(stage, candidates) {
  let rows = [];
  if (stage === "reception") {
    // Full registration log for the receptionist to track every candidate signed in,
    // regardless of which stage they've since moved to.
    rows = candidates.map((c) => ({
      candidate: c,
      when: c.registered_at,
      destination: c.stage,
      feedback: null,
      extra: `Applied for ${c.position_applied}`,
    }));
  } else if (stage === "hr_screening") {
    rows = candidates
      .filter((c) => c.hr_completed_at || c.rejected_at_stage === "hr_screening")
      .map((c) => ({
        candidate: c,
        when: c.hr_completed_at ?? c.updated_at,
        destination: c.rejected_at_stage === "hr_screening" ? "rejected" : `cabin_${c.cabin_number}`,
        feedback: c.hr_feedback,
      }));
  } else if (["cabin_1", "cabin_2", "cabin_3", "cabin_4"].includes(stage)) {
    const cabinNum = Number(stage.split("_")[1]);
    rows = candidates
      .filter((c) => c.cabin_number === cabinNum && c.cabin_completed_at)
      .map((c) => ({
        candidate: c,
        when: c.cabin_completed_at,
        destination: c.interview_recommendation === "reject" ? "rejected" : "loi",
        feedback: c.interview_comments,
        extra: c.interview_rating ? `Rating ${c.interview_rating}/5` : null,
      }));
  } else if (stage === "loi") {
    rows = candidates
      .filter((c) => c.stage === "completed")
      .map((c) => ({
        candidate: c,
        when: c.completed_at,
        destination: "completed",
        feedback: null,
        extra: `LOI issued · Aadhaar received · Exit ${formatDateTime(c.exit_time)}`,
      }));
  }
  return rows
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
    .slice(0, stage === "reception" ? 500 : 25);
}

// ---- Reception: registration form (mirrors src/components/ReceptionForm.tsx) ----

function mountReceptionForm(el) {
  const { profile } = authStore.get();
  el.innerHTML = `
    <form id="reception-form" class="form-stack" style="display:grid; grid-template-columns:1fr; gap:.75rem;">
      <style>#reception-form{display:grid;grid-template-columns:1fr;gap:.75rem;} @media (min-width:640px){#reception-form{grid-template-columns:1fr 1fr;}}</style>
      <div><label class="field-label">Full Name *</label><input class="input" id="rf-name" /></div>
      <div><label class="field-label">Phone *</label><input class="input" id="rf-phone" /></div>
      <div><label class="field-label">Email</label><input class="input" id="rf-email" /></div>
      <div><label class="field-label">Position Applied *</label><input class="input" id="rf-position" /></div>
      <div>
        <label class="field-label">Experience (years)</label>
        <input class="input" type="number" min="0" step="0.5" id="rf-exp" value="0" />
        <p class="small muted" style="margin-top:.25rem;">0 = fresher. Only experienced candidates can go to Cabin 4.</p>
      </div>
      <div style="grid-column:1/-1; display:flex; align-items:center; gap:1rem;">
        <label class="checkbox-row"><input type="checkbox" id="rf-resume" /> Resume received</label>
        <label class="checkbox-row"><input type="checkbox" id="rf-reg" /> Registration complete</label>
      </div>
      <p id="rf-error" class="alert alert-error hidden" style="grid-column:1/-1;"></p>
      <p id="rf-success" class="alert alert-success hidden" style="grid-column:1/-1;"></p>
      <button type="submit" id="rf-submit" class="btn btn-block" style="background:var(--stage-reception); grid-column:1/-1;">Register Candidate</button>
    </form>
  `;

  const form = document.getElementById("reception-form");
  const errorEl = document.getElementById("rf-error");
  const successEl = document.getElementById("rf-success");
  const submitBtn = document.getElementById("rf-submit");

  function reset() {
    document.getElementById("rf-name").value = "";
    document.getElementById("rf-phone").value = "";
    document.getElementById("rf-email").value = "";
    document.getElementById("rf-position").value = "";
    document.getElementById("rf-exp").value = "0";
    document.getElementById("rf-resume").checked = false;
    document.getElementById("rf-reg").checked = false;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.add("hidden");
    successEl.classList.add("hidden");

    const fullName = document.getElementById("rf-name").value.trim();
    const phone = document.getElementById("rf-phone").value.trim();
    const email = document.getElementById("rf-email").value.trim();
    const position = document.getElementById("rf-position").value.trim();
    const experience = document.getElementById("rf-exp").value;
    const resumeReceived = document.getElementById("rf-resume").checked;
    const registrationComplete = document.getElementById("rf-reg").checked;

    if (!fullName || !position || !phone) {
      errorEl.textContent = "Name, phone, and position applied are required.";
      errorEl.classList.remove("hidden");
      return;
    }
    if (!resumeReceived || !registrationComplete) {
      errorEl.textContent =
        "Resume received and registration complete must both be checked before this candidate can move on.";
      errorEl.classList.remove("hidden");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Registering…";

    const { data: candidateCode, error: codeError } = await supabase.rpc("generate_candidate_code");
    if (codeError || !candidateCode) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Register Candidate";
      errorEl.textContent = codeError?.message ?? "Unable to generate candidate code.";
      errorEl.classList.remove("hidden");
      return;
    }

    const { profile } = authStore.get();
    const { error } = await supabase.from("candidates").insert({
      candidate_code: candidateCode,
      full_name: fullName,
      phone,
      email: email || null,
      position_applied: position,
      experience_years: Number(experience) || 0,
      resume_received: resumeReceived,
      registration_complete: registrationComplete,
      stage: "reception",
      created_by: profile?.id ?? null,
    });

    submitBtn.disabled = false;
    submitBtn.textContent = "Register Candidate";

    if (error) {
      errorEl.textContent =
        error.message.includes("duplicate key") || error.message.includes("candidates_phone_key")
          ? "A candidate with this phone number is already registered."
          : error.message;
      errorEl.classList.remove("hidden");
      return;
    }

    successEl.textContent = `Registered as ${candidateCode}.`;
    successEl.classList.remove("hidden");
    reset();
  });
}

// ---- Reception: queue action (send to HR) ----

function mountReceptionActions(el, candidate, onDone) {
  el.innerHTML = `
    <div class="stack-sm">
      <p class="small" style="font-weight:500; color:var(--gray-800);">${escapeHtml(candidate.full_name)}</p>
      <dl class="small muted" style="margin:0;">
        <div>Resume received: ${candidate.resume_received ? "Yes" : "No"}</div>
        <div>Registration complete: ${candidate.registration_complete ? "Yes" : "No"}</div>
      </dl>
      <p id="ra-error" class="alert alert-error hidden"></p>
      <button id="ra-submit" class="btn btn-block" style="background:var(--stage-hr);">Send to HR Screening →</button>
    </div>`;

  const errorEl = document.getElementById("ra-error");
  const btn = document.getElementById("ra-submit");

  btn.addEventListener("click", async () => {
    if (!candidate.resume_received || !candidate.registration_complete) {
      errorEl.textContent = "Cannot proceed: resume received and registration complete must both be checked first.";
      errorEl.classList.remove("hidden");
      return;
    }
    btn.disabled = true;
    btn.textContent = "Sending…";
    const { error } = await supabase.from("candidates").update({ stage: "hr_screening" }).eq("id", candidate.id);
    btn.disabled = false;
    btn.textContent = "Send to HR Screening →";
    if (error) {
      errorEl.textContent = error.message;
      errorEl.classList.remove("hidden");
    } else {
      onDone();
    }
  });
}

// ---- HR panel (mirrors intent of src/components/HrPanel.tsx) ----

function mountHrPanel(el, candidate, onDone) {
  const isExperienced = candidate.experience_years > 0;

  if (!candidate.hr_started_at) {
    el.innerHTML = `
      <div class="stack-sm">
        <div>
          <p class="small" style="font-weight:500; color:var(--gray-800);">${escapeHtml(candidate.full_name)}</p>
          <p class="small muted">${escapeHtml(candidate.position_applied)} · ${candidate.experience_years}yrs exp${isExperienced ? "" : " (fresher — Cabin 4 not eligible)"}</p>
        </div>
        <button id="hr-start" class="btn btn-block" style="background:var(--stage-hr);">Start Screening</button>
      </div>`;
    document.getElementById("hr-start").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const { error } = await supabase
        .from("candidates")
        .update({ hr_started_at: new Date().toISOString() })
        .eq("id", candidate.id);
      btn.disabled = false;
      if (error) alert(error.message);
      else {
        candidate.hr_started_at = new Date().toISOString();
        mountHrPanel(el, candidate, onDone);
      }
    });
    return;
  }

  el.innerHTML = `
    <div class="stack-sm">
      <div>
        <p class="small" style="font-weight:500; color:var(--gray-800);">${escapeHtml(candidate.full_name)}</p>
        <p class="small muted">${escapeHtml(candidate.position_applied)} · ${candidate.experience_years}yrs exp${isExperienced ? "" : " (fresher — Cabin 4 not eligible)"}</p>
      </div>
      <div>
        <label class="field-label">HR Name</label>
        <select id="hr-name" class="input">
          ${HR_NAMES.map((n) => `<option value="${n}" ${(candidate.hr_interviewer ?? "Rushi") === n ? "selected" : ""}>${n}</option>`).join("")}
        </select>
      </div>
      <div>
        <label class="field-label">HR Feedback</label>
        <textarea id="hr-feedback" class="input" rows="3">${escapeHtml(candidate.hr_feedback ?? "")}</textarea>
      </div>
      <div>
        <label class="field-label">Assign to Cabin</label>
        <select id="hr-cabin" class="input">
          <option value="1">Cabin 1</option>
          <option value="2">Cabin 2</option>
          <option value="3">Cabin 3</option>
          <option value="4" ${isExperienced ? "" : "disabled"}>Cabin 4 ${isExperienced ? "" : "(experienced only)"}</option>
        </select>
      </div>
      <p id="hr-error" class="alert alert-error hidden"></p>
      <div style="display:flex; gap:.5rem;">
        <button id="hr-assign" class="btn btn-flex" style="background:var(--stage-cabin1);">Send to Cabin →</button>
        <button id="hr-reject" class="btn btn-flex" style="background:var(--stage-rejected);">Reject</button>
      </div>
    </div>`;

  const errorEl = document.getElementById("hr-error");
  const nameSel = document.getElementById("hr-name");
  const feedbackEl = document.getElementById("hr-feedback");
  const cabinSel = document.getElementById("hr-cabin");
  const assignBtn = document.getElementById("hr-assign");
  const rejectBtn = document.getElementById("hr-reject");

  function buildHistory(rejected) {
    const prior = candidate.comments_history ?? "";
    const header = rejected ? `HR (${nameSel.value})\nREJECTED` : `HR (${nameSel.value})`;
    return `${prior}\n\n========================\n${header}\n${feedbackEl.value}`;
  }

  assignBtn.addEventListener("click", async () => {
    const cabin = cabinSel.value;
    if (cabin === "4" && !isExperienced) {
      errorEl.textContent = "Cabin 4 is for experienced candidates only. Choose a different cabin.";
      errorEl.classList.remove("hidden");
      return;
    }
    assignBtn.disabled = true;
    rejectBtn.disabled = true;
    errorEl.classList.add("hidden");

    const { error } = await supabase
      .from("candidates")
      .update({
        hr_feedback: feedbackEl.value.trim() || null,
        hr_interviewer: nameSel.value,
        comments_history: buildHistory(false),
        hr_completed_at: new Date().toISOString(),
        cabin_number: Number(cabin),
        stage: `cabin_${cabin}`,
      })
      .eq("id", candidate.id);

    assignBtn.disabled = false;
    rejectBtn.disabled = false;
    if (error) {
      errorEl.textContent = error.message;
      errorEl.classList.remove("hidden");
    } else {
      onDone();
    }
  });

  rejectBtn.addEventListener("click", async () => {
    assignBtn.disabled = true;
    rejectBtn.disabled = true;
    errorEl.classList.add("hidden");

    const { error } = await supabase
      .from("candidates")
      .update({
        hr_feedback: feedbackEl.value.trim() || null,
        hr_interviewer: nameSel.value,
        comments_history: buildHistory(true),
        hr_completed_at: new Date().toISOString(),
        stage: "rejected",
        rejected_at_stage: "hr_screening",
        rejection_reason: feedbackEl.value.trim() || null,
      })
      .eq("id", candidate.id);

    assignBtn.disabled = false;
    rejectBtn.disabled = false;
    if (error) {
      errorEl.textContent = error.message;
      errorEl.classList.remove("hidden");
    } else {
      onDone();
    }
  });
}

// ---- Cabin panel (mirrors src/components/CabinPanel.tsx) ----

function mountCabinPanel(el, candidate, onDone) {
  if (!candidate.cabin_started_at) {
    el.innerHTML = `
      <div class="stack-sm">
        <div>
          <p class="small" style="font-weight:500; color:var(--gray-800);">${escapeHtml(candidate.full_name)}</p>
          <p class="small muted">${escapeHtml(candidate.position_applied)} · ${candidate.experience_years}yrs exp</p>
        </div>
        ${
          candidate.hr_feedback
            ? `<div class="note-box"><p class="note-box-label">HR Screening Comments</p><p class="note-box-body">${escapeHtml(candidate.hr_feedback)}</p></div>`
            : ""
        }
        <button id="cb-start" class="btn btn-block btn-primary">Start Interview</button>
      </div>`;
    document.getElementById("cb-start").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const { error } = await supabase
        .from("candidates")
        .update({ cabin_started_at: new Date().toISOString() })
        .eq("id", candidate.id);
      btn.disabled = false;
      if (error) alert(error.message);
      else {
        candidate.cabin_started_at = new Date().toISOString();
        mountCabinPanel(el, candidate, onDone);
      }
    });
    return;
  }

  el.innerHTML = `
    <div class="stack-sm">
      <div>
        <p class="small" style="font-weight:500; color:var(--gray-800);">${escapeHtml(candidate.full_name)}</p>
        <p class="small muted">${escapeHtml(candidate.position_applied)} · ${candidate.experience_years}yrs exp</p>
      </div>
      ${
        candidate.hr_feedback
          ? `<div class="note-box"><p class="note-box-label">HR Screening Comments</p><p class="note-box-body">${escapeHtml(candidate.hr_feedback)}</p></div>`
          : ""
      }
      <div class="range-row">
        <label class="field-label">Rating (1–5)</label>
        <input type="range" min="1" max="5" value="3" id="cb-rating" />
        <p class="small muted" id="cb-rating-value">3 / 5</p>
      </div>
      <div>
        <label class="field-label">Detailed Feedback <span style="color:#ef4444;">*</span></label>
        <textarea id="cb-comments" class="input" rows="4" placeholder="Notes on communication, technical fit, strengths, concerns…">${escapeHtml(candidate.interview_comments ?? "")}</textarea>
        <p class="small muted" style="margin-top:.15rem;">Required before rejecting or sending to LOI.</p>
      </div>
      <div>
        <label class="field-label">Recommendation</label>
        <select id="cb-rec" class="input">
          <option value="select">Select → send to LOI</option>
          <option value="hold">Hold → send to LOI (pending)</option>
          <option value="reject">Reject</option>
        </select>
      </div>
      <p id="cb-error" class="alert alert-error hidden"></p>
      <button id="cb-finish" class="btn btn-block" style="background:var(--stage-loi);">Send to LOI →</button>
    </div>`;

  const ratingInput = document.getElementById("cb-rating");
  const ratingValue = document.getElementById("cb-rating-value");
  const commentsEl = document.getElementById("cb-comments");
  const recSel = document.getElementById("cb-rec");
  const errorEl = document.getElementById("cb-error");
  const finishBtn = document.getElementById("cb-finish");

  ratingInput.addEventListener("input", () => {
    ratingValue.textContent = `${ratingInput.value} / 5`;
  });
  recSel.addEventListener("change", () => {
    finishBtn.textContent = recSel.value === "reject" ? "Reject Candidate" : "Send to LOI →";
  });

  finishBtn.addEventListener("click", async () => {
    if (!commentsEl.value.trim()) {
      errorEl.textContent = "Please add detailed feedback before rejecting or sending this candidate forward.";
      errorEl.classList.remove("hidden");
      return;
    }
    finishBtn.disabled = true;
    errorEl.classList.add("hidden");

    const recommendation = recSel.value;
    const nextStage = recommendation === "reject" ? "rejected" : "loi";
    const payload = {
      cabin_completed_at: new Date().toISOString(),
      interview_rating: Number(ratingInput.value),
      interview_recommendation: recommendation,
      interview_comments: commentsEl.value.trim(),
      stage: nextStage,
    };
    if (nextStage === "rejected") {
      payload.rejected_at_stage = candidate.stage;
      payload.rejection_reason = commentsEl.value.trim();
    }

    const { error } = await supabase.from("candidates").update(payload).eq("id", candidate.id);
    finishBtn.disabled = false;
    if (error) {
      errorEl.textContent = error.message;
      errorEl.classList.remove("hidden");
    } else {
      onDone();
    }
  });
}

// ---- LOI panel (mirrors src/components/LoiPanel.tsx) ----

function mountLoiPanel(el, candidate, onDone) {
  el.innerHTML = `
    <div class="stack-sm">
      <p class="small" style="font-weight:500; color:var(--gray-800);">${escapeHtml(candidate.full_name)}</p>
      <p class="small muted">${escapeHtml(candidate.position_applied)} · Rating ${candidate.interview_rating ?? "—"}/5 · ${candidate.interview_recommendation ?? "—"}</p>
      ${
        candidate.interview_comments
          ? `<div class="note-box" style="background:var(--gray-50); border-color:var(--gray-200);"><p class="note-box-label" style="color:var(--gray-500);">Interviewer Feedback</p><p class="note-box-body" style="color:var(--gray-700);">${escapeHtml(candidate.interview_comments)}</p></div>`
          : ""
      }
      <label class="checkbox-row"><input type="checkbox" id="loi-issued" ${candidate.loi_issued ? "checked" : ""} /> LOI issued</label>
      <label class="checkbox-row"><input type="checkbox" id="loi-aadhaar" ${candidate.aadhaar_received ? "checked" : ""} /> Aadhaar received</label>
      <p id="loi-error" class="alert alert-error hidden"></p>
      <button id="loi-complete" class="btn btn-block" style="background:var(--stage-completed);">Mark Completed (records exit time) →</button>
    </div>`;

  const issuedEl = document.getElementById("loi-issued");
  const aadhaarEl = document.getElementById("loi-aadhaar");
  const errorEl = document.getElementById("loi-error");
  const completeBtn = document.getElementById("loi-complete");

  async function save() {
    await supabase
      .from("candidates")
      .update({ loi_issued: issuedEl.checked, aadhaar_received: aadhaarEl.checked })
      .eq("id", candidate.id);
  }
  issuedEl.addEventListener("change", save);
  aadhaarEl.addEventListener("change", save);

  completeBtn.addEventListener("click", async () => {
    if (!issuedEl.checked || !aadhaarEl.checked) {
      errorEl.textContent = "LOI must be issued and Aadhaar received before marking complete.";
      errorEl.classList.remove("hidden");
      return;
    }
    completeBtn.disabled = true;
    errorEl.classList.add("hidden");
    await save();
    const { error } = await supabase
      .from("candidates")
      .update({
        loi_issued: true,
        aadhaar_received: true,
        exit_time: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        stage: "completed",
      })
      .eq("id", candidate.id);
    completeBtn.disabled = false;
    if (error) {
      errorEl.textContent = error.message;
      errorEl.classList.remove("hidden");
    } else {
      onDone();
    }
  });
}
