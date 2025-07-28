// services/dataService.js
const sql = require('mssql');
const { getConnectionPool, getCentralConnectionPool, getAllActivePools } = require('../config/database');

class DataService {
  constructor() {
    this.currentSede = 'Sur'; // Sede por defecto
  }

  // Establecer la sede actual para fragmentación
  setSede(sede) {
    this.currentSede = sede;
    console.log(`🏢 Sede actual establecida: ${sede}`);
  }

  // Ejecutar operación en el nodo correspondiente
  async executeOnNode(operation, sede = null) {
    const targetSede = sede || this.currentSede;
    const pool = getConnectionPool(targetSede);
    
    if (!pool || !pool.connected) {
      throw new Error(`Nodo ${targetSede} no disponible`);
    }

    try {
      return await operation(pool);
    } catch (error) {
      console.error(`❌ Error en nodo ${targetSede}:`, error.message);
      throw error;
    }
  }

  // Ejecutar consulta global en la base central (vistas particionadas)
  async executeGlobalQuery(operation) {
    const centralPool = getCentralConnectionPool();
    
    if (!centralPool || !centralPool.connected) {
      throw new Error('Base central no disponible para consultas globales');
    }

    try {
      return await operation(centralPool);
    } catch (error) {
      console.error(`❌ Error en consulta global:`, error.message);
      throw error;
    }
  }

  // VEHÍCULOS
  async registrarVehiculo(vehiculoData) {
    const { cedulaCliente, matricula, marca, modelo, fechaCompra, anio } = vehiculoData;
    
    return await this.executeOnNode(async (pool) => {
      const request = pool.request();
      request.input('cedulaCliente', sql.VarChar, cedulaCliente);
      request.input('matricula', sql.VarChar, matricula);
      request.input('marca', sql.VarChar, marca);
      request.input('modelo', sql.VarChar, modelo);
      request.input('fechaCompra', sql.Date, fechaCompra || new Date());
      request.input('anio', sql.Int, anio || new Date().getFullYear());
      
      // Primero insertar solo la matrícula en la tabla replicada Vehiculo_Matricula
      await request.query(`
        INSERT INTO Vehiculo_Matricula (matricula) 
        VALUES (@matricula);
      `);
      
      // Luego insertar en la tabla fragmentada por sede con todos los datos
      const tablaVehiculo = `Vehiculo_General_${this.currentSede}`;
      const result = await request.query(`
        INSERT INTO ${tablaVehiculo} (matricula, marca, modelo, fecha_compra, anio, cedula_cliente) 
        VALUES (@matricula, @marca, @modelo, @fechaCompra, @anio, @cedulaCliente);
        
        SELECT v.* 
        FROM ${tablaVehiculo} v
        WHERE v.matricula = @matricula;
      `);
      
      return {
        success: true,
        message: `Vehículo registrado exitosamente en nodo ${this.currentSede}`,
        data: result.recordset[0]
      };
    });
  }

  // EMPLEADOS
  async registrarEmpleado(empleadoData) {
    const { cedulaEmpleado, nombre, fechaIngreso, sueldo } = empleadoData;
    
    return await this.executeOnNode(async (pool) => {
      const request = pool.request();
      request.input('cedulaEmpleado', sql.VarChar, cedulaEmpleado);
      request.input('nombre', sql.VarChar, nombre);
      request.input('fechaIngreso', sql.Date, fechaIngreso || new Date());
      request.input('sueldo', sql.Decimal(10, 2), sueldo);
      
      const resultEmpleado = await request.query(`
        INSERT INTO Empleado (cedula, nombre, fecha_ingreso, sueldo) 
        VALUES (@cedulaEmpleado, @nombre, @fechaIngreso, @sueldo);
        
        SELECT cedula as id_empleado, nombre, fecha_ingreso, sueldo FROM Empleado WHERE cedula = @cedulaEmpleado;
      `);
      
      return {
        success: true,
        message: `Empleado registrado exitosamente en nodo ${this.currentSede}`,
        data: resultEmpleado.recordset[0]
      };
    });
  }

