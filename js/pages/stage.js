import { supabase } from "../supabaseClient.js";
import { authStore, candidatesStore, settingsStore } from "../store.js";
import {
  STAGE_LABELS,
  stageBadgeHtml,
  statusBadgeFor,
  formatTime,
  formatDateTime,
  escapeHtml,
  isHoldDecision,
  isHrScreeningActive,
  isCabinInterviewActive,
} from "../lib.js";

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
    drawQueue();
    drawActions();
  }

  function drawQueue() {
    const { candidates, loading } = candidatesStore.get();
    const { settings } = settingsStore.get();
    const queue = candidates.filter((c) => {
      if (stage === "reception") return c.stage === "reception";
      if (stage === "hr_screening") return c.stage === "hr_screening";
      if (["cabin_1", "cabin_2", "cabin_3", "cabin_4"].includes(stage)) {
        return c.stage === stage;
      }
      if (stage === "loi") return c.stage === "loi";
      return false;
    });

    queueCountEl.textContent = `${queue.length} in queue`;

    if (loading) {
      queueSlot.innerHTML = '<p class="muted small">Loading…</p>';
      return;
    }

    if (!queue.length) {
      queueSlot.innerHTML = '<p class="muted small">No candidates currently in this stage.</p>';
      return;
    }

    queueSlot.innerHTML = `
      <div class="queue-table">
        ${queue.map((c, i) => {
          const activeHr = isHrScreeningActive(c);
          const activeCabin = isCabinInterviewActive(c);
          const selectedClass = selected?.id === c.id ? "selected" : "";
          const activeClass = activeHr ? "hr-active-row" : activeCabin ? "cabin-active-row" : "";

          return `
            <button class="queue-row ${selectedClass} ${activeClass}" data-id="${c.id}">
              <span class="queue-position">${i + 1}</span>
              <span class="queue-main">
                <span class="queue-name">${escapeHtml(c.full_name)}</span>
                <span class="queue-meta">
                  ${escapeHtml(c.candidate_code)}
                  · ${escapeHtml(c.position_applied)}
                  ${c.experience_years != null ? `· ${c.experience_years} yrs` : ""}
                </span>
              </span>
              <span class="queue-status">${statusBadgeFor(c, settings)}</span>
            </button>
          `;
        }).join("")}
      </div>
    `;

    queueSlot.querySelectorAll(".queue-row").forEach((row) => {
      row.addEventListener("click", () => {
        const candidate = candidates.find((c) => c.id === row.dataset.id);
        if (candidate) selectCandidate(candidate);
      });
    });
  }

  function drawActions() {
    if (!selected) {
      actionsSlot.innerHTML = '<p class="muted small">Select a candidate from the queue to act on them.</p>';
      return;
    }

    if (stage === "reception") {
      mountReceptionActions(actionsSlot, selected, clearSelection);
      return;
    }

    if (stage === "hr_screening") {
      mountHrPanel(actionsSlot, selected, clearSelection);
      return;
    }

    if (["cabin_1", "cabin_2", "cabin_3", "cabin_4"].includes(stage)) {
      mountCabinPanel(actionsSlot, selected, clearSelection);
      return;
    }

    if (stage === "loi") {
      mountLoiPanel(actionsSlot, selected, clearSelection);
    }
  }

  const unsubCandidates = candidatesStore.subscribe(() => {
    if (selected) {
      const { candidates } = candidatesStore.get();
      const fresh = candidates.find((c) => c.id === selected.id);
      if (fresh) selected = fresh;
      else selected = null;
    }
    drawQueue();
    drawActions();
  });

  const unsubSettings = settingsStore.subscribe(() => {
    drawQueue();
    drawActions();
  });

  drawQueue();
  drawActions();

  return () => {
    unsubCandidates();
    unsubSettings();
  };
}

// ---- Reception form ----

