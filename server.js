// server.js
const express = require('express');
const path = require('path');
const { initializeConnections, closeAllConnections } = require('./config/database');
const apiRoutes = require('./routes/apiRoutes');

const app = express();
const port = process.env.PORT || 3000;

// --- CONFIGURACIÓN DE MIDDLEWARE ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para CORS (si necesitas acceso desde otros dominios)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Middleware para logging básico
app.use((req, res, next) => {
  if (!req.url.includes('/api/')) {
    console.log(`🌐 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  }
  next();
});

// --- SERVIR ARCHIVOS ESTÁTICOS DEL FRONTEND ---
app.use(express.static(path.join(__dirname, 'public')));

// --- RUTAS DE LA API ---
app.use('/api', apiRoutes);

// --- RUTAS DEL FRONTEND ---
// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rutas específicas para cada página
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/registrar-vehiculo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'registrarVehiculo.html'));
});

app.get('/registrar-empleado', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'registrarEmpleado.html'));
});

app.get('/registrar-reparacion', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'registrarReparacion.html'));
});

app.get('/registrar-repuesto', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'registrarRepuesto.html'));
});

app.get('/consultar-reparacion', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'consultarReparacion.html'));
});

// --- MANEJO DE ERRORES ---
// Middleware para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.url}`,
    availableRoutes: {
      api: [
        'POST /api/login',
        'POST /api/vehiculos',
        'POST /api/empleados', 
        'POST /api/repuestos',
        'POST /api/reparaciones',
        'GET /api/consultar-reparacion',
        'GET /api/health',
        'GET /api/estadisticas',
        'POST /api/cambiar-sede'
      ],
      pages: [
        'GET /',
        'GET /dashboard',
        'GET /registrar-vehiculo',
        'GET /registrar-empleado',
        'GET /registrar-reparacion',
        'GET /registrar-repuesto',
        'GET /consultar-reparacion'
      ]
    }
  });
});

// Middleware global para manejo de errores
app.use((error, req, res, next) => {
  console.error('❌ Error no manejado:', error);
  
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
  });
});

// --- FUNCIONES DE INICIO Y CIERRE ---
async function startServer() {
  try {
    console.log('🚀 Iniciando servidor POLI-CAR...');
    console.log('📊 Sistema de Base de Datos Distribuida');
    console.log('🏢 Soporta fragmentación por sedes (Sur/Norte)');
    console.log('🔄 Incluye replicación y tolerancia a fallos');
    console.log('=' * 50);

    // Inicializar conexiones a todas las bases de datos
    await initializeConnections();

    // Obtener todas las IPs disponibles del servidor
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    let localIP = 'localhost';
    const allIPs = [];
    
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          allIPs.push({ adapter: name, ip: net.address });
          if (localIP === 'localhost') {
            localIP = net.address; // Primera IP encontrada como principal
          }
        }
      }
    }

    // Iniciar el servidor HTTP en todas las interfaces (0.0.0.0)
    const server = app.listen(port, '0.0.0.0', () => {
      console.log('');
      console.log('✅ Servidor POLI-CAR iniciado exitosamente!');
      console.log(`🌐 URL Local: http://localhost:${port}`);
      console.log(`🌍 URL Red Principal: http://${localIP}:${port}`);
      console.log('');
      console.log('🔗 TODAS las IPs disponibles para conexión:');
      allIPs.forEach(({ adapter, ip }) => {
        console.log(`   • ${adapter}: http://${ip}:${port}`);
      });
      console.log(`📁 Frontend: ${path.join(__dirname, 'public')}`);
      console.log('');
      console.log('📋 Páginas disponibles (usa cualquier IP de arriba):');
      console.log(`   • Principal: http://[IP]:${port}/`);
      console.log(`   • Dashboard: http://[IP]:${port}/dashboard`);
      console.log(`   • Gestionar Vehículos: http://[IP]:${port}/gestionarVehiculos.html`);
      console.log(`   • Gestionar Empleados: http://[IP]:${port}/gestionarEmpleados.html`);
      console.log(`   • Gestionar Reparaciones: http://[IP]:${port}/gestionarReparaciones.html`);
      console.log(`   • Gestionar Repuestos: http://[IP]:${port}/gestionarRepuestos.html`);
      console.log(`   • Consultar Reparación: http://[IP]:${port}/consultarReparacion.html`);
      console.log('');
      console.log('🔧 APIs disponibles:');
      console.log(`   • Estado del sistema: http://[IP]:${port}/api/health`);
      console.log(`   • Estadísticas: http://[IP]:${port}/api/estadisticas`);
      console.log('');
      console.log('💡 Para acceder desde otros PCs con VPN:');
      console.log(`   1. Usa la IP del adaptador VPN de arriba`);
      console.log(`   2. Configura firewall en ambos PCs`);
      console.log('   3. Ambos PCs deben estar en la misma VPN');
      console.log('   4. Todas las operaciones CRUD están disponibles');
      console.log('=' * 50);
    });

    // Manejo de cierre graceful
    const gracefulShutdown = async (signal) => {
      console.log(`\n🛑 Recibida señal ${signal}. Cerrando servidor...`);
      
      server.close(async () => {
        console.log('🔌 Servidor HTTP cerrado');
        
        try {
          await closeAllConnections();
          console.log('✅ Todas las conexiones de BD cerradas');
          console.log('👋 Servidor POLI-CAR cerrado exitosamente');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error cerrando conexiones:', error);
          process.exit(1);
        }
      });
    };

    // Eventos de cierre
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;

  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

// --- MANEJO DE ERRORES NO CAPTURADOS ---
process.on('uncaughtException', (error) => {
  console.error('❌ Excepción no capturada:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
  console.error('En la promesa:', promise);
  process.exit(1);
});

// --- INICIAR EL SERVIDOR ---
if (require.main === module) {
  startServer();
}

module.exports = app;