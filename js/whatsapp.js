/* Plantillas de WhatsApp y cumpleaños */
const VARIABLES_WA = ['nombre', 'nombre_completo', 'empresa', 'aseguradora', 'ramo', 'poliza', 'vence', 'monto', 'saldo', 'tramite', 'estado', 'pendientes'];

function plantillas() {
  const pls = [...(state.data.plantillas || [])].sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
  return pls.length ? pls : CAT.plantillas[state.perfil].map((p, i) => ({ ...p, id: 'def' + i }));
}

function llenarPlantilla(texto, { cliente = {}, poliza, expediente, monto }) {
  const rp = poliza && estadoPagoPoliza(poliza);
  const rx = expediente && estadoPagoExp(expediente);
  const juridica = cliente.tipo === 'Jurídica';
  const vars = {
    nombre: juridica ? cliente.nombre : (cliente.nombre || '').trim().split(/\s+/)[0],
    nombre_completo: cliente.nombre,
    empresa: PERFILES[state.perfil].nombre,
    aseguradora: poliza?.aseguradora,
    ramo: poliza?.ramo,
    poliza: poliza?.numero,
    vence: poliza?.fin && fmtDate(poliza.fin),
    monto: monto != null ? money(monto) : rp ? money(Math.min(rp.cuota, rp.saldo || rp.cuota)) : rx ? money(rx.saldo) : '',
    saldo: rp ? money(rp.saldo) : rx ? money(rx.saldo) : '',
    tramite: expediente?.tramite,
    estado: expediente?.estado,
    pendientes: expediente ? (expediente.checklist || []).filter((i) => !i.ok).map((i) => '• ' + i.t).join('\n') : '',
  };
  return texto.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] ?? '' : m));
}

// Elige la plantilla más útil según la situación de la póliza o el expediente.
function plantillaSugerida(poliza, expediente) {
  if (poliza) {
    const dias = daysUntil(poliza.fin);
    if (dias !== null && dias <= 60) return 'Recordatorio de renovación';
    if (estadoPagoPoliza(poliza).saldo > 0) return 'Recordatorio de pago';
  }
  if (expediente) {
    if (expediente.estado === 'Listo para entrega') return 'Trámite listo';
    if ((expediente.checklist || []).some((i) => !i.ok) && expediente.estado === CAT.estadosExpediente[0]) return 'Documentos pendientes';
    return 'Avance del trámite';
  }
  return 'Saludo / seguimiento';
}

