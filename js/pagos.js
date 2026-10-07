/* Pagos y cobros: primas de pólizas y honorarios de expedientes */
// Número de pagos de la póliza: "6 pagos" -> 6 (también entiende los nombres anteriores Anual/Semestral/...).
const PAGOS_ANTERIORES = { Anual: 1, Semestral: 2, Trimestral: 4, Mensual: 12 };
function numPagos(forma) {
  if (!forma) return 1;
  if (PAGOS_ANTERIORES[forma]) return PAGOS_ANTERIORES[forma];
  const n = parseInt(forma, 10);
  return n >= 1 && n <= 12 ? n : 1;
}
// Opciones de número de pagos según la modalidad y el máximo de la aseguradora.
function opcionesCuotas(modalidad, aseguradora) {
  const permitidas = CAT.cuotasPorModalidad[modalidad] || CAT.cuotasPorModalidad.Otro;
  const max = CAT.maxCuotas[aseguradora]?.[modalidad] || 12;
  return permitidas.filter((n) => n <= max).map((n) => (n === 1 ? '1 pago' : `${n} pagos`));
}
const PAGO_MENSUAL = ['Visa cuotas', 'Fraccionado (crédito de la aseguradora)', 'Débito a cuenta'];

// Meses (0-11) en que cae cada cuota, a partir del mes de inicio.
// Visa cuotas, fraccionado y débito = mes a mes; si no, repartidas en el año (2 pagos = cada 6 meses).
function mesesDeCuota(p) {
  const n = numPagos(p.forma_pago), cada = PAGO_MENSUAL.includes(p.modalidad_pago) ? 1 : Math.floor(12 / n);
  const base = Number((p.inicio || p.fin || today()).slice(5, 7)) - 1;
  return Array.from({ length: n }, (_, k) => (base + k * cada) % 12);
}
const textoPago = (p) => [p.forma_pago, p.modalidad_pago].filter(Boolean).join(' · ');

const CAMPOS_PAGO = [
  { k: 'fecha', label: 'Fecha de pago', type: 'date', req: true },
  { k: 'monto', label: 'Monto pagado (Q)', type: 'number', req: true },
  { k: 'metodo', label: 'Método de pago', type: 'select', options: CAT.metodosPago },
  { k: 'referencia', label: 'No. recibo / boleta / referencia' },
  { k: 'notas', label: 'Notas', type: 'textarea', full: true },
];

const sumaMontos = (ps) => ps.reduce((s, x) => s + Number(x.monto || 0), 0);
const pagosDe = (tipo, id, pagos = state.data.pagos || []) => pagos.filter((x) => x.ref_tipo === tipo && x.ref_id === id);
const primaBase = (p) => Number(p.prima_neta || p.prima || 0); // la comisión se calcula sobre la prima neta

function resumenPago(total, pagado) {
  const saldo = Math.max(total - pagado, 0);
  const estado = total <= 0 ? 'Sin monto' : saldo <= 0.009 ? 'Pagado' : pagado > 0 ? 'Parcial' : 'Pendiente';
  return { total, pagado, saldo, estado, pct: total > 0 ? Math.min(100, Math.round(pagado / total * 100)) : 0 };
}

// Pagos de la vigencia actual (desde la fecha de inicio), para que al renovar el contador empiece de nuevo.
function estadoPagoPoliza(p, pagos) {
  const ps = pagosDe('poliza', p.id, pagos).filter((x) => !p.inicio || x.fecha >= p.inicio);
  const r = resumenPago(Number(p.prima || 0), sumaMontos(ps));
  r.cuota = r.total / numPagos(p.forma_pago);
  r.pagos = ps;
  return r;
}

function estadoPagoExp(x, pagos) {
  const ps = pagosDe('expediente', x.id, pagos);
  const r = resumenPago(Number(x.honorarios || 0), Number(x.anticipo || 0) + sumaMontos(ps));
  r.pagos = ps;
  return r;
}

function pagoBadge(r) {
  const cls = { Pagado: 'ok', Parcial: 'warn', Pendiente: 'bad' }[r.estado] || '';
  return `<span class="badge ${cls}">${r.estado === 'Parcial' ? `Parcial · debe ${money(r.saldo)}` : r.estado}</span>`;
}

function pagoBarra(r) {
  return `<div class="progress"><div style="width:${r.pct}%"></div></div><div class="muted">Pagado ${money(r.pagado)} de ${money(r.total)} · <b style="color:${r.saldo > 0 ? 'var(--bad)' : 'var(--ok)'}">Saldo ${money(r.saldo)}</b></div>`;
}

