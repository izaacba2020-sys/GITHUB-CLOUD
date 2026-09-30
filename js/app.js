/* CRM B&C Abogados y Notarios / Seguros Bobadilla */
const cfg = window.CRM_CONFIG || {};
const DEMO = !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY;
const sb = DEMO ? null : supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

const PERFILES = {
  byc: { nombre: 'B&C Abogados y Notarios', logo: 'assets/logo-byc.png', modulo: 'expedientes', moduloNombre: 'Expedientes' },
  seguros: { nombre: 'Seguros Bobadilla', logo: 'assets/logo-seguros.png', modulo: 'polizas', moduloNombre: 'Pólizas' },
};

const state = { user: null, perfil: localStorage.getItem('perfil'), data: {} };

// ---------- Utilidades ----------
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => 'Q ' + Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => (d ? new Date(d.length === 10 ? d + 'T12:00' : d).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const daysUntil = (d) => (d ? Math.ceil((new Date(d + 'T12:00') - new Date(today() + 'T12:00')) / 86400000) : null);
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const clienteNombre = (id) => (state.data.clientes || []).find((c) => c.id === id)?.nombre || '—';

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.add('hidden'), 2500);
}

function waLink(tel, msg = '') {
  let n = String(tel || '').replace(/\D/g, '');
  if (n.length === 8) n = '502' + n; // Guatemala
  return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;
}

function asegLogo(nombre) {
  if (!nombre) return '—';
  return `<span class="aseg"><img src="assets/aseguradoras/${slug(nombre)}.png" alt="" onerror="this.remove()">${esc(nombre)}</span>`;
}

// ---------- Capa de datos (Supabase o modo demo en el navegador) ----------
const ENTIDAD = { clientes: 'cliente', prospectos: 'prospecto', expedientes: 'expediente', polizas: 'póliza', tareas: 'tarea', pagos: 'pago', plantillas: 'plantilla' };

function dbError(error) {
  const falta = error.code === 'PGRST205' || error.code === 'PGRST204' || error.code === '42P01' || /could not find|does not exist/i.test(error.message);
  toast(falta ? 'Falta actualizar la base de datos: corre el SQL de actualización en Supabase (ver README)' : 'Error: ' + error.message);
}

const db = {
  _local(t) { try { return JSON.parse(localStorage.getItem('crm_' + t) || '[]'); } catch { return []; } },
  _saveLocal(t, rows) { localStorage.setItem('crm_' + t, JSON.stringify(rows)); },

  async list(t) {
    if (DEMO) return this._local(t).filter((r) => r.perfil === state.perfil).sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
    const { data, error } = await sb.from(t).select('*').eq('perfil', state.perfil).order('created_at', { ascending: false }).limit(5000);
    if (error) { dbError(error); return null; }
    return data;
  },

  // Todos los registros de ambos perfiles (para el respaldo).
  async listAll(t) {
    if (DEMO) return this._local(t);
    const { data, error } = await sb.from(t).select('*').order('created_at', { ascending: true }).limit(20000);
    if (error) { dbError(error); throw error; }
    return data;
  },

  // Inserta muchos registros de una vez (importación y plantillas iniciales).
  async insertMany(t, rows) {
    if (!rows.length) return [];
    const now = Date.now();
    const keys = new Set(['id', 'perfil', 'created_by', 'created_at']);
    rows.forEach((r) => Object.keys(r).forEach((k) => keys.add(k)));
    const full = rows.map((r, i) => {
      const o = {};
      for (const k of keys) o[k] = r[k] === '' || r[k] === undefined ? null : r[k];
      o.id = r.id || crypto.randomUUID();
      o.perfil = state.perfil;
      o.created_by = state.user.email;
      o.created_at = new Date(now + i).toISOString();
      return o;
    });
    if (DEMO) this._saveLocal(t, [...this._local(t), ...full]);
    else {
      for (let i = 0; i < full.length; i += 200) {
        const { error } = await sb.from(t).insert(full.slice(i, i + 200));
        if (error) { dbError(error); throw error; }
      }
    }
    return full;
  },

  async removeWhere(t, col, val) {
    if (DEMO) this._saveLocal(t, this._local(t).filter((r) => r[col] !== val));
    else await sb.from(t).delete().eq(col, val);
  },

  async save(t, row, desc) {
    const nuevo = !row.id;
    const payload = { ...row, perfil: state.perfil };
    for (const k in payload) if (payload[k] === '') payload[k] = null;
    delete payload.created_at;
    if (nuevo) payload.created_by = state.user.email;
    if (DEMO) {
      const rows = this._local(t);
      if (nuevo) rows.push({ ...payload, id: crypto.randomUUID(), created_at: new Date().toISOString() });
      else { const i = rows.findIndex((r) => r.id === row.id); rows[i] = { ...rows[i], ...payload }; }
      this._saveLocal(t, rows);
    } else {
      const id = payload.id; delete payload.id;
      const q = nuevo ? sb.from(t).insert(payload) : sb.from(t).update(payload).eq('id', id);
      const { error } = await q;
      if (error) { dbError(error); throw error; }
    }
    if (desc !== false) await this.log(nuevo ? 'creó' : 'editó', ENTIDAD[t], desc);
  },

  async remove(t, id, desc) {
    if (DEMO) this._saveLocal(t, this._local(t).filter((r) => r.id !== id));
    else {
      const { error } = await sb.from(t).delete().eq('id', id);
      if (error) { dbError(error); throw error; }
    }
    await this.log('eliminó', ENTIDAD[t], desc);
  },

  async log(accion, entidad, descripcion) {
    const row = { perfil: state.perfil, usuario: state.user.email, accion, entidad, descripcion };
    if (DEMO) {
      const rows = this._local('actividad');
      rows.push({ ...row, id: crypto.randomUUID(), created_at: new Date().toISOString() });
      this._saveLocal('actividad', rows.slice(-500));
    } else await sb.from('actividad').insert(row);
  },
};

async function loadAll() {
  const tablas = ['clientes', 'prospectos', 'tareas', 'actividad', 'pagos', 'plantillas', 'polizas', 'expedientes'];
  const res = await Promise.all(tablas.map((t) => db.list(t)));
  tablas.forEach((t, i) => (state.data[t] = res[i] || []));
  // La primera vez se guardan las plantillas de WhatsApp sugeridas para poder editarlas.
  const iPl = tablas.indexOf('plantillas');
  if (res[iPl] && !res[iPl].length) {
    try { state.data.plantillas = await db.insertMany('plantillas', CAT.plantillas[state.perfil].map((p) => ({ ...p }))); } catch { /* ya notificado */ }
  }
}

