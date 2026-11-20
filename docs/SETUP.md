# Conectar la página web con las hojas del club

Hay dos hojas:

| Hoja | Qué tiene |
|---|---|
| **Base del club · Rotaract Samborondón** | Los datos del club: Actividades, Socios, Aliados, Donaciones, Aspirantes, Resumen. |
| **Web · Rotaract Samborondón** | Todo lo de la página: Actividades web, Inscripciones, Donaciones, Mensajes, Configuración, y copias de solo lectura de la Base. |

Flujo:

- **Base → Web:** actividades, directiva (Socios: nombre y cargo) y aliados.
- **Web → Base:** aspirantes (desde Mensajes) y donaciones ya validadas (desde Donaciones).

Un script de Google (gratis) hace de puente entre la página y las hojas. Se
configura **una sola vez** y toma unos 10 minutos.

> Hazlo con la cuenta **dueña de las dos hojas**. Lo ideal es
> samborondon.rtc4400@gmail.com, así nada depende de una cuenta personal. Si las
> hojas son de otra cuenta, primero transfiérele la propiedad de **ambas**
> (Compartir → cambiar a "Propietario").

## 1. Pegar el script

1. Abre la hoja **Web · Rotaract Samborondón** → menú **Extensiones → Apps Script**.
2. Borra lo que haya en `Código.gs` y pega todo el contenido de
   [`apps-script/Code.gs`](../apps-script/Code.gs).
3. Arriba a la izquierda ponle de nombre **Web Rotaract** y guarda (💾).
4. En **Configuración del proyecto** (⚙️), cambia la zona horaria a
   **(GMT-05:00) Guayaquil**.

## 2. Dar permisos, crear la carpeta y el activador

1. En la barra de arriba elige la función **`setup`** y pulsa **Ejecutar**.
2. Google pedirá permisos: **Revisar permisos → tu cuenta → Configuración avanzada →
   Ir a Web Rotaract (no seguro) → Permitir**.
   (Dice "no seguro" solo porque el script es del club y no está publicado en Google.)
3. `setup` hace tres cosas:
   - Crea la carpeta privada **"Comprobantes de donaciones (web)"** en tu Drive
     y guarda su ID en *Configuración*.
   - Instala el activador que pasa las donaciones **Validadas** a la Base.
   - Muestra en el registro los datos que verá la web (para revisar).

## 3. Publicar como aplicación web

1. **Implementar → Nueva implementación**.
2. Tipo (⚙️): **Aplicación web**.
3. *Ejecutar como*: **Yo**. *Quién tiene acceso*: **Cualquier usuario**.
4. **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).

> Si luego cambias el código: **Implementar → Gestionar implementaciones → ✏️ →
> Versión: Nueva versión → Implementar**. Así la URL no cambia.

## 4. Poner la URL en la página

Abre [`assets/config.js`](../assets/config.js) y pega la URL:

```js
apiUrl: 'https://script.google.com/macros/s/XXXXXXXX/exec',
```

Guarda, haz commit y push a `main`. GitHub Pages publica solo en 1–2 minutos en
https://jatobrun26.github.io/rac-samborondon/

Mientras `apiUrl` esté vacío, la página muestra datos de ejemplo y los formularios
no envían nada (sirve para probar el diseño).

## 5. Completar *Configuración* (hoja Web)

| Dato | Qué poner |
|---|---|
| Banco, Tipo de cuenta, Número, Titular, Cédula/RUC | Los datos de la cuenta donde reciben donaciones. Si se dejan vacíos, la web dice "escríbenos y te enviamos los datos". |
| Correo para avisos | Quién recibe un correo por cada inscripción, donación o mensaje. Varios: separados por coma. |
| Fin de inscripciones (horas antes) | `0` = se puede inscribir hasta la hora de inicio. `24` = se cierra un día antes. |
| ID de la Base del club | Ya está puesto. Solo cámbialo si un día usan otra Base. |

---

# Uso diario

## Actividades

Las actividades se crean y se editan **en la Base** (pestaña *Actividades*), como
siempre. La web las toma de ahí: título, fecha, hora, lugar, tipo, aliados,
estado y "Resumen para la web".

En la hoja **Web**, pestaña **Actividades web**, se ponen solo los extras de la
página (elige el ID en la lista desplegable; nombre, fecha y estado se llenan
solos):

| Columna | Para qué |
|---|---|
| **Mostrar en la web** | `No` para ocultarla (por ejemplo, la cena del club). |
| **Cupos** | Máximo de inscritos. Vacío = sin límite. Al llenarse, la web dice "Cupos agotados". |
| **Inscritos** | Se calcula solo. |
| **Acepta donaciones** | `Sí` para mostrar "Donar a esta causa" y que aparezca en el formulario. |
| **Actividad (inglés)** / **Resumen para la web (inglés)** | Versión en inglés. Si está vacío, se muestra el español. |
| **Imagen** | Opcional. Un enlace `https://` a una imagen pública. |

Una actividad de la Base que **no** esté en *Actividades web* igual sale en la
página, sin cupos ni donaciones.

Reglas de la página:

- **Próximas actividades:** Estado distinto de *Realizada* o *Cancelada*, con fecha
  de hoy en adelante (o Estado *En curso*).
- Si el Estado no es *Confirmada* ni *En curso*, se muestra **"Fecha por confirmar"**.
- Las inscripciones se abren solo para actividades con fecha futura.
- **Lo que hemos hecho:** las 6 *Realizadas* más recientes que tengan
  "Resumen para la web".
- **Cifras:** suma de Voluntarios, Beneficiarios y Horas de las *Realizadas*. Las
  que estén en 0 no se muestran.
- **Directiva:** de *Socios* en la Base (Nombre + Cargo), sin *Socio/a* ni
  *Inactivos*. Correos y teléfonos nunca se publican.
- **Aliados:** de *Aliados* en la Base (Nombre, Tipo, Instagram).

La página se actualiza ~1 minuto después de editar las hojas.

## Validar una donación

1. Llega un correo "Nueva donación por validar" con el enlace al comprobante.
2. En la hoja **Web**, pestaña **Donaciones**, revisa el comprobante contra el banco.
3. Cambia **Estado** a **Validada**. Se copia sola a **Donaciones de la Base**
   (Tipo *Dinero*, Donante *Persona*) y se marca *Pasada a la Base = Sí*. Así el
   Resumen de la Base solo cuenta lo validado.
4. Si no corresponde, pon **Rechazada** (no pasa a la Base).

## Mensajes y aspirantes

- Todos los mensajes llegan a **Mensajes** (hoja Web) y por correo; puedes
  responder directo, el correo trae a la persona en "Responder a".
- Si eligen **"Quiero ser parte del club"**, se agregan solos a **Aspirantes de la
  Base** con Estado *Nuevo contacto* y "Cómo nos conoció: Página web". La columna
  *Pasado a Aspirantes* de Mensajes lo confirma.

## Inscripciones

Llegan a **Inscripciones** (hoja Web). Después de la actividad pueden marcar
**Asistió**. Un mismo correo no puede inscribirse dos veces en la misma actividad.

---

# Qué no se publica nunca

Responsable, Notas, Recaudado, Enlace a fotos, y correos o teléfonos de socios,
aspirantes, donantes o inscritos. El script solo envía a la página los campos
públicos.
