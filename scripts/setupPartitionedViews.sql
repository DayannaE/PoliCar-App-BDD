-- scripts/setupPartitionedViews.sql
-- Script para configurar vistas particionadas en base central

USE CentralizadaBD; -- Cambia al nombre de tu base de datos centralizada
GO

-- =====================================================
-- PASO 1: CONFIGURAR LINKED SERVERS A LOS NODOS
-- =====================================================

-- Linked Server al Nodo Sur
IF EXISTS (SELECT * FROM sys.servers WHERE name = 'NodoSur')
    EXEC sp_dropserver 'NodoSur', 'droplogins';

EXEC sp_addlinkedserver 
    @server = 'NodoSur',
    @srvproduct = 'SQL Server',
    @provider = 'SQLNCLI',
    @datasrc = '26.154.21.115,1433'; -- IP del nodo Sur con puerto

EXEC sp_addlinkedsrvlogin 
    @rmtsrvname = 'NodoSur',
    @useself = 'FALSE',
    @locallogin = NULL,
    @rmtuser = 'sa',
    @rmtpassword = 'P@ssw0rd';

-- Linked Server al Nodo Norte
IF EXISTS (SELECT * FROM sys.servers WHERE name = 'NodoNorte')
    EXEC sp_dropserver 'NodoNorte', 'droplogins';

EXEC sp_addlinkedserver 
    @server = 'NodoNorte',
    @srvproduct = 'SQL Server',
    @provider = 'SQLNCLI',
    @datasrc = '26.91.154.235,1433'; -- IP del nodo Norte con puerto

EXEC sp_addlinkedsrvlogin 
    @rmtsrvname = 'NodoNorte',
    @useself = 'FALSE',
    @locallogin = NULL,
    @rmtuser = 'sa',
    @rmtpassword = 'P@ssw0rd';

GO

-- =====================================================
-- PASO 2: CREAR VISTAS PARTICIONADAS GLOBALES
-- =====================================================

-- Vista Global de Vehículos
IF OBJECT_ID('dbo.Vista_Vehiculos_Global', 'V') IS NOT NULL
    DROP VIEW dbo.Vista_Vehiculos_Global;
GO

CREATE VIEW dbo.Vista_Vehiculos_Global AS
SELECT 
    vg.matricula,
    vg.cedula_cliente,  
    vg.marca,
    vg.modelo,
    vg.fecha_compra,
    vg.anio,
    'Sur' as Origen_Nodo
FROM NodoSur.Nodo_Sur.dbo.Vehiculo_General_Sur vg

UNION ALL

SELECT 
    vg.matricula,
    vg.cedula_cliente,
    vg.marca,
    vg.modelo,
    vg.fecha_compra,
    vg.anio,
    'Norte' as Origen_Nodo
FROM NodoNorte.Nodo_Norte.dbo.Vehiculo_General_Norte vg;
GO

-- Vista Global de Empleados
IF OBJECT_ID('dbo.Vista_Empleados_Global', 'V') IS NOT NULL
    DROP VIEW dbo.Vista_Empleados_Global;
GO

CREATE VIEW dbo.Vista_Empleados_Global AS
SELECT 
    cedula_empleado,
    nombre,
    fecha_ingreso,
    sueldo,
    'Sur' as Origen_Nodo
FROM NodoSur.Nodo_Sur.dbo.Empleado

UNION ALL

SELECT 
    cedula_empleado,
    nombre,
    fecha_ingreso,
    sueldo,
    'Norte' as Origen_Nodo
FROM NodoNorte.Nodo_Norte.dbo.Empleado;
GO

-- Vista Global de Repuestos
IF OBJECT_ID('dbo.Vista_Repuestos_Global', 'V') IS NOT NULL
    DROP VIEW dbo.Vista_Repuestos_Global;
GO

CREATE VIEW dbo.Vista_Repuestos_Global AS
SELECT 
    id_repuesto,
    nombre,
    tipo,
    descripcion,
    cantidad_disponible,
    'Sur' as Origen_Nodo
FROM NodoSur.Nodo_Sur.dbo.Repuesto_Sur

UNION ALL

SELECT 
    id_repuesto,
    nombre,
    tipo,
    descripcion,
    cantidad_disponible,
    'Norte' as Origen_Nodo
