import { signIn } from "../store.js";

export function renderLogin(root) {
  root.innerHTML = `
    <div class="center-screen">
      <div class="card login-card">
        <h1 class="brand-title">Hiring Drive Tracker</h1>
        <p class="muted small" style="margin-top:.25rem;">Sign in with the account your admin created for you.</p>

        <form id="login-form" class="form-stack">
          <div>
            <label class="field-label">Email</label>
            <input type="email" id="login-email" required class="input" placeholder="you@company.com" />
          </div>
          <div>
            <label class="field-label">Password</label>
            <input type="password" id="login-password" required class="input" placeholder="••••••••" />
          </div>

          <p id="login-error" class="alert alert-error hidden"></p>

          <button type="submit" id="login-submit" class="btn btn-primary btn-block">Sign in</button>
        </form>

        <p class="muted small center mt-6">
          Just here to watch the live queue?
          <a href="#/volunteer" class="link">Open the read-only view</a>
        </p>
      </div>
    </div>
  `;

  const form = document.getElementById("login-form");
  const errorEl = document.getElementById("login-error");
  const submitBtn = document.getElementById("login-submit");

  async function handleSubmit(e) {
    e.preventDefault();
    errorEl.classList.add("hidden");
    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in…";

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const err = await signIn(email, password);

    submitBtn.disabled = false;
    submitBtn.textContent = "Sign in";

    if (err) {
      errorEl.textContent = err;
      errorEl.classList.remove("hidden");
    } else {
      location.hash = "/";
    }
  }

  form.addEventListener("submit", handleSubmit);

  return () => form.removeEventListener("submit", handleSubmit);
}
