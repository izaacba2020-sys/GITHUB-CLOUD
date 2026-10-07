/* Estadísticas: gráficas interactivas y evolución de la cartera (fotos mensuales) */
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const moneyCorto = (n) => (Math.abs(n) >= 1e6 ? 'Q ' + (n / 1e6).toFixed(1).replace('.0', '') + ' M' : Math.abs(n) >= 1e3 ? 'Q ' + (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace('.0', '') + ' k' : 'Q ' + Math.round(n));
const SVGNS = 'http://www.w3.org/2000/svg';

// ---------- Tooltip (texto con textContent, nunca HTML) ----------
function vizTip() {
  let t = document.getElementById('viz-tip');
  if (!t) { t = document.createElement('div'); t.id = 'viz-tip'; t.className = 'viz-tip hidden'; document.body.appendChild(t); }
  return t;
}
// lineas: [{ valor, texto }] -> valor en negrita, etiqueta secundaria
function mostrarTip(ev, titulo, lineas) {
  const t = vizTip();
  t.replaceChildren();
  const h = document.createElement('div'); h.className = 'viz-tip-t'; h.textContent = titulo; t.appendChild(h);
  for (const l of lineas) {
    const r = document.createElement('div');
    const b = document.createElement('b'); b.textContent = l.valor;
    r.append(b, document.createTextNode(l.texto ? ' ' + l.texto : ''));
    t.appendChild(r);
  }
  t.classList.remove('hidden');
  const x = Math.min(ev.clientX + 14, innerWidth - t.offsetWidth - 8);
  const y = ev.clientY - t.offsetHeight - 12 < 4 ? ev.clientY + 18 : ev.clientY - t.offsetHeight - 12;
  t.style.left = x + 'px'; t.style.top = y + 'px';
}
const ocultarTip = () => vizTip().classList.add('hidden');

function pasoBonito(x) {
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
function marcas(max, entero) {
  let paso = pasoBonito((max || 1) / 4);
  if (entero) paso = Math.max(1, Math.round(paso));
  const out = [];
  for (let v = 0; v < max + paso * 0.999 || out.length < 2; v += paso) out.push(v);
  return out;
}
const svgEl = (tag, attrs, texto) => {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (texto != null) e.textContent = texto;
  return e;
};

function tablaDatos(filas, columnas) {
  const d = document.createElement('details'); d.className = 'viz-tabla';
  const s = document.createElement('summary'); s.textContent = 'Ver tabla'; d.appendChild(s);
  const t = document.createElement('table');
  const hr = t.createTHead().insertRow();
  columnas.forEach((c) => { const th = document.createElement('th'); th.textContent = c; hr.appendChild(th); });
  const tb = t.createTBody();
  filas.forEach((f) => { const r = tb.insertRow(); f.forEach((v) => { r.insertCell().textContent = v; }); });
  d.appendChild(t);
  return d;
}

// ---------- Barras verticales (una serie) ----------
// datos: [{ etiqueta, valor, titulo, lineas }]
function barrasV(el, datos, { fmt = String, entero = false, alto = 230 } = {}) {
  el.replaceChildren();
  const W = Math.max(el.clientWidth || 600, 280), H = alto, m = { t: 20, r: 8, b: 26, l: 52 };
  const max = Math.max(0, ...datos.map((d) => d.valor));
  const ticks = marcas(max, entero), tope = ticks[ticks.length - 1] || 1;
  const iw = W - m.l - m.r, ih = H - m.t - m.b, col = iw / datos.length;
  const bw = Math.max(6, Math.min(44, col * 0.64));
  const y = (v) => m.t + ih - (v / tope) * ih;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'viz', role: 'img' });
  ticks.forEach((t) => {
    svg.appendChild(svgEl('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: t === 0 ? 'viz-base' : 'viz-grid' }));
    svg.appendChild(svgEl('text', { x: m.l - 6, y: y(t) + 4, 'text-anchor': 'end', class: 'viz-eje' }, fmt(t)));
  });
  const iMax = datos.findIndex((d) => d.valor === max && max > 0);
  datos.forEach((d, i) => {
    const cx = m.l + col * i + col / 2, x = cx - bw / 2, top = y(d.valor), h = m.t + ih - top;
    const g = svgEl('g', { class: 'viz-col', tabindex: 0 });
    g.appendChild(svgEl('rect', { x: m.l + col * i, y: m.t, width: col, height: ih, fill: 'transparent' }));
    if (h > 0.5) {
      const r = Math.min(4, h, bw / 2), y0 = m.t + ih;
      g.appendChild(svgEl('path', { class: 'viz-barra', d: `M${x},${y0} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${y0} Z` }));
    }
    if (i === iMax) g.appendChild(svgEl('text', { x: cx, y: top - 6, 'text-anchor': 'middle', class: 'viz-valor' }, fmt(d.valor)));
    if (col >= 30 || i % 2 === 0) g.appendChild(svgEl('text', { x: cx, y: H - 8, 'text-anchor': 'middle', class: 'viz-eje' }, d.etiqueta));
    const tip = (ev) => mostrarTip(ev, d.titulo || d.etiqueta, d.lineas || [{ valor: fmt(d.valor) }]);
    g.addEventListener('pointermove', tip);
    g.addEventListener('pointerleave', ocultarTip);
    g.addEventListener('focus', () => { const b = g.getBoundingClientRect(); tip({ clientX: b.left + b.width / 2, clientY: b.top + 20 }); });
    g.addEventListener('blur', ocultarTip);
    svg.appendChild(g);
  });
  el.appendChild(svg);
  el.appendChild(tablaDatos(datos.map((d) => [d.titulo || d.etiqueta, fmt(d.valor)]), ['', 'Valor']));
}

// ---------- Barras horizontales (una serie, ordenadas) ----------
// filas: [{ etiqueta, logo, valor, lineas }]
function barrasH(el, filas, { fmt = String } = {}) {
  el.replaceChildren();
  const max = Math.max(0, ...filas.map((f) => f.valor)) || 1;
  const cont = document.createElement('div'); cont.className = 'hbars';
  filas.forEach((f) => {
    const row = document.createElement('div'); row.className = 'hbar-row'; row.tabIndex = 0;
    const lab = document.createElement('div'); lab.className = 'hbar-label';
    if (f.logo) { const img = document.createElement('img'); img.src = f.logo; img.alt = ''; img.onerror = () => img.remove(); lab.appendChild(img); }
    lab.appendChild(document.createTextNode(f.etiqueta));
    const track = document.createElement('div'); track.className = 'hbar-track';
    const bar = document.createElement('div'); bar.className = 'hbar'; bar.style.width = (f.valor / max) * 100 + '%';
    track.appendChild(bar);
    const val = document.createElement('div'); val.className = 'hbar-val'; val.textContent = fmt(f.valor);
    row.append(lab, track, val);
    const tip = (ev) => mostrarTip(ev, f.etiqueta, f.lineas || [{ valor: fmt(f.valor) }]);
    row.addEventListener('pointermove', tip);
    row.addEventListener('pointerleave', ocultarTip);
    row.addEventListener('focus', () => { const b = row.getBoundingClientRect(); tip({ clientX: b.left + b.width / 2, clientY: b.top }); });
    row.addEventListener('blur', ocultarTip);
    cont.appendChild(row);
  });
  if (!filas.length) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = 'Sin datos todavía'; cont.appendChild(e); }
  el.appendChild(cont);
}

// ---------- Línea (una serie) con cruz que sigue al cursor ----------
// puntos: [{ etiqueta, valor, titulo, lineas }]
function linea(el, puntos, { fmt = String, entero = false, alto = 230 } = {}) {
  el.replaceChildren();
  const W = Math.max(el.clientWidth || 600, 280), H = alto, m = { t: 20, r: 20, b: 26, l: 56 };
  const max = Math.max(0, ...puntos.map((p) => p.valor));
  const ticks = marcas(max, entero), tope = ticks[ticks.length - 1] || 1;
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const x = (i) => m.l + (puntos.length === 1 ? iw / 2 : (i / (puntos.length - 1)) * iw);
  const y = (v) => m.t + ih - (v / tope) * ih;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'viz', role: 'img', tabindex: 0 });
  ticks.forEach((t) => {
    svg.appendChild(svgEl('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: t === 0 ? 'viz-base' : 'viz-grid' }));
    svg.appendChild(svgEl('text', { x: m.l - 6, y: y(t) + 4, 'text-anchor': 'end', class: 'viz-eje' }, fmt(t)));
  });
  const cada = Math.ceil(puntos.length / Math.max(1, Math.floor(iw / 70)));
  puntos.forEach((p, i) => { if (i % cada === 0 || i === puntos.length - 1) svg.appendChild(svgEl('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', class: 'viz-eje' }, p.etiqueta)); });
  if (puntos.length > 1) svg.appendChild(svgEl('path', { class: 'viz-linea', d: puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.valor)}`).join(' ') }));
  puntos.forEach((p, i) => svg.appendChild(svgEl('circle', { cx: x(i), cy: y(p.valor), r: 4, class: 'viz-punto' })));
  const ult = puntos[puntos.length - 1];
  if (ult) svg.appendChild(svgEl('text', { x: x(puntos.length - 1), y: y(ult.valor) - 10, 'text-anchor': puntos.length > 1 ? 'end' : 'middle', class: 'viz-valor' }, fmt(ult.valor)));
  const cruz = svgEl('line', { y1: m.t, y2: m.t + ih, class: 'viz-cruz', visibility: 'hidden' });
  svg.appendChild(cruz);
  const capa = svgEl('rect', { x: m.l - 10, y: m.t, width: iw + 20, height: ih, fill: 'transparent' });
  const mover = (ev) => {
    const b = svg.getBoundingClientRect();
    const px = ((ev.clientX - b.left) / b.width) * W;
    let i = 0, d = Infinity;
    puntos.forEach((_, k) => { const dd = Math.abs(x(k) - px); if (dd < d) { d = dd; i = k; } });
    cruz.setAttribute('x1', x(i)); cruz.setAttribute('x2', x(i)); cruz.setAttribute('visibility', 'visible');
    const p = puntos[i];
    mostrarTip(ev, p.titulo || p.etiqueta, p.lineas || [{ valor: fmt(p.valor) }]);
  };
  capa.addEventListener('pointermove', mover);
  capa.addEventListener('pointerleave', () => { cruz.setAttribute('visibility', 'hidden'); ocultarTip(); });
  svg.appendChild(capa);
  el.appendChild(svg);
  el.appendChild(tablaDatos(puntos.map((p) => [p.titulo || p.etiqueta, fmt(p.valor)]), ['', 'Valor']));
}

// ---------- Fotos mensuales de la cartera ----------
function metricasActuales() {
  const d = state.data, mes = today().slice(0, 7);
  if (state.perfil === 'seguros') {
    const vig = d.polizas.filter((p) => p.estado === 'Vigente');
    const porAseg = {};
    vig.forEach((p) => { const a = (porAseg[p.aseguradora || 'Sin aseguradora'] ||= { polizas: 0, prima: 0 }); a.polizas++; a.prima += Number(p.prima || 0); });
    return {
      polizas: vig.length,
      clientes: new Set(vig.map((p) => p.cliente_id)).size,
      clientes_total: d.clientes.length,
      prima: vig.reduce((s, p) => s + Number(p.prima || 0), 0),
      comision: vig.reduce((s, p) => s + primaBase(p) * Number(p.comision_pct || 0) / 100, 0),
      cobrado_mes: sumaMontos(d.pagos.filter((x) => (x.fecha || '').startsWith(mes))),
      por_aseguradora: porAseg,
    };
  }
  const act = d.expedientes.filter((x) => !['Entregado', 'Cancelado'].includes(x.estado));
  return {
    expedientes: act.length,
    clientes: new Set(act.map((x) => x.cliente_id)).size,
    clientes_total: d.clientes.length,
    nuevos_mes: d.expedientes.filter((x) => (x.fecha_inicio || x.created_at || '').startsWith(mes)).length,
    honorarios_mes: d.expedientes.filter((x) => (x.fecha_inicio || x.created_at || '').startsWith(mes)).reduce((s, x) => s + Number(x.honorarios || 0), 0),
    cobrado_mes: sumaMontos(d.pagos.filter((x) => (x.fecha || '').startsWith(mes))),
  };
}

// Se actualiza la foto del mes en curso cada vez que se abre el CRM; al cambiar de mes queda guardada.
async function guardarFotoMensual() {
  const row = { perfil: state.perfil, periodo: today().slice(0, 7), datos: metricasActuales(), created_by: state.user.email, created_at: new Date().toISOString() };
  if (DEMO) {
    const rows = db._local('metricas').filter((r) => !(r.perfil === row.perfil && r.periodo === row.periodo));
    db._saveLocal('metricas', [...rows, { ...row, id: crypto.randomUUID() }]);
    return true;
  }
  const { error } = await sb.from('metricas').upsert(row, { onConflict: 'perfil,periodo' });
  return !error;
}

async function leerFotos() {
  if (DEMO) return db._local('metricas').filter((r) => r.perfil === state.perfil).sort((a, b) => (a.periodo > b.periodo ? 1 : -1));
  const { data, error } = await sb.from('metricas').select('*').eq('perfil', state.perfil).order('periodo');
  return error ? null : data;
}

// ---------- Vista ----------
function botonesMetrica(id, opciones, activa) {
  return `<div class="seg" id="${id}">${opciones.map(([k, l]) => `<button class="${k === activa ? 'on' : ''}" data-k="${k}">${l}</button>`).join('')}</div>`;
}
function bindSeg(id, fn) {
  document.querySelectorAll(`#${id} button`).forEach((b) => (b.onclick = () => {
    document.querySelectorAll(`#${id} button`).forEach((x) => x.classList.toggle('on', x === b));
    fn(b.dataset.k);
  }));
}

