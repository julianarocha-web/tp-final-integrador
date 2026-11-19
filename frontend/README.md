# Frontend de Biblioteca

Aplicación Angular 21 con componentes standalone, TypeScript y SCSS. El catálogo abre en Libros y permite pasar a Autores desde la navegación principal.

## Ejecutar en Windows PowerShell

En una terminal, ubicá el repositorio y ejecutá Flask. Ajustá la ruta si guardaste el proyecto en otra carpeta.

```powershell
Set-Location -LiteralPath 'C:\Users\SuperJupi\Desktop\TP-FINAL' -ErrorAction Stop
if (-not (Test-Path '.\.venv\Scripts\python.exe')) { py -3 -m venv .venv }
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Set-Location backend
..\.venv\Scripts\python.exe -m flask --app app run --port 8765
```

En otra terminal, ejecutá Angular.

```powershell
Set-Location -LiteralPath 'C:\Users\SuperJupi\Desktop\TP-FINAL\frontend' -ErrorAction Stop
npm.cmd ci
npm.cmd start
```

Abrí [Biblioteca](http://localhost:4200). Usá `localhost` para Angular porque Flask autoriza ese origen mediante CORS. El servicio Angular envía las solicitudes a `http://127.0.0.1:8765`.

## Compilar y probar

Desde `frontend`:

```powershell
npm.cmd run build
npm.cmd test -- --watch=false
```

Las pruebas unitarias verifican los parámetros de búsqueda, las validaciones, el desplegable de autores y el mensaje de Flask cuando se intenta eliminar un autor con libros asociados.

## Recorrido de comprobación

1. En **Autores**, creá un autor, abrí su detalle y editá su nombre.
2. En **Libros**, probá guardar el formulario vacío. Ingresá un título, elegí el autor y guardá. Abrí el detalle y editá el libro.
3. En el listado de libros, buscá por parte del título y elegí el autor. Probá una búsqueda sin resultados y usá **Limpiar** para volver al catálogo.
4. Intentá eliminar el autor mientras tenga un libro asociado. Confirmá el borrado y observá el mensaje de Flask. Eliminá primero el libro y luego el autor.
5. Reducí el ancho del navegador para ver cómo se apilan los filtros y los registros.

## Organización

- `models.ts` define los datos de libros y autores. `api.service.ts` centraliza las solicitudes y los mensajes de error de la API.
- `listado.*`, `detalle.*` y `formulario.*` implementan las pantallas. Las rutas indican qué entidad corresponde a cada pantalla.
- `app.routes.ts` define listado, alta, detalle por ID y edición por ID para cada entidad. `app.config.ts` configura el enrutador y `HttpClient`.
- `validacion.ts` valida el texto obligatorio y la selección de autor. `styles.scss` establece el diseño general y la adaptación a pantallas pequeñas.
- `app.spec.ts` contiene las pruebas de Angular.

La sección **Chatbot** envía preguntas a `POST /chatbot`. La configuración local de Gemini y el recorrido de prueba están en el [README general](../README.md#chatbot-con-google-gemini).
