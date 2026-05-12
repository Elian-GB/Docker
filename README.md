# Contador de Visitas Dockerizado (Node.js + Redis)

Este es un proyecto de prueba para aprender y practicar con Docker y Docker Compose. Consiste en un servidor web desarrollado en Node.js que se conecta a una base de datos Redis para mantener un registro persistente de la cantidad de visitas que recibe la página.

## Tecnologías Utilizadas
- **Node.js (Express):** Servidor web y API.
- **Redis:** Base de datos en memoria para guardar el contador de forma súper rápida.
- **Docker & Docker Compose:** Herramientas de contenerización.
- **HTML/CSS/JS Vanilla:** Interfaz de usuario moderna (Glassmorphism).

## Requisitos Previos
- Tener instalado [Docker Desktop](https://www.docker.com/products/docker-desktop/).
- Git instalado en tu computadora (para control de versiones).

## ¿Cómo ejecutar el proyecto?

1. Abre una terminal en la carpeta de este proyecto.
2. Ejecuta el siguiente comando para levantar todos los contenedores en segundo plano:
   ```bash
   docker-compose up -d
   ```
3. Abre tu navegador web favorito y visita la dirección:
   [http://localhost:3000](http://localhost:3000)

Cada vez que recargues la página (F5), verás cómo el contador de visitas aumenta. La información no se perderá aunque cierres el navegador, porque se está guardando en el contenedor de Redis.

## ¿Cómo apagar el proyecto?

Para detener los contenedores y liberar los recursos de tu computadora, ejecuta:
```bash
docker-compose down
```

## Subir a GitHub

Si tienes un repositorio creado en GitHub, puedes subir el código con estos comandos:
```bash
git remote add origin URL_DE_TU_REPOSITORIO_AQUI
git branch -M main
git push -u origin main
```
