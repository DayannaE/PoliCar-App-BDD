// scripts/setupFullSystem.js
const sql = require('mssql');
const { dbConfigs } = require('../config/database');

async function setupCompleteSystem() {
  console.log('🚀 Iniciando configuración completa del sistema POLI-CAR...\n');

  try {
    // Paso 1: Crear las tres bases de datos
    await createDatabases();
    
    // Paso 2: Crear tablas en cada nodo
    await createTablesInNodes();
    
    // Paso 3: Configurar linked servers y vistas particionadas
    await setupPartitionedViews();
    
    console.log('\n✅ ¡Sistema POLI-CAR configurado exitosamente!');
    console.log('\n📋 Resumen de la configuración:');
    console.log('   🏢 Base Central: PoliCarCentral_DB (vistas particionadas)');
    console.log('   🏪 Nodo Sur: PoliCarSur_DB (fragmentos Sur)');
    console.log('   🏪 Nodo Norte: PoliCarNorte_DB (fragmentos Norte)');
    console.log('\n🌐 Funcionalidades disponibles:');
    console.log('   📱 Selección de sede en login');
    console.log('   📊 Consultas globales (todas las sedes)');
    console.log('   🔧 Operaciones CRUD por sede');
    console.log('   📈 Reportes consolidados');

  } catch (error) {
    console.error('❌ Error durante la configuración:', error.message);
    throw error;
  }
}

async function createDatabases() {
  console.log('📊 Paso 1: Creando bases de datos...');
  
  const databases = [
    'PoliCarCentral_DB',
    'PoliCarSur_DB', 
    'PoliCarNorte_DB'
  ];

  for (const dbName of databases) {
    try {
      // Conectar al master para crear la base
      const masterConfig = {
        ...dbConfigs.central,
        database: 'master'
      };
      
      const pool = await new sql.ConnectionPool(masterConfig).connect();
      const request = pool.request();
      
      // Verificar si la base existe
      const checkResult = await request.query(`
        SELECT name FROM sys.databases WHERE name = '${dbName}'
      `);
      
      if (checkResult.recordset.length === 0) {
        await request.query(`CREATE DATABASE [${dbName}]`);
        console.log(`   ✅ Base de datos ${dbName} creada`);
      } else {
        console.log(`   ℹ️  Base de datos ${dbName} ya existe`);
      }
      
      await pool.close();
    } catch (error) {
      console.warn(`   ⚠️  Error creando ${dbName}: ${error.message}`);
    }
  }
}

async function createTablesInNodes() {
  console.log('\n🗄️  Paso 2: Creando tablas en nodos...');
  
  const tableSchema = `
    -- Tabla de Vehículos
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Vehiculos' AND xtype='U')
    CREATE TABLE Vehiculos (
      Vehiculo_ID int IDENTITY(1,1) PRIMARY KEY,
      CI_Cliente varchar(20) NOT NULL,
      Matricula varchar(15) UNIQUE NOT NULL,
      Marca varchar(50) NOT NULL,
      Modelo varchar(50) NOT NULL,
      Sede varchar(10) NOT NULL,
      Fecha_Registro datetime DEFAULT GETDATE()
    );

    -- Tabla de Empleados
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Empleados' AND xtype='U')
    CREATE TABLE Empleados (
      Empleado_ID int IDENTITY(1,1) PRIMARY KEY,
      Nombre varchar(50) NOT NULL,
      Apellido varchar(50) NOT NULL,
      Cargo varchar(50) NOT NULL,
      Telefono varchar(15),
      Email varchar(100),
      Sede varchar(10) NOT NULL,
      Fecha_Contratacion datetime DEFAULT GETDATE()
    );

    -- Tabla de Repuestos
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Repuestos' AND xtype='U')
    CREATE TABLE Repuestos (
      Repuesto_ID int IDENTITY(1,1) PRIMARY KEY,
      Nombre varchar(100) NOT NULL,
      Marca varchar(50) NOT NULL,
      Precio decimal(10,2) NOT NULL,
      Stock int NOT NULL DEFAULT 0,
      Sede varchar(10) NOT NULL,
      Fecha_Ingreso datetime DEFAULT GETDATE()
    );

    -- Tabla de Reparaciones
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Reparaciones' AND xtype='U')
    CREATE TABLE Reparaciones (
      Reparacion_ID int IDENTITY(1,1) PRIMARY KEY,
      Vehiculo_ID int NOT NULL,
      Empleado_ID int NOT NULL,
      Descripcion text NOT NULL,
      Fecha_Inicio datetime DEFAULT GETDATE(),
      Fecha_Fin datetime NULL,
      Estado varchar(20) DEFAULT 'En Proceso',
      Costo_Total decimal(10,2) DEFAULT 0,
      Sede varchar(10) NOT NULL,
      FOREIGN KEY (Vehiculo_ID) REFERENCES Vehiculos(Vehiculo_ID),
      FOREIGN KEY (Empleado_ID) REFERENCES Empleados(Empleado_ID)
    );
  `;

  // Crear tablas en nodo Sur
  try {
    const poolSur = await new sql.ConnectionPool(dbConfigs.nodoSur).connect();
    await poolSur.request().query(tableSchema);
    console.log('   ✅ Tablas creadas en Nodo Sur');
    await poolSur.close();
  } catch (error) {
    console.warn(`   ⚠️  Error en Nodo Sur: ${error.message}`);
  }

  // Crear tablas en nodo Norte
  try {
    const poolNorte = await new sql.ConnectionPool(dbConfigs.nodoNorte).connect();
    await poolNorte.request().query(tableSchema);
    console.log('   ✅ Tablas creadas en Nodo Norte');
    await poolNorte.close();
  } catch (error) {
    console.warn(`   ⚠️  Error en Nodo Norte: ${error.message}`);
  }
}

