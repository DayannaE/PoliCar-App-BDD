// config/database.js
const sql = require('mssql');

// Configuraciones para nodos + base central con vistas particionadas
const dbConfigs = {
  // Base Central - Solo para vistas particionadas y consultas unificadas
  central: {
    user: 'sa',
    password: 'P@ssw0rd', // Contraseña del SQL Server Central
    server: '26.91.154.235', // PC coordinadora - IP corregida (quitamos la 'l')
    port: 1433, // Puerto SQL Server por defecto
    database: 'CentralizadaBD',
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      connectTimeout: 30000,
      requestTimeout: 30000
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  },

  // Nodo Sur - Fragmento principal (PC remota)
  nodoSur: {
    user: 'sa',
    password: 'P@ssw0rd', // Contraseña del SQL Server del Nodo Sur
    server: '26.154.21.115', // IP de la PC donde está el Nodo Sur
    port: 1433, // Puerto SQL Server
    database: 'Nodo_Sur',
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      connectTimeout: 30000,
      requestTimeout: 30000
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  },

  // Nodo Norte - Fragmento principal (PC local o remota)
  nodoNorte: {
    user: 'sa',
    password: 'P@ssw0rd', // Contraseña del SQL Server del Nodo Norte
    server: '26.91.154.235', // IP real del nodo Norte
    port: 1433, // Puerto SQL Server
    database: 'Nodo_Norte',
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      connectTimeout: 30000,
      requestTimeout: 30000
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  }
};

// Pools de conexión para cada nodo
const connectionPools = {};

// Función para inicializar conexiones a los dos nodos
async function initializeConnections() {
  try {
    console.log('🔄 Inicializando conexiones a nodos POLI-CAR...');
    
    for (const [key, config] of Object.entries(dbConfigs)) {
      try {
        connectionPools[key] = await new sql.ConnectionPool(config).connect();
        console.log(`✅ Conectado a ${key}: ${config.database}`);
      } catch (error) {
        console.warn(`⚠️  No se pudo conectar a ${key}: ${error.message}`);
        connectionPools[key] = null;
      }
    }
    
    console.log('🎯 Inicialización de conexiones completada');
  } catch (error) {
    console.error('❌ Error en inicialización de conexiones:', error);
  }
}

// Función para obtener el pool de conexión apropiado basado en la sede
function getConnectionPool(sede) {
  const poolKey = sede === 'Sur' ? 'nodoSur' : 'nodoNorte';
  return connectionPools[poolKey];
}

// Función para obtener la conexión a la base central (para vistas particionadas)
function getCentralConnectionPool() {
  return connectionPools['central'];
}

// Función para obtener todas las conexiones activas
function getAllActivePools() {
  const activePools = {};
  for (const [key, pool] of Object.entries(connectionPools)) {
    if (pool && pool.connected) {
      activePools[key] = pool;
    }
  }
  return activePools;
}

// Función para cerrar todas las conexiones
async function closeAllConnections() {
  console.log('🔌 Cerrando todas las conexiones...');
  for (const [key, pool] of Object.entries(connectionPools)) {
    if (pool && pool.connected) {
      try {
        await pool.close();
        console.log(`✅ Conexión ${key} cerrada`);
      } catch (error) {
        console.error(`❌ Error cerrando ${key}:`, error.message);
      }
    }
  }
}

// Función para verificar el estado de las conexiones
async function checkConnectionHealth() {
  const status = {};
  for (const [key, pool] of Object.entries(connectionPools)) {
    if (pool) {
      try {
        await pool.request().query('SELECT 1 as test');
        status[key] = 'healthy';
      } catch (error) {
        status[key] = 'unhealthy';
      }
    } else {
      status[key] = 'disconnected';
    }
  }
  return status;
}

module.exports = {
  initializeConnections,
  getConnectionPool,
  getCentralConnectionPool,
  getAllActivePools,
  closeAllConnections,
  checkConnectionHealth,
  dbConfigs
};