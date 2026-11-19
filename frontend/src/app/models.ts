export interface AutorDatos { nombre: string; }
export interface Autor extends AutorDatos { id: number; }
export interface LibroDatos { titulo: string; autor_id: number; }
export interface Libro extends LibroDatos { id: number; }
export interface Resultado { mensaje: string; }
