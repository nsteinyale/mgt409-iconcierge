// The office as a round table: the team sits around it facing each other, and every real event in a run
// (assignments, tool use, findings, huddle notes, hand-offs to Ari) travels across the table as a ping.

const RoundTable = (() => {
  const COLORS = { assign: "#d9a441", tool: "#3b6fd8", memo: "#2e8b57", note: "#e07a1f", handoff: "#7b4bd1", draft: "#1b8a8a" };
  let scene = null, svg = null, seats = {}, order = [];

  // Captain at the head of the table (far side); everyone else around the ellipse.
  function layout(ids) {
    const n = ids.length, pos = {};
    ids.forEach((id, i) => {
      const angle = (-90 + i * 360 / n) * Math.PI / 180;
      const depth = (Math.sin(angle) + 1) / 2;            // 0 = far side, 1 = near side
      pos[id] = {
        x: 50 + 39 * Math.cos(angle),
        y: 47 + 31 * Math.sin(angle),
        scale: 0.74 + 0.34 * depth,
        turn: -Math.cos(angle) * 30,                       // face toward the middle of the table
        z: Math.round(10 + depth * 10),
      };
    });
    return pos;
  }

  function render(container, ids, info) {
    order = ids;
    const pos = layout(ids);
    container.innerHTML = `
      <div class="rt-scene">
        <div class="rt-table"><div class="rt-table-top"></div>
          <div class="rt-toolbox" title="Calculators, official sources, documents">🧮 📚 📄 ✉️</div>
          <div class="rt-center-note" aria-live="polite"></div></div>
        <svg class="rt-pings" aria-hidden="true"></svg>
        ${ids.map(id => `
          <div class="rt-seat idle${pos[id].y < 45 ? " bubble-below" : ""}" data-seat="${id}" style="left:${pos[id].x}%;top:${pos[id].y}%;z-index:${pos[id].z};
               --s:${pos[id].scale};--turn:${pos[id].turn}deg">
            <div class="rt-person">${info.avatar(id)}</div>
            <div class="rt-name">${info.name(id)}</div>
            <div class="rt-role">${info.role(id)}</div>
            <div class="rt-status">${info.status("idle")}</div>
            <div class="rt-bubble"></div>
          </div>`).join("")}
      </div>`;
    scene = container.querySelector(".rt-scene");
    svg = container.querySelector(".rt-pings");
    seats = {};
    container.querySelectorAll(".rt-seat").forEach(el => seats[el.dataset.seat] = el);
  }

  function center(id) {
    const el = id === "table" ? scene.querySelector(".rt-toolbox") : seats[id]?.querySelector(".avatar");
    if (!el || !scene) return null;
    const a = el.getBoundingClientRect(), b = scene.getBoundingClientRect();
    return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2 };
  }

  function setStatus(id, status, label) {
    const el = seats[id];
    if (!el) return;
    el.classList.remove("idle", "thinking", "working", "done", "benched");
    el.classList.add(status);
    el.querySelector(".rt-status").textContent = label;
    el.querySelector(".avatar")?.classList.toggle("is-thinking", status === "thinking" || status === "working");
  }

  function bench(ids) {           // dim teammates who are not on this question
    Object.keys(seats).forEach(id => seats[id].classList.toggle("benched", ids !== null && !ids.includes(id) && id !== "captain"));
  }

  function talk(id, ms = 1600) {
    const av = seats[id]?.querySelector(".avatar");
    if (!av) return;
    av.classList.add("is-talking");
    seats[id].classList.add("leaning");
    setTimeout(() => { av.classList.remove("is-talking"); seats[id]?.classList.remove("leaning"); }, ms);
  }

  function bubble(id, text, ms = 4200) {
    const el = seats[id]?.querySelector(".rt-bubble");
    if (!el) return;
    el.textContent = text.length > 110 ? text.slice(0, 107) + "…" : text;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), ms);
  }

  function centerNote(text, ms = 2600) {
    const el = scene?.querySelector(".rt-center-note");
    if (!el) return;
    el.textContent = text.length > 70 ? text.slice(0, 67) + "…" : text;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), ms);
  }

  // A dot travels along an arc from one seat to another (or to the toolbox in the middle).
  function ping(from, to, kind = "assign", { back = false, duration = 900 } = {}) {
    if (!svg) return Promise.resolve();
    const a = center(from), b = center(to);
    if (!a || !b) return Promise.resolve();
    const lift = Math.max(30, Math.hypot(b.x - a.x, b.y - a.y) * 0.28);
    const cx = (a.x + b.x) / 2, cy = Math.min(a.y, b.y) - lift;
    const ns = "http://www.w3.org/2000/svg";
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`);
    path.setAttribute("class", "rt-trail");
    path.style.stroke = COLORS[kind] || COLORS.assign;
    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("r", 6);
    dot.setAttribute("class", "rt-dot");
    dot.style.fill = COLORS[kind] || COLORS.assign;
    svg.append(path, dot);
    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    const start = performance.now();
    return new Promise(resolve => {
      function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const p = path.getPointAtLength((back ? 1 - e : e) * len);
        dot.setAttribute("cx", p.x);
        dot.setAttribute("cy", p.y);
        path.style.strokeDashoffset = back ? len * e : len * (1 - e);
        if (t < 1) requestAnimationFrame(frame);
        else {
          dot.classList.add("arrive");
          setTimeout(() => { dot.remove(); path.classList.add("fade"); setTimeout(() => path.remove(), 700); }, 250);
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
  }

  return { render, setStatus, bench, talk, bubble, centerNote, ping, get ready() { return !!scene && scene.isConnected; } };
})();
