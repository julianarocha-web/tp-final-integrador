CREATE TABLE IF NOT EXISTS autores (
    id INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL CHECK (length(trim(nombre)) > 0)
);

CREATE TABLE IF NOT EXISTS libros (
    id INTEGER PRIMARY KEY,
    titulo TEXT NOT NULL CHECK (length(trim(titulo)) > 0),
    autor_id INTEGER NOT NULL REFERENCES autores(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS libros_autor_id ON libros(autor_id);