async function vEstadisticas(el) {
  const seg = state.perfil === 'seguros';
  el.innerHTML = `
    ${seg ? `<div class="filtros">
      <select id="f-aseg" style="width:auto"><option value="">Todas las aseguradoras</option>${CAT.aseguradoras.map((a) => `<option>${esc(a)}</option>`).join('')}</select>
      <select id="f-ramo" style="width:auto"><option value="">Todos los ramos</option>${CAT.ramos.map((a) => `<option>${esc(a)}</option>`).join('')}</select>
    </div>` : ''}
    <div class="kpis" id="st-kpis"></div>
    <div class="card"><div class="card-top"><h3>${seg ? '¿En qué meses vencen (y se renuevan) más pólizas?' : 'Expedientes nuevos por mes'}</h3>${seg ? '' : `<select id="f-anio" style="width:auto">${aniosExpedientes().map((a) => `<option>${a}</option>`).join('')}</select>`}</div>
      <p class="muted">${seg ? 'Pólizas vigentes según el mes de su fecha de vencimiento. Pasa el cursor sobre cada barra para ver el detalle.' : 'Según la fecha de inicio del expediente.'}</p><div id="g-meses"></div></div>
    ${seg ? `<div class="card"><div class="card-top"><h3>Primas por aseguradora</h3>${botonesMetrica('m-aseg', [['mensual', 'Prima mensual'], ['anual', 'Prima anual'], ['polizas', 'Pólizas'], ['comision', 'Comisión']], 'mensual')}</div>
      <p class="muted">Prima mensual = prima total anual ÷ 12 (lo que equivale a cobrar cada mes).</p><div id="g-aseg"></div></div>
    <div class="card"><h3>Primas por cobrar mes a mes (próximos 12 meses)</h3>
      <p class="muted">Según el número de pagos y la fecha de inicio de cada póliza vigente (1 pago = en el mes de inicio; 2 pagos = cada 6 meses; 10 o 12 pagos = mes a mes).</p><div id="g-flujo"></div></div>
    <div class="card"><h3>¿Cómo pagan tus clientes?</h3><p class="muted">Pólizas vigentes por modalidad de pago.</p><div id="g-modalidad"></div></div>
    <div class="card"><div class="card-top"><h3>Cartera por ramo</h3>${botonesMetrica('m-ramo', [['polizas', 'Pólizas'], ['anual', 'Prima anual']], 'polizas')}</div><div id="g-ramo"></div></div>`
    : `<div class="card"><div class="card-top"><h3>Honorarios por tipo de trámite</h3>${botonesMetrica('m-tram', [['honorarios', 'Honorarios'], ['cantidad', 'Cantidad']], 'honorarios')}</div><div id="g-tram"></div></div>`}
    <div class="card"><h3>Pagos recibidos por mes (últimos 12 meses)</h3><div id="g-cobros"></div></div>
    <div class="card"><h3>🎯 Prospectos</h3><div class="kpis" id="st-prosp"></div>
      <div class="grid2"><div><h4>¿Por qué se pierden?</h4><div id="g-perdidos"></div></div><div><h4>¿Qué piden más?</h4><div id="g-servicios"></div></div></div></div>
    <div class="card"><div class="card-top"><h3>📈 Evolución de la cartera</h3><div id="evo-seg"></div></div>
      <p class="muted">El CRM guarda automáticamente una "foto" de la cartera cada mes. Esta gráfica se va llenando con el tiempo y te permite comparar año con año.</p>
      <div id="g-evo"></div><div id="t-anios"></div></div>`;

  const redibujar = () => { (seg ? pintarSeguros() : pintarByc()); pintarProspectos(); };
  if (seg) { $('#f-aseg').onchange = redibujar; $('#f-ramo').onchange = redibujar; }
  else $('#f-anio').onchange = redibujar;
  state.fotos = undefined;
  state.vizRedraw = () => { redibujar(); pintarEvolucion(); };
  redibujar();
  await guardarFotoMensual();
  state.fotos = await leerFotos();
  pintarEvolucion();
}

