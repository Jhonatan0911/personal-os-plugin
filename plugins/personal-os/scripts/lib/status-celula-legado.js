'use strict';
/*
 * Personal OS — status de la célula: convertidor del formato «legado» del JSON de datos.
 *
 * Antes del motor en Node, el tablero se generaba con un motor en Python cuyo JSON ya venía
 * pre-procesado: los items llegaban anclados a la ventana (con `recortada` / `fin_real`), las colas
 * del líder venían armadas como items `tipo: "grupo"`, lo cerrado como `tipo: "cerrada"`, el bloque
 * `jira` usaba `key`, `proyectos_cliente`, `celula` y `alias`, y el bloque `lider` traía `brief_fecha`,
 * `colas` y `propias`. Este módulo lo pasa al formato del motor actual SIN perder nada:
 *
 *   · se restaura la fecha real de cada item (el motor vuelve a anclarla y la marca «↤ dd/mm»);
 *   · las colas se descartan como items y se recalculan, pero la fecha de entrada de cada issue a su
 *     cola se conserva (`entrada_cola`), para que la espera no cambie;
 *   · el rol de líder y el displayName de Jira de cada persona salen de `jira.celula`;
 *   · los frentes con titular y backup del acuerdo de equipo pasan a `acuerdo_frentes`;
 *   · lo que el motor viejo traía fijo y el nuevo hace configurable (reparto 2/2, límite de 3 «en
 *     desarrollo») se copia SOLO si el JSON no lo trae.
 *
 * El motor lo aplica solo cuando detecta el formato (`esLegado`). También se puede guardar la
 * conversión con `status-celula.js <datos.json> --convertir <salida.json>`.
 */

