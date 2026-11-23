/*
 * identidad-agente.js — la identidad visual de cada agente, en UN solo lugar (CO-006).
 * La usan la consola (mascota SVG en ⚙ Config) y la oficina 3D: los dos dibujan al mismo agente igual.
 *
 * Modelo xAI: cada FAMILIA comparte cuerpo, color base, remate y emblema; dentro de la familia cada agente
 * varía en ojos, boca, accesorio y un matiz del color, todo derivado de su nombre (determinista).
 *   window.IdentidadAgente.identidad(agente) → { familia, residente, color, cuerpo, ojo, boca, remate, accesorio, emblema, semilla }
 * `agente` es lo que devuelve /api/config/agentes: { nombre, grupo, color, oficio, descripcion, accesorio }.
 */
(function (raiz) {
  "use strict";
  const PALETA = { red: "#ff6b6b", blue: "#4c9bff", green: "#3ee08f", yellow: "#f6c760", purple: "#a97bff", orange: "#ff9a52", pink: "#ff7ac6", cyan: "#35e0d0" };
  // cuerpo: 0 redondo · 1 gota · 2 cápsula · 3 campana · 4 hexágono · 5 orgánico. remate: 0 orejas · 1 antena · 2 mechón · 3 nada.
  const FAMILIAS = {
    mios: { titulo: "Míos", libre: true, residente: true },
    os: { titulo: "Personal OS", cuerpo: 0, remate: 0, color: "#35e0d0", emblema: "sinapsis", residente: true },
    claude: { titulo: "Claude Code (integrados)", cuerpo: 1, remate: 3, color: "#d97757", emblema: "estrella", residente: false },
    gsd: { titulo: "GSD", cuerpo: 2, remate: 1, color: "#f6c760", emblema: "g", residente: false },
    sueltos: { titulo: "Otros", cuerpo: 3, remate: 2, color: "#a97bff", emblema: null, residente: false },
  };
  const ACCESORIOS = ["gafas", "lupa", "pluma", "casco", "boina", "auriculares", "escudo", "portapapeles", "corbatin", "brujula"];

  const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const familiaDe = (a) => a.grupo === "mios" ? "mios" : a.grupo === "propios" ? "os" : a.grupo === "integrados" ? "claude"
    : /^gsd-/.test(a.nombre || "") ? "gsd" : "sueltos";
  // Matiz dentro de la familia: aclara u oscurece el color base hasta un 14 % según el nombre.
  const matiz = (hex, h) => {
    const f = ((h % 29) - 14) / 100, n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)))));
    return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
  };
  const accDeOficio = (o, h) => {
    const t = String(o || "").toLowerCase();
    const reglas = [[/revis|audit|calidad|qa|test/, "lupa"], [/arquitect|frontend|ui|ux|diseñ|angular/, "gafas"], [/redact|escrit|correo|document|copy/, "pluma"],
      [/segur|appsec|guardi/, "escudo"], [/plan|estim|sprint|gesti|pm\b|lider|líder/, "portapapeles"], [/explor|investig|research|brief|busc/, "brujula"],
      [/bd|datos|sql|backend|infra|devops/, "casco"], [/soporte|teams|chat|atenci/, "auriculares"]];
    for (const [re, a] of reglas) if (re.test(t)) return a;
    return ["boina", "corbatin", "gafas", "auriculares"][h % 4];
  };

  function identidad(a) {
    const h = hash(a.nombre || "?");
    const familia = familiaDe(a), fam = FAMILIAS[familia];
    // En una familia manda el color de la familia (el parecido); el `color` propio solo pinta a los tuyos.
    const color = fam.libre ? (PALETA[a.color] || Object.values(PALETA)[h % 8]) : matiz(fam.color, h);
    return {
      familia, residente: !!fam.residente, color, semilla: h,
      cuerpo: fam.cuerpo != null ? fam.cuerpo : (h >>> 3) % 6,
      ojo: (h >>> 7) % 3, boca: (h >>> 9) % 3,
      remate: fam.remate != null ? fam.remate : (h >>> 11) % 4,
      accesorio: a.accesorio && ACCESORIOS.includes(a.accesorio) ? a.accesorio : accDeOficio(a.oficio || a.descripcion, h),
      emblema: fam.emblema || null,
    };
  }


  // ---- la mascota en SVG (consola, landing, video): un solo dibujo para todos (CO-006)
  const CUERPOS = [
    "M50 16C75 16 88 34 88 58C88 81 72 93 50 93C28 93 12 81 12 58C12 34 25 16 50 16Z",
    "M50 12C63 30 86 44 86 65C86 83 70 93 50 93C30 93 14 83 14 65C14 44 37 30 50 12Z",
    "M26 22H74A16 16 0 0 1 90 38V74A19 19 0 0 1 71 93H29A19 19 0 0 1 10 74V38A16 16 0 0 1 26 22Z",
    "M50 14C71 14 79 31 81 52L87 83Q87 93 78 93H22Q13 93 13 83L19 52C21 31 29 14 50 14Z",
    "M50 12L84 31Q89 34 89 40V69Q89 75 84 78L50 95L16 78Q11 75 11 69V40Q11 34 16 31Z",
    "M50 18C70 16 90 30 88 56C87 80 70 94 50 93C30 94 13 80 12 56C10 30 30 20 50 18Z",
  ];
  const ACC_SVG = {
    gafas: (c) => `<g fill="none" stroke="#0b1220" stroke-width="3"><circle cx="38" cy="50" r="9"/><circle cx="62" cy="50" r="9"/><path d="M47 50h6M29 48l-8-3M71 48l8-3"/></g><g fill="#fff" opacity=".18"><circle cx="38" cy="50" r="8"/><circle cx="62" cy="50" r="8"/></g>`,
    lupa: () => `<g transform="translate(70 66) rotate(-30)"><rect x="-2.5" y="10" width="5" height="16" rx="2.5" fill="#6b4f2a"/><circle r="11" fill="#cfe9ff" fill-opacity=".35" stroke="#e6ecf7" stroke-width="3.5"/></g>`,
    pluma: () => `<g transform="translate(78 58) rotate(28)"><path d="M0 -22C10 -12 9 6 0 18C-9 6 -10 -12 0 -22Z" fill="#f3f0ff"/><path d="M0 -18V24" stroke="#a97bff" stroke-width="2"/></g>`,
    casco: (c) => `<path d="M20 34C22 14 78 14 80 34Z" fill="#f6c760" stroke="#b8862b" stroke-width="2"/><rect x="16" y="32" width="68" height="6" rx="3" fill="#f6c760" stroke="#b8862b" stroke-width="2"/><rect x="46" y="16" width="8" height="14" rx="3" fill="#e0ad45"/>`,
    boina: () => `<g transform="rotate(-12 50 22)"><ellipse cx="50" cy="22" rx="27" ry="9" fill="#ff5f7e"/><circle cx="50" cy="12" r="3.5" fill="#ff5f7e"/></g>`,
    auriculares: () => `<path d="M18 52C18 24 82 24 82 52" fill="none" stroke="#1d2840" stroke-width="5"/><rect x="11" y="46" width="12" height="20" rx="5" fill="#35e0d0"/><rect x="77" y="46" width="12" height="20" rx="5" fill="#35e0d0"/>`,
    escudo: () => `<g transform="translate(74 70)"><path d="M0 -15L12 -10V0C12 9 6 14 0 17C-6 14 -12 9 -12 0V-10Z" fill="#4c9bff" stroke="#e6ecf7" stroke-width="2"/><path d="M-5 0l4 4 7-8" fill="none" stroke="#fff" stroke-width="2.4"/></g>`,
    portapapeles: () => `<g transform="translate(74 70) rotate(10)"><rect x="-11" y="-14" width="22" height="28" rx="3" fill="#c8a26b"/><rect x="-8" y="-9" width="16" height="20" rx="1.5" fill="#fff"/><rect x="-5" y="-17" width="10" height="6" rx="2" fill="#8a8f99"/><path d="M-5 -3h10M-5 2h10M-5 7h6" stroke="#9aa4be" stroke-width="1.6"/></g>`,
    corbatin: () => `<g transform="translate(50 84)"><path d="M0 0L-12 -7V7Z M0 0L12 -7V7Z" fill="#ff5f7e"/><circle r="3.4" fill="#d6455f"/></g>`,
    brujula: () => `<g transform="translate(74 70)"><circle r="12" fill="#f3e3c2" stroke="#b8862b" stroke-width="2.5"/><path d="M0 -8L3 0L0 8L-3 0Z" fill="#ff5f7e"/><path d="M0 0L3 0L0 8L-3 0Z" fill="#4c9bff"/></g>`,
  };
  const EMBLEMAS = {
    sinapsis: `<g transform="translate(50 79)"><circle r="7.5" fill="#0b1220" opacity=".55"/><circle r="2.4" fill="#35e0d0"/><g stroke="#e6ecf7" stroke-width="1.3"><line x1="0" y1="0" x2="5" y2="-4"/><line x1="0" y1="0" x2="-5" y2="-3"/><line x1="0" y1="0" x2="1" y2="5.5"/></g></g>`,
    estrella: `<g transform="translate(50 79)" fill="#fff4ec">${[0, 45, 90, 135].map((r) => `<rect x="-1.3" y="-7" width="2.6" height="14" rx="1.3" transform="rotate(${r})"/>`).join("")}</g>`,
    g: `<g transform="translate(50 79)"><rect x="-8" y="-7" width="16" height="14" rx="4" fill="#0b1220" opacity=".7"/><text y="4.2" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-size="11" font-weight="700" fill="#f6c760">G</text></g>`,
  };
  let idM = 0;
  /** SVG de la mascota de un agente. Clases: .cu cuerpo, .oj ojos, .chispa (trabajando), .ok (terminó). */
  function svg(a) {
    const I = identidad(a), fam = { emblema: I.emblema };
    const h = I.semilla, color = I.color, cuerpo = CUERPOS[I.cuerpo], ojo = I.ojo, boca = I.boca, remate = I.remate, acc = I.accesorio;
    const id = "osmg" + (++idM);
    const ojos = ojo === 0 ? `<circle cx="38" cy="50" r="6.5" fill="#0b1220"/><circle cx="62" cy="50" r="6.5" fill="#0b1220"/><circle cx="40" cy="47.5" r="2.2" fill="#fff"/><circle cx="64" cy="47.5" r="2.2" fill="#fff"/>`
      : ojo === 1 ? `<ellipse cx="38" cy="50" rx="4.6" ry="7" fill="#0b1220"/><ellipse cx="62" cy="50" rx="4.6" ry="7" fill="#0b1220"/><circle cx="39.5" cy="47" r="1.8" fill="#fff"/><circle cx="63.5" cy="47" r="1.8" fill="#fff"/>`
      : `<circle cx="38" cy="51" r="5.2" fill="#0b1220"/><circle cx="62" cy="51" r="5.2" fill="#0b1220"/><path d="M31 44q7-4 14 0M55 44q7-4 14 0" stroke="#0b1220" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="39.5" cy="49" r="1.7" fill="#fff"/><circle cx="63.5" cy="49" r="1.7" fill="#fff"/>`;
    const bocaS = boca === 0 ? `<path d="M42 64q8 7 16 0" stroke="#0b1220" stroke-width="3" fill="none" stroke-linecap="round"/>`
      : boca === 1 ? `<ellipse cx="50" cy="66" rx="4.5" ry="3.6" fill="#0b1220"/><ellipse cx="50" cy="67.5" rx="2.6" ry="1.6" fill="#ff7a90"/>`
      : `<path d="M43 64q7 5 14-1" stroke="#0b1220" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    const rem = remate === 0 ? `<circle cx="27" cy="24" r="9" fill="${color}"/><circle cx="73" cy="24" r="9" fill="${color}"/><circle cx="27" cy="24" r="4" fill="#fff" opacity=".35"/><circle cx="73" cy="24" r="4" fill="#fff" opacity=".35"/>`
      : remate === 1 ? `<path d="M50 18V6" stroke="${color}" stroke-width="3"/><circle cx="50" cy="5" r="4.5" fill="#fff"/>`
      : remate === 2 ? `<path d="M44 18q2-12 10-12q-3 6 2 12" fill="${color}"/>` : "";
    const sobre = ["casco", "boina", "auriculares"].includes(acc);
    const svg = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="${id}" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity=".82"/></radialGradient></defs>
<g class="chispa"><path d="M86 18l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="${color}"/><path d="M14 26l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="#fff"/></g>
<g class="cu">${sobre ? "" : rem}<path d="${cuerpo}" fill="url(#${id})" stroke="rgba(0,0,0,.28)" stroke-width="2"/><ellipse cx="50" cy="80" rx="20" ry="8" fill="#fff" opacity=".14"/>
<ellipse cx="28" cy="62" rx="6" ry="3.6" fill="#ff7ab0" opacity=".5"/><ellipse cx="72" cy="62" rx="6" ry="3.6" fill="#ff7ab0" opacity=".5"/>
${fam.emblema ? EMBLEMAS[fam.emblema] : ""}<g class="oj">${ojos}</g>${bocaS}${ACC_SVG[acc](color)}</g>
<g class="ok"><circle cx="84" cy="82" r="11" fill="#3ee08f" stroke="#0b1220" stroke-width="2.5"/><path d="M78 82l4 4 8-8" stroke="#0b1220" stroke-width="3" fill="none" stroke-linecap="round"/></g></svg>`;
    return { svg, semilla: h, identidad: I };
  }

  raiz.IdentidadAgente = { identidad, svg, familiaDe, FAMILIAS, PALETA, ACCESORIOS, hash, matiz };
})(typeof window !== "undefined" ? window : globalThis);
