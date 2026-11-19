import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Autor, AutorDatos, Libro, LibroDatos, Resultado } from './models';

export const API_URL = 'http://127.0.0.1:8765';

@Injectable({ providedIn: 'root' })
export class BibliotecaApi {
  private readonly http = inject(HttpClient);

  consultarChatbot(mensaje: string) {
    return this.http.post<{ respuesta: string }>(`${API_URL}/chatbot`, { mensaje });
  }

  autores() { return this.http.get<Autor[]>(`${API_URL}/autores`); }
  autor(id: string) { return this.http.get<Autor>(`${API_URL}/autores/${id}`); }
  crearAutor(datos: AutorDatos) { return this.http.post<Autor>(`${API_URL}/autores`, datos); }
  editarAutor(id: string, datos: AutorDatos) {
    return this.http.put<Autor>(`${API_URL}/autores/${id}`, datos);
  }
  eliminarAutor(id: string) { return this.http.delete<Resultado>(`${API_URL}/autores/${id}`); }

  libros(buscar = '', autorId: number | null = null) {
    let params = new HttpParams();
    if (buscar.trim()) params = params.set('buscar', buscar.trim());
    if (autorId !== null) params = params.set('autor_id', autorId);
    return this.http.get<Libro[]>(`${API_URL}/libros`, { params });
  }
  libro(id: string) { return this.http.get<Libro>(`${API_URL}/libros/${id}`); }
  crearLibro(datos: LibroDatos) { return this.http.post<Libro>(`${API_URL}/libros`, datos); }
  editarLibro(id: string, datos: LibroDatos) {
    return this.http.put<Libro>(`${API_URL}/libros/${id}`, datos);
  }
  eliminarLibro(id: string) { return this.http.delete<Resultado>(`${API_URL}/libros/${id}`); }
}

export function mensajeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'No se pudo conectar con la API. Verificá que Flask esté en ejecución.';
    if (typeof error.error?.error === 'string') return error.error.error;
  }
  return 'Ocurrió un error al comunicarse con la API. Intentá nuevamente.';
}