// ---------- Formularios genéricos ----------
function openModal(html) { $('#modal-box').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

function field(f, val) {
  const v = val ?? f.def ?? '';
  const req = f.req ? 'required' : '';
  let input;
  if (f.type === 'select') {
    const opts = (typeof f.options === 'function' ? f.options() : f.options).map((o) => (typeof o === 'string' ? { v: o, l: o } : o));
    input = `<select name="${f.k}" ${req}><option value="">— Seleccionar —</option>${opts.map((o) => `<option value="${esc(o.v)}" ${String(o.v) === String(v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
  } else if (f.type === 'textarea') {
    input = `<textarea name="${f.k}">${esc(v)}</textarea>`;
  } else {
    let value = v;
    if (f.type === 'datetime-local' && v) { const d = new Date(v); value = new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
    input = `<input type="${f.type || 'text'}" name="${f.k}" value="${esc(value)}" ${req} ${f.type === 'number' ? 'step="0.01"' : ''}>`;
  }
  return `<div class="${f.full ? 'full' : ''}"><label>${esc(f.label)}${f.req ? ' *' : ''}</label>${input}</div>`;
}

function formModal({ titulo, campos, data = {}, onSave, onDelete }) {
  openModal(`
    <h2>${esc(titulo)}</h2>
    <form class="form" id="f">${campos.map((f) => field(f, data[f.k])).join('')}</form>
    <div class="actions">
      ${onDelete ? '<button class="btn danger" id="del" style="margin-right:auto">Eliminar</button>' : ''}
      <button class="btn sec" id="cancel">Cancelar</button>
      <button class="btn" id="ok">Guardar</button>
    </div>`);
  $('#cancel').onclick = closeModal;
  if (onDelete) $('#del').onclick = async () => {
    if (!confirm('¿Eliminar este registro?')) return;
    try { await onDelete(); closeModal(); render(); } catch { /* cancelado o ya notificado */ }
  };
  $('#ok').onclick = async () => {
    const form = $('#f');
    if (!form.reportValidity()) return;
    const out = { ...data };
    new FormData(form).forEach((v, k) => (out[k] = v));
    campos.filter((f) => f.type === 'datetime-local').forEach((f) => { if (out[f.k]) out[f.k] = new Date(out[f.k]).toISOString(); });
    try { await onSave(out); closeModal(); toast('Guardado'); render(); } catch { /* ya notificado */ }
  };
}

// ---------- Definición de campos ----------
const clienteOpts = () => (state.data.clientes || []).map((c) => ({ v: c.id, l: c.nombre })).sort((a, b) => a.l.localeCompare(b.l));
const servicios = () => (state.perfil === 'byc' ? CAT.tramites : CAT.ramos);

const CAMPOS = {
  clientes: [
    { k: 'nombre', label: 'Nombre completo / Razón social', req: true, full: true },
    { k: 'tipo', label: 'Tipo de persona', type: 'select', options: CAT.tiposPersona },
    { k: 'fuente', label: '¿Cómo nos conoció?', type: 'select', options: CAT.fuentes },
    { k: 'dpi', label: 'DPI' },
    { k: 'nit', label: 'NIT' },
    { k: 'telefono', label: 'Teléfono / WhatsApp', type: 'tel' },
    { k: 'email', label: 'Correo', type: 'email' },
    { k: 'fecha_nacimiento', label: 'Fecha de nacimiento 🎂', type: 'date' },
    { k: 'direccion', label: 'Dirección', full: true },
    { k: 'etiquetas', label: 'Etiquetas (separadas por coma)', full: true },
    { k: 'notas', label: 'Notas', type: 'textarea', full: true },
  ],
  prospectos: [
    { k: 'titulo', label: 'Oportunidad', req: true, full: true },
    { k: 'cliente_id', label: 'Cliente existente', type: 'select', options: clienteOpts },
    { k: 'contacto', label: 'O nombre del prospecto' },
    { k: 'telefono', label: 'Teléfono', type: 'tel' },
    { k: 'servicio', label: 'Servicio', type: 'select', options: servicios },
    { k: 'etapa', label: 'Etapa', type: 'select', options: CAT.etapas, def: 'Nuevo' },
    { k: 'monto', label: 'Monto estimado (Q)', type: 'number' },
    { k: 'seguimiento', label: 'Próximo seguimiento', type: 'date' },
    { k: 'notas', label: 'Notas', type: 'textarea', full: true },
  ],
  expedientes: [
    { k: 'cliente_id', label: 'Cliente', type: 'select', options: clienteOpts, req: true },
    { k: 'tramite', label: 'Trámite', type: 'select', options: CAT.tramites, req: true },
    { k: 'descripcion', label: 'Descripción', full: true },
    { k: 'estado', label: 'Estado', type: 'select', options: CAT.estadosExpediente, def: CAT.estadosExpediente[0] },
    { k: 'responsable', label: 'Responsable' },
    { k: 'fecha_inicio', label: 'Fecha de inicio', type: 'date', def: today() },
    { k: 'fecha_limite', label: 'Fecha límite', type: 'date' },
    { k: 'honorarios', label: 'Honorarios (Q)', type: 'number' },
    { k: 'anticipo', label: 'Anticipo inicial (Q)', type: 'number' },
    { k: 'notas', label: 'Notas', type: 'textarea', full: true },
  ],
  polizas: [
    { k: 'cliente_id', label: 'Cliente', type: 'select', options: clienteOpts, req: true },
    { k: 'aseguradora', label: 'Aseguradora', type: 'select', options: CAT.aseguradoras, req: true },
    { k: 'ramo', label: 'Ramo', type: 'select', options: CAT.ramos, req: true },
    { k: 'numero', label: 'No. de póliza' },
    { k: 'suma_asegurada', label: 'Suma asegurada (Q)', type: 'number' },
    { k: 'prima_neta', label: 'Prima neta (Q)', type: 'number' },
    { k: 'prima', label: 'Prima total anual (Q)', type: 'number' },
    { k: 'forma_pago', label: 'Forma de pago', type: 'select', options: CAT.formasPago },
    { k: 'comision_pct', label: 'Comisión (% sobre prima neta)', type: 'number' },
    { k: 'inicio', label: 'Inicio de vigencia', type: 'date' },
    { k: 'fin', label: 'Fin de vigencia', type: 'date', req: true },
    { k: 'estado', label: 'Estado', type: 'select', options: CAT.estadosPoliza, def: 'Vigente' },
    { k: 'notas', label: 'Notas', type: 'textarea', full: true },
  ],
  tareas: [
    { k: 'titulo', label: 'Tarea', req: true, full: true },
    { k: 'tipo', label: 'Tipo', type: 'select', options: CAT.tiposTarea },
    { k: 'fecha', label: 'Fecha y hora', type: 'datetime-local', req: true },
    { k: 'cliente_id', label: 'Cliente', type: 'select', options: clienteOpts, full: true },
    { k: 'notas', label: 'Notas', type: 'textarea', full: true },
  ],
};

const TITULOS = { clientes: 'Cliente', prospectos: 'Prospecto', expedientes: 'Expediente', polizas: 'Póliza', tareas: 'Tarea' };

function descOf(t, r) {
  if (t === 'clientes') return r.nombre;
  if (t === 'prospectos') return r.titulo;
  if (t === 'expedientes') return `${r.tramite} · ${clienteNombre(r.cliente_id)}`;
  if (t === 'polizas') return `${r.ramo} ${r.aseguradora} · ${clienteNombre(r.cliente_id)}`;
  return r.titulo;
}

function editar(t, row = {}, extra = {}) {
  const data = { ...extra, ...row };
  formModal({
    titulo: (row.id ? 'Editar ' : 'Nuevo ') + TITULOS[t].toLowerCase(),
    campos: CAMPOS[t],
    data,
    onSave: async (out) => {
      if (t === 'expedientes' && !row.id) out.checklist = (CAT.checklists[out.tramite] || []).map((x) => ({ t: x, ok: false }));
      await db.save(t, out, descOf(t, out));
    },
    onDelete: row.id ? async () => {
      if (t === 'clientes' && !confirm('⚠️ Al eliminar el cliente también se borran TODAS sus pólizas/expedientes, pagos y tareas.\n\nSi solo dejó de renovar, mejor marca la póliza como "No renovada".\n\n¿Eliminar de todas formas?')) throw new Error('cancelado');
      await db.remove(t, row.id, descOf(t, row));
      if (t === 'polizas' || t === 'expedientes') await db.removeWhere('pagos', 'ref_id', row.id);
    } : null,
  });
}

// ---------- Vistas ----------
const VISTAS = {
  dashboard: { nombre: 'Inicio', fn: vDashboard },
  prospectos: { nombre: 'Prospectos', fn: vProspectos },
  clientes: { nombre: 'Clientes', fn: vClientes },
  expedientes: { nombre: 'Expedientes', fn: vExpedientes, perfil: 'byc' },
  polizas: { nombre: 'Pólizas', fn: vPolizas, perfil: 'seguros' },
  aseguradoras: { nombre: 'Aseguradoras', fn: vAseguradoras, perfil: 'seguros' },
  renovaciones: { nombre: 'Renovaciones', fn: vRenovaciones, perfil: 'seguros' },
  cobros: { nombre: 'Cobros', fn: vCobros },
  agenda: { nombre: 'Agenda', fn: vAgenda },
  plantillas: { nombre: 'WhatsApp', fn: vPlantillas },
  actividad: { nombre: 'Actividad', fn: vActividad },
};

function tareasPendientes() {
  const fin = new Date(); fin.setHours(23, 59, 59);
  return (state.data.tareas || []).filter((t) => !t.hecho && new Date(t.fecha) <= fin).sort((a, b) => (a.fecha > b.fecha ? 1 : -1));
}

function tareaItem(t) {
  const vencida = new Date(t.fecha) < new Date(today() + 'T00:00');
  return `<div class="list-item">
    <div><input type="checkbox" style="width:auto" data-hecho="${t.id}" ${t.hecho ? 'checked' : ''}>
      <b>${esc(t.titulo)}</b> ${t.tipo ? `<span class="badge">${esc(t.tipo)}</span>` : ''}
      <div class="muted">${fmtDateTime(t.fecha)} ${t.cliente_id ? '· ' + esc(clienteNombre(t.cliente_id)) : ''}</div></div>
    ${vencida && !t.hecho ? '<span class="badge bad">Atrasada</span>' : ''}
  </div>`;
}

function bindTareas(root) {
  root.querySelectorAll('[data-hecho]').forEach((cb) => (cb.onchange = async () => {
    const t = state.data.tareas.find((x) => x.id === cb.dataset.hecho);
    await db.save('tareas', { ...t, hecho: cb.checked }, cb.checked ? `completó: ${t.titulo}` : false);
    render();
  }));
}

function vDashboard(el) {
  const d = state.data;
  const abiertos = d.prospectos.filter((p) => !['Ganado', 'Perdido'].includes(p.etapa));
  const mes = today().slice(0, 7);
  const ganadosMes = d.prospectos.filter((p) => p.etapa === 'Ganado' && (p.created_at || '').startsWith(mes)).length;
  let kpis = [
    ['Clientes', d.clientes.length],
    ['Prospectos abiertos', abiertos.length],
    ['Ganados este mes', ganadosMes],
    ['Pendientes hoy', tareasPendientes().length],
  ];
  let extra = '';
  if (state.perfil === 'byc') {
    const activos = d.expedientes.filter((e) => !['Entregado', 'Cancelado'].includes(e.estado));
    const saldo = d.expedientes.filter((e) => e.estado !== 'Cancelado').reduce((s, e) => s + estadoPagoExp(e).saldo, 0);
    kpis.push(['Expedientes activos', activos.length], ['Saldo por cobrar', money(saldo)]);
    const proximos = activos.filter((e) => e.fecha_limite).sort((a, b) => (a.fecha_limite > b.fecha_limite ? 1 : -1)).slice(0, 6);
    extra = `<div class="card"><h3>Expedientes con fecha límite próxima</h3>${proximos.map((e) => `<div class="list-item"><div><b>${esc(e.tramite)}</b> · ${esc(clienteNombre(e.cliente_id))}<div class="muted">${esc(e.estado)}</div></div>${venceBadge(e.fecha_limite)}</div>`).join('') || '<div class="empty">Sin fechas próximas</div>'}</div>`;
  } else {
    const vig = d.polizas.filter((p) => p.estado === 'Vigente');
    const prima = vig.reduce((s, p) => s + Number(p.prima || 0), 0);
    const comision = vig.reduce((s, p) => s + primaBase(p) * Number(p.comision_pct || 0) / 100, 0);
    const porRenovar = vig.filter((p) => { const x = daysUntil(p.fin); return x !== null && x <= 60; });
    kpis.push(['Pólizas vigentes', vig.length], ['Por renovar (60 días)', porRenovar.length], ['Prima total vigente', money(prima)], ['Comisión estimada', money(comision)]);
    extra = `<div class="card"><h3>Próximas renovaciones</h3>${porRenovar.sort((a, b) => (a.fin > b.fin ? 1 : -1)).slice(0, 6).map((p) => `<div class="list-item"><div><b>${esc(clienteNombre(p.cliente_id))}</b><div class="muted">${esc(p.ramo)} · ${asegLogo(p.aseguradora)}</div></div>${venceBadge(p.fin)}</div>`).join('') || '<div class="empty">Nada por renovar pronto</div>'}</div>`;
  }
  const etapas = CAT.etapas.map((e) => `<div class="list-item"><span>${esc(e)}</span><b>${d.prospectos.filter((p) => p.etapa === e).length}</b></div>`).join('');
  el.innerHTML = `
    <div class="kpis">${kpis.map(([l, v]) => `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
    <div class="grid2">
      <div class="card"><h3>Pendientes de hoy y atrasados</h3><div id="pend">${tareasPendientes().map(tareaItem).join('') || '<div class="empty">¡Todo al día! 🎉</div>'}</div></div>
      ${extra}
      ${tarjetaCumpleanos()}
      <div class="card"><h3>Embudo de prospectos</h3>${etapas}</div>
      <div class="card"><h3>Actividad reciente</h3>${d.actividad.slice(0, 6).map(actItem).join('') || '<div class="empty">Sin actividad</div>'}</div>
    </div>`;
  bindTareas(el);
  bindCumpleanos(el);
}

function venceBadge(fecha) {
  const x = daysUntil(fecha);
  if (x === null) return '';
  const cls = x < 0 ? 'bad' : x <= 15 ? 'bad' : x <= 30 ? 'warn' : 'ok';
  const txt = x < 0 ? `Venció hace ${-x} d` : x === 0 ? 'Hoy' : `En ${x} días`;
  return `<span class="badge ${cls}" title="${fmtDate(fecha)}">${txt}</span>`;
}

// Cuántas pólizas vigentes (o trámites activos) tiene el cliente.
function situacionCliente(c) {
  if (state.perfil === 'seguros') {
    const ps = state.data.polizas.filter((p) => p.cliente_id === c.id);
    const activos = ps.filter((p) => p.estado === 'Vigente').length;
    const badge = activos ? `<span class="badge ok">${activos} vigente${activos > 1 ? 's' : ''}</span>` : ps.length ? '<span class="badge warn">Sin póliza vigente</span>' : '<span class="badge">Sin pólizas</span>';
    return { activos, badge };
  }
  const xs = state.data.expedientes.filter((x) => x.cliente_id === c.id);
  const activos = xs.filter((x) => !['Entregado', 'Cancelado'].includes(x.estado)).length;
  return { activos, badge: activos ? `<span class="badge ok">${activos} activo${activos > 1 ? 's' : ''}</span>` : xs.length ? '<span class="badge">Trámites terminados</span>' : '<span class="badge">Sin trámites</span>' };
}

// Póliza que no se renovó o se canceló: se conserva el historial y se agenda volver a contactar.
function bajaPoliza(p) {
  const c = state.data.clientes.find((x) => x.id === p.cliente_id) || {};
  const aniv = p.fin ? new Date(p.fin + 'T12:00') : new Date();
  aniv.setMonth(aniv.getMonth() + 11); // un mes antes de la siguiente fecha de renovación
  formModal({
    titulo: `Baja de póliza · ${c.nombre || ''}`,
    campos: [
      { k: 'estado', label: '¿Qué pasó?', type: 'select', options: ['No renovada', 'Cancelada'], def: 'No renovada', req: true },
      { k: 'motivo', label: 'Motivo', type: 'select', options: CAT.motivosBaja, req: true },
      { k: 'detalle', label: 'Comentario (opcional)', full: true },
      { k: 'recontactar', label: 'Volver a contactar el (vacío = no agendar)', type: 'date', def: aniv.toISOString().slice(0, 10) },
    ],
    data: {},
    onSave: async (out) => {
      const nota = `[${fmtDate(today())}] ${out.estado}: ${out.motivo}${out.detalle ? ' — ' + out.detalle : ''}`;
      await db.save('polizas', { ...p, estado: out.estado, notas: [p.notas, nota].filter(Boolean).join('\n') }, `${out.estado}: ${p.ramo} ${p.aseguradora} · ${c.nombre} (${out.motivo})`);
      if (out.recontactar) {
        await db.save('tareas', { titulo: `Recontactar a ${c.nombre}: ofrecer ${p.ramo}`, tipo: 'Seguimiento', fecha: new Date(out.recontactar + 'T09:00').toISOString(), cliente_id: p.cliente_id, notas: nota }, false);
      }
    },
  });
  $('#f').insertAdjacentHTML('afterbegin', '<p class="full muted">El cliente y su historial no se borran. La póliza deja de contar en renovaciones, cobros y totales, y puedes reactivarla cuando quieras.</p>');
}

async function reactivarPoliza(p) {
  if (!confirm('¿Reactivar esta póliza como Vigente? Recuerda actualizar las fechas de vigencia si es una renovación nueva.')) return;
  await db.save('polizas', { ...p, estado: 'Vigente', notas: [p.notas, `[${fmtDate(today())}] Reactivada`].filter(Boolean).join('\n') }, `reactivada: ${p.ramo} ${p.aseguradora} · ${clienteNombre(p.cliente_id)}`);
  toast('Póliza reactivada');
  closeModal();
  render();
}

function vClientes(el) {
  el.innerHTML = `
    <div class="top"><div style="display:flex;gap:8px;flex-wrap:wrap"><input class="search" id="q" placeholder="Buscar nombre, DPI, NIT, teléfono...">
      <select id="fs" style="width:auto"><option value="">Todos los clientes</option><option value="activo">Con ${state.perfil === 'seguros' ? 'póliza vigente' : 'trámite activo'}</option><option value="ex">${state.perfil === 'seguros' ? 'Sin póliza vigente (recuperar)' : 'Sin trámite activo'}</option></select></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sec" id="importar">⬆ Importar Excel</button><button class="btn" id="nuevo">+ Nuevo cliente</button></div></div>
    <div class="card table-wrap"><table><thead><tr><th>Nombre</th><th>Situación</th><th>Teléfono</th><th>NIT</th><th>Etiquetas</th></tr></thead><tbody id="rows"></tbody></table></div>`;
  const pinta = () => {
    const q = $('#q').value.toLowerCase(), fs = $('#fs').value;
    const rows = state.data.clientes.filter((c) => {
      const s = situacionCliente(c);
      return (!fs || (fs === 'activo' ? s.activos > 0 : s.activos === 0)) && [c.nombre, c.dpi, c.nit, c.telefono, c.email, c.etiquetas].join(' ').toLowerCase().includes(q);
    });
    $('#rows').innerHTML = rows.map((c) => `<tr class="click" data-id="${c.id}"><td><b>${esc(c.nombre)}</b><div class="muted">${esc(c.email)}</div></td><td>${situacionCliente(c).badge}</td><td>${esc(c.telefono)}</td><td>${esc(c.nit)}</td><td>${(c.etiquetas || '').split(',').filter((x) => x.trim()).map((x) => `<span class="badge">${esc(x.trim())}</span>`).join(' ')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Sin clientes</td></tr>';
    el.querySelectorAll('tr[data-id]').forEach((tr) => (tr.onclick = () => fichaCliente(tr.dataset.id)));
  };
  $('#q').oninput = pinta; $('#fs').onchange = pinta;
  $('#nuevo').onclick = () => editar('clientes');
  $('#importar').onclick = importarExcel;
  pinta();
}

function fichaCliente(id) {
  const c = state.data.clientes.find((x) => x.id === id);
  const mod = PERFILES[state.perfil].modulo;
  const items = state.data[mod].filter((x) => x.cliente_id === id);
  const tareas = state.data.tareas.filter((x) => x.cliente_id === id);
  const itemsHtml = items.map((x) => mod === 'polizas'
    ? `<div class="list-item click" data-pol="${x.id}"><div><b>${esc(x.ramo)}</b> · ${asegLogo(x.aseguradora)}<div class="muted">No. ${esc(x.numero || '—')} · ${money(x.prima)}</div></div><div style="text-align:right">${venceBadge(x.fin)}<br>${pagoBadge(estadoPagoPoliza(x))}</div></div>`
    : `<div class="list-item"><div><b>${esc(x.tramite)}</b><div class="muted">${esc(x.descripcion)}</div></div><div style="text-align:right"><span class="badge">${esc(x.estado)}</span><br>${pagoBadge(estadoPagoExp(x))}</div></div>`).join('') || '<div class="empty">Ninguno</div>';
  const dc = diasParaCumple(c.fecha_nacimiento);
  openModal(`
    <h2>${esc(c.nombre)}</h2>
    <div class="grid2 muted">
      <div>📞 ${esc(c.telefono || '—')}<br>✉️ ${esc(c.email || '—')}<br>📍 ${esc(c.direccion || '—')}</div>
      <div>DPI: ${esc(c.dpi || '—')}<br>NIT: ${esc(c.nit || '—')}<br>Tipo: ${esc(c.tipo || '—')} · Fuente: ${esc(c.fuente || '—')}<br>🎂 ${c.fecha_nacimiento ? fmtDate(c.fecha_nacimiento) + (dc === 0 ? ' · <b>¡Hoy cumple años!</b>' : dc <= 15 ? ` · en ${dc} días` : '') : '—'}</div>
    </div>
    ${c.notas ? `<p>${esc(c.notas)}</p>` : ''}
    <h3>${PERFILES[state.perfil].moduloNombre}</h3>${itemsHtml}
    <h3>Tareas</h3>${tareas.map(tareaItem).join('') || '<div class="empty">Ninguna</div>'}
    <div class="actions">
      ${c.telefono ? '<button class="btn wa" id="wa">WhatsApp</button>' : ''}
      <button class="btn sec" id="addT">+ Tarea</button>
      <button class="btn sec" id="addM">+ ${mod === 'polizas' ? 'Póliza' : 'Expediente'}</button>
      <button class="btn sec" id="ed">Editar</button>
      <button class="btn sec" id="cerrar">Cerrar</button>
    </div>`);
  bindTareas($('#modal-box'));
  $('#modal-box').querySelectorAll('[data-pol]').forEach((x) => (x.onclick = () => fichaPoliza(x.dataset.pol)));
  if ($('#wa')) $('#wa').onclick = () => abrirWhatsApp({ cliente: c, plantilla: dc === 0 ? 'Cumpleaños' : undefined });
  $('#cerrar').onclick = closeModal;
  $('#ed').onclick = () => editar('clientes', c);
  $('#addT').onclick = () => editar('tareas', {}, { cliente_id: id });
  $('#addM').onclick = () => editar(mod, {}, { cliente_id: id });
}

function vProspectos(el) {
  el.innerHTML = `<div class="top"><span class="muted">Arrastra las tarjetas entre columnas o cambia la etapa en cada tarjeta.</span><button class="btn" id="nuevo">+ Nuevo prospecto</button></div>
    <div class="kanban">${CAT.etapas.map((e) => {
      const ps = state.data.prospectos.filter((p) => (p.etapa || 'Nuevo') === e);
      const total = ps.reduce((s, p) => s + Number(p.monto || 0), 0);
      return `<div class="col" data-etapa="${esc(e)}"><h4>${esc(e)} <span class="muted">${ps.length} · ${money(total)}</span></h4>
        ${ps.map((p) => `<div class="kcard" draggable="true" data-id="${p.id}">
          <b>${esc(p.titulo)}</b>
          <div class="muted">${esc(p.cliente_id ? clienteNombre(p.cliente_id) : p.contacto || '')} ${p.servicio ? '· ' + esc(p.servicio) : ''}</div>
          ${p.monto ? `<div>${money(p.monto)}</div>` : ''}
          ${p.seguimiento ? `<div class="muted">Seguimiento: ${venceBadge(p.seguimiento)}</div>` : ''}
          <select data-etapa-sel="${p.id}">${CAT.etapas.map((x) => `<option ${x === e ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        </div>`).join('')}</div>`;
    }).join('')}</div>`;
  $('#nuevo').onclick = () => editar('prospectos');
  const mover = async (id, etapa) => {
    const p = state.data.prospectos.find((x) => x.id === id);
    if (!p || p.etapa === etapa) return;
    await db.save('prospectos', { ...p, etapa }, `${p.titulo} → ${etapa}`);
    if (etapa === 'Ganado' && !p.cliente_id && confirm('¡Ganado! ¿Registrar a este prospecto como cliente?')) {
      editar('clientes', {}, { nombre: p.contacto || p.titulo, telefono: p.telefono });
    }
    render();
  };
  el.querySelectorAll('.kcard').forEach((k) => {
    k.ondragstart = (e) => e.dataTransfer.setData('id', k.dataset.id);
    k.onclick = (e) => { if (e.target.tagName !== 'SELECT') editar('prospectos', state.data.prospectos.find((x) => x.id === k.dataset.id)); };
  });
  el.querySelectorAll('[data-etapa-sel]').forEach((s) => (s.onchange = () => mover(s.dataset.etapaSel, s.value)));
  el.querySelectorAll('.col').forEach((c) => {
    c.ondragover = (e) => { e.preventDefault(); c.classList.add('over'); };
    c.ondragleave = () => c.classList.remove('over');
    c.ondrop = (e) => { e.preventDefault(); c.classList.remove('over'); mover(e.dataTransfer.getData('id'), c.dataset.etapa); };
  });
}

function vExpedientes(el) {
  el.innerHTML = `<div class="top"><div style="display:flex;gap:8px;flex-wrap:wrap">
      <input class="search" id="q" placeholder="Buscar...">
      <select id="fe" style="width:auto"><option value="">Todos los estados</option>${CAT.estadosExpediente.map((x) => `<option>${esc(x)}</option>`).join('')}</select>
    </div><button class="btn" id="nuevo">+ Nuevo expediente</button></div><div id="lista"></div>`;
  const pinta = () => {
    const q = $('#q').value.toLowerCase(), fe = $('#fe').value;
    const rows = state.data.expedientes.filter((x) => (!fe || x.estado === fe) && [x.tramite, x.descripcion, clienteNombre(x.cliente_id), x.responsable].join(' ').toLowerCase().includes(q));
    $('#lista').innerHTML = rows.map((x) => {
      const cl = x.checklist || [];
      const pct = cl.length ? Math.round(cl.filter((i) => i.ok).length / cl.length * 100) : 0;
      const r = estadoPagoExp(x);
      return `<div class="card">
        <div class="top" style="margin-bottom:8px"><div><b>${esc(x.tramite)}</b> · ${esc(clienteNombre(x.cliente_id))}<div class="muted">${esc(x.descripcion)}</div></div>
          <div style="display:flex;gap:6px;align-items:center"><span class="badge">${esc(x.estado)}</span>${x.fecha_limite && !['Entregado', 'Cancelado'].includes(x.estado) ? venceBadge(x.fecha_limite) : ''}<button class="btn wa sm" data-wa="${x.id}">WhatsApp</button><button class="btn sec sm" data-ed="${x.id}">Editar</button></div></div>
        <div class="grid2"><div class="checklist">${cl.map((i, n) => `<label><input type="checkbox" data-chk="${x.id}" data-n="${n}" ${i.ok ? 'checked' : ''}>${esc(i.t)}</label>`).join('')}
          <div class="progress"><div style="width:${pct}%"></div></div><div class="muted">${pct}% completado</div></div>
          <div><div class="muted">Responsable: ${esc(x.responsable || '—')} · Inicio: ${fmtDate(x.fecha_inicio)}</div>
            <div style="margin:8px 0 4px"><b>Honorarios</b> ${pagoBadge(r)}</div>${pagoBarra(r)}
            <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" data-pagar="${x.id}">+ Registrar pago</button>${r.pagos.length ? `<button class="btn sec sm" data-verpagos="${x.id}">Ver pagos (${r.pagos.length})</button>` : ''}</div></div></div>
      </div>`;
    }).join('') || '<div class="card empty">Sin expedientes</div>';
    const exp = (id) => state.data.expedientes.find((x) => x.id === id);
    el.querySelectorAll('[data-ed]').forEach((b) => (b.onclick = () => editar('expedientes', exp(b.dataset.ed))));
    el.querySelectorAll('[data-pagar]').forEach((b) => (b.onclick = () => registrarPago('expediente', exp(b.dataset.pagar))));
    el.querySelectorAll('[data-wa]').forEach((b) => (b.onclick = () => { const x = exp(b.dataset.wa); abrirWhatsApp({ cliente: state.data.clientes.find((c) => c.id === x.cliente_id), expediente: x }); }));
    el.querySelectorAll('[data-verpagos]').forEach((b) => (b.onclick = () => {
      const x = exp(b.dataset.verpagos), r = estadoPagoExp(x);
      openModal(`<h2>Pagos · ${esc(x.tramite)} · ${esc(clienteNombre(x.cliente_id))}</h2>${pagoBarra(r)}${x.anticipo ? `<p class="muted">Incluye anticipo inicial de ${money(x.anticipo)}</p>` : ''}<div style="margin-top:8px">${listaPagos(r.pagos)}</div>
        <div class="actions"><button class="btn sec" id="saldo">✔ Marcar pagado</button><button class="btn" id="pago">+ Registrar pago</button><button class="btn sec" id="cerrar">Cerrar</button></div>`);
      bindPagos($('#modal-box'));
      $('#saldo').onclick = () => pagarSaldo('expediente', x);
      $('#pago').onclick = () => registrarPago('expediente', x);
      $('#cerrar').onclick = closeModal;
    }));
    el.querySelectorAll('[data-chk]').forEach((cb) => (cb.onchange = async () => {
      const x = state.data.expedientes.find((e) => e.id === cb.dataset.chk);
      const cl = [...x.checklist]; cl[cb.dataset.n] = { ...cl[cb.dataset.n], ok: cb.checked };
      await db.save('expedientes', { ...x, checklist: cl }, `${x.tramite} · ${clienteNombre(x.cliente_id)}: ${cb.checked ? '✔' : '✘'} ${cl[cb.dataset.n].t}`);
      x.checklist = cl; pinta();
    }));
  };
  $('#q').oninput = pinta; $('#fe').onchange = pinta;
  $('#nuevo').onclick = () => editar('expedientes');
  pinta();
}

function tablaPolizas(rows) {
  return `<div class="card table-wrap"><table><thead><tr><th>Cliente</th><th>Aseguradora</th><th>Ramo</th><th>No. póliza</th><th>Prima</th><th>Pago</th><th>Vence</th><th>Estado</th><th></th></tr></thead><tbody>
    ${rows.map((p) => {
      const c = state.data.clientes.find((x) => x.id === p.cliente_id);
      return `<tr class="click" data-id="${p.id}"><td><b>${esc(c?.nombre || '—')}</b></td><td>${asegLogo(p.aseguradora)}</td><td>${esc(p.ramo)}</td><td>${esc(p.numero)}</td><td>${money(p.prima)}<div class="muted">${esc(p.forma_pago || '')}${p.prima_neta ? ' · neta ' + money(p.prima_neta) : ''}</div></td><td>${p.estado === 'Vigente' ? pagoBadge(estadoPagoPoliza(p)) : '<span class="muted">—</span>'}</td>
      <td>${fmtDate(p.fin)}<br>${p.estado === 'Vigente' ? venceBadge(p.fin) : ''}</td><td><span class="badge ${p.estado === 'Vigente' ? '' : 'warn'}">${esc(p.estado)}</span></td>
      <td>${c?.telefono ? `<button class="btn wa sm" data-wa="${p.id}">WhatsApp</button>` : ''}</td></tr>`;
    }).join('') || '<tr><td colspan="9" class="empty">Sin pólizas</td></tr>'}</tbody></table></div>`;
}

function bindPolizas(el) {
  el.querySelectorAll('tr[data-id]').forEach((tr) => (tr.onclick = () => fichaPoliza(tr.dataset.id)));
  el.querySelectorAll('[data-wa]').forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const p = state.data.polizas.find((x) => x.id === b.dataset.wa);
    abrirWhatsApp({ cliente: state.data.clientes.find((c) => c.id === p.cliente_id), poliza: p });
  }));
}

function vPolizas(el) {
  el.innerHTML = `<div class="top"><div style="display:flex;gap:8px;flex-wrap:wrap">
      <input class="search" id="q" placeholder="Buscar cliente o No. póliza...">
      <select id="fa" style="width:auto"><option value="">Todas las aseguradoras</option>${CAT.aseguradoras.map((x) => `<option>${esc(x)}</option>`).join('')}</select>
      <select id="fr" style="width:auto"><option value="">Todos los ramos</option>${CAT.ramos.map((x) => `<option>${esc(x)}</option>`).join('')}</select>
      <select id="fe" style="width:auto">${[['Vigente', 'Vigentes'], ['baja', 'No renovadas / canceladas'], ['', 'Todas']].map(([v, l]) => `<option value="${v}">${l} (${state.data.polizas.filter((p) => (v === '' ? true : v === 'baja' ? p.estado !== 'Vigente' : p.estado === v)).length})</option>`).join('')}</select>
    </div><button class="btn" id="nuevo">+ Nueva póliza</button></div><div id="lista"></div>`;
  const pinta = () => {
    const q = $('#q').value.toLowerCase(), fa = $('#fa').value, fr = $('#fr').value, fe = $('#fe').value;
    const okEstado = (p) => (fe === '' ? true : fe === 'baja' ? p.estado !== 'Vigente' : p.estado === fe);
    $('#lista').innerHTML = tablaPolizas(state.data.polizas.filter((p) => okEstado(p) && (!fa || p.aseguradora === fa) && (!fr || p.ramo === fr) && [clienteNombre(p.cliente_id), p.numero].join(' ').toLowerCase().includes(q)));
    bindPolizas(el);
  };
  if (state.filtroAseg) { $('#fa').value = state.filtroAseg; state.filtroAseg = null; }
  $('#q').oninput = pinta; $('#fa').onchange = pinta; $('#fr').onchange = pinta; $('#fe').onchange = pinta;
  $('#nuevo').onclick = () => editar('polizas');
  pinta();
}

function vAseguradoras(el) {
  const stats = CAT.aseguradoras.map((a) => {
    const ps = state.data.polizas.filter((p) => p.aseguradora === a);
    const vig = ps.filter((p) => p.estado === 'Vigente');
    return {
      a, total: ps.length, vig: vig.length,
      clientes: new Set(ps.map((p) => p.cliente_id)).size,
      prima: vig.reduce((s, p) => s + Number(p.prima || 0), 0),
      comision: vig.reduce((s, p) => s + primaBase(p) * Number(p.comision_pct || 0) / 100, 0),
      renovar: vig.filter((p) => { const x = daysUntil(p.fin); return x !== null && x <= 60; }).length,
    };
  }).sort((x, y) => y.prima - x.prima || y.total - x.total);
  el.innerHTML = `<p class="muted">Resumen de tu cartera por aseguradora. Haz clic en una para ver sus pólizas.</p>
    <div class="aseg-grid">${stats.map((s) => `<div class="card aseg-card" data-a="${esc(s.a)}">
      <div class="aseg-logo"><span class="aseg-ini">${esc(s.a.split(' ').filter((w) => w.length > 2 || w === 'G&T').map((w) => w[0]).join('').slice(0, 3))}</span><img src="assets/aseguradoras/${slug(s.a)}.png" alt="" onload="this.previousElementSibling.remove()" onerror="this.remove()"></div>
      <b>${esc(s.a)}</b>
      <div class="muted">${s.vig} vigentes · ${s.total} en total · ${s.clientes} clientes</div>
      <div>Prima: <b>${money(s.prima)}</b></div>
      <div>Comisión est.: <b>${money(s.comision)}</b></div>
      ${s.renovar ? `<span class="badge warn">${s.renovar} por renovar</span>` : ''}
    </div>`).join('')}</div>`;
  el.querySelectorAll('[data-a]').forEach((c) => (c.onclick = () => { state.filtroAseg = c.dataset.a; location.hash = 'polizas'; }));
}

function vRenovaciones(el) {
  const rows = state.data.polizas.filter((p) => p.estado === 'Vigente' && daysUntil(p.fin) !== null && daysUntil(p.fin) <= 90).sort((a, b) => (a.fin > b.fin ? 1 : -1));
  el.innerHTML = `<p class="muted">Pólizas vigentes que vencen en los próximos 90 días (o ya vencidas sin actualizar). Al renovar, edita la póliza y cambia la fecha de fin de vigencia.</p>${tablaPolizas(rows)}`;
  bindPolizas(el);
}

function vAgenda(el) {
  const ts = [...state.data.tareas].sort((a, b) => (a.fecha > b.fecha ? 1 : -1));
  const pend = ts.filter((t) => !t.hecho), hechas = ts.filter((t) => t.hecho).reverse().slice(0, 20);
  el.innerHTML = `<div class="top"><span></span><button class="btn" id="nuevo">+ Nueva tarea / cita</button></div>
    <div class="grid2"><div class="card"><h3>Pendientes (${pend.length})</h3>${pend.map(tareaItem).join('') || '<div class="empty">Nada pendiente</div>'}</div>
    <div class="card"><h3>Completadas recientes</h3>${hechas.map(tareaItem).join('') || '<div class="empty">—</div>'}</div></div>`;
  $('#nuevo').onclick = () => editar('tareas');
  bindTareas(el);
}

function actItem(a) {
  return `<div class="list-item"><div><b>${esc((a.usuario || '').split('@')[0])}</b> ${esc(a.accion)} ${esc(a.entidad || '')}: ${esc(a.descripcion)}</div><span class="muted" style="white-space:nowrap">${fmtDateTime(a.created_at)}</span></div>`;
}

function vActividad(el) {
  el.innerHTML = `<div class="card"><h3>Bitácora — quién hizo qué</h3>${state.data.actividad.slice(0, 200).map(actItem).join('') || '<div class="empty">Sin actividad</div>'}</div>`;
}

// ---------- Pantallas principales ----------
async function render() {
  const app = $('#app');
  document.body.dataset.perfil = state.perfil || '';
  if (!state.user) return renderLogin(app);
  if (!state.perfil) return renderPerfiles(app);
  const vista = (location.hash.slice(1) || 'dashboard');
  const v = VISTAS[vista] && (!VISTAS[vista].perfil || VISTAS[vista].perfil === state.perfil) ? vista : 'dashboard';
  const P = PERFILES[state.perfil];
  app.innerHTML = `<div class="layout">
    <nav class="side" id="side"><div class="brand"><img src="${P.logo}" alt="${esc(P.nombre)}"></div>
      ${Object.entries(VISTAS).filter(([, x]) => !x.perfil || x.perfil === state.perfil).map(([k, x]) => `<a href="#${k}" class="${k === v ? 'active' : ''}">${x.nombre}</a>`).join('')}
      <div class="foot"><div>👤 ${esc(state.user.email)}</div><button id="respaldo">⬇ Descargar todo en Excel</button><button id="cambiar">⇄ Cambiar a ${state.perfil === 'byc' ? 'Seguros' : 'B&C'}</button><button id="salir">Cerrar sesión</button></div>
    </nav>
    <main class="main"><div class="top"><div style="display:flex;gap:10px;align-items:center"><button class="btn sec menu-btn" id="menu">☰</button><h1>${VISTAS[v].nombre}</h1></div><span class="muted">${esc(P.nombre)}</span></div>
      ${DEMO ? '<div class="demo-banner">Modo demo: los datos se guardan solo en este navegador. Configura Supabase (ver README) para usarlo en la nube entre usuarios.</div>' : ''}
      <div id="view"><div class="empty">Cargando…</div></div></main></div>`;
  $('#menu').onclick = () => $('#side').classList.toggle('open');
  $('#respaldo').onclick = exportarTodo;
  $('#cambiar').onclick = () => { state.perfil = state.perfil === 'byc' ? 'seguros' : 'byc'; localStorage.setItem('perfil', state.perfil); location.hash = 'dashboard'; render(); };
  $('#salir').onclick = async () => { if (!DEMO) await sb.auth.signOut(); state.user = null; state.perfil = null; localStorage.removeItem('perfil'); render(); };
  await loadAll();
  VISTAS[v].fn($('#view'));
}

function renderLogin(app) {
  app.innerHTML = `<div class="center"><form class="login" id="lf">
    <div class="login-logos"><img src="assets/logo-byc.png" alt="B&C"><img src="assets/logo-seguros.png" alt="Seguros Bobadilla"></div>
    <h1>Iniciar sesión</h1><p class="muted">CRM B&amp;C Abogados y Notarios · Seguros Bobadilla</p>
    <label>Correo</label><input type="email" name="email" required><br><br>
    <label>Contraseña</label><input type="password" name="password" required><br><br>
    <button class="btn" style="width:100%">Entrar</button>
    ${DEMO ? '<p class="muted">Modo demo: escribe cualquier correo y contraseña.</p>' : ''}
  </form></div>`;
  $('#lf').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (DEMO) { state.user = { email: f.email }; localStorage.setItem('demo_user', f.email); return render(); }
    const { data, error } = await sb.auth.signInWithPassword(f);
    if (error) return toast('Correo o contraseña incorrectos');
    state.user = data.user; render();
  };
}

function renderPerfiles(app) {
  app.innerHTML = `<div class="center"><div style="width:100%;max-width:700px"><h1 style="text-align:center">¿Con qué perfil vas a trabajar?</h1>
    <div class="perfiles">${Object.entries(PERFILES).map(([k, p]) => `<div class="perfil-card" data-p="${k}"><img src="${p.logo}" alt=""><h2>${esc(p.nombre)}</h2></div>`).join('')}</div></div></div>`;
  app.querySelectorAll('[data-p]').forEach((c) => (c.onclick = () => { state.perfil = c.dataset.p; localStorage.setItem('perfil', state.perfil); location.hash = 'dashboard'; render(); }));
}

window.addEventListener('hashchange', () => { $('#side')?.classList.remove('open'); render(); });

(async function init() {
  if (DEMO) { const u = localStorage.getItem('demo_user'); if (u) state.user = { email: u }; }
  else { const { data } = await sb.auth.getSession(); state.user = data.session?.user || null; }
  render();
})();
