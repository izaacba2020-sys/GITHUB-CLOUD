/* B&C: prospectos (ganado / perdido), cotización y recibo en PDF, bitácora, requisitos editables,
   configuración y venta cruzada hacia Seguros. Los PDF se generan en el navegador y no se guardan. */

// ---------- Configuración (tabla config: clave -> valor) ----------
const cfgGet = (clave, def) => (state.config && state.config[clave] !== undefined ? state.config[clave] : def);

async function cfgSet(clave, valor) {
  const row = { perfil: state.perfil, clave, valor, created_by: state.user.email };
  if (DEMO) {
    const rows = db._local('config').filter((r) => !(r.perfil === row.perfil && r.clave === clave));
    db._saveLocal('config', [...rows, { ...row, id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
  } else {
    const { error } = await sb.from('config').upsert(row, { onConflict: 'perfil,clave' });
    if (error) { dbError(error); throw error; }
  }
  state.config[clave] = valor;
}

const checklistDe = (tramite) => (cfgGet('checklists', null) || CAT.checklists)[tramite] || CAT.checklists[tramite] || [];

function datosEmpresa() {
  const def = state.perfil === 'byc'
    ? { nombre: 'B&C Abogados y Notarios', direccion: '', telefono: '', correo: '', nit: '', firma: '', pie: '' }
    : { nombre: 'Agencia Independiente de Seguros y Fianzas Bobadilla', direccion: '', telefono: '', correo: '', nit: '', firma: '', pie: '' };
  return { ...def, ...(cfgGet('empresa', {}) || {}) };
}

// ---------- Prospectos ----------
async function ganarProspecto(p) {
  await db.save('prospectos', { ...p, etapa: 'Ganado' }, `${p.titulo} → Ganado`);
  const seg = state.perfil === 'seguros';
  if (!confirm(`¡Ganado! 🎉\n¿${p.cliente_id ? '' : 'Registrar como cliente y '}abrir su ${seg ? 'póliza' : 'expediente'} con los datos del prospecto?`)) return render();
  let clienteId = p.cliente_id;
  if (!clienteId) {
    const [c] = await db.insertMany('clientes', [{ nombre: p.contacto || p.titulo, telefono: p.telefono || null }]);
    await db.log('creó', 'cliente', `${c.nombre} (desde prospecto)`);
    state.data.clientes.push(c);
    clienteId = c.id;
    await db.save('prospectos', { ...p, etapa: 'Ganado', cliente_id: clienteId }, false);
  }
  const pre = seg
    ? { cliente_id: clienteId, ramo: CAT.ramos.includes(p.servicio) ? p.servicio : '', prima: p.monto || '' }
    : { cliente_id: clienteId, tramite: CAT.tramites.includes(p.servicio) ? p.servicio : '', honorarios: p.monto || '', descripcion: p.titulo };
  editar(seg ? 'polizas' : 'expedientes', {}, pre);
}

function perderProspecto(p) {
  formModal({
    titulo: `Prospecto perdido · ${p.titulo}`,
    campos: [
      { k: 'motivo_perdida', label: '¿Por qué se perdió?', type: 'select', options: CAT.motivosPerdida, req: true },
      { k: 'detalle', label: 'Comentario (opcional)', full: true },
    ],
    data: {},
    onSave: async (out) => {
      const nota = `[${fmtDate(today())}] Perdido: ${out.motivo_perdida}${out.detalle ? ' — ' + out.detalle : ''}`;
      await db.save('prospectos', { ...p, etapa: 'Perdido', motivo_perdida: out.motivo_perdida, notas: [p.notas, nota].filter(Boolean).join('\n') }, `${p.titulo} → Perdido (${out.motivo_perdida})`);
    },
  });
}

function prospectosPorSeguir() {
  return state.data.prospectos.filter((p) => !['Ganado', 'Perdido'].includes(p.etapa) && p.seguimiento && p.seguimiento <= today())
    .sort((a, b) => (a.seguimiento > b.seguimiento ? 1 : -1));
}

function seguimientoItem(p) {
  const d = daysUntil(p.seguimiento);
  return `<div class="list-item click" data-prosp="${p.id}"><div>🎯 <b>${esc(p.titulo)}</b> <span class="badge">${esc(p.etapa || 'Nuevo')}</span>
    <div class="muted">${esc(p.cliente_id ? clienteNombre(p.cliente_id) : p.contacto || '')}${p.telefono ? ' · ' + esc(p.telefono) : ''}</div></div>
    ${d < 0 ? `<span class="badge bad">Hace ${-d} d</span>` : '<span class="badge warn">Hoy</span>'}</div>`;
}

function bindSeguimientos(root) {
  root.querySelectorAll('[data-prosp]').forEach((x) => (x.onclick = () => editar('prospectos', state.data.prospectos.find((p) => p.id === x.dataset.prosp))));
}

// ---------- Venta cruzada B&C -> Seguros ----------
async function ofrecerVentaCruzada(exp) {
  const vc = CAT.ventaCruzada[exp.tramite];
  const c = state.data.clientes.find((x) => x.id === exp.cliente_id);
  if (!vc || !c) return;
  if (!confirm(`💡 ${c.nombre} podría necesitar un ${vc.texto}.\n\n¿Crear un prospecto en Seguros Bobadilla para ofrecérselo?`)) return;
  const seg = new Date(today() + 'T12:00'); seg.setDate(seg.getDate() + 3);
  await db.save('prospectos', {
    perfil: 'seguros', titulo: `🤝 Referido B&C: ofrecer ${vc.texto}`, contacto: c.nombre, telefono: c.telefono || null,
    servicio: vc.ramo, etapa: 'Nuevo', seguimiento: seg.toISOString().slice(0, 10),
    notas: `Cliente de B&C · ${exp.tramite}${exp.descripcion ? ': ' + exp.descripcion : ''}.`,
  }, `en Seguros: ofrecer ${vc.texto} a ${c.nombre}`);
  toast('Prospecto creado en Seguros Bobadilla');
}

// ---------- Bitácora del expediente ----------
function bitacoraDe(expId) {
  return (state.data.bitacora || []).filter((b) => b.expediente_id === expId).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : a.created_at < b.created_at ? 1 : -1));
}

function abrirBitacora(x) {
  const pinta = () => {
    const items = bitacoraDe(x.id);
    openModal(`
      <h2>📝 Bitácora · ${esc(x.tramite)} · ${esc(clienteNombre(x.cliente_id))}</h2>
      <div class="form"><div><label>Fecha</label><input type="date" id="bit-fecha" value="${today()}"></div>
        <div class="full"><label>¿Qué pasó?</label><textarea id="bit-texto" placeholder="Ej.: Se presentó memorial en el juzgado; el cliente trajo su DPI…"></textarea></div></div>
      <div class="actions" style="margin-top:8px"><button class="btn" id="bit-add">+ Agregar a la bitácora</button></div>
      <div style="margin-top:12px">${items.map((b) => `<div class="list-item"><div><b>${fmtDate(b.fecha)}</b> <span class="muted">· ${esc((b.created_by || '').split('@')[0])}</span><div class="pl-txt" style="-webkit-line-clamp:unset">${esc(b.texto)}</div></div>
        <button class="btn sec sm" data-delbit="${b.id}" title="Eliminar">✕</button></div>`).join('') || '<div class="empty">Aún no hay anotaciones</div>'}</div>
      <div class="actions"><button class="btn sec" id="cerrar">Cerrar</button></div>`);
    $('#cerrar').onclick = () => { closeModal(); render(); };
    $('#bit-add').onclick = async () => {
      const texto = $('#bit-texto').value.trim();
      if (!texto) return toast('Escribe qué pasó');
      const [row] = await db.insertMany('bitacora', [{ expediente_id: x.id, cliente_id: x.cliente_id, fecha: $('#bit-fecha').value || today(), texto }]);
      await db.log('anotó', 'bitácora', `${x.tramite} · ${clienteNombre(x.cliente_id)}: ${texto.slice(0, 80)}`);
      state.data.bitacora.push(row);
      pinta();
    };
    document.querySelectorAll('[data-delbit]').forEach((bt) => (bt.onclick = async () => {
      if (!confirm('¿Eliminar esta anotación?')) return;
      await db.remove('bitacora', bt.dataset.delbit, `anotación de ${x.tramite} · ${clienteNombre(x.cliente_id)}`);
      state.data.bitacora = state.data.bitacora.filter((b) => b.id !== bt.dataset.delbit);
      pinta();
    }));
  };
  pinta();
}

// ---------- Requisitos de un expediente ----------
function editarRequisitos(x) {
  const cl = x.checklist || [];
  openModal(`
    <h2>✎ Requisitos · ${esc(x.tramite)} · ${esc(clienteNombre(x.cliente_id))}</h2>
    <p class="muted">Un requisito por línea. Los que ya estaban marcados se conservan.</p>
    <textarea id="req-txt" style="min-height:220px">${esc(cl.map((i) => i.t).join('\n'))}</textarea>
    <div class="actions"><button class="btn sec" id="req-def">Restablecer los del trámite</button><button class="btn sec" id="cancel">Cancelar</button><button class="btn" id="ok">Guardar</button></div>`);
  $('#cancel').onclick = closeModal;
  $('#req-def').onclick = () => { $('#req-txt').value = checklistDe(x.tramite).join('\n'); };
  $('#ok').onclick = async () => {
    const hechos = new Set(cl.filter((i) => i.ok).map((i) => i.t.trim().toLowerCase()));
    const nuevo = $('#req-txt').value.split('\n').map((t) => t.trim()).filter(Boolean).map((t) => ({ t, ok: hechos.has(t.toLowerCase()) }));
    await db.save('expedientes', { ...x, checklist: nuevo }, `requisitos de ${x.tramite} · ${clienteNombre(x.cliente_id)}`);
    closeModal(); toast('Requisitos actualizados'); render();
  };
}

// ---------- Configuración ----------
function vConfiguracion(el) {
  const e = datosEmpresa();
  const byc = state.perfil === 'byc';
  const cot = { ...CAT.cotizacion, ...(cfgGet('cotizacion', {}) || {}) };
  const checks = cfgGet('checklists', null) || CAT.checklists;
  el.innerHTML = `
    <div class="card"><h3>Datos que salen en cotizaciones y recibos</h3>
      <div class="form" id="f-emp">
        <div class="full"><label>Nombre</label><input name="nombre" value="${esc(e.nombre)}"></div>
        <div class="full"><label>Dirección</label><input name="direccion" value="${esc(e.direccion)}"></div>
        <div><label>Teléfono(s)</label><input name="telefono" value="${esc(e.telefono)}"></div>
        <div><label>Correo</label><input name="correo" value="${esc(e.correo)}"></div>
        <div><label>NIT</label><input name="nit" value="${esc(e.nit)}"></div>
        <div><label>Nombre de quien firma</label><input name="firma" value="${esc(e.firma)}" placeholder="Ej.: Licda. …"></div>
        <div class="full"><label>Texto al pie (opcional)</label><input name="pie" value="${esc(e.pie)}"></div>
      </div>
      ${byc ? `<h3 style="margin-top:16px">Textos de la cotización</h3>
      <div class="form" id="f-cot">
        <div class="full"><label>Forma de pago (por defecto)</label><textarea name="formaPago">${esc(cot.formaPago)}</textarea></div>
        <div class="full"><label>Condiciones</label><textarea name="condiciones">${esc(cot.condiciones)}</textarea></div>
        <div><label>Validez (días)</label><input type="number" name="validez" value="${esc(cot.validez)}"></div>
      </div>` : ''}
      <div class="actions"><button class="btn" id="g-emp">Guardar</button></div></div>
    ${byc ? `<div class="card"><h3>Requisitos por tipo de trámite</h3>
      <p class="muted">Se copian a cada expediente nuevo y a las cotizaciones. Un requisito por línea.</p>
      <div class="form">${CAT.tramites.map((t) => `<div><label>${esc(t)}</label><textarea data-tram="${esc(t)}" style="min-height:120px">${esc((checks[t] || CAT.checklists[t] || []).join('\n'))}</textarea></div>`).join('')}</div>
      <div class="actions"><button class="btn" id="g-req">Guardar requisitos</button></div></div>` : ''}`;
  $('#g-emp').onclick = async () => {
    const leer = (sel) => Object.fromEntries([...document.querySelectorAll(`${sel} [name]`)].map((i) => [i.name, i.value.trim()]));
    try {
      await cfgSet('empresa', leer('#f-emp'));
      if (byc) { const c = leer('#f-cot'); c.validez = Number(c.validez) || 15; await cfgSet('cotizacion', c); }
      toast('Configuración guardada');
    } catch { /* ya notificado */ }
  };
  if (byc) $('#g-req').onclick = async () => {
    const out = {};
    document.querySelectorAll('[data-tram]').forEach((t) => { out[t.dataset.tram] = t.value.split('\n').map((x) => x.trim()).filter(Boolean); });
    try { await cfgSet('checklists', out); toast('Requisitos guardados'); } catch { /* ya notificado */ }
  };
}

// ---------- Número a letras (para recibos y cotizaciones) ----------
function numeroALetras(n) {
  const U = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  const D = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const C = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  const menor1000 = (x) => {
    if (x === 0) return '';
    if (x === 100) return 'cien';
    const c = Math.floor(x / 100), r = x % 100;
    const dec = r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' y ' + U[r % 10] : '');
    return [C[c], dec].filter(Boolean).join(' ');
  };
  const entero = Math.floor(Math.round(n * 100) / 100), cent = Math.round((n - entero) * 100);
  let txt;
  if (entero === 0) txt = 'cero';
  else {
    const mill = Math.floor(entero / 1e6), miles = Math.floor((entero % 1e6) / 1000), resto = entero % 1000;
    txt = [
      mill ? (mill === 1 ? 'un millón' : menor1000(mill).replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un') + ' millones') + (entero % 1e6 === 0 ? ' de' : '') : '',
      miles ? (miles === 1 ? 'mil' : menor1000(miles).replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un') + ' mil') : '',
      menor1000(resto),
    ].filter(Boolean).join(' ');
  }
  txt = txt.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');
  return `${txt} ${entero === 1 ? 'quetzal' : 'quetzales'} con ${String(cent).padStart(2, '0')}/100`;
}

// ---------- PDF ----------
function cargarJsPDF() {
  if (window.jspdf) return Promise.resolve();
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = ok;
    s.onerror = () => { toast('No se pudo cargar el generador de PDF. Revisa tu conexión.'); fail(); };
    document.head.appendChild(s);
  });
}

