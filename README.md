# Biblioteca · Trabajo Práctico Final Integrador

Trabajo de Aplicaciones Híbridas y Clientes Web Mobile. La biblioteca integra una API REST, un cliente Angular y un chatbot para consultar el catálogo. El rubro Biblioteca queda sujeto a confirmación con el docente.

## Modelo y tecnologías

Un autor puede tener cero, uno o varios libros. Cada libro pertenece a un solo autor.

| Tabla | Campos |
| --- | --- |
| `autores` | `id` (clave primaria), `nombre` (texto obligatorio) |
| `libros` | `id` (clave primaria), `titulo` (texto obligatorio), `autor_id` (clave foránea obligatoria a `autores.id`) |

El backend usa Flask, SQLite mediante el módulo estándar `sqlite3` y Flask-CORS. El entorno verificado para el chatbot usa Python 3.12 y `google-genai` 2.34.0. Las pruebas usan `unittest` y el cliente de pruebas de Flask.

## Instalar y ejecutar en Windows

Con Python instalado, abrí PowerShell y ubicá la raíz del proyecto. Ajustá la ruta si guardaste el repositorio en otra carpeta.

```powershell
Set-Location -LiteralPath 'C:\Users\SuperJupi\Desktop\TP-FINAL' -ErrorAction Stop
if (-not (Test-Path '.\.venv\Scripts\python.exe')) { py -3 -m venv .venv }
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Set-Location backend
..\.venv\Scripts\python.exe -m flask --app app run --port 8765
```

Si tu instalación expone `python` como comando, podés usar `python -m venv .venv` en el primer paso. Invocar el Python del entorno por su ruta evita tener que activar el entorno o cambiar la política de ejecución de PowerShell.

Flask escucha en `http://127.0.0.1:8765`. El primer arranque crea `backend/biblioteca.sqlite3`. Los arranques posteriores conservan los registros. Para detener el servidor usá **Ctrl+C**.

## Rutas

| Método | Ruta | Cuerpo JSON | Éxito |
| --- | --- | --- | --- |
| GET | `/autores` | — | 200, lista |
| GET | `/autores/<id>` | — | 200, autor |
| POST | `/autores` | `{"nombre":"María López"}` | 201, autor creado |
| PUT | `/autores/<id>` | `{"nombre":"María Elena López"}` | 200, autor editado |
| DELETE | `/autores/<id>` | — | 200, confirmación |
| GET | `/libros` | — | 200, lista |
| GET | `/libros/<id>` | — | 200, libro |
| POST | `/libros` | `{"titulo":"Historia argentina","autor_id":1}` | 201, libro creado |
| PUT | `/libros/<id>` | `{"titulo":"Historia argentina ilustrada","autor_id":1}` | 200, libro editado |
| DELETE | `/libros/<id>` | — | 200, confirmación |
| POST | `/chatbot` | `{"mensaje":"¿Cuántos libros hay?"}` | 200, `{"respuesta":"…"}` |

Los POST devuelven un encabezado `Location` con la ruta del nuevo recurso. PUT requiere todos los campos obligatorios. Una solicitud con datos inválidos devuelve 400, incluso si el `autor_id` indicado en el cuerpo no existe. GET, PUT con cuerpo válido y DELETE devuelven 404 si el recurso de la ruta no existe.

El listado de libros acepta `autor_id` como entero positivo escrito con dígitos del 0 al 9 y `buscar` como fragmento literal del título. La búsqueda ignora diferencias de mayúsculas y minúsculas y conserva las diferencias de acentuación. Ambos filtros pueden combinarse. Un autor inexistente en el filtro produce una lista vacía.

## Probar los diez endpoints desde PowerShell

Con Flask en ejecución, abrí otra terminal y corré el bloque en orden. Los IDs salen de las respuestas para que el ejemplo se pueda repetir. El bloque elimina los dos registros que crea.