function aniosExpedientes() {
  const set = new Set([today().slice(0, 4)]);
  state.data.expedientes.forEach((x) => { const f = x.fecha_inicio || x.created_at; if (f) set.add(f.slice(0, 4)); });
  return [...set].sort().reverse();
}

function kpisHTML(items) {
  return items.map(([l, v, s]) => `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div>${s ? `<div class="muted" style="font-size:12px">${s}</div>` : ''}</div>`).join('');
}

function pagosUltimos12() {
  const hoy = new Date(today() + 'T12:00');
  const meses = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1); meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
  return meses.map((k) => {
    const ps = state.data.pagos.filter((x) => (x.fecha || '').startsWith(k));
    const m = Number(k.slice(5)) - 1;
    return { etiqueta: MESES[m], titulo: `${MESES_LARGO[m]} ${k.slice(0, 4)}`, valor: sumaMontos(ps), lineas: [{ valor: money(sumaMontos(ps)), texto: 'cobrado' }, { valor: String(ps.length), texto: ps.length === 1 ? 'pago' : 'pagos' }] };
  });
}

function pintarSeguros() {
  const fa = $('#f-aseg').value, fr = $('#f-ramo').value;
  const vig = state.data.polizas.filter((p) => p.estado === 'Vigente' && (!fa || p.aseguradora === fa) && (!fr || p.ramo === fr));
  const prima = vig.reduce((s, p) => s + Number(p.prima || 0), 0);
  const comision = vig.reduce((s, p) => s + primaBase(p) * Number(p.comision_pct || 0) / 100, 0);
  $('#st-kpis').innerHTML = kpisHTML([
    ['Pólizas vigentes', vig.length],
    ['Clientes con póliza', new Set(vig.map((p) => p.cliente_id)).size],
    ['Prima total anual', money(prima)],
    ['Prima mensual', money(prima / 12), 'promedio (anual ÷ 12)'],
    ['Comisión anual estimada', money(comision), `≈ ${money(comision / 12)} al mes`],
  ]);

  // Vencimientos por mes
  barrasV($('#g-meses'), MESES.map((m, i) => {
    const ps = vig.filter((p) => p.fin && Number(p.fin.slice(5, 7)) === i + 1);
    const pr = ps.reduce((s, p) => s + Number(p.prima || 0), 0);
    return { etiqueta: m, titulo: MESES_LARGO[i][0].toUpperCase() + MESES_LARGO[i].slice(1), valor: ps.length, lineas: [{ valor: String(ps.length), texto: ps.length === 1 ? 'póliza' : 'pólizas' }, { valor: money(pr), texto: 'de prima anual' }] };
  }), { entero: true });

  // Por aseguradora
  const pintaAseg = (k) => {
    const filas = CAT.aseguradoras.concat([...new Set(vig.map((p) => p.aseguradora))].filter((a) => a && !CAT.aseguradoras.includes(a))).map((a) => {
      const ps = vig.filter((p) => p.aseguradora === a);
      const pa = ps.reduce((s, p) => s + Number(p.prima || 0), 0);
      const co = ps.reduce((s, p) => s + primaBase(p) * Number(p.comision_pct || 0) / 100, 0);
      const valor = { mensual: pa / 12, anual: pa, polizas: ps.length, comision: co }[k];
      return { etiqueta: a, logo: `assets/aseguradoras/${slug(a)}.png`, valor, lineas: [
        { valor: money(pa / 12), texto: 'prima mensual' }, { valor: money(pa), texto: 'prima anual' },
        { valor: String(ps.length), texto: ps.length === 1 ? 'póliza vigente' : 'pólizas vigentes' }, { valor: money(co), texto: 'comisión anual est.' },
        { valor: prima ? Math.round(pa / prima * 100) + '%' : '0%', texto: 'de tu cartera' }] };
    }).filter((f) => f.valor > 0).sort((a, b) => b.valor - a.valor);
    barrasH($('#g-aseg'), filas, { fmt: k === 'polizas' ? String : money });
  };
  bindSeg('m-aseg', pintaAseg);
  pintaAseg($('#m-aseg .on').dataset.k);

  // Flujo de cobro próximos 12 meses
  const hoy = new Date(today() + 'T12:00');
  const flujo = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    const mes = d.getMonth();
    const porA = {};
    let total = 0;
    vig.forEach((p) => {
      const veces = mesesDeCuota(p).filter((m) => m === mes).length;
      if (!veces) return;
      const c = (Number(p.prima || 0) / numPagos(p.forma_pago)) * veces;
      total += c; porA[p.aseguradora] = (porA[p.aseguradora] || 0) + c;
    });
    const top = Object.entries(porA).sort((a, b) => b[1] - a[1]).slice(0, 4);
    flujo.push({ etiqueta: MESES[mes], titulo: `${MESES_LARGO[mes]} ${d.getFullYear()}`, valor: total, lineas: [{ valor: money(total), texto: 'por cobrar' }, ...top.map(([a, v]) => ({ valor: money(v), texto: a }))] });
  }
  barrasV($('#g-flujo'), flujo, { fmt: moneyCorto });

  const mods = [...CAT.modalidadesPago, 'Sin indicar'];
  barrasH($('#g-modalidad'), mods.map((mo) => {
    const ps = vig.filter((p) => (p.modalidad_pago || 'Sin indicar') === mo);
    const pa = ps.reduce((s, p) => s + Number(p.prima || 0), 0);
    return { etiqueta: mo, valor: ps.length, lineas: [{ valor: String(ps.length), texto: ps.length === 1 ? 'póliza' : 'pólizas' }, { valor: money(pa), texto: 'prima anual' }, { valor: vig.length ? Math.round(ps.length / vig.length * 100) + '%' : '0%', texto: 'de las pólizas' }] };
  }).filter((f) => f.valor > 0).sort((a, b) => b.valor - a.valor));

  // Por ramo
  const pintaRamo = (k) => {
    const filas = CAT.ramos.map((r) => {
      const ps = vig.filter((p) => p.ramo === r);
      const pa = ps.reduce((s, p) => s + Number(p.prima || 0), 0);
      return { etiqueta: r, valor: k === 'anual' ? pa : ps.length, lineas: [{ valor: String(ps.length), texto: 'pólizas' }, { valor: money(pa), texto: 'prima anual' }] };
    }).filter((f) => f.valor > 0).sort((a, b) => b.valor - a.valor);
    barrasH($('#g-ramo'), filas, { fmt: k === 'anual' ? money : String });
  };
  bindSeg('m-ramo', pintaRamo);
  pintaRamo($('#m-ramo .on').dataset.k);

  barrasV($('#g-cobros'), pagosUltimos12(), { fmt: moneyCorto });
}

