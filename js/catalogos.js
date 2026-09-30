// Catálogos editables del CRM.
window.CAT = {
  etapas: ['Nuevo', 'Contactado', 'Cita', 'Propuesta / Cotización', 'Ganado', 'Perdido'],
  fuentes: ['Referido', 'Facebook', 'Instagram', 'WhatsApp', 'Google', 'Visita a oficina', 'Cliente anterior', 'Otro'],
  tiposPersona: ['Individual', 'Jurídica'],
  tiposTarea: ['Llamada', 'WhatsApp', 'Cita', 'Seguimiento', 'Audiencia', 'Cobro', 'Renovación', 'Otro'],

  // ---- B&C Abogados y Notarios ----
  tramites: ['Traspaso', 'Inactivación', 'Reposición', 'Patente de comercio', 'Sociedad',
    'Escritura', 'Compraventa', 'Caso penal', 'Acompañamiento', 'ONG', 'Otro'],
  estadosExpediente: ['Recepción de documentos', 'En proceso', 'En institución / registro',
    'Listo para entrega', 'Entregado', 'Cancelado'],
  // Requisitos sugeridos por trámite (se copian al expediente y ahí se pueden marcar).
  checklists: {
    'Traspaso': ['DPI de comprador y vendedor', 'Documento del bien (título/tarjeta)', 'Solvencias', 'Pago de impuesto', 'Firma de las partes', 'Inscripción / registro'],
    'Inactivación': ['DPI del propietario', 'Documento del bien', 'Formulario firmado', 'Pago', 'Presentación ante institución'],
    'Reposición': ['DPI del solicitante', 'Denuncia o declaración', 'Pago', 'Presentación de solicitud', 'Entrega de documento repuesto'],
    'Patente de comercio': ['DPI del propietario', 'NIT / RTU', 'Dirección del negocio', 'Formulario de solicitud', 'Pago', 'Entrega de patente'],
    'Sociedad': ['DPI de socios', 'Nombre de la sociedad', 'Escritura constitutiva', 'Inscripción provisional', 'Publicación', 'Inscripción definitiva', 'Patente de sociedad'],
    'Escritura': ['DPI de comparecientes', 'Documentos de soporte', 'Borrador revisado', 'Firma', 'Testimonio', 'Aviso / registro'],
    'Compraventa': ['DPI de comprador y vendedor', 'Certificación registral', 'Solvencia IUSI', 'Escritura de compraventa', 'Pago de impuestos', 'Inscripción en registro'],
    'Caso penal': ['Entrevista inicial', 'Documentos del caso', 'Contrato de servicios', 'Presentación de memorial', 'Audiencias'],
    'Acompañamiento': ['Datos del cliente', 'Fecha y lugar', 'Realizado'],
    'ONG': ['DPI de asociados', 'Estatutos', 'Escritura constitutiva', 'Inscripción en registro', 'NIT / RTU'],
    'Otro': ['Recepción de documentos', 'Trámite', 'Entrega'],
  },

  // ---- Seguros Bobadilla ----
  aseguradoras: ['Aseguradora General', 'Seguros El Roble', 'Seguros Ceiba', 'Mapfre', 'Seguros G&T',
    'Seguros BAM', 'Aseguradora Rural', 'CHN Seguros', 'Aseguradora Guatemalteca', 'Seguros Privanza',
    'Seguros Universales'],
  ramos: ['Vehículos', 'Gastos médicos', 'Vida', 'Hogar / Daños', 'Empresarial', 'Fianzas', 'Accidentes personales', 'Otro'],
  formasPago: ['Anual', 'Semestral', 'Trimestral', 'Mensual'],
  estadosPoliza: ['Vigente', 'Cancelada', 'No renovada'],
};