  // REPUESTOS
  async registrarRepuesto(repuestoData) {
    const { idRepuesto, nombre, tipo, descripcion, cantidadDisponible } = repuestoData;
    
    return await this.executeOnNode(async (pool) => {
      const request = pool.request();
      request.input('idRepuesto', sql.Int, idRepuesto);
      request.input('nombre', sql.VarChar, nombre);
      request.input('tipo', sql.VarChar, tipo);
      request.input('descripcion', sql.Text, descripcion);
      request.input('cantidadDisponible', sql.Int, cantidadDisponible);
      
      const tableName = `Repuesto_${this.currentSede}`;
      const resultRepuesto = await request.query(`
        INSERT INTO ${tableName} (id_repuesto, nombre, tipo, descripcion, cantidad) 
        VALUES (@idRepuesto, @nombre, @tipo, @descripcion, @cantidadDisponible);
        
        SELECT 
          id_repuesto, 
          nombre, 
          tipo, 
          descripcion, 
          cantidad as cantidad_disponible,
          id_taller
        FROM ${tableName} WHERE id_repuesto = @idRepuesto;
      `);
      
      return {
        success: true,
        message: `Repuesto registrado exitosamente en nodo ${this.currentSede}`,
        data: resultRepuesto.recordset[0]
      };
    });
  }

  // REPARACIONES
  async registrarReparacion(reparacionData) {
    const { idReparacion, fecha, tipo, observaciones, anio, precio, matricula, idTaller } = reparacionData;
    
    return await this.executeOnNode(async (pool) => {
      const request = pool.request();
      request.input('idReparacion', sql.Int, idReparacion);
      request.input('fecha', sql.Date, fecha || new Date());
      request.input('tipo', sql.VarChar, tipo);
      request.input('observaciones', sql.Text, observaciones);
      request.input('anio', sql.Int, anio || new Date().getFullYear());
      request.input('precio', sql.Decimal(10, 2), precio);
      request.input('matricula', sql.VarChar, matricula);
      request.input('idTaller', sql.Int, idTaller);
      
      const tableName = `Reparacion_${this.currentSede}`;
      const resultReparacion = await request.query(`
        INSERT INTO ${tableName} (id_reparacion, fecha, tipo, observaciones, anio, precio, matricula, id_taller) 
        VALUES (@idReparacion, @fecha, @tipo, @observaciones, @anio, @precio, @matricula, @idTaller);
        
        SELECT * FROM ${tableName} WHERE id_reparacion = @idReparacion;
      `);
      
      return {
        success: true,
        message: `Reparación registrada exitosamente en nodo ${this.currentSede}`,
        data: resultReparacion.recordset[0]
      };
    });
  }

  // CONSULTAS DISTRIBUIDAS
  async consultarReparaciones(filtros) {
    const { cedulaCliente, matricula } = filtros;
    
    // Si hay filtros específicos, buscar en la sede actual primero
    if (cedulaCliente || matricula) {
      try {
        const resultadoLocal = await this.consultarEnSede(filtros, this.currentSede);
        if (resultadoLocal && resultadoLocal.length > 0) {
          return {
            success: true,
            data: resultadoLocal,
            message: `Resultados encontrados en nodo ${this.currentSede}`,
            sede: this.currentSede
          };
        }
      } catch (error) {
        console.warn(`⚠️  Error consultando en nodo ${this.currentSede}:`, error.message);
      }
    }

    // Si no se encontraron resultados localmente, buscar en ambos nodos
    return await this.consultarEnTodosLosNodos(filtros);
  }

