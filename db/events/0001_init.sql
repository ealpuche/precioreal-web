-- Esquema de la tabla de eventos de producto (#32). Aplicado a las bases D1
-- `precioreal-events` (Production) y `precioreal-events-dev` (Preview) el 2026-10-02.
-- Cada evento debe costar UNA fila escrita (el plan gratuito admite 100,000 al día):
--   * Sin índices secundarios: cada índice cuenta como una fila escrita más.
--   * Sin AUTOINCREMENT: medido el 2026-10-02 en precioreal-events-dev, un INSERT
--     reporta rows_written = 2 con AUTOINCREMENT y 1 sin él (CR PR #38, H7).
-- Consecuencia: SQLite reutiliza el id más alto si esa fila se borra. Quien purgue
-- esta tabla debe conservar la fila de id máximo (price-crawler-saas#188).
CREATE TABLE IF NOT EXISTS events (
  id      INTEGER PRIMARY KEY,
  ts      TEXT NOT NULL,
  evento  TEXT NOT NULL,
  tienda  TEXT,
  slug    TEXT,
  origen  TEXT,
  props   TEXT NOT NULL
);