async function imagenDataURL(src) {
  const blob = await (await fetch(src)).blob();
  return new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
}

const DORADO = [194, 155, 87], TINTA = [30, 30, 30], GRIS = [110, 110, 110];

// Encabezado con logo y datos; devuelve la posición Y donde sigue el contenido.
async function pdfEncabezado(doc, titulo, subtitulo) {
  const e = datosEmpresa();
  const W = doc.internal.pageSize.getWidth();
  try {
    const logo = await imagenDataURL(PERFILES[state.perfil].logo);
    const p = doc.getImageProperties(logo);
    const h = 24, w = Math.min(50, (p.width / p.height) * h);
    doc.addImage(logo, 'PNG', 18, 14, w, (w / p.width) * p.height);
  } catch { /* sin logo */ }
  doc.setTextColor(...TINTA); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text(e.nombre, W - 18, 18, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
  let y = 23;
  [e.direccion, [e.telefono && 'Tel. ' + e.telefono, e.correo].filter(Boolean).join(' · '), e.nit && 'NIT ' + e.nit].filter(Boolean)
    .forEach((l) => { doc.splitTextToSize(l, 90).forEach((ln) => { doc.text(ln, W - 18, y, { align: 'right' }); y += 4.5; }); });
  y = Math.max(y, 44);
  doc.setDrawColor(...DORADO); doc.setLineWidth(0.8); doc.line(18, y, W - 18, y);
  doc.setTextColor(...TINTA); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text(titulo, W / 2, y + 11, { align: 'center' });
  if (subtitulo) { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...GRIS); doc.text(subtitulo, W / 2, y + 17, { align: 'center' }); }
  return y + 26;
}