function mountReceptionForm(el) {
  el.innerHTML = `
    <form id="candidate-form" class="stack">
      <div class="form-grid">
        <label class="field">
          <span>Full name</span>
          <input id="cand-name" required />
        </label>
        <label class="field">
          <span>Phone</span>
          <input id="cand-phone" required />
        </label>
        <label class="field">
          <span>Email</span>
          <input id="cand-email" type="email" />
        </label>
        <label class="field">
          <span>Position applied</span>
          <input id="cand-position" required />
        </label>
        <label class="field">
          <span>Experience (years)</span>
          <input id="cand-experience" type="number" min="0" step="0.1" required />
        </label>
        <label class="field">
          <span>Resume received</span>
          <select id="cand-resume">
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
      </div>
      <label class="checkbox-row">
        <input id="cand-registration" type="checkbox" />
        Registration complete
      </label>
      <p id="reception-error" class="alert alert-error hidden"></p>
      <button class="btn btn-block" type="submit">Register Candidate →</button>
    </form>
  `;

  const form = document.getElementById("candidate-form");
  const errorEl = document.getElementById("reception-error");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.add("hidden");

    const name = document.getElementById("cand-name").value.trim();
    const phone = document.getElementById("cand-phone").value.trim();
    const email = document.getElementById("cand-email").value.trim();
    const position = document.getElementById("cand-position").value.trim();
    const experience = Number(document.getElementById("cand-experience").value);
    const resumeReceived = document.getElementById("cand-resume").value === "yes";
    const registrationComplete = document.getElementById("cand-registration").checked;

    if (!name || !phone || !position || !Number.isFinite(experience)) {
      errorEl.textContent = "Please complete all required fields.";
      errorEl.classList.remove("hidden");
      return;
    }

    const { user } = authStore.get();
    const candidateCode = `C-${Date.now().toString().slice(-6)}`;

    const { error } = await supabase.from("candidates").insert({
      candidate_code: candidateCode,
      full_name: name,
      phone,
      email: email || null,
      position_applied: position,
      experience_years: experience,
      resume_received: resumeReceived,
      registration_complete: registrationComplete,
      stage: "reception",
      registered_at: new Date().toISOString(),
      created_by: user?.id ?? null,
    });

    if (error) {
      errorEl.textContent = error.message;
      errorEl.classList.remove("hidden");
      return;
    }

    form.reset();
    document.getElementById("cand-resume").value = "yes";
  });
}

// ---- Reception action panel ----

function mountReceptionActions(el, candidate, onDone) {
  el.innerHTML = `
    <div class="stack-sm">
      <p class="small" style="font-weight:500; color:var(--gray-800);">${escapeHtml(candidate.full_name)}</p>
      <p class="small muted">${escapeHtml(candidate.candidate_code)} · ${escapeHtml(candidate.position_applied)}</p>
      <div class="note-box">
        <p class="note-box-label">Registration</p>
        <p class="note-box-body">${candidate.registration_complete ? "Complete" : "Incomplete"} · Resume ${candidate.resume_received ? "received" : "missing"}</p>
      </div>
      <p id="reception-action-error" class="alert alert-error hidden"></p>
      <button id="reception-next" class="btn btn-block">Send to HR Screening →</button>
    </div>
  `;

  const btn = document.getElementById("reception-next");
  const errorEl = document.getElementById("reception-action-error");

  btn.addEventListener("click", async () => {
    if (!candidate.resume_received || !candidate.registration_complete) {
      errorEl.textContent = "Resume and registration must be complete before sending the candidate to HR Screening.";
      errorEl.classList.remove("hidden");
      return;
    }

    btn.disabled = true;
    errorEl.classList.add("hidden");

    const { error } = await supabase
      .from("candidates")
      .update({ stage: "hr_screening" })
      .eq("id", candidate.id);

    btn.disabled = false;

    if (error) {
      errorEl.textContent = error.message;
      errorEl.classList.remove("hidden");
    } else {
      onDone();
    }
  });
}

// ---- HR panel ----

