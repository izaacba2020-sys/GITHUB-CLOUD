/* Importar clientes (y pólizas / expedientes) desde Excel y descargar respaldo completo */
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' & ').replace(/[^a-z0-9&]+/g, ' ').trim();
const tieneFrase = (texto, frase) => (' ' + norm(texto) + ' ').includes(' ' + norm(frase) + ' ');

// ---------- Conversión de valores ----------
function aFecha(v) {
  if (v === '' || v == null) return null;
  if (v instanceof Date && !isNaN(v)) {
    const d = new Date(v.getTime() + 12 * 3600 * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'number' && window.XLSX) {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : null;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/); // dd/mm/aaaa (formato de Guatemala)
  if (m) {
    const y = m[3].length === 2 ? (Number(m[3]) > 50 ? '19' : '20') + m[3] : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

// Algunos sistemas exportan "Excel" que en realidad es HTML, con letras como &#209; (Ñ).
const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decodificar = (s) => s.replace(/&#(\d+);/g, (m, n) => String.fromCharCode(n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16))).replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (m, n) => ENTIDADES[n]);

const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'van', 'von']);
function nombrePropio(s) {
  if (s !== s.toUpperCase() || !/[A-ZÁÉÍÓÚÑ]/.test(s)) return s;
  return s.toLowerCase().split(/\s+/).map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}

function aNumero(v) {
  if (v === '' || v == null) return null;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : n;
}

function buscarEn(lista, v, alias = {}) {
  const t = norm(v);
  if (!t) return null;
  for (const op of lista) if (norm(op) === t) return op;
  for (const [op, palabras] of Object.entries(alias)) if (palabras.some((p) => tieneFrase(t, p))) return op;
  return null;
}

const ALIAS_RAMOS = {
  'Vehículos': ['vehiculo', 'vehiculos', 'auto', 'autos', 'carro', 'moto', 'automovil'],
  'Gastos médicos': ['medico', 'medicos', 'gmm', 'salud', 'hospitalario'],
  'Vida': ['vida'],
  'Hogar / Daños': ['hogar', 'casa', 'incendio', 'danos', 'vivienda'],
  'Empresarial': ['empresarial', 'empresa', 'pyme', 'comercio', 'negocio'],
  'Fianzas': ['fianza', 'fianzas'],
  'Accidentes personales': ['accidente', 'accidentes'],
};
const ALIAS_PAGO = { '12 pagos': ['mensual', 'mes', '12'], '4 pagos': ['trimestral', '4'], '2 pagos': ['semestral', '2'], '1 pago': ['anual', 'contado', 'unico', '1'], '3 pagos': ['3'], '6 pagos': ['6'], '10 pagos': ['10'] };
const ALIAS_MODALIDAD = {
  'Visa cuotas': ['visa', 'visacuotas', 'tarjeta'],
  'Fraccionado (crédito de la aseguradora)': ['fraccionado', 'fraccionamiento', 'credito'],
  'Débito a cuenta': ['debito', 'debito a cuenta', 'cargo automatico'],
  'Pronto pago (efectivo / transferencia)': ['pronto pago', 'efectivo', 'transferencia', 'contado', 'deposito'],
};
const ALIAS_ESTADO = { Vigente: ['vigente', 'activa', 'activo'], Cancelada: ['cancelada', 'anulada', 'cancelado'], 'No renovada': ['no renovada', 'vencida'] };
const ALIAS_TIPO = { 'Jurídica': ['juridica', 'empresa', 'sociedad', 's a', 'sa'], Individual: ['individual', 'persona', 'natural'] };
const ALIAS_TRAMITES = Object.fromEntries(CAT.tramites.map((t) => [t, [norm(t), norm(t).replace(/s$/, '')]]));

// ---------- Campos que se pueden importar ----------
// El orden importa: los campos más específicos van primero para adivinar bien las columnas.
const CAMPOS_CLIENTE_IMP = [
  { k: 'telefono', label: 'Teléfono / WhatsApp', kw: ['telefono', 'tel', 'celular', 'cel', 'whatsapp', 'movil', 'numero de telefono'] },
  { k: 'email', label: 'Correo', kw: ['correo', 'email', 'e mail', 'mail', 'correo electronico'] },
  { k: 'dpi', label: 'DPI', kw: ['dpi', 'cui'] },
  { k: 'nit', label: 'NIT', kw: ['nit'] },
  { k: 'fecha_nacimiento', label: 'Fecha de nacimiento', kw: ['fecha de nacimiento', 'nacimiento', 'cumpleanos', 'cumple', 'fecha nac'], tipo: 'fecha' },
  { k: 'direccion', label: 'Dirección', kw: ['direccion', 'domicilio'] },
  { k: 'tipo', label: 'Tipo de persona', kw: ['tipo de persona', 'tipo persona'] },
  { k: 'fuente', label: '¿Cómo nos conoció?', kw: ['fuente', 'referido', 'como nos conocio', 'origen'] },
  { k: 'etiquetas', label: 'Etiquetas', kw: ['etiquetas', 'tags', 'categoria'] },
  { k: 'nombre', label: 'Nombre del cliente', kw: ['nombre', 'nombres', 'cliente', 'asegurado', 'contratante', 'razon social', 'nombre completo', 'nombre del cliente'], req: true },
];
const CAMPOS_POLIZA_IMP = [
  { k: 'aseguradora', label: 'Aseguradora', kw: ['aseguradora', 'compania', 'compania de seguros', 'cia'] },
  { k: 'fin', label: 'Fin de vigencia / vence', kw: ['fin de vigencia', 'vighasta', 'vig hasta', 'vigencia hasta', 'vencimiento', 'vence', 'fin', 'hasta', 'fecha de vencimiento', 'renovacion'], tipo: 'fecha' },
  { k: 'inicio', label: 'Inicio de vigencia', kw: ['inicio de vigencia', 'vigdesde', 'vig desde', 'vigencia desde', 'inicio', 'desde', 'fecha de inicio', 'emision'], tipo: 'fecha' },
  { k: 'ramo', label: 'Ramo / tipo de seguro', kw: ['ramo', 'tipo de seguro', 'producto', 'seguro', 'cobertura', 'tipo'] },
  { k: 'numero', label: 'No. de póliza', kw: ['no poliza', 'numero de poliza', 'poliza', 'no de poliza', 'num poliza', 'n poliza'] },
  { k: 'suma_asegurada', label: 'Suma asegurada', kw: ['suma asegurada', 'suma', 'valor asegurado'], tipo: 'num' },
  { k: 'prima', label: 'Prima total', kw: ['prima total', 'total', 'prima anual'], tipo: 'num' },
  { k: 'prima_neta', label: 'Prima neta', kw: ['prima neta', 'neta', 'prima'], tipo: 'num' },
  { k: '_saldo', label: 'Saldo pendiente (lo demás se registra como pagado)', kw: ['saldo pendiente', 'saldo', 'pendiente'], tipo: 'num' },
  { k: '_codigo', label: 'Código de asegurado', kw: ['codigo', 'codigo asegurado', 'codigo cliente', 'cod'] },
  { k: 'modalidad_pago', label: 'Modalidad de pago (Visa cuotas, fraccionado…)', kw: ['modalidad de pago', 'modalidad', 'medio de pago', 'tipo de pago'] },
  { k: 'forma_pago', label: 'Número de pagos / forma de pago', kw: ['numero de pagos', 'no de pagos', 'cuotas', 'forma de pago', 'frecuencia', 'frecuencia de pago', 'pagos', 'pago'] },
  { k: 'comision_pct', label: 'Comisión %', kw: ['comision', 'porcentaje comision', 'comision %'], tipo: 'num' },
  { k: 'estado', label: 'Estado de la póliza', kw: ['estado', 'status', 'estatus'] },
  { k: 'notas', label: 'Notas', kw: ['notas', 'observaciones', 'comentarios'] },
];
const CAMPOS_EXP_IMP = [
  { k: 'tramite', label: 'Trámite', kw: ['tramite', 'servicio', 'tipo de tramite', 'asunto'] },
  { k: 'descripcion', label: 'Descripción', kw: ['descripcion', 'detalle'] },
  { k: 'estado', label: 'Estado del trámite', kw: ['estado', 'status', 'estatus'] },
  { k: 'responsable', label: 'Responsable', kw: ['responsable', 'abogado', 'encargado'] },
  { k: 'fecha_inicio', label: 'Fecha de inicio', kw: ['fecha de inicio', 'inicio', 'fecha'], tipo: 'fecha' },
  { k: 'honorarios', label: 'Honorarios', kw: ['honorarios', 'costo', 'precio', 'total'], tipo: 'num' },
  { k: 'anticipo', label: 'Anticipo / pagado', kw: ['anticipo', 'pagado', 'abono'], tipo: 'num' },
  { k: 'notas', label: 'Notas', kw: ['notas', 'observaciones', 'comentarios'] },
];

function camposImport() {
  const extra = state.perfil === 'seguros' ? CAMPOS_POLIZA_IMP : CAMPOS_EXP_IMP;
  return [
    ...CAMPOS_CLIENTE_IMP.map((f) => ({ ...f, grupo: 'cliente' })),
    ...extra.map((f) => ({ ...f, grupo: state.perfil === 'seguros' ? 'poliza' : 'expediente', id: 'x_' + f.k })),
  ].map((f) => ({ id: f.id || 'c_' + f.k, ...f }));
}

function adivinarColumnas(headers, campos) {
  const usadas = new Set();
  const mapa = {};
  for (const pase of ['exacto', 'contiene']) {
    for (const f of campos) {
      if (mapa[f.id]) continue;
      for (const kw of f.kw) {
        const h = headers.find((h) => !usadas.has(h) && (pase === 'exacto' ? norm(h) === norm(kw) : tieneFrase(h, kw)));
        if (h) { mapa[f.id] = h; usadas.add(h); break; }
      }
    }
  }
  return mapa;
}

// ---------- Carga de la librería de Excel ----------
function cargarXLSX() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = ok;
    s.onerror = () => { toast('No se pudo cargar el lector de Excel. Revisa tu conexión.'); fail(); };
    document.head.appendChild(s);
  });
}