function pdfPie(doc) {
  const e = datosEmpresa();
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...DORADO); doc.setLineWidth(0.4); doc.line(18, H - 18, W - 18, H - 18);
  doc.setFontSize(8); doc.setTextColor(...GRIS); doc.setFont('helvetica', 'normal');
  doc.text(e.pie || e.nombre, W / 2, H - 12, { align: 'center' });
}

function pdfFirma(doc, y) {
  const e = datosEmpresa();
  const W = doc.internal.pageSize.getWidth();
  y = Math.max(y + 18, 230);
  doc.setDrawColor(...TINTA); doc.setLineWidth(0.3); doc.line(W / 2 - 40, y, W / 2 + 40, y);
  doc.setFontSize(10); doc.setTextColor(...TINTA);
  doc.text(e.firma || e.nombre, W / 2, y + 5, { align: 'center' });
  if (e.firma) { doc.setFontSize(9); doc.setTextColor(...GRIS); doc.text(e.nombre, W / 2, y + 10, { align: 'center' }); }
}

// Escribe "Etiqueta: valor" con salto de línea automático.
function pdfCampo(doc, y, etiqueta, valor, ancho = 174) {
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TINTA);
  doc.text(etiqueta, 18, y);
  doc.setFont('helvetica', 'normal');
  const lines = doc.splitTextToSize(String(valor || '—'), ancho - 38);
  doc.text(lines, 56, y);
  return y + Math.max(1, lines.length) * 5 + 2;
}