  async consultarEnSede(filtros, sede) {
    return await this.executeOnNode(async (pool) => {
      const request = pool.request();
      const tableName = `Reparacion_${sede}`;
      let query = `
        SELECT 
          r.id_reparacion,
          r.fecha,
          r.tipo,
          r.observaciones,
          r.anio,
          r.precio,
          r.matricula,
          r.id_taller,
          vg.cedula_cliente,
          vg.marca,
          vg.modelo,
          c.nombre as nombre_cliente,
          c.apellido as apellido_cliente,
          c.zona
        FROM ${tableName} r
        LEFT JOIN Vehiculo_General_${sede} vg ON r.matricula = vg.matricula
        LEFT JOIN Cliente c ON vg.cedula_cliente = c.cedula
        WHERE 1=1
      `;

      if (filtros.cedulaCliente) {
        query += ' AND vg.cedula_cliente = @cedulaCliente';
        request.input('cedulaCliente', sql.VarChar, filtros.cedulaCliente);
      }

      if (filtros.matricula) {
        query += ' AND r.matricula = @matricula';
        request.input('matricula', sql.VarChar, filtros.matricula);
      }

      query += ' ORDER BY r.fecha DESC';

      const queryResult = await request.query(query);
      return queryResult.recordset;
    }, sede);
  }

  async consultarEnTodosLosNodos(filtros) {
    const resultadosCombinados = [];
    const nodosConsultados = [];
    const activePools = getAllActivePools();

    for (const [poolKey, pool] of Object.entries(activePools)) {
      const sede = poolKey.includes('Sur') ? 'Sur' : 'Norte';
      
      try {
        const resultados = await this.consultarEnSede(filtros, sede);
        if (resultados && resultados.length > 0) {
          resultadosCombinados.push(...resultados);
          nodosConsultados.push(sede);
        }
      } catch (error) {
        console.warn(`⚠️  Error consultando en nodo ${sede}:`, error.message);
      }
    }

    return {
      success: true,
      data: resultadosCombinados,
      message: `Búsqueda distribuida completada. Consultados nodos: ${nodosConsultados.join(', ')}`,
      nodosConsultados
    };
  }

  // Función para obtener estadísticas del sistema
  async obtenerEstadisticas() {
    const estadisticas = {
      nodos: {},
      total: {
        vehiculos: 0,
        empleados: 0,
        repuestos: 0,
        reparaciones: 0
      }
    };

    const activePools = getAllActivePools();

    for (const [poolKey, pool] of Object.entries(activePools)) {
      const sede = poolKey.includes('Sur') ? 'Sur' : 'Norte';
      
      try {
        const request = pool.request();
        const statsQuery = await request.query(`
          SELECT 
            (SELECT COUNT(*) FROM Vehiculo_Matricula) as vehiculos,
            (SELECT COUNT(*) FROM Empleado) as empleados,
            (SELECT COUNT(*) FROM Repuesto_${sede}) as repuestos,
            (SELECT COUNT(*) FROM Reparacion_${sede}) as reparaciones
        `);

        const stats = statsQuery.recordset[0];
        estadisticas.nodos[sede] = stats;
        
        estadisticas.total.vehiculos += stats.vehiculos;
        estadisticas.total.empleados += stats.empleados;
        estadisticas.total.repuestos += stats.repuestos;
        estadisticas.total.reparaciones += stats.reparaciones;

      } catch (error) {
        console.warn(`⚠️  Error obteniendo estadísticas de nodo ${sede}:`, error.message);
        estadisticas.nodos[sede] = { error: error.message };
      }
    }

    return estadisticas;
  }

  // =====================================================
  // CONSULTAS GLOBALES USANDO VISTAS PARTICIONADAS
  // =====================================================

  // Obtener todos los vehículos de ambas sedes
  async obtenerVehiculosGlobales() {
    return await this.executeGlobalQuery(async (pool) => {
      const request = pool.request();
      const result = await request.query(`
        SELECT 
          Vehiculo_ID,
          CI_Cliente,
          Matricula,
          Marca,
          Modelo,
          Sede,
          Fecha_Registro,
          Origen_Nodo
        FROM Vista_Vehiculos_Global
        ORDER BY Fecha_Registro DESC;
      `);
      return result.recordset;
    });
  }