function abrirWhatsApp({ cliente, poliza, expediente, plantilla, monto }) {
  if (!cliente?.telefono) return toast('Este cliente no tiene teléfono registrado');
  const seg = state.perfil === 'seguros';
  const pls = plantillas();
  const relacionados = (seg ? state.data.polizas : state.data.expedientes).filter((x) => x.cliente_id === cliente.id);
  let rel = poliza || expediente || (relacionados.length === 1 ? relacionados[0] : null);
  const inicial = pls.find((p) => p.nombre === (plantilla || plantillaSugerida(poliza, expediente))) || pls.find((p) => p.nombre === 'Saludo / seguimiento') || pls[0];
  openModal(`
    <h2>WhatsApp a ${esc(cliente.nombre)}</h2>
    <div class="form">
      <div><label>Plantilla</label><select id="wa-pl">${pls.map((p) => `<option value="${p.id}" ${p === inicial ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></div>
      <div><label>${seg ? 'Póliza' : 'Expediente'} relacionado</label><select id="wa-rel"><option value="">— Ninguno —</option>${relacionados.map((x) => `<option value="${x.id}" ${rel?.id === x.id ? 'selected' : ''}>${esc(seg ? `${x.ramo} · ${x.aseguradora}` : `${x.tramite} · ${x.estado}`)}</option>`).join('')}</select></div>
      <div class="full"><label>Mensaje (puedes editarlo antes de enviar)</label><textarea id="wa-txt" style="min-height:170px"></textarea></div>
    </div>
    <p class="muted">📞 ${esc(cliente.telefono)}</p>
    <div class="actions">
      <button class="btn sec" id="wa-cancel">Cancelar</button>
      <button class="btn sec" id="wa-copy">Copiar texto</button>
      <button class="btn wa" id="wa-send">Abrir en WhatsApp</button>
    </div>`);
  const pinta = () => {
    const pl = pls.find((p) => p.id === $('#wa-pl').value);
    rel = relacionados.find((x) => x.id === $('#wa-rel').value) || null;
    $('#wa-txt').value = llenarPlantilla(pl.texto, { cliente, monto, [seg ? 'poliza' : 'expediente']: rel || undefined });
  };
  $('#wa-pl').onchange = pinta;
  $('#wa-rel').onchange = pinta;
  pinta();
  $('#wa-cancel').onclick = closeModal;
  $('#wa-copy').onclick = async () => { try { await navigator.clipboard.writeText($('#wa-txt').value); toast('Texto copiado'); } catch { toast('No se pudo copiar'); } };
  $('#wa-send').onclick = () => {
    const pl = pls.find((p) => p.id === $('#wa-pl').value);
    window.open(waLink(cliente.telefono, $('#wa-txt').value), '_blank');
    db.log('envió WhatsApp', 'cliente', `${pl.nombre} → ${cliente.nombre}`);
    closeModal();
  };
}

// ---------- Cumpleaños ----------
function diasParaCumple(fecha) {
  if (!fecha) return null;
  const [, m, d] = fecha.split('-').map(Number);
  const hoy = new Date(today() + 'T12:00');
  let prox = new Date(hoy.getFullYear(), m - 1, d, 12);
  if (prox < hoy) prox = new Date(hoy.getFullYear() + 1, m - 1, d, 12);
  return Math.round((prox - hoy) / 86400000);
}

function edadQueCumple(fecha) {
  const y = Number(fecha.slice(0, 4));
  const dias = diasParaCumple(fecha);
  const anio = new Date(Date.now() + dias * 86400000).getFullYear();
  return y > 1900 ? anio - y : null;
}

function cumpleanosProximos(dias = 15) {
  return state.data.clientes.map((c) => ({ c, d: diasParaCumple(c.fecha_nacimiento) }))
    .filter((x) => x.d !== null && x.d <= dias).sort((a, b) => a.d - b.d);
}

function tarjetaCumpleanos() {
  const lista = cumpleanosProximos();
  return `<div class="card"><h3>🎂 Cumpleaños próximos (15 días)</h3>${lista.map(({ c, d }) => {
    const edad = edadQueCumple(c.fecha_nacimiento);
    return `<div class="list-item"><div><b>${esc(c.nombre)}</b><div class="muted">${fmtDate(c.fecha_nacimiento).replace(/ \d{4}$/, '')}${edad ? ` · cumple ${edad}` : ''}</div></div>
      <div style="display:flex;gap:6px;align-items:center">${d === 0 ? '<span class="badge ok">¡Hoy!</span>' : `<span class="badge">En ${d} d</span>`}
      ${c.telefono ? `<button class="btn wa sm" data-felicitar="${c.id}">Felicitar</button>` : ''}</div></div>`;
  }).join('') || '<div class="empty">Ninguno en los próximos días. Agrega la fecha de nacimiento en la ficha de cada cliente.</div>'}</div>`;
}

function bindCumpleanos(root) {
  root.querySelectorAll('[data-felicitar]').forEach((b) => (b.onclick = () => abrirWhatsApp({ cliente: state.data.clientes.find((c) => c.id === b.dataset.felicitar), plantilla: 'Cumpleaños' })));
}

// ---------- Vista de plantillas ----------
const CAMPOS_PLANTILLA = [
  { k: 'nombre', label: 'Nombre de la plantilla', req: true, full: true },
  { k: 'texto', label: 'Mensaje', type: 'textarea', req: true, full: true },
];

function editarPlantilla(pl = {}) {
  formModal({
    titulo: pl.id ? 'Editar plantilla' : 'Nueva plantilla',
    campos: CAMPOS_PLANTILLA,
    data: pl,
    onSave: (out) => db.save('plantillas', out, out.nombre),
    onDelete: pl.id ? () => db.remove('plantillas', pl.id, pl.nombre) : null,
  });
  $('#f').insertAdjacentHTML('beforeend', `<div class="full muted">Variables que se reemplazan solas: ${VARIABLES_WA.map((v) => `<code>{${v}}</code>`).join(' ')}</div>`);
  $('textarea[name=texto]').style.minHeight = '160px';
}

function vPlantillas(el) {
  const pls = plantillas();
  el.innerHTML = `<div class="top"><span class="muted">Mensajes listos para enviar por WhatsApp desde la ficha del cliente, las pólizas o los cobros.</span><button class="btn" id="nuevo">+ Nueva plantilla</button></div>
    <div class="aseg-grid">${pls.map((p) => `<div class="card aseg-card" data-pl="${p.id}"><b>${esc(p.nombre)}</b><div class="muted pl-txt">${esc(p.texto)}</div></div>`).join('')}</div>`;
  $('#nuevo').onclick = () => editarPlantilla();
  el.querySelectorAll('[data-pl]').forEach((c) => (c.onclick = () => {
    const pl = pls.find((p) => p.id === c.dataset.pl);
    if (String(pl.id).startsWith('def')) return toast('Las plantillas aún no se guardan: actualiza la base de datos (ver README)');
    editarPlantilla(pl);
  }));
}