function pintarByc() {
  const anio = $('#f-anio').value;
  const xs = state.data.expedientes;
  const act = xs.filter((x) => !['Entregado', 'Cancelado'].includes(x.estado));
  const delAnio = xs.filter((x) => (x.fecha_inicio || x.created_at || '').startsWith(anio));
  const cobradoAnio = sumaMontos(state.data.pagos.filter((p) => (p.fecha || '').startsWith(anio))) + delAnio.reduce((s, x) => s + Number(x.anticipo || 0), 0);
  $('#st-kpis').innerHTML = kpisHTML([
    ['Expedientes activos', act.length],
    [`Expedientes ${anio}`, delAnio.length],
    [`Honorarios ${anio}`, money(delAnio.reduce((s, x) => s + Number(x.honorarios || 0), 0))],
    [`Cobrado ${anio}`, money(cobradoAnio)],
    ['Saldo por cobrar', money(xs.filter((x) => x.estado !== 'Cancelado').reduce((s, x) => s + estadoPagoExp(x).saldo, 0))],
  ]);
  barrasV($('#g-meses'), MESES.map((m, i) => {
    const es = delAnio.filter((x) => Number((x.fecha_inicio || x.created_at).slice(5, 7)) === i + 1);
    return { etiqueta: m, titulo: `${MESES_LARGO[i]} ${anio}`, valor: es.length, lineas: [{ valor: String(es.length), texto: 'expedientes' }, { valor: money(es.reduce((s, x) => s + Number(x.honorarios || 0), 0)), texto: 'en honorarios' }] };
  }), { entero: true });
  const pintaTram = (k) => {
    const filas = CAT.tramites.map((t) => {
      const es = delAnio.filter((x) => x.tramite === t);
      const h = es.reduce((s, x) => s + Number(x.honorarios || 0), 0);
      return { etiqueta: t, valor: k === 'cantidad' ? es.length : h, lineas: [{ valor: String(es.length), texto: 'expedientes' }, { valor: money(h), texto: 'honorarios' }] };
    }).filter((f) => f.valor > 0).sort((a, b) => b.valor - a.valor);
    barrasH($('#g-tram'), filas, { fmt: k === 'cantidad' ? String : money });
  };
  bindSeg('m-tram', pintaTram);
  pintaTram($('#m-tram .on').dataset.k);
  barrasV($('#g-cobros'), pagosUltimos12(), { fmt: moneyCorto });
}