  // Obtener estadísticas generales de ambas sedes
  async obtenerEstadisticasGlobales() {
    return await this.executeGlobalQuery(async (pool) => {
      const request = pool.request();
      const result = await request.query(`
        SELECT 
          Sede,
          Total_Vehiculos,
          Reparaciones_Activas,
          Reparaciones_Completadas,
          Costo_Promedio_Reparacion,
          Ingresos_Totales
        FROM Vista_Estadisticas_General
        ORDER BY Sede;
      `);
      return result.recordset;
    });
  }

  // Búsqueda global de reparaciones por criterios
  async buscarReparacionesGlobales(criterio = {}) {
    return await this.executeGlobalQuery(async (pool) => {
      const request = pool.request();
      let whereClause = '1=1';
      
      if (criterio.sede) {
        request.input('sede', sql.VarChar, criterio.sede);
        whereClause += ' AND Sede = @sede';
      }
      
      if (criterio.estado) {
        request.input('estado', sql.VarChar, criterio.estado);
        whereClause += ' AND Estado = @estado';
      }
      
      if (criterio.fechaDesde) {
        request.input('fechaDesde', sql.DateTime, criterio.fechaDesde);
        whereClause += ' AND Fecha_Inicio >= @fechaDesde';
      }

      const result = await request.query(`
        SELECT 
          Reparacion_ID,
          Vehiculo_ID,
          Empleado_ID,
          Descripcion,
          Fecha_Inicio,
          Fecha_Fin,
          Estado,
          Costo_Total,
          Sede,
          Origen_Nodo
        FROM Vista_Reparaciones_Global
        WHERE ${whereClause}
        ORDER BY Fecha_Inicio DESC;
      `);
      
      return result.recordset;
    });
  }

  // Reporte consolidado de todas las sedes
  async generarReporteConsolidado() {
    return await this.executeGlobalQuery(async (pool) => {
      const request = pool.request();
      const result = await request.query(`
        SELECT 
          'RESUMEN GENERAL' as Tipo,
          COUNT(DISTINCT v.Vehiculo_ID) as Total_Vehiculos,
          COUNT(DISTINCT e.Empleado_ID) as Total_Empleados,
          COUNT(DISTINCT rep.Repuesto_ID) as Total_Repuestos,
          COUNT(DISTINCT r.Reparacion_ID) as Total_Reparaciones,
          SUM(CASE WHEN r.Estado = 'Completada' THEN r.Costo_Total ELSE 0 END) as Ingresos_Totales
        FROM Vista_Vehiculos_Global v
        FULL OUTER JOIN Vista_Empleados_Global e ON v.Sede = e.Sede
        FULL OUTER JOIN Vista_Repuestos_Global rep ON v.Sede = rep.Sede
        FULL OUTER JOIN Vista_Reparaciones_Global r ON v.Sede = r.Sede

        UNION ALL

        SELECT 
          'SEDE ' + Sede as Tipo,
          Total_Vehiculos,
          0 as Total_Empleados,
          0 as Total_Repuestos,
          (Reparaciones_Activas + Reparaciones_Completadas) as Total_Reparaciones,
          Ingresos_Totales
        FROM Vista_Estadisticas_General
        ORDER BY Tipo;
      `);
      
      return result.recordset;
    });
  }

  // =====================================================
  // OPERACIONES UPDATE (EDITAR)
  // =====================================================

  // ACTUALIZAR VEHÍCULO (Fragmentación Vertical)
  async actualizarVehiculo(matricula, vehiculoData) {
    const { cedulaCliente, marca, modelo, fechaCompra, anio } = vehiculoData;
    
    return await this.executeOnNode(async (pool) => {
      const request = pool.request();
      request.input('matricula', sql.VarChar, matricula);
      request.input('cedulaCliente', sql.VarChar, cedulaCliente);
      request.input('marca', sql.VarChar, marca);
      request.input('modelo', sql.VarChar, modelo);
      request.input('fechaCompra', sql.Date, fechaCompra);
      request.input('anio', sql.Int, anio);
      
      // Actualizar en la tabla fragmentada por sede
      const tablaVehiculo = `Vehiculo_General_${this.currentSede}`;
      const result = await request.query(`
        UPDATE ${tablaVehiculo} 
        SET marca = @marca, 
            modelo = @modelo, 
            fecha_compra = @fechaCompra, 
            anio = @anio,
            cedula_cliente = @cedulaCliente
        WHERE matricula = @matricula;
        
        SELECT * FROM ${tablaVehiculo} WHERE matricula = @matricula;
      `);
      
      if (result.recordset.length === 0) {
        throw new Error(`Vehículo con matrícula ${matricula} no encontrado en nodo ${this.currentSede}`);
      }
      
      return {
        success: true,
        message: `Vehículo actualizado exitosamente en nodo ${this.currentSede}`,
        data: result.recordset[0]
      };
    });
  }

