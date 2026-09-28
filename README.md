# GITHUB-CLOUD

## Tren Inferior / Superior (`index.html`)

App web de entrenamiento en un solo archivo HTML (CSS y JS embebidos), sin backend y sin dependencias. Funciona sin conexión y guarda el progreso en el `localStorage` del navegador.

- **Hoy**: detecta el día (lunes Inferior A, martes Superior A, miércoles Inferior B, jueves Superior B, viernes descanso, sábado Inferior C, domingo Superior C) y permite elegir otro día.
- **Checklist de series** con peso y reps por serie. Al marcar una serie vacía se rellena con lo sugerido.
- **Cronómetro de descanso** con anillo SVG, aviso al llegar al mínimo del rango y alarma (sonido y vibración) al terminar.
- **Sobrecarga progresiva**: si llegas al tope de reps en todas las series dos sesiones seguidas, sugiere subir 2,5–5 %.
- **Guía visual**: monigotes SVG con la posición inicial y final de cada ejercicio, más puntos clave de técnica.
- **Historial**: gráfico y tabla por ejercicio, lista de sesiones, copia de seguridad (exportar e importar).
- **Aviso de descarga** a partir de 6 semanas de uso (mismo peso, una serie menos).

Para usarla, abre `index.html` en el móvil (por ejemplo, con GitHub Pages) y añádela a la pantalla de inicio.
