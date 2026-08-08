import { authStore, signOut } from "./store.js";
import { ROLE_LABELS, ROLE_OWNED_STAGE, STAGE_LABELS, escapeHtml } from "./lib.js";

// Renders the header/nav shell into `root`, then calls pageRenderFn(pageRootEl)
// to render the page content inside it. Returns a cleanup function that also
// tears down the page's own cleanup (if any).
export function renderLayout(root, pageRenderFn) {
  const { profile } = authStore.get();
  const ownedStage = profile ? ROLE_OWNED_STAGE[profile.role] : null;
  const hash = location.hash.replace(/^#/, "") || "/";

  root.innerHTML = `
    <div class="app-shell">
      <header class="header">
        <div class="header-inner">
          <div class="header-left">
            <span class="header-title">Hiring Drive Tracker</span>
            <nav class="nav">
              <a href="#/" class="navlink ${hash === "/" ? "active" : ""}">Dashboard</a>
              ${
                ownedStage
                  ? `<a href="#/stage/${ownedStage}" class="navlink ${hash === "/stage/" + ownedStage ? "active" : ""}">My Queue (${STAGE_LABELS[ownedStage]})</a>`
                  : ""
              }
              ${profile && profile.role === "admin" ? `<a href="#/admin" class="navlink ${hash === "/admin" ? "active" : ""}">Admin</a>` : ""}
            </nav>
          </div>
          <div class="header-right">
            <span>${escapeHtml(profile?.full_name || profile?.email || "")} · ${profile ? ROLE_LABELS[profile.role] || "" : ""}</span>
            <button id="signout-btn" class="btn-ghost-invert">Sign out</button>
          </div>
        </div>
      </header>
      <main class="main" id="page-root"></main>
    </div>
  `;

  document.getElementById("signout-btn").addEventListener("click", async () => {
    await signOut();
    location.hash = "/login";
  });

  const pageRoot = document.getElementById("page-root");
  const cleanup = pageRenderFn(pageRoot);
  return typeof cleanup === "function" ? cleanup : () => {};
}
