import { supabase } from "./supabaseClient.js";

function createStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      state = typeof patch === "function" ? patch(state) : { ...state, ...patch };
      subs.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      subs.add(fn);
      fn(state);
      return () => subs.delete(fn);
    },
  };
}

export const authStore = createStore({ session: null, profile: null, loading: true });
export const candidatesStore = createStore({ candidates: [], loading: true });
export const settingsStore = createStore({ settings: null });

async function loadProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (!error) authStore.set({ profile: data });
}

export function initAuth() {
  supabase.auth.getSession().then(({ data }) => {
    authStore.set({ session: data.session, loading: false });
    if (data.session) loadProfile(data.session.user.id);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    authStore.set({ session });
    if (session) {
      loadProfile(session.user.id);
    } else {
      authStore.set({ profile: null });
    }
  });
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}

export async function signOut() {
  await supabase.auth.signOut();
}

let dataInitialized = false;

// Candidates and settings are readable by anon users too (RLS allows it, so
// the public Volunteer view works without logging in) — so this is started
// once at app boot regardless of auth state.
export function initData() {
  if (dataInitialized) return;
  dataInitialized = true;

  supabase
    .from("candidates")
    .select("*")
    .order("registered_at", { ascending: true })
    .then(({ data, error }) => {
      if (!error && data) candidatesStore.set({ candidates: data, loading: false });
      else candidatesStore.set({ loading: false });
    });

  supabase
    .channel("candidates-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "candidates" }, (payload) => {
      candidatesStore.set((s) => {
        let candidates = s.candidates;
        if (payload.eventType === "INSERT") {
          candidates = [...candidates, payload.new];
        } else if (payload.eventType === "UPDATE") {
          candidates = candidates.map((c) => (c.id === payload.new.id ? payload.new : c));
        } else if (payload.eventType === "DELETE") {
          candidates = candidates.filter((c) => c.id !== payload.old.id);
        }
        return { ...s, candidates };
      });
    })
    .subscribe();

  supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single()
    .then(({ data, error }) => {
      if (!error && data) settingsStore.set({ settings: data });
    });

  supabase
    .channel("settings-realtime")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings" }, (payload) => {
      settingsStore.set({ settings: payload.new });
    })
    .subscribe();
}