// ---------- Importar ----------
async function importarExcel() {
  await cargarXLSX();
  const seg = state.perfil === 'seguros';
  openModal(`
    <h2>Importar desde Excel</h2>
    <p>Sube tu archivo de Excel (.xlsx, .xls o .csv). La <b>primera fila</b> debe tener los títulos de las columnas. Cada fila es un cliente${seg ? ' y, si trae datos de aseguradora o póliza, también se crea su póliza' : ' y, si trae el trámite, también se crea su expediente'}.</p>
    <p class="muted">Los datos se leen en tu navegador y se guardan directo en tu base de datos. Si un cliente ya existe (mismo nombre, DPI o NIT) no se duplica.</p>
    <p><button class="btn sec sm" id="plantilla-xls">⬇ Descargar plantilla de ejemplo</button></p>
    <input type="file" id="archivo" accept=".xlsx,.xls,.csv">
    <div class="actions"><button class="btn sec" id="cancel">Cancelar</button></div>`);
  $('#cancel').onclick = closeModal;
  $('#plantilla-xls').onclick = descargarPlantillaImport;
  $('#archivo').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      // raw: los textos (ej. 02/08/2027) no se convierten con formato de EE. UU.; aFecha los interpreta como dd/mm/aaaa.
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true, raw: true });
      mapeoImport(wb, wb.SheetNames[0]);
    } catch (err) {
      toast('No se pudo leer el archivo: ' + err.message);
    }
  };
}