function pintarProspectos() {
  const ps = state.data.prospectos;
  const gan = ps.filter((p) => p.etapa === 'Ganado'), per = ps.filter((p) => p.etapa === 'Perdido');
  const abiertos = ps.filter((p) => !['Ganado', 'Perdido'].includes(p.etapa));
  const tasa = gan.length + per.length ? Math.round(gan.length / (gan.length + per.length) * 100) + '%' : '—';
  $('#st-prosp').innerHTML = kpisHTML([
    ['Tasa de cierre', tasa, 'ganados ÷ (ganados + perdidos)'],
    ['Ganados', gan.length, money(gan.reduce((s, p) => s + Number(p.monto || 0), 0))],
    ['Perdidos', per.length],
    ['En negociación', abiertos.length, money(abiertos.reduce((s, p) => s + Number(p.monto || 0), 0))],
  ]);
  const motivos = {};
  per.forEach((p) => { const m = p.motivo_perdida || 'Sin indicar'; motivos[m] = (motivos[m] || 0) + 1; });
  barrasH($('#g-perdidos'), Object.entries(motivos).map(([m, n]) => ({ etiqueta: m, valor: n, lineas: [{ valor: String(n), texto: n === 1 ? 'prospecto' : 'prospectos' }, { valor: Math.round(n / per.length * 100) + '%', texto: 'de los perdidos' }] })).sort((a, b) => b.valor - a.valor));
  const serv = {};
  ps.forEach((p) => { const k = p.servicio || 'Sin indicar'; (serv[k] ||= { n: 0, g: 0 }); serv[k].n++; if (p.etapa === 'Ganado') serv[k].g++; });
  barrasH($('#g-servicios'), Object.entries(serv).map(([k, v]) => ({ etiqueta: k, valor: v.n, lineas: [{ valor: String(v.n), texto: 'prospectos' }, { valor: String(v.g), texto: 'ganados' }] })).sort((a, b) => b.valor - a.valor));
}

