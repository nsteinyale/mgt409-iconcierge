// Illustrated portraits for the Captain choices and the five specialists, drawn as SVG.
// avatarSVG(id) returns markup; the wrapper's .is-thinking / .is-talking classes animate it (styles.css).

const PEOPLE = {
  // Captains the family can choose from.
  captain_a: { bg: "#f5d7a1", skin: "#c68863", hair: "#3b2a20", hairStyle: "short", outfit: "#1f3b5c",
               extra: "cap", beard: true, accent: "#d9a441" },
  captain_b: { bg: "#cfe3f7", skin: "#f1c6a7", hair: "#7a3b1d", hairStyle: "ponytail", outfit: "#7b2d42",
               extra: "headset", accent: "#f2b84b" },
  captain_c: { bg: "#d9ecd2", skin: "#8d5a3b", hair: "#1c1410", hairStyle: "bald", outfit: "#2f2f3a",
               extra: "bowtie", accent: "#c0392b", glasses: false },
  captain_d: { bg: "#efd6ee", skin: "#e0ac85", hair: "#2a2a2a", hairStyle: "curly", outfit: "#3f6e5a",
               extra: "scarf", accent: "#f0c419" },
  // The team.
  attorney:   { bg: "#dfe4f5", skin: "#a8714f", hair: "#1d1512", hairStyle: "bun", outfit: "#22305a",
                extra: "badge", badge: "scales", accent: "#e8c35a" },
  accountant: { bg: "#dff2e6", skin: "#f0c8a8", hair: "#5a4632", hairStyle: "short", outfit: "#2e7d55",
                extra: "badge", badge: "calc", accent: "#ffffff", glasses: true },
  investor:   { bg: "#d9f0f2", skin: "#b07a52", hair: "#120d0b", hairStyle: "long", outfit: "#1b6f78",
                extra: "badge", badge: "chart", accent: "#ffd166" },
  housing:    { bg: "#fbe3d3", skin: "#e8b18f", hair: "#8a4b23", hairStyle: "curly", outfit: "#d9662b",
                extra: "badge", badge: "house", accent: "#fff3e6" },
  assistant:  { bg: "#d8f3ef", skin: "#c99a74", hair: "#3a2a4a", hairStyle: "ponytail", outfit: "#1b8a8a",
                extra: "badge", badge: "mail", accent: "#ffffff" },
  benefits:   { bg: "#ece0f5", skin: "#f3d1b8", hair: "#9a9a9a", hairStyle: "bob", outfit: "#6a3f8f",
                extra: "badge", badge: "shield", accent: "#f7e9ff", glasses: true },
};

function hairBack(p) {
  switch (p.hairStyle) {
    case "long": return `<path d="M26 52 Q24 86 34 104 L86 104 Q96 86 94 52 Q90 26 60 24 Q30 26 26 52Z" fill="${p.hair}"/>`;
    case "bob": return `<path d="M30 54 Q28 80 36 88 L84 88 Q92 80 90 54 Q86 28 60 27 Q34 28 30 54Z" fill="${p.hair}"/>`;
    case "ponytail": return `<path d="M84 46 Q104 56 96 86 Q92 70 84 64Z" fill="${p.hair}"/>`;
    case "bun": return `<circle cx="60" cy="22" r="11" fill="${p.hair}"/>`;
    default: return "";
  }
}

function hairFront(p) {
  switch (p.hairStyle) {
    case "short": return `<path d="M36 48 Q38 28 60 27 Q82 28 84 48 Q74 38 60 39 Q46 38 36 48Z" fill="${p.hair}"/>`;
    case "curly": return `<g fill="${p.hair}">${[38, 46, 54, 62, 70, 78, 84].map((x, i) =>
      `<circle cx="${x}" cy="${36 + (i % 2) * 4}" r="8"/>`).join("")}<circle cx="34" cy="48" r="6"/><circle cx="86" cy="48" r="6"/></g>`;
    case "long": case "bob": return `<path d="M35 50 Q40 30 60 30 Q80 30 85 50 Q70 40 52 42 Q42 44 35 50Z" fill="${p.hair}"/>`;
    case "ponytail": case "bun": return `<path d="M36 50 Q38 30 60 30 Q82 30 84 50 Q72 38 60 38 Q48 38 36 50Z" fill="${p.hair}"/>`;
    default: return "";
  }
}

