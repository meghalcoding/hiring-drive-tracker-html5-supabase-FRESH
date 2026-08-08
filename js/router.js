import { authStore } from "./store.js";
import { renderLayout } from "./layout.js";
import { renderLogin } from "./pages/login.js";
import { renderVolunteer } from "./pages/volunteer.js";
import { renderDashboard } from "./pages/dashboard.js";
import { renderStage } from "./pages/stage.js";
import { renderAdmin } from "./pages/admin.js";

let currentCleanup = null;

function cleanupCurrent() {
  if (currentCleanup) {
    try {
      currentCleanup();
    } catch (e) {
      console.error(e);
    }
    currentCleanup = null;
  }
}

export function startRouter() {
  window.addEventListener("hashchange", render);
  authStore.subscribe(() => render());
  render();
}

function render() {
  cleanupCurrent();

  const root = document.getElementById("app");
  const hash = location.hash.replace(/^#/, "") || "/";
  const { session, profile, loading } = authStore.get();

  // Public routes — no auth required.
  if (hash === "/login") {
    if (session) {
      location.hash = "/";
      return;
    }
    currentCleanup = renderLogin(root);
    return;
  }

  if (hash === "/volunteer") {
    currentCleanup = renderVolunteer(root);
    return;
  }

  if (loading) {
    root.innerHTML = '<div class="center-screen muted">Loading…</div>';
    return;
  }

  if (!session) {
    location.hash = "/login";
    return;
  }

  if (hash === "/admin") {
    if (profile && profile.role !== "admin") {
      currentCleanup = renderLayout(root, (el) => {
        el.innerHTML = '<div class="center-screen muted">You don\'t have access to this page.</div>';
      });
      return;
    }
    currentCleanup = renderLayout(root, renderAdmin);
    return;
  }

  const stageMatch = hash.match(/^\/stage\/([a-z0-9_]+)$/);
  if (stageMatch) {
    currentCleanup = renderLayout(root, (el) => renderStage(el, stageMatch[1]));
    return;
  }

  // Default -> dashboard
  currentCleanup = renderLayout(root, renderDashboard);
}