function pdfParrafo(doc, y, titulo, texto) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DORADO); doc.text(titulo, 18, y);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TINTA);
  const lines = doc.splitTextToSize(texto, W - 36);
  doc.text(lines, 18, y + 6);
  return y + 6 + lines.length * 5 + 4;
}

const archivo = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');

// ---------- Cotización ----------
// desde: { prospecto } o { expediente }
function abrirCotizacion({ prospecto, expediente }) {
  const cot = { ...CAT.cotizacion, ...(cfgGet('cotizacion', {}) || {}) };
  const c = state.data.clientes.find((x) => x.id === (prospecto?.cliente_id || expediente?.cliente_id)) || {};
  const tramite = expediente?.tramite || (CAT.tramites.includes(prospecto?.servicio) ? prospecto.servicio : '');
  const data = {
    para: c.nombre || prospecto?.contacto || '',
    telefono: c.telefono || prospecto?.telefono || '',
    servicio: tramite,
    descripcion: expediente?.descripcion || prospecto?.titulo || '',
    honorarios: expediente?.honorarios || prospecto?.monto || '',
    formaPago: cot.formaPago,
    requisitos: (tramite ? checklistDe(tramite) : []).join('\n'),
    condiciones: cot.condiciones,
    validez: cot.validez,
  };
  formModal({
    titulo: '📄 Cotización de honorarios',
    campos: [
      { k: 'para', label: 'Para (cliente)', req: true },
      { k: 'telefono', label: 'Teléfono', type: 'tel' },
      { k: 'servicio', label: 'Servicio / trámite', req: true },
      { k: 'honorarios', label: 'Honorarios (Q)', type: 'number', req: true },
      { k: 'descripcion', label: 'Descripción del servicio', type: 'textarea', full: true },
      { k: 'formaPago', label: 'Forma de pago', type: 'textarea', full: true },
      { k: 'requisitos', label: 'Requisitos / documentos a presentar (uno por línea)', type: 'textarea', full: true },
      { k: 'condiciones', label: 'Condiciones', type: 'textarea', full: true },
      { k: 'validez', label: 'Validez (días)', type: 'number' },
    ],
    data,
    onSave: async (out) => {
      await generarCotizacionPDF(out);
      if (prospecto) {
        const etapa = ['Nuevo', 'Contactado', 'Cita'].includes(prospecto.etapa || 'Nuevo') ? 'Propuesta / Cotización' : prospecto.etapa;
        const nota = `[${fmtDate(today())}] Cotización enviada: ${money(out.honorarios)}`;
        await db.save('prospectos', { ...prospecto, etapa, monto: out.honorarios, notas: [prospecto.notas, nota].filter(Boolean).join('\n') }, `cotización ${money(out.honorarios)} · ${prospecto.titulo}`);
      } else await db.log('generó', 'cotización', `${out.servicio} · ${out.para} · ${money(out.honorarios)}`);
      if (out.telefono && confirm('PDF descargado. ¿Abrir WhatsApp para enviárselo? (adjunta el PDF en el chat)')) {
        window.open(waLink(out.telefono, `Buen día ${out.para.split(' ')[0]}, le saluda ${datosEmpresa().nombre}. Le comparto la cotización de honorarios para ${out.servicio}. Quedamos a sus órdenes para cualquier consulta.`), '_blank');
      }
    },
  });
  $('#ok').textContent = '⬇ Descargar PDF';
  $('textarea[name=requisitos]').style.minHeight = '120px';
}

