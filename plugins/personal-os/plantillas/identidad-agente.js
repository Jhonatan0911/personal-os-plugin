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

  raiz.IdentidadAgente = { identidad, familiaDe, FAMILIAS, PALETA, ACCESORIOS, hash, matiz };
})(typeof window !== "undefined" ? window : globalThis);
