# Sitio web oficial — Rotaract Club Samborondón

Fecha: 2026-11-19 · Estado: borrador para aprobación

## Intención

El club quiere su sitio oficial: presentar al club, permitir que la gente se
inscriba a actividades, done con comprobante y los contacte. Todo debe
funcionar sin costo (hosting y datos) y ser administrable por el directorio
desde una hoja de cálculo, sin tocar código.

## Objetivos

- Sitio bilingüe **español / inglés**, español por defecto, con botón ES/EN
  que recuerda la elección.
- Línea gráfica moderna, coherente con la identidad Rotaract (cranberry
  `#D41367`, rueda Rotary, modo claro/oscuro) que ya usa `index.html`.
- **Actividades** cargadas desde Google Sheets: la web las lista solas.
- **Inscripción** por actividad con **cupos**: la web muestra "quedan N
  cupos" y cierra la inscripción cuando se llena.
- **Donaciones** por intención + **comprobante**: el donante sube imagen/PDF,
  se guarda en Google Drive y queda "Pendiente" hasta que el club lo valide.
- **Formulario de contacto** que guarda el mensaje en la hoja.
- Mostrar Instagram **@rotaract_samborondon** y el correo
  **samborondon.rtc4400@gmail.com**.
- Deploy gratis.

## No-objetivos

- Cobro en línea con tarjeta (PayPal/Payphone). Descartado por comisiones.
- Panel de administración propio: la administración es la hoja de Google.
- Cuentas de usuario / login para el público.
- Excel / Microsoft 365 (requiere pago).

## Anti-objetivos (sería un fracaso aunque "funcione")

- Que dependa de la cuenta personal de un miembro: todo vive en la cuenta
  samborondon.rtc4400@gmail.com.
- Que actualizar una actividad requiera editar código.
- Que los comprobantes (datos bancarios de terceros) queden públicos.
- Que se sobrevenda una actividad por dos inscripciones simultáneas.

## Restricciones

- Costo cero: GitHub Pages + Google Sheets + Apps Script + Drive.
- Sitio estático (sin build), igual que el `index.html` actual.
- Límites de Apps Script (cuenta gratuita): suficientes para el volumen de
  un club; archivos de comprobante limitados a **5 MB** (imagen o PDF).

## Enfoques considerados

1. **Estático HTML/CSS/JS + Google Sheets vía Apps Script (elegido).**
   Sin servidor, gratis, el club edita la hoja. Un poco de latencia
   (1–3 s) al cargar actividades.
2. **Google Forms incrustado.** Cero código, pero se ve genérico, no se
   integra con la línea gráfica, el bilingüe es torpe y no maneja cupos bien.
3. **Formspree / Netlify Forms.** Gratis con límites mensuales, no lee
   actividades ni cupos y no gestiona archivos a Drive.
4. **Framework (Astro/Next) + base de datos.** Más potente pero agrega
   build, dependencias y algo que el club tendría que mantener.

Se eligió (1) porque es el único que cumple costo cero, administración
desde la hoja y diseño propio a la vez.

## Diseño

### Estructura del sitio (una página, secciones)

1. **Inicio (hero):** nombre del club, distrito 4400, lema, botones
   "Inscríbete" y "Dona".
2. **Quiénes somos:** datos del club (fundado 2019, socios, áreas de
   enfoque) y directorio (contenido existente).
3. **Actividades:** tarjetas desde la hoja: título, fecha, lugar,
   descripción, imagen opcional, barra de cupos, botón "Inscribirme".
   Al agotarse: "Cupos agotados". Actividades pasadas o con `Activa = NO`
   no se muestran.
4. **Dona:** explicación, datos bancarios del club (desde la pestaña
   Config de la hoja), formulario: nombre, correo, teléfono, monto,
   destino (actividad o "Donación general"), comprobante (archivo).
5. **Contacto:** formulario (nombre, correo, teléfono opcional, mensaje),
   correo e Instagram visibles.
6. **Footer:** Instagram, correo, "Create Lasting Impact".

La presentación actual para la India (Ecuador, comida, frases en hindi)
se mueve a `/ecuador/index.html` sin cambios y se enlaza desde el footer.

