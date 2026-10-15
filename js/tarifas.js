/* B&C: tarifario de trámites (honorarios, gastos, comisión por referido y utilidad). */
const GASTOS_TARIFA = [
  ['timbres', 'Timbres fiscales y notariales', true],
  ['impuestos', 'Impuestos (IVA, IUSI, compraventa…)', true],
  ['registros', 'Aranceles y pagos a registros / instituciones', true],
  ['certificaciones', 'Certificaciones, copias y papelería', true],
  ['courier', 'Courier / mensajería', false],
  ['tramitador', 'Pago a tramitador / procurador', false],
  ['viaticos', 'Viáticos y transporte', false],
  ['otros', 'Otros gastos', false],
];
const nombreGasto = (k) => (GASTOS_TARIFA.find((g) => g[0] === k) || [k, k])[1];
const IVA_OPCIONES = [12, 5];
const ivaDe = (honorarios, pct) => Math.round(Number(honorarios || 0) * Number(pct || 0)) / 100;

// Cálculo de precio, comisión y utilidad de una tarifa.
function calcTarifa(t = {}) {
  let gastosCliente = 0, gastosInternos = 0;
  for (const [k] of GASTOS_TARIFA) {
    const g = (t.gastos || {})[k];
    if (!g || !Number(g.monto)) continue;
    if (g.cobrar) gastosCliente += Number(g.monto); else gastosInternos += Number(g.monto);
  }
  const honorarios = Number(t.honorarios || 0);
  const comision = t.comision_tipo === 'Q' ? Number(t.comision_valor || 0) : honorarios * Number(t.comision_valor || 0) / 100;
  // El IVA se cobra sobre los honorarios; no es utilidad (se paga a la SAT).
  const ivaPct = Number(t.iva_pct || 0), iva = Math.round(honorarios * ivaPct) / 100;
  return { honorarios, ivaPct, iva, gastosCliente, gastosInternos, precio: honorarios + iva + gastosCliente, comision, utilDirecto: honorarios - gastosInternos, utilReferido: honorarios - gastosInternos - comision };
}

const tarifaPorId = (id) => (state.data.tarifas || []).find((t) => t.id === id);
const tarifaOpts = () => (state.data.tarifas || []).filter((t) => t.activo !== false || t.id === state.editando?.tarifa_id)
  .sort((a, b) => a.nombre.localeCompare(b.nombre)).map((t) => ({ v: t.id, l: `${t.nombre} · ${money(calcTarifa(t).precio)}` }));
const textoComision = (t) => (Number(t.comision_valor) ? (t.comision_tipo === 'Q' ? money(t.comision_valor) : `${Number(t.comision_valor)}% de honorarios`) : 'Sin comisión');

// Gastos que paga el cliente, como líneas "concepto = monto" (para la cotización).
const lineasGastosCliente = (t) => GASTOS_TARIFA.filter(([k]) => t?.gastos?.[k]?.cobrar && Number(t.gastos[k].monto)).map(([k, l]) => `${l} = ${Number(t.gastos[k].monto)}`);

