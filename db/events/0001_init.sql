-- Esquema de la tabla de eventos de producto (#32). Ya aplicado a las bases D1
-- `precioreal-events` (Production) y `precioreal-events-dev` (Preview) el 2026-10-02.
-- Sin índices secundarios: en D1 cada índice cuenta como una fila escrita más por evento.
CREATE TABLE IF NOT EXISTS events (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      TEXT NOT NULL,
  evento  TEXT NOT NULL,
  tienda  TEXT,
  slug    TEXT,
  origen  TEXT,
  props   TEXT NOT NULL
);
