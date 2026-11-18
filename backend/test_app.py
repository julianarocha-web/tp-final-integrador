import sqlite3
import tempfile
import unittest
from pathlib import Path

from app import create_app
from db import get_db


class BibliotecaTest(unittest.TestCase):
    def setUp(self):
        carpeta = tempfile.TemporaryDirectory()
        self.addCleanup(carpeta.cleanup)
        self.app = create_app(Path(carpeta.name) / "prueba.sqlite3")
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def verificar(self, respuesta, codigo, esperado=None):
        self.assertEqual(respuesta.status_code, codigo, respuesta.get_data(as_text=True))
        self.assertTrue(respuesta.is_json)
        datos = respuesta.get_json()
        if esperado is not None:
            self.assertEqual(datos, esperado)
        if codigo >= 400:
            self.assertTrue(datos["error"])
        return datos

    def crear_autor(self, nombre="Autor de prueba"):
        respuesta = self.client.post("/autores", json={"nombre": nombre})
        autor = self.verificar(respuesta, 201)
        self.assertEqual(respuesta.headers["Location"], f"/autores/{autor['id']}")
        self.assertEqual(autor["nombre"], nombre)
        return autor

    def crear_libro(self, autor, titulo="Título de prueba"):
        datos = {"titulo": titulo, "autor_id": autor["id"]}
        respuesta = self.client.post("/libros", json=datos)
        libro = self.verificar(respuesta, 201)
        self.assertEqual(respuesta.headers["Location"], f"/libros/{libro['id']}")
        self.assertEqual(libro, {"id": libro["id"], **datos})
        return libro

    def test_crud_autores(self):
        self.verificar(self.client.get("/autores"), 200, [])
        autor = self.crear_autor()
        ruta = f"/autores/{autor['id']}"
        self.verificar(self.client.get("/autores"), 200, [autor])
        self.verificar(self.client.get(ruta), 200, autor)
        editado = {**autor, "nombre": "Nombre actualizado"}
        self.verificar(self.client.put(ruta, json={"nombre": editado["nombre"]}), 200, editado)
        self.verificar(self.client.get(ruta), 200, editado)
        self.verificar(self.client.delete(ruta), 200, {"mensaje": "Autor eliminado."})
        self.verificar(self.client.get(ruta), 404)
        self.verificar(self.client.put(ruta, json={"nombre": "Otro"}), 404)
        self.verificar(self.client.delete(ruta), 404)

    def test_crud_libros_y_cambio_de_autor(self):
        self.verificar(self.client.get("/libros"), 200, [])
        primero = self.crear_autor("Primer autor")
        segundo = self.crear_autor("Segundo autor")
        libro = self.crear_libro(primero)
        ruta = f"/libros/{libro['id']}"
        self.verificar(self.client.get("/libros"), 200, [libro])
        self.verificar(self.client.get(ruta), 200, libro)
        cambios = {"titulo": "Título actualizado", "autor_id": segundo["id"]}
        editado = {"id": libro["id"], **cambios}
        self.verificar(self.client.put(ruta, json=cambios), 200, editado)
        self.verificar(self.client.get(ruta), 200, editado)
        self.verificar(self.client.delete(ruta), 200, {"mensaje": "Libro eliminado."})
        self.verificar(self.client.get(ruta), 404)
        self.verificar(self.client.put(ruta, json=cambios), 404)
        self.verificar(self.client.delete(ruta), 404)

    def test_filtros(self):
        autor = self.crear_autor()
        otro = self.crear_autor("Otro autor")
        historia = self.crear_libro(autor, "HISTORIA DE ÁFRICA")
        ciencia = self.crear_libro(autor, "Ciencia")
        otra_historia = self.crear_libro(otro, "Historia argentina")
        for filtros, esperado in [
            ({"autor_id": autor["id"]}, [historia, ciencia]),
            ({"buscar": "historia"}, [historia, otra_historia]),
            ({"buscar": "áfrica"}, [historia]),
            ({"autor_id": autor["id"], "buscar": "historia"}, [historia]),
            ({"autor_id": 999}, []),
            ({"buscar": "%"}, []),
        ]:
            with self.subTest(filtros=filtros):
                self.verificar(self.client.get("/libros", query_string=filtros), 200, esperado)
        for invalido in ["", "abc", "-1", "0", "1.5", "1_0", "+1", " 1 ", str(2**63)]:
            with self.subTest(autor_id=invalido):
                self.verificar(self.client.get("/libros", query_string={"autor_id": invalido}), 400)

    def test_validaciones(self):
        autor = self.crear_autor()
        ruta_autor = f"/autores/{autor['id']}"
        libro = self.crear_libro(autor)
        ruta_libro = f"/libros/{libro['id']}"
        for metodo, ruta in [(self.client.post, "/autores"), (self.client.put, ruta_autor)]:
            for datos in [{}, {"nombre": " "}, {"nombre": 1}, {"nombre": None}, []]:
                with self.subTest(ruta=ruta, datos=datos):
                    self.verificar(metodo(ruta, json=datos), 400)
        for metodo, ruta in [(self.client.post, "/libros"), (self.client.put, ruta_libro)]:
            for titulo in [None, "", 1]:
                self.verificar(metodo(ruta, json={"titulo": titulo, "autor_id": autor["id"]}), 400)
            for autor_id in [None, "1", False, 0, -1, 1.0, 999, 2**63]:
                with self.subTest(ruta=ruta, autor_id=autor_id):
                    self.verificar(metodo(ruta, json={"titulo": "Prueba", "autor_id": autor_id}), 400)
            self.verificar(metodo(ruta, json={"titulo": "Prueba"}), 400)
        self.verificar(self.client.post("/autores", data="{", content_type="application/json"), 400)
        self.verificar(self.client.get(ruta_autor), 200, autor)
        self.verificar(self.client.get(ruta_libro), 200, libro)
        self.verificar(self.client.get(f"/libros/{2**63}"), 404)
        self.verificar(self.client.get("/autores/invalido"), 404)

    def test_integridad_referencial(self):
        autor = self.crear_autor()
        libro = self.crear_libro(autor)
        otro_libro = self.crear_libro(autor, "Segundo libro")
        ruta = f"/autores/{autor['id']}"
        error = self.verificar(self.client.delete(ruta), 400)
        self.assertIn("libros asociados", error["error"])
        self.verificar(self.client.get(ruta), 200, autor)
        self.verificar(self.client.get("/libros"), 200, [libro, otro_libro])
        with self.app.app_context():
            db = get_db()
            self.assertEqual(db.execute("PRAGMA foreign_keys").fetchone()[0], 1)
            with self.assertRaises(sqlite3.IntegrityError), db:
                db.execute("INSERT INTO libros (titulo, autor_id) VALUES ('Huérfano', 999)")
        self.verificar(self.client.delete(f"/libros/{libro['id']}"), 200)
        self.verificar(self.client.delete(ruta), 400)
        self.verificar(self.client.delete(f"/libros/{otro_libro['id']}"), 200)
        self.verificar(self.client.delete(ruta), 200)

    def test_cors(self):
        origen = "http://localhost:4200"
        headers = {
            "Origin": origen,
            "Access-Control-Request-Method": "PUT",
            "Access-Control-Request-Headers": "Content-Type",
        }
        respuesta = self.client.options("/libros/1", headers=headers)
        self.verificar(respuesta, 200, {})
        self.assertEqual(respuesta.headers["Access-Control-Allow-Origin"], origen)
        self.assertIn("PUT", respuesta.headers["Access-Control-Allow-Methods"])
        self.assertEqual(respuesta.headers["Access-Control-Allow-Headers"].lower(), "content-type")
        respuesta = self.client.get("/autores/999", headers={"Origin": origen})
        self.verificar(respuesta, 404)
        self.assertEqual(respuesta.headers["Access-Control-Allow-Origin"], origen)
        respuesta = self.client.get("/autores", headers={"Origin": "http://localhost:4201"})
        self.assertNotIn("Access-Control-Allow-Origin", respuesta.headers)
