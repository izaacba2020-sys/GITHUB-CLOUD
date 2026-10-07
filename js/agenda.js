/* Agenda: calendario (mes / semana / lista) con tareas, citas, audiencias, seguimientos de prospectos,
   fechas límite de expedientes, renovaciones de pólizas y cumpleaños. */
const TIPOS_EVENTO = {
  Cita: { ico: '📅', cls: 'ev-cita' }, Audiencia: { ico: '⚖️', cls: 'ev-audiencia' }, Plazo: { ico: '⏳', cls: 'ev-audiencia' },
  Firma: { ico: '✍️', cls: 'ev-cita' }, Llamada: { ico: '📞', cls: 'ev-tarea' }, WhatsApp: { ico: '💬', cls: 'ev-tarea' },
  Seguimiento: { ico: '🎯', cls: 'ev-seguimiento' }, Cobro: { ico: '💵', cls: 'ev-tarea' }, Renovación: { ico: '🔄', cls: 'ev-limite' },
  Otro: { ico: '•', cls: 'ev-tarea' }, Límite: { ico: '⏰', cls: 'ev-limite' }, Cumpleaños: { ico: '🎂', cls: 'ev-cumple' },
};
const fechaISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const horaLocal = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const sumarDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// Todos los eventos entre dos fechas (YYYY-MM-DD, inclusive).
function eventosAgenda(desde, hasta) {
  const ev = [];
  const dentro = (f) => f && f >= desde && f <= hasta;
  for (const t of state.data.tareas) {
    const f = t.fecha && fechaISO(new Date(t.fecha));
    if (!dentro(f)) continue;
    const exp = t.expediente_id && state.data.expedientes.find((x) => x.id === t.expediente_id);
    ev.push({ fecha: f, hora: horaLocal(t.fecha), tipo: t.tipo || 'Otro', titulo: t.titulo, hecho: t.hecho,
      sub: [t.cliente_id && clienteNombre(t.cliente_id), exp && exp.tramite].filter(Boolean).join(' · '),
      abrir: () => editar('tareas', t), tarea: t });
  }
  for (const p of state.data.prospectos) {
    if (['Ganado', 'Perdido'].includes(p.etapa) || !dentro(p.seguimiento)) continue;
    ev.push({ fecha: p.seguimiento, tipo: 'Seguimiento', titulo: p.titulo, sub: p.cliente_id ? clienteNombre(p.cliente_id) : p.contacto || '', abrir: () => editar('prospectos', p) });
  }
  if (state.perfil === 'byc') {
    for (const x of state.data.expedientes) {
      if (['Entregado', 'Cancelado'].includes(x.estado) || !dentro(x.fecha_limite)) continue;
      ev.push({ fecha: x.fecha_limite, tipo: 'Límite', titulo: `Fecha límite: ${x.tramite}`, sub: clienteNombre(x.cliente_id), abrir: () => editar('expedientes', x) });
    }
  } else {
    for (const p of state.data.polizas) {
      if (p.estado !== 'Vigente' || !dentro(p.fin)) continue;
      ev.push({ fecha: p.fin, tipo: 'Renovación', titulo: `Vence ${p.ramo} · ${p.aseguradora}`, sub: clienteNombre(p.cliente_id), abrir: () => fichaPoliza(p.id) });
    }
  }
  const y0 = Number(desde.slice(0, 4)), y1 = Number(hasta.slice(0, 4));
  for (const c of state.data.clientes) {
    if (!c.fecha_nacimiento) continue;
    for (let y = y0; y <= y1; y++) {
      const f = `${y}${c.fecha_nacimiento.slice(4)}`;
      if (dentro(f)) ev.push({ fecha: f, tipo: 'Cumpleaños', titulo: `Cumpleaños de ${c.nombre}`, sub: c.telefono ? 'Toca para felicitar por WhatsApp' : '', abrir: () => (c.telefono ? abrirWhatsApp({ cliente: c, plantilla: 'Cumpleaños' }) : fichaCliente(c.id)) });
    }
  }
  return ev.sort((a, b) => (a.fecha + (a.hora || '00:00') > b.fecha + (b.hora || '00:00') ? 1 : -1));
}

