const express = require('express');
const redis = require('redis');
const path = require('path');

const app = express();
const port = 3000;

// Configurar el cliente de Redis
// Usaremos el nombre del servicio de Docker ('redis-server') como host
const redisClient = redis.createClient({
  url: 'redis://redis-server:6379'
});

redisClient.on('error', (err) => console.log('Error en Redis Client', err));

async function startServer() {
  await redisClient.connect();
  console.log('Conectado a Redis exitosamente!');

  // Inicializar el contador si no existe
  const exists = await redisClient.exists('visitas');
  if (!exists) {
    await redisClient.set('visitas', 0);
  }

  // Servir archivos estáticos (nuestra página web)
  app.use(express.static(path.join(__dirname, 'public')));

  // API para obtener y aumentar las visitas
  app.get('/api/visitas', async (req, res) => {
    try {
      // Incrementar el contador en 1
      const visitas = await redisClient.incr('visitas');
      res.json({ visitas });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  app.listen(port, () => {
    console.log(`Aplicación Node.js corriendo en el puerto ${port}`);
  });
}

startServer();
