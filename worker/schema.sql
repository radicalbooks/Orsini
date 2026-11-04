-- Orsini · esquema base de D1 (les taules v2 es creen soles en el primer accés del Worker).
CREATE TABLE IF NOT EXISTS courses(id TEXT PRIMARY KEY,title TEXT,price_cents INTEGER,capacity INTEGER,active INTEGER);
CREATE TABLE IF NOT EXISTS registrations(id TEXT PRIMARY KEY,course_id TEXT,name TEXT,email TEXT,status TEXT,created_at INTEGER,expires_at INTEGER,stripe_session_id TEXT,paid_at INTEGER);
CREATE TABLE IF NOT EXISTS stripe_events(id TEXT PRIMARY KEY,created_at INTEGER);
CREATE INDEX IF NOT EXISTS registrations_course_status ON registrations(course_id,status,expires_at);
-- Catàleg comercial centralitzat al servidor (preu en cèntims; el navegador mai no decideix l'import).
INSERT OR IGNORE INTO courses VALUES
 ('feminisme-antipunitiu','Feminisme antipunitiu',6000,15,1),
 ('escriptura-politica','Escriptura política: com sortir del jo',6000,15,1),
 ('imaginacio-i-organitzacio','La fi de la crisi de la imaginació',6000,15,1),
 ('al-marge-de-la-historia','Al marge de la història',6000,15,1),
 ('organitzar-la-classe','Organizing: mètode per organitzar la classe',6000,15,1);
