// iConcierge frontend: sign-in, setup wizard, chat with the Captain, the live office, to-dos, documents, profile.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const root = $("#root");

const SPECIALISTS = ["attorney", "accountant", "investor", "housing", "benefits", "assistant"];
const PING_COLORS = { assign: "#d9a441", tool: "#3b6fd8", memo: "#2e8b57", note: "#e07a1f", handoff: "#7b4bd1" };
const STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
const INCOMES = [["<25k", "< $25k"], ["25-50k", "$25k–$50k"], ["50-75k", "$50k–$75k"], ["75-100k", "$75k–$100k"],
  ["100-150k", "$100k–$150k"], ["150-200k", "$150k–$200k"], [">200k", "> $200k"]];
const AGES = ["18–24", "25–34", "35–44", "45–54", "55–64", "65+"];
const GOALS = ["home", "taxes", "debt", "save", "invest", "insurance", "benefits", "legal", "move", "retire", "college"];
const STYLES = ["warm", "professional", "upbeat", "straight"];
const MODES = ["family", "young_adult", "general"];
const LEVELS = ["eli5", "beginner", "intermediate", "advanced", "professional"];

function levelSelect(current, id) {
  return `<select id="${id}" class="level-select" aria-label="${esc(t("level_label"))}">${LEVELS.map(l =>
    `<option value="${l}" ${(current || "beginner") === l ? "selected" : ""}>${esc(t("lvl_" + l))}</option>`).join("")}</select>`;
}

const state = {
  me: null, roster: {}, todos: [], docs: [], drafts: [], attached: [], busy: false, tab: "daily", daily: null, dailyShown: false,
  lastEvents: [], lastDrafts: [],
  desk: {}, // id -> idle | thinking | working | done
};