function pintarEvolucion() {
  const fotos = state.fotos;
  if (!$('#g-evo') || fotos === undefined) return;
  if (!fotos) {
    $('#g-evo').innerHTML = '<div class="empty">Para guardar la evolución, corre en Supabase el archivo <b>supabase/actualizacion-2.sql</b> (ver README).</div>';
    return;
  }
  const seg = state.perfil === 'seguros';
  const opciones = seg
    ? [['polizas', 'Pólizas vigentes', String, true], ['clientes', 'Clientes con póliza', String, true], ['prima', 'Prima anual', moneyCorto], ['comision', 'Comisión anual', moneyCorto]]
    : [['expedientes', 'Expedientes activos', String, true], ['nuevos_mes', 'Expedientes nuevos', String, true], ['honorarios_mes', 'Honorarios del mes', moneyCorto], ['cobrado_mes', 'Cobrado del mes', moneyCorto]];
  $('#evo-seg').innerHTML = botonesMetrica('m-evo', opciones.map(([k, l]) => [k, l]), state.evoMetrica && opciones.some((o) => o[0] === state.evoMetrica) ? state.evoMetrica : opciones[0][0]);
  const pinta = (k) => {
    state.evoMetrica = k;
    const [, nombre, fmt, entero] = opciones.find((o) => o[0] === k);
    const fmtLargo = fmt === moneyCorto ? money : fmt;
    linea($('#g-evo'), fotos.map((f) => {
      const m = Number(f.periodo.slice(5)) - 1;
      return { etiqueta: `${MESES[m]} ${f.periodo.slice(2, 4)}`, titulo: `${MESES_LARGO[m]} ${f.periodo.slice(0, 4)}`, valor: Number(f.datos[k] || 0), lineas: [{ valor: fmtLargo(Number(f.datos[k] || 0)), texto: nombre.toLowerCase() }] };
    }), { fmt, entero });
    // Comparativo año con año (última foto de cada año)
    const porAnio = {};
    fotos.forEach((f) => (porAnio[f.periodo.slice(0, 4)] = f));
    const anios = Object.keys(porAnio).sort();
    const col = opciones.map((o) => o);
    const filas = anios.map((a, i) => {
      const f = porAnio[a].datos, prev = i ? porAnio[anios[i - 1]].datos : null;
      return `<tr><td><b>${a}</b><div class="muted">al ${MESES_LARGO[Number(porAnio[a].periodo.slice(5)) - 1]}</div></td>${col.map(([k, , fm]) => {
        const v = Number(f[k] || 0), fl = fm === moneyCorto ? money : fm;
        let delta = '';
        if (prev && Number(prev[k] || 0) > 0) {
          const pct = Math.round((v - prev[k]) / prev[k] * 100);
          delta = `<div class="${pct > 0 ? 'sube' : pct < 0 ? 'baja' : 'muted'}">${pct > 0 ? '▲' : pct < 0 ? '▼' : '='} ${Math.abs(pct)}% vs ${anios[i - 1]}</div>`;
        }
        return `<td>${fl(v)}${delta}</td>`;
      }).join('')}</tr>`;
    }).join('');
    $('#t-anios').innerHTML = `<h3 style="margin-top:18px">Comparativo año con año</h3><div class="table-wrap"><table><thead><tr><th>Año</th>${col.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${filas}</tbody></table></div>
      ${anios.length < 2 ? '<p class="muted">Cuando haya fotos de al menos dos años verás aquí si la cartera creció ▲ o bajó ▼.</p>' : ''}`;
  };
  bindSeg('m-evo', pinta);
  pinta($('#m-evo .on').dataset.k);
}

let _vizResize;
window.addEventListener('resize', () => { clearTimeout(_vizResize); _vizResize = setTimeout(() => { if (location.hash === '#estadisticas' && state.vizRedraw) state.vizRedraw(); }, 200); });