function chipEvento(e, i) {
  const t = TIPOS_EVENTO[e.tipo] || TIPOS_EVENTO.Otro;
  return `<div class="ev ${t.cls} ${e.hecho ? 'ev-hecho' : ''}" data-ev="${i}" title="${esc(e.tipo)}: ${esc(e.titulo)}${e.sub ? ' — ' + esc(e.sub) : ''}">${t.ico} ${e.hora && e.hora !== '00:00' ? `<b>${e.hora}</b> ` : ''}${esc(e.titulo)}</div>`;
}

function filaEvento(e, i) {
  const t = TIPOS_EVENTO[e.tipo] || TIPOS_EVENTO.Otro;
  const atrasada = e.tarea && !e.hecho && e.fecha < today();
  return `<div class="list-item ev-fila ${e.hecho ? 'ev-hecho' : ''}">
    <div style="display:flex;gap:10px;align-items:flex-start;min-width:0">
      ${e.tarea ? `<input type="checkbox" style="width:auto;margin-top:3px" data-hecho="${e.tarea.id}" ${e.hecho ? 'checked' : ''}>` : `<span style="width:16px;text-align:center">${t.ico}</span>`}
      <div class="click" data-ev="${i}" style="min-width:0"><b>${e.hora && e.hora !== '00:00' ? e.hora + ' · ' : ''}${esc(e.titulo)}</b> <span class="badge ${t.cls}">${esc(e.tipo)}</span>
        ${e.sub ? `<div class="muted">${esc(e.sub)}</div>` : ''}</div></div>
    ${atrasada ? '<span class="badge bad">Atrasada</span>' : ''}</div>`;
}

