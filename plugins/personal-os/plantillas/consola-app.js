/*
 * consola-app.js — convierte la consola neuronal en LA app del Personal OS (D-065).
 *
 * Lo inyecta os-servidor.js al servir la consola, ANTES del script de la consola: así los botones y las
 * vistas que se agregan aquí ya existen cuando ella engancha sus pestañas (`.seg.tabs button[data-view]`,
 * `.view#view-<id>`), y los maneja como propias (cambio de vista, #mandos en la URL). La plantilla de la
 * consola no se toca: abierta como archivo, sin servidor, sigue igual que siempre.
 *
 * Suma dos pestañas: MANDOS (estado, exigencia, indicadores, acciones) y CONFIG (agentes), y en el pie el
 * estado del OS. Clases propias con prefijo osm- (CO-099); el resto reutiliza las de la consola.
 */
(function () {
  "use strict";
  if (!window.OS_TOKEN) return;
  const TOKEN = window.OS_TOKEN;
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (tag, props, ...hijos) => { const e = document.createElement(tag); Object.assign(e, props || {}); for (const h of hijos) if (h != null) e.append(h); return e; };

  // ------------------------------------------------------------ estilos (variables de la consola)
  document.head.append(el("style", { textContent: `
.osm-col{width:min(1080px,100%);margin:0 auto;padding:18px clamp(14px,3vw,26px) 30px;display:flex;flex-direction:column;gap:16px;overflow:auto;flex:1 1 auto;min-height:0}
.osm-k{font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:0 0 10px}
.osm-panel{background:linear-gradient(180deg,rgba(17,26,41,.75),rgba(15,22,34,.75));border:1px solid var(--line);border-radius:16px;padding:16px}
.osm-dos{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}
.osm-vitals{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.osm-vitals .vital .v{font-size:22px}
.osm-vitals .vital[data-tono=ok] .v{color:#3ee08f}.osm-vitals .vital[data-tono=aviso] .v{color:var(--r1)}.osm-vitals .vital[data-tono=error] .v{color:var(--r3)}
.osm-vitals .vital[data-tono=aviso]::before{background:var(--r1)}.osm-vitals .vital[data-tono=error]::before{background:var(--r3)}
.osm-fila{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 12px;padding:9px 0;border-bottom:1px solid var(--line);font-size:13px}
.osm-fila:last-child{border-bottom:0}.osm-fila .et{color:var(--muted-2)}.osm-fila .val{font-family:var(--mono);margin-left:auto;text-align:right}
.osm-aviso{color:var(--r1)}.osm-error{color:var(--r3)}.osm-ok{color:#3ee08f}
.osm-panel .seg{display:grid;grid-template-columns:repeat(4,1fr);width:100%}
.osm-panel .seg button[aria-pressed="true"]{color:#04121a;background:var(--synapse);box-shadow:0 0 18px rgba(53,224,208,.35)}
.osm-nota{font-size:12.5px;color:var(--muted-2);margin:10px 0 0;line-height:1.5}
.osm-acc{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.osm-b{appearance:none;text-align:left;display:flex;flex-direction:column;gap:3px;background:var(--panel-2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;color:var(--ink);font:inherit;cursor:pointer;transition:.2s}
.osm-b:hover{border-color:var(--synapse);box-shadow:0 0 14px rgba(53,224,208,.12)}.osm-b b{font-size:13.5px;font-weight:600}.osm-b span{font-size:12px;color:var(--muted-2)}
.osm-b[aria-busy=true]{opacity:.55;cursor:progress}
.osm-btn{appearance:none;font-family:var(--mono);font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;background:var(--panel-2);color:var(--ink);border:1px solid var(--line-strong);border-radius:9px;padding:7px 12px;cursor:pointer}
.osm-btn:hover{border-color:var(--synapse)}.osm-btn.prim{background:var(--synapse);color:#04121a;border-color:var(--synapse)}.osm-btn.peligro{color:var(--r3);border-color:rgba(255,95,126,.45)}
:is(.osm-b,.osm-btn,.osm-it):focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.osm-pie{display:inline-flex;align-items:center;gap:10px}
.osm-pie .luz{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--muted);margin-right:6px}
.osm-pie .luz.on{background:#3ee08f;box-shadow:0 0 8px #3ee08f}.osm-pie .luz.off{background:var(--r1)}
.osm-pie button{appearance:none;font:inherit;letter-spacing:inherit;text-transform:inherit;background:none;border:1px solid var(--line-strong);border-radius:8px;color:var(--muted-2);padding:2px 8px;cursor:pointer}
.osm-pie button:hover{color:var(--ink);border-color:var(--synapse)}
#osm-linea{text-transform:none;letter-spacing:.02em}#osm-linea.ok{color:#3ee08f}#osm-linea.error{color:var(--r3)}#osm-linea.trab{color:var(--synapse)}
.osm-ag{display:grid;grid-template-columns:minmax(240px,320px) 1fr;gap:16px;min-height:0}
.osm-lista{display:flex;flex-direction:column;gap:14px;max-height:66vh;overflow:auto;padding-right:4px}
.osm-lista h3{font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:0 0 6px;font-weight:500}
.osm-it{appearance:none;display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin-bottom:4px;color:var(--ink);font:13px var(--mono);cursor:pointer}
.osm-it:hover{border-color:var(--line-strong)}.osm-it[aria-current=true]{border-color:var(--synapse);box-shadow:0 0 12px rgba(53,224,208,.12)}
.osm-it .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.osm-it .i{font-size:12px;color:var(--muted)}
.osm-det h2{margin:0 0 6px;font:600 16px var(--mono)}
.osm-etq{display:inline-block;font:500 10.5px var(--mono);letter-spacing:.12em;text-transform:uppercase;border:1px solid var(--line-strong);border-radius:999px;padding:3px 9px;color:var(--muted-2);margin-bottom:12px}
.osm-etq.mio{color:var(--synapse);border-color:rgba(53,224,208,.4)}
.osm-campo{display:flex;flex-direction:column;gap:5px;margin-bottom:13px}
.osm-campo>label,.osm-campo>.l{font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.osm-campo small{font-size:12px;color:var(--muted-2)}
.osm-campo input[type=text],.osm-campo textarea,.osm-campo select{background:rgba(7,11,18,.7);color:var(--ink);border:1px solid var(--line-strong);border-radius:9px;padding:9px 11px;font:13px var(--sans);width:100%;box-sizing:border-box}
.osm-campo input:focus,.osm-campo textarea:focus,.osm-campo select:focus{outline:none;border-color:var(--synapse)}
.osm-campo textarea{font-family:var(--mono);min-height:190px;resize:vertical}.osm-campo textarea.corta{min-height:72px;font-family:var(--sans)}
.osm-casillas{display:flex;flex-wrap:wrap;gap:6px 16px}.osm-casillas label{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--ink)}.osm-casillas input{accent-color:var(--synapse)}
.osm-ver{white-space:pre-wrap;font:12px/1.6 var(--mono);color:var(--muted-2);background:rgba(7,11,18,.6);border:1px solid var(--line);border-radius:10px;padding:11px;max-height:42vh;overflow:auto}
.osm-pie-f{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px}.osm-pie-f .esp{flex:1}
.osm-sucio{font-size:12px;color:var(--r1)}.osm-err{font-size:13px;color:var(--r3);margin:0 0 12px}
.osm-vacio{color:var(--muted-2);font-size:13px}
dialog.osm-dlg{background:var(--panel);color:var(--ink);border:1px solid var(--line-strong);border-radius:16px;padding:20px;max-width:440px}
dialog.osm-dlg::backdrop{background:rgba(3,6,12,.72)}dialog.osm-dlg h2{margin:0 0 8px;font-size:16px}dialog.osm-dlg p{margin:0 0 16px;color:var(--muted-2);font-size:13.5px}
@media (max-width:800px){.osm-ag{grid-template-columns:1fr}}
` }));

  // ------------------------------------------------------------ pestañas y vistas (las maneja la consola)
  const tabs = $(".seg.tabs"), main = $("main"), footer = $("footer");
  if (!tabs || !main) return;
  tabs.append(el("button", { type: "button", textContent: "Mandos" }), el("button", { type: "button", textContent: "⚙ Config" }));
  tabs.lastElementChild.previousElementSibling.dataset.view = "mandos"; tabs.lastElementChild.dataset.view = "config";
  tabs.querySelectorAll("button[data-view=mandos],button[data-view=config]").forEach((b) => b.setAttribute("aria-pressed", "false"));

  const vMandos = el("section", { className: "view", id: "view-mandos", ariaLabel: "Mandos del Personal OS" });
  const vConfig = el("section", { className: "view", id: "view-config", ariaLabel: "Configuración" });
  main.append(vMandos, vConfig);

  // Por si la consola de este usuario no engancha botones nuevos (plantilla propia): el cambio de vista
  // también se hace aquí, con el mismo efecto que el suyo.
  tabs.addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-view]"); if (!b || !["mandos", "config"].includes(b.dataset.view)) return;
    setTimeout(() => {
      if ($("#view-" + b.dataset.view).classList.contains("active")) return;
      tabs.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      document.querySelectorAll(".view").forEach((x) => x.classList.toggle("active", x.id === "view-" + b.dataset.view));
    }, 0);
  });
  // Al entrar a Config, se carga la lista de agentes (una vez; nunca en el refresco, CO-096).
  new MutationObserver(() => { if (vConfig.classList.contains("active") && !ag.datos) agCargar(); }).observe(vConfig, { attributes: true, attributeFilter: ["class"] });

  // ------------------------------------------------------------ pie: estado del OS y línea de resultado
  const pie = el("span", { className: "osm-pie" },
    el("span", { id: "osm-os" }, el("span", { className: "luz" }), "…"), el("button", { type: "button", id: "osm-os-b", textContent: "…" }), el("span", { id: "osm-linea" }));
  if (footer) footer.insertBefore(pie, footer.lastElementChild);
  const decir = (t, tono) => { const l = $("#osm-linea"); l.textContent = t ? "· " + t : ""; l.className = tono || ""; };

  const dlg = el("dialog", { className: "osm-dlg" }, el("h2"), el("p"),
    el("div", { className: "osm-pie-f" }, el("span", { className: "esp" }), el("button", { type: "button", className: "osm-btn", textContent: "Cancelar" }), el("button", { type: "button", className: "osm-btn prim", textContent: "Sí, hacerlo" })));
  document.body.append(dlg);
  function confirmar(titulo, texto) {
    dlg.querySelector("h2").textContent = titulo; dlg.querySelector("p").textContent = texto;
    const [no, si] = dlg.querySelectorAll("button");
    return new Promise((ok) => {
      const fin = (v) => { dlg.close(); si.onclick = no.onclick = null; ok(v); };
      si.onclick = () => fin(true); no.onclick = () => fin(false);
      dlg.addEventListener("cancel", () => fin(false), { once: true });
      dlg.showModal(); no.focus();
    });
  }

  const reportar = (m) => { try { fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json", "X-OS-Token": TOKEN }, body: JSON.stringify({ m: String(m).slice(0, 1500) }) }); } catch (_) { /* nada */ } };
  addEventListener("error", (e) => reportar(`${e.message} @${e.filename}:${e.lineno}`));
  addEventListener("unhandledrejection", (e) => reportar(e.reason));

  async function accion(id, cuerpo) {
    const r = await fetch(`/api/accion/${id}`, { method: "POST", headers: { "Content-Type": "application/json", "X-OS-Token": TOKEN }, body: JSON.stringify(cuerpo || {}) });
    let j; try { j = await r.json(); } catch (_) { j = { ok: false, mensaje: `respuesta ${r.status}` }; }
    if (r.status === 403) j.mensaje = "el servidor se reinició: recarga la página (Ctrl+R)";
    return j;
  }
  async function correr(id, o) {
    o = o || {};
    if (o.confirmar && !(await confirmar(o.etiqueta || id, o.confirmar))) return;
    if (o.boton) o.boton.setAttribute("aria-busy", "true");
    decir(`${o.etiqueta || id}: en marcha…`, "trab");
    try {
      const r = await accion(id, o.cuerpo);
      decir(`${o.etiqueta || id}: ${r.mensaje || (r.ok ? "hecho" : "falló")}`, r.ok ? "ok" : "error");
      if (r.ok && o.recargar) setTimeout(() => location.reload(), 600);
    } catch (e) { decir(`${o.etiqueta || id}: ${e.message}`, "error"); }
    finally { if (o.boton) o.boton.removeAttribute("aria-busy"); refrescar(); }
  }

  // ------------------------------------------------------------ MANDOS
  const col = el("div", { className: "osm-col" });
  vMandos.append(col);
  const pInd = el("div", { className: "osm-vitals", id: "osm-ind" }, el("p", { className: "osm-vacio", textContent: "Cargando…" }));
  const pEstado = el("div", { className: "osm-panel" }, el("p", { className: "osm-k", textContent: "Estado" }));
  const filas = {};
  for (const [k, t] of [["os", "Personal OS"], ["tablero", "Tablero del día"], ["consola", "Datos de la consola"], ["servidor", "Servidor"]]) {
    filas[k] = el("span", { className: "val", textContent: "…" });
    pEstado.append(el("div", { className: "osm-fila" }, el("span", { className: "et", textContent: t }), filas[k]));
  }
  const segEx = el("div", { className: "seg", role: "group", ariaLabel: "Nivel de exigencia" });
  const tonoEx = el("p", { className: "osm-nota" });
  const pEx = el("div", { className: "osm-panel" }, el("p", { className: "osm-k", textContent: "Exigencia del Personal OS" }), segEx, tonoEx,
    el("p", { className: "osm-nota", textContent: "Gradúa todo el sistema: cuánto insiste, cuántos días tolera un compromiso sin cruzar y cuántos vencidos lista. Aplica en la próxima sesión de Claude." }));
  const pAcc = el("div", { className: "osm-acc", id: "osm-acc" });
  col.append(el("div", {}, el("p", { className: "osm-k", textContent: "Hoy" }), pInd), el("div", { className: "osm-dos" }, pEstado, pEx),
    el("div", { className: "osm-panel" }, el("p", { className: "osm-k", textContent: "Acciones" }), pAcc));

  const fmt = (iso) => { if (!iso) return null; const d = new Date(iso); return { t: d.toLocaleString("es-CO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }), hoy: d.toDateString() === new Date().toDateString() }; };
  let est = null, inds = [];

  function pintar() {
    if (!est) return;
    const act = est.os.activo;
    const os = $("#osm-os"); os.replaceChildren(el("span", { className: "luz " + (act ? "on" : "off") }), act ? "OS activo" : "OS en pausa");
    $("#osm-os-b").textContent = act ? "Pausar" : "Activar";
    filas.os.textContent = act ? "activo" : "en pausa"; filas.os.className = "val " + (act ? "osm-ok" : "osm-aviso");
    for (const [k, iso, falta] of [["tablero", est.tablero.md, "no existe"], ["consola", est.consola, "sin construir"]]) {
      const f = fmt(iso); filas[k].textContent = f ? f.t + (f.hoy ? "" : " · no es de hoy") : falta;
      filas[k].className = "val " + (!f ? "osm-error" : f.hoy ? "" : "osm-aviso");
    }
    filas.servidor.textContent = "en línea · v" + est.version; filas.servidor.className = "val osm-ok";

    if (!segEx.children.length) for (const n of est.exigencia.niveles) {
      const b = el("button", { type: "button", textContent: n.etiqueta }); b.dataset.nivel = n.clave;
      b.addEventListener("click", () => correr("exigencia", { etiqueta: `Exigencia ${n.etiqueta}`, cuerpo: { nivel: n.clave } }));
      segEx.append(b);
    }
    for (const b of segEx.children) b.setAttribute("aria-pressed", b.dataset.nivel === est.exigencia.nivel);
    tonoEx.textContent = (est.exigencia.aviso ? `⚠ ${est.exigencia.aviso}. ` : "") + (est.exigencia.tono || "");

    const valorDe = (id) => (inds.find((i) => i.id === id) || {}).valor;
    const cumple = (c) => c && valorDe(c.indicador) === c.valor;
    const propias = [
      { id: "consola-build", etiqueta: "Reconstruir la consola", ayuda: "relee el estado y regenera los datos de esta vista", recargar: true },
      { id: "abrir", etiqueta: "Tablero del día", ayuda: "abre la vista del día", cuerpo: { destino: "tablero" } },
      { id: "abrir", etiqueta: "Bitácora de hoy", ayuda: "abre el .md del día", cuerpo: { destino: "bitacora-hoy" } },
      { id: "abrir", etiqueta: "Carpeta de estado", ayuda: "abre estado/ en el explorador", cuerpo: { destino: "estado" } },
    ];
    const delUsuario = est.acciones.filter((a) => (!a.mostrar_si || cumple(a.mostrar_si)) && !cumple(a.ocultar_si));
    pAcc.replaceChildren(...propias.concat(delUsuario).map((a) => {
      const b = el("button", { type: "button", className: "osm-b" }, el("b", { textContent: a.etiqueta }), el("span", { textContent: a.ayuda || "" }));
      b.addEventListener("click", () => correr(a.id, { etiqueta: a.etiqueta, confirmar: a.confirmar || null, cuerpo: a.cuerpo, boton: b, recargar: a.recargar }));
      return b;
    }));
  }

  function pintarInd() {
    if (!inds.length) { pInd.replaceChildren(el("p", { className: "osm-vacio", textContent: "Sin indicadores declarados (config.json → servidor.indicadores)." })); return; }
    pInd.replaceChildren(...inds.map((i) => {
      const d = el("div", { className: "vital" }, el("div", { className: "k", textContent: i.etiqueta }), el("div", { className: "v", textContent: i.valor }), el("div", { className: "note", textContent: i.detalle || "" }));
      d.dataset.tono = i.tono || "neutro"; return d;
    }));
  }

  async function refrescar() {
    try {
      const [e, i] = await Promise.all([fetch("/api/estado").then((r) => r.json()), fetch("/api/indicadores").then((r) => r.json())]);
      inds = Array.isArray(i) ? i : []; est = e; pintarInd(); pintar();
    } catch (_) {
      filas.servidor.textContent = "sin respuesta"; filas.servidor.className = "val osm-error";
      decir("el servidor no responde (revisa con os-servidor.js --salud)", "error");
    }
  }
  $("#osm-os-b").addEventListener("click", () => {
    if (!est) return; const act = est.os.activo;
    correr("os-flag", { etiqueta: act ? "Pausar el Personal OS" : "Activar el Personal OS", cuerpo: { activo: !act },
      confirmar: act ? "Se pausa en TODAS las sesiones: deja de leer el estado y de recordarte riesgos y compromisos al abrir." : null });
  });

  // ------------------------------------------------------------ CONFIG · agentes (modelo Grok Bot / Muse)
  // Capa 1: la lista (mascota con estado real, oficio, lema, uso). Capa 2: la ficha (objetivo, meta, límites,
  // equipo, actividad, memoria). Capa 3: el registro crudo, plegado. Mascota SVG paramétrica: el cuerpo, los ojos
  // y la boca salen del nombre; el accesorio, del oficio; el color es el campo oficial `color` de Claude Code.
  const AG_GRUPOS = { mios: "Míos", propios: "Propios del Personal OS", terceros: "De terceros" };
  const AG_HERR = { lectura: "Leer archivos", edicion: "Editar archivos", terminal: "Terminal", web: "Web" };
  const AG_MODELOS = { inherit: "El de la sesión", sonnet: "Sonnet", opus: "Opus", haiku: "Haiku", fable: "Fable" };
  const PALETA = { red: "#ff6b6b", blue: "#4c9bff", green: "#3ee08f", yellow: "#f6c760", purple: "#a97bff", orange: "#ff9a52", pink: "#ff7ac6", cyan: "#35e0d0" };
  const COLOR_ES = { red: "rojo", blue: "azul", green: "verde", yellow: "amarillo", purple: "violeta", orange: "naranja", pink: "rosa", cyan: "turquesa" };
  const ACC_ES = { gafas: "Gafas", lupa: "Lupa", pluma: "Pluma", casco: "Casco", boina: "Boina", auriculares: "Auriculares", escudo: "Escudo", portapapeles: "Portapapeles", corbatin: "Corbatín", brujula: "Brújula" };
  const RIESGO = { escribe: new Set(["Write", "Edit", "NotebookEdit", "MultiEdit"]), ejecuta: new Set(["Bash", "PowerShell"]) };

  document.head.append(el("style", { textContent: `
.osm-m{display:inline-block;position:relative;flex:none;line-height:0}
.osm-m svg{width:100%;height:100%;overflow:visible}
.osm-m .cu{transform-box:fill-box;transform-origin:50% 100%;animation:osm-resp 4.2s ease-in-out infinite}
.osm-m .oj{transform-box:fill-box;transform-origin:50% 50%;animation:osm-parp 6.5s infinite}
.osm-m.trabajando .cu{animation:osm-bote .7s ease-in-out infinite}
.osm-m.trabajando .oj{animation:osm-mira 1.4s ease-in-out infinite}
.osm-m .chispa{opacity:0}.osm-m.trabajando .chispa{animation:osm-chis 1.2s ease-in-out infinite}
.osm-m .ok{opacity:0;transition:opacity .4s}.osm-m.listo .ok{opacity:1}
.osm-m .punto{position:absolute;right:-1px;bottom:-1px;width:28%;height:28%;max-width:12px;max-height:12px;border-radius:50%;border:2px solid var(--panel);background:var(--muted)}
.osm-m.trabajando .punto{background:var(--synapse);box-shadow:0 0 8px var(--synapse)}.osm-m.listo .punto{background:#3ee08f}
@keyframes osm-resp{0%,100%{transform:scale(1,1)}50%{transform:scale(1.025,.975)}}
@keyframes osm-parp{0%,94%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
@keyframes osm-bote{0%,100%{transform:translateY(0) scale(1,1)}40%{transform:translateY(-5%) scale(.98,1.03)}}
@keyframes osm-mira{0%,100%{transform:translateX(0)}30%{transform:translateX(-6%)}70%{transform:translateX(6%)}}
@keyframes osm-chis{0%{opacity:0;transform:translateY(0) scale(.6)}50%{opacity:1}100%{opacity:0;transform:translateY(-10px) scale(1)}}
@media (prefers-reduced-motion:reduce){.osm-m *{animation:none!important}}
.osm-g>summary{cursor:pointer;list-style:none;font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:0 0 6px}
.osm-g>summary::-webkit-details-marker{display:none}.osm-g>summary::before{content:"▸ ";}.osm-g[open]>summary::before{content:"▾ "}
.osm-tj{appearance:none;display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;width:100%;text-align:left;background:var(--panel-2);border:1px solid var(--line);border-radius:12px;padding:8px 10px;margin-bottom:6px;color:var(--ink);font:inherit;cursor:pointer;transition:.2s}
.osm-tj:hover{border-color:var(--line-strong)}.osm-tj[aria-current=true]{border-color:var(--synapse);box-shadow:0 0 14px rgba(53,224,208,.14)}
.osm-tj .n{display:block;font:600 13px var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.osm-tj .o{display:block;font-size:11.5px;color:var(--muted-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}
.osm-tj .s{display:block;font:11px var(--mono);color:var(--muted);text-align:right;white-space:nowrap}.osm-tj .s.vivo{color:var(--synapse)}
.osm-heroe{display:flex;gap:18px;align-items:center;margin-bottom:14px}
.osm-heroe h2{margin:0;font:600 18px var(--mono)}
.osm-lema{font-style:italic;color:var(--muted-2);margin:4px 0 0;font-size:13.5px}
.osm-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.osm-chip{font:500 10.5px var(--mono);letter-spacing:.1em;text-transform:uppercase;border:1px solid var(--line-strong);border-radius:999px;padding:3px 9px;color:var(--muted-2)}
.osm-sec{border-top:1px solid var(--line);padding-top:12px;margin-top:12px}
.osm-sec h3{font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:0 0 8px;font-weight:500}
.osm-lim{margin:0;padding-left:18px;color:var(--ink);font-size:13px;line-height:1.6}
.osm-herr{display:flex;flex-wrap:wrap;gap:6px}.osm-herr span{font:11.5px var(--mono);border-radius:7px;padding:2px 8px;background:rgba(7,11,18,.6);border:1px solid var(--line)}
.osm-herr .w{border-color:rgba(246,199,96,.45);color:var(--r1)}.osm-herr .x{border-color:rgba(255,95,126,.45);color:var(--r3)}
.osm-num{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:8px}.osm-num div{font:600 20px var(--mono)}.osm-num small{display:block;font:400 11px var(--sans);color:var(--muted)}
.osm-tabla{width:100%;border-collapse:collapse;font:12px var(--mono)}.osm-tabla td{padding:4px 6px;border-bottom:1px solid var(--line);color:var(--muted-2)}
.osm-mem{display:flex;flex-direction:column;gap:4px}
.osm-mem button{appearance:none;text-align:left;background:rgba(7,11,18,.5);border:1px solid var(--line);border-radius:9px;padding:7px 10px;color:var(--ink);font:13px var(--sans);cursor:pointer;display:flex;justify-content:space-between;gap:8px}
.osm-mem button:hover{border-color:var(--synapse)}.osm-mem small{color:var(--muted);font:11px var(--mono)}
.osm-colores{display:flex;gap:8px;flex-wrap:wrap}.osm-colores label{position:relative;cursor:pointer}
.osm-colores input{position:absolute;opacity:0;width:1px;height:1px}
.osm-colores span{display:block;width:26px;height:26px;border-radius:50%;border:2px solid transparent;box-shadow:inset 0 0 0 2px rgba(0,0,0,.25)}
.osm-colores input:checked+span{border-color:var(--ink)}.osm-colores input:focus-visible+span{outline:2px solid var(--ink);outline-offset:2px}
.osm-dosc{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
.osm-prev{display:flex;align-items:center;gap:14px;margin-bottom:12px}
details.osm-crudo>summary{cursor:pointer;font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
@media (max-width:700px){.osm-dosc{grid-template-columns:1fr}}
` }));

  // ---- mascota SVG paramétrica
  const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const CUERPOS = [
    "M50 16C75 16 88 34 88 58C88 81 72 93 50 93C28 93 12 81 12 58C12 34 25 16 50 16Z",
    "M50 12C63 30 86 44 86 65C86 83 70 93 50 93C30 93 14 83 14 65C14 44 37 30 50 12Z",
    "M26 22H74A16 16 0 0 1 90 38V74A19 19 0 0 1 71 93H29A19 19 0 0 1 10 74V38A16 16 0 0 1 26 22Z",
    "M50 14C71 14 79 31 81 52L87 83Q87 93 78 93H22Q13 93 13 83L19 52C21 31 29 14 50 14Z",
    "M50 12L84 31Q89 34 89 40V69Q89 75 84 78L50 95L16 78Q11 75 11 69V40Q11 34 16 31Z",
    "M50 18C70 16 90 30 88 56C87 80 70 94 50 93C30 94 13 80 12 56C10 30 30 20 50 18Z",
  ];
  const accDeOficio = (o, h) => {
    const t = String(o || "").toLowerCase();
    const reglas = [[/revis|audit|calidad|qa|test/, "lupa"], [/arquitect|frontend|ui|ux|diseñ|angular/, "gafas"], [/redact|escrit|correo|document|copy/, "pluma"],
      [/segur|appsec|guardi/, "escudo"], [/plan|estim|sprint|gesti|pm\b|lider|líder/, "portapapeles"], [/explor|investig|research|brief|busc/, "brujula"],
      [/bd|datos|sql|backend|infra|devops/, "casco"], [/soporte|teams|chat|atenci/, "auriculares"]];
    for (const [re, a] of reglas) if (re.test(t)) return a;
    return ["boina", "corbatin", "gafas", "auriculares"][h % 4];
  };
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
  let idM = 0;
  function mascota(a, tam, estado) {
    const h = hash(a.nombre || a.agentType || "?");
    const color = PALETA[a.color] || Object.values(PALETA)[h % 8];
    const cuerpo = CUERPOS[(h >>> 3) % CUERPOS.length];
    const ojo = (h >>> 7) % 3, boca = (h >>> 9) % 3, remate = (h >>> 11) % 4;
    const acc = a.accesorio && ACC_SVG[a.accesorio] ? a.accesorio : accDeOficio(a.oficio || a.descripcion, h);
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
<g class="oj">${ojos}</g>${bocaS}${ACC_SVG[acc](color)}</g>
<g class="ok"><circle cx="84" cy="82" r="11" fill="#3ee08f" stroke="#0b1220" stroke-width="2.5"/><path d="M78 82l4 4 8-8" stroke="#0b1220" stroke-width="3" fill="none" stroke-linecap="round"/></g></svg>`;
    const caja = el("span", { className: "osm-m " + (estado || "reposo") });
    caja.style.width = caja.style.height = tam + "px";
    caja.innerHTML = svg + '<span class="punto"></span>';
    // Cada mascota parpadea a su ritmo (sale del nombre), para que la lista no parpadee al unísono.
    caja.querySelectorAll(".oj,.cu").forEach((g) => { g.style.animationDelay = `-${(h % 4000) / 1000}s`; });
    caja.dataset.agente = a.nombre || "";
    return caja;
  }

  // ---- actividad y estado real
  const hace = (iso) => {
    if (!iso) return "sin uso";
    const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
    if (s < 60) return "hace segundos"; if (s < 3600) return `hace ${Math.round(s / 60)} min`;
    if (s < 86400) return `hace ${Math.round(s / 3600)} h`; return `hace ${Math.round(s / 86400)} d`;
  };
  const actDe = (n) => (ag.datos && ag.datos.actividad && ag.datos.actividad.porTipo[n]) || null;
  const estadoDe = (n) => { const t = actDe(n); if (!t) return { clase: "reposo", texto: "sin uso en 30 días" };
    if (t.corriendo) return { clase: "trabajando", texto: `trabajando · ${hace(t.desde).replace("hace ", "")}` };
    if (t.ultima && Date.now() - Date.parse(t.ultima) < 10 * 60000) return { clase: "listo", texto: `terminó ${hace(t.ultima)}` };
    return { clase: "reposo", texto: hace(t.ultima) }; };
  function aplicarEstados() {
    document.querySelectorAll("#view-config .osm-m[data-agente]").forEach((m) => {
      const e = estadoDe(m.dataset.agente);
      m.classList.remove("reposo", "trabajando", "listo"); m.classList.add(e.clase); m.title = `${m.dataset.agente}: ${e.texto}`;
    });
    document.querySelectorAll("#view-config [data-estado-de]").forEach((s) => { const e = estadoDe(s.dataset.estadoDe); s.textContent = e.texto; s.classList.toggle("vivo", e.clase === "trabajando"); });
  }

  const ag = { datos: null, actual: null, sucio: false };
  const agLista = el("div", { className: "osm-lista" }, el("p", { className: "osm-vacio", textContent: "Cargando…" }));
  const agDet = el("div", { className: "osm-panel osm-det" }, el("p", { className: "osm-vacio", textContent: "Elige un agente o crea uno nuevo." }));
  const bNuevo = el("button", { type: "button", className: "osm-btn prim", textContent: "+ Nuevo agente" });
  vConfig.append(el("div", { className: "osm-col" },
    el("div", { className: "osm-pie-f" }, el("p", { className: "osm-k", textContent: "Agentes", style: "margin:0" }), el("span", { className: "esp" }), bNuevo),
    el("p", { className: "osm-nota", style: "margin:0", textContent: "Cada agente tiene su ficha (oficio, objetivo, meta y límites), su mascota con el estado real y su memoria de conocimiento y experiencia. Los tuyos se editan aquí; los del Personal OS y los de terceros tienen candado. Claude Code toma los cambios en segundos." }),
    el("div", { className: "osm-ag" }, agLista, agDet)));
  const vacioDet = () => agDet.replaceChildren(el("p", { className: "osm-vacio", textContent: "Elige un agente o crea uno nuevo." }));

  async function agCargar(sel) {
    try { ag.datos = await fetch("/api/config/agentes").then((r) => r.json()); }
    catch (e) { agLista.replaceChildren(el("p", { className: "osm-err", textContent: "No pude leer los agentes: " + e.message })); return; }
    agPintar();
    if (sel) { const a = ag.datos.agentes.find((x) => x.nombre === sel); if (a) agVer(a, true); }
  }

  // ---- capa 1: la lista
  function agPintar() {
    agLista.replaceChildren();
    const orden = (a, b) => { const ea = actDe(a.nombre) || {}, eb = actDe(b.nombre) || {};
      return (eb.corriendo ? 1 : 0) - (ea.corriendo ? 1 : 0) || String(eb.ultima || "").localeCompare(String(ea.ultima || "")) || a.nombre.localeCompare(b.nombre); };
    for (const g of Object.keys(AG_GRUPOS)) {
      const l = ag.datos.agentes.filter((a) => a.grupo === g).sort(orden);
      const sec = el("details", { className: "osm-g", open: g !== "terceros" }, el("summary", { textContent: `${AG_GRUPOS[g]} · ${l.length}` }));
      if (!l.length) sec.append(el("p", { className: "osm-vacio", textContent: g === "mios" ? "Todavía no has creado ninguno." : "Ninguno." }));
      for (const a of l) {
        const t = actDe(a.nombre);
        const est = el("span", { className: "s" }); est.dataset.estadoDe = a.nombre;
        const b = el("button", { type: "button", className: "osm-tj", title: a.descripcion || "" },
          mascota(a, 40),
          el("span", { style: "min-width:0" }, el("span", { className: "n", textContent: a.nombre }), el("span", { className: "o", textContent: (a.lema ? `«${a.lema}»` : a.oficio || (a.candado ? "🔒 " : "") + (a.descripcion || "").slice(0, 60)) })),
          el("span", {}, est, el("span", { className: "s", textContent: t && t.usos7 ? `${t.usos7} esta semana` : "" })));
        b.setAttribute("aria-current", String(!!(ag.actual && ag.actual.nombre === a.nombre)));
        b.addEventListener("click", () => agVer(a)); sec.append(b);
      }
      agLista.append(sec);
    }
    aplicarEstados();
  }
  const agPuede = async () => !ag.sucio || confirmar("Cambios sin guardar", "Tienes cambios sin guardar. ¿Los descartas?");

  // ---- capa 2 y 3: la ficha
  async function agVer(a, forzar) {
    if (!forzar && !(await agPuede())) return;
    ag.actual = a; ag.sucio = false; agPintar();
    const t = actDe(a.nombre);
    const sec = (titulo, ...hijos) => el("div", { className: "osm-sec" }, el("h3", { textContent: titulo }), ...hijos);
    const chips = el("div", { className: "osm-chips" },
      el("span", { className: "osm-chip", textContent: a.candado ? `🔒 ${AG_GRUPOS[a.grupo]}` : "✎ tuyo" }),
      a.oficio ? el("span", { className: "osm-chip", textContent: a.oficio, style: `color:${PALETA[a.color] || "var(--synapse)"};border-color:${PALETA[a.color] || "var(--synapse)"}55` }) : null,
      el("span", { className: "osm-chip", textContent: "modelo · " + (AG_MODELOS[a.modelo] || a.modelo) }),
      a.memoria ? el("span", { className: "osm-chip", textContent: "🧠 memoria" }) : null);
    const estado = el("span", { className: "s" }); estado.dataset.estadoDe = a.nombre;
    const heroe = el("div", { className: "osm-heroe" }, mascota(a, 112),
      el("div", { style: "min-width:0" }, el("h2", { textContent: a.nombre }), a.lema ? el("p", { className: "osm-lema", textContent: `«${a.lema}»` }) : null, chips,
        el("p", { className: "osm-nota", style: "margin-top:8px" }, estado)));
    const herr = a.herramientas || [];
    const equipo = el("div", { className: "osm-herr" }, ...(herr.length ? herr : ["todas (hereda las de la sesión)"]).map((h) => el("span", { className: RIESGO.escribe.has(h) ? "w" : RIESGO.ejecuta.has(h) ? "x" : "", textContent: h, title: RIESGO.escribe.has(h) ? "escribe archivos" : RIESGO.ejecuta.has(h) ? "ejecuta comandos" : "" })));
    const ficha = el("div", {},
      a.objetivo ? el("div", { className: "osm-campo" }, el("span", { className: "l", textContent: "Objetivo" }), el("div", { textContent: a.objetivo })) : null,
      a.meta ? el("div", { className: "osm-campo" }, el("span", { className: "l", textContent: "Meta de cierre" }), el("div", { textContent: a.meta })) : null,
      a.limites && a.limites.length ? el("div", { className: "osm-campo" }, el("span", { className: "l", textContent: "Límites" }), el("ul", { className: "osm-lim" }, ...a.limites.map((l) => el("li", { textContent: l })))) : null,
      el("div", { className: "osm-campo" }, el("span", { className: "l", textContent: "Cuándo lo llama Claude" }), el("div", { textContent: a.descripcion || a.error || "—" })));
    const act = sec("Actividad (de tus hooks, últimos 30 días)",
      el("div", { className: "osm-num" }, el("div", {}, String(t ? t.usos7 : 0), el("small", { textContent: "esta semana" })), el("div", {}, String(t ? t.usos30 : 0), el("small", { textContent: "en 30 días" })), el("div", {}, t ? hace(t.ultima) : "—", el("small", { textContent: "última vez" }))),
      t && t.ejecuciones.length ? el("table", { className: "osm-tabla" }, ...t.ejecuciones.map((x) => el("tr", {},
        el("td", { textContent: new Date(x.inicio).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) }),
        el("td", { textContent: x.duracion_s == null ? "sin cierre" : x.duracion_s < 60 ? `${x.duracion_s} s` : `${Math.round(x.duracion_s / 60)} min` }),
        el("td", { textContent: x.tarea || "tarea no registrada" }), el("td", { textContent: "sesión " + (x.sesion || "?") })))) : el("p", { className: "osm-vacio", textContent: "Sin ejecuciones registradas." }));
    const mem = el("div", {});
    const crudo = el("details", { className: "osm-crudo osm-sec" }, el("summary", { textContent: "Registro (instrucciones completas)" }), el("div", { className: "osm-ver", style: "margin-top:8px", textContent: a.instrucciones || "" }));
    const pie = a.candado ? el("p", { className: "osm-nota", textContent: a.grupo === "propios" ? "Lo mantiene el plugin del Personal OS: un cambio a mano se pierde en la próxima actualización." : "Lo mantiene otra herramienta o lo instalaste aparte. No se edita desde aquí." })
      : el("div", { className: "osm-pie-f", style: "margin-top:14px" }, el("button", { type: "button", className: "osm-btn prim", textContent: "Editar ficha", onclick: () => agForm(a) }));
    agDet.replaceChildren(heroe, ficha, sec("Equipo (herramientas)", equipo), act, mem, crudo, pie);
    aplicarEstados();
    if (a.memoria) agMemoria(a, mem);
  }

  // ---- memoria: conocimiento (del usuario) y experiencia (del agente)
  async function agMemoria(a, caja) {
    let m; try { m = await fetch(`/api/config/memoria?agente=${encodeURIComponent(a.nombre)}`).then((r) => r.json()); } catch (_) { return; }
    const lista = (g) => m.archivos.filter((f) => f.grupo === g).map((f) => el("button", { type: "button", onclick: () => agArchivo(a, f) },
      el("span", { textContent: f.titulo }), el("small", { textContent: `${Math.max(1, Math.round(f.bytes / 1024))} KB · ${hace(f.modificado)}` })));
    const con = lista("conocimiento"), exp = lista("experiencia");
    caja.replaceChildren(el("div", { className: "osm-sec" }, el("h3", { textContent: `Memoria · índice ${m.lineas_indice}/200 líneas` }),
      el("div", { className: "osm-dosc" },
        el("div", {}, el("p", { className: "osm-k", textContent: "Conocimiento (lo escribes tú)" }), el("div", { className: "osm-mem" }, ...(con.length ? con : [el("p", { className: "osm-vacio", textContent: "Sin conocimiento todavía." })])),
          a.candado ? null : el("button", { type: "button", className: "osm-btn", style: "margin-top:8px", textContent: "+ Conocimiento", onclick: () => agConocimiento(a, null) })),
        el("div", {}, el("p", { className: "osm-k", textContent: "Experiencia (la escribe el agente)" }), el("div", { className: "osm-mem" }, ...(exp.length ? exp : [el("p", { className: "osm-vacio", textContent: "Aún no ha guardado experiencia." })])))),
      m.indice ? el("details", { className: "osm-crudo", style: "margin-top:10px" }, el("summary", { textContent: "MEMORY.md (lo que el agente ve al arrancar)" }), el("div", { className: "osm-ver", style: "margin-top:8px", textContent: m.indice })) : null));
  }
  async function agArchivo(a, f) {
    const r = await fetch(`/api/config/memoria?agente=${encodeURIComponent(a.nombre)}&ruta=${encodeURIComponent(f.ruta)}`).then((x) => x.json());
    const editable = f.grupo === "conocimiento" && !a.candado;
    agDet.replaceChildren(el("h2", { textContent: f.titulo }), el("span", { className: "osm-etq", textContent: `${a.nombre} · ${f.ruta}` }),
      el("div", { className: "osm-ver", style: "max-height:60vh", textContent: r.contenido || "" }),
      el("div", { className: "osm-pie-f", style: "margin-top:12px" },
        el("button", { type: "button", className: "osm-btn", textContent: "← Volver a la ficha", onclick: () => agVer(a, true) }),
        editable ? el("button", { type: "button", className: "osm-btn prim", textContent: "Editar", onclick: () => agConocimiento(a, { slug: f.ruta.split("/")[1].slice(0, -3), titulo: f.titulo, contenido: r.contenido }) }) : null,
        el("span", { className: "esp" }),
        editable ? el("button", { type: "button", className: "osm-btn peligro", textContent: "Borrar", onclick: async () => {
          if (!(await confirmar(`Borrar «${f.titulo}»`, "Se mueve a la papelera del Personal OS y sale del índice del agente."))) return;
          const x = await accion("agente-conocimiento-borrar", { agente: a.nombre, slug: f.ruta.split("/")[1].slice(0, -3) }); decir(x.mensaje, x.ok ? "ok" : "error"); if (x.ok) agVer(a, true);
        } }) : null));
  }
  const slugDe = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  function agConocimiento(a, c) {
    ag.sucio = false;
    const iT = el("input", { type: "text", id: "osm-c-t", value: c ? c.titulo : "", placeholder: "p. ej. Convenciones del repo de lista de espera" });
    const iS = el("input", { type: "text", id: "osm-c-s", value: c ? c.slug : "", spellcheck: false, placeholder: "se arma solo desde el título" });
    const iC = el("textarea", { id: "osm-c-c", value: c ? c.contenido.replace(/^#\s+.*\n+/, "") : "", placeholder: "Markdown: reglas, decisiones, ejemplos, enlaces a las guías…" });
    iC.style.minHeight = "300px";
    let slugTocado = !!c;
    iS.addEventListener("input", () => { slugTocado = true; });
    iT.addEventListener("input", () => { if (!slugTocado) iS.value = slugDe(iT.value); });
    const err = el("p", { className: "osm-err", hidden: true, role: "alert" }), sucio = el("span", { className: "osm-sucio" });
    const campo = (l, ctl, ay) => el("div", { className: "osm-campo" }, el("label", { htmlFor: ctl.id, textContent: l }), ctl, ay ? el("small", { textContent: ay }) : null);
    const f = el("div", {}, el("h2", { textContent: c ? "Editar conocimiento" : "Nuevo conocimiento" }), el("span", { className: "osm-etq mio", textContent: `para ${a.nombre}` }), err,
      campo("Título", iT), campo("Archivo", iS, "Queda en conocimiento/<archivo>.md y se agrega solo al índice MEMORY.md."),
      campo("Contenido", iC, "El agente lo lee cuando aplica a la tarea. Mejor un tema por archivo y sin secretos ni datos de personas."),
      el("div", { className: "osm-pie-f" },
        el("button", { type: "button", className: "osm-btn prim", textContent: "Guardar", onclick: async () => {
          err.hidden = true;
          const x = await accion("agente-conocimiento", { agente: a.nombre, slug: iS.value.trim(), titulo: iT.value, contenido: iC.value, original: c ? c.slug : null });
          if (!x.ok) { err.textContent = x.mensaje; err.hidden = false; return; }
          ag.sucio = false; decir(x.mensaje, "ok"); agVer(a, true);
        } }),
        el("button", { type: "button", className: "osm-btn", textContent: "Cancelar", onclick: async () => { if (await agPuede()) { ag.sucio = false; agVer(a, true); } } }), sucio));
    f.addEventListener("input", () => { ag.sucio = true; sucio.textContent = "● Sin guardar"; });
    agDet.replaceChildren(f); iT.focus();
  }

  // ---- formulario de la ficha (solo los tuyos)
  function agForm(a) {
    const nuevo = !a; ag.actual = a || null; ag.sucio = false;
    const herr = new Set((a && a.herramientas) || []);
    const G = ag.datos.grupos_herramientas;
    const grupos = Object.keys(AG_HERR).filter((g) => (G[g] || []).every((t) => herr.has(t)));
    const enG = new Set(grupos.flatMap((g) => G[g]));
    const id = (s) => "osm-f-" + s;
    const campo = (lab, ctl, ayuda) => el("div", { className: "osm-campo" }, el("label", { htmlFor: ctl.id, textContent: lab }), ctl, ayuda ? el("small", { textContent: ayuda }) : null);
    const txt = (k, v, ph) => el("input", { type: "text", id: id(k), value: v || "", autocomplete: "off", placeholder: ph || "" });
    const iN = txt("n", a && a.nombre, "p. ej. revisor-de-correos"); iN.spellcheck = false;
    const iOf = txt("of", a && a.oficio, "p. ej. Arquitecto frontend");
    const iLe = txt("le", a && a.lema, "su frase, p. ej. «Si no lo medí, no lo optimicé»");
    const iOb = el("textarea", { id: id("ob"), className: "corta", value: a ? a.objetivo : "", placeholder: "Para qué existe: el trabajo que hace." });
    const iMe = el("textarea", { id: id("me"), className: "corta", value: a ? a.meta : "", placeholder: "Cuándo da por terminado: «entrega X con Y verificado»." });
    const iLi = el("textarea", { id: id("li"), className: "corta", value: a ? (a.limites || []).join("\n") : "", placeholder: "Uno por línea: lo que nunca hace (p. ej. «no escribe en bases de datos»)." });
    const iD = el("textarea", { id: id("d"), className: "corta", value: a ? a.descripcion : "", placeholder: "Qué hace y cuándo debe llamarlo Claude." });
    const iO = txt("o", [...herr].filter((t) => !enG.has(t)).join(", "), "nombres exactos separados por coma, p. ej. mcp__servidor__herramienta"); iO.spellcheck = false;
    const iM = el("select", { id: id("m") }, ...Object.entries(AG_MODELOS).map(([v, t]) => el("option", { value: v, textContent: t, selected: (a ? a.modelo : "inherit") === v })));
    const iAc = el("select", { id: id("ac") }, el("option", { value: "", textContent: "Según el oficio (automático)" }), ...ag.datos.accesorios.map((x) => el("option", { value: x, textContent: ACC_ES[x] || x, selected: a && a.accesorio === x })));
    const iMem = el("input", { type: "checkbox", id: id("mem"), checked: !!(a && a.memoria) });
    const iI = el("textarea", { id: id("i"), value: a ? a.instrucciones : "", placeholder: "Eres… Tu trabajo es… Devuelve…" });
    const colorIni = (a && a.color) || "";
    const colores = el("div", { className: "osm-colores", role: "radiogroup", ariaLabel: "Color" },
      el("label", { title: "automático" }, el("input", { type: "radio", name: "osm-col", value: "", checked: !colorIni, ariaLabel: "automático" }), el("span", { style: "background:conic-gradient(" + Object.values(PALETA).join(",") + ")" })),
      ...ag.datos.colores.map((c) => el("label", { title: COLOR_ES[c] }, el("input", { type: "radio", name: "osm-col", value: c, checked: colorIni === c, ariaLabel: COLOR_ES[c] }), el("span", { style: `background:${PALETA[c]}` }))));
    const cas = el("div", { className: "osm-casillas", role: "group", ariaLabel: "Herramientas" },
      ...Object.entries(AG_HERR).map(([g, t]) => el("label", {}, el("input", { type: "checkbox", value: g, checked: grupos.includes(g) }), `${t} (${G[g].join(", ")})`)));
    const prev = el("div", { className: "osm-prev" });
    const pintarPrev = () => {
      const col = (colores.querySelector("input:checked") || {}).value || "";
      prev.replaceChildren(mascota({ nombre: iN.value || "nuevo", oficio: iOf.value, color: col, accesorio: iAc.value }, 84),
        el("div", {}, el("b", { textContent: iN.value || "nuevo-agente", style: "font-family:var(--mono)" }), el("p", { className: "osm-lema", textContent: iLe.value ? `«${iLe.value}»` : "sin lema" }),
          el("small", { className: "osm-nota", textContent: "La forma y la cara salen del nombre; el accesorio, del oficio." })));
    };
    const sucio = el("span", { className: "osm-sucio" });
    const err = el("p", { className: "osm-err", hidden: true, role: "alert" });
    const bG = el("button", { type: "button", className: "osm-btn prim", textContent: "Guardar" });
    const bD = el("button", { type: "button", className: "osm-btn", textContent: nuevo ? "Cancelar" : "Descartar cambios" });
    const bB = nuevo ? null : el("button", { type: "button", className: "osm-btn peligro", textContent: "Borrar agente" });
    const f = el("div", {}, el("h2", { textContent: nuevo ? "Nuevo agente" : `Ficha de ${a.nombre}` }), el("span", { className: "osm-etq mio", textContent: nuevo ? "nuevo · tuyo" : "✎ tuyo" }), err, prev,
      el("div", { className: "osm-dosc" }, campo("Nombre", iN, "Minúsculas, números y guiones. Es como Claude lo invoca."), campo("Oficio", iOf, "La etiqueta bajo el nombre (como en Grok).")),
      campo("Lema", iLe, "Su personalidad en una línea."),
      el("div", { className: "osm-dosc" }, el("div", { className: "osm-campo" }, el("span", { className: "l", textContent: "Color (el oficial de Claude Code)" }), colores), campo("Accesorio", iAc)),
      campo("Objetivo", iOb), campo("Meta de cierre", iMe), campo("Límites", iLi),
      campo("Cuándo lo llama Claude", iD, "Claude lee esto para decidir si lo llama: di qué hace y en qué situaciones."),
      el("div", { className: "osm-campo" }, el("span", { className: "l", textContent: "Herramientas" }), cas, el("small", { textContent: "Sin ninguna marcada ni escrita, el agente hereda todas las de la sesión." })),
      el("div", { className: "osm-dosc" }, campo("Otras herramientas", iO), campo("Modelo", iM)),
      el("div", { className: "osm-campo" }, el("label", { style: "display:flex;gap:8px;align-items:center;text-transform:none;letter-spacing:0;font:13px var(--sans);color:var(--ink)" }, iMem, "🧠 Memoria persistente: conocimiento (lo escribes tú) y experiencia (la escribe el agente)"),
        el("small", { textContent: "Activa la memoria nativa de Claude Code (memory: user) en ~/.claude/agent-memory/<agente>/ y le agrega al agente las reglas para usarla." })),
      campo("Instrucciones", iI, "El prompt del agente: quién es, qué hace, qué no hace y qué devuelve."),
      el("div", { className: "osm-pie-f" }, bG, bD, sucio, el("span", { className: "esp" }), bB));
    agDet.replaceChildren(f); pintarPrev();
    f.addEventListener("input", () => { ag.sucio = true; sucio.textContent = "● Sin guardar"; pintarPrev(); });
    f.addEventListener("change", pintarPrev);
    bD.addEventListener("click", async () => { if (!(await agPuede())) return; ag.sucio = false; if (nuevo) { ag.actual = null; vacioDet(); agPintar(); } else agVer(a, true); });
    bG.addEventListener("click", async () => {
      err.hidden = true; bG.setAttribute("aria-busy", "true");
      const c = { nombre: iN.value.trim(), descripcion: iD.value, instrucciones: iI.value, modelo: iM.value, otras: iO.value,
        grupos: [...cas.querySelectorAll("input:checked")].map((x) => x.value), original: nuevo ? null : a.nombre,
        oficio: iOf.value, lema: iLe.value, objetivo: iOb.value, meta: iMe.value, limites: iLi.value,
        color: (colores.querySelector("input:checked") || {}).value || "", accesorio: iAc.value, memoria: iMem.checked };
      try {
        const r = await accion("agente-guardar", c);
        if (!r.ok) { err.textContent = r.mensaje; err.hidden = false; err.scrollIntoView({ block: "nearest" }); decir("agente: " + r.mensaje, "error"); return; }
        ag.sucio = false; decir(r.mensaje, "ok"); await agCargar(c.nombre);
      } catch (e) { err.textContent = e.message; err.hidden = false; }
      finally { bG.removeAttribute("aria-busy"); }
    });
    if (bB) bB.addEventListener("click", async () => {
      if (!(await confirmar(`Borrar «${a.nombre}»`, "Se mueve a la papelera del Personal OS (no se pierde) y Claude Code deja de usarlo en unos segundos. Su memoria se conserva."))) return;
      const r = await accion("agente-borrar", { nombre: a.nombre }); decir(r.mensaje, r.ok ? "ok" : "error");
      if (r.ok) { ag.sucio = false; ag.actual = null; vacioDet(); await agCargar(); }
    });
    iN.focus();
  }
  bNuevo.addEventListener("click", async () => { if (await agPuede()) { ag.actual = null; if (!ag.datos) await agCargar(); agPintar(); agForm(null); } });
  addEventListener("beforeunload", (e) => { if (ag.sucio) { e.preventDefault(); e.returnValue = ""; } });
  // #config&nuevo abre directo el formulario; #config&<agente> abre su ficha.
  const hashConfig = () => { const m = location.hash.match(/^#config[&/](.+)$/); return m ? decodeURIComponent(m[1]) : null; };
  if (hashConfig()) agCargar().then(() => { const h = hashConfig(); if (h === "nuevo") agForm(null); else { const a = ag.datos.agentes.find((x) => x.nombre === h); if (a) agVer(a, true); } });

  // Estado real cada 15 s mientras Config está a la vista: solo cambia mascotas y textos, nunca un formulario (CO-096).
  setInterval(async () => {
    if (document.hidden || !vConfig.classList.contains("active") || !ag.datos) return;
    try { ag.datos.actividad = await fetch("/api/config/actividad").then((r) => r.json()); aplicarEstados(); } catch (_) { /* el pie avisa */ }
  }, 15000);

  // ------------------------------------------------------------ refresco: cada 30 s solo con la página visible
  let reloj = null;
  const prog = () => { clearInterval(reloj); if (!document.hidden) reloj = setInterval(refrescar, 30000); };
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refrescar(); prog(); });
  refrescar(); prog();
})();