  // ACTUALIZAR EMPLEADO
  async actualizarEmpleado(cedulaEmpleado, empleadoData) {
    const { nombre, fechaIngreso, sueldo } = empleadoData;
    
    return await this.executeOnNode(async (pool) => {
      const request = pool.request();
      request.input('cedulaEmpleado', sql.VarChar, cedulaEmpleado);
      request.input('nombre', sql.VarChar, nombre);
      request.input('fechaIngreso', sql.Date, fechaIngreso);
      request.input('sueldo', sql.Decimal(10, 2), sueldo);
      
      const result = await request.query(`
        UPDATE Empleado 
        SET nombre = @nombre, 
            fecha_ingreso = @fechaIngreso, 
            sueldo = @sueldo
        WHERE cedula = @cedulaEmpleado;
        
        SELECT cedula as id_empleado, nombre, fecha_ingreso, sueldo FROM Empleado WHERE cedula = @cedulaEmpleado;
      `);
      
      if (result.recordset.length === 0) {
        throw new Error(`Empleado con cédula ${cedulaEmpleado} no encontrado en nodo ${this.currentSede}`);
      }
      
      return {
        success: true,
        message: `Empleado actualizado exitosamente en nodo ${this.currentSede}`,
        data: result.recordset[0]
      };
    });
  }

  // ACTUALIZAR REPUESTO (Fragmentación Horizontal)
  async actualizarRepuesto(idRepuesto, repuestoData) {
    const { nombre, tipo, descripcion, cantidadDisponible } = repuestoData;
    
    return await this.executeOnNode(async (pool) => {
      const request = pool.request();
      request.input('idRepuesto', sql.Int, idRepuesto);
      request.input('nombre', sql.VarChar, nombre);
      request.input('tipo', sql.VarChar, tipo);
      request.input('descripcion', sql.Text, descripcion);
      request.input('cantidadDisponible', sql.Int, cantidadDisponible);
      
      const tableName = `Repuesto_${this.currentSede}`;
      const result = await request.query(`
        UPDATE ${tableName} 
        SET nombre = @nombre, 
            tipo = @tipo, 
            descripcion = @descripcion, 
            cantidad = @cantidadDisponible
        WHERE id_repuesto = @idRepuesto;
        
        SELECT 
          id_repuesto, 
          nombre, 
          tipo, 
          descripcion, 
          cantidad as cantidad_disponible,
          id_taller
        FROM ${tableName} WHERE id_repuesto = @idRepuesto;
      `);
      
      if (result.recordset.length === 0) {
        throw new Error(`Repuesto con ID ${idRepuesto} no encontrado en nodo ${this.currentSede}`);
      }
      
      return {
        success: true,
        message: `Repuesto actualizado exitosamente en nodo ${this.currentSede}`,
        data: result.recordset[0]
      };
    });
  }

