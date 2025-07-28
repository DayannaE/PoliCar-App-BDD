// scripts/setupDatabase.js
const sql = require('mssql');
const { dbConfigs } = require('../config/database');

// Scripts SQL para crear las tablas
const createTablesSQL = `
-- Crear tabla Vehiculos
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Vehiculos' AND xtype='U')
CREATE TABLE Vehiculos (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    CI_Cliente VARCHAR(20) NOT NULL,
    Matricula VARCHAR(20) NOT NULL UNIQUE,
    Marca VARCHAR(50) NOT NULL,
    Modelo VARCHAR(50) NOT NULL,
    Sede VARCHAR(10) NOT NULL,
    Fecha_Registro DATETIME DEFAULT GETDATE(),
    INDEX IX_Vehiculos_Sede (Sede),
    INDEX IX_Vehiculos_Matricula (Matricula),
    INDEX IX_Vehiculos_CI_Cliente (CI_Cliente)
);

-- Crear tabla Empleados
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Empleados' AND xtype='U')
CREATE TABLE Empleados (
    ID_Empleado VARCHAR(20) PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    Cedula VARCHAR(20) NOT NULL UNIQUE,
    Fecha_Contratacion DATE NOT NULL,
    Salario DECIMAL(10,2) NOT NULL,
    Sede VARCHAR(10) NOT NULL,
    Fecha_Registro DATETIME DEFAULT GETDATE(),
    INDEX IX_Empleados_Sede (Sede),
    INDEX IX_Empleados_Cedula (Cedula)
);

-- Crear tabla Repuestos
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Repuestos' AND xtype='U')
CREATE TABLE Repuestos (
    ID_Repuesto VARCHAR(20) PRIMARY KEY,
    Descripcion VARCHAR(200) NOT NULL,
    Cantidad INT NOT NULL DEFAULT 0,
    Sede VARCHAR(10) NOT NULL,
    Fecha_Registro DATETIME DEFAULT GETDATE(),
    INDEX IX_Repuestos_Sede (Sede)
);

-- Crear tabla Reparaciones
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Reparaciones' AND xtype='U')
CREATE TABLE Reparaciones (
    ID VARCHAR(20) PRIMARY KEY,
    Matricula VARCHAR(20) NOT NULL,
    Fecha_Reparacion DATE NOT NULL,
    ID_Repuesto VARCHAR(20) NOT NULL,
    Observacion TEXT,
    Precio DECIMAL(10,2) NOT NULL,
    Sede VARCHAR(10) NOT NULL,
    Fecha_Registro DATETIME DEFAULT GETDATE(),
    INDEX IX_Reparaciones_Sede (Sede),
    INDEX IX_Reparaciones_Matricula (Matricula),
    INDEX IX_Reparaciones_Fecha (Fecha_Reparacion),
    FOREIGN KEY (Matricula) REFERENCES Vehiculos(Matricula),
    FOREIGN KEY (ID_Repuesto) REFERENCES Repuestos(ID_Repuesto)
);

-- Insertar datos de ejemplo específicos por sede
IF NOT EXISTS (SELECT * FROM Vehiculos WHERE Sede = 'Sur')
BEGIN
    INSERT INTO Vehiculos (CI_Cliente, Matricula, Marca, Modelo, Sede) VALUES
    ('12345678', 'SUR-001', 'Toyota', 'Corolla', 'Sur'),
    ('11223344', 'SUR-002', 'Nissan', 'Sentra', 'Sur'),
    ('55667788', 'SUR-003', 'Chevrolet', 'Aveo', 'Sur');
END

IF NOT EXISTS (SELECT * FROM Vehiculos WHERE Sede = 'Norte')
BEGIN
    INSERT INTO Vehiculos (CI_Cliente, Matricula, Marca, Modelo, Sede) VALUES
    ('87654321', 'NOR-001', 'Honda', 'Civic', 'Norte'),
    ('99887766', 'NOR-002', 'Mazda', 'Mazda3', 'Norte'),
    ('44556677', 'NOR-003', 'Hyundai', 'Elantra', 'Norte');
END

IF NOT EXISTS (SELECT * FROM Empleados WHERE Sede = 'Sur')
BEGIN
    INSERT INTO Empleados (ID_Empleado, Nombre, Cedula, Fecha_Contratacion, Salario, Sede) VALUES
    ('EMP-SUR-001', 'Juan Pérez', '1234567890', '2023-01-15', 1200.00, 'Sur'),
    ('EMP-SUR-002', 'Carlos López', '1122334455', '2023-03-10', 1250.00, 'Sur'),
    ('EMP-SUR-003', 'Ana García', '2233445566', '2023-05-20', 1300.00, 'Sur');
END

IF NOT EXISTS (SELECT * FROM Empleados WHERE Sede = 'Norte')
BEGIN
    INSERT INTO Empleados (ID_Empleado, Nombre, Cedula, Fecha_Contratacion, Salario, Sede) VALUES
    ('EMP-NOR-001', 'María Rodríguez', '0987654321', '2023-02-20', 1300.00, 'Norte'),
    ('EMP-NOR-002', 'Pedro Martínez', '3344556677', '2023-04-15', 1280.00, 'Norte'),
    ('EMP-NOR-003', 'Laura Sánchez', '4455667788', '2023-06-10', 1350.00, 'Norte');
END

IF NOT EXISTS (SELECT * FROM Repuestos WHERE Sede = 'Sur')
BEGIN
    INSERT INTO Repuestos (ID_Repuesto, Descripcion, Cantidad, Sede) VALUES
    ('REP-SUR-001', 'Filtro de aceite Toyota', 15, 'Sur'),
    ('REP-SUR-002', 'Bujías NGK', 20, 'Sur'),
    ('REP-SUR-003', 'Pastillas de freno delanteras', 8, 'Sur'),
    ('REP-SUR-004', 'Aceite motor 5W30', 25, 'Sur');
END

IF NOT EXISTS (SELECT * FROM Repuestos WHERE Sede = 'Norte')
BEGIN
    INSERT INTO Repuestos (ID_Repuesto, Descripcion, Cantidad, Sede) VALUES
    ('REP-NOR-001', 'Filtro de aire Honda', 12, 'Norte'),
    ('REP-NOR-002', 'Amortiguadores traseros', 5, 'Norte'),
    ('REP-NOR-003', 'Líquido de frenos DOT4', 18, 'Norte'),
    ('REP-NOR-004', 'Correa de distribución', 10, 'Norte');
END

IF NOT EXISTS (SELECT * FROM Reparaciones WHERE Sede = 'Sur')
BEGIN
    INSERT INTO Reparaciones (ID, Matricula, Fecha_Reparacion, ID_Repuesto, Observacion, Precio, Sede) VALUES
    ('REP-SUR-001', 'SUR-001', '2025-07-20', 'REP-SUR-001', 'Cambio de filtro de aceite Toyota', 25.00, 'Sur'),
    ('REP-SUR-002', 'SUR-002', '2025-07-22', 'REP-SUR-002', 'Cambio de bujías', 45.00, 'Sur'),
    ('REP-SUR-003', 'SUR-003', '2025-07-25', 'REP-SUR-003', 'Cambio de pastillas de freno', 75.00, 'Sur');
END

IF NOT EXISTS (SELECT * FROM Reparaciones WHERE Sede = 'Norte')
BEGIN
    INSERT INTO Reparaciones (ID, Matricula, Fecha_Reparacion, ID_Repuesto, Observacion, Precio, Sede) VALUES
    ('REP-NOR-001', 'NOR-001', '2025-07-21', 'REP-NOR-001', 'Cambio de filtro de aire Honda', 30.00, 'Norte'),
    ('REP-NOR-002', 'NOR-002', '2025-07-23', 'REP-NOR-002', 'Instalación de amortiguadores', 120.00, 'Norte'),
    ('REP-NOR-003', 'NOR-003', '2025-07-26', 'REP-NOR-003', 'Cambio de líquido de frenos', 35.00, 'Norte');
END

PRINT 'Tablas creadas y datos de ejemplo insertados exitosamente para nodo actual';
`;