function mapeoImport(wb, hoja) {
  const ws = wb.Sheets[hoja];
  const matriz = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  const filaTitulos = matriz.findIndex((r) => r.filter((x) => String(x).trim()).length >= 2);
  if (filaTitulos < 0) return toast('La hoja está vacía');
  const headers = matriz[filaTitulos].map((h, i) => String(h).trim() || `Columna ${i + 1}`);
  const filas = matriz.slice(filaTitulos + 1)
    .filter((r) => r.some((x) => String(x).trim()))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
  const campos = camposImport();
  const mapa = adivinarColumnas(headers, campos);
  const opciones = (id) => `<option value="">— No importar —</option>${headers.map((h) => `<option ${mapa[id] === h ? 'selected' : ''}>${esc(h)}</option>`).join('')}`;
  const grupo = (g, titulo) => `<h3>${titulo}</h3><div class="form">${campos.filter((f) => f.grupo === g).map((f) => `<div><label>${esc(f.label)}${f.req ? ' *' : ''}</label><select data-map="${f.id}">${opciones(f.id)}</select></div>`).join('')}</div>`;
  openModal(`
    <h2>Relacionar columnas</h2>
    ${wb.SheetNames.length > 1 ? `<label>Hoja</label><select id="hoja">${wb.SheetNames.map((n) => `<option ${n === hoja ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` : ''}
    <p class="muted">Encontré <b>${filas.length}</b> filas. Revisa que cada dato del CRM apunte a la columna correcta de tu Excel (ya adiviné las que pude).</p>
    ${grupo('cliente', 'Datos del cliente')}
    ${grupo(state.perfil === 'seguros' ? 'poliza' : 'expediente', state.perfil === 'seguros' ? 'Datos de la póliza (opcional)' : 'Datos del expediente (opcional)')}
    <h3>Si tu Excel no trae alguna columna</h3>
    <div class="form">${state.perfil === 'seguros' ? `
      <div><label>Aseguradora para todas las filas</label><select id="fijo-aseguradora"><option value="">— No usar —</option>${CAT.aseguradoras.map((a) => `<option>${esc(a)}</option>`).join('')}</select></div>
      <div><label>Ramo para todas las filas</label><select id="fijo-ramo"><option value="">— No usar —</option>${CAT.ramos.map((a) => `<option>${esc(a)}</option>`).join('')}</select></div>
      <div class="full"><label class="check"><input type="checkbox" id="op-inicio" checked> Si no hay fecha de inicio, calcularla como 1 año antes del vencimiento</label></div>` : `
      <div><label>Trámite para todas las filas</label><select id="fijo-tramite"><option value="">— No usar —</option>${CAT.tramites.map((a) => `<option>${esc(a)}</option>`).join('')}</select></div>`}
      <div class="full"><label class="check"><input type="checkbox" id="op-nombres" checked> Convertir nombres en MAYÚSCULAS a formato normal (JUAN PÉREZ → Juan Pérez)</label></div>
    </div>
    <div class="actions"><button class="btn sec" id="cancel">Cancelar</button><button class="btn" id="revisar">Revisar importación →</button></div>`);
  $('#cancel').onclick = closeModal;
  if ($('#hoja')) $('#hoja').onchange = () => mapeoImport(wb, $('#hoja').value);
  $('#revisar').onclick = () => {
    const m = {};
    document.querySelectorAll('[data-map]').forEach((s) => { if (s.value) m[s.dataset.map] = s.value; });
    if (!m.c_nombre) return toast('Indica cuál columna tiene el nombre del cliente');
    const val = (id) => ($(id) ? $(id).value : '');
    const op = { aseguradora: val('#fijo-aseguradora'), ramo: val('#fijo-ramo'), tramite: val('#fijo-tramite'), inicio: $('#op-inicio')?.checked, nombres: $('#op-nombres').checked };
    confirmarImport(planImport(filas, m, campos, op));
  };
}

function planImport(filas, m, campos, op = {}) {
  const seg = state.perfil === 'seguros';
  const valor = (fila, f) => {
    const v = m[f.id] ? fila[m[f.id]] : '';
    if (f.tipo === 'fecha') return aFecha(v);
    if (f.tipo === 'num') return aNumero(v);
    const s = v instanceof Date ? aFecha(v) : decodificar(String(v ?? '')).trim();
    return s || null;
  };
  // Índice de clientes existentes para no duplicar
  const idx = new Map();
  const indexar = (c) => [c.nombre && 'n:' + norm(c.nombre), c.dpi && 'd:' + norm(c.dpi), c.nit && 't:' + norm(c.nit)].filter(Boolean).forEach((k) => idx.set(k, c));
  state.data.clientes.forEach(indexar);
  const buscar = (c) => [c.dpi && 'd:' + norm(c.dpi), c.nit && 't:' + norm(c.nit), c.nombre && 'n:' + norm(c.nombre)].filter(Boolean).map((k) => idx.get(k)).find(Boolean);
  const polizasExist = new Set(state.data.polizas?.map((p) => norm(p.aseguradora) + '|' + norm(p.numero)).filter((k) => !k.endsWith('|')));

  const plan = { clientes: [], items: [], pagos: [], existentes: 0, sinNombre: 0, dupItems: 0, avisos: [] };
  filas.forEach((fila, i) => {
    const c = {}, x = {};
    for (const f of campos) {
      const v = valor(fila, f);
      if (v == null) continue;
      if (f.grupo === 'cliente') c[f.k] = v; else x[f.k] = v;
    }
    if (!c.nombre) { plan.sinNombre++; return; }
    if (op.nombres) c.nombre = nombrePropio(c.nombre);
    if (op.aseguradora && !x.aseguradora) x.aseguradora = op.aseguradora;
    if (op.ramo && !x.ramo) x.ramo = op.ramo;
    if (op.tramite && !x.tramite) x.tramite = op.tramite;
    if (c.telefono) c.telefono = String(c.telefono).replace(/\.0$/, '');
    if (c.tipo) c.tipo = buscarEn(CAT.tiposPersona, c.tipo, ALIAS_TIPO) || c.tipo;
    let cliente = buscar(c);
    if (cliente) { if (!cliente._nuevo) plan.existentes++; }
    else {
      cliente = { id: crypto.randomUUID(), ...c, _nuevo: true };
      plan.clientes.push(cliente);
      indexar(cliente);
    }
    if (!Object.keys(x).length) return;
    x.cliente_id = cliente.id;
    if (seg) {
      if (x.aseguradora) {
        const a = buscarEn(CAT.aseguradoras, x.aseguradora, CAT.aliasAseguradoras);
        if (!a) plan.avisos.push(`Fila ${i + 2}: aseguradora "${x.aseguradora}" no está en tu lista`);
        x.aseguradora = a || x.aseguradora;
      }
      if (x.ramo) x.ramo = buscarEn(CAT.ramos, x.ramo, ALIAS_RAMOS) || x.ramo;
      if (x.forma_pago) {
        // "Visa 10 cuotas" -> 10 pagos + Visa cuotas
        if (!x.modalidad_pago) x.modalidad_pago = buscarEn(CAT.modalidadesPago, x.forma_pago, ALIAS_MODALIDAD);
        const n = String(x.forma_pago).match(/\d+/);
        x.forma_pago = (n && CAT.formasPago.find((f) => parseInt(f, 10) === Number(n[0]))) || buscarEn(CAT.formasPago, x.forma_pago, ALIAS_PAGO) || x.forma_pago;
      }
      if (x.modalidad_pago) x.modalidad_pago = buscarEn(CAT.modalidadesPago, x.modalidad_pago, ALIAS_MODALIDAD) || x.modalidad_pago;
      x.estado = (x.estado && buscarEn(CAT.estadosPoliza, x.estado, ALIAS_ESTADO)) || 'Vigente';
      if (x.comision_pct != null && x.comision_pct > 0 && x.comision_pct < 1) x.comision_pct = Math.round(x.comision_pct * 10000) / 100;
      if (x.numero) x.numero = String(x.numero).replace(/\.0$/, '');
      const clave = norm(x.aseguradora) + '|' + norm(x.numero);
      if (x.numero && polizasExist.has(clave)) { plan.dupItems++; return; }
      if (x.numero) polizasExist.add(clave);
      if (x.prima == null && x.prima_neta != null && !m.x_prima) x.prima = x.prima_neta;
      if (!x.inicio && x.fin && op.inicio) x.inicio = (Number(x.fin.slice(0, 4)) - 1) + x.fin.slice(4);
      if (x._codigo) x.notas = [`Código de asegurado: ${x._codigo}`, x.notas].filter(Boolean).join('\n');
      x.id = crypto.randomUUID();
      // Con el saldo pendiente de la aseguradora, lo ya pagado se registra como un pago.
      if (x._saldo != null && x.prima > 0) {
        const pagado = Math.round((x.prima - x._saldo) * 100) / 100;
        if (pagado > 0) plan.pagos.push({ ref_tipo: 'poliza', ref_id: x.id, cliente_id: cliente.id, fecha: x.inicio || today(), monto: pagado, notas: 'Pagado según cartera de la aseguradora (importación)' });
      }
      delete x._saldo; delete x._codigo;
    } else {
      const t = x.tramite && buscarEn(CAT.tramites, x.tramite, ALIAS_TRAMITES);
      if (!x.tramite) return;
      if (!t) { x.descripcion = [x.tramite, x.descripcion].filter(Boolean).join(' · '); x.tramite = 'Otro'; } else x.tramite = t;
      x.estado = (x.estado && buscarEn(CAT.estadosExpediente, x.estado)) || CAT.estadosExpediente[0];
      x.checklist = (CAT.checklists[x.tramite] || []).map((q) => ({ t: q, ok: false }));
    }
    plan.items.push(x);
  });
  return plan;
}

function confirmarImport(plan) {
  const seg = state.perfil === 'seguros';
  const nombreItems = seg ? 'pólizas' : 'expedientes';
  openModal(`
    <h2>Confirmar importación</h2>
    <div class="kpis">
      <div class="kpi"><div class="v">${plan.clientes.length}</div><div class="l">Clientes nuevos</div></div>
      <div class="kpi"><div class="v">${plan.items.length}</div><div class="l">${nombreItems} nuevas</div></div>
      <div class="kpi"><div class="v">${plan.existentes}</div><div class="l">Filas de clientes que ya existían</div></div>
      ${plan.pagos.length ? `<div class="kpi"><div class="v">${plan.pagos.length}</div><div class="l">Pólizas marcadas como pagadas</div></div>` : ''}
    </div>
    ${plan.sinNombre ? `<p class="muted">⚠️ ${plan.sinNombre} filas sin nombre se omitirán.</p>` : ''}
    ${plan.dupItems ? `<p class="muted">⚠️ ${plan.dupItems} ${nombreItems} ya existían (mismo número) y se omitirán.</p>` : ''}
    ${plan.avisos.length ? `<details><summary class="muted">⚠️ ${plan.avisos.length} avisos</summary><div class="muted">${plan.avisos.slice(0, 50).map(esc).join('<br>')}</div></details>` : ''}
    <h3>Vista previa</h3>
    <div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Teléfono</th><th>${seg ? 'Aseguradora' : 'Trámite'}</th><th>${seg ? 'Vence' : 'Estado'}</th></tr></thead><tbody>
      ${plan.clientes.slice(0, 8).map((c) => { const x = plan.items.find((i) => i.cliente_id === c.id) || {}; return `<tr><td>${esc(c.nombre)}</td><td>${esc(c.telefono || '')}</td><td>${esc(seg ? x.aseguradora || '' : x.tramite || '')}</td><td>${seg ? fmtDate(x.fin) : esc(x.estado || '')}</td></tr>`; }).join('')}
    </tbody></table></div>
    <div class="actions"><button class="btn sec" id="cancel">Cancelar</button><button class="btn" id="ok" ${plan.clientes.length + plan.items.length ? '' : 'disabled'}>Importar ahora</button></div>`);
  $('#cancel').onclick = closeModal;
  $('#ok').onclick = async () => {
    $('#ok').disabled = true; $('#ok').textContent = 'Importando…';
    try {
      await db.insertMany('clientes', plan.clientes.map(({ _nuevo, ...c }) => c));
      await db.insertMany(seg ? 'polizas' : 'expedientes', plan.items);
      await db.insertMany('pagos', plan.pagos);
      await db.log('importó', 'Excel', `${plan.clientes.length} clientes y ${plan.items.length} ${nombreItems}`);
      closeModal();
      toast(`Listo: ${plan.clientes.length} clientes y ${plan.items.length} ${nombreItems} importados`);
      render();
    } catch { $('#ok').disabled = false; $('#ok').textContent = 'Importar ahora'; }
  };
}

async function descargarPlantillaImport() {
  await cargarXLSX();
  const seg = state.perfil === 'seguros';
  const fila = seg
    ? { 'Nombre': 'Juan Pérez López', 'Teléfono': '55551234', 'Correo': 'juan@correo.com', 'DPI': '', 'NIT': '1234567-8', 'Fecha de nacimiento': '15/03/1985', 'Dirección': 'Zona 1, Guatemala', 'Aseguradora': 'Mapfre', 'Ramo': 'Vehículos', 'No. póliza': 'AUTO-0001', 'Suma asegurada': 150000, 'Prima neta': 3000, 'Prima total': 3480, 'Número de pagos': '10 pagos', 'Modalidad de pago': 'Visa cuotas', 'Comisión %': 15, 'Inicio de vigencia': '01/01/2026', 'Fin de vigencia': '01/01/2027', 'Estado': 'Vigente', 'Notas': '' }
    : { 'Nombre': 'María Gómez', 'Teléfono': '55554321', 'Correo': 'maria@correo.com', 'DPI': '', 'NIT': '', 'Fecha de nacimiento': '20/07/1990', 'Dirección': 'Zona 10, Guatemala', 'Trámite': 'Compraventa', 'Descripción': 'Terreno en Mixco', 'Estado': 'En proceso', 'Responsable': '', 'Fecha de inicio': '01/09/2026', 'Honorarios': 4000, 'Anticipo': 1500, 'Notas': '' };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([fila]), 'Clientes');
  XLSX.writeFile(wb, `Plantilla_importar_${seg ? 'Seguros' : 'ByC'}.xlsx`);
}

// ---------- Respaldo completo ----------
async function exportarTodo() {
  await cargarXLSX();
  toast('Preparando respaldo…');
  const tablas = ['clientes', 'prospectos', 'expedientes', 'polizas', 'pagos', 'tareas', 'plantillas', 'actividad'];
  const d = {};
  try {
    for (const t of tablas) d[t] = (await db.listAll(t)) || [];
  } catch { return; }
  const cli = new Map(d.clientes.map((c) => [c.id, c.nombre]));
  const perfil = (p) => (p === 'byc' ? 'B&C' : p === 'seguros' ? 'Seguros' : p || '');
  const cn = (id) => cli.get(id) || '';
  const fh = (s) => (s ? new Date(s).toLocaleString('es-GT') : '');
  const hojas = {
    Clientes: d.clientes.map((c) => ({ Perfil: perfil(c.perfil), Nombre: c.nombre, 'Tipo de persona': c.tipo, DPI: c.dpi, NIT: c.nit, 'Teléfono': c.telefono, Correo: c.email, 'Dirección': c.direccion, 'Fecha de nacimiento': c.fecha_nacimiento, Fuente: c.fuente, Etiquetas: c.etiquetas, Notas: c.notas, 'Creado por': c.created_by, 'Creado el': fh(c.created_at) })),
    'Pólizas': d.polizas.map((p) => { const r = estadoPagoPoliza(p, d.pagos); return { Cliente: cn(p.cliente_id), Aseguradora: p.aseguradora, Ramo: p.ramo, 'No. póliza': p.numero, 'Suma asegurada': p.suma_asegurada, 'Prima neta': p.prima_neta, 'Prima total': p.prima, 'Número de pagos': p.forma_pago, 'Modalidad de pago': p.modalidad_pago, 'Comisión %': p.comision_pct, 'Comisión Q': p.comision_pct ? Math.round(primaBase(p) * p.comision_pct) / 100 : null, 'Inicio de vigencia': p.inicio, 'Fin de vigencia': p.fin, Estado: p.estado, 'Pagado (vigencia)': r.pagado, Saldo: r.saldo, 'Estado de pago': r.estado, Notas: p.notas, 'Creado por': p.created_by }; }),
    Expedientes: d.expedientes.map((x) => { const r = estadoPagoExp(x, d.pagos); return { Cliente: cn(x.cliente_id), 'Trámite': x.tramite, 'Descripción': x.descripcion, Estado: x.estado, Responsable: x.responsable, Inicio: x.fecha_inicio, 'Fecha límite': x.fecha_limite, Honorarios: x.honorarios, Anticipo: x.anticipo, 'Total pagado': r.pagado, Saldo: r.saldo, 'Requisitos completos': (x.checklist || []).filter((i) => i.ok).map((i) => i.t).join(', '), 'Requisitos pendientes': (x.checklist || []).filter((i) => !i.ok).map((i) => i.t).join(', '), Notas: x.notas, 'Creado por': x.created_by }; }),
    Pagos: d.pagos.map((pg) => { const ref = pg.ref_tipo === 'poliza' ? d.polizas.find((p) => p.id === pg.ref_id) : d.expedientes.find((x) => x.id === pg.ref_id); return { Perfil: perfil(pg.perfil), Fecha: pg.fecha, Cliente: cn(pg.cliente_id), Concepto: !ref ? '' : pg.ref_tipo === 'poliza' ? `Póliza ${ref.ramo} ${ref.aseguradora} ${ref.numero || ''}`.trim() : `Trámite ${ref.tramite}`, Monto: pg.monto, 'Método': pg.metodo, Referencia: pg.referencia, Notas: pg.notas, 'Registrado por': pg.created_by }; }),
    Prospectos: d.prospectos.map((p) => ({ Perfil: perfil(p.perfil), Oportunidad: p.titulo, Cliente: cn(p.cliente_id), Contacto: p.contacto, 'Teléfono': p.telefono, Servicio: p.servicio, Etapa: p.etapa, Monto: p.monto, Seguimiento: p.seguimiento, Notas: p.notas, 'Creado por': p.created_by, 'Creado el': fh(p.created_at) })),
    Agenda: d.tareas.map((t) => ({ Perfil: perfil(t.perfil), Tarea: t.titulo, Tipo: t.tipo, Fecha: fh(t.fecha), Cliente: cn(t.cliente_id), Hecha: t.hecho ? 'Sí' : 'No', Notas: t.notas })),
    Plantillas: d.plantillas.map((p) => ({ Perfil: perfil(p.perfil), Nombre: p.nombre, Mensaje: p.texto })),
    Actividad: d.actividad.map((a) => ({ Fecha: fh(a.created_at), Usuario: a.usuario, Perfil: perfil(a.perfil), 'Acción': a.accion, Tipo: a.entidad, 'Descripción': a.descripcion })),
  };
  const wb = XLSX.utils.book_new();
  for (const [nombre, filas] of Object.entries(hojas)) {
    const ws = filas.length ? XLSX.utils.json_to_sheet(filas) : XLSX.utils.aoa_to_sheet([['Sin registros']]);
    if (filas.length) ws['!cols'] = Object.keys(filas[0]).map((k) => ({ wch: Math.min(40, Math.max(k.length, ...filas.slice(0, 50).map((f) => String(f[k] ?? '').length)) + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, nombre);
  }
  XLSX.writeFile(wb, `CRM_respaldo_${today()}.xlsx`);
  db.log('descargó', 'respaldo', 'Respaldo completo en Excel');
}