  // ACTUALIZAR REPARACIÓN (Fragmentación Horizontal)
  async actualizarReparacion(idReparacion, reparacionData) {
    const { fecha, tipo, observaciones, anio, precio, matricula, idTaller } = reparacionData;
    
    return await this.executeOnNode(async (pool) => {
      const request = pool.request();
      request.input('idReparacion', sql.Int, idReparacion);
      request.input('fecha', sql.Date, fecha);
      request.input('tipo', sql.VarChar, tipo);
      request.input('observaciones', sql.Text, observaciones);
      request.input('anio', sql.Int, anio);
      request.input('precio', sql.Decimal(10, 2), precio);
      request.input('matricula', sql.VarChar, matricula);
      request.input('idTaller', sql.Int, idTaller);
      
      const tableName = `Reparacion_${this.currentSede}`;
      const result = await request.query(`
        UPDATE ${tableName} 
        SET fecha = @fecha, 
            tipo = @tipo, 
            observaciones = @observaciones, 
            anio = @anio, 
            precio = @precio, 
            matricula = @matricula, 
            id_taller = @idTaller
        WHERE id_reparacion = @idReparacion;
        
        SELECT * FROM ${tableName} WHERE id_reparacion = @idReparacion;
      `);
      
      if (result.recordset.length === 0) {
        throw new Error(`Reparación con ID ${idReparacion} no encontrada en nodo ${this.currentSede}`);
      }
      
      return {
        success: true,
        message: `Reparación actualizada exitosamente en nodo ${this.currentSede}`,
        data: result.recordset[0]
      };
    });
  }

  // =====================================================
  // OPERACIONES DELETE (ELIMINAR)
  // =====================================================

  // ELIMINAR VEHÍCULO (Fragmentación Vertical)
  async eliminarVehiculo(matricula) {
    return await this.executeOnNode(async (pool) => {
      const request = pool.request();
      request.input('matricula', sql.VarChar, matricula);
      
      // Primero obtener los datos antes de eliminar
      const tablaVehiculo = `Vehiculo_General_${this.currentSede}`;
      const selectResult = await request.query(`
        SELECT * FROM ${tablaVehiculo} WHERE matricula = @matricula;
      `);
      
      if (selectResult.recordset.length === 0) {
        throw new Error(`Vehículo con matrícula ${matricula} no encontrado en nodo ${this.currentSede}`);
      }
      
      // Eliminar de la tabla fragmentada
      await request.query(`
        DELETE FROM ${tablaVehiculo} WHERE matricula = @matricula;
      `);
      
      // Eliminar de la tabla replicada (solo si no hay más referencias)
      try {
        await request.query(`
          DELETE FROM Vehiculo_Matricula WHERE matricula = @matricula;
        `);
      } catch (error) {
        console.warn(`⚠️  No se pudo eliminar de Vehiculo_Matricula (puede estar en uso): ${error.message}`);
      }
      
      return {
        success: true,
        message: `Vehículo eliminado exitosamente de nodo ${this.currentSede}`,
        data: selectResult.recordset[0]
      };
    });
  }

  // ELIMINAR EMPLEADO
  async eliminarEmpleado(cedulaEmpleado) {
    return await this.executeOnNode(async (pool) => {
      const request = pool.request();
      request.input('cedulaEmpleado', sql.VarChar, cedulaEmpleado);
      
      // Primero obtener los datos antes de eliminar
      const selectResult = await request.query(`
        SELECT cedula as id_empleado, nombre, fecha_ingreso, sueldo FROM Empleado WHERE cedula = @cedulaEmpleado;
      `);
      
      if (selectResult.recordset.length === 0) {
        throw new Error(`Empleado con cédula ${cedulaEmpleado} no encontrado en nodo ${this.currentSede}`);
      }
      
      // Eliminar empleado
      await request.query(`
        DELETE FROM Empleado WHERE cedula = @cedulaEmpleado;
      `);
      
      return {
        success: true,
        message: `Empleado eliminado exitosamente de nodo ${this.currentSede}`,
        data: selectResult.recordset[0]
      };
    });
  }