function mountHrPanel(el, candidate, onDone) {
  const active = isHrScreeningActive(candidate);

  el.innerHTML = `
    <div class="stack-sm">
      <p class="small" style="font-weight:500; color:var(--gray-800);">${escapeHtml(candidate.full_name)}</p>
      <p class="small muted">${escapeHtml(candidate.position_applied)} · ${escapeHtml(candidate.candidate_code)}</p>
      ${
        active
          ? `<div class="active-interview-panel hr-active-panel">
              <span class="active-interview-label">HR SCREENING ACTIVE</span>
              <span class="active-interview-time">Started ${formatTime(candidate.hr_started_at)}</span>
            </div>`
          : ""
      }
      <label class="field">
        <span>HR interviewer</span>
        <select id="hr-interviewer">
          ${HR_NAMES.map(
            (name) =>
              `<option value="${escapeHtml(name)}" ${
                candidate.hr_interviewer === name ? "selected" : ""
              }>${escapeHtml(name)}</option>`
          ).join("")}
        </select>
      </label>
      <label class="field">
        <span>Feedback</span>
        <textarea id="hr-feedback" rows="6" placeholder="Enter HR screening feedback...">${escapeHtml(candidate.hr_feedback || "")}</textarea>
      </label>
      <p id="hr-error" class="alert alert-error hidden"></p>
      ${
        active
          ? `<button id="hr-cancel" class="btn btn-block btn-cancel">Cancel Screening</button>`
          : `<button id="hr-start" class="btn btn-block">Start Screening</button>`
      }
      <button id="hr-finish" class="btn btn-block" style="background:var(--stage-cabin1);">
        Send to Cabin 1 →
      </button>
      <button id="hr-reject" class="btn btn-block btn-danger">Reject Candidate</button>
    </div>
  `;

  const interviewerEl = document.getElementById("hr-interviewer");
  const feedbackEl = document.getElementById("hr-feedback");
  const errorEl = document.getElementById("hr-error");
  const startBtn = document.getElementById("hr-start");
  const cancelBtn = document.getElementById("hr-cancel");
  const finishBtn = document.getElementById("hr-finish");
  const rejectBtn = document.getElementById("hr-reject");

  startBtn?.addEventListener("click", async () => {
    startBtn.disabled = true;
    errorEl.classList.add("hidden");

    const startedAt = new Date().toISOString();

    const { error } = await supabase
      .from("candidates")
      .update({
        hr_started_at: startedAt,
        hr_interviewer: interviewerEl.value,
      })
      .eq("id", candidate.id);

    if (error) {
      startBtn.disabled = false;
      errorEl.textContent = error.message;
      errorEl.classList.remove("hidden");
      return;
    }

    candidate.hr_started_at = startedAt;
    candidate.hr_interviewer = interviewerEl.value;
    onDone();
  });

  cancelBtn?.addEventListener("click", async () => {
    cancelBtn.disabled = true;
    errorEl.classList.add("hidden");

    const { error } = await supabase
      .from("candidates")
      .update({ hr_started_at: null })
      .eq("id", candidate.id);

    if (error) {
      cancelBtn.disabled = false;
      errorEl.textContent = error.message;
      errorEl.classList.remove("hidden");
      return;
    }

    candidate.hr_started_at = null;
    onDone();
  });

  finishBtn.addEventListener("click", async () => {
    if (!feedbackEl.value.trim()) {
      errorEl.textContent = "Please add HR feedback before sending the candidate forward.";
      errorEl.classList.remove("hidden");
      return;
    }

    finishBtn.disabled = true;
    errorEl.classList.add("hidden");

    const { error } = await supabase
      .from("candidates")
      .update({
        hr_interviewer: interviewerEl.value,
        hr_feedback: feedbackEl.value.trim(),
        hr_completed_at: new Date().toISOString(),
        stage: "cabin_1",
      })
      .eq("id", candidate.id);

    finishBtn.disabled = false;

    if (error) {
      errorEl.textContent = error.message;
      errorEl.classList.remove("hidden");
    } else {
      onDone();
    }
  });

  rejectBtn.addEventListener("click", async () => {
    if (!feedbackEl.value.trim()) {
      errorEl.textContent = "Please add HR feedback before rejecting this candidate.";
      errorEl.classList.remove("hidden");
      return;
    }

    rejectBtn.disabled = true;
    errorEl.classList.add("hidden");

    const { error } = await supabase
      .from("candidates")
      .update({
        hr_interviewer: interviewerEl.value,
        hr_feedback: feedbackEl.value.trim(),
        hr_completed_at: new Date().toISOString(),
        stage: "rejected",
        rejected_at_stage: "hr_screening",
        rejection_reason: feedbackEl.value.trim(),
      })
      .eq("id", candidate.id);

    rejectBtn.disabled = false;

    if (error) {
      errorEl.textContent = error.message;
      errorEl.classList.remove("hidden");
    } else {
      onDone();
    }
  });
}