// Función para configurar una base de datos
async function setupDatabase(configKey, config) {
  console.log(`\n🔧 Configurando nodo: ${config.database}`);
  
  try {
    // Primero intentar conectar al servidor para crear la BD si no existe
    const masterConfig = { ...config, database: 'master' };
    const masterPool = await new sql.ConnectionPool(masterConfig).connect();
    
    try {
      // Crear la base de datos si no existe
      await masterPool.request().query(`
        IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = '${config.database}')
        BEGIN
          CREATE DATABASE [${config.database}]
          PRINT 'Base de datos ${config.database} creada'
        END
        ELSE
          PRINT 'Base de datos ${config.database} ya existe'
      `);
    } finally {
      await masterPool.close();
    }

    // Conectar a la base de datos específica y crear tablas
    const pool = await new sql.ConnectionPool(config).connect();
    
    try {
      await pool.request().query(createTablesSQL);
      console.log(`✅ ${config.database} configurado exitosamente`);
      return true;
    } finally {
      await pool.close();
    }

  } catch (error) {
    console.error(`❌ Error configurando ${config.database}:`, error.message);
    return false;
  }
}

// Función principal
async function main() {
  console.log('🚀 Iniciando configuración de nodos POLI-CAR...');
  console.log('📊 Sistema de Base de Datos Distribuida - 2 Nodos');
  console.log('🏢 Fragmentación horizontal por sedes (Sur/Norte)');
  console.log('=' * 60);

  const results = {};

  // Configurar los dos nodos principales
  for (const [configKey, config] of Object.entries(dbConfigs)) {
    results[configKey] = await setupDatabase(configKey, config);
  }

  // Mostrar resumen
  console.log('\n📋 RESUMEN DE CONFIGURACIÓN:');
  console.log('=' * 40);
  
  let successCount = 0;
  for (const [key, success] of Object.entries(results)) {
    const status = success ? '✅ EXITOSO' : '❌ FALLÓ';
    const nodoName = key === 'nodoSur' ? 'Nodo Sur' : 'Nodo Norte';
    console.log(`${nodoName.padEnd(20)} | ${status}`);
    if (success) successCount++;
  }

  console.log('=' * 40);
  console.log(`Nodos configurados: ${successCount}/${Object.keys(results).length}`);

  if (successCount === Object.keys(results).length) {
    console.log('\n🎉 ¡Ambos nodos están listos!');
    console.log('💡 Puedes iniciar el servidor con: npm start');
    console.log('🌐 Accede a: http://localhost:3000');
  } else if (successCount > 0) {
    console.log('\n⚠️  Al menos un nodo está disponible');
    console.log('🏥 El sistema funcionará con fragmentación parcial');
    console.log('💡 Puedes iniciar el servidor con: npm start');
  } else {
    console.log('\n❌ No se pudieron configurar los nodos');
    console.log('🔧 Verifica la configuración en config/database.js');
    console.log('🏥 Asegúrate de que SQL Server esté ejecutándose');
  }

  process.exit(successCount > 0 ? 0 : 1);
}

// Manejo de errores
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Promesa rechazada:', reason);
  process.exit(1);
});

// Ejecutar si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = { setupDatabase, createTablesSQL };