async function setupPartitionedViews() {
  console.log('\n🔗 Paso 3: Configurando linked servers y vistas particionadas...');
  
  try {
    const poolCentral = await new sql.ConnectionPool(dbConfigs.central).connect();
    
    // Configurar linked servers
    const linkedServerScript = `
      -- Linked Server al Nodo Sur
      IF EXISTS (SELECT * FROM sys.servers WHERE name = 'NodoSur')
          EXEC sp_dropserver 'NodoSur', 'droplogins';

      EXEC sp_addlinkedserver 
          @server = 'NodoSur',
          @srvproduct = 'SQL Server',
          @provider = 'SQLNCLI',
          @datasrc = '${dbConfigs.nodoSur.server}';

      EXEC sp_addlinkedsrvlogin 
          @rmtsrvname = 'NodoSur',
          @useself = 'FALSE',
          @locallogin = NULL,
          @rmtuser = '${dbConfigs.nodoSur.user}',
          @rmtpassword = '${dbConfigs.nodoSur.password}';

      -- Linked Server al Nodo Norte
      IF EXISTS (SELECT * FROM sys.servers WHERE name = 'NodoNorte')
          EXEC sp_dropserver 'NodoNorte', 'droplogins';

      EXEC sp_addlinkedserver 
          @server = 'NodoNorte',
          @srvproduct = 'SQL Server',
          @provider = 'SQLNCLI',
          @datasrc = '${dbConfigs.nodoNorte.server}';

      EXEC sp_addlinkedsrvlogin 
          @rmtsrvname = 'NodoNorte',
          @useself = 'FALSE',
          @locallogin = NULL,
          @rmtuser = '${dbConfigs.nodoNorte.user}',
          @rmtpassword = '${dbConfigs.nodoNorte.password}';
    `;
    
    await poolCentral.request().query(linkedServerScript);
    console.log('   ✅ Linked servers configurados');
    
    // Crear vistas particionadas
    const viewsScript = `
      -- Vista Global de Vehículos
      IF OBJECT_ID('dbo.Vista_Vehiculos_Global', 'V') IS NOT NULL
          DROP VIEW dbo.Vista_Vehiculos_Global;

      CREATE VIEW dbo.Vista_Vehiculos_Global AS
      SELECT 
          Vehiculo_ID, CI_Cliente, Matricula, Marca, Modelo, Sede, Fecha_Registro, 'Sur' as Origen_Nodo
      FROM NodoSur.${dbConfigs.nodoSur.database}.dbo.Vehiculos
      UNION ALL
      SELECT 
          Vehiculo_ID, CI_Cliente, Matricula, Marca, Modelo, Sede, Fecha_Registro, 'Norte' as Origen_Nodo
      FROM NodoNorte.${dbConfigs.nodoNorte.database}.dbo.Vehiculos;

      -- Vista Global de Reparaciones
      IF OBJECT_ID('dbo.Vista_Reparaciones_Global', 'V') IS NOT NULL
          DROP VIEW dbo.Vista_Reparaciones_Global;

      CREATE VIEW dbo.Vista_Reparaciones_Global AS
      SELECT 
          Reparacion_ID, Vehiculo_ID, Empleado_ID, Descripcion, Fecha_Inicio, Fecha_Fin, Estado, Costo_Total, Sede, 'Sur' as Origen_Nodo
      FROM NodoSur.${dbConfigs.nodoSur.database}.dbo.Reparaciones
      UNION ALL
      SELECT 
          Reparacion_ID, Vehiculo_ID, Empleado_ID, Descripcion, Fecha_Inicio, Fecha_Fin, Estado, Costo_Total, Sede, 'Norte' as Origen_Nodo
      FROM NodoNorte.${dbConfigs.nodoNorte.database}.dbo.Reparaciones;

      -- Vista de Estadísticas
      IF OBJECT_ID('dbo.Vista_Estadisticas_General', 'V') IS NOT NULL
          DROP VIEW dbo.Vista_Estadisticas_General;

      CREATE VIEW dbo.Vista_Estadisticas_General AS
      SELECT 
          'Sur' as Sede,
          (SELECT COUNT(*) FROM NodoSur.${dbConfigs.nodoSur.database}.dbo.Vehiculos) as Total_Vehiculos,
          (SELECT COUNT(*) FROM NodoSur.${dbConfigs.nodoSur.database}.dbo.Reparaciones WHERE Estado = 'En Proceso') as Reparaciones_Activas,
          (SELECT COUNT(*) FROM NodoSur.${dbConfigs.nodoSur.database}.dbo.Reparaciones WHERE Estado = 'Completada') as Reparaciones_Completadas,
          (SELECT AVG(Costo_Total) FROM NodoSur.${dbConfigs.nodoSur.database}.dbo.Reparaciones WHERE Costo_Total > 0) as Costo_Promedio_Reparacion,
          (SELECT SUM(Costo_Total) FROM NodoSur.${dbConfigs.nodoSur.database}.dbo.Reparaciones WHERE Estado = 'Completada') as Ingresos_Totales

      UNION ALL

      SELECT 
          'Norte' as Sede,
          (SELECT COUNT(*) FROM NodoNorte.${dbConfigs.nodoNorte.database}.dbo.Vehiculos) as Total_Vehiculos,
          (SELECT COUNT(*) FROM NodoNorte.${dbConfigs.nodoNorte.database}.dbo.Reparaciones WHERE Estado = 'En Proceso') as Reparaciones_Activas,
          (SELECT COUNT(*) FROM NodoNorte.${dbConfigs.nodoNorte.database}.dbo.Reparaciones WHERE Estado = 'Completada') as Reparaciones_Completadas,
          (SELECT AVG(Costo_Total) FROM NodoNorte.${dbConfigs.nodoNorte.database}.dbo.Reparaciones WHERE Costo_Total > 0) as Costo_Promedio_Reparacion,
          (SELECT SUM(Costo_Total) FROM NodoNorte.${dbConfigs.nodoNorte.database}.dbo.Reparaciones WHERE Estado = 'Completada') as Ingresos_Totales;
    `;
    
    await poolCentral.request().query(viewsScript);
    console.log('   ✅ Vistas particionadas creadas');
    
    await poolCentral.close();
    
  } catch (error) {
    console.warn(`   ⚠️  Error configurando vistas: ${error.message}`);
  }
}

// Ejecutar configuración si se llama directamente
if (require.main === module) {
  setupCompleteSystem()
    .then(() => {
      console.log('\n🎯 ¡Configuración completada! El sistema está listo para usar.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Error en configuración:', error);
      process.exit(1);
    });
}

module.exports = { setupCompleteSystem };