// ---------- helpers ----------
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function api(path, opts = {}) {
  let res;
  try {
    res = await fetch(path, {
      method: opts.method || "GET", credentials: "same-origin",
      headers: opts.body ? { "Content-Type": "application/json" } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch { throw new Error("network"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "generic");
  return data;
}

function errText(code) {
  if (code && code.startsWith("No API key")) return t("err_no_key");
  const key = "err_" + code;
  return I18N.en[key] ? t(key) : t("err_generic");
}

function personName(id) {
  if (id === "captain") return state.me?.settings.captain_name || "Captain";
  return state.roster[id]?.name || id;
}

function avatarFor(id) {
  return id === "captain" ? (state.me?.settings.captain_avatar || "captain_a") : id;
}

function avatarHTML(id, size = "", extraClass = "") {
  return `<div class="avatar ${size} ${extraClass}" data-avatar="${esc(id)}">${avatarSVG(avatarFor(id))}</div>`;
}

function langSelect(cls = "lang-select") {
  return `<select class="${cls}" aria-label="${esc(t("language"))}">${Object.entries(LANGS).map(([k, v]) =>
    `<option value="${k}" ${k === LANG ? "selected" : ""}>${v}</option>`).join("")}</select>`;
}

// Safe Markdown subset: escape first, then headings, bullets, bold and [source-id] citations.
function renderMarkdown(text, sources = []) {
  const known = new Map(sources.map(s => [s.id, s]));
  const lines = esc(text).split(/\r?\n/);
  let html = "", inList = false;
  const byUrl = new Map(sources.map(s => [s.url.replace(/\/$/, ""), s]));
  const inline = s => s
    .replace(/\[([^\]]+)\]\(\[link removed\]\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
      const src = byUrl.get(url.replace(/&amp;/g, "&").replace(/\/$/, ""));
      return src ? `<a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
    })
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([a-z0-9-]+)\]/g, (m, id) => {
      const src = known.get(id);
      return src ? `<a class="cite" href="${esc(src.url)}" target="_blank" rel="noopener noreferrer" title="${esc(src.title)}">${esc(src.agency)}</a>` : "";
    });
  for (const raw of lines) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)/);
    if (bullet) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${inline(bullet[1])}</li>`;
      continue;
    }
    if (inList) { html += "</ul>"; inList = false; }
    if (!line) continue;
    const h = line.match(/^(#{1,4})\s+(.*)/);
    html += h ? `<h4>${inline(h[2])}</h4>` : `<p>${inline(line)}</p>`;
  }
  if (inList) html += "</ul>";
  return html;
}

// ---------- boot ----------
async function boot() {
  setLang(localStorage.getItem("ic_lang") || (navigator.language || "en").slice(0, 2));
  try {
    const roster = await api("/api/roster");
    state.roster = roster.specialists;
    PORTRAITS = roster.portraits || {};
  } catch { /* shown later */ }
  try {
    state.me = await api("/api/me");
    setLang(state.me.settings.language);
    showApp();
  } catch {
    showAuth("signin");
  }
}

// ---------- sign in / sign up ----------
// The team-around-the-table video behind the sign-in and setup screens.
function pageVideo() {
  return `<video class="page-video" src="/static/media/office_orbit.mp4" poster="/static/media/office_orbit_poster.jpg"
    autoplay muted loop playsinline aria-hidden="true"></video><div class="page-video-shade" aria-hidden="true"></div>`;
}

function playPageVideo() {
  const v = $(".page-video");
  if (v && !matchMedia("(prefers-reduced-motion: reduce)").matches) v.play().catch(() => {});
}

function showAuth(mode) {
  const team = ["captain_a", ...SPECIALISTS].map(id => `<div class="avatar">${avatarSVG(id)}</div>`).join("");
  root.innerHTML = `
  ${pageVideo()}
  <div class="auth-wrap"><div class="auth-card">
    <div class="auth-hero">
      <div class="brand">iConcierge</div>
      <div class="brand-sub">${esc(t("subtitle"))}</div>
      <p>${esc(t("tagline"))}</p>
      <div class="team-row">${team}</div>
    </div>
    <div class="auth-form">
      <div class="topbar-lang">${langSelect()}</div>
      <div class="tabs"><button data-mode="signin" class="${mode === "signin" ? "on" : ""}">${esc(t("signin"))}</button>
        <button data-mode="signup" class="${mode === "signup" ? "on" : ""}">${esc(t("signup"))}</button></div>
      <form id="auth-form" autocomplete="on">
        <div class="field"><label for="handle">${esc(t("handle"))}</label>
          <input id="handle" name="username" autocomplete="username" required maxlength="32" value="${esc(sessionStorage.getItem("ic_handle") || "")}">
          ${mode === "signup" ? `<small>${esc(t("handle_hint"))}</small>` : ""}</div>
        <div class="field"><label for="passcode">${esc(t("passcode"))}</label>
          <input id="passcode" type="password" autocomplete="${mode === "signup" ? "new-password" : "current-password"}" required></div>
        ${mode === "signup" ? `<div class="field"><label for="passcode2">${esc(t("passcode_confirm"))}</label>
          <input id="passcode2" type="password" autocomplete="new-password" required></div>` : ""}
        <div class="error" id="auth-error"></div>
        <button class="btn gold" type="submit">${esc(mode === "signup" ? t("next") : t("signin"))}</button>
      </form>
    </div>
  </div></div>`;
  playPageVideo();
  $(".lang-select").onchange = e => { setLang(e.target.value); showAuth(mode); };
  $$(".tabs button").forEach(b => b.onclick = () => showAuth(b.dataset.mode));
  $("#auth-form").onsubmit = async e => {
    e.preventDefault();
    const handle = $("#handle").value.trim().toLowerCase();
    const passcode = $("#passcode").value;
    const err = $("#auth-error");
    if (mode === "signup") {
      if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(handle)) return err.textContent = t("err_bad_handle");
      if (passcode.length < 6) return err.textContent = t("err_short_passcode");
      if (passcode !== $("#passcode2").value) return err.textContent = t("err_mismatch");
      showWizard({ handle, passcode, settings: { language: LANG, help_mode: "family", captain_style: "warm", captain_avatar: "captain_a", captain_name: "", explain_level: "beginner" }, profile: {} }, 1);
      return;
    }
    try {
      state.me = await api("/api/signin", { method: "POST", body: { handle, passcode } });
      setLang(state.me.settings.language);
      showApp();
    } catch (ex) { err.textContent = errText(ex.message); }
  };
}

// ---------- setup wizard ----------
function profileFields(p = {}) {
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${String(cur ?? "") === String(v) ? "selected" : ""}>${esc(label)}</option>`;
  const goals = new Set(p.goals || []);
  return `
  <div class="row">
    <div class="field"><label>${esc(t("state"))}</label><select name="state">${opt("", t("choose"), p.state)}${STATES.map(s => opt(s, s, p.state)).join("")}</select></div>
    <div class="field"><label>${esc(t("adults"))}</label><input name="adults" type="number" min="0" max="20" value="${esc(p.adults ?? 1)}"></div>
    <div class="field"><label>${esc(t("children"))}</label><input name="children" type="number" min="0" max="20" value="${esc(p.children ?? 0)}"></div>
  </div>
  <div class="row">
    <div class="field"><label>${esc(t("age_range"))}</label><select name="age_range">${opt("", t("choose"), p.age_range)}${AGES.map(a => opt(a, a, p.age_range)).join("")}</select></div>
    <div class="field"><label>${esc(t("income_range"))}</label><select name="income_range">${opt("", t("choose"), p.income_range)}${INCOMES.map(([v, l]) => opt(v, l, p.income_range)).join("")}${opt("prefer_not", t("prefer_not"), p.income_range)}</select></div>
  </div>
  <div class="row">
    <div class="field"><label>${esc(t("employment"))}</label><select name="employment">${opt("", t("choose"), p.employment)}${["employed", "self", "student", "unemployed", "retired"].map(v => opt(v, t("emp_" + v), p.employment)).join("")}</select></div>
    <div class="field"><label>${esc(t("housing"))}</label><select name="housing">${opt("", t("choose"), p.housing)}${["rent", "own", "family", "other"].map(v => opt(v, t("housing_" + v), p.housing)).join("")}</select></div>
  </div>
  <div class="field"><label>${esc(t("goals"))}</label><div class="chips">${GOALS.map(g =>
    `<button type="button" class="chip ${goals.has(g) ? "on" : ""}" data-goal="${g}">${esc(t("goal_" + g))}</button>`).join("")}</div></div>
  <div class="field"><label>${esc(t("notes"))}</label><textarea name="notes" rows="2" maxlength="500" placeholder="${esc(t("notes_ph"))}">${esc(p.notes || "")}</textarea></div>
  <div class="note">🔒 ${esc(t("privacy_note"))}</div>`;
}

function wireGoalChips(scope) {
  $$("[data-goal]", scope).forEach(c => c.onclick = () => c.classList.toggle("on"));
}

function readProfile(scope) {
  const val = n => $(`[name="${n}"]`, scope)?.value ?? "";
  const p = { state: val("state"), adults: Number(val("adults") || 0), children: Number(val("children") || 0),
    age_range: val("age_range"), income_range: val("income_range"), employment: val("employment"),
    housing: val("housing"), notes: val("notes"), goals: $$("[data-goal].on", scope).map(c => c.dataset.goal) };
  Object.keys(p).forEach(k => (p[k] === "" ? delete p[k] : null));
  return p;
}

function showWizard(draft, step) {
  const s = draft.settings;
  const titles = { 1: "step_help", 2: "step_captain", 3: "step_profile" };
  let body = "";
  if (step === 1) {
    body = `<div class="choice-grid">${MODES.map(m => `<button type="button" class="choice ${s.help_mode === m ? "on" : ""}" data-mode="${m}">
      <strong>${esc(t("help_" + m))}</strong><span>${esc(t("help_" + m + "_d"))}</span></button>`).join("")}</div>
      <div class="row"><div class="field"><label>${esc(t("language"))}</label>${langSelect("lang-select wiz-lang")}</div>
      <div class="field"><label for="wlevel">${esc(t("level_label"))}</label>${levelSelect(s.explain_level, "wlevel")}</div></div>`;
  } else if (step === 2) {
    body = `<div class="field"><label>${esc(t("captain_look"))}</label><div class="look-grid">${captainChoices().map(a =>
      `<button type="button" class="look ${s.captain_avatar === a ? "on" : ""}" data-look="${a}"><div class="avatar">${avatarSVG(a)}</div></button>`).join("")}</div></div>
      <div class="field"><label for="cname">${esc(t("captain_name"))}</label><input id="cname" maxlength="30" placeholder="${esc(t("captain_name_ph"))}" value="${esc(s.captain_name)}"></div>
      <div class="field"><label>${esc(t("captain_style"))}</label><div class="choice-grid">${STYLES.map(st =>
      `<button type="button" class="choice ${s.captain_style === st ? "on" : ""}" data-style="${st}"><strong>${esc(t("style_" + st))}</strong><span>${esc(t("style_" + st + "_d"))}</span></button>`).join("")}</div></div>`;
  } else {
    body = `<div id="profile-scope">${profileFields(draft.profile)}</div>`;
  }
  root.innerHTML = `${pageVideo()}<div class="auth-wrap"><div class="wizard">
    <div class="steps">${[1, 2, 3].map(i => `<div class="${i <= step ? "on" : ""}"></div>`).join("")}</div>
    <h2>${esc(t(titles[step]))}</h2>${body}
    <div class="error" id="wiz-error"></div>
    <div class="wizard-nav"><button class="btn ghost" id="wiz-back">${esc(t("back"))}</button>
      <button class="btn gold" id="wiz-next">${esc(step === 3 ? t("finish") : t("next"))}</button></div>
  </div></div>`;
  playPageVideo();
  $$("[data-mode]").forEach(b => b.onclick = () => { s.help_mode = b.dataset.mode; showWizard(draft, step); });
  $$("[data-look]").forEach(b => b.onclick = () => { s.captain_name = $("#cname").value; s.captain_avatar = b.dataset.look; showWizard(draft, step); });
  $$("[data-style]").forEach(b => b.onclick = () => { s.captain_name = $("#cname").value; s.captain_style = b.dataset.style; showWizard(draft, step); });
  const wlevel = $("#wlevel");
  if (wlevel) wlevel.onchange = e => { s.explain_level = e.target.value; };
  const wl = $(".wiz-lang");
  if (wl) wl.onchange = e => { setLang(e.target.value); s.language = LANG; showWizard(draft, step); };
  if (step === 3) wireGoalChips($("#profile-scope"));
  $("#wiz-back").onclick = () => (step === 1 ? showAuth("signup") : showWizard(draft, step - 1));
  $("#wiz-next").onclick = async () => {
    if (step === 2) s.captain_name = $("#cname").value.trim();
    if (step < 3) return showWizard(draft, step + 1);
    draft.profile = readProfile($("#profile-scope"));
    s.language = LANG;
    try {
      state.me = await api("/api/signup", { method: "POST", body: draft });
      sessionStorage.setItem("ic_handle", draft.handle);
      showApp();
    } catch (ex) {
      if (["bad_handle", "short_passcode", "handle_taken"].includes(ex.message)) { showAuth("signup"); $("#auth-error").textContent = errText(ex.message); }
      else $("#wiz-error").textContent = errText(ex.message);
    }
  };
}

// ---------- main app ----------
async function showApp() {
  const me = state.me;
  root.innerHTML = `
  <div class="app">
    <header class="topbar">
      <div class="brand">iConcierge<small class="brand-sub">${esc(t("subtitle"))}</small></div>
      ${langSelect()}
      <span class="who">👪 ${esc(me.handle)}</span>
      <button class="btn ghost small" id="signout">${esc(t("signout"))}</button>
    </header>
    <div class="main">
      <section class="panel stage" aria-label="${esc(t("tab_office"))}">
        <video class="stage-video" src="/static/media/team_meeting.mp4" poster="/static/media/team_meeting_poster.jpg"
          muted loop playsinline preload="none" aria-hidden="true"></video>
        <div class="stage-head"><h2>${esc(t("tab_office"))}</h2>
          <div class="rt-tools"><div class="legend">${["assign", "tool", "memo", "note", "handoff"].map(k =>
            `<span><i style="background:${PING_COLORS[k]}"></i>${esc(t("lg_" + k))}</span>`).join("")}</div>
          <button id="replay" disabled>${esc(t("replay"))}</button></div></div>
        <div id="rt" class="stage-table"></div>
        <aside class="spend" aria-live="off">
          <div class="spend-label">${esc(t("spend_title"))}</div>
          <div class="spend-total">$0</div>
          <div class="spend-tube" role="meter" aria-valuemin="0"><div class="spend-fill"></div><div class="spend-cap"></div></div>
          <div class="spend-capnote"></div>
          <div class="spend-tokens"></div>
        </aside>
      </section>
      <section class="panel chat-window">
        <div class="chat-head">${avatarHTML("captain", "", "captain-face")}
          <div><h2>${esc(personName("captain"))} <span class="online" aria-hidden="true"></span></h2><small>${esc(t("role_captain"))} · ${esc(t("style_" + me.settings.captain_style))}</small></div>
          <label class="level-pick" title="${esc(t("level_label"))}"><span>🎓 ${esc(t("level_label"))}</span>${levelSelect(me.settings.explain_level, "level")}</label></div>
        <div class="chat-log" id="chat"></div>
        <div class="composer">
          <div class="attached" id="attached"></div>
          <div class="composer-row">
            <button class="btn ghost small" id="attach-btn" title="${esc(t("attach"))}">📎</button>
            <textarea id="ask" rows="1" maxlength="2000" placeholder="${esc(t("ask_ph"))}"></textarea>
            <button class="btn gold" id="send">${esc(t("send"))}</button>
          </div>
          <div class="disclaimer">${esc(t("disclaimer"))}</div>
        </div>
      </section>
      <section class="panel side-panel">
        <nav class="side-tabs">${["daily", "office", "todos", "docs", "drafts", "safety", "profile"].map(k =>
          `<button data-tab="${k}" class="${state.tab === k ? "on" : ""}">${esc(t(k === "office" ? "tab_activity" : "tab_" + k))}</button>`).join("")}</nav>
        <div class="side-body" id="side"></div>
      </section>
    </div>
  </div>`;
  $(".lang-select").onchange = async e => {
    setLang(e.target.value);
    state.me = await api("/api/me", { method: "PUT", body: { settings: { language: LANG } } });
    showApp();
  };
  $("#signout").onclick = async () => { await api("/api/signout", { method: "POST" }).catch(() => {}); state.me = null; showAuth("signin"); };
  $$(".side-tabs button").forEach(b => b.onclick = () => switchTab(b.dataset.tab));
  const ask = $("#ask");
  ask.addEventListener("input", () => { ask.style.height = "auto"; ask.style.height = Math.min(ask.scrollHeight, 160) + "px"; });
  ask.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
  $("#send").onclick = send;
  $("#level").onchange = async e => {
    state.me = await api("/api/me", { method: "PUT", body: { settings: { explain_level: e.target.value } } }).catch(() => state.me);
    if (state.daily?.key !== dailyKey()) loadDaily();
  };
  $("#attach-btn").onclick = () => { state.tab = "docs"; $$(".side-tabs button").forEach(x => x.classList.toggle("on", x.dataset.tab === "docs")); renderSide(); };
  SPECIALISTS.concat("captain").forEach(id => state.desk[id] = state.desk[id] || "idle");
  await Promise.all([loadChat(), loadTodos(), loadDocs(), loadDrafts()]);
  // Keep the last run's events so the round table can replay it after a reload.
  const runIds = [...new Set((await api("/api/messages").catch(() => ({ messages: [] }))).messages
    .filter(m => m.run_id).map(m => m.run_id))].reverse().slice(0, 4);
  for (const id of runIds) {      // the newest run that finished (an interrupted run has no events)
    const events = (await api(`/api/runs/${id}`).catch(() => ({ events: [] }))).events;
    if (events.some(e => e.type === "done")) { state.lastEvents = events; break; }
  }
  RoundTable.render($("#rt"), ["captain", ...SPECIALISTS], {
    avatar: id => avatarHTML(id), name: id => esc(personName(id)), role: id => esc(t("role_" + id)), status: s => esc(t("status_" + s)) });
  ["captain", ...SPECIALISTS].forEach(id => RoundTable.setStatus(id, state.desk[id] || "idle", t("status_" + (state.desk[id] || "idle"))));
  $("#replay").onclick = replay;
  $("#replay").disabled = !(state.lastEvents || []).length;
  renderSide();
  renderAttached();
  // A new language or explanation level gets its own Daily Update (the server caches each one for the day).
  if (!state.daily || state.daily.error || state.daily.key !== dailyKey()) loadDaily();
}

// ---------- Daily Update: one idea from each team member, made once a day ----------
function dailyKey() { return LANG + "/" + (state.me?.settings.explain_level || "beginner"); }

async function loadDaily() {
  const key = dailyKey();
  state.daily = { loading: true, key };
  if (state.tab === "daily") renderSide();
  try {
    state.daily = { ...(await api("/api/daily")), key };
  } catch (e) {
    state.daily = { error: true, key };
  }
  if (state.tab === "daily") renderSide();
  if (state.daily.tips && !state.dailyShown && !state.busy) announceDaily();
}

function announceDaily() {          // each seat says its headline once, one after another
  if (!RoundTable.ready) return;
  state.dailyShown = true;
  state.daily.tips.forEach((tip, i) => setTimeout(() => {
    if (state.busy) return;
    talk(tip.member, 1800);
    RoundTable.bubble(tip.member, "💡 " + String(tip.title || "").trim(), 3600);
  }, 700 + i * 1100));
}

function dailyHTML() {
  const d = state.daily;
  if (!d || d.loading) return `<div class="feed-empty daily-loading">${avatarHTML("captain", "sm", "is-thinking")}<span>${esc(t("daily_loading"))}</span></div>`;
  if (d.error || !(d.tips || []).length) return `<div class="feed-empty">${esc(t("daily_error"))}<br><button class="btn small ghost" id="daily-retry">${esc(t("daily_retry"))}</button></div>`;
  const day = new Date(d.day + "T12:00:00").toLocaleDateString(LANG, { weekday: "long", month: "long", day: "numeric" });
  return `<div class="daily-head"><h3>☀️ ${esc(t("daily_title"))}</h3><small>${esc(day)}</small><p>${esc(t("daily_intro"))}</p></div>
    ${d.tips.map((tip, i) => `<article class="daily-tip">
      ${avatarHTML(tip.member, "sm")}
      <div class="grow"><div class="who">${esc(personName(tip.member))} <small>· ${esc(t("role_" + tip.member))}</small></div>
        <h4>${esc(tip.title)}</h4><p>${esc(tip.tip)}</p>
        <div class="daily-foot">${tip.source ? `<a href="${esc(tip.source.url)}" target="_blank" rel="noopener noreferrer">${esc(t("daily_source"))}: ${esc(tip.source.title)}</a>` : ""}
          <button class="btn small ghost" data-daily-ask="${i}">💬 ${esc(t("daily_ask"))}</button></div></div>
    </article>`).join("")}
    <div class="daily-cost">${esc(t("daily_cost", { cost: fmtUsd(d.cost) }))}</div>`;
}

async function loadChat() {
  const chat = $("#chat");
  const { messages } = await api("/api/messages").catch(() => ({ messages: [] }));
  chat.innerHTML = "";
  for (const m of messages) {
    if (m.role === "family") chat.insertAdjacentHTML("beforeend", familyBubble(m.content));
    else chat.insertAdjacentHTML("beforeend", captainBubble(renderMarkdown(m.content)));
  }
  // Every visit opens with the Captain asking what the family wants help with.
  const greeting = messages.length ? "" : `<p>${esc(t("hello", { name: personName("captain") }))}</p>`;
  chat.insertAdjacentHTML("beforeend", captainBubble(`${greeting}<div class="samples welcome">
    <p class="welcome-q">${esc(t("welcome_q"))}</p>
    <div class="topics">${TOPICS.map(tp => `<button type="button" class="topic" data-topic="${tp.id}">
      <span class="topic-icon" aria-hidden="true">${tp.icon}</span>${esc(t("t_" + tp.id))}</button>`).join("")}</div>
    <div class="topic-prompts" aria-live="polite"></div>
    <p class="stats">${esc(t("welcome_hint"))}</p></div>`));
  $$("[data-topic]", chat).forEach(b => b.onclick = () => {
    $$("[data-topic]", chat).forEach(x => x.classList.toggle("on", x === b));
    const box = $(".topic-prompts", chat);
    box.innerHTML = [1, 2].map(i => `<button type="button" class="topic-prompt">${esc(t(`p_${b.dataset.topic}_${i}`))}</button>`).join("");
    $$(".topic-prompt", box).forEach(p => p.onclick = () => {
      const ask = $("#ask");
      ask.value = p.textContent;               // the family can edit the numbers before sending
      ask.dispatchEvent(new Event("input"));
      ask.focus();
    });
  });
  chat.scrollTop = chat.scrollHeight;
}

function familyBubble(text) {
  return `<div class="msg family"><div class="bubble">${esc(text).replace(/\n/g, "<br>")}</div></div>`;
}

function captainBubble(inner) {
  return `<div class="msg captain">${avatarHTML("captain", "sm")}<div class="bubble">${inner}</div></div>`;
}

// ---------- asking the team ----------
async function send() {
  const box = $("#ask");
  const question = box.value.trim();
  if (!question || state.busy) return;
  state.busy = true;
  stageLive(true);
  $("#send").disabled = true;
  box.value = ""; box.style.height = "auto";
  const chat = $("#chat");
  // Remove the welcome topics; drop the Captain bubble too if nothing else was in it.
  $$(".samples", chat).forEach(el => { const msg = el.closest(".msg"); el.remove(); if (msg && !$(".bubble", msg).textContent.trim()) msg.remove(); });
  chat.insertAdjacentHTML("beforeend", familyBubble(question));
  const pending = document.createElement("div");
  pending.className = "msg captain";
  pending.innerHTML = `${avatarHTML("captain", "sm", "is-thinking")}<div class="bubble"><em>…</em></div>`;
  chat.appendChild(pending);
  chat.scrollTop = chat.scrollHeight;
  state.feed = [];
  state.planned = false;
  state.lastEvents = [];
  state.lastDrafts = [];
  SPECIALISTS.concat("captain").forEach(id => state.desk[id] = "idle");
  state.tab = "office";
  $$(".side-tabs button").forEach(x => x.classList.toggle("on", x.dataset.tab === "office"));
  renderSide();

  const docIds = state.attached.slice();
  state.attached = []; renderAttached();
  let summary = null, totals = null;
  try {
    const res = await fetch("/api/ask", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, document_ids: docIds }) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "generic");
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        const ev = JSON.parse(line);
        if (ev.type === "plan" && ev.ack) $(".bubble", pending).innerHTML = `<em>${esc(ev.ack)}</em>`;
        if (ev.type === "captain_summary") summary = ev;
        if (ev.type === "done") totals = ev.totals;
        state.lastEvents.push(ev);
        onEvent(ev);
      }
    }
  } catch (ex) {
    pushFeed({ cls: "error", who: "captain", html: esc(errText(ex.message)) });
  }
  pending.remove();
  if (summary) {
    const todos = (state.lastTodos || []).map(td => `<div>☐ ${esc(td.title)}</div>`).join("");
    const draftChip = (state.lastDrafts || []).length ? `<div class="todo-chips"><div><a href="#" class="open-drafts">✉️ ${esc(t("tab_drafts"))}: ${state.lastDrafts.map(d => esc(d.subject || d.to)).join(" · ")}</a></div><div class="stats">${esc(t("drafts_intro"))}</div></div>` : "";
    const sources = summary.sources.length ? `<div class="sources"><strong>${esc(t("sources"))}</strong>${summary.sources.map(s =>
      `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} · ${esc(s.agency)}</a>`).join("")}</div>` : "";
    const checks = state.lastChecks || [];
    const caught = checks.filter(c => c.status === "caught").length, warn = checks.filter(c => c.status === "warn").length;
    const shield = checks.length ? `<details class="checks"><summary>${esc(t("safety_footer", { n: checks.length, caught, warn }))}</summary>
      <ul>${checks.map(c => `<li class="st-${c.status}">${c.status === "ok" ? "✓" : c.status === "caught" ? "🛡️" : "⚠️"} ${esc(t("c_" + c.check))} · ${esc(t("st_" + c.status))}</li>`).join("")}</ul></details>` : "";
    const stats = (totals ? `<div class="stats">${esc(t("stats", { calls: totals.calls, cost: totals.cost.toFixed(4), seconds: Math.round(totals.seconds) }))}</div>` : "") + shield;
    chat.insertAdjacentHTML("beforeend", captainBubble(renderMarkdown(summary.answer, summary.sources) + sources +
      (todos ? `<div class="todo-chips"><strong>${esc(t("todos_added"))}</strong>${todos}</div>` : "") + draftChip + stats));
    const last = chat.lastElementChild;
    $(".open-drafts", last)?.addEventListener("click", e => { e.preventDefault(); switchTab("drafts"); });
    $(".avatar", last).classList.add("is-talking");
    setTimeout(() => $(".avatar", last)?.classList.remove("is-talking"), 2400);
  } else {
    chat.insertAdjacentHTML("beforeend", captainBubble(`<p>${esc(t("err_generic"))}</p>`));
  }
  state.lastTodos = [];
  state.lastChecks = [];
  chat.scrollTop = chat.scrollHeight;
  state.busy = false;
  stageLive(false);
  $("#send").disabled = false;
  if ($("#replay")) $("#replay").disabled = !(state.lastEvents || []).length;
  setDesk("captain", "idle");
}

function setDesk(id, status) {
  state.desk[id] = status;
  if (RoundTable.ready) RoundTable.setStatus(id, status, t("status_" + status));
  if (id === "captain") $(".captain-face")?.classList.toggle("is-thinking", status === "thinking");
}

function talk(id, ms = 1600) {
  if (RoundTable.ready) RoundTable.talk(id, ms);
}

function switchTab(tab) {
  state.tab = tab;
  $$(".side-tabs button").forEach(x => x.classList.toggle("on", x.dataset.tab === tab));
  renderSide();
}

// ---------- live spend meter (Lecture 11 style) ----------
const meter = { total: 0, shown: 0, cap: 0.01, perAgent: {}, calls: 0, tin: 0, tcached: 0, tout: 0, raf: 0 };

function fmtUsd(v) {
  const x = Number(v || 0);
  if (x === 0) return "$0";
  if (x < 0.01) return "$" + x.toFixed(5);
  if (x < 1) return "$" + x.toFixed(4);
  return "$" + x.toFixed(2);
}

function drawMeter() {
  const total = $(".spend-total"), fill = $(".spend-fill");
  if (!total || !fill) return;
  // Count up smoothly from the shown value to the real total.
  cancelAnimationFrame(meter.raf);
  const from = meter.shown, to = meter.total, start = performance.now();
  const step = now => {
    const k = Math.min(1, (now - start) / 600);
    meter.shown = from + (to - from) * (1 - Math.pow(1 - k, 3));
    total.textContent = fmtUsd(meter.shown);
    const pct = meter.shown > 0 ? Math.max(3, Math.min(100, meter.shown / meter.cap * 100)) : 0;
    fill.style.height = pct + "%";
    if (k < 1) meter.raf = requestAnimationFrame(step);
  };
  if (document.hidden) step(start + 600);   // animation frames pause in hidden tabs: jump straight to the value
  else meter.raf = requestAnimationFrame(step);
  $(".spend")?.classList.toggle("hot", meter.total / meter.cap > 0.75);
  $(".spend-capnote").textContent = t("spend_cap", { cap: fmtUsd(meter.cap), calls: meter.calls });
  $(".spend-tokens").innerHTML = `${meter.tin.toLocaleString()} ${esc(t("tok_in"))}<br>${meter.tcached.toLocaleString()} ${esc(t("tok_cached"))}<br>${meter.tout.toLocaleString()} ${esc(t("tok_out"))}`;
}

function meterEvent(ev) {
  if (ev.type === "run_started") {
    Object.assign(meter, { total: 0, shown: 0, perAgent: {}, calls: 0, tin: 0, tcached: 0, tout: 0 });
    if (ev.budget) meter.cap = ev.budget;
    ["captain", ...SPECIALISTS].forEach(id => RoundTable.cost(id, ""));
    drawMeter();
  } else if (ev.type === "usage") {
    meter.calls += 1;
    meter.tin += ev.prompt_tokens; meter.tcached += ev.cached_tokens; meter.tout += ev.completion_tokens;
    meter.total = ev.run_cost != null ? ev.run_cost : meter.total + ev.cost;
    const who = ev.agent in state.roster || ev.agent === "captain" ? ev.agent : null;
    if (who) {
      meter.perAgent[who] = (meter.perAgent[who] || 0) + ev.cost;
      RoundTable.cost(who, fmtUsd(meter.perAgent[who]));
    }
    drawMeter();
  } else if (ev.type === "done" && ev.totals) {
    meter.total = ev.totals.cost;
    drawMeter();
  }
}

// Everything the round table shows for one event. Used live and for Replay.
function animate(ev) {
  if (!RoundTable.ready) return;
  meterEvent(ev);
  const short = s => String(s || "").replace(/\s+/g, " ").trim();
  switch (ev.type) {
    case "run_started":
      ["captain", ...SPECIALISTS].forEach(id => setDesk(id, "idle"));
      RoundTable.bench(null);
      break;
    case "captain_thinking": setDesk("captain", "thinking"); break;
    case "plan":
      setDesk("captain", "idle"); talk("captain");
      RoundTable.bench(ev.assignments.map(a => a.specialist));
      if (ev.ack) RoundTable.bubble("captain", short(ev.ack));
      break;
    case "assign": RoundTable.ping("captain", ev.to, "assign"); break;
    case "specialist_thinking": setDesk(ev.specialist, "thinking"); break;
    case "tool_call":
      setDesk(ev.specialist, "working");
      RoundTable.ping(ev.specialist, "table", "tool", { duration: 650 });
      break;
    case "tool_result":
      RoundTable.ping(ev.specialist, "table", "tool", { back: true, duration: 650 });
      RoundTable.centerNote(`${personName(ev.specialist)} · ${t("tool_" + ev.tool)}: ${short(ev.summary)}`);
      break;
    case "memo":
      setDesk(ev.specialist, "done"); talk(ev.specialist);
      RoundTable.ping(ev.specialist, "captain", "memo");
      RoundTable.bubble(ev.specialist, short(ev.memo));
      break;
    case "huddle_note":
      talk(ev.from);
      RoundTable.ping(ev.from, ev.to, "note", { duration: 1100 });
      RoundTable.bubble(ev.from, `→ ${personName(ev.to)}: ${short(ev.note)}`, 5000);
      break;
    case "handoff":
      setDesk("assistant", "thinking");
      (ev.from.length ? ev.from : ["captain"]).forEach(f => RoundTable.ping(f, "assistant", "handoff", { duration: 1000 }));
      break;
    case "draft":
      talk("assistant");
      RoundTable.ping("assistant", "captain", "handoff");
      RoundTable.bubble("assistant", `✉️ ${short(ev.draft.subject || ev.draft.to)}`);
      break;
    case "captain_summary": setDesk("captain", "idle"); talk("captain", 2400); break;
    case "error": if (ev.specialist) setDesk(ev.specialist, "idle"); break;
  }
}

// While the team is working, the meeting video fades in behind the round table (not for reduced-motion users).
function stageLive(on) {
  const stage = $(".stage"), video = $(".stage-video");
  if (!stage || !video) return;
  if (on && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    clearTimeout(stage._off);
    stage.classList.add("live");
    video.play().catch(() => {});
  } else if (!on) {
    stage._off = setTimeout(() => { stage.classList.remove("live"); setTimeout(() => video.pause(), 900); }, 1200);
  }
}

async function replay() {
  const events = state.lastEvents || [];
  if (!events.length || state.busy) return;
  let prev = 0;
  stageLive(true);
  for (const ev of events) {
    if (!RoundTable.ready) break;
    const gap = Math.min(1200, Math.max(0, (ev.t - prev) * 1000 / 2));
    prev = ev.t;
    if (gap) await new Promise(r => setTimeout(r, gap));
    animate(ev);
  }
  if (!state.busy) stageLive(false);
}

function pushFeed(item) {
  state.feed = state.feed || [];
  state.feed.push(item);
  if (state.tab !== "office") return;
  const feed = $("#feed");
  if (!feed) return;
  $(".feed-empty", feed)?.remove();
  feed.insertAdjacentHTML("beforeend", feedItemHTML(item));
  const side = $("#side");
  side.scrollTop = side.scrollHeight;
}

function feedItemHTML(it) {
  const face = it.who === "shield" ? `<div class="avatar sm shield" aria-hidden="true">🛡️</div>` : avatarHTML(it.who, "sm");
  return `<div class="ev ${it.cls || ""}" ${it.key ? `data-key="${esc(it.key)}"` : ""}>${face}
    <div class="body">${it.html}</div></div>`;
}

function fmtArgs(args) {
  const parts = Object.entries(args || {}).slice(0, 4).map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "number" ? v.toLocaleString() : String(v).slice(0, 60)}`);
  return parts.join(" · ");
}

function onEvent(ev) {
  const cap = personName("captain");
  animate(ev);
  switch (ev.type) {
    case "captain_thinking":
      pushFeed({ who: "captain", html: `<em>${esc(t(state.planned ? "ev_summary" : "ev_plan", { captain: cap }))}…</em>` });
      break;
    case "plan":
      state.planned = true;
      if (ev.ack) pushFeed({ who: "captain", html: `<span class="who">${esc(cap)}</span>: ${esc(ev.ack)}` });
      break;
    case "assign":
      pushFeed({ cls: "note", who: "captain", html: `<span class="who">${esc(t("ev_assign", { captain: cap, to: personName(ev.to) }))}</span><br>${esc(ev.task)}` });
      break;
    case "tool_call": {
      const key = `${ev.specialist}-${state.feed.length}`;
      state.lastToolKey = state.lastToolKey || {};
      state.lastToolKey[ev.specialist] = key;
      pushFeed({ cls: "tool", key, who: ev.specialist, html: `<span class="who">${esc(personName(ev.specialist))}</span> ${esc(t("ev_tool", { tool: t("tool_" + ev.tool) }))}<br>${esc(fmtArgs(ev.arguments))}` });
      break;
    }
    case "tool_result": {
      const key = state.lastToolKey?.[ev.specialist];
      const item = state.feed.find(f => f.key === key);
      const add = `<div class="result">→ ${esc(ev.summary)}</div>`;
      if (item) item.html += add;
      const el = key && $(`.ev[data-key="${CSS.escape(key)}"] .body`);
      if (el) el.insertAdjacentHTML("beforeend", add);
      break;
    }
    case "memo": {
      const nums = (ev.key_numbers || []).map(n => `<li>${esc(n.label)}: <strong>${esc(n.value)}</strong></li>`).join("");
      pushFeed({ cls: "memo", who: ev.specialist, html: `<details><summary><span class="who">${esc(personName(ev.specialist))}</span> ${esc(t("ev_memo", { captain: cap }))}</summary>
        <p>${esc(ev.memo)}</p>${nums ? `<ul>${nums}</ul>` : ""}${ev.pro_needed ? `<p>👩‍⚖️ ${esc(ev.pro_needed)}</p>` : ""}</details>` });
      break;
    }
    case "huddle_note":
      pushFeed({ cls: "note", who: ev.from, html: `<span class="who">${esc(t("ev_note", { from: personName(ev.from), to: personName(ev.to) }))}</span><br>${esc(ev.note)}` });
      break;
    case "handoff":
      pushFeed({ cls: "note", who: "assistant", html: `<span class="who">${esc(t("ev_handoff", { to: personName("assistant") }))}</span>` });
      break;
    case "draft":
      state.drafts.unshift(ev.draft);
      state.lastDrafts.push(ev.draft);
      pushFeed({ cls: "memo", who: "assistant", html: `<span class="who">${esc(personName("assistant"))}</span> ${esc(t("ev_draft", { subject: ev.draft.subject || ev.draft.to }))}` });
      break;
    case "todo_added":
      state.todos.unshift(ev.todo);
      state.lastTodos = state.lastTodos || [];
      state.lastTodos.push(ev.todo);
      break;
    case "safety":
      pushFeed({ cls: "safety", who: "shield", html: `<strong>${esc(t("k_" + ev.kind))}</strong>${ev.detail ? `<br><small>${esc(ev.detail)}</small>` : ""}` });
      break;
    case "safety_summary":
      state.lastChecks = ev.checks || [];
      break;
    case "error":
      pushFeed({ cls: "error", who: ev.specialist || "captain", html: `<strong>${esc(t("ev_error"))}</strong> ${esc(ev.message)}` });
      break;
    case "done":
      pushFeed({ who: "captain", html: `✅ ${esc(t("ev_done"))} · ${esc(t("stats", { calls: ev.totals.calls, cost: ev.totals.cost.toFixed(4), seconds: Math.round(ev.totals.seconds) }))}` });
      break;
  }
}

// ---------- side panel ----------
function renderSide() {
  const side = $("#side");
  if (!side) return;
  if (state.tab === "daily") {
    side.innerHTML = `<div class="daily">${dailyHTML()}</div>`;
    $("#daily-retry")?.addEventListener("click", loadDaily);
    $$("[data-daily-ask]").forEach(b => b.onclick = () => {
      const tip = state.daily.tips[Number(b.dataset.dailyAsk)];
      const ask = $("#ask");
      ask.value = t("daily_ask_q", { name: personName(tip.member), title: tip.title });   // the family can edit before sending
      ask.dispatchEvent(new Event("input"));
      ask.focus();
    });
  } else if (state.tab === "office") {
    const feed = (state.feed || []).map(feedItemHTML).join("") || `<div class="feed-empty">${esc(t("office_empty"))}</div>`;
    side.innerHTML = `<div class="feed" id="feed">${feed}</div>`;
  } else if (state.tab === "todos") {
    side.innerHTML = `<form class="add-row" id="todo-form"><input id="todo-new" maxlength="200" placeholder="${esc(t("add_todo_ph"))}">
      <button class="btn small">${esc(t("add"))}</button></form>
      <div id="todo-list">${state.todos.length ? state.todos.map(td => `<div class="todo ${td.done ? "done" : ""}">
        <input type="checkbox" data-todo="${td.id}" ${td.done ? "checked" : ""}>
        <div class="grow"><div class="title">${esc(td.title)}</div><div class="meta">${td.owner && td.owner !== "family" ? esc(personName(td.owner)) + " · " : ""}${esc(td.due_hint || "")}</div></div>
        <button class="x" data-del-todo="${td.id}" title="${esc(t("delete"))}">×</button></div>`).join("") : `<div class="feed-empty">${esc(t("no_todos"))}</div>`}</div>`;
    $("#todo-form").onsubmit = async e => {
      e.preventDefault();
      const title = $("#todo-new").value.trim();
      if (!title) return;
      state.todos.unshift(await api("/api/todos", { method: "POST", body: { title } }));
      renderSide();
    };
    $$("[data-todo]").forEach(c => c.onchange = async () => {
      await api(`/api/todos/${c.dataset.todo}`, { method: "PATCH", body: { done: c.checked } });
      await loadTodos(); renderSide();
    });
    $$("[data-del-todo]").forEach(b => b.onclick = async () => {
      await api(`/api/todos/${b.dataset.delTodo}`, { method: "DELETE" });
      await loadTodos(); renderSide();
    });
  } else if (state.tab === "docs") {
    side.innerHTML = `<label class="dropzone"><input type="file" id="file" accept=".pdf,.txt,.md,.csv,image/png,image/jpeg,image/webp" hidden>
      <span class="btn small">📄 ${esc(t("upload"))}</span><small>${esc(t("upload_hint"))}</small></label>
      <div class="error" id="doc-error"></div>
      ${state.docs.length ? state.docs.map(d => `<div class="doc"><div><div>${esc(d.name)}</div><div class="meta">${esc(d.kind)} · ${Number(d.chars).toLocaleString()} ${esc(t("chars"))}</div>
        ${(d.hidden || []).length ? `<details class="doc-warn"><summary>🛡️ ${esc(t("doc_hidden", { n: d.hidden.length }))}</summary>${d.hidden.map(h => `<div>“${esc(h.text)}” <small>(${esc(h.reason)}, p. ${h.page})</small></div>`).join("")}</details>` : ""}
        ${(d.flagged || []).length ? `<details class="doc-warn"><summary>⚠️ ${esc(t("doc_flagged", { n: d.flagged.length }))}</summary>${d.flagged.map(f => `<div>“${esc(f)}”</div>`).join("")}</details>` : ""}</div>
        <div class="row"><button class="btn small ${state.attached.includes(d.id) ? "gold" : "ghost"}" data-attach="${d.id}">📎 ${esc(t("attach"))}</button>
        <button class="btn small ghost" data-del-doc="${d.id}">${esc(t("delete"))}</button></div></div>`).join("") : `<div class="feed-empty">${esc(t("no_docs"))}</div>`}`;
    $("#file").onchange = uploadFile;
    $$("[data-attach]").forEach(b => b.onclick = () => {
      const id = Number(b.dataset.attach);
      state.attached = state.attached.includes(id) ? state.attached.filter(x => x !== id) : [...state.attached, id];
      renderAttached(); renderSide();
    });
    $$("[data-del-doc]").forEach(b => b.onclick = async () => {
      await api(`/api/documents/${b.dataset.delDoc}`, { method: "DELETE" });
      state.attached = state.attached.filter(x => x !== Number(b.dataset.delDoc));
      await loadDocs(); renderAttached(); renderSide();
    });
  } else if (state.tab === "drafts") {
    const isEmail = s => /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(String(s || "").trim());
    side.innerHTML = `<div class="not-sent">✉️ ${esc(t("drafts_intro"))}</div>
      ${state.drafts.length ? state.drafts.map(d => `<div class="draft" data-draft="${d.id}">
        ${d.purpose ? `<div class="purpose">${esc(d.purpose)}</div>` : ""}
        <input data-f="to" maxlength="200" aria-label="${esc(t("d_to"))}" placeholder="${esc(t("d_to"))}" value="${esc(d.to)}">
        <input data-f="subject" maxlength="200" aria-label="${esc(t("d_subject"))}" placeholder="${esc(t("d_subject"))}" value="${esc(d.subject)}">
        <textarea data-f="body" maxlength="5000" aria-label="${esc(t("d_body"))}">${esc(d.body)}</textarea>
        <div class="actions">
          <button class="btn small gold" data-act="gmail">${esc(t("open_gmail"))}</button>
          <button class="btn small ghost" data-act="outlook">${esc(t("open_outlook"))}</button>
          <button class="btn small ghost" data-act="mailto">${esc(t("open_mail"))}</button>
          <button class="btn small ghost" data-act="copy">${esc(t("copy"))}</button>
          <button class="btn small ghost" data-act="ai">${esc(t("copy_ai"))}</button>
          <button class="btn small ghost" data-act="delete">${esc(t("delete"))}</button>
        </div></div>`).join("") : `<div class="feed-empty">${esc(t("no_drafts"))}</div>`}
      <div class="connections"><h4>${esc(t("connections"))}</h4><p class="stats">${esc(t("conn_intro"))}</p>
        ${[["📧", "conn_gmail"], ["📨", "conn_outlook"], ["🤖", "conn_claude"]].map(([icon, k]) => `<div class="conn"><span>${icon}</span>
          <div class="grow">${esc(t(k))}<br><small class="stats">${esc(t("conn_why"))}</small></div><span class="soon">${esc(t("conn_soon"))}</span></div>`).join("")}
      </div>`;
    $$(".draft").forEach(card => {
      const id = Number(card.dataset.draft);
      const read = () => Object.fromEntries($$("[data-f]", card).map(el => [el.dataset.f, el.value]));
      $$("[data-f]", card).forEach(el => el.addEventListener("change", async () => {
        const d = read();
        await api(`/api/drafts/${id}`, { method: "PUT", body: d }).catch(() => {});
        Object.assign(state.drafts.find(x => x.id === id) || {}, d);
      }));
      $$("[data-act]", card).forEach(b => b.onclick = async () => {
        const d = read(), enc = encodeURIComponent, to = isEmail(d.to) ? d.to.trim() : "";
        const act = b.dataset.act;
        if (act === "gmail") window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${enc(to)}&su=${enc(d.subject)}&body=${enc(d.body)}`, "_blank", "noopener");
        if (act === "outlook") window.open(`https://outlook.office.com/mail/deeplink/compose?to=${enc(to)}&subject=${enc(d.subject)}&body=${enc(d.body)}`, "_blank", "noopener");
        if (act === "mailto") location.href = `mailto:${enc(to)}?subject=${enc(d.subject)}&body=${enc(d.body)}`;
        if (act === "copy" || act === "ai") {
          const text = (act === "ai" ? t("ai_prompt") + "\n\n" : "") + `${t("d_to")}: ${d.to}\n${t("d_subject")}: ${d.subject}\n\n${d.body}`;
          await navigator.clipboard.writeText(text).catch(() => {});
          const old = b.textContent; b.textContent = t("copied"); setTimeout(() => b.textContent = old, 1500);
        }
        if (act === "delete") {
          await api(`/api/drafts/${id}`, { method: "DELETE" }).catch(() => {});
          state.drafts = state.drafts.filter(x => x.id !== id);
          renderSide();
        }
      });
    });
  } else if (state.tab === "safety") {
    side.innerHTML = `<p class="stats">${esc(t("safety_intro"))}</p><div id="safety-list"></div>`;
    api("/api/safety").then(({ events }) => {
      const el = $("#safety-list");
      if (!el) return;
      el.innerHTML = events.length ? events.map(e => `<div class="ev safety"><div class="avatar sm shield" aria-hidden="true">🛡️</div><div class="body">
        <strong>${esc(t("k_" + e.kind))}</strong> <small class="stats">${esc(new Date(e.created_at * 1000).toLocaleString(LANG))} · ${esc(e.layer)}</small>
        ${e.detail ? `<br><small>${esc(e.detail)}</small>` : ""}</div></div>`).join("") : `<div class="feed-empty">${esc(t("safety_empty"))}</div>`;
    }).catch(() => {});
  } else {
    const s = state.me.settings;
    side.innerHTML = `<div id="profile-scope">${profileFields(state.me.profile)}</div>
      <h4>${esc(t("step_captain"))}</h4>
      <div class="look-grid">${captainChoices().map(a => `<button type="button" class="look ${s.captain_avatar === a ? "on" : ""}" data-look="${a}"><div class="avatar">${avatarSVG(a)}</div></button>`).join("")}</div>
      <div class="row"><div class="field"><label>${esc(t("captain_name"))}</label><input id="cname" maxlength="30" value="${esc(s.captain_name)}"></div>
      <div class="field"><label>${esc(t("captain_style"))}</label><select id="cstyle">${STYLES.map(st => `<option value="${st}" ${s.captain_style === st ? "selected" : ""}>${esc(t("style_" + st))}</option>`).join("")}</select></div>
      <div class="field"><label>${esc(t("step_help"))}</label><select id="cmode">${MODES.map(m => `<option value="${m}" ${s.help_mode === m ? "selected" : ""}>${esc(t("help_" + m))}</option>`).join("")}</select></div>
      <div class="field"><label>${esc(t("level_label"))}</label>${levelSelect(s.explain_level, "plevel")}</div></div>
      <button class="btn" id="save-profile">${esc(t("save"))}</button> <span id="saved" class="stats"></span>
      <hr style="margin:1.5rem 0;border:0;border-top:1px solid var(--line)">
      <button class="btn small danger" id="delete-account">${esc(t("delete_account"))}</button>`;
    wireGoalChips($("#profile-scope"));
    let look = s.captain_avatar;
    $$("[data-look]").forEach(b => b.onclick = () => { look = b.dataset.look; $$("[data-look]").forEach(x => x.classList.toggle("on", x === b)); });
    $("#save-profile").onclick = async () => {
      state.me = await api("/api/me", { method: "PUT", body: { profile: readProfile($("#profile-scope")),
        settings: { captain_name: $("#cname").value.trim(), captain_style: $("#cstyle").value, help_mode: $("#cmode").value, captain_avatar: look, explain_level: $("#plevel").value } } });
      await showApp();
      state.tab = "profile"; $$(".side-tabs button").forEach(x => x.classList.toggle("on", x.dataset.tab === "profile")); renderSide();
      $("#saved").textContent = "✓ " + t("saved");
    };
    $("#delete-account").onclick = async () => {
      const passcode = prompt(t("delete_account_confirm"));
      if (!passcode) return;
      try { await api("/api/delete-account", { method: "POST", body: { passcode } }); state.me = null; showAuth("signup"); }
      catch (ex) { alert(errText(ex.message)); }
    };
  }
}

function renderAttached() {
  const el = $("#attached");
  if (!el) return;
  const names = state.docs.filter(d => state.attached.includes(d.id)).map(d => d.name);
  el.textContent = names.length ? `📎 ${t("attached")} ${names.join(", ")}` : "";
}

async function loadTodos() { state.todos = (await api("/api/todos").catch(() => ({ todos: [] }))).todos; }
async function loadDrafts() { state.drafts = (await api("/api/drafts").catch(() => ({ drafts: [] }))).drafts; }
async function loadDocs() { state.docs = (await api("/api/documents").catch(() => ({ documents: [] }))).documents; }

async function uploadFile(e) {
  const file = e.target.files[0];
  const err = $("#doc-error");
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) return err.textContent = t("err_too_big");
  err.textContent = t("uploading");
  const data = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] || "");
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  try {
    const doc = await api("/api/documents", { method: "POST", body: { name: file.name, mime: file.type || "", data_base64: data } });
    await loadDocs();
    state.attached = [...state.attached, doc.id];
    renderAttached(); renderSide();
  } catch (ex) { err.textContent = errText(ex.message); }
}

boot();
