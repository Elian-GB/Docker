const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'myuser',
  password: process.env.DB_PASSWORD || 'mypassword',
  database: process.env.DB_NAME || 'mydb',
  port: process.env.DB_PORT || 5432,
});

pool.on('error', (err) => console.error('Error en pg pool', err));

async function startServer() {
  try {
    await pool.query('SELECT NOW()');
    console.log('Conectado a PostgreSQL exitosamente!');
  } catch (err) {
    console.error('Error al conectar a PostgreSQL', err);
    process.exit(1);
  }

  // Configurar Nodemailer con Ethereal (cuenta de prueba autogenerada)
  let transporter;
  try {
    let testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('Nodemailer configurado con Ethereal Email');
  } catch(err) {
    console.error('Error configurando Nodemailer', err);
  }

  // Configurar Middleware de Sesión
  app.use(session({
    store: new pgSession({
      pool: pool,
      tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET || 'secreto_super_seguro_123',
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
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'Faltan datos' });
    
    try {
      const userCheck = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
      if (userCheck.rows.length > 0) return res.status(400).json({ error: 'El usuario o correo electrónico ya existe' });

      const hashedPassword = await bcrypt.hash(password, 10);
      const role = username.toLowerCase() === 'admin' ? 'admin' : 'user';
      const verificationToken = crypto.randomBytes(32).toString('hex');
      
      await pool.query(
        'INSERT INTO users (username, email, password, role, is_verified, verification_token) VALUES ($1, $2, $3, $4, false, $5)',
        [username, email, hashedPassword, role, verificationToken]
      );
      
      // Enviar correo de verificación
      if (transporter) {
        const verifyUrl = `http://localhost:3000/api/verify/${verificationToken}`;
        let info = await transporter.sendMail({
          from: '"LuxeTrack Admin" <admin@luxetrack.com>',
          to: email, // Usar el correo electrónico real ingresado
          subject: "Verifica tu cuenta en LuxeTrack",
          text: `Hola ${username}, por favor verifica tu cuenta haciendo clic en el siguiente enlace: ${verifyUrl}`,
          html: `<p>Hola ${username},</p><p>Por favor verifica tu cuenta haciendo clic en el siguiente enlace:</p><a href="${verifyUrl}">${verifyUrl}</a>`,
        });
        
        console.log("Correo enviado: %s", info.messageId);
        console.log("URL para previsualizar el correo (Ethereal): %s", nodemailer.getTestMessageUrl(info));
      }

      res.json({ message: 'Registro exitoso. Revisa tu correo (consola) para verificar tu cuenta.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al registrar usuario' });
    }
  });

  // Verificación
  app.get('/api/verify/:token', async (req, res) => {
    const { token } = req.params;
    try {
      const result = await pool.query('UPDATE users SET is_verified = true, verification_token = NULL WHERE verification_token = $1 RETURNING username', [token]);
      
      if (result.rowCount === 0) {
        return res.status(400).send('Token inválido o expirado.');
      }
      
      res.send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #0f172a; color: white;">
            <h2>¡Cuenta verificada exitosamente!</h2>
            <p>Ya puedes volver a la aplicación e iniciar sesión.</p>
            <a href="/" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px;">Ir a Login</a>
          </body>
        </html>
      `);
    } catch(err) {
      console.error(err);
      res.status(500).send('Error interno del servidor');
    }
  });

  // Login
  app.post('/api/login', async (req, res) => {
    const { username, password, rememberMe } = req.body;
    
    try {
      const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
      if (result.rows.length === 0) return res.status(400).json({ error: 'Usuario no encontrado' });
      
      const user = result.rows[0];
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(400).json({ error: 'Contraseña incorrecta' });
 
      if (!user.is_verified) return res.status(403).json({ error: 'Tu cuenta no está verificada. Revisa el correo enviado (ver consola del servidor).' });
      
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;

      if (rememberMe) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 días
      } else {
        req.session.cookie.maxAge = null; // Expira al cerrar el navegador
      }

      req.session.save((err) => {
        if (err) {
          console.error('Error guardando sesión:', err);
          return res.status(500).json({ error: 'Error al iniciar sesión' });
        }
        res.json({ message: 'Login exitoso', username: user.username, role: user.role });
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al iniciar sesión' });
    }
  });

  // Logout
  app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Sesión cerrada' });
  });

  // Obtener usuario actual
  app.get('/api/me', async (req, res) => {
    if (!req.session.userId) return res.json({ loggedIn: false });
    
    try {
      const result = await pool.query('SELECT COALESCE(SUM(count), 0) as visitas FROM user_visits WHERE user_id = $1', [req.session.userId]);
      const visitas = parseInt(result.rows[0].visitas, 10);
      
      res.json({ 
        loggedIn: true, 
        username: req.session.username, 
        role: req.session.role,
        visitas: visitas
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error obteniendo datos' });
    }
  });

  // --- RUTAS DE VISITAS ---

  // Registrar visita y devolver datos
  app.get('/api/visitas', async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Incrementar contador global diario
      await pool.query(`
        INSERT INTO global_visits (visit_date, count) 
        VALUES ($1, 1) 
        ON CONFLICT (visit_date) 
        DO UPDATE SET count = global_visits.count + 1
      `, [today]);
      
      let personalVisits = null;
      
      // Incrementar contador personal si hay sesión iniciada
      if (req.session.userId) {
        await pool.query(`
          INSERT INTO user_visits (user_id, visit_date, count) 
          VALUES ($1, $2, 1) 
          ON CONFLICT (user_id, visit_date) 
          DO UPDATE SET count = user_visits.count + 1
        `, [req.session.userId, today]);

        const result = await pool.query('SELECT SUM(count) as total FROM user_visits WHERE user_id = $1', [req.session.userId]);
        personalVisits = parseInt(result.rows[0].total, 10);
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
      const result = await pool.query('SELECT visit_date as date, count FROM global_visits ORDER BY visit_date DESC');
      const stats = result.rows.map(row => {
        // Handle potentially different Date object conversions
        let dateStr = row.date;
        if (row.date instanceof Date) {
          // Add hours to avoid timezone shift dropping it to the previous day
          const d = new Date(row.date);
          d.setHours(12);
          dateStr = d.toISOString().split('T')[0];
        }
        return {
          date: dateStr,
          count: row.count
        };
      });
      res.json(stats);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error obteniendo estadísticas' });
    }
  });

  app.listen(port, () => {
    console.log(`Aplicación Node.js corriendo en el puerto ${port}`);
  });
}

startServer();
