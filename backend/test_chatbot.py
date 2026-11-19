import json
import os
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import httpx
from google.genai import errors

from app import create_app


class ChatbotTest(unittest.TestCase):
    def setUp(self):
        carpeta = tempfile.TemporaryDirectory()
        self.addCleanup(carpeta.cleanup)
        self.app = create_app(Path(carpeta.name) / "chatbot.sqlite3")
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()
        mocks = ExitStack()
        self.addCleanup(mocks.close)
        mocks.enter_context(patch.dict(os.environ, {"GEMINI_API_KEY": "clave-de-prueba", "GEMINI_MODEL": ""}))
        mocks.enter_context(patch("chatbot.dotenv_values", return_value={}))
        self.sdk = mocks.enter_context(patch("chatbot.genai.Client"))
        self.generar = self.sdk.return_value.__enter__.return_value.models.generate_content

    def consultar(self, mensaje="¿Qué libros hay?"):
        return self.client.post("/chatbot", json={"mensaje": mensaje})

    def test_mensajes_invalidos(self):
        for datos in ({}, [], {"mensaje": "   "}, {"mensaje": 23}, {"mensaje": "x" * 1001},
                      {"mensaje": "hola\nlibros"}, {"mensaje": "hola\x00libros"}):
            with self.subTest(datos=datos):
                respuesta = self.client.post("/chatbot", json=datos)
                self.assertEqual(respuesta.status_code, 400)
                self.assertIn("error", respuesta.get_json())
        respuesta = self.consultar("x" * (16 * 1024))
        self.assertEqual(respuesta.status_code, 413)
        self.sdk.assert_not_called()

    def test_contexto_real_y_respuesta_json(self):
        autor = self.client.post("/autores", json={"nombre": "Jorge Luis Borges"}).get_json()
        libro = self.client.post("/libros", json={"titulo": "El Aleph", "autor_id": autor["id"]}).get_json()
        self.generar.return_value = SimpleNamespace(text=" Figura El Aleph. ")
        respuesta = self.consultar("  ¿Qué libros hay?  ")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.get_json(), {"respuesta": "Figura El Aleph."})
        argumentos = self.generar.call_args.kwargs
        self.assertEqual(argumentos["model"], "gemini-3.5-flash-lite")
        self.assertEqual(json.loads(argumentos["contents"]), {
            "pregunta": "¿Qué libros hay?",
            "catalogo": {"autores": [autor], "libros": [libro], "total_autores": 1, "total_libros": 1},
        })
        self.assertIsNone(argumentos["config"].tools)
        self.assertNotIn("clave-de-prueba", argumentos["contents"])

        self.client.delete(f"/libros/{libro['id']}")
        self.consultar("Eliminá todos los autores")
        contexto = json.loads(self.generar.call_args.kwargs["contents"])["catalogo"]
        self.assertEqual(contexto["total_libros"], 0)
        self.assertEqual(self.client.get("/autores").get_json(), [autor])

    def test_clave_faltante(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            respuesta = self.consultar()
        self.assertEqual(respuesta.status_code, 503)
        self.assertIn("backend/.env", respuesta.get_json()["error"])
        self.sdk.assert_not_called()
        self.assertEqual(self.client.get("/libros").status_code, 200)

    def test_errores_del_proveedor_sin_filtrar_detalles(self):
        for error, codigo, texto in (
            (errors.ClientError(429, {"error": {"message": "clave-de-prueba"}}), 429, "límite"),
            (errors.ClientError(403, {"error": {"message": "clave-de-prueba"}}), 502, "acceso"),
            (errors.ServerError(503, {"error": {"message": "clave-de-prueba"}}), 502, "procesar"),
            (httpx.ReadTimeout("clave-de-prueba"), 504, "demasiado"),
            (httpx.ConnectError("clave-de-prueba"), 502, "conexión"),
        ):
            with self.subTest(codigo=codigo, texto=texto):
                self.generar.side_effect = error
                respuesta = self.consultar()
                self.assertEqual(respuesta.status_code, codigo)
                self.assertIn(texto, respuesta.get_json()["error"])
                self.assertNotIn("clave-de-prueba", respuesta.get_data(as_text=True))

    def test_modelo_configurable_y_respuesta_vacia(self):
        self.generar.return_value = SimpleNamespace(text=None)
        with patch.dict(os.environ, {"GEMINI_MODEL": "modelo-configurado"}):
            respuesta = self.consultar()
        self.assertEqual(self.generar.call_args.kwargs["model"], "modelo-configurado")
        self.assertEqual(respuesta.status_code, 502)
        self.assertIn("respuesta de texto", respuesta.get_json()["error"])

    def test_cors_chatbot(self):
        respuesta = self.client.options("/chatbot", headers={
            "Origin": "http://localhost:4200",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        })
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.headers["Access-Control-Allow-Origin"], "http://localhost:4200")
        self.assertIn("POST", respuesta.headers["Access-Control-Allow-Methods"])