  // ELIMINAR REPUESTO (Fragmentación Horizontal)
  async eliminarRepuesto(idRepuesto) {
    return await this.executeOnNode(async (pool) => {
      const request = pool.request();
      request.input('idRepuesto', sql.Int, idRepuesto);
      
      const tableName = `Repuesto_${this.currentSede}`;
      
      // Primero obtener los datos antes de eliminar
      const selectResult = await request.query(`
        SELECT 
          id_repuesto, 
          nombre, 
          tipo, 
          descripcion, 
          cantidad as cantidad_disponible,
          id_taller
        FROM ${tableName} WHERE id_repuesto = @idRepuesto;
      `);
      
      if (selectResult.recordset.length === 0) {
        throw new Error(`Repuesto con ID ${idRepuesto} no encontrado en nodo ${this.currentSede}`);
      }
      
      // Eliminar repuesto
      await request.query(`
        DELETE FROM ${tableName} WHERE id_repuesto = @idRepuesto;
      `);
      
      return {
        success: true,
        message: `Repuesto eliminado exitosamente de nodo ${this.currentSede}`,
        data: selectResult.recordset[0]
      };
    });
  }

  // ELIMINAR REPARACIÓN (Fragmentación Horizontal)
  async eliminarReparacion(idReparacion) {
    return await this.executeOnNode(async (pool) => {
      const request = pool.request();
      request.input('idReparacion', sql.Int, idReparacion);
      
      const tableName = `Reparacion_${this.currentSede}`;
      
      // Primero obtener los datos antes de eliminar
      const selectResult = await request.query(`
        SELECT * FROM ${tableName} WHERE id_reparacion = @idReparacion;
      `);
      
      if (selectResult.recordset.length === 0) {
        throw new Error(`Reparación con ID ${idReparacion} no encontrada en nodo ${this.currentSede}`);
      }
      
      // Eliminar reparación
      await request.query(`
        DELETE FROM ${tableName} WHERE id_reparacion = @idReparacion;
      `);
      
      return {
        success: true,
        message: `Reparación eliminada exitosamente de nodo ${this.currentSede}`,
        data: selectResult.recordset[0]
      };
    });
  }

  // =====================================================
  // OPERACIONES READ/LIST (LISTAR TODOS)
  // =====================================================

  // LISTAR TODOS LOS VEHÍCULOS
  async listarVehiculos() {
    return await this.executeOnNode(async (pool) => {
      const request = pool.request();
      const tablaVehiculo = `Vehiculo_General_${this.currentSede}`;
      
      const result = await request.query(`
        SELECT 
          vg.matricula,
          vg.cedula_cliente,
          vg.marca,
          vg.modelo,
          vg.fecha_compra,
          vg.anio,
          c.nombre as nombre_cliente,
          c.apellido as apellido_cliente,
          c.zona
        FROM ${tablaVehiculo} vg
        LEFT JOIN Cliente c ON vg.cedula_cliente = c.cedula
        ORDER BY vg.matricula
      `);
      
      return {
        success: true,
        data: result.recordset,
        message: `${result.recordset.length} vehículos encontrados en nodo ${this.currentSede}`
      };
    });
  }

  // LISTAR TODOS LOS EMPLEADOS
  async listarEmpleados() {
    return await this.executeOnNode(async (pool) => {
      const request = pool.request();
      
      const result = await request.query(`
        SELECT 
          cedula as id_empleado, 
          nombre, 
          fecha_ingreso, 
          sueldo 
        FROM Empleado ORDER BY nombre
      `);
      
      return {
        success: true,
        data: result.recordset,
        message: `${result.recordset.length} empleados encontrados en nodo ${this.currentSede}`
      };
    });
  }

  // LISTAR TODOS LOS REPUESTOS
  async listarRepuestos() {
    return await this.executeOnNode(async (pool) => {
      const request = pool.request();
      const tableName = `Repuesto_${this.currentSede}`;
      
      const result = await request.query(`
        SELECT 
          id_repuesto, 
          nombre, 
          tipo, 
          descripcion, 
          cantidad as cantidad_disponible,
          id_taller
        FROM ${tableName} ORDER BY nombre
      `);
      
      return {
        success: true,
        data: result.recordset,
        message: `${result.recordset.length} repuestos encontrados en nodo ${this.currentSede}`
      };
    });
  }

