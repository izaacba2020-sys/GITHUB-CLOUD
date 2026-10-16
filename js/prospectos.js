/* Prospectos: tablero (kanban) o lista, con búsqueda, filtros y orden. */
const PF_DEF = { vista: 'tablero', q: '', orden: 'escribio_desc', etapa: '', servicio: '', fuente: '', referido: '', seguimiento: '', desde: '', hasta: '', usuario: '' };

const nombreProspecto = (p) => (p.cliente_id ? clienteNombre(p.cliente_id) : p.contacto || '');

// clave: [etiqueta, valor para ordenar, dirección]
const ORDENES_PROSP = {
  escribio_desc: ['Fecha en que escribió (más reciente)', (p) => fechaContacto(p), -1],
  escribio_asc: ['Fecha en que escribió (más antigua)', (p) => fechaContacto(p), 1],
  ingreso_desc: ['Fecha de ingreso al CRM (más reciente)', (p) => p.created_at || '', -1],
  ingreso_asc: ['Fecha de ingreso al CRM (más antigua)', (p) => p.created_at || '', 1],
  seguimiento_asc: ['Próximo seguimiento (más cercano)', (p) => p.seguimiento || '9999-12-31', 1],
  monto_desc: ['Monto (mayor a menor)', (p) => Number(p.monto || 0), -1],
  monto_asc: ['Monto (menor a mayor)', (p) => Number(p.monto || 0), 1],
  nombre_asc: ['Nombre (A → Z)', (p) => nombreProspecto(p).toLowerCase(), 1],
  nombre_desc: ['Nombre (Z → A)', (p) => nombreProspecto(p).toLowerCase(), -1],
  necesita_asc: ['¿Qué necesita? (A → Z)', (p) => (p.titulo || '').toLowerCase(), 1],
  etapa_asc: ['Etapa', (p) => CAT.etapas.indexOf(p.etapa || 'Nuevo'), 1],
};

function cargarFiltrosProsp() {
  if (!state.pf) {
    let guardado = {};
    try { guardado = JSON.parse(localStorage.getItem('prosp_filtros_' + state.perfil) || '{}'); } catch { /* sin almacenamiento */ }
    state.pf = { ...PF_DEF, ...guardado, perfil: state.perfil };
  }
  if (state.pf.perfil !== state.perfil) { state.pf = null; return cargarFiltrosProsp(); }
  return state.pf;
}
function guardarFiltrosProsp() {
  try { localStorage.setItem('prosp_filtros_' + state.perfil, JSON.stringify(state.pf)); } catch { /* sin almacenamiento */ }
}

function filtrarProspectos(F) {
  const hoy = today(), en7 = fechaISO(sumarDias(new Date(hoy + 'T12:00'), 7));
  const q = F.q.trim().toLowerCase();
  const abierto = (p) => !['Ganado', 'Perdido'].includes(p.etapa);
  const lista = state.data.prospectos.filter((p) => {
    if (q && ![p.titulo, nombreProspecto(p), p.contacto, p.telefono, p.servicio, p.referido_por, p.notas, p.fuente].join(' ').toLowerCase().includes(q)) return false;
    if (F.etapa === 'abiertos' ? !abierto(p) : F.etapa && (p.etapa || 'Nuevo') !== F.etapa) return false;
    if (F.servicio && (p.servicio || 'Sin indicar') !== F.servicio) return false;
    if (F.fuente && (p.fuente || 'Sin indicar') !== F.fuente) return false;
    if (F.referido === 'si' && !p.referido_por) return false;
    if (F.referido === 'no' && p.referido_por) return false;
    if (F.usuario && (p.created_by || '') !== F.usuario) return false;
    const f = fechaContacto(p);
    if (F.desde && f < F.desde) return false;
    if (F.hasta && f > F.hasta) return false;
    if (F.seguimiento) {
      if (!abierto(p)) return false;
      if (F.seguimiento === 'vencido' && !(p.seguimiento && p.seguimiento < hoy)) return false;
      if (F.seguimiento === 'hoy' && p.seguimiento !== hoy) return false;
      if (F.seguimiento === 'semana' && !(p.seguimiento && p.seguimiento >= hoy && p.seguimiento <= en7)) return false;
      if (F.seguimiento === 'sin' && p.seguimiento) return false;
    }
    return true;
  });
  const [, val, dir] = ORDENES_PROSP[F.orden] || ORDENES_PROSP.escribio_desc;
  return lista.sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * dir; });
}