async function generarCotizacionPDF(o) {
  await cargarJsPDF();
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  let y = await pdfEncabezado(doc, 'COTIZACIÓN DE HONORARIOS', `Guatemala, ${new Date(today() + 'T12:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })}`);
  y = pdfCampo(doc, y, 'Para:', o.para);
  if (o.telefono) y = pdfCampo(doc, y, 'Teléfono:', o.telefono);
  y = pdfCampo(doc, y, 'Servicio:', o.servicio);
  if (o.descripcion) y = pdfCampo(doc, y, 'Descripción:', o.descripcion);
  y += 3;
  doc.setFillColor(250, 246, 238); doc.setDrawColor(...DORADO); doc.roundedRect(18, y, W - 36, 20, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...GRIS); doc.text('HONORARIOS', 24, y + 7);
  doc.setFontSize(16); doc.setTextColor(...TINTA); doc.text(money(o.honorarios), 24, y + 15);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
  doc.text(doc.splitTextToSize(`(${numeroALetras(Number(o.honorarios))})`, 95), W - 24, y + 9, { align: 'right' });
  y += 28;
  if (o.formaPago) y = pdfParrafo(doc, y, 'Forma de pago', o.formaPago);
  const reqs = String(o.requisitos || '').split('\n').map((t) => t.trim()).filter(Boolean);
  if (reqs.length) {
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DORADO); doc.text('Requisitos / documentos a presentar', 18, y);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TINTA); y += 6;
    reqs.forEach((r) => { const ls = doc.splitTextToSize(r, W - 46); doc.text('•', 22, y); doc.text(ls, 27, y); y += ls.length * 5; });
    y += 4;
  }
  if (o.condiciones) y = pdfParrafo(doc, y, 'Condiciones', o.condiciones);
  doc.setFontSize(9); doc.setTextColor(...GRIS); doc.text(`Cotización válida por ${o.validez || 15} días.`, 18, y + 2);
  pdfFirma(doc, y);
  pdfPie(doc);
  doc.save(`Cotizacion_${archivo(o.para)}_${today()}.pdf`);
}

