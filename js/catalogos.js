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
  // Número de pagos en que se divide la prima anual.
  formasPago: ['1 pago', '2 pagos', '3 pagos', '4 pagos', '6 pagos', '10 pagos', '12 pagos'],
  // Cómo paga el cliente.
  modalidadesPago: ['Pronto pago (efectivo / transferencia)', 'Visa cuotas', 'Fraccionado (crédito de la aseguradora)', 'Débito a cuenta', 'Otro'],
  estadosPoliza: ['Vigente', 'Cancelada', 'No renovada'],
  motivosBaja: ['Precio / lo encontró más barato', 'Se fue con otra aseguradora o agente', 'Vendió el vehículo o bien asegurado',
    'Ya no lo necesita', 'Problemas económicos', 'Mala experiencia con un reclamo', 'Falta de pago', 'Otro'],

  // Nombres alternativos para reconocer la aseguradora al importar desde Excel.
  aliasAseguradoras: {
    'Seguros G&T': ['g&t', 'gyt', 'g y t', 'g t'],
    'Seguros El Roble': ['roble'],
    'Seguros Ceiba': ['ceiba'],
    'Mapfre': ['mapfre'],
    'Seguros BAM': ['bam', 'agromercantil'],
    'Aseguradora Rural': ['rural'],
    'CHN Seguros': ['chn', 'credito hipotecario'],
    'Aseguradora Guatemalteca': ['guatemalteca'],
    'Seguros Privanza': ['privanza'],
    'Seguros Universales': ['universales'],
    'Aseguradora General': ['general'],
  },

  metodosPago: ['Efectivo', 'Transferencia', 'Depósito', 'Visa cuotas', 'Tarjeta', 'Débito a cuenta', 'Cheque', 'Cobro directo aseguradora'],

  // Plantillas de WhatsApp iniciales (luego se editan desde el CRM, sección "Plantillas").
  // Variables: {nombre} {nombre_completo} {empresa} {aseguradora} {ramo} {poliza} {vence}
  //            {monto} {saldo} {tramite} {estado} {pendientes}
  plantillas: {
    seguros: [
      { nombre: 'Cumpleaños', texto: '¡Feliz cumpleaños, {nombre}! 🎉🎂\n\nDe parte de todo el equipo de {empresa} le deseamos un año lleno de salud, bendiciones y muchos éxitos. Gracias por permitirnos cuidar de lo que más valora. 🙏' },
      { nombre: 'Bienvenida', texto: 'Hola {nombre}, ¡bienvenido(a) a {empresa}! 🤝\n\nEs un gusto acompañarle. Guarde este número: estamos para servirle en cualquier consulta, reclamo o cotización que necesite.' },
      { nombre: 'Saludo / seguimiento', texto: 'Hola {nombre}, ¿cómo está? 😊 Le saluda {empresa}. Solo queríamos saber cómo le va y recordarle que estamos a la orden para lo que necesite.' },
      { nombre: 'Recordatorio de renovación', texto: 'Buen día {nombre}, le saluda {empresa}. Le recordamos que su póliza de {ramo} con {aseguradora} vence el {vence}. ¿Le ayudamos con la renovación? Con gusto le cotizamos las mejores opciones. 📋' },
      { nombre: 'Recordatorio de pago', texto: 'Hola {nombre}, un gusto saludarle. Le recordamos amablemente el pago de su póliza de {ramo} con {aseguradora} por {monto}. Cualquier consulta estamos a la orden. ¡Gracias! 🙌' },
      { nombre: 'Gracias por su pago', texto: '¡Muchas gracias, {nombre}! ✅ Confirmamos la recepción de su pago. Su póliza de {ramo} con {aseguradora} sigue protegiéndole. Gracias por su confianza.' },
      { nombre: 'Felices fiestas', texto: '{nombre}, en estas fiestas todo el equipo de {empresa} le desea mucha paz, unión y un próspero año nuevo junto a sus seres queridos. 🎄✨' },
    ],
    byc: [
      { nombre: 'Cumpleaños', texto: '¡Feliz cumpleaños, {nombre}! 🎉🎂\n\nDe parte de {empresa} le deseamos un año lleno de salud, bendiciones y éxitos. Es un honor contar con su confianza. 🙏' },
      { nombre: 'Bienvenida', texto: 'Hola {nombre}, gracias por confiar en {empresa}. 🤝 Guarde este número; por aquí le mantendremos al tanto de su trámite y estamos para resolver cualquier duda.' },
      { nombre: 'Saludo / seguimiento', texto: 'Hola {nombre}, ¿cómo está? 😊 Le saluda {empresa}. Queríamos saludarle y recordarle que estamos a la orden para cualquier asesoría legal o notarial.' },
      { nombre: 'Avance del trámite', texto: 'Buen día {nombre}, le saluda {empresa}. Le informamos que su trámite de {tramite} se encuentra en estado: *{estado}*. Le mantendremos al tanto de cada avance.' },
      { nombre: 'Documentos pendientes', texto: 'Hola {nombre}, para continuar con su trámite de {tramite} necesitamos lo siguiente:\n{pendientes}\n\nQuedamos atentos. ¡Gracias!' },
      { nombre: 'Trámite listo', texto: '¡Buenas noticias, {nombre}! 🎉 Su trámite de {tramite} está listo para entrega. ¿Qué día y hora le queda bien pasar a nuestra oficina?' },
      { nombre: 'Recordatorio de saldo', texto: 'Hola {nombre}, un gusto saludarle. Le recordamos amablemente el saldo pendiente de {saldo} por su trámite de {tramite}. ¡Gracias por su confianza!' },
      { nombre: 'Felices fiestas', texto: '{nombre}, en estas fiestas {empresa} le desea mucha paz, unión y un próspero año nuevo junto a sus seres queridos. 🎄✨' },
    ],
  },
};