function vAgenda(el) {
  state.agenda ||= { modo: innerWidth < 800 ? 'lista' : 'mes', ref: today() };
  const A = state.agenda;
  const ref = new Date(A.ref + 'T12:00');
  let desde, hasta, titulo;
  if (A.modo === 'mes') {
    const ini = new Date(ref.getFullYear(), ref.getMonth(), 1, 12);
    desde = sumarDias(ini, -((ini.getDay() + 6) % 7));
    hasta = sumarDias(desde, 41);
    titulo = ini.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
  } else if (A.modo === 'semana') {
    desde = sumarDias(ref, -((ref.getDay() + 6) % 7));
    hasta = sumarDias(desde, 6);
    titulo = `${desde.toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })} – ${hasta.toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  } else {
    desde = new Date(today() + 'T12:00'); hasta = sumarDias(desde, 30);
    titulo = 'Próximos 30 días';
  }
  const D = fechaISO(desde), H = fechaISO(hasta);
  const eventos = eventosAgenda(D, H);
  const atrasadas = A.modo === 'lista' ? state.data.tareas.filter((t) => !t.hecho && t.fecha && fechaISO(new Date(t.fecha)) < today()) : [];
  const lista = [...atrasadas.map((t) => ({ fecha: fechaISO(new Date(t.fecha)), hora: horaLocal(t.fecha), tipo: t.tipo || 'Otro', titulo: t.titulo, sub: t.cliente_id ? clienteNombre(t.cliente_id) : '', abrir: () => editar('tareas', t), tarea: t })), ...eventos];

  let cuerpo = '';
  if (A.modo === 'lista') {
    const grupos = {};
    lista.forEach((e, i) => { const k = e.fecha < today() ? 'atrasadas' : e.fecha; (grupos[k] ||= []).push([e, i]); });
    const nombreDia = (k) => (k === 'atrasadas' ? '⚠️ Atrasadas' : k === today() ? 'Hoy' : k === fechaISO(sumarDias(new Date(today() + 'T12:00'), 1)) ? 'Mañana'
      : new Date(k + 'T12:00').toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' }));
    cuerpo = Object.keys(grupos).sort((a, b) => (a === 'atrasadas' ? -1 : b === 'atrasadas' ? 1 : a > b ? 1 : -1))
      .map((k) => `<div class="card"><h3>${(nombreDia(k)).charAt(0).toUpperCase() + nombreDia(k).slice(1)}</h3>${grupos[k].map(([e, i]) => filaEvento(e, i)).join('')}</div>`).join('')
      || '<div class="card empty">Nada en la agenda para los próximos 30 días 🎉</div>';
  } else {
    const dias = [];
    for (let d = new Date(desde); fechaISO(d) <= H; d = sumarDias(d, 1)) dias.push(fechaISO(d));
    const mesRef = ref.getMonth();
    const max = A.modo === 'mes' ? 3 : 50;
    cuerpo = `<div class="cal ${A.modo === 'semana' ? 'cal-semana' : ''}">
      ${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => `<div class="cal-h">${d}</div>`).join('')}
      ${dias.map((f) => {
        const evs = lista.map((e, i) => [e, i]).filter(([e]) => e.fecha === f);
        const dt = new Date(f + 'T12:00');
        return `<div class="cal-d ${f === today() ? 'hoy' : ''} ${A.modo === 'mes' && dt.getMonth() !== mesRef ? 'fuera' : ''}" data-dia="${f}">
          <div class="cal-n">${A.modo === 'semana' ? dt.toLocaleDateString('es-GT', { day: 'numeric', month: 'short' }) : dt.getDate()}</div>
          ${evs.slice(0, max).map(([e, i]) => chipEvento(e, i)).join('')}
          ${evs.length > max ? `<div class="ev-mas" data-diamas="${f}">+${evs.length - max} más</div>` : ''}</div>`;
      }).join('')}</div>`;
  }

  el.innerHTML = `
    <div class="top agenda-top">
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        ${A.modo !== 'lista' ? '<button class="btn sec sm" id="ag-prev">‹</button><button class="btn sec sm" id="ag-hoy">Hoy</button><button class="btn sec sm" id="ag-next">›</button>' : ''}
        <h2 style="margin:0 6px;font-size:18px">${titulo.charAt(0).toUpperCase() + titulo.slice(1)}</h2>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <div class="seg" id="ag-modo">${[['mes', 'Mes'], ['semana', 'Semana'], ['lista', 'Lista']].map(([k, l]) => `<button class="${A.modo === k ? 'on' : ''}" data-k="${k}">${l}</button>`).join('')}</div>
        <button class="btn" id="nuevo">+ Cita / tarea</button>
      </div>
    </div>
    <div class="ev-leyenda muted">📅 Cita · ⚖️ Audiencia/plazo · 🎯 Seguimiento de prospecto · ${state.perfil === 'byc' ? '⏰ Fecha límite de expediente' : '🔄 Vencimiento de póliza'} · 🎂 Cumpleaños${A.modo !== 'lista' ? ' · <i>Toca un día vacío para agendar</i>' : ''}</div>
    ${cuerpo}`;

  const mover = (n) => {
    const r = new Date(A.ref + 'T12:00');
    if (A.modo === 'mes') r.setMonth(r.getMonth() + n, 1); else r.setDate(r.getDate() + 7 * n);
    A.ref = fechaISO(r); vAgenda(el);
  };
  if ($('#ag-prev')) { $('#ag-prev').onclick = () => mover(-1); $('#ag-next').onclick = () => mover(1); $('#ag-hoy').onclick = () => { A.ref = today(); vAgenda(el); }; }
  document.querySelectorAll('#ag-modo button').forEach((b) => (b.onclick = () => { A.modo = b.dataset.k; vAgenda(el); }));
  const nueva = (f) => editar('tareas', {}, { fecha: new Date(`${f || today()}T09:00`).toISOString(), tipo: 'Cita' });
  $('#nuevo').onclick = () => nueva();
  el.querySelectorAll('[data-ev]').forEach((x) => (x.onclick = (ev) => { ev.stopPropagation(); lista[x.dataset.ev].abrir(); }));
  el.querySelectorAll('[data-dia]').forEach((x) => (x.onclick = () => nueva(x.dataset.dia)));
  el.querySelectorAll('[data-diamas]').forEach((x) => (x.onclick = (ev) => {
    ev.stopPropagation();
    const f = x.dataset.diamas;
    const tit = new Date(f + 'T12:00').toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' });
    openModal(`<h2>${tit.charAt(0).toUpperCase() + tit.slice(1)}</h2>
      ${lista.map((e, i) => [e, i]).filter(([e]) => e.fecha === f).map(([e, i]) => filaEvento(e, i)).join('')}
      <div class="actions"><button class="btn sec" id="cerrar">Cerrar</button><button class="btn" id="nueva-dia">+ Cita / tarea este día</button></div>`);
    $('#cerrar').onclick = closeModal;
    $('#nueva-dia').onclick = () => nueva(f);
    $('#modal-box').querySelectorAll('[data-ev]').forEach((y) => (y.onclick = () => lista[y.dataset.ev].abrir()));
    bindTareas($('#modal-box'));
  }));
  bindTareas(el);
}