function descPago(pg) {
  const ref = pg.ref_tipo === 'poliza' ? state.data.polizas?.find((p) => p.id === pg.ref_id) : state.data.expedientes?.find((x) => x.id === pg.ref_id);
  const concepto = !ref ? '' : pg.ref_tipo === 'poliza' ? `${ref.ramo} ${ref.aseguradora}` : ref.tramite;
  return `${money(pg.monto)} · ${clienteNombre(pg.cliente_id)}${concepto ? ' · ' + concepto : ''}`;
}

function editarPago(pago) {
  formModal({
    titulo: pago.id ? 'Editar pago' : 'Registrar pago',
    campos: CAMPOS_PAGO,
    data: { fecha: today(), ...pago },
    onSave: (out) => db.save('pagos', out, descPago(out)),
    onDelete: pago.id ? () => db.remove('pagos', pago.id, descPago(pago)) : null,
  });
}

// tipo: 'poliza' | 'expediente'
function registrarPago(tipo, item, monto) {
  const r = tipo === 'poliza' ? estadoPagoPoliza(item) : estadoPagoExp(item);
  const sugerido = monto ?? (tipo === 'poliza' ? Math.min(r.cuota, r.saldo || r.cuota) : r.saldo);
  editarPago({ ref_tipo: tipo, ref_id: item.id, cliente_id: item.cliente_id, monto: sugerido ? sugerido.toFixed(2) : '' });
}

async function pagarSaldo(tipo, item) {
  const r = tipo === 'poliza' ? estadoPagoPoliza(item) : estadoPagoExp(item);
  if (r.saldo <= 0) return toast('No hay saldo pendiente');
  if (!confirm(`¿Registrar pago completo del saldo (${money(r.saldo)}) con fecha de hoy?`)) return;
  const pg = { ref_tipo: tipo, ref_id: item.id, cliente_id: item.cliente_id, fecha: today(), monto: r.saldo.toFixed(2), notas: 'Pago del saldo completo' };
  await db.save('pagos', pg, descPago(pg));
  toast('Pago registrado');
  closeModal();
  render();
}

function listaPagos(ps) {
  return ps.length ? ps.sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).map((pg) => `<div class="list-item click" data-pago="${pg.id}">
    <div><b>${money(pg.monto)}</b> ${pg.metodo ? `<span class="badge">${esc(pg.metodo)}</span>` : ''}<div class="muted">${fmtDate(pg.fecha)}${pg.referencia ? ' · Ref. ' + esc(pg.referencia) : ''}</div></div>
    <span style="display:flex;gap:6px;align-items:center">${state.perfil === 'byc' ? `<button class="btn sec sm" data-recibo="${pg.id}">🧾 Recibo</button>` : ''}<span class="muted">Editar</span></span></div>`).join('') : '<div class="empty">Sin pagos registrados</div>';
}

function bindPagos(root) {
  root.querySelectorAll('[data-pago]').forEach((el) => (el.onclick = () => editarPago(state.data.pagos.find((x) => x.id === el.dataset.pago))));
  root.querySelectorAll('[data-recibo]').forEach((b) => (b.onclick = (ev) => { ev.stopPropagation(); generarReciboPDF(state.data.pagos.find((x) => x.id === b.dataset.recibo)); }));
}

function fichaPoliza(id) {
  const p = state.data.polizas.find((x) => x.id === id);
  const c = state.data.clientes.find((x) => x.id === p.cliente_id) || {};
  const r = estadoPagoPoliza(p);
  openModal(`
    <h2>${asegLogo(p.aseguradora)}</h2>
    <p><b>${esc(c.nombre || '—')}</b> · ${esc(p.ramo)} ${p.numero ? '· Póliza No. ' + esc(p.numero) : ''}</p>
    <div class="grid2 muted">
      <div>Prima neta: <b>${money(p.prima_neta)}</b><br>Prima total: <b>${money(p.prima)}</b><br>Pago: ${esc(textoPago(p) || '—')}${numPagos(p.forma_pago) > 1 ? ` (cuota ${money(r.cuota)})` : ''}<br>Comisión: ${p.comision_pct ? esc(p.comision_pct) + '% = ' + money(primaBase(p) * p.comision_pct / 100) : '—'}</div>
      <div>Suma asegurada: ${money(p.suma_asegurada)}<br>Vigencia: ${fmtDate(p.inicio)} → ${fmtDate(p.fin)}<br>${p.estado === 'Vigente' ? venceBadge(p.fin) : ''} <span class="badge">${esc(p.estado)}</span></div>
    </div>
    ${p.notas ? `<p>${esc(p.notas)}</p>` : ''}
    <h3>Pagos de esta vigencia ${pagoBadge(r)}</h3>
    ${pagoBarra(r)}
    <div style="margin-top:8px">${listaPagos(r.pagos)}</div>
    <div class="actions">
      <button class="btn wa" id="wa">WhatsApp</button>
      <button class="btn sec" id="saldo">✔ Marcar pagada</button>
      <button class="btn" id="pago">+ Registrar pago</button>
      <button class="btn sec" id="ed">Editar póliza</button>
      ${p.estado === 'Vigente' ? '<button class="btn sec" id="baja">✖ No renovó / cancelar</button>' : '<button class="btn sec" id="reactivar">↺ Reactivar</button>'}
      <button class="btn sec" id="cerrar">Cerrar</button>
    </div>`);
  bindPagos($('#modal-box'));
  $('#wa').onclick = () => abrirWhatsApp({ cliente: c, poliza: p });
  $('#saldo').onclick = () => pagarSaldo('poliza', p);
  $('#pago').onclick = () => registrarPago('poliza', p);
  $('#ed').onclick = () => editar('polizas', p);
  if ($('#baja')) $('#baja').onclick = () => bajaPoliza(p);
  if ($('#reactivar')) $('#reactivar').onclick = () => reactivarPoliza(p);
  $('#cerrar').onclick = closeModal;
}