### Bilingüe

- Textos fijos en un diccionario `i18n` (es/en) en JS; elementos marcados
  con `data-i18n="clave"`. Botón ES/EN en la barra; elección guardada en
  `localStorage`; `<html lang>` se actualiza.
- Contenido de actividades: columnas `Titulo_ES/Titulo_EN`,
  `Descripcion_ES/Descripcion_EN` en la hoja. Si falta el inglés, se usa
  el español.

### Google Sheets (dos hojas)

- **Base del club** (`1BCtoer8WI0_dlu2Em39qajubDY0WrLtI9XeL2yDC1Yw`): datos del
  club (Resumen, Actividades, Socios, Aliados, Donaciones, Aspirantes). No tiene
  nada específico de la web.
- **Web · Rotaract Samborondón** (`1vShNAPLCpBmjQh412bGeFvU6xp9hg-ZT-QZN5cCfHOo`):
  Cómo funciona, Actividades web (extras por ID: mostrar, cupos, donaciones,
  inglés, imagen), Inscripciones, Donaciones (Pendiente/Validada/Rechazada),
  Mensajes, Configuración, y copias de solo lectura vía IMPORTRANGE
  (Base · Actividades, Base · Directiva, Base · Aliados).
- **Base → Web:** el script lee la Base directamente (openById) para
  actividades, directiva y aliados; las copias IMPORTRANGE son para consulta y
  para la lista desplegable de IDs.
- **Web → Base:** contacto "Quiero ser parte del club" → Aspirantes; donación
  marcada *Validada* → Donaciones (activador instalable `onDonationEdit`, lo
  crea `setup()`).
- El script se pega en la hoja **Web**.

### Apps Script (Web App, el puente)

- `GET ?action=activities` → JSON de actividades activas y futuras con
  `cuposRestantes` y datos bancarios de Config.
- `POST` con `action` = `register` | `donate` | `contact`.
  - `register`: con `LockService`, recalcula inscritos; si hay cupo,
    agrega la fila; si no, responde "lleno". Rechaza el mismo correo dos
    veces en la misma actividad.
  - `donate`: recibe el archivo en base64, valida tipo (jpg/png/pdf) y
    tamaño (≤5 MB), lo guarda en la carpeta Drive "Comprobantes
    Donaciones" (privada, solo el club), escribe la fila con el enlace y
    Estado = Pendiente.
  - `contact`: agrega la fila.
  - Las tres envían aviso por correo a la cuenta del club.
- Antispam: campo trampa oculto (honeypot) + validación de campos.
- El frontend envía como `text/plain` para evitar el preflight CORS de
  Apps Script.

### Deploy

GitHub Pages desde la rama `main` del repo existente
(`jatobrun26/rac-samborondon`). Dominio propio opcional después.
Se incluye `docs/SETUP.md` con los pasos para crear la hoja, pegar el
script, publicarlo y poner su URL en `config.js`.

## Decidido con el club

- Google Sheets en vez de Excel (por costo).
- Donación = intención + comprobante subido a Drive, validación manual.
- Cupos definidos por actividad en la hoja.

## Decisiones mías (corregibles)

- Español por defecto.
- La página de la India pasa a `/ecuador/`.
- Límite de 5 MB por comprobante; jpg/png/pdf.
- Un correo no puede inscribirse dos veces a la misma actividad.
- Aviso por correo al club en cada envío; sin correo de confirmación al
  usuario (se puede agregar).
- GitHub Pages como hosting.
- El club hace la configuración de Google (yo no tengo acceso a la cuenta):
  el script incluye una función `setup()` que crea pestañas, encabezados,
  fórmulas y la carpeta de Drive automáticamente; `docs/SETUP.md` explica
  pegar el script, correr `setup()` y publicar. Pruebas locales con datos
  de ejemplo cuando no hay URL configurada.
- `Cupos_Totales` vacío = sin límite. "Futura" = hasta el fin del día,
  hora de Guayaquil.

## Queda al constructor

- Detalles visuales, animaciones, iconos.
- Estructura de archivos JS/CSS.
- Textos de apoyo en inglés.