  // LISTAR TODAS LAS REPARACIONES
  async listarReparaciones() {
    return await this.executeOnNode(async (pool) => {
      const request = pool.request();
      const tableName = `Reparacion_${this.currentSede}`;
      
      const result = await request.query(`
        SELECT 
          r.id_reparacion,
          r.fecha as fecha_inicio,
          NULL as fecha_fin,
          r.tipo as descripcion,
          r.observaciones,
          r.anio,
          r.precio as costo_mano_obra,
          0 as costo_repuestos,
          r.matricula,
          r.id_taller as id_empleado,
          vg.marca,
          vg.modelo,
          vg.cedula_cliente,
          c.nombre as nombre_cliente,
          c.apellido as apellido_cliente
        FROM ${tableName} r
        LEFT JOIN Vehiculo_General_${this.currentSede} vg ON r.matricula = vg.matricula
        LEFT JOIN Cliente c ON vg.cedula_cliente = c.cedula
        ORDER BY r.fecha DESC
      `);
      
      return {
        success: true,
        data: result.recordset,
        message: `${result.recordset.length} reparaciones encontradas en nodo ${this.currentSede}`
      };
    });
  }

  // LISTAR TODOS LOS CLIENTES
  async listarClientes() {
    return await this.executeOnNode(async (pool) => {
      const request = pool.request();
      
      const result = await request.query(`
        SELECT 
          c.cedula,
          c.nombre,
          c.apellido,
          c.zona,
          COUNT(vg.matricula) as total_vehiculos,
          COUNT(r.id_reparacion) as total_reparaciones,
          COALESCE(SUM(r.precio), 0) as total_gastado
        FROM Cliente c
        LEFT JOIN Vehiculo_General_${this.currentSede} vg ON c.cedula = vg.cedula_cliente
        LEFT JOIN Reparacion_${this.currentSede} r ON vg.matricula = r.matricula
        GROUP BY c.cedula, c.nombre, c.apellido, c.zona
        ORDER BY c.apellido, c.nombre
      `);
      
      return {
        success: true,
        data: result.recordset,
        message: `${result.recordset.length} clientes encontrados en nodo ${this.currentSede}`
      };
    });
  }

  // CONSULTAR CLIENTE POR CÉDULA
  async consultarClientePorCedula(cedula) {
    return await this.executeOnNode(async (pool) => {
      const request = pool.request();
      request.input('cedula', sql.VarChar, cedula);
      
      const clienteResult = await request.query(`
        SELECT 
          c.cedula,
          c.nombre,
          c.apellido,
          c.zona
        FROM Cliente c
        WHERE c.cedula = @cedula
      `);

      if (clienteResult.recordset.length === 0) {
        return {
          success: false,
          message: `Cliente con cédula ${cedula} no encontrado en nodo ${this.currentSede}`
        };
      }

      // Obtener vehículos del cliente
      const vehiculosResult = await request.query(`
        SELECT 
          vg.matricula,
          vg.marca,
          vg.modelo,
          vg.anio,
          vg.fecha_compra
        FROM Vehiculo_General_${this.currentSede} vg
        WHERE vg.cedula_cliente = @cedula
        ORDER BY vg.fecha_compra DESC
      `);

      // Obtener reparaciones del cliente
      const reparacionesResult = await request.query(`
        SELECT 
          r.id_reparacion,
          r.fecha,
          r.tipo,
          r.precio,
          r.matricula,
          vg.marca,
          vg.modelo
        FROM Reparacion_${this.currentSede} r
        INNER JOIN Vehiculo_General_${this.currentSede} vg ON r.matricula = vg.matricula
        WHERE vg.cedula_cliente = @cedula
        ORDER BY r.fecha DESC
      `);

      const cliente = clienteResult.recordset[0];
      cliente.vehiculos = vehiculosResult.recordset;
      cliente.reparaciones = reparacionesResult.recordset;
      cliente.total_vehiculos = vehiculosResult.recordset.length;
      cliente.total_reparaciones = reparacionesResult.recordset.length;
      cliente.total_gastado = reparacionesResult.recordset.reduce((sum, rep) => sum + (rep.precio || 0), 0);

      return {
        success: true,
        data: cliente,
        message: `Cliente encontrado en nodo ${this.currentSede}`
      };
    });
  }

}

module.exports = new DataService();