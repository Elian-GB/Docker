const express = require('express');
const redis = require('redis');
const path = require('path');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const bcrypt = require('bcryptjs');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar el cliente de Redis
const redisClient = redis.createClient({
  url: 'redis://redis-server:6379'
});

redisClient.on('error', (err) => console.log('Error en Redis Client', err));

async function startServer() {
  await redisClient.connect();
  console.log('Conectado a Redis exitosamente!');

  // Inicializar RedisStore para sesiones
  const redisStore = new RedisStore({
    client: redisClient,
    prefix: 'miapp:sess:',
  });

  // Configurar Middleware de Sesión
  app.use(session({
    store: redisStore,
    secret: 'secreto_super_seguro_123',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: false, // En producción con HTTPS debería ser true
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 // 1 día
    }
  }));

  // Servir archivos estáticos
  app.use(express.static(path.join(__dirname, 'public')));

  // --- RUTAS DE AUTENTICACIÓN ---

  // Registro
  app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });
    
    const exists = await redisClient.exists(`user:${username}`);
    if (exists) return res.status(400).json({ error: 'El usuario ya existe' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = username.toLowerCase() === 'admin' ? 'admin' : 'user';
    
    await redisClient.hSet(`user:${username}`, {
      password: hashedPassword,
      role: role,
      visitas: 0
    });
    
    res.json({ message: 'Usuario registrado exitosamente' });
  });

  // Login
  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    const user = await redisClient.hGetAll(`user:${username}`);
    if (!user || !user.password) return res.status(400).json({ error: 'Usuario no encontrado' });
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Contraseña incorrecta' });
    
    req.session.username = username;
    req.session.role = user.role;
    res.json({ message: 'Login exitoso', username, role: user.role });
  });

  // Logout
  app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Sesión cerrada' });
  });

  // Obtener usuario actual
  app.get('/api/me', async (req, res) => {
    if (!req.session.username) return res.json({ loggedIn: false });
    
    const user = await redisClient.hGetAll(`user:${req.session.username}`);
    res.json({ 
      loggedIn: true, 
      username: req.session.username, 
      role: req.session.role,
      visitas: user.visitas || 0
    });
  });

  // --- RUTAS DE VISITAS ---

  // Registrar visita y devolver datos
  app.get('/api/visitas', async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
      const dailyKey = `visitas_diarias:${today}`;
      
      // Incrementar contador global diario
      await redisClient.incr(dailyKey);
      
      let personalVisits = null;
      
      // Incrementar contador personal si hay sesión iniciada
      if (req.session.username) {
         personalVisits = await redisClient.hIncrBy(`user:${req.session.username}`, 'visitas', 1);
      }
      
      res.json({ message: 'Visita registrada', personalVisits });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // Estadísticas para el Administrador
  app.get('/api/admin/stats', async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }
    
    try {
      const keys = await redisClient.keys('visitas_diarias:*');
      let stats = [];
      for (const key of keys) {
        const date = key.split(':')[1];
        const count = await redisClient.get(key);
        stats.push({ date, count: parseInt(count) });
      }
      // Ordenar por fecha descendente
      stats.sort((a, b) => new Date(b.date) - new Date(a.date));
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Error obteniendo estadísticas' });
    }
  });

  app.listen(port, () => {
    console.log(`Aplicación Node.js corriendo en el puerto ${port}`);
  });
}

startServer();