// ---------- Vista ----------
function vPrecios(el) {
  el.innerHTML = `
    <div class="card muted" style="font-size:13px">💡 <b>Precio al cliente</b> = honorarios + gastos que se le cobran. <b>Utilidad</b> = honorarios − gastos que absorbe la oficina − comisión del referido (si aplica).</div>
    <div class="top"><div style="display:flex;gap:8px;flex-wrap:wrap">
      <input class="search" id="q" placeholder="Buscar servicio…">
      <select id="ft" style="width:auto"><option value="">Todos los trámites</option>${CAT.tramites.map((t) => `<option>${esc(t)}</option>`).join('')}</select>
      <select id="fa" style="width:auto"><option value="1">Activos</option><option value="">Todos</option></select>
    </div><button class="btn" id="nuevo">+ Nuevo precio</button></div>
    <div class="card table-wrap"><table><thead><tr><th>Servicio</th><th>Honorarios</th><th>IVA</th><th>Gastos al cliente</th><th>Precio al cliente</th><th>Gastos internos</th><th>Comisión referido</th><th>Utilidad directo</th><th>Utilidad con referido</th><th></th></tr></thead><tbody id="rows"></tbody></table></div>`;
  const pinta = () => {
    const q = $('#q').value.toLowerCase(), ft = $('#ft').value, fa = $('#fa').value;
    const rows = (state.data.tarifas || []).filter((t) => (!fa || t.activo !== false) && (!ft || t.tramite === ft) && [t.nombre, t.tramite, t.descripcion].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (a.tramite || '').localeCompare(b.tramite || '') || a.nombre.localeCompare(b.nombre));
    $('#rows').innerHTML = rows.map((t) => {
      const c = calcTarifa(t);
      return `<tr class="click ${t.activo === false ? 'inactiva' : ''}" data-id="${t.id}">
        <td><b>${esc(t.nombre)}</b>${t.activo === false ? ' <span class="badge">Inactivo</span>' : ''}<div class="muted">${esc(t.tramite || '')}${t.dias_estimados ? ` · ~${esc(t.dias_estimados)} días hábiles` : ''}</div></td>
        <td>${money(c.honorarios)}</td><td>${c.ivaPct ? `${money(c.iva)}<div class="muted">${c.ivaPct}%</div>` : '<span class="muted">Sin IVA</span>'}</td><td>${money(c.gastosCliente)}</td><td><b>${money(c.precio)}</b></td><td>${money(c.gastosInternos)}</td>
        <td>${money(c.comision)}<div class="muted">${esc(textoComision(t))}</div></td>
        <td class="${c.utilDirecto < 0 ? 'baja' : ''}">${money(c.utilDirecto)}</td><td class="${c.utilReferido < 0 ? 'baja' : ''}">${money(c.utilReferido)}</td>
        <td><button class="btn sec sm" data-dup="${t.id}" title="Duplicar">⧉</button></td></tr>`;
    }).join('') || '<tr><td colspan="10" class="empty">Aún no hay precios. Agrega el primero con “+ Nuevo precio”.</td></tr>';
    el.querySelectorAll('tr[data-id]').forEach((tr) => (tr.onclick = () => editarTarifa(tarifaPorId(tr.dataset.id))));
    el.querySelectorAll('[data-dup]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const t = tarifaPorId(b.dataset.dup); editarTarifa({ ...t, id: undefined, created_at: undefined, nombre: t.nombre + ' (copia)' }); }));
  };
  $('#q').oninput = pinta; $('#ft').onchange = pinta; $('#fa').onchange = pinta;
  $('#nuevo').onclick = () => editarTarifa();
  pinta();
}

// ---------- Formulario ----------
function editarTarifa(t = {}) {
  const g = (k, def) => t.gastos?.[k] || { monto: '', cobrar: def };
  openModal(`<div id="tar-wrap">
    <h2>${t.id ? 'Editar precio' : 'Nuevo precio'}</h2>
    <form class="form" id="f-tar">
      <div class="full"><label>Nombre del servicio *</label><input name="nombre" required value="${esc(t.nombre || '')}" placeholder="Ej.: Traspaso de vehículo particular"></div>
      <div><label>Tipo de trámite</label><select name="tramite"><option value="">— Seleccionar —</option>${CAT.tramites.map((x) => `<option ${x === t.tramite ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
      <div><label>Tiempo estimado (días hábiles)</label><input type="number" name="dias_estimados" value="${esc(t.dias_estimados ?? '')}"></div>
      <div><label>Honorarios (Q) *</label><input type="number" step="0.01" name="honorarios" required value="${esc(t.honorarios ?? '')}"></div>
      <div class="iva-box full"><label class="check"><input type="checkbox" id="iva-on" ${Number(t.iva_pct) ? 'checked' : ''}> Cobrar IVA sobre los honorarios</label>
        <select id="iva-pct" style="width:auto" ${Number(t.iva_pct) ? '' : 'disabled'}>${IVA_OPCIONES.map((p) => `<option value="${p}" ${Number(t.iva_pct || 12) === p ? 'selected' : ''}>IVA ${p}%</option>`).join('')}</select></div>
      <div><label>Activo</label><select name="activo"><option value="true" ${t.activo !== false ? 'selected' : ''}>Sí</option><option value="false" ${t.activo === false ? 'selected' : ''}>No (ya no se ofrece)</option></select></div>
    </form>
    <h3 style="margin-top:16px">Gastos</h3>
    <p class="muted" style="margin-top:0">Marca <b>“Al cliente”</b> si ese gasto se le cobra aparte; si no, lo absorbe la oficina y se resta de la utilidad.</p>
    <div class="gastos-tabla">${GASTOS_TARIFA.map(([k, l, def]) => { const x = g(k, def); return `
      <div class="gasto-fila"><label>${esc(l)}</label><input type="number" step="0.01" data-gasto="${k}" value="${esc(x.monto ?? '')}" placeholder="0.00">
        <label class="check"><input type="checkbox" data-cobrar="${k}" ${x.cobrar ? 'checked' : ''}> Al cliente</label></div>`; }).join('')}</div>
    <h3 style="margin-top:16px">Comisión por referido</h3>
    <div class="form">
      <div><label>Tipo de comisión</label><select id="ct"><option value="%" ${t.comision_tipo !== 'Q' ? 'selected' : ''}>% de los honorarios</option><option value="Q" ${t.comision_tipo === 'Q' ? 'selected' : ''}>Monto fijo (Q)</option></select></div>
      <div><label id="cv-l">Valor</label><input type="number" step="0.01" id="cv" value="${esc(t.comision_valor ?? '')}" placeholder="Ej.: 10"></div>
    </div>
    <div class="form" style="margin-top:12px">
      <div class="full"><label>¿Qué incluye? (sale en la cotización)</label><textarea id="desc">${esc(t.descripcion || '')}</textarea></div>
      <div class="full"><label>Notas internas</label><textarea id="notas">${esc(t.notas || '')}</textarea></div>
    </div>
    <div class="resumen-tarifa" id="resumen"></div>
    <div class="actions">
      ${t.id ? '<button class="btn danger" id="del" style="margin-right:auto">Eliminar</button>' : ''}
      <button class="btn sec" id="cancel">Cancelar</button><button class="btn" id="ok">Guardar</button>
    </div></div>`);
  const leer = () => {
    const f = Object.fromEntries(new FormData($('#f-tar')));
    const gastos = {};
    GASTOS_TARIFA.forEach(([k]) => { const m = $(`[data-gasto="${k}"]`).value; gastos[k] = { monto: m === '' ? 0 : Number(m), cobrar: $(`[data-cobrar="${k}"]`).checked }; });
    $('#iva-pct').disabled = !$('#iva-on').checked;
    return { ...t, ...f, iva_pct: $('#iva-on').checked ? Number($('#iva-pct').value) : 0, activo: f.activo === 'true', dias_estimados: f.dias_estimados || null, gastos, comision_tipo: $('#ct').value, comision_valor: $('#cv').value || 0, descripcion: $('#desc').value, notas: $('#notas').value };
  };
  const resumen = () => {
    const c = calcTarifa(leer());
    $('#cv-l').textContent = $('#ct').value === 'Q' ? 'Monto de la comisión (Q)' : 'Porcentaje (%)';
    $('#resumen').innerHTML = `
      <div><span>Precio al cliente</span><b>${money(c.precio)}</b><small>${money(c.honorarios)} honorarios${c.ivaPct ? ` + ${money(c.iva)} IVA ${c.ivaPct}%` : ''} + ${money(c.gastosCliente)} gastos</small></div>
      ${c.ivaPct ? `<div><span>IVA a pagar a la SAT</span><b>${money(c.iva)}</b></div>` : ''}
      <div><span>Gastos que absorbe la oficina</span><b>${money(c.gastosInternos)}</b></div>
      <div><span>Comisión al referido</span><b>${money(c.comision)}</b></div>
      <div><span>Utilidad cliente directo</span><b class="${c.utilDirecto < 0 ? 'baja' : 'sube'}">${money(c.utilDirecto)}</b></div>
      <div><span>Utilidad con referido</span><b class="${c.utilReferido < 0 ? 'baja' : 'sube'}">${money(c.utilReferido)}</b></div>`;
  };
  // Los oyentes van en el contenido de este formulario (no en la ventana, que se reutiliza).
  $('#tar-wrap').addEventListener('input', resumen);
  $('#tar-wrap').addEventListener('change', resumen);
  resumen();
  $('#cancel').onclick = closeModal;
  if (t.id) $('#del').onclick = async () => {
    if (!confirm('¿Eliminar este precio? (Los expedientes que ya lo usaron conservan sus montos.) Si ya no se ofrece, puedes marcarlo como inactivo.')) return;
    try { await db.remove('tarifas', t.id, t.nombre); closeModal(); render(); } catch { /* ya notificado */ }
  };
  $('#ok').onclick = async () => {
    if (!$('#f-tar').reportValidity()) return;
    const row = leer();
    delete row.created_at;
    try { await db.save('tarifas', row, row.nombre); closeModal(); toast('Precio guardado'); render(); } catch { /* ya notificado */ }
  };
}

// ---------- Uso del tarifario en expedientes y prospectos ----------
// Al elegir un precio (o escribir quién refirió), se llenan honorarios, gastos y comisión.
function enlazarTarifa(t) {
  const sel = $('[name=tarifa_id]');
  if (!sel) return;
  const set = (name, v) => { const i = $(`[name=${name}]`); if (i) i.value = v; };
  const ref = $('[name=referido_por]');
  const aplicar = (cambioTarifa) => {
    const tar = tarifaPorId(sel.value);
    if (!tar) return;
    const c = calcTarifa(tar);
    if (t === 'expedientes') {
      if (cambioTarifa) {
        set('honorarios', c.honorarios || '');
        set('gastos', c.gastosCliente || '');
        set('iva_pct', String(c.ivaPct || 0));
        if (tar.tramite) set('tramite', tar.tramite);
      }
      set('comision', ref && ref.value.trim() ? c.comision.toFixed(2) : '');
    } else if (cambioTarifa) {
      set('monto', c.precio || '');
      if (tar.tramite && CAT.tramites.includes(tar.tramite)) set('servicio', tar.tramite);
      const tit = $('[name=titulo]'); if (tit && !tit.value) tit.value = tar.nombre;
    }
  };
  sel.addEventListener('change', () => aplicar(true));
  if (ref) ref.addEventListener('change', () => aplicar(false));
}

// Copia del cálculo al guardar el expediente (para que la utilidad no cambie si después se edita el precio).
function desgloseDe(tarifaId) {
  const tar = tarifaPorId(tarifaId);
  return tar ? { nombre: tar.nombre, ...calcTarifa(tar), gastos: tar.gastos, comision_tipo: tar.comision_tipo, comision_valor: tar.comision_valor } : null;
}

function utilidadExp(x) {
  return Number(x.honorarios || 0) - Number(x.comision || 0) - Number(x.desglose?.gastosInternos || 0);
}

async function marcarComisionPagada(x) {
  if (!confirm(`¿Marcar como pagada la comisión de ${money(x.comision)} a ${x.referido_por || 'el referido'}?`)) return;
  await db.save('expedientes', { ...x, comision_pagada: true }, `comisión pagada a ${x.referido_por || 'referido'} · ${x.tramite} · ${clienteNombre(x.cliente_id)}`);
  toast('Comisión marcada como pagada');
  render();
}

function tarjetaComisiones() {
  const pend = state.data.expedientes.filter((x) => Number(x.comision) > 0 && !x.comision_pagada && x.estado !== 'Cancelado');
  return `<div class="card"><h3>🤝 Comisiones por pagar a referidos ${pend.length ? `· ${money(pend.reduce((s, x) => s + Number(x.comision), 0))}` : ''}</h3>
    ${pend.map((x) => `<div class="list-item"><div><b>${esc(x.referido_por || 'Referido')}</b> · ${money(x.comision)}<div class="muted">${esc(x.tramite)} · ${esc(clienteNombre(x.cliente_id))} · ${esc(x.estado)}</div></div>
      <button class="btn sec sm" data-compag="${x.id}">✔ Pagada</button></div>`).join('') || '<div class="empty">No hay comisiones pendientes</div>'}</div>`;
}

function bindComisiones(root) {
  root.querySelectorAll('[data-compag]').forEach((b) => (b.onclick = () => marcarComisionPagada(state.data.expedientes.find((x) => x.id === b.dataset.compag))));
}