function vProspectos(el) {
  const F = cargarFiltrosProsp();
  const seg = state.perfil === 'seguros';
  const ps = state.data.prospectos;
  const servicios = [...new Set([...(seg ? CAT.ramos : CAT.tramites), ...ps.map((p) => p.servicio || 'Sin indicar')])];
  const fuentes = [...new Set([...CAT.fuentes, ...ps.map((p) => p.fuente || 'Sin indicar')])];
  const usuarios = [...new Set(ps.map((p) => p.created_by).filter(Boolean))];
  const opt = (v, l, actual) => `<option value="${esc(v)}" ${String(actual) === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
  el.innerHTML = `
    <div class="pf-barra">
      <input class="search" id="pf-q" placeholder="🔎 Buscar nombre, teléfono, servicio, notas…" value="${esc(F.q)}">
      <label class="pf-lbl">Ordenar por <select id="pf-orden">${Object.entries(ORDENES_PROSP).map(([k, [l]]) => opt(k, l, F.orden)).join('')}</select></label>
      <div class="seg" id="pf-vista">${[['tablero', '▦ Tablero'], ['lista', '☰ Lista']].map(([k, l]) => `<button class="${F.vista === k ? 'on' : ''}" data-k="${k}">${l}</button>`).join('')}</div>
      <button class="btn" id="nuevo" style="margin-left:auto">+ Nuevo prospecto</button>
    </div>
    <div class="pf-filtros">
      <select data-f="etapa"><option value="">Todas las etapas</option>${opt('abiertos', 'Solo abiertos (sin cerrar)', F.etapa)}${CAT.etapas.map((e) => opt(e, e, F.etapa)).join('')}</select>
      <select data-f="servicio"><option value="">Todos los servicios</option>${servicios.map((s) => opt(s, s, F.servicio)).join('')}</select>
      <select data-f="fuente"><option value="">Por dónde escribió: todos</option>${fuentes.map((s) => opt(s, s, F.fuente)).join('')}</select>
      <select data-f="referido"><option value="">Referidos y directos</option>${opt('si', 'Solo referidos', F.referido)}${opt('no', 'Solo directos', F.referido)}</select>
      <select data-f="seguimiento"><option value="">Seguimiento: todos</option>${opt('vencido', '⚠️ Seguimiento atrasado', F.seguimiento)}${opt('hoy', 'Seguimiento hoy', F.seguimiento)}${opt('semana', 'Seguimiento próximos 7 días', F.seguimiento)}${opt('sin', 'Sin fecha de seguimiento', F.seguimiento)}</select>
      ${usuarios.length > 1 ? `<select data-f="usuario"><option value="">Registrado por: todos</option>${usuarios.map((u) => opt(u, u.split('@')[0], F.usuario)).join('')}</select>` : ''}
      <label class="pf-lbl">Escribió del <input type="date" data-f="desde" value="${esc(F.desde)}"></label>
      <label class="pf-lbl">al <input type="date" data-f="hasta" value="${esc(F.hasta)}"></label>
    </div>
    <div class="pf-info" id="pf-info"></div>
    <div id="pf-body"></div>`;

  const pinta = () => {
    guardarFiltrosProsp();
    const lista = filtrarProspectos(F);
    const activos = ['q', 'etapa', 'servicio', 'fuente', 'referido', 'seguimiento', 'desde', 'hasta', 'usuario'].filter((k) => F[k]).length;
    $('#pf-info').innerHTML = `Mostrando <b>${lista.length}</b> de ${ps.length} prospectos · ${esc(ORDENES_PROSP[F.orden][0].toLowerCase())}${activos ? ` · <a href="#" id="pf-limpiar">✕ Quitar filtros (${activos})</a>` : ''}`;
    if ($('#pf-limpiar')) $('#pf-limpiar').onclick = (e) => { e.preventDefault(); Object.assign(F, { ...PF_DEF, vista: F.vista, orden: F.orden }); vProspectos(el); };
    $('#pf-body').innerHTML = F.vista === 'lista' ? listaProspectos(lista, F) : tableroProspectos(lista);
    enlazarProspectos(el, F, pinta);
  };
  $('#pf-q').oninput = () => { F.q = $('#pf-q').value; pinta(); };
  $('#pf-orden').onchange = () => { F.orden = $('#pf-orden').value; pinta(); };
  el.querySelectorAll('[data-f]').forEach((x) => (x.onchange = () => { F[x.dataset.f] = x.value; pinta(); }));
  el.querySelectorAll('#pf-vista button').forEach((b) => (b.onclick = () => { F.vista = b.dataset.k; el.querySelectorAll('#pf-vista button').forEach((x) => x.classList.toggle('on', x === b)); pinta(); }));
  $('#nuevo').onclick = () => editar('prospectos');
  pinta();
}

function tableroProspectos(lista) {
  return `<div class="kanban">${CAT.etapas.map((e) => {
    const ps = lista.filter((p) => (p.etapa || 'Nuevo') === e);
    const total = ps.reduce((s, p) => s + Number(p.monto || 0), 0);
    return `<div class="col" data-etapa="${esc(e)}"><h4>${esc(e)} <span class="muted">${ps.length} · ${money(total)}</span></h4>
      ${ps.map((p) => `<div class="kcard" draggable="true" data-id="${p.id}">
        <b>${esc(p.titulo)}</b>
        <div class="muted">${esc(nombreProspecto(p))} ${p.servicio ? '· ' + esc(p.servicio) : ''}</div>
        ${p.monto ? `<div>${money(p.monto)}</div>` : ''}
        ${antiguedadProspecto(p)}
        ${p.referido_por ? `<div class="muted">🤝 ${esc(p.referido_por)}</div>` : ''}
        ${p.seguimiento && !['Ganado', 'Perdido'].includes(e) ? `<div class="muted">Seguimiento: ${venceBadge(p.seguimiento)}</div>` : ''}
        ${e === 'Perdido' && p.motivo_perdida ? `<div class="muted">Motivo: ${esc(p.motivo_perdida)}</div>` : ''}
        ${state.perfil === 'byc' && !['Ganado', 'Perdido'].includes(e) ? `<button class="btn sec sm kbtn" data-cot="${p.id}">📄 Cotización</button>` : ''}
        <select data-etapa-sel="${p.id}">${CAT.etapas.map((x) => `<option ${x === e ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
      </div>`).join('')}</div>`;
  }).join('')}</div>`;
}

// Columnas de la lista: [título, clave de orden ascendente, clave descendente]
const COLS_LISTA = [
  ['Escribió', 'escribio_asc', 'escribio_desc'], ['Ingresó al CRM', 'ingreso_asc', 'ingreso_desc'], ['¿Qué necesita?', 'necesita_asc', null],
  ['Contacto', 'nombre_asc', 'nombre_desc'], ['Servicio', null, null], ['Por dónde', null, null], ['Etapa', 'etapa_asc', null],
  ['Monto', 'monto_asc', 'monto_desc'], ['Seguimiento', 'seguimiento_asc', null],
];

function listaProspectos(lista, F) {
  const fCorta = (d) => (d ? new Date(d.length === 10 ? d + 'T12:00' : d).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');
  return `<div class="card table-wrap"><table class="tabla-prosp"><thead><tr>${COLS_LISTA.map(([t, a, d]) => {
    const activo = F.orden === a || F.orden === d;
    const flecha = activo ? (F.orden === a ? ' ▲' : ' ▼') : '';
    return a ? `<th class="th-orden ${activo ? 'activo' : ''}" data-asc="${a}" data-desc="${d || a}" title="Ordenar">${t}${flecha}</th>` : `<th>${t}</th>`;
  }).join('')}</tr></thead><tbody>
    ${lista.map((p) => {
      const cerrado = ['Ganado', 'Perdido'].includes(p.etapa);
      const dias = Math.max(0, diasEntre(fechaContacto(p), cerrado && p.fecha_cierre ? p.fecha_cierre : today()));
      return `<tr class="click" data-id="${p.id}">
        <td style="white-space:nowrap">${fCorta(fechaContacto(p))}<div class="muted">${cerrado ? `cerrado en ${textoDias(dias)}` : `<span class="badge ${dias > 30 ? 'bad' : dias > 14 ? 'warn' : ''}">${dias === 0 ? 'hoy' : 'hace ' + textoDias(dias)}</span>`}</div></td>
        <td style="white-space:nowrap">${fCorta(p.created_at)}</td>
        <td><b>${esc(p.titulo)}</b>${p.referido_por ? `<div class="muted">🤝 ${esc(p.referido_por)}</div>` : ''}</td>
        <td>${esc(nombreProspecto(p))}<div class="muted">${esc(p.telefono || '')}</div></td>
        <td>${esc(p.servicio || '—')}</td>
        <td>${esc(p.fuente || '—')}</td>
        <td><select data-etapa-sel="${p.id}" style="width:auto">${CAT.etapas.map((x) => `<option ${x === (p.etapa || 'Nuevo') ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>${p.etapa === 'Perdido' && p.motivo_perdida ? `<div class="muted">${esc(p.motivo_perdida)}</div>` : ''}</td>
        <td style="white-space:nowrap">${p.monto ? money(p.monto) : '—'}</td>
        <td>${p.seguimiento && !cerrado ? venceBadge(p.seguimiento) : '<span class="muted">—</span>'}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="9" class="empty">No hay prospectos con estos filtros</td></tr>'}</tbody></table></div>`;
}

function enlazarProspectos(el, F, pinta) {
  const mover = async (id, etapa) => {
    const p = state.data.prospectos.find((x) => x.id === id);
    if (!p || p.etapa === etapa) return;
    if (etapa === 'Ganado') return ganarProspecto(p);
    if (etapa === 'Perdido') return perderProspecto(p);
    await db.save('prospectos', { ...p, etapa }, `${p.titulo} → ${etapa}`);
    render();
  };
  const abrir = (id) => editar('prospectos', state.data.prospectos.find((x) => x.id === id));
  el.querySelectorAll('.kcard').forEach((k) => {
    k.ondragstart = (e) => e.dataTransfer.setData('id', k.dataset.id);
    k.onclick = (e) => { if (e.target.tagName !== 'SELECT' && !e.target.dataset.cot) abrir(k.dataset.id); };
  });
  el.querySelectorAll('tr[data-id]').forEach((tr) => (tr.onclick = (e) => { if (e.target.tagName !== 'SELECT' && e.target.tagName !== 'OPTION') abrir(tr.dataset.id); }));
  el.querySelectorAll('[data-etapa-sel]').forEach((s) => (s.onchange = () => mover(s.dataset.etapaSel, s.value)));
  el.querySelectorAll('[data-cot]').forEach((b) => (b.onclick = () => abrirCotizacion({ prospecto: state.data.prospectos.find((x) => x.id === b.dataset.cot) })));
  el.querySelectorAll('.col').forEach((c) => {
    c.ondragover = (e) => { e.preventDefault(); c.classList.add('over'); };
    c.ondragleave = () => c.classList.remove('over');
    c.ondrop = (e) => { e.preventDefault(); c.classList.remove('over'); mover(e.dataTransfer.getData('id'), c.dataset.etapa); };
  });
  el.querySelectorAll('.th-orden').forEach((th) => (th.onclick = () => {
    F.orden = F.orden === th.dataset.asc ? th.dataset.desc : th.dataset.asc;
    $('#pf-orden').value = F.orden;
    pinta();
  }));
}
