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

  // ------------------------------------------------------------ CONFIG · agentes
  const AG_GRUPOS = { mios: "Míos", propios: "Propios del Personal OS", terceros: "De terceros" };
  const AG_HERR = { lectura: "Leer archivos", edicion: "Editar archivos", terminal: "Terminal", web: "Web" };
  const AG_MODELOS = { inherit: "El de la sesión", sonnet: "Sonnet", opus: "Opus", haiku: "Haiku" };
  const ag = { datos: null, actual: null, sucio: false };
  const agLista = el("div", { className: "osm-lista" }, el("p", { className: "osm-vacio", textContent: "Cargando…" }));
  const agDet = el("div", { className: "osm-panel osm-det" }, el("p", { className: "osm-vacio", textContent: "Elige un agente o crea uno nuevo." }));
  const bNuevo = el("button", { type: "button", className: "osm-btn prim", textContent: "+ Nuevo agente" });
  vConfig.append(el("div", { className: "osm-col" },
    el("div", { className: "osm-pie-f" }, el("p", { className: "osm-k", textContent: "Agentes", style: "margin:0" }), el("span", { className: "esp" }), bNuevo),
    el("p", { className: "osm-nota", style: "margin:0", textContent: "Los tuyos se crean, editan y borran aquí. Los propios del Personal OS y los de terceros tienen candado: los mantiene su actualización. Un agente nuevo o editado aparece en la próxima sesión de Claude." }),
    el("div", { className: "osm-ag" }, agLista, agDet)));
  const vacioDet = () => agDet.replaceChildren(el("p", { className: "osm-vacio", textContent: "Elige un agente o crea uno nuevo." }));

  async function agCargar(sel) {
    try { ag.datos = await fetch("/api/config/agentes").then((r) => r.json()); }
    catch (e) { agLista.replaceChildren(el("p", { className: "osm-err", textContent: "No pude leer los agentes: " + e.message })); return; }
    agPintar();
    if (sel) { const a = ag.datos.agentes.find((x) => x.nombre === sel); if (a) agVer(a, true); }
  }
  function agPintar() {
    agLista.replaceChildren();
    for (const g of Object.keys(AG_GRUPOS)) {
      const l = ag.datos.agentes.filter((a) => a.grupo === g);
      const sec = el("div", {}, el("h3", { textContent: `${AG_GRUPOS[g]} · ${l.length}` }));
      if (!l.length) sec.append(el("p", { className: "osm-vacio", textContent: g === "mios" ? "Todavía no has creado ninguno." : "Ninguno." }));
      for (const a of l) {
        const b = el("button", { type: "button", className: "osm-it", title: a.descripcion || "" }, el("span", { className: "n", textContent: a.nombre }), el("span", { className: "i", textContent: a.candado ? "🔒" : "✎" }));
        b.setAttribute("aria-current", String(!!(ag.actual && ag.actual.nombre === a.nombre)));
        b.addEventListener("click", () => agVer(a)); sec.append(b);
      }
      agLista.append(sec);
    }
  }
  const agPuede = async () => !ag.sucio || confirmar("Cambios sin guardar", "Tienes cambios sin guardar en este agente. ¿Los descartas?");
  async function agVer(a, forzar) {
    if (!forzar && !(await agPuede())) return;
    ag.actual = a; ag.sucio = false; agPintar();
    if (!a.candado) return agForm(a);
    const campo = (l, v, cls) => el("div", { className: "osm-campo" }, el("span", { className: "l", textContent: l }), el("div", { className: cls || "", textContent: v }));
    agDet.replaceChildren(el("h2", { textContent: a.nombre }), el("span", { className: "osm-etq", textContent: "🔒 " + AG_GRUPOS[a.grupo] }),
      campo("Cuándo usarlo", a.descripcion || a.error || "—"),
      campo("Herramientas", (a.herramientas || []).join(", ") || "todas (hereda las de la sesión)"),
      campo("Modelo", AG_MODELOS[a.modelo] || a.modelo), campo("Instrucciones", a.instrucciones || "", "osm-ver"),
      el("p", { className: "osm-nota", textContent: a.grupo === "propios" ? "Lo mantiene el plugin del Personal OS: un cambio a mano se pierde en la próxima actualización." : "Lo mantiene otra herramienta o lo instalaste aparte. No se edita desde aquí." }));
  }
  function agForm(a) {
    const nuevo = !a; ag.actual = a || null; ag.sucio = false;
    const herr = new Set((a && a.herramientas) || []);
    const G = ag.datos.grupos_herramientas;
    const grupos = Object.keys(AG_HERR).filter((g) => (G[g] || []).every((t) => herr.has(t)));
    const enG = new Set(grupos.flatMap((g) => G[g]));
    const id = (s) => "osm-f-" + s;
    const campo = (lab, ctl, ayuda) => el("div", { className: "osm-campo" }, el("label", { htmlFor: ctl.id, textContent: lab }), ctl, ayuda ? el("small", { textContent: ayuda }) : null);
    const iN = el("input", { type: "text", id: id("n"), value: a ? a.nombre : "", autocomplete: "off", spellcheck: false, placeholder: "p. ej. revisor-de-correos" });
    const iD = el("textarea", { id: id("d"), className: "corta", value: a ? a.descripcion : "", placeholder: "Qué hace y cuándo debe llamarlo Claude." });
    const iO = el("input", { type: "text", id: id("o"), value: [...herr].filter((t) => !enG.has(t)).join(", "), autocomplete: "off", spellcheck: false, placeholder: "nombres exactos separados por coma, p. ej. mcp__servidor__herramienta" });
    const iM = el("select", { id: id("m") }, ...Object.entries(AG_MODELOS).map(([v, t]) => el("option", { value: v, textContent: t, selected: (a ? a.modelo : "inherit") === v })));
    const iI = el("textarea", { id: id("i"), value: a ? a.instrucciones : "", placeholder: "Eres… Tu trabajo es… Devuelve…" });
    const cas = el("div", { className: "osm-casillas", role: "group", ariaLabel: "Herramientas" },
      ...Object.entries(AG_HERR).map(([g, t]) => el("label", {}, el("input", { type: "checkbox", value: g, checked: grupos.includes(g) }), `${t} (${G[g].join(", ")})`)));
    const sucio = el("span", { className: "osm-sucio" });
    const err = el("p", { className: "osm-err", hidden: true, role: "alert" });
    const bG = el("button", { type: "button", className: "osm-btn prim", textContent: "Guardar" });
    const bD = el("button", { type: "button", className: "osm-btn", textContent: nuevo ? "Cancelar" : "Descartar cambios" });
    const bB = nuevo ? null : el("button", { type: "button", className: "osm-btn peligro", textContent: "Borrar" });
    const f = el("div", {}, el("h2", { textContent: nuevo ? "Nuevo agente" : a.nombre }), el("span", { className: "osm-etq mio", textContent: nuevo ? "nuevo · tuyo" : "✎ tuyo" }), err,
      campo("Nombre", iN, "Minúsculas, números y guiones. Es como Claude lo invoca."),
      campo("Cuándo usarlo", iD, "Claude lee esto para decidir si lo llama: di qué hace y en qué situaciones."),
      el("div", { className: "osm-campo" }, el("span", { className: "l", textContent: "Herramientas" }), cas, el("small", { textContent: "Sin ninguna marcada ni escrita, el agente hereda todas las de la sesión." })),
      campo("Otras herramientas", iO), campo("Modelo", iM),
      campo("Instrucciones", iI, "El prompt del agente: quién es, qué hace, qué no hace y qué devuelve."),
      el("div", { className: "osm-pie-f" }, bG, bD, sucio, el("span", { className: "esp" }), bB));
    agDet.replaceChildren(f);
    f.addEventListener("input", () => { ag.sucio = true; sucio.textContent = "● Sin guardar"; });
    bD.addEventListener("click", async () => { if (!(await agPuede())) return; ag.sucio = false; if (nuevo) { ag.actual = null; vacioDet(); agPintar(); } else agVer(a, true); });
    bG.addEventListener("click", async () => {
      err.hidden = true; bG.setAttribute("aria-busy", "true");
      const c = { nombre: iN.value.trim(), descripcion: iD.value, instrucciones: iI.value, modelo: iM.value, otras: iO.value,
        grupos: [...cas.querySelectorAll("input:checked")].map((x) => x.value), original: nuevo ? null : a.nombre };
      try {
        const r = await accion("agente-guardar", c);
        if (!r.ok) { err.textContent = r.mensaje; err.hidden = false; decir("agente: " + r.mensaje, "error"); return; }
        ag.sucio = false; decir(r.mensaje, "ok"); await agCargar(c.nombre);
      } catch (e) { err.textContent = e.message; err.hidden = false; }
      finally { bG.removeAttribute("aria-busy"); }
    });
    if (bB) bB.addEventListener("click", async () => {
      if (!(await confirmar(`Borrar «${a.nombre}»`, "Se mueve a la papelera del Personal OS (no se pierde) y deja de cargarse desde la próxima sesión de Claude."))) return;
      const r = await accion("agente-borrar", { nombre: a.nombre }); decir(r.mensaje, r.ok ? "ok" : "error");
      if (r.ok) { ag.sucio = false; ag.actual = null; vacioDet(); await agCargar(); }
    });
    iN.focus();
  }
  bNuevo.addEventListener("click", async () => { if (await agPuede()) { ag.actual = null; if (!ag.datos) await agCargar(); agPintar(); agForm(null); } });
  addEventListener("beforeunload", (e) => { if (ag.sucio) { e.preventDefault(); e.returnValue = ""; } });
  // #config&nuevo (o #config/nuevo) abre directo el formulario.
  if (/^#config[&/]nuevo/.test(location.hash)) agCargar().then(() => agForm(null));

  // ------------------------------------------------------------ refresco: cada 30 s solo con la página visible
  let reloj = null;
  const prog = () => { clearInterval(reloj); if (!document.hidden) reloj = setInterval(refrescar, 30000); };
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refrescar(); prog(); });
  refrescar(); prog();
})();