// ---------- Recibo de pago ----------
function numeroRecibo(pg) {
  if (pg.referencia) return pg.referencia;
  const orden = [...state.data.pagos].sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
  return String(orden.findIndex((x) => x.id === pg.id) + 1).padStart(4, '0');
}

async function generarReciboPDF(pg) {
  await cargarJsPDF();
  const c = state.data.clientes.find((x) => x.id === pg.cliente_id) || {};
  const exp = state.data.expedientes.find((x) => x.id === pg.ref_id);
  const r = exp ? estadoPagoExp(exp) : null;
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  let y = await pdfEncabezado(doc, 'RECIBO DE PAGO', `No. ${numeroRecibo(pg)}`);
  doc.setFillColor(250, 246, 238); doc.setDrawColor(...DORADO); doc.roundedRect(W - 78, y - 4, 60, 14, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...TINTA); doc.text(money(pg.monto), W - 48, y + 5, { align: 'center' });
  y = pdfCampo(doc, y, 'Fecha:', new Date(pg.fecha + 'T12:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' }), 110);
  y = pdfCampo(doc, y, 'Recibimos de:', c.nombre, 110);
  if (c.nit) y = pdfCampo(doc, y, 'NIT:', c.nit, 110);
  y = pdfCampo(doc, y + 2, 'La cantidad de:', numeroALetras(Number(pg.monto)));
  y = pdfCampo(doc, y, 'Por concepto de:', exp ? `Honorarios por ${exp.tramite}${exp.descripcion ? ' — ' + exp.descripcion : ''}` : 'Honorarios profesionales');
  if (pg.metodo) y = pdfCampo(doc, y, 'Forma de pago:', pg.metodo + (pg.referencia ? ` (ref. ${pg.referencia})` : ''));
  if (pg.notas) y = pdfCampo(doc, y, 'Observaciones:', pg.notas);
  if (r) {
    y += 4;
    doc.setDrawColor(225, 225, 225); doc.setLineWidth(0.3); doc.line(18, y, W - 18, y); y += 7;
    y = pdfCampo(doc, y, 'Total honorarios:', money(r.total));
    y = pdfCampo(doc, y, 'Total pagado:', money(r.pagado));
    y = pdfCampo(doc, y, 'Saldo pendiente:', money(r.saldo));
  }
  pdfFirma(doc, y);
  pdfPie(doc);
  doc.save(`Recibo_${numeroRecibo(pg)}_${archivo(c.nombre || 'cliente')}.pdf`);
  db.log('generó', 'recibo', `No. ${numeroRecibo(pg)} · ${c.nombre} · ${money(pg.monto)}`);
}