// ---- Cabin panel ----

function mountCabinPanel(el, candidate, onDone) {
  const active = isCabinInterviewActive(candidate);

  el.innerHTML = `
    <div class="stack-sm">
      <p class="small" style="font-weight:500; color:var(--gray-800);">${escapeHtml(candidate.full_name)}</p>
      <p class="small muted">${escapeHtml(candidate.position_applied)} · ${escapeHtml(candidate.candidate_code)}</p>
      ${
        active
          ? `<div class="active-interview-panel cabin-active-panel">
              <span class="active-interview-label">CABIN INTERVIEW ACTIVE</span>
              <span class="active-interview-time">Started ${formatTime(candidate.cabin_started_at)}</span>
            </div>`
          : ""
      }
      <label class="field">
        <span>Interview rating</span>
        <input id="cb-rating" type="range" min="1" max="5" step="1" value="${candidate.interview_rating ?? 3}" />
        <span id="cb-rating-value" class="small muted">${candidate.interview_rating ?? 3} / 5</span>
      </label>
      <label class="field">
        <span>Recommendation</span>
        <select id="cb-rec">
          <option value="select" ${candidate.interview_recommendation === "select" ? "selected" : ""}>Select</option>
          <option value="hold" ${candidate.interview_recommendation === "hold" ? "selected" : ""}>Hold</option>
          <option value="reject" ${candidate.interview_recommendation === "reject" ? "selected" : ""}>Reject</option>
        </select>
      </label>
      <label class="field">
        <span>Interview comments</span>
        <textarea id="cb-comments" rows="6" placeholder="Enter detailed interview feedback...">${escapeHtml(candidate.interview_comments || "")}</textarea>
      </label>
      <p id="cb-error" class="alert alert-error hidden"></p>
      ${
        active
          ? `<button id="cb-cancel" class="btn btn-block btn-cancel">Cancel Interview</button>`
          : `<button id="cb-start" class="btn btn-block">Start Interview</button>`
      }
      <button id="cb-finish" class="btn btn-block" style="background:var(--stage-loi);">
        ${candidate.interview_recommendation === "reject" ? "Reject Candidate" : "Send to LOI →"}
      </button>
    </div>`;

  const ratingInput = document.getElementById("cb-rating");
  const ratingValue = document.getElementById("cb-rating-value");
  const commentsEl = document.getElementById("cb-comments");
  const recSel = document.getElementById("cb-rec");
  const errorEl = document.getElementById("cb-error");
  const finishBtn = document.getElementById("cb-finish");
  const cancelBtn = document.getElementById("cb-cancel");
  const startBtn = document.getElementById("cb-start");

  startBtn?.addEventListener("click", async () => {
    startBtn.disabled = true;
    errorEl.classList.add("hidden");

    const startedAt = new Date().toISOString();

    const { error } = await supabase
      .from("candidates")
      .update({ cabin_started_at: startedAt })
      .eq("id", candidate.id);

    if (error) {
      startBtn.disabled = false;
      errorEl.textContent = error.message;
      errorEl.classList.remove("hidden");
      return;
    }

    candidate.cabin_started_at = startedAt;
    onDone();
  });

  cancelBtn?.addEventListener("click", async () => {
    finishBtn.disabled = true;
    cancelBtn.disabled = true;
    errorEl.classList.add("hidden");

    const { error } = await supabase
      .from("candidates")
      .update({ cabin_started_at: null })
      .eq("id", candidate.id);

    if (error) {
      finishBtn.disabled = false;
      cancelBtn.disabled = false;
      errorEl.textContent = error.message;
      errorEl.classList.remove("hidden");
    } else {
      candidate.cabin_started_at = null;
      onDone();
    }
  });

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

    const { error } = await supabase
      .from("candidates")
      .update(payload)
      .eq("id", candidate.id);

    finishBtn.disabled = false;

    if (error) {
      errorEl.textContent = error.message;
      errorEl.classList.remove("hidden");
    } else {
      onDone();
    }
  });
}

// ---- LOI panel ----

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
      .update({
        loi_issued: issuedEl.checked,
        aadhaar_received: aadhaarEl.checked,
      })
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