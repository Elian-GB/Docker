-- init.sql: Script de inicialización de la base de datos PostgreSQL

-- Crear tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    is_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255)
);

-- Crear tabla de sesiones de connect-pg-simple
CREATE TABLE "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX "IDX_session_expire" ON "session" ("expire");

-- Crear tabla de visitas globales
CREATE TABLE IF NOT EXISTS global_visits (
    id SERIAL PRIMARY KEY,
    visit_date DATE UNIQUE NOT NULL,
    count INTEGER DEFAULT 1
);

-- Crear tabla de visitas por usuario
CREATE TABLE IF NOT EXISTS user_visits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    visit_date DATE NOT NULL,
    count INTEGER DEFAULT 1,
    UNIQUE (user_id, visit_date)
);