```powershell
$base = 'http://127.0.0.1:8765'
$json = 'application/json; charset=utf-8'

# POST, GET de lista, GET por ID y PUT de autores
$autor = Invoke-RestMethod -Method Post -Uri "$base/autores" -ContentType $json -Body '{"nombre":"María López"}'
$autorUrl = "$base/autores/$($autor.id)"
Invoke-RestMethod -Uri "$base/autores"
Invoke-RestMethod -Uri $autorUrl
Invoke-RestMethod -Method Put -Uri $autorUrl -ContentType $json -Body '{"nombre":"María Elena López"}'

# POST, GET de lista, GET por ID y PUT de libros
$libro = Invoke-RestMethod -Method Post -Uri "$base/libros" -ContentType $json -Body (@{titulo='Historia argentina'; autor_id=$autor.id} | ConvertTo-Json)
$libroUrl = "$base/libros/$($libro.id)"
Invoke-RestMethod -Uri "$base/libros"
Invoke-RestMethod -Uri $libroUrl
Invoke-RestMethod -Method Put -Uri $libroUrl -ContentType $json -Body (@{titulo='Historia argentina ilustrada'; autor_id=$autor.id} | ConvertTo-Json)

# Filtros individuales y combinados
Invoke-RestMethod -Uri "$base/libros?autor_id=$($autor.id)"
Invoke-RestMethod -Uri "$base/libros?buscar=historia"
Invoke-RestMethod -Uri "$base/libros?autor_id=$($autor.id)&buscar=historia"

# CORS y errores. curl.exe -i muestra los encabezados y el código HTTP.
curl.exe -i -X OPTIONS "$libroUrl" -H "Origin: http://localhost:4200" -H "Access-Control-Request-Method: PUT" -H "Access-Control-Request-Headers: Content-Type"
curl.exe -i "$base/libros?autor_id=abc"
curl.exe -i -X POST "$base/autores" -H "Content-Type: application/json" -d "{}"
curl.exe -i -X DELETE "$autorUrl"

# DELETE de libros y autores. El GET final devuelve 404.
Invoke-RestMethod -Method Delete -Uri $libroUrl
Invoke-RestMethod -Method Delete -Uri $autorUrl
curl.exe -i "$autorUrl"
```

Ejemplo de respuesta de `POST /libros` (201):

```json
{"id":1,"titulo":"Historia argentina","autor_id":1}
```

Ejemplo de respuesta de `DELETE /autores/1` con libros asociados (400):

```json
{"error":"No se puede eliminar un autor con libros asociados."}
```

Ejemplo de respuesta de `GET /autores/1` después de eliminarlo (404):

```json
{"error":"Autor no encontrado."}
```

## Pruebas automatizadas

Desde la raíz, con las dependencias instaladas:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s backend -v
```

Cada prueba usa su propia base SQLite temporal. La suite cubre los dos CRUD, la edición del autor de un libro, los filtros, el JSON inválido, los campos obligatorios, los tipos, los identificadores inexistentes, la restricción de borrado, la clave foránea y CORS.

## Archivos y decisiones técnicas

| Archivo | Responsabilidad |
| --- | --- |
| `backend/app.py` | Configura Flask y CORS, define las rutas, valida los datos y convierte los errores en JSON. |
| `backend/db.py` | Abre una conexión SQLite por contexto de Flask, habilita las claves foráneas, inicializa el esquema y cierra la conexión al terminar. |
| `backend/schema.sql` | Define las dos tablas, impide borrar autores con libros mediante `ON DELETE RESTRICT` e indexa `libros.autor_id` para el filtro y las comprobaciones de la relación. |
| `backend/requirements.txt` | Declara las dependencias que instala pip. |
| `backend/test_app.py` | Ejecuta las pruebas de los endpoints con una base aislada por prueba. |
| `backend/chatbot.py` | Lee el catálogo actual, configura el SDK de Gemini y traduce errores del proveedor a mensajes de la aplicación. |
| `backend/test_chatbot.py` | Prueba la ruta, el contexto SQLite y los errores con el proveedor simulado. |
| `frontend/` | Aplicación Angular para gestionar autores y libros. |
| `.gitignore` | Excluye entornos virtuales, bases locales, cachés y archivos `.env`. |
| `README.md` | Documenta los pasos de puesta en marcha, las pruebas y la exposición. |

SQLite permite trabajar con un archivo local y dos tablas. Las sentencias usan parámetros para separar los valores del SQL. La conexión activa las claves foráneas en cada apertura; al crear o editar un libro, una transacción reserva la escritura antes de verificar su autor, de modo que otra solicitud no pueda borrarlo entre la verificación y la escritura. Al borrar un autor, la restricción de SQLite protege los libros asociados y Flask traduce el rechazo a 400. Para el volumen de la biblioteca del TP, la búsqueda por título usa `casefold()` en Python para manejar mayúsculas y minúsculas Unicode. CORS autoriza a `http://localhost:4200`, el origen previsto para Angular. [Patrón de conexión SQLite en Flask](https://flask.palletsprojects.com/en/stable/patterns/sqlite3/)

