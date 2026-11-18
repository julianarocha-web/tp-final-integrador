# Biblioteca · Trabajo Práctico Final Integrador

Primera entrega (18/11) de Aplicaciones Híbridas y Clientes Web Mobile. API REST para gestionar los autores y los libros de una biblioteca. El rubro Biblioteca queda sujeto a confirmación con el docente.

## Modelo y tecnologías

Un autor puede tener cero, uno o varios libros. Cada libro pertenece a un solo autor.

| Tabla | Campos |
| --- | --- |
| `autores` | `id` (clave primaria), `nombre` (texto obligatorio) |
| `libros` | `id` (clave primaria), `titulo` (texto obligatorio), `autor_id` (clave foránea obligatoria a `autores.id`) |

El backend usa Python 3.10 o posterior, Flask, SQLite mediante el módulo estándar `sqlite3` y Flask-CORS. Las pruebas usan `unittest` y el cliente de pruebas de Flask.

## Instalar y ejecutar en Windows

Con Python instalado, desde la raíz del proyecto en PowerShell:

```powershell
py -3 -m venv .venv
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
| `frontend/.gitkeep` | Permite conservar en Git la carpeta reservada para Angular. |
| `.gitignore` | Excluye entornos virtuales, bases locales, cachés y archivos `.env`. |
| `README.md` | Documenta los pasos de puesta en marcha, las pruebas y la exposición. |

SQLite permite trabajar con un archivo local y dos tablas. Las sentencias usan parámetros para separar los valores del SQL. La conexión activa las claves foráneas en cada apertura; al crear o editar un libro, una transacción reserva la escritura antes de verificar su autor, de modo que otra solicitud no pueda borrarlo entre la verificación y la escritura. Al borrar un autor, la restricción de SQLite protege los libros asociados y Flask traduce el rechazo a 400. Para el volumen de la biblioteca del TP, la búsqueda por título usa `casefold()` en Python para manejar mayúsculas y minúsculas Unicode. CORS autoriza a `http://localhost:4200`, el origen previsto para Angular. [Patrón de conexión SQLite en Flask](https://flask.palletsprojects.com/en/stable/patterns/sqlite3/)

## Uso de IA

Se usó Codex para generar la implementación inicial a partir de la consigna, redactar la documentación y preparar y ejecutar pruebas. Las decisiones que conviene poder defender son cómo se valida cada solicitud, qué garantiza la clave foránea, por qué se usa una transacción al guardar libros y cómo se diferencia un 400 de un 404. La API de esta entrega funciona con Flask y SQLite, sin conexión a un proveedor de IA.

## Git y segunda entrega

Conviene hacer el primer commit cuando hayas revisado los archivos y ejecutado las pruebas. Desde la raíz, si todavía no hay repositorio, ejecutá `git init -b main`. Después revisá lo que va a entrar en el commit:

```powershell
git add .gitignore README.md backend frontend/.gitkeep
git diff --cached --stat
git diff --cached
git commit -m "Implementar API REST de biblioteca"
```

Para subirlo, creá un repositorio vacío en GitHub. Luego ejecutá `git remote add origin <URL-del-repositorio>` y `git push -u origin main` si tu rama se llama `main`. Usá ese mismo repositorio para la segunda entrega.

Para el 20/11 quedan pendientes:

- Angular con componentes standalone organizados por responsabilidad y servicios con `HttpClient`. Los componentes consumen esos servicios.
- Rutas de listado, detalle con parámetro y formulario, altas y ediciones con validaciones visibles, datos relacionados desde la API y buscador o filtros.
- Estados visibles de carga y error, diseño responsive para celular y al menos tres pruebas unitarias que pasen.
- Componente propio de chatbot en Angular y ruta propia en Flask. Angular se comunica con Flask, y Flask consulta datos reales de la aplicación y se comunica con el proveedor de IA.
- Seleccionar un proveedor, investigar sus límites gratuitos y documentar la decisión. La clave permanece en el backend y fuera de Git.

## Guion para la exposición de 10 minutos

| Tiempo | Qué mostrar y explicar |
| --- | --- |
| 0–1 min | Presentá el problema. La biblioteca necesita gestionar autores y libros. |
| 1–3 min | Abrí `schema.sql`. Explicá que la clave foránea vive en `libros`, que varios libros pueden apuntar al mismo autor y que `RESTRICT` conserva la integridad. |
| 3–5 min | Seguí un POST en `app.py`. Mostrá cómo se valida el JSON, se verifica el autor, se escribe en SQLite y se devuelve 201. Indicá dónde `db.py` habilita claves foráneas. |
| 5–8 min | Desde PowerShell, creá un autor y un libro, listá con los filtros combinados, intentá borrar el autor y mostrá el 400. Borrá el libro, borrá el autor y mostrá el 404 del GET posterior. |
| 8–9 min | Ejecutá las pruebas. Mostrá la base temporal y el caso OPTIONS que verifica el permiso para Angular. |
| 9–10 min | Explicá qué aportó Codex, qué comprobaste y cómo se conectarán Angular y el chatbot en la próxima entrega. |
