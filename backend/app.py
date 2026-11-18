import sqlite3
from pathlib import Path

from flask import Flask, abort, jsonify, request, url_for
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from db import close_db, get_db, init_db


MAX_ID = 2**63 - 1


def buscar_registro(db, tabla, registro_id):
    # La tabla se recibe de las rutas, nunca de datos del cliente.
    registro = None
    if 1 <= registro_id <= MAX_ID:
        registro = db.execute(
            f"SELECT * FROM {tabla} WHERE id = ?", (registro_id,)
        ).fetchone()
    if registro is None:
        entidad = "Autor" if tabla == "autores" else "Libro"
        abort(404, description=f"{entidad} no encontrado.")
    return dict(registro)


def leer_json():
    datos = request.get_json(silent=True)
    if not isinstance(datos, dict):
        abort(400, description="El cuerpo debe ser un objeto JSON válido.")
    return datos


def leer_texto(datos, campo):
    valor = datos.get(campo)
    if not isinstance(valor, str) or not valor.strip():
        abort(400, description=f"El campo '{campo}' debe ser un texto no vacío.")
    valor = valor.strip()
    if "\x00" in valor or any(0xD800 <= ord(letra) <= 0xDFFF for letra in valor):
        abort(400, description=f"El campo '{campo}' contiene caracteres inválidos.")
    return valor


def leer_libro():
    datos = leer_json()
    titulo = leer_texto(datos, "titulo")
    autor_id = datos.get("autor_id")
    if type(autor_id) is not int or not 1 <= autor_id <= MAX_ID:
        abort(400, description="El campo 'autor_id' debe ser un entero positivo válido.")
    return titulo, autor_id


def verificar_autor(db, autor_id):
    if db.execute("SELECT id FROM autores WHERE id = ?", (autor_id,)).fetchone() is None:
        abort(400, description="El autor indicado en 'autor_id' no existe.")


def create_app(database=None):
    app = Flask(__name__)
    app.config["DATABASE"] = (
        database if database is not None else Path(__file__).with_name("biblioteca.sqlite3")
    )
    app.teardown_appcontext(close_db)
    CORS(app, origins=["http://localhost:4200"])

    with app.app_context():
        init_db()

    @app.errorhandler(HTTPException)
    def error_json(error):
        respuesta = error.get_response()
        respuesta.set_data(app.json.dumps({"error": error.description}))
        respuesta.mimetype = "application/json"
        return respuesta

    @app.after_request
    def opciones_json(respuesta):
        if request.method == "OPTIONS" and respuesta.status_code == 200:
            respuesta.set_data(app.json.dumps({}))
            respuesta.mimetype = "application/json"
        return respuesta

    @app.get("/autores")
    def listar_autores():
        filas = get_db().execute("SELECT * FROM autores ORDER BY id").fetchall()
        return jsonify([dict(fila) for fila in filas])

    @app.get("/autores/<int:registro_id>")
    def consultar_autor(registro_id):
        return jsonify(buscar_registro(get_db(), "autores", registro_id))

    @app.post("/autores")
    def crear_autor():
        nombre = leer_texto(leer_json(), "nombre")
        db = get_db()
        with db:
            cursor = db.execute("INSERT INTO autores (nombre) VALUES (?)", (nombre,))
            registro_id = cursor.lastrowid
        return (
            jsonify(id=registro_id, nombre=nombre),
            201,
            {"Location": url_for("consultar_autor", registro_id=registro_id)},
        )

    @app.put("/autores/<int:registro_id>")
    def editar_autor(registro_id):
        nombre = leer_texto(leer_json(), "nombre")
        db = get_db()
        with db:
            cursor = db.execute(
                "UPDATE autores SET nombre = ? WHERE id = ?",
                (nombre, registro_id if registro_id <= MAX_ID else None),
            )
            if not cursor.rowcount:
                abort(404, description="Autor no encontrado.")
        return jsonify(id=registro_id, nombre=nombre)

    @app.delete("/autores/<int:registro_id>")
    def eliminar_autor(registro_id):
        db = get_db()
        try:
            with db:
                cursor = db.execute(
                    "DELETE FROM autores WHERE id = ?",
                    (registro_id if registro_id <= MAX_ID else None,),
                )
                if not cursor.rowcount:
                    abort(404, description="Autor no encontrado.")
        except sqlite3.IntegrityError:
            abort(400, description="No se puede eliminar un autor con libros asociados.")
        return jsonify(mensaje="Autor eliminado.")

    @app.get("/libros")
    def listar_libros():
        consulta = "SELECT * FROM libros"
        parametros = ()
        if "autor_id" in request.args:
            valor = request.args["autor_id"]
            error_filtro = "El filtro 'autor_id' debe ser un entero positivo válido."
            if not valor.isascii() or not valor.isdecimal():
                abort(400, description=error_filtro)
            try:
                autor_id = int(valor)
            except ValueError:
                abort(400, description=error_filtro)
            if not 1 <= autor_id <= MAX_ID:
                abort(400, description=error_filtro)
            consulta += " WHERE autor_id = ?"
            parametros = (autor_id,)
        filas = get_db().execute(consulta + " ORDER BY id", parametros).fetchall()
        buscar = request.args.get("buscar", "").strip().casefold()
        return jsonify([dict(fila) for fila in filas if buscar in fila["titulo"].casefold()])

    @app.get("/libros/<int:registro_id>")
    def consultar_libro(registro_id):
        return jsonify(buscar_registro(get_db(), "libros", registro_id))

    @app.post("/libros")
    def crear_libro():
        titulo, autor_id = leer_libro()
        db = get_db()
        with db:
            # Reserva la escritura antes de verificar que el autor exista.
            db.execute("BEGIN IMMEDIATE")
            verificar_autor(db, autor_id)
            cursor = db.execute(
                "INSERT INTO libros (titulo, autor_id) VALUES (?, ?)", (titulo, autor_id)
            )
            registro_id = cursor.lastrowid
        return (
            jsonify(id=registro_id, titulo=titulo, autor_id=autor_id),
            201,
            {"Location": url_for("consultar_libro", registro_id=registro_id)},
        )

    @app.put("/libros/<int:registro_id>")
    def editar_libro(registro_id):
        titulo, autor_id = leer_libro()
        db = get_db()
        with db:
            db.execute("BEGIN IMMEDIATE")
            buscar_registro(db, "libros", registro_id)
            verificar_autor(db, autor_id)
            db.execute(
                "UPDATE libros SET titulo = ?, autor_id = ? WHERE id = ?",
                (titulo, autor_id, registro_id),
            )
        return jsonify(id=registro_id, titulo=titulo, autor_id=autor_id)

    @app.delete("/libros/<int:registro_id>")
    def eliminar_libro(registro_id):
        db = get_db()
        with db:
            cursor = db.execute(
                "DELETE FROM libros WHERE id = ?",
                (registro_id if registro_id <= MAX_ID else None,),
            )
            if not cursor.rowcount:
                abort(404, description="Libro no encontrado.")
        return jsonify(mensaje="Libro eliminado.")

    return app