function extra(p) {
  switch (p.extra) {
    case "cap": return `<path d="M34 38 Q36 20 60 19 Q84 20 86 38Z" fill="${p.outfit}"/><rect x="30" y="35" width="60" height="6" rx="3" fill="${p.outfit}"/>
      <path d="M86 38 L100 42 L86 42Z" fill="${p.outfit}"/><circle cx="60" cy="27" r="3.5" fill="${p.accent}"/>`;
    case "headset": return `<path d="M33 58 Q32 30 60 29 Q88 30 87 58" stroke="#333" stroke-width="3" fill="none"/>
      <rect x="28" y="54" width="8" height="12" rx="3" fill="#333"/><path d="M34 64 Q38 76 50 76" stroke="#333" stroke-width="2.5" fill="none"/>`;
    case "bowtie": return `<path d="M52 93 L60 97 L52 101Z M68 93 L60 97 L68 101Z" fill="${p.accent}"/>`;
    case "scarf": return `<path d="M42 90 Q60 100 78 90 L80 98 Q60 108 40 98Z" fill="${p.accent}"/>`;
    case "badge": return `<circle cx="80" cy="104" r="8" fill="${p.accent}" stroke="rgba(0,0,0,.25)"/>${badgeIcon(p.badge)}`;
    default: return "";
  }
}

function badgeIcon(kind) {
  const s = `stroke="#333" stroke-width="1.4" fill="none" stroke-linecap="round"`;
  switch (kind) {
    case "scales": return `<path d="M80 98 V109 M75 100 H85 M75 100 L73 104 H77Z M85 100 L83 104 H87Z" ${s}/>`;
    case "calc": return `<rect x="76" y="99" width="8" height="10" rx="1" ${s}/><path d="M77.5 101.5 H82.5" ${s}/>`;
    case "chart": return `<path d="M75 108 L78 104 L81 106 L85 100" ${s}/>`;
    case "house": return `<path d="M75 104 L80 99.5 L85 104 V109 H75Z" ${s}/>`;
    case "mail": return `<rect x="75" y="100.5" width="10" height="7" rx="1" ${s}/><path d="M75 101 L80 105 L85 101" ${s}/>`;
    case "shield": return `<path d="M80 98.5 L85 100.5 V104 Q85 108 80 109.5 Q75 108 75 104 V100.5Z" ${s}/>`;
    default: return "";
  }
}

// Filled from /api/roster: avatar id -> photo file in /static/portraits/.
let PORTRAITS = {};

function avatarSVG(id) {
  const photo = PORTRAITS[id];
  if (photo) {
    return `<img class="avatar-photo" src="/static/portraits/${encodeURIComponent(photo)}" alt="" loading="lazy" draggable="false">
      <span class="ai-badge" title="AI team member">AI</span>`;
  }
  const p = PEOPLE[id] || PEOPLE.captain_a;
  const glasses = p.glasses
    ? `<g stroke="#2b2b2b" stroke-width="2" fill="rgba(255,255,255,.25)"><circle cx="50" cy="58" r="7"/><circle cx="70" cy="58" r="7"/><path d="M57 58 H63"/></g>` : "";
  const beard = p.beard ? `<path d="M42 66 Q44 86 60 88 Q76 86 78 66 Q70 76 60 76 Q50 76 42 66Z" fill="${p.hair}"/>` : "";
  return `<svg viewBox="0 0 120 120" class="avatar-svg" role="img" aria-hidden="true">
    <circle cx="60" cy="60" r="58" fill="${p.bg}"/>
    <clipPath id="clip-${id}"><circle cx="60" cy="60" r="58"/></clipPath>
    <g clip-path="url(#clip-${id})">
      ${hairBack(p)}
      <path d="M22 120 Q24 94 60 90 Q96 94 98 120Z" fill="${p.outfit}"/>
      <rect x="53" y="76" width="14" height="16" rx="6" fill="${p.skin}"/>
      <ellipse cx="60" cy="58" rx="24" ry="27" fill="${p.skin}"/>
      <ellipse cx="36" cy="60" rx="4" ry="6" fill="${p.skin}"/><ellipse cx="84" cy="60" rx="4" ry="6" fill="${p.skin}"/>
      ${hairFront(p)}
      <g class="eyes"><ellipse cx="50" cy="58" rx="2.6" ry="3.2" fill="#222"/><ellipse cx="70" cy="58" rx="2.6" ry="3.2" fill="#222"/></g>
      <path d="M45 50 Q50 47 55 50 M65 50 Q70 47 75 50" stroke="${p.hair === "#9a9a9a" ? "#777" : p.hair}" stroke-width="2" fill="none" stroke-linecap="round"/>
      ${glasses}
      <ellipse cx="44" cy="67" rx="4" ry="2.4" fill="#e88" opacity=".35"/><ellipse cx="76" cy="67" rx="4" ry="2.4" fill="#e88" opacity=".35"/>
      ${beard}
      <path class="mouth" d="M52 71 Q60 77 68 71" stroke="#7a3328" stroke-width="2.6" fill="#a8463a" stroke-linecap="round"/>
      ${extra(p)}
    </g>
  </svg>`;
}

const CAPTAIN_AVATARS = ["captain_a", "captain_b", "captain_c", "captain_d"];
