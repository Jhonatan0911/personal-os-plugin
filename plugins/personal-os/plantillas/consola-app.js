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
  // Generales y MANDOS arriba; CONFIG en su bloque (propuesta A del 25/11/2026: pestañas, filas sin borde, ajustes
  // planos). Una sola definición por componente: nada de capas por ronda ni !important salvo [hidden].
  document.head.append(el("style", { textContent: `
:root{--ok:#3ee08f;--on-acento:#04201d;--r1-suave:rgba(246,199,96,.08);--r3-suave:rgba(255,95,126,.08);--r3-borde:rgba(255,95,126,.45)}
#view-oficina [hidden],#view-config [hidden],#view-mandos [hidden]{display:none!important}
.osm-col{width:min(1080px,100%);margin:0 auto;padding:18px clamp(14px,3vw,26px) 30px;display:flex;flex-direction:column;gap:16px;overflow:auto;flex:1 1 auto;min-height:0}
.osm-k{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0 0 10px}
.osm-panel{background:linear-gradient(180deg,rgba(17,26,41,.75),rgba(15,22,34,.75));border:1px solid var(--line);border-radius:16px;padding:16px}
.osm-dos{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}
.osm-vitals{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.osm-vitals .vital .v{font-size:22px}
.osm-vitals .vital[data-tono=ok] .v{color:var(--ok)}.osm-vitals .vital[data-tono=aviso] .v{color:var(--r1)}.osm-vitals .vital[data-tono=error] .v{color:var(--r3)}
.osm-vitals .vital[data-tono=aviso]::before{background:var(--r1)}.osm-vitals .vital[data-tono=error]::before{background:var(--r3)}
.osm-fila{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 12px;padding:9px 0;border-bottom:1px solid var(--line);font-size:13px}
.osm-fila:last-child{border-bottom:0}.osm-fila .et{color:var(--muted-2)}.osm-fila .val{font-family:var(--mono);margin-left:auto;text-align:right}
.osm-aviso{color:var(--r1)}.osm-error{color:var(--r3)}.osm-ok{color:var(--ok)}
.osm-panel .seg{display:grid;grid-template-columns:repeat(4,1fr);width:100%}
.osm-panel .seg button[aria-pressed="true"]{color:#04121a;background:var(--synapse);box-shadow:0 0 18px rgba(53,224,208,.35)}
.osm-nota{font-size:12.5px;color:var(--muted-2);margin:10px 0 0;line-height:1.5}
.osm-acc{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.osm-b{appearance:none;text-align:left;display:flex;flex-direction:column;gap:3px;background:var(--panel-2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;color:var(--ink);font:inherit;cursor:pointer;transition:.2s}
.osm-b:hover{border-color:var(--synapse);box-shadow:0 0 14px rgba(53,224,208,.12)}.osm-b b{font-size:13.5px;font-weight:600}.osm-b span{font-size:12px;color:var(--muted-2)}
.osm-b[aria-busy=true]{opacity:.55;cursor:progress}
.osm-btn{appearance:none;font-family:var(--mono);font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;background:var(--panel-2);color:var(--ink);border:1px solid var(--line-strong);border-radius:9px;padding:7px 12px;cursor:pointer}
.osm-btn:hover{border-color:var(--synapse)}.osm-btn.prim{background:var(--synapse);color:#04121a;border-color:var(--synapse)}.osm-btn.peligro{color:var(--r3);border-color:rgba(255,95,126,.45)}
:is(.osm-b,.osm-btn):focus-visible{outline:2px solid var(--synapse);outline-offset:2px}
.osm-pie{display:inline-flex;align-items:center;gap:10px}
.osm-pie .luz{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--muted);margin-right:6px}
.osm-pie .luz.on{background:var(--ok);box-shadow:0 0 8px var(--ok)}.osm-pie .luz.off{background:var(--r1)}
.osm-pie button{appearance:none;font:inherit;letter-spacing:inherit;text-transform:inherit;background:none;border:1px solid var(--line-strong);border-radius:8px;color:var(--muted-2);padding:2px 8px;cursor:pointer}
.osm-pie button:hover{color:var(--ink);border-color:var(--synapse)}
#osm-linea{text-transform:none;letter-spacing:.02em}#osm-linea.ok{color:var(--ok)}#osm-linea.error{color:var(--r3)}#osm-linea.trab{color:var(--synapse)}
dialog.osm-dlg{background:var(--panel);color:var(--ink);border:1px solid var(--line-strong);border-radius:16px;padding:20px;max-width:440px}
dialog.osm-dlg::backdrop{background:rgba(3,6,12,.72)}dialog.osm-dlg h2{margin:0 0 8px;font:600 17px var(--sans)}dialog.osm-dlg p{margin:0 0 16px;color:var(--muted-2);font-size:14px;line-height:1.5}
/* botones de los diálogos: los mismos de Config (sans, sin mayúsculas); el diálogo vive en <body> */
dialog.osm-dlg .osm-btn{font:600 12.5px var(--sans);letter-spacing:0;text-transform:none;border-radius:10px;min-height:40px;padding:0 16px;background:transparent;border:1px solid rgba(120,150,200,.45);color:var(--ink)}
dialog.osm-dlg .osm-btn:hover{border-color:var(--synapse)}
dialog.osm-dlg .osm-btn.prim{background:var(--synapse);border-color:var(--synapse);color:var(--on-acento)}
.osm-pie-f{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px}.osm-pie-f .esp{flex:1}
.osm-vacio{color:var(--muted-2);font-size:13px}
.osm-saltar{position:absolute;top:0;left:0;width:1px;height:1px;padding:0;margin:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
button.osm-saltar:focus{position:static;width:auto;height:auto;overflow:visible;clip-path:none;margin:0 0 var(--sp-2,8px);align-self:flex-start;border:1px solid var(--synapse)}
/* barras de desplazamiento de las vistas de la app, con el tema */
#view-config *,#view-mandos *,#view-oficina *{scrollbar-width:thin;scrollbar-color:var(--line-strong) transparent}
#view-config ::-webkit-scrollbar,#view-mandos ::-webkit-scrollbar,#view-oficina ::-webkit-scrollbar{width:6px;height:6px}
#view-config ::-webkit-scrollbar-track,#view-mandos ::-webkit-scrollbar-track,#view-oficina ::-webkit-scrollbar-track{background:transparent}
#view-config ::-webkit-scrollbar-thumb,#view-mandos ::-webkit-scrollbar-thumb,#view-oficina ::-webkit-scrollbar-thumb{background:var(--line-strong);border-radius:6px}
#view-config ::-webkit-scrollbar-thumb:hover,#view-mandos ::-webkit-scrollbar-thumb:hover,#view-oficina ::-webkit-scrollbar-thumb:hover{background:var(--synapse)}
/* la barra de vistas de la consola se desplaza de lado en pantallas angostas; el filtro de ámbito no aplica en Config */
@media (max-width:800px){.seg.tabs{overflow-x:auto;scrollbar-width:none;scroll-padding-inline:12px}.seg.tabs::-webkit-scrollbar{display:none}}
body:has(#view-config.active) .seg.scope,body:has(#view-config.active) .scope-sel{visibility:hidden;pointer-events:none}
.seg.tabs button .osm-ico{width:13px;height:13px;vertical-align:-2px;margin-right:6px}
/* pie de la consola: hasta 1100 px, una sola línea con lo esencial (sin RAM ni página) */
@media (max-width:1100px){footer .osm-pie-extra{display:none}}
/* barra de vistas que se desplaza: degradado solo del lado donde hay más, y nunca arranca con una pestaña cortada */
.seg.tabs.osm-desliza{-webkit-mask-image:none!important;mask-image:none!important;scroll-snap-type:x proximity}
.seg.tabs.osm-desliza button{scroll-snap-align:start}
.seg.tabs.osm-desliza.izq{-webkit-mask-image:linear-gradient(90deg,transparent,#000 20px)!important;mask-image:linear-gradient(90deg,transparent,#000 20px)!important}
.seg.tabs.osm-desliza.der{-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 24px),transparent)!important;mask-image:linear-gradient(90deg,#000 calc(100% - 24px),transparent)!important}
.seg.tabs.osm-desliza.izq.der{-webkit-mask-image:linear-gradient(90deg,transparent,#000 20px,#000 calc(100% - 24px),transparent)!important;mask-image:linear-gradient(90deg,transparent,#000 20px,#000 calc(100% - 24px),transparent)!important}

/* ==================================================================== CONFIG (propuesta A) */
#view-config{color-scheme:dark;--sp-1:4px;--sp-2:8px;--sp-3:12px;--sp-4:16px;--sp-5:24px;--sp-6:32px;
  --fs-xs:11px;--fs-sm:12.5px;--fs-md:14px;--fs-lg:17px;--fs-xl:22px;
  --ink-2:#c4cfdf;--borde:rgba(120,150,200,.45);--suave:rgba(53,224,208,.12);--hover:rgba(120,150,200,.07)}
#view-config .osm-cfg{width:min(1240px,100%);gap:0;padding:var(--sp-5) clamp(16px,3vw,24px) var(--sp-6);font:var(--fs-md)/1.5 var(--sans);scroll-padding-bottom:96px}
.osm-cfg>*{flex-shrink:0}
.osm-cfg-h{margin:0 0 var(--sp-1);font:600 var(--fs-xl)/1.2 var(--sans);color:var(--ink)}
.osm-lede{margin:0 0 var(--sp-5);font-size:var(--fs-sm);color:var(--muted-2);max-width:70ch}
/* pestañas reales: una sección a la vez */
.osm-tabs{display:flex;gap:var(--sp-5);border-bottom:1px solid var(--line);margin:0 0 var(--sp-5);overflow-x:auto;scrollbar-width:none}
.osm-tabs::-webkit-scrollbar{display:none}
.osm-tabs button{appearance:none;background:none;border:0;border-bottom:2px solid transparent;padding:var(--sp-3) 2px;min-height:44px;font:600 var(--fs-md) var(--sans);color:var(--muted-2);cursor:pointer;white-space:nowrap}
.osm-tabs button:hover{color:var(--ink)}
.osm-tabs button[aria-selected=true]{color:var(--ink);border-bottom-color:var(--synapse)}
.osm-tabs .n{font:var(--fs-xs) var(--mono);color:var(--muted);margin-left:6px}
.osm-tabs button:focus-visible{outline:2px solid var(--synapse);outline-offset:-2px;border-radius:6px}
.osm-tp-h{display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp-2) var(--sp-3);margin:0 0 var(--sp-4)}
.osm-tp-h p{margin:0;font-size:var(--fs-sm);color:var(--muted-2);flex:1 1 320px}
/* lista + ficha */
.osm-split{display:grid;grid-template-columns:minmax(280px,360px) 1fr;gap:var(--sp-6);align-items:start}
.osm-lista{position:relative;display:flex;flex-direction:column;min-width:0}
.osm-det{min-width:0}
/* escritorio: la ficha se queda a la vista junto a la lista y se desplaza sola si es larga (al elegir no se mueve la página) */
@media (min-width:901px){.osm-det{position:sticky;top:0;max-height:var(--cfg-h,80vh);overflow:auto;overscroll-behavior:contain;padding-right:var(--sp-2)}}
.osm-search{display:flex;align-items:center;gap:var(--sp-2);background:var(--panel);border:1px solid var(--borde);border-radius:10px;padding:0 var(--sp-3);min-height:42px;margin:0 0 var(--sp-2)}
.osm-search:focus-within{border-color:var(--synapse);outline:2px solid var(--synapse);outline-offset:1px}
.osm-search input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:var(--ink);font:var(--fs-md) var(--sans);min-height:40px}
.osm-search svg{color:var(--muted)}
.osm-cuenta{font:var(--fs-xs) var(--mono);color:var(--muted);margin:0 var(--sp-3) var(--sp-1)}
.osm-grp{display:flex;align-items:center;gap:6px;margin:var(--sp-4) 0 var(--sp-1);padding:0 var(--sp-3);font:600 var(--fs-xs) var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.osm-grp:first-of-type{margin-top:var(--sp-2)}
.osm-ul{list-style:none;margin:0;padding:0}
/* fila: sin borde en reposo; seleccionada con fondo suave y barra turquesa */
.osm-row{appearance:none;position:relative;display:flex;align-items:flex-start;gap:var(--sp-3);width:100%;text-align:left;background:transparent;border:0;border-radius:10px;padding:10px var(--sp-3);color:var(--ink);font:inherit;cursor:pointer;transition:background .15s}
.osm-row:hover{background:var(--hover)}
.osm-row[aria-current=true]{background:var(--suave)}
.osm-row[aria-current=true]::before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:3px;background:var(--synapse)}
.osm-row:focus-visible{outline:2px solid var(--synapse);outline-offset:1px}
.osm-row-c{flex:1;min-width:0}
.osm-row-t{display:block;font:600 var(--fs-md)/1.35 var(--sans);color:var(--ink)}
.osm-row-s{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;margin-top:1px;font-size:var(--fs-sm);line-height:1.4;color:var(--muted-2)}
.osm-row-e{flex:none;font:var(--fs-xs) var(--mono);color:var(--muted);text-align:right;white-space:nowrap;margin-top:3px}
.osm-row-e.vivo{color:var(--synapse)}
.osm-tag{flex:none;font:600 var(--fs-xs) var(--mono);letter-spacing:.04em;color:var(--muted);white-space:nowrap;margin-top:3px}
.osm-row[aria-current=true] .osm-tag{color:var(--synapse)}
.osm-row-d{display:block;margin-top:2px;font:var(--fs-xs) var(--mono);color:var(--muted)}.osm-row-d .vivo,.osm-row-d.vivo{color:var(--synapse)}
.osm-punto{flex:none;width:8px;height:8px;border-radius:50%;background:var(--r1);margin-top:7px}
.osm-row .osm-m{margin-top:1px}
/* grupos plegables de agentes */
details.osm-g>summary{list-style:none;cursor:pointer}
details.osm-g>summary::-webkit-details-marker{display:none}
details.osm-g>summary::before{content:"";width:0;height:0;border-left:5px solid currentColor;border-top:4px solid transparent;border-bottom:4px solid transparent;transition:transform .15s}
details.osm-g[open]>summary::before{transform:rotate(90deg)}
details.osm-g>summary:focus-visible{outline:2px solid var(--synapse);outline-offset:2px;border-radius:6px}
.osm-grp-nota{margin:0 var(--sp-3) var(--sp-1);font-size:var(--fs-sm);color:var(--muted-2)}
/* ficha plana */
.osm-det-h{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px var(--sp-3);margin:0 0 var(--sp-2)}
.osm-ficha-h{margin:0;font:600 var(--fs-xl)/1.2 var(--sans);color:var(--ink);word-break:break-word}
.osm-ficha-h:focus,.osm-ficha-h:focus-visible{outline:none}   /* destino de foco del lector (tabindex -1), no un control */
.osm-slug{font:var(--fs-sm) var(--mono);color:var(--muted)}
.osm-resumen{margin:0 0 var(--sp-4);color:var(--ink-2);max-width:70ch}
details.osm-mas{margin:0 0 var(--sp-4)}
details.osm-mas>summary{display:inline-flex;align-items:center;gap:6px;cursor:pointer;list-style:none;color:var(--synapse);font-weight:500;min-height:32px}
details.osm-mas>summary::-webkit-details-marker{display:none}
details.osm-mas>summary::before{content:"";border-left:5px solid currentColor;border-top:4px solid transparent;border-bottom:4px solid transparent;transition:transform .15s}
details.osm-mas[open]>summary::before{transform:rotate(90deg)}
details.osm-mas>summary:focus-visible{outline:2px solid var(--synapse);outline-offset:2px;border-radius:4px}
.osm-mas-c{margin:var(--sp-2) 0 0;display:grid;gap:var(--sp-2);max-width:70ch}
.osm-mas-c p{margin:0;font-size:var(--fs-sm);color:var(--muted-2);line-height:1.55}.osm-mas-c b{color:var(--ink-2);font-weight:600}
.osm-gh{display:flex;align-items:center;gap:var(--sp-3);margin:var(--sp-5) 0 var(--sp-1);font:600 var(--fs-xs) var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.osm-gh::after{content:"";flex:1;height:1px;background:var(--line)}
.osm-p{margin:0 0 var(--sp-3);color:var(--ink-2);line-height:1.55;max-width:70ch}
.osm-sub{margin:var(--sp-5) 0 var(--sp-2);font:600 var(--fs-md) var(--sans);color:var(--ink)}
.osm-lim{margin:0;padding-left:18px;color:var(--ink-2);line-height:1.6}
.osm-lnk.osm-back{display:none}
.osm-lnk{appearance:none;background:none;border:0;padding:0;color:var(--synapse);font:500 var(--fs-md) var(--sans);cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.osm-lnk:hover{text-decoration:underline;text-underline-offset:3px}.osm-lnk:focus-visible{outline:2px solid var(--synapse);outline-offset:2px;border-radius:4px}
.osm-lnk[disabled]{color:var(--muted);cursor:not-allowed;text-decoration:none}
/* ajustes de paso a producción: planos, dos columnas, sin cajas */
.osm-ajh{display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp-2) var(--sp-4);margin-top:var(--sp-5);padding:var(--sp-3) 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.osm-ajh h4{margin:0;font:600 var(--fs-lg) var(--sans);color:var(--ink)}
.osm-ajh .osm-tag{color:var(--muted);margin:0}
.osm-ajh .st{margin-left:auto;font-size:var(--fs-sm);color:var(--muted-2);display:inline-flex;flex-wrap:wrap;align-items:center;gap:6px}
.osm-ajh .st .pto{color:var(--ok)}.osm-ajh .st.error{color:var(--r3)}.osm-ajh .st.error .pto{color:var(--r3)}
.osm-ajh .st .osm-lnk{font-size:var(--fs-sm)}
.osm-cols{columns:2 300px;column-gap:var(--sp-6);margin-top:var(--sp-4)}
.osm-bloque{break-inside:avoid;padding-bottom:var(--sp-4)}
.osm-cols .osm-gh{margin-top:0}
.osm-chk{display:flex;gap:var(--sp-3);align-items:flex-start;padding:9px 0;min-height:44px;cursor:pointer;color:var(--ink);font-size:var(--fs-md);line-height:1.4}
.osm-chk.hijo{padding-left:32px}
.osm-chk.bloq{cursor:not-allowed;color:var(--muted-2)}
.osm-chk small{display:block;font-size:var(--fs-sm);color:var(--muted-2);margin-top:2px}
#view-config input[type=checkbox]{appearance:none;width:20px;height:20px;margin:1px 0 0;flex:none;border:1.5px solid var(--borde);border-radius:6px;background:transparent;display:grid;place-content:center;cursor:pointer}
#view-config input[type=checkbox]::after{content:"";width:10px;height:6px;border-left:2px solid var(--synapse);border-bottom:2px solid var(--synapse);transform:rotate(-45deg) translate(1px,-1px);opacity:0}
#view-config input[type=checkbox]:checked{border-color:rgba(53,224,208,.7)}
#view-config input[type=checkbox]:checked::after{opacity:1}
#view-config input[type=checkbox]:disabled{border-style:dashed;cursor:not-allowed;opacity:.7}
#view-config input[type=checkbox]:focus-visible{outline:2px solid var(--synapse);outline-offset:2px}
.osm-aviso-l{min-height:1.2em;margin:var(--sp-2) 0 0;font-size:var(--fs-sm);color:var(--r1)}
.osm-nota-i{display:flex;gap:var(--sp-2);align-items:flex-start;margin:var(--sp-3) 0 0;font-size:var(--fs-sm);color:var(--muted-2);line-height:1.5}
.osm-nota-i svg{flex:none;margin-top:1px;color:var(--muted)}
/* campos: rótulo en sans, sin mayúsculas */
.osm-f{display:flex;flex-direction:column;gap:6px;margin-bottom:var(--sp-4);min-width:0}
.osm-f>label,.osm-f>.l{font-size:var(--fs-sm);font-weight:500;color:var(--ink-2)}
.osm-f input[type=text],.osm-f input[type=password],.osm-f select,.osm-f textarea{width:100%;box-sizing:border-box;background:var(--panel);color:var(--ink);border:1px solid var(--borde);border-radius:10px;padding:0 var(--sp-3);min-height:42px;font:var(--fs-md) var(--sans)}
.osm-f textarea{padding:var(--sp-2) var(--sp-3);min-height:190px;resize:vertical;font-family:var(--mono);font-size:var(--fs-sm);line-height:1.5}
.osm-f textarea.corta{min-height:72px;font-family:var(--sans);font-size:var(--fs-md)}
.osm-f :is(input,select,textarea):focus{border-color:var(--synapse)}
.osm-f :is(input,select,textarea):focus-visible{outline:2px solid var(--synapse);outline-offset:1px}
.osm-f small{font-size:var(--fs-sm);color:var(--muted-2)}
.osm-f small.err{color:var(--r3)}
#view-config [aria-invalid=true]{border-color:var(--r3)}
.osm-rej{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 var(--sp-4)}
.osm-pw{position:relative;display:flex;gap:var(--sp-2);align-items:center}.osm-f .osm-pw input{flex:1;min-width:0;font-family:var(--mono);padding-right:52px}
.osm-ibtn{appearance:none;display:grid;place-items:center;width:44px;height:42px;flex:none;border-radius:10px;border:1px solid var(--borde);background:var(--panel);color:var(--ink-2);cursor:pointer}
.osm-ibtn:hover{border-color:var(--synapse)}.osm-ibtn[aria-pressed=true]{color:var(--synapse);border-color:var(--synapse)}
.osm-ibtn:focus-visible{outline:2px solid var(--synapse);outline-offset:2px}
.osm-ojo-t{position:absolute;right:64px;top:50%;transform:translateY(-50%);pointer-events:none;font:var(--fs-xs) var(--mono);color:var(--muted)}
.osm-toggles{display:flex;flex-wrap:wrap;gap:var(--sp-2)}
.osm-pill{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line-strong);border-radius:999px;background:transparent;color:var(--ink-2);padding:2px var(--sp-2);font:var(--fs-xs) var(--sans);white-space:nowrap}
.osm-pill.mono{font-family:var(--mono);border-radius:7px}
.osm-pill.w{border-color:rgba(246,199,96,.45);color:var(--r1)}.osm-pill.x{border-color:var(--r3-borde);color:var(--r3)}
.osm-pill.osm-tg{appearance:none;color:var(--ink);border-color:var(--borde);padding:0 var(--sp-3);min-height:36px;font-size:var(--fs-sm);cursor:pointer}
.osm-tg:hover{border-color:var(--synapse)}
.osm-tg[aria-pressed=true]{border-color:var(--synapse);color:var(--synapse);background:var(--suave)}
.osm-tg.prod[aria-pressed=true]{border-color:var(--r3);color:var(--r3);background:var(--r3-suave)}
.osm-tg.add{border-style:dashed;color:var(--muted-2)}
.osm-tg:focus-visible{outline:2px solid var(--synapse);outline-offset:2px}
.osm-nueva-e{display:flex;gap:var(--sp-2);align-items:center;flex-wrap:wrap;margin-top:var(--sp-2)}.osm-nueva-e input{flex:1;min-width:160px}
/* tabla de permisos: radios propios con 44 px de área táctil */
table.osm-perm{width:100%;border-collapse:collapse}
.osm-perm th{font:600 var(--fs-xs) var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);text-align:center;padding:var(--sp-2) var(--sp-1);border-bottom:1px solid var(--line)}
.osm-perm th:first-child{text-align:left}
.osm-perm td{border-bottom:1px solid var(--line);padding:0;text-align:center}
.osm-perm th[scope=row]{text-align:left;padding:10px var(--sp-1);font:600 var(--fs-md) var(--sans);letter-spacing:0;text-transform:none;color:var(--ink);border-bottom:1px solid var(--line)}
.osm-perm th[scope=row] small{display:block;font:400 var(--fs-sm) var(--sans);color:var(--muted-2)}
.osm-perm label{display:grid;place-items:center;min-width:44px;min-height:52px;cursor:pointer}
.osm-perm label.no{cursor:not-allowed}
.osm-perm input{appearance:none;width:20px;height:20px;margin:0;border-radius:50%;border:1.5px solid var(--borde);display:grid;place-content:center;cursor:pointer;background:transparent}
.osm-perm input:checked{border-color:var(--synapse)}
.osm-perm input:checked::after{content:"";width:10px;height:10px;border-radius:50%;background:var(--synapse)}
.osm-perm input:disabled{border-style:dashed;cursor:not-allowed}
.osm-perm input:disabled:checked{border-color:var(--r1)}.osm-perm input:disabled:checked::after{background:var(--r1)}
.osm-perm input:focus-visible{outline:2px solid var(--synapse);outline-offset:3px}
.osm-perm td.osm-perm-script{text-align:left;padding:10px var(--sp-2);color:var(--muted-2);font:400 var(--fs-sm) var(--sans)}
.osm-perm .sh{display:none}.osm-perm abbr{text-decoration:none;cursor:help}
.osm-aviso-c{display:flex;gap:var(--sp-3);align-items:flex-start;border-radius:12px;padding:var(--sp-3) var(--sp-4);margin:0 0 var(--sp-4);font-size:var(--fs-sm);line-height:1.5;color:var(--ink-2);background:var(--r3-suave)}
.osm-aviso-c.amb{background:var(--r1-suave)}
.osm-aviso-c svg{flex:none;margin-top:1px;color:var(--r3)}.osm-aviso-c.amb svg{color:var(--r1)}
/* pie de guardado: [Quitar] … [estado] [Descartar] [Guardar]; fijo abajo mientras hay cambios */
#view-config .osm-btn{font:600 var(--fs-sm) var(--sans);letter-spacing:0;text-transform:none;border-radius:10px;min-height:40px;padding:0 var(--sp-4);background:transparent;border-color:var(--borde)}
#view-config .osm-btn.prim{background:var(--synapse);border-color:var(--synapse);color:var(--on-acento)}
#view-config .osm-btn.q{border-color:transparent;color:var(--r3);padding:0 var(--sp-1)}
#view-config .osm-btn.q:hover{text-decoration:underline;text-underline-offset:3px}
#view-config .osm-btn:disabled{opacity:.45;cursor:not-allowed}
#view-config .osm-btn[aria-busy=true]{cursor:progress}
.osm-pg{display:flex;align-items:center;gap:var(--sp-3);flex-wrap:wrap;margin-top:var(--sp-5);padding-top:var(--sp-4);border-top:1px solid var(--line);background:var(--ground)}
.osm-pg .est{margin-left:auto;font-size:var(--fs-sm);color:var(--muted-2)}
.osm-pg .est.sucio{color:var(--r1)}.osm-pg .est.ok{color:var(--ok)}.osm-pg .est.err{color:var(--r3)}
.osm-pg.sucio{position:sticky;bottom:0;z-index:3;padding-bottom:var(--sp-3);box-shadow:0 -14px 18px -6px var(--ground),0 16px 0 0 var(--ground)}
/* estados: carga, vacío y error */
.osm-esq{height:46px;border-radius:10px;margin:0 0 var(--sp-1);background:linear-gradient(90deg,rgba(255,255,255,.02),rgba(255,255,255,.06),rgba(255,255,255,.02));background-size:200% 100%;animation:osm-brillo 1.2s linear infinite}
@keyframes osm-brillo{from{background-position:200% 0}to{background-position:-200% 0}}
.osm-vacio-caja{display:flex;flex-direction:column;align-items:flex-start;gap:var(--sp-3);padding:var(--sp-6) var(--sp-5);border:1px dashed var(--line-strong);border-radius:14px;max-width:60ch;color:var(--muted-2);line-height:1.5}
.osm-vacio-caja b{color:var(--ink);font-size:var(--fs-lg);font-weight:600}
.osm-err-caja{display:flex;gap:var(--sp-3);align-items:flex-start;padding:var(--sp-3) var(--sp-4);border-radius:12px;background:var(--r3-suave);color:var(--ink-2);font-size:var(--fs-sm);line-height:1.5}
.osm-err-caja>svg{color:var(--r3);flex:none;margin-top:2px}
.osm-err-caja>div{display:grid;gap:var(--sp-2);justify-items:start}
.osm-err-caja b{color:var(--ink);font-size:var(--fs-md)}
.osm-err-caja details summary{cursor:pointer;color:var(--muted-2)}.osm-err-caja code{font:var(--fs-xs) var(--mono);color:var(--muted-2);word-break:break-word}
.osm-err{color:var(--r3);font-size:var(--fs-sm);margin:0 0 var(--sp-3)}
/* ayuda «?» */
.osm-ayuda{appearance:none;position:relative;display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;border:1px solid var(--borde);background:transparent;color:var(--ink-2);font:600 var(--fs-sm) var(--sans);cursor:pointer}
.osm-ayuda::after{content:"";position:absolute;inset:-8px}
.osm-ayuda:hover{border-color:var(--synapse);color:var(--synapse)}.osm-ayuda:focus-visible{outline:2px solid var(--synapse);outline-offset:2px}
dialog.osm-dlg.ancho{max-width:600px}
.osm-ayuda-t p{color:var(--ink-2);font-size:var(--fs-md);line-height:1.55;margin:0 0 var(--sp-3)}.osm-ayuda-t b{color:var(--ink)}
/* agentes: héroe, chips, herramientas, actividad y memoria */
.osm-heroe{display:flex;gap:var(--sp-5);align-items:center;margin:0 0 var(--sp-3)}
.osm-lema{font-style:italic;color:var(--muted-2);margin:var(--sp-1) 0 0;font-size:var(--fs-md)}
.osm-pills{display:flex;flex-wrap:wrap;gap:6px;margin-top:var(--sp-2)}
.osm-herr{display:flex;flex-wrap:wrap;gap:6px}
.osm-num{display:flex;gap:var(--sp-5);flex-wrap:wrap;margin-bottom:var(--sp-2)}.osm-num div{font:600 var(--fs-xl) var(--mono);font-variant-numeric:tabular-nums}.osm-num small{display:block;font:400 var(--fs-xs) var(--sans);color:var(--muted)}
.osm-tabla{width:100%;border-collapse:collapse;font:var(--fs-xs) var(--mono)}.osm-tabla td{padding:6px;border-bottom:1px solid var(--line);color:var(--muted-2)}
.osm-mem{display:flex;flex-direction:column;gap:2px}
.osm-mem .osm-row{padding:var(--sp-2) var(--sp-3)}
.osm-ver{white-space:pre-wrap;font:var(--fs-sm)/1.6 var(--mono);color:var(--muted-2);background:rgba(7,11,18,.6);border:1px solid var(--line);border-radius:10px;padding:11px;max-height:42vh;overflow:auto}
.osm-casillas{display:flex;flex-wrap:wrap;gap:var(--sp-1) var(--sp-4)}.osm-casillas label{display:flex;align-items:center;gap:var(--sp-2);min-height:36px;font-size:var(--fs-sm);color:var(--ink)}
.osm-colores{display:flex;gap:var(--sp-2);flex-wrap:wrap}.osm-colores label{position:relative;cursor:pointer;display:grid;place-items:center;width:36px;height:36px}
.osm-colores input{position:absolute;opacity:0;width:1px;height:1px}
.osm-colores span{display:block;width:26px;height:26px;border-radius:50%;border:2px solid transparent;box-shadow:inset 0 0 0 2px rgba(0,0,0,.25)}
.osm-colores input:checked+span{border-color:var(--ink)}.osm-colores input:focus-visible+span{outline:2px solid var(--synapse);outline-offset:2px}
.osm-prev{display:flex;align-items:center;gap:var(--sp-4);margin-bottom:var(--sp-3)}
.osm-mono{font-family:var(--mono)}
.osm-etq{display:inline-block;font:var(--fs-xs) var(--mono);color:var(--muted);margin:0 0 var(--sp-1)}
/* movimiento sutil */
.osm-det.entra{animation:osm-entra .18s ease-out}
@keyframes osm-entra{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.osm-pg.sucio{animation:osm-sube .16s ease-out}
@keyframes osm-sube{from{transform:translateY(6px);opacity:.6}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){#view-config *,#view-config *::before,#view-config *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
/* una columna: lista o ficha, con «volver» */
@media (max-width:900px){
  .osm-split{grid-template-columns:1fr}
  .osm-split.ver-det>.osm-lista{display:none}
  .osm-split:not(.ver-det)>.osm-det{display:none}
  .osm-lnk.osm-back{display:inline-flex;margin:0 0 var(--sp-3);min-height:44px}

}
@media (max-width:600px){
  #view-config .osm-cfg{padding:var(--sp-4) 16px var(--sp-6)}
  .osm-tabs{gap:var(--sp-4)}
  .osm-heroe{gap:var(--sp-3)}
  .osm-pg{gap:var(--sp-2)}
  .osm-pg .est{flex:1 1 100%;margin-left:0}
  .osm-pg .g,.osm-pg .d{flex:1;min-height:44px}
  .osm-pg .q{order:9;flex:1 1 100%;justify-content:flex-start;text-align:left;min-height:40px}
  .osm-perm .lg{display:none}.osm-perm .sh{display:inline}
  .osm-perm th{letter-spacing:.02em}
  .osm-pill.osm-tg,details.osm-mas>summary{min-height:44px}
}
` }));

  // ------------------------------------------------------------ pestañas y vistas (las maneja la consola)
  const tabs = $(".seg.tabs"), main = $("main"), footer = $("footer");
  if (!tabs || !main) return;
  for (const [v, t] of [["oficina", "Oficina"], ["mandos", "Mandos"], ["config", "⚙ Config"]]) {
    const b = el("button", { type: "button", textContent: t }); b.dataset.view = v; b.setAttribute("aria-pressed", "false"); tabs.append(b);
  }

  const vMandos = el("section", { className: "view", id: "view-mandos", ariaLabel: "Mandos del Personal OS" });
  const vConfig = el("section", { className: "view", id: "view-config", ariaLabel: "Configuración" });
  const vOficina = el("section", { className: "view", id: "view-oficina", ariaLabel: "Oficina 3D de los agentes" });
  main.append(vOficina, vMandos, vConfig);

  // Por si la consola de este usuario no engancha botones nuevos (plantilla propia): el cambio de vista
  // también se hace aquí, con el mismo efecto que el suyo.
  // En el celular la barra de pestañas se desplaza de lado: la pestaña elegida se trae a la vista para que no quede
  // cortada por la máscara del borde (pasaba con CONFIG, la última).
  // La primera pestaña visible empieza siempre en su borde (nunca cortada) y el degradado sale solo del lado donde hay
  // más pestañas (clases izq/der); la elegida queda entera a la vista.
  const bordes = () => { const d = tabs.scrollWidth > tabs.clientWidth + 2; tabs.classList.toggle("osm-desliza", d);
    tabs.classList.toggle("izq", d && tabs.scrollLeft > 2); tabs.classList.toggle("der", d && tabs.scrollLeft + tabs.clientWidth < tabs.scrollWidth - 2); };
  const verPestana = (b) => {
    bordes(); if (!b || tabs.scrollWidth <= tabs.clientWidth + 2) return;
    const fin = b.offsetLeft + b.offsetWidth - tabs.offsetLeft, l = [...tabs.querySelectorAll("button")];
    const primera = l.find((x) => fin - (x.offsetLeft - tabs.offsetLeft) <= tabs.clientWidth - 24) || b;   // 24 px: el degradado derecho
    tabs.scrollTo({ left: Math.max(0, primera.offsetLeft - tabs.offsetLeft - (primera === l[0] ? 0 : 20)), behavior: "auto" });
    bordes();
  };
  tabs.addEventListener("scroll", bordes, { passive: true });
  addEventListener("resize", () => verPestana(tabs.querySelector('button[aria-pressed="true"]')));
  tabs.addEventListener("click", (ev) => { const b = ev.target.closest("button[data-view]"); if (b) setTimeout(() => verPestana(b), 0); });
  setTimeout(() => verPestana(tabs.querySelector('button[aria-pressed="true"]')), 300);
  tabs.addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-view]"); if (!b || !["oficina", "mandos", "config"].includes(b.dataset.view)) return;
    setTimeout(() => {
      if ($("#view-" + b.dataset.view).classList.contains("active")) return;
      tabs.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      document.querySelectorAll(".view").forEach((x) => x.classList.toggle("active", x.id === "view-" + b.dataset.view));
    }, 0);
  });

  // ------------------------------------------------------------ OFICINA 3D (con interruptor para aliviar carga)
  // La escena solo existe mientras la pestaña está a la vista Y la oficina está encendida: al salir de la pestaña o
  // apagarla, el iframe se vacía (about:blank) y la GPU y la RAM de three.js se liberan. La elección se recuerda.
  const OF_CLAVE = "os-oficina";
  const ofEncendida = () => { try { return localStorage.getItem(OF_CLAVE) !== "off"; } catch (_) { return true; } };
  // Absoluto a toda la vista: como ítem flex el iframe se quedaba en sus 150 px por defecto.
  const ofMarco = el("iframe", { title: "Oficina 3D de los agentes", style: "position:absolute;inset:0;width:100%;height:100%;border:0;background:var(--ground)" });
  const ofBoton = el("button", { type: "button", className: "osm-btn", style: "position:absolute;bottom:14px;right:14px;z-index:2" });   // abajo: arriba están los chips de la escena
  const ofApagada = el("div", { style: "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:24px" },
    el("p", { className: "osm-k", textContent: "Oficina apagada" }),
    el("p", { className: "osm-nota", style: "max-width:460px;margin:0", textContent: "Está apagada para aliviar la carga: no corre la escena 3D ni usa GPU. Tus agentes siguen trabajando igual; su estado lo ves en ⚙ Config." }),
    el("button", { type: "button", className: "osm-btn prim", textContent: "Encender la oficina", onclick: () => ofFijar(true) }));
  // La vista ya es position:absolute (inset:0) por la consola: es el contenedor de la escena; no se le cambia el position.
  vOficina.append(ofBoton, ofMarco, ofApagada);
  function ofSync() {
    const on = ofEncendida(), visible = vOficina.classList.contains("active");
    ofBoton.textContent = on ? "⏻ Apagar oficina" : "⏻ Encender"; ofBoton.hidden = !on;
    ofApagada.hidden = on; ofMarco.hidden = !on;
    const quiere = on && visible ? "/estado/oficina.html?embebida=1" : "about:blank";
    if (!ofMarco.src.endsWith(quiere)) ofMarco.src = quiere;
    pintarRam();
  }
  function ofFijar(on) { try { localStorage.setItem(OF_CLAVE, on ? "on" : "off"); } catch (_) { /* sin almacenamiento: vale para esta visita */ } decir(on ? "oficina encendida" : "oficina apagada: se liberó la escena 3D", "ok"); ofSync(); }
  ofBoton.addEventListener("click", () => ofFijar(false));
  new MutationObserver(ofSync).observe(vOficina, { attributes: true, attributeFilter: ["class"] });

  // ------------------------------------------------------------ pie: estado del OS y línea de resultado
  const pie = el("span", { className: "osm-pie" },
    el("span", { id: "osm-os" }, el("span", { className: "luz" }), "…"), el("button", { type: "button", id: "osm-os-b", textContent: "…" }),
    el("span", { id: "osm-ram", className: "osm-pie-extra", title: "" }), el("span", { id: "osm-linea" }));
  // Consumo de RAM del Personal OS: el servidor (memoria real de su proceso) y esta página (memoria JavaScript que
  // reporta el navegador, solo en los basados en Chromium; es una aproximación). La GPU no se puede medir desde aquí.
  function pintarRam() {
    try {
      const r = $("#osm-ram"); if (!r) return;
      const srv = window.__osRec && window.__osRec.servidor_mb;
      const pag = performance && performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
      const of = ofEncendida() ? (vOficina.classList.contains("active") ? "oficina corriendo" : "oficina en pausa") : "oficina apagada";
      const partes = [srv != null ? `servidor ${srv} MB` : null, pag != null ? `página ~${pag} MB` : null, of].filter(Boolean);
      r.textContent = "· RAM " + partes.join(" · ");
      r.title = "Servidor: memoria real del proceso Node. Página: memoria JavaScript que reporta el navegador (aproximada; no incluye GPU ni el resto de la pestaña). La oficina solo consume mientras su pestaña está abierta y encendida.";
    } catch (_) { /* el pie nunca rompe la consola */ }
  }
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
      inds = Array.isArray(i) ? i : []; est = e; window.__osRec = e.recursos || null; pintarInd(); pintar(); pintarRam();
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

  // ==================================================================== CONFIG (propuesta A, 25/11/2026)
  // Tres pestañas reales, una sección a la vez: Agentes · Skills · Bases de datos. Cada una es lista + ficha plana;
  // en una columna (≤900 px) se ve la lista o la ficha, con «volver». Enlace directo: #config&skills/<slug>,
  // #config&bd/<id>, #config&agentes/<nombre> (la consola separa el hash por «&» y solo mira la vista).
  const SVG = {
    lupa: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    atras: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="m15 18-6-6 6-6"/></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    alerta: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M12 3 2 21h20L12 3z"/><path d="M12 10v4M12 17h.01"/></svg>',
    aviso: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M12 3 2 21h20L12 3z"/><path d="M12 10v4M12 17h.01"/></svg>',
    candado: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    lapiz: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    memoria: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    ojo: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    engranaje: '<svg class="osm-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  };
  const svg = (k) => { const s = el("span", { style: "display:inline-flex" }); s.innerHTML = SVG[k]; return s.firstChild; };
  // La pestaña de la consola: icono SVG en vez del emoji (AP-18)
  { const b = tabs.querySelector('button[data-view="config"]'); if (b) { b.textContent = "Config"; b.prepend(svg("engranaje")); b.setAttribute("aria-label", "Configuración"); } }

  // ---- piezas comunes
  const hora = () => new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  const enColumna = () => matchMedia("(max-width:900px)").matches;
  const sinMovimiento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Pie de guardado único (CO-045): [Quitar] … [estado] [Descartar] [Guardar]. Guardar arranca deshabilitado.
  function pieGuardar(quitar, o) {
    o = o || {};
    const est = el("span", { className: "est", role: "status" }); est.setAttribute("aria-live", "polite");
    const g = el("button", { type: "button", className: "osm-btn prim g", textContent: "Guardar", disabled: true });
    const d = el("button", { type: "button", className: "osm-btn d", textContent: o.cancelar ? "Cancelar" : "Descartar", disabled: !o.cancelar });
    const q = quitar ? el("button", { type: "button", className: "osm-btn q", textContent: quitar }) : null;
    const caja = el("div", { className: "osm-pg" }, ...[q, est, d, g].filter(Boolean));
    return { caja, est, g, d, q,
      sucio() { est.textContent = "● Sin guardar"; est.className = "est sucio"; g.disabled = false; d.disabled = false; caja.classList.add("sucio"); },
      limpio(t) { est.textContent = t ? `${t} a las ${hora()}` : "Sin cambios"; est.className = t ? "est ok" : "est"; g.disabled = true; d.disabled = !o.cancelar; caja.classList.remove("sucio"); },
      error(t) { est.textContent = t; est.className = "est err"; },
      ocupado(t) { est.textContent = t; est.className = "est"; g.disabled = true; } };
  }
  const buscador = (ph, alCambiar) => {
    const i = el("input", { type: "search", placeholder: ph, ariaLabel: ph, autocomplete: "off" });
    i.addEventListener("input", () => alCambiar(i.value.trim().toLowerCase()));
    return el("label", { className: "osm-search" }, svg("lupa"), i);
  };
  const esqueleto = (n) => Array.from({ length: n || 4 }, () => { const d = el("div", { className: "osm-esq" }); d.setAttribute("aria-hidden", "true"); return d; });
  const conEsqueleto = (caja, n) => { caja.setAttribute("aria-busy", "true"); caja.replaceChildren(...esqueleto(n), el("span", { className: "osm-saltar", role: "status", textContent: "Cargando…" })); };
  // Error en lenguaje claro; el mensaje técnico va plegado
  const errorCarga = (caja, que, e, reintentar) => {
    caja.removeAttribute("aria-busy");
    const red = /fetch|network|red|Failed/i.test(String(e && e.message));
    caja.replaceChildren(el("div", { className: "osm-err-caja", role: "alert" }, svg("alerta"), el("div", {},
      el("b", { textContent: `No pude leer ${que}.` }),
      el("span", { textContent: red ? "No pude hablar con el servidor local de la consola. Revisa que siga corriendo (Mandos › Servidor) y vuelve a intentar." : "El servidor local respondió con un error. Vuelve a intentar; si sigue, el detalle técnico ayuda a revisarlo." }),
      el("button", { type: "button", className: "osm-btn", textContent: "Reintentar", onclick: reintentar }),
      el("details", {}, el("summary", { textContent: "Detalle técnico" }), el("code", { textContent: String(e && e.message || e) })))));
  };
  const vacio = (titulo, texto, ...acciones) => el("div", { className: "osm-vacio-caja" }, el("b", { textContent: titulo }), el("span", { textContent: texto }), ...acciones.filter(Boolean));
  const fila = (o) => {   // fila de lista: { titulo, sub, extra, actual, alClic, antes }
    const b = el("button", { type: "button", className: "osm-row" }, o.antes || "",
      el("span", { className: "osm-row-c" }, el("span", { className: "osm-row-t", textContent: o.titulo }), o.sub ? el("span", { className: "osm-row-s", textContent: o.sub }) : "", o.debajo || ""),
      o.extra || "");
    b.setAttribute("aria-current", String(!!o.actual));
    if (o.title) b.title = o.title;
    b.addEventListener("click", o.alClic);
    return el("li", {}, b);
  };
  const grupoLista = (id, titulo, filas, extra) => { const h = el("p", { className: "osm-grp", id }, titulo, extra || ""); const u = el("ul", { className: "osm-ul" }, ...filas); u.setAttribute("aria-labelledby", id); return [h, u]; };
  const gh = (t) => el("p", { className: "osm-gh", textContent: t });
  const notaI = (...hijos) => el("p", { className: "osm-nota-i" }, svg("info"), el("span", {}, ...hijos));

  // ---- página: título, pestañas y paneles
  const cfg = el("div", { className: "osm-col osm-cfg" });
  const TABS = [["agentes", "Agentes"], ["skills", "Skills"], ["bd", "Bases de datos"]];
  const tabBar = el("div", { className: "osm-tabs", role: "tablist", ariaLabel: "Secciones de configuración" });
  const paneles = {}, cuentas = {}, splits = {};
  for (const [id, t] of TABS) {
    cuentas[id] = el("span", { className: "n" });
    const b = el("button", { type: "button", role: "tab", id: "osm-tab-" + id }, t, cuentas[id]);
    b.dataset.tab = id; b.setAttribute("aria-controls", "osm-tp-" + id); b.setAttribute("aria-selected", "false"); b.tabIndex = -1;
    tabBar.append(b);
    paneles[id] = el("section", { className: "osm-tp", id: "osm-tp-" + id, role: "tabpanel", hidden: true });
    paneles[id].setAttribute("aria-labelledby", b.id);
  }
  cfg.append(el("h2", { className: "osm-cfg-h", textContent: "Configuración" }),
    el("p", { className: "osm-lede", textContent: "Ajusta tus agentes, lo que generan tus skills y qué puede hacer Claude en cada base de datos." }),
    tabBar, ...TABS.map(([id]) => paneles[id]));
  vConfig.append(cfg);
  // Alto visible de Config: tope de la ficha fija en escritorio
  try { new ResizeObserver(() => cfg.style.setProperty("--cfg-h", Math.max(320, cfg.clientHeight - 16) + "px")).observe(cfg); } catch (_) { /* sin ResizeObserver: 80vh */ }
  const split = (id, lista, det) => { splits[id] = el("div", { className: "osm-split" }, lista, det); return splits[id]; };

  // Recordar la pestaña y la ficha abiertas (preferencia de este navegador; si falla, no pasa nada)
  const ULT = "os-config-ult";
  const ult = (() => { try { return JSON.parse(localStorage.getItem(ULT) || "{}") || {}; } catch (_) { return {}; } })();
  const recordar = (k, v) => { ult[k] = v; try { localStorage.setItem(ULT, JSON.stringify(ult)); } catch (_) { /* sin almacenamiento */ } };
  // Enlace directo: lo que va después de #config&
  const leerEnlace = () => { const m = location.hash.match(/^#config&([^&]+)/); if (!m) return null; const [tab, ...r] = decodeURIComponent(m[1]).split("/"); return { tab, id: r.join("/") || null }; };
  const escribirEnlace = (tab, id) => { if (!vConfig.classList.contains("active")) return; try { history.replaceState(null, "", "#config&" + tab + (id ? "/" + encodeURIComponent(id) : "")); } catch (_) { /* nada */ } };
  let tabActual = null;
  function irTab(id, foco) {
    if (!paneles[id]) id = "agentes";
    tabActual = id;
    tabBar.querySelectorAll("[role=tab]").forEach((b) => { const s = b.dataset.tab === id; b.setAttribute("aria-selected", String(s)); b.tabIndex = s ? 0 : -1; if (s && foco) b.focus(); });
    for (const [k] of TABS) paneles[k].hidden = k !== id;
    recordar("tab", id);
    const sel = id === "agentes" ? ag.actual && ag.actual.nombre : id === "skills" ? sk.actual : bd.actual;
    escribirEnlace(id === "agentes" ? "agentes" : id, sel || null);
    cfg.scrollTop = 0;
    cargarTab(id);
  }
  tabBar.addEventListener("click", (ev) => { const b = ev.target.closest("[role=tab]"); if (b) irTab(b.dataset.tab); });
  tabBar.addEventListener("keydown", (ev) => {   // flechas, Inicio y Fin (patrón de pestañas de ARIA)
    const l = [...tabBar.querySelectorAll("[role=tab]")], i = l.findIndex((b) => b.dataset.tab === tabActual);
    const j = ev.key === "ArrowRight" ? (i + 1) % l.length : ev.key === "ArrowLeft" ? (i - 1 + l.length) % l.length : ev.key === "Home" ? 0 : ev.key === "End" ? l.length - 1 : -1;
    if (j < 0) return; ev.preventDefault(); irTab(l[j].dataset.tab, true);
  });
  // Al abrir una ficha: aparición suave; en una columna se muestra la ficha (sin la lista) y el foco va a su título.
  function mostrarFicha(tab, det, restaurando) {
    det.classList.remove("entra"); void det.offsetWidth; det.classList.add("entra");
    if (enColumna()) { if (!restaurando) { splits[tab].classList.add("ver-det"); cfg.scrollTop = 0; } }
    else det.scrollTop = 0;   // escritorio: la ficha es fija junto a la lista; la página no se mueve
    const h = det.querySelector(".osm-ficha-h"); if (h && !restaurando) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }
  const volver = (tab, texto, elegido) => {
    const b = el("button", { type: "button", className: "osm-lnk osm-back" }, svg("atras"), texto);
    b.addEventListener("click", () => { splits[tab].classList.remove("ver-det"); cfg.scrollTop = 0; const x = elegido(); if (x) { x.scrollIntoView({ block: "center" }); x.focus({ preventScroll: true }); } });
    return b;
  };
  const saltar = (det) => el("button", { type: "button", className: "osm-btn osm-saltar", textContent: "Saltar a la ficha", onclick: () => { const h = det.querySelector(".osm-ficha-h") || det; h.tabIndex = -1; h.focus(); } });

  // ==================================================================== CONFIG · agentes
  // Lista por familia (filas con mascota y estado real) y ficha plana (objetivo, meta, límites, equipo, actividad,
  // memoria). La mascota sale de identidad-agente.js (la comparten consola, oficina, landing y video).
  const AG_GRUPOS = { mios: "Tuyo", propios: "Del Personal OS", terceros: "De terceros", integrados: "Integrado de Claude Code" };
  const AG_HERR = { lectura: "Leer archivos", edicion: "Editar archivos", terminal: "Terminal", web: "Web" };
  const AG_MODELOS = { inherit: "El de la sesión", sonnet: "Sonnet", opus: "Opus", haiku: "Haiku", fable: "Fable" };
  const IA = window.IdentidadAgente;
  const PALETA = IA.PALETA, familiaDe = IA.familiaDe, FAMILIAS = IA.FAMILIAS;
  const COLOR_ES = { red: "rojo", blue: "azul", green: "verde", yellow: "amarillo", purple: "violeta", orange: "naranja", pink: "rosa", cyan: "turquesa" };
  const ACC_ES = { gafas: "Gafas", lupa: "Lupa", pluma: "Pluma", casco: "Casco", boina: "Boina", auriculares: "Auriculares", escudo: "Escudo", portapapeles: "Portapapeles", corbatin: "Corbatín", brujula: "Brújula" };
  const RIESGO = { escribe: new Set(["Write", "Edit", "NotebookEdit", "MultiEdit"]), ejecuta: new Set(["Bash", "PowerShell"]) };
  // Qué es cada familia, en palabras de quien lee (los nombres técnicos confunden: «GSD», «integrados»)
  const FAMILIA_NOTA = { gsd: "Los del flujo de planeación por fases (GSD) que tienes instalado.", integrados: "Vienen con Claude Code: no tienen archivo y no se editan." };

  document.head.append(el("style", { textContent: `
.osm-m{display:inline-block;position:relative;flex:none;line-height:0}
.osm-m svg{width:100%;height:100%;overflow:visible}
.osm-m .cu{transform-box:fill-box;transform-origin:50% 100%;animation:osm-resp 4.2s ease-in-out infinite}
.osm-m .oj{transform-box:fill-box;transform-origin:50% 50%;animation:osm-parp 6.5s infinite}
.osm-m.trabajando .cu{animation:osm-bote .7s ease-in-out infinite}
.osm-m.trabajando .oj{animation:osm-mira 1.4s ease-in-out infinite}
.osm-m .chispa{opacity:0}.osm-m.trabajando .chispa{animation:osm-chis 1.2s ease-in-out infinite}
.osm-m .ok{opacity:0;transition:opacity .4s}.osm-m.listo .ok{opacity:1}
.osm-m .punto{position:absolute;right:-1px;bottom:-1px;width:28%;height:28%;max-width:12px;max-height:12px;border-radius:50%;border:2px solid var(--ground);background:var(--muted)}
.osm-m.trabajando .punto{background:var(--synapse);box-shadow:0 0 8px var(--synapse)}.osm-m.listo .punto{background:var(--ok)}
@keyframes osm-resp{0%,100%{transform:scale(1,1)}50%{transform:scale(1.025,.975)}}
@keyframes osm-parp{0%,94%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
@keyframes osm-bote{0%,100%{transform:translateY(0) scale(1,1)}40%{transform:translateY(-5%) scale(.98,1.03)}}
@keyframes osm-mira{0%,100%{transform:translateX(0)}30%{transform:translateX(-6%)}70%{transform:translateX(6%)}}
@keyframes osm-chis{0%{opacity:0;transform:translateY(0) scale(.6)}50%{opacity:1}100%{opacity:0;transform:translateY(-10px) scale(1)}}
@media (prefers-reduced-motion:reduce){.osm-m *{animation:none!important}}
` }));
  function mascota(a, tam, estado) {
    const r = IA.svg(a), h = r.semilla;
    const caja = el("span", { className: "osm-m " + (estado || "reposo") });
    caja.style.width = caja.style.height = tam + "px";
    caja.innerHTML = r.svg + '<span class="punto"></span>';
    caja.querySelectorAll(".oj,.cu").forEach((g) => { g.style.animationDelay = `-${(h % 4000) / 1000}s`; });   // cada una a su ritmo
    caja.dataset.agente = a.nombre || "";
    caja.setAttribute("aria-hidden", "true");
    return caja;
  }
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

  const ag = { datos: null, actual: null, sucio: false, filtro: "" };
  const agLista = el("div", {});
  const agDet = el("div", { className: "osm-det" });
  const bNuevo = el("button", { type: "button", className: "osm-btn", textContent: "+ Nuevo agente" });
  const vacioDet = () => agDet.replaceChildren(vacio("Elige un agente", "Verás su oficio, su objetivo, sus límites y su memoria. Los tuyos se editan aquí; los demás tienen candado. Para crear uno, usa «+ Nuevo agente»."));
  vacioDet();
  paneles.agentes.append(
    el("div", { className: "osm-tp-h" }, el("p", { textContent: "Cada agente tiene su ficha, su mascota con el estado real y su memoria. Claude Code toma los cambios en segundos." }), bNuevo),
    split("agentes", el("div", { className: "osm-lista" }, saltar(agDet), buscador("Buscar agente", (q) => { ag.filtro = q; if (ag.datos) agPintar(); }), agLista), agDet));
  conEsqueleto(agLista, 4);

  async function agCargar(sel) {
    if (!ag.datos) conEsqueleto(agLista, 4);
    try { const r = await fetch("/api/config/agentes"); if (!r.ok) throw new Error("respuesta " + r.status); ag.datos = await r.json(); }
    catch (e) { errorCarga(agLista, "los agentes", e, () => agCargar(sel)); return; }
    agLista.removeAttribute("aria-busy");
    cuentas.agentes.textContent = ag.datos.agentes.length;
    agPintar();
    const quiere = sel || (!ag.restaurado && ag.pedido) || (!ag.restaurado && ult.ag);
    const desdeEnlace = !sel && !ag.restaurado && !!ag.pedido;
    ag.restaurado = true;
    if (quiere === "nuevo" && !sel) { agForm(null); return; }
    const a = quiere && ag.datos.agentes.find((x) => x.nombre === quiere);
    if (a) agVer(a, true, !sel && !desdeEnlace);
  }
  function agPintar() {
    const orden = (a, b) => { const ea = actDe(a.nombre) || {}, eb = actDe(b.nombre) || {};
      return (eb.corriendo ? 1 : 0) - (ea.corriendo ? 1 : 0) || String(eb.ultima || "").localeCompare(String(ea.ultima || "")) || a.nombre.localeCompare(b.nombre); };
    const q = ag.filtro || "";
    const pasa = (a) => !q || (a.nombre + " " + (a.oficio || "") + " " + (a.descripcion || "")).toLowerCase().includes(q);
    const hijos = []; let hay = 0;
    for (const g of Object.keys(FAMILIAS)) {
      const l = ag.datos.agentes.filter((a) => familiaDe(a) === g && pasa(a)).sort(orden);
      if (!l.length && (g !== "mios" || q)) continue;
      hay += l.length;
      const tieneActual = ag.actual && l.some((a) => a.nombre === ag.actual.nombre);
      const sec = el("details", { className: "osm-g", open: q || tieneActual ? true : l.length <= 5 });
      const sum = el("summary", { className: "osm-grp" }, `${FAMILIAS[g].titulo} · ${l.length}`);
      if (g !== "mios") sum.append(svg("candado"));
      sec.append(sum);
      if (FAMILIA_NOTA[g]) sec.append(el("p", { className: "osm-grp-nota", textContent: FAMILIA_NOTA[g] }));
      if (!l.length) sec.append(el("p", { className: "osm-grp-nota", textContent: "Todavía no has creado ninguno." }));
      sec.append(el("ul", { className: "osm-ul" }, ...l.map((a) => {
        const t = actDe(a.nombre);
        const est = el("span", {}); est.dataset.estadoDe = a.nombre;
        return fila({ antes: mascota(a, 34), titulo: a.nombre, sub: a.lema ? `«${a.lema}»` : a.oficio || a.que_hace || "",
          debajo: el("span", { className: "osm-row-d" }, est, t && t.usos7 ? ` · ${t.usos7} esta semana` : ""),
          actual: ag.actual && ag.actual.nombre === a.nombre, title: a.que_hace || "", alClic: () => agVer(a) });
      })));
      hijos.push(sec);
    }
    if (q) hijos.unshift(el("p", { className: "osm-cuenta", role: "status", textContent: hay ? `${hay} coinciden` : `Ningún agente coincide con «${q}».` }));
    agLista.replaceChildren(...hijos);
    aplicarEstados();
  }
  const agPuede = async () => !ag.sucio || confirmar("Cambios sin guardar", "Tienes cambios sin guardar en este agente. ¿Los descartas?");

  async function agVer(a, forzar, restaurando) {
    if (!forzar && !(await agPuede())) return;
    ag.actual = a; ag.sucio = false; agPintar(); recordar("ag", a.nombre);
    if (tabActual === "agentes") escribirEnlace("agentes", a.nombre);
    const t = actDe(a.nombre);
    const pills = el("div", { className: "osm-pills" },
      el("span", { className: "osm-pill" }, a.candado ? svg("candado") : svg("lapiz"), a.candado ? AG_GRUPOS[a.grupo] : "Tuyo"),
      a.oficio ? el("span", { className: "osm-pill", textContent: a.oficio }) : null,
      el("span", { className: "osm-pill", textContent: "Modelo: " + (AG_MODELOS[a.modelo] || a.modelo) }),
      a.memoria ? el("span", { className: "osm-pill" }, svg("memoria"), "Con memoria") : null);
    const estado = el("span", { className: "osm-row-e" }); estado.dataset.estadoDe = a.nombre;
    const heroe = el("div", { className: "osm-heroe" }, mascota(a, 96),
      el("div", { style: "min-width:0" }, el("h3", { className: "osm-ficha-h", textContent: a.nombre }), a.lema ? el("p", { className: "osm-lema", textContent: `«${a.lema}»` }) : null, pills,
        el("p", { className: "osm-etq", style: "margin-top:8px" }, estado)));
    const herr = a.herramientas || [];
    const equipo = el("div", { className: "osm-herr" }, ...(herr.length ? herr : ["todas (hereda las de la sesión)"]).map((h) => el("span", { className: "osm-pill mono" + (RIESGO.escribe.has(h) ? " w" : RIESGO.ejecuta.has(h) ? " x" : ""), textContent: h, title: RIESGO.escribe.has(h) ? "escribe archivos" : RIESGO.ejecuta.has(h) ? "ejecuta comandos" : "" })));
    const dato = (titulo, ...hijos) => [el("h4", { className: "osm-sub", textContent: titulo }), ...hijos];
    const cuando = (a.cuando || a.no_es) ? el("details", { className: "osm-mas" }, el("summary", { textContent: "Cuándo se usa" }),
      el("div", { className: "osm-mas-c" },
        a.cuando ? el("p", {}, el("b", { textContent: "Claude lo llama " }), paraLector(a.cuando).replace(/^./, (x) => x.toLowerCase())) : "",
        a.no_es ? el("p", {}, el("b", { textContent: "No es para… " }), a.no_es.replace(/^No es para\s*/i, "")) : "")) : "";
    const act = [
      el("div", { className: "osm-num" }, el("div", {}, String(t ? t.usos7 : 0), el("small", { textContent: "esta semana" })), el("div", {}, String(t ? t.usos30 : 0), el("small", { textContent: "en 30 días" })), el("div", {}, t ? hace(t.ultima) : "—", el("small", { textContent: "última vez" }))),
      t && t.ejecuciones.length ? el("table", { className: "osm-tabla" }, ...t.ejecuciones.map((x) => el("tr", {},
        el("td", { textContent: new Date(x.inicio).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) }),
        el("td", { textContent: x.duracion_s == null ? "sin cierre" : x.duracion_s < 60 ? `${x.duracion_s} s` : `${Math.round(x.duracion_s / 60)} min` }),
        el("td", { textContent: x.tarea || "tarea no registrada" }), el("td", { textContent: "sesión " + (x.sesion || "?") })))) : el("p", { className: "osm-vacio", textContent: "Sin ejecuciones registradas." })];
    const mem = el("div", {});
    const crudo = el("details", { className: "osm-mas", style: "margin-top:var(--sp-5)" }, el("summary", { textContent: "Instrucciones completas" }), el("div", { className: "osm-ver", style: "margin-top:8px", textContent: a.instrucciones || "" }));
    const pie = a.candado ? notaI(a.grupo === "propios" ? "Lo mantiene el plugin del Personal OS: un cambio a mano se pierde en la próxima actualización."
      : a.grupo === "integrados" ? "Viene integrado en Claude Code: no tiene archivo y no se edita." : "Lo mantiene otra herramienta o lo instalaste aparte. No se edita desde aquí.")
      : el("div", { className: "osm-pg" }, el("span", { className: "est" }), el("button", { type: "button", className: "osm-btn", textContent: "Editar ficha", onclick: () => agForm(a) }));
    agDet.replaceChildren(volver("agentes", "Agentes", () => agLista.querySelector('.osm-row[aria-current="true"]')), heroe,
      ...(a.objetivo ? dato("Objetivo", el("p", { className: "osm-p", textContent: a.objetivo })) : []),
      ...(a.meta ? dato("Meta de cierre", el("p", { className: "osm-p", textContent: a.meta })) : []),
      ...(a.limites && a.limites.length ? dato("Límites", el("ul", { className: "osm-lim" }, ...a.limites.map((l) => el("li", { textContent: l })))) : []),
      ...dato("Qué hace", el("p", { className: "osm-p", textContent: a.que_hace || a.descripcion || a.error || "—" }), cuando),
      ...dato("Equipo (herramientas)", equipo), ...dato("Actividad (de tus hooks, últimos 30 días)", ...act), mem, crudo, pie);
    aplicarEstados();
    if (a.memoria) agMemoria(a, mem);
    mostrarFicha("agentes", agDet, restaurando);
  }
  async function agMemoria(a, caja) {
    let m; try { m = await fetch(`/api/config/memoria?agente=${encodeURIComponent(a.nombre)}`).then((r) => r.json()); } catch (_) { return; }
    const lista = (g) => m.archivos.filter((f) => f.grupo === g).map((f) => fila({ titulo: f.titulo, sub: `${Math.max(1, Math.round(f.bytes / 1024))} KB · ${hace(f.modificado)}`, alClic: () => agArchivo(a, f) }));
    const con = lista("conocimiento"), exp = lista("experiencia");
    caja.replaceChildren(el("h4", { className: "osm-sub", textContent: `Memoria · índice ${m.lineas_indice}/200 líneas` }),
      el("div", { className: "osm-rej" },
        el("div", {}, el("p", { className: "osm-etq", textContent: "Conocimiento (lo escribes tú)" }), con.length ? el("ul", { className: "osm-ul osm-mem" }, ...con) : el("p", { className: "osm-vacio", textContent: "Sin conocimiento todavía." }),
          a.candado ? null : el("button", { type: "button", className: "osm-btn", style: "margin-top:8px", textContent: "+ Conocimiento", onclick: () => agConocimiento(a, null) })),
        el("div", {}, el("p", { className: "osm-etq", textContent: "Experiencia (la escribe el agente)" }), exp.length ? el("ul", { className: "osm-ul osm-mem" }, ...exp) : el("p", { className: "osm-vacio", textContent: "Aún no ha guardado experiencia." }))),
      m.indice ? el("details", { className: "osm-mas", style: "margin-top:var(--sp-3)" }, el("summary", { textContent: "MEMORY.md (lo que el agente ve al arrancar)" }), el("div", { className: "osm-ver", style: "margin-top:8px", textContent: m.indice })) : "");
  }
  async function agArchivo(a, f) {
    const r = await fetch(`/api/config/memoria?agente=${encodeURIComponent(a.nombre)}&ruta=${encodeURIComponent(f.ruta)}`).then((x) => x.json());
    const editable = f.grupo === "conocimiento" && !a.candado;
    agDet.replaceChildren(
      el("button", { type: "button", className: "osm-lnk", style: "margin-bottom:var(--sp-3)", onclick: () => agVer(a, true) }, svg("atras"), "Volver a la ficha"),
      el("div", { className: "osm-det-h" }, el("h3", { className: "osm-ficha-h", textContent: f.titulo }), el("span", { className: "osm-slug", textContent: `${a.nombre} · ${f.ruta}` })),
      el("div", { className: "osm-ver", style: "max-height:60vh", textContent: r.contenido || "" }),
      editable ? el("div", { className: "osm-pg" },
        el("button", { type: "button", className: "osm-btn q", textContent: "Borrar", onclick: async () => {
          if (!(await confirmar(`Borrar «${f.titulo}»`, "Se mueve a la papelera del Personal OS y sale del índice del agente."))) return;
          const x = await accion("agente-conocimiento-borrar", { agente: a.nombre, slug: f.ruta.split("/")[1].slice(0, -3) }); decir(x.mensaje, x.ok ? "ok" : "error"); if (x.ok) agVer(a, true);
        } }), el("span", { className: "est" }),
        el("button", { type: "button", className: "osm-btn prim", textContent: "Editar", onclick: () => agConocimiento(a, { slug: f.ruta.split("/")[1].slice(0, -3), titulo: f.titulo, contenido: r.contenido }) })) : "");
  }
  const slugDe = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const campo = (lab, ctl, ayuda) => { const ay = ayuda ? el("small", { id: ctl.id + "-ay", textContent: ayuda }) : null; if (ay) ctl.setAttribute("aria-describedby", ay.id);
    return el("div", { className: "osm-f" }, el("label", { htmlFor: ctl.id, textContent: lab }), ctl, ay); };
  function agConocimiento(a, c) {
    ag.sucio = false;
    const iT = el("input", { type: "text", id: "osm-c-t", value: c ? c.titulo : "", placeholder: "p. ej. Convenciones del repo de lista de espera" });
    const iS = el("input", { type: "text", id: "osm-c-s", value: c ? c.slug : "", spellcheck: false, placeholder: "se arma solo desde el título" });
    const iC = el("textarea", { id: "osm-c-c", value: c ? c.contenido.replace(/^#\s+.*\n+/, "") : "", placeholder: "Markdown: reglas, decisiones, ejemplos, enlaces a las guías…" });
    iC.style.minHeight = "300px";
    let slugTocado = !!c;
    iS.addEventListener("input", () => { slugTocado = true; });
    iT.addEventListener("input", () => { if (!slugTocado) iS.value = slugDe(iT.value); });
    const err = el("p", { className: "osm-err", hidden: true, role: "alert" });
    const P = pieGuardar(null, { cancelar: true });
    P.g.addEventListener("click", async () => {
      err.hidden = true; P.ocupado("Guardando…");
      const x = await accion("agente-conocimiento", { agente: a.nombre, slug: iS.value.trim(), titulo: iT.value, contenido: iC.value, original: c ? c.slug : null });
      if (!x.ok) { err.textContent = x.mensaje; err.hidden = false; P.sucio(); return; }
      ag.sucio = false; decir(x.mensaje, "ok"); agVer(a, true);
    });
    P.d.addEventListener("click", async () => { if (await agPuede()) { ag.sucio = false; agVer(a, true); } });
    const f = el("div", {}, el("div", { className: "osm-det-h" }, el("h3", { className: "osm-ficha-h", textContent: c ? "Editar conocimiento" : "Nuevo conocimiento" }), el("span", { className: "osm-slug", textContent: `para ${a.nombre}` })), err,
      campo("Título", iT), campo("Archivo", iS, "Queda en conocimiento/<archivo>.md y se agrega solo al índice MEMORY.md."),
      campo("Contenido", iC, "El agente lo lee cuando aplica a la tarea. Mejor un tema por archivo, sin secretos ni datos de personas."), P.caja);
    f.addEventListener("input", () => { ag.sucio = true; P.sucio(); });
    agDet.replaceChildren(f); iT.focus();
  }
  function agForm(a) {
    const nuevo = !a; ag.actual = a || null; ag.sucio = false;
    const herr = new Set((a && a.herramientas) || []);
    const G = ag.datos.grupos_herramientas;
    const grupos = Object.keys(AG_HERR).filter((g) => (G[g] || []).every((t) => herr.has(t)));
    const enG = new Set(grupos.flatMap((g) => G[g]));
    const id = (s) => "osm-f-" + s;
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
        el("div", {}, el("b", { className: "osm-mono", textContent: iN.value || "nuevo-agente" }), el("p", { className: "osm-lema", textContent: iLe.value ? `«${iLe.value}»` : "sin lema" }),
          el("small", { className: "osm-etq", textContent: "La forma y la cara salen del nombre; el accesorio, del oficio." })));
    };
    const err = el("p", { className: "osm-err", hidden: true, role: "alert" });
    const P = pieGuardar(nuevo ? null : "Borrar agente", { cancelar: nuevo });
    P.limpio();
    const bG = P.g, bD = P.d, bB = P.q;
    const f = el("div", {},
      el("div", { className: "osm-det-h" }, el("h3", { className: "osm-ficha-h", textContent: nuevo ? "Nuevo agente" : `Ficha de ${a.nombre}` }), el("span", { className: "osm-slug", textContent: nuevo ? "nuevo · tuyo" : "tuyo" })), err, prev,
      el("div", { className: "osm-rej" }, campo("Nombre", iN, "Minúsculas, números y guiones. Es como Claude lo invoca."), campo("Oficio", iOf, "La etiqueta bajo el nombre.")),
      campo("Lema", iLe, "Su personalidad en una línea."),
      el("div", { className: "osm-rej" }, el("div", { className: "osm-f" }, el("span", { className: "l", textContent: "Color (el oficial de Claude Code)" }), colores), campo("Accesorio", iAc)),
      campo("Objetivo", iOb), campo("Meta de cierre", iMe), campo("Límites", iLi),
      campo("Cuándo lo llama Claude", iD, "Claude lee esto para decidir si lo llama: di qué hace y en qué situaciones."),
      el("div", { className: "osm-f" }, el("span", { className: "l", textContent: "Herramientas" }), cas, el("small", { textContent: "Sin ninguna marcada ni escrita, el agente hereda todas las de la sesión." })),
      el("div", { className: "osm-rej" }, campo("Otras herramientas", iO), campo("Modelo", iM)),
      el("div", { className: "osm-f" }, el("label", { className: "osm-chk" }, iMem, el("span", {}, "Memoria persistente", el("small", { textContent: "Conocimiento (lo escribes tú) y experiencia (la escribe el agente), con la memoria nativa de Claude Code (memory: user)." })))),
      campo("Instrucciones", iI, "El prompt del agente: quién es, qué hace, qué no hace y qué devuelve."),
      P.caja);
    agDet.replaceChildren(f); pintarPrev();
    f.addEventListener("input", () => { ag.sucio = true; P.sucio(); pintarPrev(); });
    f.addEventListener("change", () => { ag.sucio = true; P.sucio(); pintarPrev(); });
    bD.addEventListener("click", async () => { if (!(await agPuede())) return; ag.sucio = false; if (nuevo) { ag.actual = null; vacioDet(); agPintar(); } else agVer(a, true); });
    bG.addEventListener("click", async () => {
      err.hidden = true; bG.setAttribute("aria-busy", "true"); P.ocupado("Guardando…");
      const c = { nombre: iN.value.trim(), descripcion: iD.value, instrucciones: iI.value, modelo: iM.value, otras: iO.value,
        grupos: [...cas.querySelectorAll("input:checked")].map((x) => x.value), original: nuevo ? null : a.nombre,
        oficio: iOf.value, lema: iLe.value, objetivo: iOb.value, meta: iMe.value, limites: iLi.value,
        color: (colores.querySelector("input:checked") || {}).value || "", accesorio: iAc.value, memoria: iMem.checked };
      try {
        const r = await accion("agente-guardar", c);
        if (!r.ok) { err.textContent = r.mensaje; err.hidden = false; err.scrollIntoView({ block: "nearest" }); decir("agente: " + r.mensaje, "error"); P.sucio(); return; }
        ag.sucio = false; decir(r.mensaje, "ok"); await agCargar(c.nombre);
      } catch (e) { err.textContent = e.message; err.hidden = false; P.sucio(); }
      finally { bG.removeAttribute("aria-busy"); }
    });
    if (bB) bB.addEventListener("click", async () => {
      if (!(await confirmar(`Borrar «${a.nombre}»`, "Se mueve a la papelera del Personal OS (no se pierde) y Claude Code deja de usarlo en unos segundos. Su memoria se conserva."))) return;
      const r = await accion("agente-borrar", { nombre: a.nombre }); decir(r.mensaje, r.ok ? "ok" : "error");
      if (r.ok) { ag.sucio = false; ag.actual = null; vacioDet(); await agCargar(); }
    });
    if (enColumna()) splits.agentes.classList.add("ver-det");
    iN.focus();
  }
  bNuevo.addEventListener("click", async () => { if (await agPuede()) { ag.actual = null; if (!ag.datos) await agCargar(); agPintar(); agForm(null); } });

  // ==================================================================== CONFIG · skills
  // Filas por uso (Diario, Requerimientos, Equipo, Sistema) con nombre humano y qué hace en una línea; el grupo, el
  // título y la línea los da el servidor (META_SKILL). La ficha trae los ajustes de la skill que los declare.
  const sk = { datos: null, actual: null, filtro: "" };
  const skLista = el("div", {});
  const skDet = el("div", { className: "osm-det" });
  const skVacio = () => skDet.replaceChildren(vacio("Elige una skill", "Verás qué hace y cuándo se usa. Las que dicen cuántos entregables generan tienen ajustes que puedes prender o apagar.",
    el("button", { type: "button", className: "osm-btn", textContent: "Abrir los ajustes de Paso a producción", hidden: !(sk.datos && sk.datos.skills.some((x) => x.ajustes)), onclick: () => { const s = sk.datos && sk.datos.skills.find((x) => x.ajustes); if (s) skVer(s); } })));
  skVacio();
  paneles.skills.append(el("div", { className: "osm-tp-h" }, el("p", { textContent: "Qué hace cada skill y qué genera. Solo algunas tienen ajustes." })), split("skills", el("div", { className: "osm-lista" }, saltar(skDet), buscador("Buscar skill", (q) => { sk.filtro = q; if (sk.datos) skPintar(); }), skLista), skDet));
  conEsqueleto(skLista, 6);

  async function skCargar() {
    if (!sk.datos) conEsqueleto(skLista, 6);
    try { const r = await fetch("/api/config/skills"); if (!r.ok) throw new Error("respuesta " + r.status); sk.datos = await r.json(); }
    catch (e) { errorCarga(skLista, "las skills", e, skCargar); return; }
    skLista.removeAttribute("aria-busy");
    cuentas.skills.textContent = sk.datos.skills.length;
    const atajo = skDet.querySelector(".osm-vacio-caja .osm-btn"); if (atajo) atajo.hidden = !sk.datos.skills.some((x) => x.ajustes);
    skPintar();
    if (!pp.datos && sk.datos.skills.some((s) => s.ajustes && s.ajustes.panel === "paso-produccion")) ppCargar().then(skPintar);
    if (!sk.restaurado) {
      sk.restaurado = true;
      const quiere = sk.pedido || ult.sk, s = quiere && sk.datos.skills.find((x) => x.nombre === quiere);
      if (s) skVer(s, !sk.pedido);
    }
  }
  const generados = () => { if (!pp.datos || !pp.datos.entregables) return null; const off = ppEfectivos(); return { on: pp.datos.entregables.length - off.size, total: pp.datos.entregables.length }; };
  function skPintar() {
    const todas = sk.datos.skills || [];
    if (!todas.length) { skLista.replaceChildren(el("p", { className: "osm-vacio", textContent: "No encontré skills del Personal OS instaladas." })); return; }
    const q = sk.filtro || "";
    const l = q ? todas.filter((s) => [s.nombre, s.titulo, s.corto, s.que_hace, s.cuando].join(" ").toLowerCase().includes(q)) : todas;
    const hijos = [];
    if (q) hijos.push(el("p", { className: "osm-cuenta", role: "status", textContent: l.length ? `${l.length} de ${todas.length}` : `Ninguna skill coincide con «${q}».` }));
    const g = generados();
    for (const grupo of sk.datos.grupos || [...new Set(todas.map((s) => s.grupo))]) {
      const del = l.filter((s) => s.grupo === grupo); if (!del.length) continue;
      hijos.push(...grupoLista("osm-skg-" + slugDe(grupo), grupo, del.map((s) => {
        const tag = s.ajustes && s.ajustes.panel === "paso-produccion" && g ? el("span", { className: "osm-tag", textContent: `${g.on} de ${g.total}`, title: `Genera ${g.on} de ${g.total} entregables` }) : "";
        const li = fila({ titulo: s.titulo || s.nombre, sub: s.corto || s.que_hace, extra: tag, actual: sk.actual === s.nombre, alClic: () => skVer(s) });
        li.firstChild.dataset.skill = s.nombre;
        return li;
      })));
    }
    skLista.replaceChildren(...hijos);
  }
  // «Úsala cuando digan "x", "y"… o se planee…» le habla a Claude; quien lee necesita «Se activa con …».
  const paraLector = (t) => {
    let x = String(t || "").replace(/^Úsal[ao]\s+(?:también\s+)?cuando\s+(?:el usuario\s+|te\s+)?(?:digan?|diga|pidan?|escriban?)\s*/i, "").replace(/^Úsal[ao]\s+/i, "").trim();
    const m = x.match(/^(.*["»”])\s*,?\s+o\s+(.+)$/s);
    if (m) {
      let cola = m[2].replace(/\.\s*$/, "").trim();
      cola = /^(cuando|al|si|antes|después)\b/i.test(cola) ? cola : (/^(se|el|la|los|las|haya|pase|pida|llegue)\b/i.test(cola) ? "cuando " + cola : cola);
      x = `${m[1]}. También ${cola}.`;
    }
    return x.replace(/^./, (c) => c.toUpperCase());
  };
  function skVer(s, restaurando) {
    sk.actual = s.nombre; skPintar(); recordar("sk", s.nombre);
    if (tabActual === "skills") escribirEnlace("skills", s.nombre);
    const mas = el("details", { className: "osm-mas" }, el("summary", { textContent: "Cuándo se usa y qué no hace" }),
      el("div", { className: "osm-mas-c" },
        el("p", {}, el("b", { textContent: "Comando. " }), el("span", { className: "osm-slug", textContent: "/" + s.nombre })),
        s.que_hace && s.corto && s.que_hace !== s.corto ? el("p", {}, el("b", { textContent: "En detalle. " }), s.que_hace) : "",
        s.cuando ? el("p", {}, el("b", { textContent: "Se activa con " }), paraLector(s.cuando).replace(/^./, (c) => c.toLowerCase())) : "",
        s.no_es ? el("p", {}, el("b", { textContent: "No es para… " }), s.no_es.replace(/^No es para\s*/i, "")) : ""));
    const hijos = [volver("skills", "Skills", () => skLista.querySelector('.osm-row[aria-current="true"]')),
      el("div", { className: "osm-det-h" }, el("h3", { className: "osm-ficha-h", textContent: s.titulo || s.nombre })),
      el("p", { className: "osm-resumen", textContent: s.corto || s.que_hace || "" }),
      s.error ? el("p", { className: "osm-err", textContent: s.error === "no está instalada" ? "Esta skill no está instalada en este equipo." : "No pude leer la descripción de esta skill." }) : "",
      mas];
    if (s.ajustes && s.ajustes.panel === "paso-produccion") { hijos.push(ppPanel); if (!pp.datos) ppCargar(); else ppPintar(); }
    else hijos.push(notaI("Esta skill no tiene ajustes: Claude la usa cuando la tarea lo pide."));
    skDet.replaceChildren(...hijos.filter(Boolean));
    mostrarFicha("skills", skDet, restaurando);
  }

  // ---- ajustes de paso-a-produccion: qué se genera (autoguardado con «Deshacer»)
  // Una casilla por entregable de `paso_produccion` (fuentes.yaml). Desmarcar = su id entra en `omitir`; por
  // defecto se genera todo. Un entregable con `con: <padre>` se omite con su padre.
  const pp = { datos: null, reloj: null, deshacer: null, relojD: null, guardadoA: null };
  const ppCuerpo = el("div", { className: "osm-cols" }, ...esqueleto(3));
  const ppCuenta = el("span", { className: "osm-tag" });
  const ppEst = el("span", { className: "st", role: "status" }); ppEst.setAttribute("aria-live", "polite");
  const ppAvisoHijo = el("p", { className: "osm-aviso-l", role: "status" }); ppAvisoHijo.setAttribute("aria-live", "polite");
  const ppTodo = el("button", { type: "button", className: "osm-lnk", textContent: "Generar todo" });
  const ppPanel = el("div", { id: "osm-pp-panel", role: "group" },
    el("div", { className: "osm-ajh" }, el("h4", { id: "osm-pp-tit", textContent: "Qué se genera" }), ppCuenta, ppEst),
    ppAvisoHijo, ppCuerpo,
    notaI("Lo que apagues deja de generarse y de exigirse en el paquete. Es tu preferencia: no afecta a nadie más. ", ppTodo));
  ppPanel.setAttribute("aria-labelledby", "osm-pp-tit");
  function ppEstado(t, tono) {
    // «● Se guarda solo · guardado a las hh:mm · Deshacer»: la hora queda como prueba del último guardado
    const hijos = [el("span", { className: "pto", textContent: "●" })];
    if (tono === "error") hijos.push(t);
    else {
      hijos.push(t || "Se guarda solo");
      if (pp.guardadoA && !t) hijos.push(` · guardado a las ${pp.guardadoA}`);
      else if (!t && pp.datos && pp.datos.actualizado) hijos.push(" · guardado el " + new Date(pp.datos.actualizado).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }));
      if (pp.deshacer && !t) { hijos.push(" ·"); hijos.push(el("button", { type: "button", className: "osm-lnk", textContent: "Deshacer", onclick: ppDeshacer })); }
    }
    ppEst.className = "st" + (tono === "error" ? " error" : "");
    ppEst.replaceChildren(...hijos);
  }
  const ppEfectivos = () => {
    const d = pp.datos; if (!d || !d.entregables) return new Set();
    const off = new Set(d.entregables.filter((e) => e.omitido).map((e) => e.id));
    let cambio = true;
    while (cambio) { cambio = false; for (const e of d.entregables) if (!off.has(e.id) && e.con && off.has(e.con)) { off.add(e.id); cambio = true; } }
    return off;
  };
  async function ppCargar() {
    if (!pp.datos) ppCuerpo.replaceChildren(...esqueleto(3));
    try { const r = await fetch("/api/config/paso-produccion"); if (!r.ok) throw new Error("respuesta " + r.status); pp.datos = await r.json(); }
    catch (e) { ppCuerpo.className = ""; errorCarga(ppCuerpo, "tus ajustes de paso a producción", e, ppCargar); return; }
    ppPintar();
  }
  const corto = (n) => n.split(/[,(:]| que /)[0].trim();
  function ppPintar() {
    const d = pp.datos; if (!d) return;
    if (!d.ruta_existe || !d.seccion || !d.entregables.length) {
      ppTodo.hidden = true; ppCuenta.textContent = ""; ppCuerpo.className = "";
      ppCuerpo.replaceChildren(vacio("Todavía no hay entregables", !d.ruta_existe
        ? "No encuentro tu archivo de fuentes (fuentes.yaml) en la carpeta de configuración del Personal OS. Corre una vez la skill paso-a-produccion: la primera vez lo prepara y aquí aparecerán los entregables."
        : "Tu fuentes.yaml todavía no tiene la lista de entregables de paso a producción. Corre una vez la skill paso-a-produccion (o copia su config-ejemplo.yaml) y aquí podrás prender y apagar cada uno."));
      return;
    }
    const ids = new Set(d.entregables.map((e) => e.id));
    const off = ppEfectivos();
    ppCuenta.textContent = `${d.entregables.length - off.size} de ${d.entregables.length}`;
    ppTodo.hidden = off.size === 0;
    const casilla = (e, hijo) => {
      const padreOff = hijo && off.has(e.con);
      const inp = el("input", { type: "checkbox", id: "osm-pp-" + e.id, checked: !off.has(e.id), disabled: !!padreOff });
      inp.dataset.id = e.id;
      const padre = hijo ? d.entregables.find((x) => x.id === e.con) : null;
      const pn = padre ? (padre.corto || corto(padre.nombre)).toLowerCase() : "";
      const motivo = hijo ? el("small", { id: "osm-pp-m-" + e.id, textContent: padreOff ? `No se genera porque «${pn}» está apagado: préndelo para elegir este.` : `Va con «${pn}»: si lo apagas, este también se apaga.` }) : "";
      if (motivo) inp.setAttribute("aria-describedby", motivo.id);
      const lab = el("label", { htmlFor: inp.id, className: "osm-chk" + (hijo ? " hijo" : "") + (padreOff ? " bloq" : ""), title: e.corto && e.corto !== e.nombre ? e.nombre : "" }, inp, el("span", {}, e.corto || e.nombre, motivo));
      return lab;
    };
    const BLOQUES = [["especificacion", "Especificación y diseño"], ["pruebas", "Pruebas y QA"], ["despliegue", "Despliegue"], ["comunicacion", "Comunicación y manuales"], ["otros", "Otros"]];
    const DE = { funcional: "especificacion", tecnica: "especificacion", impacto: "especificacion", "diagrama-clases": "especificacion", "modelo-er": "especificacion",
      "pruebas-unitarias": "pruebas", "ruta-critica": "pruebas", "pruebas-funcionales": "pruebas", qa: "pruebas",
      "plan-despliegue": "despliegue", apertura: "despliegue",
      "manual-usuario": "comunicacion", "guia-soporte": "comunicacion", "guia-datos": "comunicacion", comunicado: "comunicacion", video: "comunicacion" };
    const padres = d.entregables.filter((e) => !e.con || !ids.has(e.con));
    const bloqueDe = (e) => { const g = String(e.grupo || DE[e.id] || "otros").toLowerCase(); return BLOQUES.some(([k]) => k === g) ? g : "otros"; };
    ppCuerpo.className = "osm-cols";
    ppCuerpo.replaceChildren(...BLOQUES.map(([k, t]) => {
      const ps = padres.filter((p) => bloqueDe(p) === k); if (!ps.length) return null;
      const hId = "osm-pp-b-" + k;
      const b = el("div", { className: "osm-bloque", role: "group" }, el("p", { className: "osm-gh", id: hId, textContent: t }),
        ...ps.flatMap((p) => [casilla(p, false), ...d.entregables.filter((h) => h.con === p.id).map((h) => casilla(h, true))]));
      b.setAttribute("aria-labelledby", hId);
      return b;
    }).filter(Boolean));
    ppEstado();
  }
  async function ppGuardar(omitir, foco, deshacible) {
    const antes = pp.datos.entregables.filter((e) => e.omitido).map((e) => e.id);
    ppCuerpo.setAttribute("aria-busy", "true"); ppEstado("Guardando…");
    try {
      const r = await fetch("/api/config/paso-produccion", { method: "POST", headers: { "Content-Type": "application/json", "X-OS-Token": TOKEN }, body: JSON.stringify({ omitir }) });
      let j; try { j = await r.json(); } catch (_) { j = { ok: false, mensaje: `respuesta ${r.status}` }; }
      if (r.status === 403) j.mensaje = "el servidor se reinició: recarga la página (Ctrl+R)";
      if (!j.ok) throw new Error(j.mensaje || "no se pudo guardar");
      const set = new Set(j.omitir);
      for (const e of pp.datos.entregables) e.omitido = set.has(e.id);
      pp.guardadoA = hora();
      clearTimeout(pp.relojD);
      pp.deshacer = deshacible ? antes : null;
      if (pp.deshacer) pp.relojD = setTimeout(() => { pp.deshacer = null; ppEstado(); }, 10000);   // «Deshacer» dura 10 s
      ppPintar(); if (sk.datos) skPintar();
      const vuelta = foco && $("#osm-pp-" + foco); if (vuelta) vuelta.focus();
      return true;
    } catch (e) { ppEstado("No se guardó: " + e.message, "error"); return false; }
    finally { ppCuerpo.removeAttribute("aria-busy"); }
  }
  async function ppDeshacer() {
    const v = pp.deshacer; if (!v) return;
    pp.deshacer = null; clearTimeout(pp.relojD);
    if (await ppGuardar(v, null, false)) { ppAvisoHijo.textContent = "Se deshizo el último cambio."; clearTimeout(pp.reloj); pp.reloj = setTimeout(() => { ppAvisoHijo.textContent = ""; }, 4000); }
  }
  ppCuerpo.addEventListener("change", async (ev) => {
    const inp = ev.target.closest("input[data-id]"); if (!inp || !pp.datos) return;
    const id = inp.dataset.id;
    const antes = pp.datos.entregables.filter((e) => e.omitido).map((e) => e.id);
    const omitir = inp.checked ? antes.filter((x) => x !== id) : [...antes, id];
    const ok = await ppGuardar(omitir, id, true);
    if (!ok) { inp.checked = !inp.checked; return; }
    const hijos = pp.datos.entregables.filter((h) => h.con === id).map((h) => (h.corto || corto(h.nombre)).toLowerCase());
    clearTimeout(pp.reloj);
    ppAvisoHijo.textContent = hijos.length ? (inp.checked ? `También se volvió a generar: ${hijos.join(", ")}.` : `También se dejó de generar: ${hijos.join(", ")}.`) : "";
    if (hijos.length) pp.reloj = setTimeout(() => { ppAvisoHijo.textContent = ""; }, 6000);
  });
  ppTodo.addEventListener("click", async () => {
    const n = ppEfectivos().size; if (!n) return;
    if (!(await confirmar("Generar todo el paquete", `Vuelven a generarse y a exigirse los ${n} entregables que tenías apagados. Se guarda al aceptar y puedes deshacerlo durante 10 segundos.`))) return;
    await ppGuardar([], null, true); ppAvisoHijo.textContent = "";
  });

  // ==================================================================== CONFIG · bases de datos (permisos por conexión)
  // Una ficha por conexión con su permiso por acción. Son decisiones con efecto: nada se guarda hasta Guardar
  // (CO-045). La contraseña nunca llega por GET: el ojo la pide con token y se oculta a los 30 s o al salir.
  const bd = { datos: null, actual: null, sucio: false, reloj: null, tic: null, filtro: "" };
  const bdLista = el("div", {});
  const bdDet = el("div", { className: "osm-det" });
  const bdNueva = el("button", { type: "button", className: "osm-btn", textContent: "+ Nueva conexión" });
  const bdVacio = () => bdDet.replaceChildren(vacio("Elige una conexión", "Verás sus datos y qué puede hacer Claude en ella: leer, escribir o cambiar la estructura. Para agregar una, usa «+ Nueva conexión»."));
  bdVacio();
  conEsqueleto(bdLista, 2);
  const bdAyudaBtn = el("button", { type: "button", className: "osm-ayuda", textContent: "?", ariaLabel: "Cómo funcionan los permisos de bases de datos" });
  const bdAyuda = el("dialog", { className: "osm-dlg ancho", ariaLabel: "Cómo funcionan los permisos de bases de datos" },
    el("h2", { textContent: "Bases de datos: cómo funcionan los permisos" }),
    el("div", { className: "osm-ayuda-t" },
      el("p", { textContent: "Cada conexión guarda su servidor, usuario, contraseña, las bases que puede usar y sus permisos. Las que ya usaban tus herramientas se quedan donde estaban; las que creas aquí quedan en la carpeta del Personal OS. El nombre y las etiquetas los pones tú: la etiqueta dice qué es (producción, staging, QA o una tuya)." }),
      el("p", {}, el("b", { textContent: "Leer tiene tres modos. " }), el("b", { textContent: "Bloqueado" }), ": Claude no consulta esa base. ",
        el("b", { textContent: "Me pregunta" }), ": te muestra la consulta y la base y espera tu OK cada vez. ",
        el("b", { textContent: "Automático" }), ": consulta sin preguntarte, siempre con límite de filas y sin mostrar contraseñas."),
      el("p", {}, el("b", { textContent: "Las escrituras las ejecutas tú. " }), "Crear, actualizar, borrar, cambiar la estructura y ejecutar procedimientos no tienen modo: Claude nunca los ejecuta en ninguna base. Te entrega el script de publicación con su rollback y tú lo corres por tus canales."),
      el("p", {}, el("b", { textContent: "Quién lo hace cumplir. " }), "El guardia de Claude Code revisa cada comando antes de correrlo y los lectores de base de datos (dbread, mongoread) revisan la conexión a la que van. Los dos leen esta misma tabla."),
      el("p", {}, el("b", { textContent: "Por qué puede saltar una alerta. " }), "Tu organización puede tener sus propias reglas, y se revisan aparte de este panel. Aunque aquí pongas una base de producción en automático, esas reglas pueden bloquear la acción o avisarte: siempre gana la más estricta."),
      el("p", {}, el("b", { textContent: "La contraseña. " }), "No viaja al abrir la página. El botón del ojo la pide al servidor local de tu computador solo cuando lo pulsas y se vuelve a ocultar a los 30 segundos o al salir de la ficha. Para cambiarla, escribe la nueva y guarda; si dejas el campo vacío se conserva la que hay.")),
    el("div", { className: "osm-pie-f" }, el("span", { className: "esp" }), el("button", { type: "button", className: "osm-btn prim", textContent: "Entendido" })));
  document.body.append(bdAyuda);
  bdAyudaBtn.addEventListener("click", () => { bdAyuda.showModal(); bdAyuda.querySelector("button").focus(); });
  bdAyuda.querySelector("button").addEventListener("click", () => bdAyuda.close());
  bdAyuda.addEventListener("close", () => bdAyudaBtn.focus());   // con «Entendido» o con Escape
  paneles.bd.append(
    el("div", { className: "osm-tp-h" }, el("p", { textContent: "Las conexiones que Claude puede leer y cómo. Las escrituras siempre te llegan como script." }), bdAyudaBtn, bdNueva),
    split("bd", el("div", { className: "osm-lista" }, saltar(bdDet), buscador("Buscar conexión", (q) => { bd.filtro = q; if (bd.datos) bdPintar(); }), bdLista), bdDet));

  const ESCRITURA = ["crear", "actualizar", "borrar", "estructura", "ejecutar"];
  const MODO_ES = { bloqueado: "Bloqueado", preguntar: "Me pregunta", automatico: "Automático" };
  const MODO_CORTO = { bloqueado: "bloqueado", preguntar: "pregunta", automatico: "automático" };
  const MOTOR_ES = { sqlserver: "SQL Server", mongodb: "MongoDB", mongo: "MongoDB", postgres: "PostgreSQL", postgresql: "PostgreSQL", mysql: "MySQL", oracle: "Oracle", sqlite: "SQLite" };
  const ETQ_ES = { produccion: "producción" };   // el valor guardado no cambia; solo cómo se lee
  const etqTxt = (t) => ETQ_ES[t] || t;
  const ACC_DESC = { leer: "consultar datos", crear: "agregar filas", actualizar: "cambiar filas", borrar: "eliminar filas", estructura: "tablas, columnas, índices", ejecutar: "procedimientos almacenados" };
  const resumenPerm = (p) => {
    p = p || {};
    return `Leer: ${MODO_CORTO[p.leer || "preguntar"]} · escrituras como script`;
  };
  async function bdCargar(sel) {
    if (!bd.datos) conEsqueleto(bdLista, 2);
    try { const r = await fetch("/api/config/bd"); if (!r.ok) throw new Error("respuesta " + r.status); bd.datos = await r.json(); }
    catch (e) { errorCarga(bdLista, "las conexiones", e, () => bdCargar(sel)); return; }
    bdLista.removeAttribute("aria-busy");
    cuentas.bd.textContent = bd.datos.conexiones.length;
    bdPintar();
    if (sel) { const c = bd.datos.conexiones.find((x) => x.id === sel); if (c) bdVer(c, true, true); return; }
    if (!bd.restaurado) {
      bd.restaurado = true;
      const quiere = bd.pedido || ult.bd, c = quiere && bd.datos.conexiones.find((x) => x.id === quiere);
      if (c) bdVer(c, true, !bd.pedido);
    }
  }
  function bdPintar() {
    const todas = bd.datos.conexiones || [];
    if (!todas.length) { bdLista.replaceChildren(vacio("No hay conexiones todavía", "Crea la primera con «+ Nueva conexión»: su servidor, usuario y permisos.")); return; }
    const q = bd.filtro || "";
    const l = q ? todas.filter((c) => [c.nombre, ...(c.etiquetas || [])].join(" ").toLowerCase().includes(q)) : todas;
    const hijos = q ? [el("p", { className: "osm-cuenta", role: "status", textContent: l.length ? `${l.length} de ${todas.length}` : `Ninguna conexión coincide con «${q}».` })] : [];
    const u = el("ul", { className: "osm-ul", ariaLabel: "Conexiones" }, ...l.map((c) => {
      const sucia = bd.sucio && bd.actual === c.id;
      const li = fila({ titulo: c.nombre, sub: [(c.etiquetas || []).length ? c.etiquetas.map(etqTxt).join(" · ") : "sin etiqueta", resumenPerm(c.permisos)].join(" · "),
        extra: sucia ? el("span", { className: "osm-punto", title: "Cambios sin guardar", ariaLabel: "cambios sin guardar" }) : "",
        actual: bd.actual === c.id, alClic: () => bdVer(c) });
      li.firstChild.dataset.id = c.id; li.firstChild.classList.add("osm-bd-it");
      return li;
    }));
    bdLista.replaceChildren(...hijos, u);
  }
  function bdOcultarClave() { clearTimeout(bd.reloj); clearInterval(bd.tic); bd.reloj = null; bd.tic = null; }
  async function bdVer(c, forzar, restaurando) {
    if (bd.sucio && !forzar && !(await confirmar("Descartar cambios", "Esta conexión tiene cambios sin guardar. ¿Los descartas?"))) return;
    bdOcultarClave();
    bd.actual = c ? c.id : null; bd.sucio = false; bdPintar();
    if (c) { recordar("bd", c.id); if (tabActual === "bd") escribirEnlace("bd", c.id); }
    const nueva = !c;
    c = c || { id: null, nombre: "", motor: (bd.datos.motores || ["sqlserver"])[0], servidor: "", usuario: "", catalogos: [], etiquetas: [], password_guardada: false,
      permisos: { leer: "preguntar" } };
    const P = pieGuardar(nueva ? null : "Quitar conexión", { cancelar: nueva });
    P.limpio();
    if (bd.guardadoEn && bd.guardadoEn.id === c.id) { P.est.textContent = `Guardado a las ${bd.guardadoEn.hora}`; P.est.className = "est ok"; }
    let tocadoSensible = false;   // permisos o contraseña: descartarlos pide confirmación
    const marcar = () => { const antes = bd.sucio; bd.sucio = true; P.sucio(); avisoProd(); if (!antes) bdPintar(); };
    const campoV = (id, rot, input, ayuda, obligatorio) => {
      input.id = id;
      const err = el("small", { className: "err", id: id + "-err", hidden: true });
      const ay = ayuda ? el("small", { id: id + "-ay", textContent: ayuda }) : null;
      input.setAttribute("aria-describedby", [ay ? ay.id : "", err.id].filter(Boolean).join(" "));
      if (obligatorio) input.required = true;
      const caja = el("div", { className: "osm-f" }, el("label", { htmlFor: id, textContent: rot + (obligatorio ? " *" : "") }), input, ay, err);
      caja.error = (t) => { err.textContent = t || ""; err.hidden = !t; input.setAttribute("aria-invalid", String(!!t)); };
      return caja;
    };
    const iNombre = el("input", { type: "text", value: c.nombre, maxLength: 60, placeholder: "p. ej. Base de pruebas", autocomplete: "off" });
    const iMotor = el("select", {}, ...(bd.datos.motores || []).map((m) => el("option", { value: m, textContent: MOTOR_ES[m] || m, selected: m === c.motor })));
    const iServ = el("input", { type: "text", value: c.servidor, maxLength: 200, autocomplete: "off", placeholder: "nombre o dirección del servidor" });
    const iUsu = el("input", { type: "text", value: c.usuario, maxLength: 200, autocomplete: "off" });
    const iCat = el("input", { type: "text", value: c.catalogos.join(", "), placeholder: "p. ej. ventas, ventas_historico" });
    const fNombre = campoV("osm-bd-nom", "Nombre", iNombre, null, true), fMotor = campoV("osm-bd-mot", "Motor", iMotor);
    const fServ = campoV("osm-bd-srv", "Servidor", iServ, null, true), fUsu = campoV("osm-bd-usu", "Usuario", iUsu, null, true);
    const fCat = campoV("osm-bd-cat", "Bases que puede usar", iCat, "Separadas por coma.");
    const iPwd = el("input", { type: "password", id: "osm-bd-pwd", autocomplete: "new-password", placeholder: c.password_guardada ? "•••••••• guardada" : "sin contraseña guardada" });
    iPwd.setAttribute("aria-describedby", "osm-bd-pwd-ay");
    let pwdEditada = false, pwdRevelada = false;
    const bOjo = el("button", { type: "button", className: "osm-ibtn", ariaLabel: "Mostrar la contraseña" }, svg("ojo"));
    bOjo.setAttribute("aria-pressed", "false");
    const ojoT = el("span", { className: "osm-ojo-t" });
    const ocultar = () => { bdOcultarClave(); ojoT.textContent = ""; if (pwdRevelada && !pwdEditada) iPwd.value = ""; pwdRevelada = false; iPwd.type = "password"; bOjo.ariaLabel = "Mostrar la contraseña"; bOjo.setAttribute("aria-pressed", "false"); };
    bOjo.addEventListener("click", async () => {
      if (iPwd.type === "text") { ocultar(); return; }
      if (!pwdEditada && c.id && c.password_guardada) {
        try {
          const r = await fetch("/api/config/bd/revelar", { method: "POST", headers: { "Content-Type": "application/json", "X-OS-Token": TOKEN }, body: JSON.stringify({ id: c.id }) });
          const j = await r.json();
          if (!j.ok) throw new Error(r.status === 403 ? "el servidor se reinició: recarga la página" : j.mensaje || "no se pudo leer");
          iPwd.value = j.password; pwdRevelada = true;
        } catch (e) { P.error(e.message); return; }
      }
      iPwd.type = "text"; bOjo.ariaLabel = "Ocultar la contraseña"; bOjo.setAttribute("aria-pressed", "true");
      let quedan = 30; ojoT.textContent = quedan + " s";
      bd.tic = setInterval(() => { quedan -= 1; ojoT.textContent = quedan > 0 ? quedan + " s" : ""; }, 1000);
      bd.reloj = setTimeout(ocultar, 30000);
    });
    iPwd.addEventListener("input", () => { pwdEditada = true; pwdRevelada = false; tocadoSensible = true; marcar(); });
    // etiquetas: estándar + propias como botones que se prenden; «+ Nueva etiqueta» abre su campo (Enter la crea)
    const sel = new Set(c.etiquetas);
    const rotEtq = el("span", { className: "l", id: "osm-bd-etq-rot", textContent: "Etiquetas" });
    const cajaEtq = el("div", { className: "osm-toggles", role: "group" });
    cajaEtq.setAttribute("aria-labelledby", rotEtq.id);
    const todasEtq = () => [...bd.datos.etiquetas_estandar, ...bd.datos.etiquetas_propias];
    const iEtq = el("input", { type: "text", id: "osm-bd-etq", maxLength: 30, placeholder: "nombre de la etiqueta", autocomplete: "off" });
    const errEtq = el("small", { className: "err", id: "osm-bd-etq-err", hidden: true });
    iEtq.setAttribute("aria-describedby", errEtq.id);
    const bEtq = el("button", { type: "button", className: "osm-btn", textContent: "Crear" });
    const cajaNueva = el("div", { className: "osm-nueva-e", hidden: true }, el("label", { htmlFor: "osm-bd-etq", className: "osm-saltar", textContent: "Nueva etiqueta" }), iEtq, bEtq);
    const bMas = el("button", { type: "button", className: "osm-pill osm-tg add", textContent: "+ Nueva etiqueta" });
    bMas.setAttribute("aria-expanded", "false");
    bMas.addEventListener("click", () => { cajaNueva.hidden = !cajaNueva.hidden; bMas.setAttribute("aria-expanded", String(!cajaNueva.hidden)); if (!cajaNueva.hidden) iEtq.focus(); });
    const pintarEtq = () => cajaEtq.replaceChildren(...todasEtq().map((t) => {
      const b = el("button", { type: "button", className: "osm-pill osm-tg" + (t === "produccion" ? " prod" : ""), textContent: etqTxt(t) });
      b.setAttribute("aria-pressed", String(sel.has(t)));
      b.addEventListener("click", async () => {
        const prender = !sel.has(t);
        if (prender && t === "produccion" && perm.leer === "automatico"
          && !(await confirmar("Base de producción con lectura automática", "Esta conexión lee en automático. Si la marcas como producción, Claude consultará producción sin preguntarte. ¿La marcas igual?"))) return;
        if (prender) sel.add(t); else sel.delete(t);
        b.setAttribute("aria-pressed", String(prender)); marcar();
      });
      return b;
    }), bMas);
    pintarEtq();
    const crearEtq = async () => {
      const v = iEtq.value.trim(); errEtq.hidden = true; iEtq.removeAttribute("aria-invalid"); if (!v) return;
      if (todasEtq().some((t) => t.toLowerCase() === v.toLowerCase())) { errEtq.textContent = `«${v}» ya existe: márcala arriba.`; errEtq.hidden = false; iEtq.setAttribute("aria-invalid", "true"); return; }
      try {
        const r = await fetch("/api/config/bd/etiqueta", { method: "POST", headers: { "Content-Type": "application/json", "X-OS-Token": TOKEN }, body: JSON.stringify({ etiqueta: v }) });
        const j = await r.json(); if (!j.ok) throw new Error(j.mensaje);
        bd.datos.etiquetas_propias = j.etiquetas_propias; sel.add(j.etiqueta); iEtq.value = ""; cajaNueva.hidden = true; bMas.setAttribute("aria-expanded", "false"); pintarEtq(); marcar();
      } catch (e) { errEtq.textContent = e.message; errEtq.hidden = false; }
    };
    bEtq.addEventListener("click", crearEtq);
    iEtq.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); crearEtq(); } if (ev.key === "Escape") { cajaNueva.hidden = true; bMas.setAttribute("aria-expanded", "false"); bMas.focus(); } });
    // permisos (D-071 F2): Leer es un radiogroup; las escrituras no tienen modo, Claude entrega el script
    const perm = { leer: (c.permisos && c.permisos.leer) || "preguntar" };
    const CORTO = { bloqueado: "Bloq.", preguntar: "Pregunta", automatico: "Auto" };
    const thModo = (m) => { const th = el("th", { scope: "col" }, el("span", { className: "lg", textContent: MODO_ES[m] }), el("abbr", { className: "sh", title: MODO_ES[m], textContent: CORTO[m] }));
      th.setAttribute("aria-label", MODO_ES[m]); return th; };
    const tabla = el("table", { className: "osm-perm" },
      el("thead", {}, el("tr", {}, el("th", { scope: "col", textContent: "Acción" }), ...bd.datos.modos.map(thModo))),
      el("tbody", {}, ...bd.datos.acciones.map((a) => {
        const thId = "osm-bd-a-" + a.id;
        const cab = el("th", { scope: "row", id: thId, title: a.sql || "" }, a.nombre, el("small", { textContent: ACC_DESC[a.id] || a.sql }));
        if (ESCRITURA.includes(a.id)) {
          const td = el("td", { className: "osm-perm-script" }, el("span", { textContent: "Claude entrega el script" }));
          td.colSpan = bd.datos.modos.length;
          td.setAttribute("aria-describedby", "osm-bd-nota-esc");
          return el("tr", {}, cab, td);
        }
        const tr = el("tr", { role: "radiogroup" }, cab,
          ...bd.datos.modos.map((m) => {
            const r = el("input", { type: "radio", name: "osm-bd-" + a.id, value: m, checked: perm[a.id] === m,
              ariaLabel: `${a.nombre}: ${MODO_ES[m]}` });
            r.addEventListener("change", async () => {
              if (m === "automatico" && sel.has("produccion")
                && !(await confirmar("Lectura automática en producción", "Claude consultaría esta base de producción sin preguntarte. ¿Lo dejas así?"))) {
                const prev = tr.querySelector(`input[value="${perm[a.id]}"]`); if (prev) prev.checked = true; return;
              }
              perm[a.id] = m; tocadoSensible = true; marcar();
            });
            return el("td", {}, el("label", {}, r));
          }));
        tr.setAttribute("aria-labelledby", thId);
        return tr;   // los radios de la fila comparten name: el navegador ya los agrupa
      })));
    const notaTabla = notaI("Las escrituras no las ejecuta Claude en ninguna base: te entrega el script de publicación con su rollback para que lo corras tú.");
    notaTabla.querySelector("span").id = "osm-bd-nota-esc";
    const notaNueva = nueva ? notaI("Por defecto, Leer te pregunta cada vez.") : "";
    const avisoHeredado = "";
    const aviso = el("div", { className: "osm-aviso-c", role: "note", hidden: true });
    const avisoProd = () => {
      const lee = perm.leer === "automatico";
      aviso.hidden = !(sel.has("produccion") && lee);
      aviso.replaceChildren(svg("alerta"), el("span", { textContent: "Ojo: esta conexión está etiquetada como producción y Claude lee en ella sin preguntarte. Se permite, salvo que las reglas de tu organización lo bloqueen; revísalo antes de guardar." }));
    };
    avisoProd();
    for (const i of [iNombre, iServ, iUsu, iCat]) i.addEventListener("input", marcar);
    iMotor.addEventListener("change", marcar);
    const validar = () => {
      let ok = true;
      const nom = iNombre.value.trim();
      const repetido = nom && bd.datos.conexiones.some((x) => x.id !== c.id && x.nombre.trim().toLowerCase() === nom.toLowerCase());
      fNombre.error(!nom ? "Ponle un nombre a la conexión." : repetido ? `Ya hay una conexión llamada «${nom}».` : ""); if (!nom || repetido) ok = false;
      fServ.error(iServ.value.trim() ? "" : "Falta el servidor."); if (!iServ.value.trim()) ok = false;
      fUsu.error(iUsu.value.trim() ? "" : "Falta el usuario."); if (!iUsu.value.trim()) ok = false;
      return ok;
    };
    P.d.addEventListener("click", async () => {
      if (bd.sucio && tocadoSensible && !(await confirmar("Descartar cambios", "Cambiaste permisos o la contraseña de esta conexión. Si descartas, se pierden. ¿Los descartas?"))) return;
      bd.sucio = false;
      if (nueva) { bd.actual = null; bdPintar(); bdVacio(); splits.bd.classList.remove("ver-det"); } else bdVer(bd.datos.conexiones.find((x) => x.id === c.id), true, true);
    });
    P.g.addEventListener("click", async () => {
      if (!validar()) { const x = bdDet.querySelector("[aria-invalid=true]"); if (x) x.focus(); P.error("Revisa los campos marcados."); return; }
      const cuerpo = { id: c.id || undefined, nombre: iNombre.value.trim(), motor: iMotor.value, servidor: iServ.value.trim(), usuario: iUsu.value.trim(),
        catalogos: iCat.value.split(",").map((s) => s.trim()).filter(Boolean), etiquetas: [...sel], permisos: perm };
      if (pwdEditada && iPwd.value) cuerpo.password = iPwd.value;
      P.ocupado(""); P.g.textContent = "Guardando…"; P.g.setAttribute("aria-busy", "true");
      try {
        const r = await fetch("/api/config/bd/guardar", { method: "POST", headers: { "Content-Type": "application/json", "X-OS-Token": TOKEN }, body: JSON.stringify(cuerpo) });
        let j; try { j = await r.json(); } catch (_) { j = { ok: false, mensaje: `respuesta ${r.status}` }; }
        if (r.status === 403) j.mensaje = "el servidor se reinició: recarga la página (Ctrl+R)";
        if (!j.ok) throw new Error(j.mensaje || "no se pudo guardar");
        bd.sucio = false; bd.guardadoEn = { id: j.id, hora: hora() }; await bdCargar(j.id);
      } catch (e) { P.error(e.message); P.g.disabled = false; }
      finally { P.g.textContent = "Guardar"; P.g.removeAttribute("aria-busy"); }
    });
    if (P.q) P.q.addEventListener("click", async () => {
      if (!(await confirmar("Quitar conexión", `«${c.nombre}» sale de la lista. Su archivo se respalda en la papelera de conexiones; si lo usaba otra herramienta, el archivo se queda donde está.`))) return;
      try {
        const r = await fetch("/api/config/bd/quitar", { method: "POST", headers: { "Content-Type": "application/json", "X-OS-Token": TOKEN }, body: JSON.stringify({ id: c.id }) });
        const j = await r.json(); if (!j.ok) throw new Error(j.mensaje);
        bd.sucio = false; bd.actual = null; await bdCargar();
        bdDet.replaceChildren(vacio("Conexión quitada", j.mensaje));
      } catch (e) { P.error(e.message); }
    });
    const motorTxt = MOTOR_ES[c.motor] || c.motor;
    bdDet.replaceChildren(
      volver("bd", "Conexiones", () => bdLista.querySelector('.osm-row[aria-current="true"]')),
      el("div", { className: "osm-det-h" }, el("h3", { className: "osm-ficha-h", textContent: nueva ? "Nueva conexión" : c.nombre }),
        el("span", { className: "osm-slug", textContent: [motorTxt, (c.etiquetas || []).length ? c.etiquetas.map(etqTxt).join(" · ") : "sin etiqueta"].join(" · ") })),
      el("p", { className: "osm-resumen", textContent: "Qué datos usa Claude para conectarse y qué puede hacer en esta base." }),
      c.error && !nueva ? el("p", { className: "osm-err", textContent: c.error }) : "",
      aviso, avisoHeredado,
      fNombre, el("div", { className: "osm-rej" }, fMotor, fServ, fUsu), fCat,
      el("div", { className: "osm-f" }, el("label", { htmlFor: "osm-bd-pwd", textContent: "Contraseña" }), el("div", { className: "osm-pw" }, iPwd, bOjo, ojoT),
        el("small", { id: "osm-bd-pwd-ay", textContent: c.password_guardada ? "Guardada. Escribe una nueva solo si quieres cambiarla; el ojo la muestra 30 segundos." : "Sin contraseña guardada todavía." })),
      el("div", { className: "osm-f" }, rotEtq, cajaEtq, cajaNueva, errEtq),
      gh("Qué puede hacer Claude"), tabla, notaTabla, notaNueva,
      P.caja);
    mostrarFicha("bd", bdDet, restaurando);
  }
  bdNueva.addEventListener("click", () => bdVer(null));

  // ---- carga de cada pestaña (una vez; el refresco nunca toca un formulario, CO-096)
  function cargarTab(id) {
    if (id === "agentes" && !ag.datos) agCargar();
    if (id === "skills" && !sk.datos) skCargar();
    if (id === "bd" && !bd.datos) bdCargar();
  }
  // Al entrar a Config: la pestaña del enlace o la última usada; las cuentas de las otras se llenan en segundo plano.
  function entrarConfig() {
    const e = leerEnlace();
    if (e && e.id) { if (e.tab === "skills") sk.pedido = e.id; else if (e.tab === "bd") bd.pedido = e.id; else ag.pedido = e.id; }
    let tab = ult.tab || "agentes";
    if (e) { if (paneles[e.tab]) tab = e.tab; else { ag.pedido = e.tab; tab = "agentes"; } }   // enlaces viejos: #config&nuevo y #config&<agente>
    irTab(paneles[tab] ? tab : "agentes");
    setTimeout(() => { for (const [k] of TABS) cargarTab(k); }, 300);
  }
  let yaEntro = false;
  new MutationObserver(() => {
    if (vConfig.classList.contains("active")) { if (!yaEntro) { yaEntro = true; entrarConfig(); } }
    else { const p = $("#osm-bd-pwd"); if (p && p.type === "text") p.closest(".osm-pw").querySelector("button").click(); }   // la contraseña revelada se borra al salir
  }).observe(vConfig, { attributes: true, attributeFilter: ["class"] });
  if (vConfig.classList.contains("active")) setTimeout(() => { if (!yaEntro) { yaEntro = true; entrarConfig(); } }, 0);
  addEventListener("hashchange", () => { const e = leerEnlace(); if (!e || !vConfig.classList.contains("active")) return;
    if (paneles[e.tab]) { irTab(e.tab); if (e.id) { if (e.tab === "skills" && sk.datos) { const s = sk.datos.skills.find((x) => x.nombre === e.id); if (s) skVer(s); } else if (e.tab === "bd" && bd.datos) { const c = bd.datos.conexiones.find((x) => x.id === e.id); if (c) bdVer(c); } else if (e.tab === "agentes" && ag.datos) { const a = ag.datos.agentes.find((x) => x.nombre === e.id); if (a) agVer(a); } } } });

  addEventListener("beforeunload", (e) => { if (ag.sucio || bd.sucio) { e.preventDefault(); e.returnValue = ""; } });
  // Cambiar de vista de la consola con una ficha sucia en Config pregunta antes (diálogo de la casa). Va en captura,
  // antes del cambio de vista; si se acepta, se descartan los cambios y se repite el clic.
  let tabPermitida = null;
  tabs.addEventListener("click", async (ev) => {
    const b = ev.target.closest("button[data-view]");
    if (!b || b === tabPermitida || b.dataset.view === "config" || !vConfig.classList.contains("active") || !(ag.sucio || bd.sucio)) { tabPermitida = null; return; }
    ev.preventDefault(); ev.stopImmediatePropagation();
    const que = [ag.sucio ? "la ficha del agente" : "", bd.sucio ? "la conexión de base de datos" : ""].filter(Boolean).join(" y ");
    if (!(await confirmar("Cambios sin guardar", `Tienes cambios sin guardar en ${que}. Si sales de Config se pierden. ¿Los descartas?`))) return;
    ag.sucio = false; bd.sucio = false;
    if (ag.actual) agVer(ag.actual, true, true); else vacioDet();
    const c = bd.actual && bd.datos ? bd.datos.conexiones.find((x) => x.id === bd.actual) : null;
    if (c) bdVer(c, true, true); else if (bd.actual === null && bdDet.querySelector(".osm-pg")) bdVacio();
    tabPermitida = b; b.click();
  }, true);

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