## Uso de IA

Se usó Codex para implementar y revisar el proyecto, consultar documentación oficial y preparar y ejecutar pruebas. Durante la ejecución de la aplicación, Gemini interviene en las consultas al chatbot. Los CRUD se gestionan en Flask y SQLite.

## Publicar la entrega final

El backend inicial ya está publicado en `origin/main`. Desde la raíz del mismo repositorio, prepará el backend actualizado y el frontend completo y revisá el contenido del próximo commit.

```powershell
git add -- .gitignore README.md backend/ frontend/
git status --short
git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
```

Confirmá que la lista incluya `backend/.env.example` y el código del chatbot. `backend/.env`, las bases locales, los entornos virtuales y los archivos temporales deben quedar fuera. Después publicá el commit en la rama existente.

```powershell
git commit -m "Completar TP de Biblioteca con Angular y chatbot Gemini"
git push origin main
git status -sb
```

## Segunda entrega

El frontend Angular implementa los dos CRUD, la navegación por ID, los filtros de libros y los estados de la interfaz. Las instrucciones para ejecutar Angular en PowerShell y probar la integración están en [el README del frontend](frontend/README.md).

### Chatbot con Google Gemini

Se eligió Gemini 3.5 Flash-Lite (`gemini-3.5-flash-lite`) porque es un modelo de texto de baja latencia con nivel gratuito publicado y SDK oficial para Python (`google-genai`). Flask usa `GEMINI_MODEL` para configurar el modelo. [Precios oficiales de Gemini](https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite) · [SDK oficial](https://github.com/googleapis/python-genai)

- **Nivel gratuito.** Google publica entrada y salida estándar de texto gratuitas. Las cuotas de solicitudes por minuto (RPM), tokens de entrada por minuto (TPM) y solicitudes por día (RPD) se aplican por proyecto. Para conocer los valores de tu proyecto, seleccionalo en AI Studio y buscá la fila de Gemini 3.5 Flash-Lite. [Documentación de cuotas](https://aistudio.google.com/docs/rate-limits#current-rate-limits) · [Cuotas activas del proyecto](https://aistudio.google.com/rate-limit)
- **Límites por solicitud.** La ficha del modelo indica 1.048.576 tokens de entrada y 65.536 de salida. La aplicación acepta preguntas de hasta 1.000 caracteres y solicita un máximo de 2.048 tokens de salida. [Ficha oficial del modelo](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite)

#### Configurar la clave local

1. Iniciá sesión en Google AI Studio, abrí **API Keys**, seleccioná un proyecto del nivel gratuito y usá **Create API key**. Revisá el modelo y sus cuotas en el panel **Rate Limit** del proyecto. [Crear una clave](https://aistudio.google.com/api-keys) · [Guía oficial](https://aistudio.google.com/docs/api-key)
2. Desde la raíz del repositorio, en PowerShell, copiá la plantilla si todavía no tenés el archivo y abrilo.

   ```powershell
   if (-not (Test-Path backend\.env)) { Copy-Item backend\.env.example backend\.env }
   notepad.exe backend\.env
   ```

3. Pegá la clave después de `GEMINI_API_KEY=` y guardá el archivo. El modelo se configura en `GEMINI_MODEL`. `backend/.env` está excluido de Git y Angular solo recibe el JSON de Flask.
4. Instalá las dependencias actualizadas con `.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt` desde la raíz. Iniciá Flask según el bloque de Windows de arriba y Angular con `npm.cmd start` desde `frontend`.

#### Flujo para la exposición

1. El componente **Chatbot** envía `{ "mensaje": "…" }` al servicio Angular, que ejecuta `POST /chatbot` mediante `HttpClient`.
2. Flask valida la pregunta y lee ambas tablas de SQLite en una transacción de lectura. Construye un contexto JSON con autores, libros, sus relaciones y sus totales. Cada pregunta usa el estado actual de la base.
3. El SDK envía la pregunta y el contexto a Gemini con instrucciones para responder en español usando el catálogo como única fuente y señalar los datos ausentes. Gemini recibe texto y carece de herramientas para escribir en SQLite. El historial se muestra en la pantalla y cada pregunta se procesa por separado. Google indica que puede usar contenido del nivel gratuito para mejorar sus productos. [Precios y uso de datos](https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite)
4. Flask devuelve `{ "respuesta": "…" }` y Angular la muestra como texto. Ante errores, devuelve `{"error":"…"}` con un mensaje público. Usa 400 para preguntas inválidas, 413 para cuerpos demasiado grandes, 503 si falta la clave, 429 para cuota, 504 para espera agotada y 502 para otros errores del proveedor o de conexión.

#### Probar el chatbot

Si Flask ya estaba abierto antes de instalar el chatbot, detenelo con **Ctrl+C** y volvé a iniciarlo para cargar la ruta nueva. Con ambos servidores abiertos, entrá a [Chatbot](http://localhost:4200/chatbot). Agregá un autor y un libro desde sus pantallas y preguntá por esos mismos registros. Podés probar estas consultas:

- ¿Qué libros y autores figuran en la biblioteca?
- ¿Cuántos autores y libros hay?
- ¿Qué libros de este autor están registrados? Incluí su nombre en la pregunta.
- ¿Quién escribió este libro? Incluí el título registrado.
- ¿Está registrado este título? Probá con un título existente y con uno ausente.

Si `flask --app app routes` muestra `POST /chatbot` pero el servidor devuelve 404, verificá qué instancia está escuchando en 8765. En Windows podés usar `netstat -ano -p tcp | Select-String ':8765\s+.*LISTENING'`. Cerrá con **Ctrl+C** las instancias del proyecto desde sus propias terminales, iniciá una sola desde `backend` y comprobá la ruta sin consumir cuota de Gemini.

```powershell
curl.exe -i -X OPTIONS 'http://127.0.0.1:8765/chatbot' -H 'Origin: http://localhost:4200' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: Content-Type'
```

El servidor actualizado responde **200** al preflight y permite el origen `http://localhost:4200`. Si el preflight devuelve 404, el navegador puede mostrar un error de conexión antes de enviar el POST.

Las pruebas automatizadas usan dobles de prueba del proveedor y se ejecutan sin credenciales. Corré `.\.venv\Scripts\python.exe -m unittest discover -s backend -v` desde la raíz y `npm.cmd test -- --watch=false` desde `frontend`.

## Guion para la exposición de 10 minutos

| Tiempo | Qué mostrar y explicar |
| --- | --- |
| 0–1 min | Presentá el problema. La biblioteca necesita gestionar autores y libros. |
| 1–2:30 min | Mostrá `schema.sql` y `db.py`. Explicá la relación 1 a N, la clave foránea activa y el borrado restringido. |
| 2:30–5:30 min | En Angular, creá un autor y un libro de demostración. Mostrá el título obligatorio, el desplegable, el detalle por ID, la edición y ambos filtros. Intentá borrar el autor asociado para mostrar el 400. Con la pestaña Red, seguí una solicitud desde el servicio `HttpClient` hasta Flask. |
| 5:30–6:30 min | Cambiá a vista móvil y mostrá el listado, los filtros y un formulario. Explicá que usan la misma API que la vista de escritorio. |
| 6:30–8:30 min | Preguntá al chatbot por el libro de demostración y por un título ausente. Mostrá la secuencia Angular → Flask → SQLite → Gemini → Flask → Angular. Explicá por qué Flask lee el catálogo en cada consulta y dónde se configura la clave. |
| 8:30–10 min | Borrá el libro y el autor de demostración en ese orden. Mostrá los resultados de las pruebas y de la compilación de producción. Explicá cómo usaste Codex y qué verificaste con mocks y con Gemini real. |