const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const base = (n) => String(n || '').replace(/\s*\(.*$/, '').trim();
const valida = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

function esLegado(d) {
  if (!d || typeof d !== 'object') return false;
  const J = d.jira || {};
  if (J.proyectos_cliente || (Array.isArray(J.issues) && J.issues.some((i) => i && i.key && !i.clave))) return true;
  if ((d.items || []).some((i) => i && (i.tipo === 'grupo' || i.tipo === 'cerrada'))) return true;
  if (d.lider && (d.lider.colas || d.lider.brief_fecha || d.lider.propias)) return true;
  return false;
}

function convertir(d0) {
  const d = JSON.parse(JSON.stringify(d0));
  const notas = [];
  const J = d.jira || null;
  const celula = (J && J.celula) || [];

  // ── Personas: displayName de Jira y rol de líder desde jira.celula ─────────────────────────
  d.personas = (d.personas || []).map((p) => {
    const q = Object.assign({}, p);
    if (/\(l[ií]der\)/i.test(q.nombre || '')) { q.lider = true; q.nombre = q.nombre.replace(/\s*\(l[ií]der\)\s*/i, ' ').trim(); }
    const b = sinTildes(base(q.nombre));
    const m = celula.find((c) => sinTildes(c.nombre) === b) || celula.find((c) => sinTildes(c.jira) === b);
    if (m) {
      if (!q.jira) q.jira = m.jira;
      if (!q.rol && m.rol) q.rol = m.rol;
      if (/l[ií]der/i.test(m.rol || '')) q.lider = true;
      if (!q.correo && m.correo) q.correo = m.correo;
    }
    return q;
  });
  const items0 = d.items || [];
  if (!d.personas.some((p) => p.lider)) {
    const g = items0.find((i) => i.tipo === 'grupo' && i.persona);
    const p = g && d.personas.find((x) => x.slug === g.persona);
    if (p) { p.lider = true; notas.push(`Líder deducido de las colas del JSON: ${p.nombre}.`); }
  }
  const slugPorNombre = (n) => {
    if (!n) return null;
    const b = sinTildes(base(n));
    const p = d.personas.find((x) => sinTildes(base(x.nombre)) === b || sinTildes(x.jira) === b);
    return p ? p.slug : null;
  };

  // ── Items: fecha real restaurada, colas recalculables, cierres explícitos ──────────────────
  const entrada = new Map();
  for (const g of items0.filter((i) => i.tipo === 'grupo')) {
    for (const x of g.grupo || []) if (valida(x.desde)) entrada.set(x.id, x.desde);
  }
  const quitar = ['vencida', 'fijo', 'recortada', 'fin_real', 'espera', 'sla', 'grupo', 'grupo_de'];
  d.items = items0.filter((i) => i.tipo !== 'grupo').map((i) => {
    const x = Object.assign({}, i);
    // El tablero anterior anclaba al primer día de la ventana (fin === desde) y guardaba la fecha real en
    // `recortada`. Si el item NO estaba anclado, un `recortada` viejo no cuenta: manda `fin_real` / `fin`.
    const anclada = valida(i.recortada) ? i.fin === d.desde : (valida(i.fin_real) && valida(i.fin) && i.fin_real < i.fin);
    const real = (anclada && valida(i.recortada) ? i.recortada : [i.fin_real, i.fin].find(valida)) || null;
    quitar.forEach((k) => { delete x[k]; });
    if (i.tipo === 'cerrada') { x.tipo = 'issue'; x.cerrada = true; x.cierre = real; }
    if (i.tipo == null) x.tipo = 'issue';
    x.fin = real;
    if (anclada || !valida(x.inicio) || (real && x.inicio > real)) x.inicio = real;
    if (entrada.has(i.id)) x.entrada_cola = entrada.get(i.id);
    if (i.tarde != null) x.tarde = i.tarde || undefined;   // el motor viejo ya lo calculó: se respeta
    if (i.pausada === false) delete x.pausada;
    return x;
  });

  // ── Frentes del acuerdo de equipo (titular / backup por nombre) ────────────────────────────
  if (J && Array.isArray(J.frentes) && J.frentes.length && !d.acuerdo_frentes) {
    d.acuerdo_frentes = J.frentes.map((f, n) => ({
      clave: 'af-' + n, nombre: f.frente || f.nombre || ('Frente ' + (n + 1)), cliente: f.cliente || '',
      titular: slugPorNombre(f.titular), backup: slugPorNombre(f.backup),
      titular_txt: f.titular || '', backup_txt: f.backup || '',
    }));
    if (!d.reparto) { d.reparto = { titular: 2, backup: 2 }; notas.push('Reparto de frentes 2 titular / 2 backup: era fijo en el motor anterior.'); }
  }

  // ── Bloque jira ─────────────────────────────────────────────────────────────────────────────
  if (J) {
    J.issues = (J.issues || []).map((i) => Object.assign({ clave: i.key }, i));
    if (!J.proyectos && J.proyectos_cliente) J.proyectos = J.proyectos_cliente;
    if (d.limite_wip == null) { d.limite_wip = 3; notas.push('Límite de 3 «en desarrollo» por persona: era fijo en el motor anterior.'); }
    if (!d.estados) d.estados = {};
    // El motor anterior contaba «en desarrollo» por igualdad exacta con este nombre.
    if (!d.estados.desarrollo) d.estados.desarrollo = ['En Desarrollo'];
  }

  // ── Bloque lider ────────────────────────────────────────────────────────────────────────────
  const L = d.lider;
  if (L && (L.brief_fecha || L.colas || L.propias)) {
    const terc = (c) => /tercero|esperado/i.test(c.direccion || '');
    const fila = (c) => ({ id: c.id, titulo: c.titulo, con: c.con, fecha: c.fecha_limite || c.fecha || null,
      dias: c.dias, verif: c.verif, ultima: c.ultima, estado: c.estado });
    d.lider = {
      prioridad: L.prioridad || '', fecha_brief: L.brief_fecha || L.fecha_brief || null, aviso_brief: L.aviso_brief || '',
      compromisos: (L.compromisos || []).filter((c) => !terc(c)).map(fila),
      terceros: (L.compromisos || []).filter(terc).map((c) => Object.assign(fila(c), { de: c.con })).concat(L.terceros || []),
      riesgos: L.riesgos || [],
      alcances: (L.alcances || []).map((a) => Object.assign({}, a, { entrega: a.entrega || a.fecha_entrega || null, resumen: a.resumen || a.estado || '' })),
      propias: L.propias || null,
      colas_legado: L.colas || null,
    };
    if (L.sla_revision != null && d.sla_revision == null) d.sla_revision = L.sla_revision;
    if (L.sla_implementacion != null && d.sla_implementacion == null) d.sla_implementacion = L.sla_implementacion;
  }

  d._convertido = { desde: 'formato legado (motor Python)', notas };
  return d;
}

module.exports = { esLegado, convertir };