function vCobros(el) {
  const seg = state.perfil === 'seguros';
  const tipo = seg ? 'poliza' : 'expediente';
  const items = seg
    ? state.data.polizas.filter((p) => p.estado === 'Vigente').map((p) => ({ item: p, r: estadoPagoPoliza(p) }))
    : state.data.expedientes.filter((x) => x.estado !== 'Cancelado').map((x) => ({ item: x, r: estadoPagoExp(x) }));
  const pendientes = items.filter((x) => x.r.saldo > 0).sort((a, b) => b.r.saldo - a.r.saldo);
  const mes = today().slice(0, 7);
  const pagosMes = state.data.pagos.filter((x) => (x.fecha || '').startsWith(mes));
  const recientes = [...state.data.pagos].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, 15);
  el.innerHTML = `
    <div class="kpis">
      <div class="kpi"><div class="v">${money(sumaMontos(pagosMes))}</div><div class="l">Cobrado este mes (${pagosMes.length} pagos)</div></div>
      <div class="kpi"><div class="v">${money(pendientes.reduce((s, x) => s + x.r.saldo, 0))}</div><div class="l">Saldo pendiente total</div></div>
      <div class="kpi"><div class="v">${pendientes.length}</div><div class="l">${seg ? 'Pólizas' : 'Expedientes'} con saldo</div></div>
    </div>
    <div class="card table-wrap"><h3>Pendientes de cobro</h3><table><thead><tr><th>Cliente</th><th>${seg ? 'Póliza' : 'Trámite'}</th><th>Total</th><th>Pagado</th><th>Saldo</th><th></th></tr></thead><tbody>
      ${pendientes.map(({ item, r }) => `<tr><td><b>${esc(clienteNombre(item.cliente_id))}</b></td>
        <td>${seg ? `${asegLogo(item.aseguradora)}<div class="muted">${esc(item.ramo)} · ${esc(textoPago(item))}</div>` : esc(item.tramite)}</td>
        <td>${money(r.total)}</td><td>${money(r.pagado)}</td><td>${pagoBadge(r)}</td>
        <td style="white-space:nowrap"><button class="btn sm" data-cobrar="${item.id}">+ Pago</button> <button class="btn wa sm" data-wa="${item.id}">WhatsApp</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">¡Todo cobrado! 🎉</td></tr>'}
    </tbody></table></div>
    <div class="card"><h3>Últimos pagos recibidos</h3>${recientes.map((pg) => `<div class="list-item click" data-pago="${pg.id}"><div><b>${money(pg.monto)}</b> · ${esc(clienteNombre(pg.cliente_id))}<div class="muted">${fmtDate(pg.fecha)} ${pg.metodo ? '· ' + esc(pg.metodo) : ''} ${pg.referencia ? '· Ref. ' + esc(pg.referencia) : ''}</div></div><span style="display:flex;gap:6px;align-items:center">${state.perfil === 'byc' ? `<button class="btn sec sm" data-recibo="${pg.id}">🧾 Recibo</button>` : ''}<span class="muted">Editar</span></span></div>`).join('') || '<div class="empty">Aún no hay pagos</div>'}</div>`;
  const lista = seg ? state.data.polizas : state.data.expedientes;
  el.querySelectorAll('[data-cobrar]').forEach((b) => (b.onclick = () => registrarPago(tipo, lista.find((x) => x.id === b.dataset.cobrar))));
  el.querySelectorAll('[data-wa]').forEach((b) => (b.onclick = () => {
    const item = lista.find((x) => x.id === b.dataset.wa);
    abrirWhatsApp({ cliente: state.data.clientes.find((c) => c.id === item.cliente_id), [seg ? 'poliza' : 'expediente']: item, plantilla: seg ? 'Recordatorio de pago' : 'Recordatorio de saldo' });
  }));
  bindPagos(el);
}