FROM NodoNorte.Nodo_Norte.dbo.Repuesto_Norte;
GO

-- Vista Global de Reparaciones
IF OBJECT_ID('dbo.Vista_Reparaciones_Global', 'V') IS NOT NULL
    DROP VIEW dbo.Vista_Reparaciones_Global;
GO

CREATE VIEW dbo.Vista_Reparaciones_Global AS
SELECT 
    id_reparacion,
    fecha,
    tipo,
    observaciones,
    anio,
    precio,
    matricula,
    id_taller,
    'Sur' as Origen_Nodo
FROM NodoSur.Nodo_Sur.dbo.Reparacion_Sur

UNION ALL

SELECT 
    id_reparacion,
    fecha,
    tipo,
    observaciones,
    anio,
    precio,
    matricula,
    id_taller,
    'Norte' as Origen_Nodo
FROM NodoNorte.Nodo_Norte.dbo.Reparacion_Norte;
GO

-- =====================================================
-- PASO 3: CREAR VISTAS DE REPORTES AVANZADOS
-- =====================================================

-- Reporte de Estadísticas Generales
IF OBJECT_ID('dbo.Vista_Estadisticas_General', 'V') IS NOT NULL
    DROP VIEW dbo.Vista_Estadisticas_General;
GO

CREATE VIEW dbo.Vista_Estadisticas_General AS
SELECT 
    'Sur' as Sede,
    COUNT(DISTINCT vg.matricula) as Total_Vehiculos,
    COUNT(DISTINCT e.cedula_empleado) as Total_Empleados,
    COUNT(DISTINCT rep.id_repuesto) as Total_Repuestos,
    COUNT(DISTINCT r.id_reparacion) as Total_Reparaciones,
    AVG(r.precio) as Precio_Promedio_Reparacion,
    SUM(r.precio) as Ingresos_Totales
FROM NodoSur.Nodo_Sur.dbo.Vehiculo_General_Sur vg
FULL OUTER JOIN NodoSur.Nodo_Sur.dbo.Empleado e ON 1=1
FULL OUTER JOIN NodoSur.Nodo_Sur.dbo.Repuesto_Sur rep ON 1=1
FULL OUTER JOIN NodoSur.Nodo_Sur.dbo.Reparacion_Sur r ON vg.matricula = r.matricula

UNION ALL

SELECT 
    'Norte' as Sede,
    COUNT(DISTINCT vg.matricula) as Total_Vehiculos,
    COUNT(DISTINCT e.cedula_empleado) as Total_Empleados,
    COUNT(DISTINCT rep.id_repuesto) as Total_Repuestos,
    COUNT(DISTINCT r.id_reparacion) as Total_Reparaciones,
    AVG(r.precio) as Precio_Promedio_Reparacion,
    SUM(r.precio) as Ingresos_Totales
FROM NodoNorte.Nodo_Norte.dbo.Vehiculo_General_Norte vg
FULL OUTER JOIN NodoNorte.Nodo_Norte.dbo.Empleado e ON 1=1
FULL OUTER JOIN NodoNorte.Nodo_Norte.dbo.Repuesto_Norte rep ON 1=1
FULL OUTER JOIN NodoNorte.Nodo_Norte.dbo.Reparacion_Norte r ON vg.matricula = r.matricula;
GO

-- =====================================================
-- PASO 4: VERIFICAR CONFIGURACIÓN
-- =====================================================

-- Probar conectividad con linked servers
SELECT 'Conexión a Nodo Sur' as Prueba, COUNT(*) as Total_Vehiculos
FROM NodoSur.Nodo_Sur.dbo.Vehiculo_Matricula

UNION ALL

SELECT 'Conexión a Nodo Norte' as Prueba, COUNT(*) as Total_Vehiculos
FROM NodoNorte.Nodo_Norte.dbo.Vehiculo_Matricula;

-- Mostrar vistas creadas
SELECT 
    name as Vista_Creada,
    create_date as Fecha_Creacion
FROM sys.views 
WHERE name LIKE 'Vista_%'
ORDER BY name;

PRINT '✅ Configuración de vistas particionadas completada exitosamente';
GO
