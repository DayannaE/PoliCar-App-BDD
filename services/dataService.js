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
      console.warn('⚠️  Base central no disponible - usando fallback a consulta distribuida');
      throw new Error('Base central no disponible para consultas globales');
    }

    try {
      return await operation(centralPool);
    } catch (error) {
      console.error(`❌ Error en consulta global:`, error.message);
      console.error(`❌ Detalles del error:`, error);
      throw error;
    }
  }

  // Función de diagnóstico para verificar las vistas particionadas
  async diagnosticarVistasParticionadas() {
    try {
      const centralPool = getCentralConnectionPool();
      
      if (!centralPool || !centralPool.connected) {
        return {
          success: false,
          message: 'Base central no disponible',
          details: 'La conexión a la base central no está establecida'
        };
      }

      const request = centralPool.request();
      
      // Verificar qué vistas existen
      const vistasResult = await request.query(`
        SELECT 
          name as Vista_Nombre,
          create_date as Fecha_Creacion
        FROM sys.views 
        WHERE name LIKE 'Vista_%'
        ORDER BY name;
      `);

      // Verificar qué tablas existen
      const tablasResult = await request.query(`
        SELECT 
          name as Tabla_Nombre,
          create_date as Fecha_Creacion
        FROM sys.tables 
        ORDER BY name;
      `);

      // Verificar linked servers
      const linkedServersResult = await request.query(`
        SELECT 
          name as Server_Name,
          product as Product,
          provider as Provider,
          data_source as Data_Source
        FROM sys.servers 
        WHERE server_id > 0;
      `);

      // Probar consultas en las vistas existentes
      const pruebasVistas = [];
      const vistas = ['Vista_Vehiculos_Global', 'Vista_Empleados_Global', 'Vista_Repuestos_Global', 'Vista_Reparaciones_Global'];
      
      for (const vista of vistas) {
        try {
          const testRequest = centralPool.request();
          const testResult = await testRequest.query(`SELECT TOP 5 * FROM ${vista}`);
          pruebasVistas.push({
            vista: vista,
            status: 'OK',
            registros: testResult.recordset.length,
            muestra: testResult.recordset
          });
        } catch (error) {
          pruebasVistas.push({
            vista: vista,
            status: 'ERROR',
            error: error.message
          });
        }
      }

      return {
        success: true,
        vistas_encontradas: vistasResult.recordset,
        tablas_encontradas: tablasResult.recordset,
        linked_servers: linkedServersResult.recordset,
        pruebas_vistas: pruebasVistas,
        message: 'Diagnóstico de base central completado'
      };

    } catch (error) {
      return {
        success: false,
        message: 'Error en diagnóstico',
        error: error.message
      };
    }
  }

  // Función para verificar estructura de tablas en nodos
  async verificarEstructuraTablas() {
    const activePools = getAllActivePools();
    const estructuras = {};

    for (const [poolKey, pool] of Object.entries(activePools)) {
      const sede = poolKey.includes('Sur') ? 'Sur' : 'Norte';
      
      if (poolKey === 'central') continue; // Saltar la conexión central
      
      try {
        const estructura = await this.executeOnNode(async (pool) => {
          const request = pool.request();
          
          // Obtener estructura de todas las tablas
          const result = await request.query(`
            SELECT 
              t.name as tabla_nombre,
              c.name as columna_nombre,
              ty.name as tipo_datos,
              c.max_length,
              c.is_nullable
            FROM sys.tables t
            INNER JOIN sys.columns c ON t.object_id = c.object_id
            INNER JOIN sys.types ty ON c.user_type_id = ty.user_type_id
            WHERE t.name IN (
              'Cliente', 
              'Vehiculo_General_${sede}', 
              'Vehiculo_Matricula',
              'Empleado',
              'Repuesto_${sede}',
              'Reparacion_${sede}'
            )
            ORDER BY t.name, c.column_id;
          `);
          
          return result.recordset;
        }, sede);

        estructuras[sede] = estructura;
        
      } catch (error) {
        estructuras[sede] = { error: error.message };
      }
    }

    return estructuras;
  }

  // =====================================================
  // CLIENTES - REPLICACIÓN COMPLETA
  // =====================================================

  // REGISTRAR CLIENTE (Replicación en ambas sedes - Solo campos existentes)
  async registrarCliente(clienteData) {
    const { cedula, nombre, apellido, zona } = clienteData;
    
    // Primero validar que el cliente no exista ya
    const clienteExistente = await this.validarClienteExiste(cedula);
    if (clienteExistente) {
      throw new Error(`Cliente con cédula ${cedula} ya está registrado`);
    }

    // Registrar en todas las sedes activas (replicación completa)
    const activePools = getAllActivePools();
    const resultados = [];
    let errores = [];

    for (const [poolKey, pool] of Object.entries(activePools)) {
      const sede = poolKey.includes('Sur') ? 'Sur' : 'Norte';
      
      try {
        const resultado = await this.executeOnNode(async (pool) => {
          const request = pool.request();
          request.input('cedula', sql.VarChar, cedula);
          request.input('nombre', sql.VarChar, nombre);
          request.input('apellido', sql.VarChar, apellido);
          request.input('zona', sql.VarChar, zona);
          
          const result = await request.query(`
            INSERT INTO Cliente (cedula, nombre, apellido, zona) 
            VALUES (@cedula, @nombre, @apellido, @zona);
            
            SELECT cedula, nombre, apellido, zona 
            FROM Cliente WHERE cedula = @cedula;
          `);
          
          return result.recordset[0];
        }, sede);

        resultados.push({ sede, data: resultado });
        
      } catch (error) {
        errores.push({ sede, error: error.message });
        console.warn(`⚠️  Error registrando cliente en nodo ${sede}:`, error.message);
      }
    }

    if (resultados.length === 0) {
      throw new Error(`No se pudo registrar el cliente en ninguna sede: ${errores.map(e => e.error).join(', ')}`);
    }

    return {
      success: true,
      message: `Cliente registrado exitosamente en ${resultados.length} sede(s): ${resultados.map(r => r.sede).join(', ')}`,
      data: resultados[0].data,
      replicaciones: resultados,
      errores: errores.length > 0 ? errores : undefined
    };
  }

  // VALIDAR SI CLIENTE EXISTE (Buscar en cualquier sede)
  async validarClienteExiste(cedula) {
    const activePools = getAllActivePools();

    for (const [poolKey, pool] of Object.entries(activePools)) {
      const sede = poolKey.includes('Sur') ? 'Sur' : 'Norte';
      
      try {
        const resultado = await this.executeOnNode(async (pool) => {
          const request = pool.request();
          request.input('cedula', sql.VarChar, cedula);
          
          const result = await request.query(`
            SELECT cedula, nombre, apellido, zona 
            FROM Cliente WHERE cedula = @cedula;
          `);
          
          return result.recordset.length > 0 ? result.recordset[0] : null;
        }, sede);

        if (resultado) {
          return resultado; // Cliente encontrado en esta sede
        }
        
      } catch (error) {
        console.warn(`⚠️  Error validando cliente en nodo ${sede}:`, error.message);
      }
    }

    return null; // Cliente no encontrado en ninguna sede
  }

  // ACTUALIZAR CLIENTE (Replicación en ambas sedes - Solo campos existentes)
  async actualizarCliente(cedula, clienteData) {
    const { nombre, apellido, zona } = clienteData;
    
    const activePools = getAllActivePools();
    const resultados = [];
    let errores = [];

    for (const [poolKey, pool] of Object.entries(activePools)) {
      const sede = poolKey.includes('Sur') ? 'Sur' : 'Norte';
      
      try {
        const resultado = await this.executeOnNode(async (pool) => {
          const request = pool.request();
          request.input('cedula', sql.VarChar, cedula);
          request.input('nombre', sql.VarChar, nombre);
          request.input('apellido', sql.VarChar, apellido);
          request.input('zona', sql.VarChar, zona);
          
          const result = await request.query(`
            UPDATE Cliente 
            SET nombre = @nombre, 
                apellido = @apellido, 
                zona = @zona
            WHERE cedula = @cedula;
            
            SELECT cedula, nombre, apellido, zona 
            FROM Cliente WHERE cedula = @cedula;
          `);
          
          return result.recordset[0];
        }, sede);

        if (resultado) {
          resultados.push({ sede, data: resultado });
        }
        
      } catch (error) {
        errores.push({ sede, error: error.message });
        console.warn(`⚠️  Error actualizando cliente en nodo ${sede}:`, error.message);
      }
    }

    if (resultados.length === 0) {
      throw new Error(`Cliente con cédula ${cedula} no encontrado en ninguna sede`);
    }

    return {
      success: true,
      message: `Cliente actualizado exitosamente en ${resultados.length} sede(s)`,
      data: resultados[0].data,
      replicaciones: resultados,
      errores: errores.length > 0 ? errores : undefined
    };
  }

  // ELIMINAR CLIENTE (Con validación de integridad referencial)
  async eliminarCliente(cedula) {
    // Primero validar que no tenga vehículos registrados
    const vehiculosCliente = await this.validarClienteTieneVehiculos(cedula);
    if (vehiculosCliente && vehiculosCliente.length > 0) {
      throw new Error(`No se puede eliminar el cliente. Tiene ${vehiculosCliente.length} vehículo(s) registrado(s)`);
    }

    const activePools = getAllActivePools();
    const resultados = [];
    let errores = [];

    for (const [poolKey, pool] of Object.entries(activePools)) {
      const sede = poolKey.includes('Sur') ? 'Sur' : 'Norte';
      
      try {
        const resultado = await this.executeOnNode(async (pool) => {
          const request = pool.request();
          request.input('cedula', sql.VarChar, cedula);
          
          // Primero obtener los datos antes de eliminar
          const selectResult = await request.query(`
            SELECT cedula, nombre, apellido, zona 
            FROM Cliente WHERE cedula = @cedula;
          `);
          
          if (selectResult.recordset.length > 0) {
            await request.query(`DELETE FROM Cliente WHERE cedula = @cedula;`);
            return selectResult.recordset[0];
          }
          
          return null;
        }, sede);

        if (resultado) {
          resultados.push({ sede, data: resultado });
        }
        
      } catch (error) {
        errores.push({ sede, error: error.message });
        console.warn(`⚠️  Error eliminando cliente en nodo ${sede}:`, error.message);
      }
    }

    if (resultados.length === 0) {
      throw new Error(`Cliente con cédula ${cedula} no encontrado en ninguna sede`);
    }

    return {
      success: true,
      message: `Cliente eliminado exitosamente de ${resultados.length} sede(s)`,
      data: resultados[0].data,
      replicaciones: resultados,
      errores: errores.length > 0 ? errores : undefined
    };
  }

  // VALIDAR SI CLIENTE TIENE VEHÍCULOS
  async validarClienteTieneVehiculos(cedula) {
    const activePools = getAllActivePools();
    const vehiculosEncontrados = [];

    for (const [poolKey, pool] of Object.entries(activePools)) {
      const sede = poolKey.includes('Sur') ? 'Sur' : 'Norte';
      
      try {
        const vehiculos = await this.executeOnNode(async (pool) => {
          const request = pool.request();
          request.input('cedula', sql.VarChar, cedula);
          
          const result = await request.query(`
            SELECT matricula, marca, modelo 
            FROM Vehiculo_General_${sede} 
            WHERE cedula_cliente = @cedula;
          `);
          
          return result.recordset;
        }, sede);

        if (vehiculos && vehiculos.length > 0) {
          vehiculosEncontrados.push(...vehiculos);
        }
        
      } catch (error) {
        console.warn(`⚠️  Error validando vehículos del cliente en nodo ${sede}:`, error.message);
      }
    }

    return vehiculosEncontrados;
  }

  // VEHÍCULOS (Sin validación de cliente para facilitar pruebas)
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
        
        SELECT v.*, c.nombre as nombre_cliente, c.apellido as apellido_cliente
        FROM ${tablaVehiculo} v
        LEFT JOIN Cliente c ON v.cedula_cliente = c.cedula
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

  // REPARACIONES (Con validación de vehículo y matrícula)
  async registrarReparacion(reparacionData) {
    const { idReparacion, fecha, tipo, observaciones, anio, precio, matricula, idTaller } = reparacionData;
    
    // VALIDACIÓN: Verificar que el vehículo existe en esta sede
    const vehiculoExiste = await this.validarVehiculoExisteEnSede(matricula);
    if (!vehiculoExiste) {
      throw new Error(`Vehículo con matrícula ${matricula} no está registrado en nodo ${this.currentSede}. Verifique la matrícula o cambie de sede.`);
    }
    
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
        
        SELECT r.*, v.marca, v.modelo, c.nombre as nombre_cliente, c.apellido as apellido_cliente
        FROM ${tableName} r
        LEFT JOIN Vehiculo_General_${this.currentSede} v ON r.matricula = v.matricula
        LEFT JOIN Cliente c ON v.cedula_cliente = c.cedula
        WHERE r.id_reparacion = @idReparacion;
      `);
      
      return {
        success: true,
        message: `Reparación registrada exitosamente en nodo ${this.currentSede} para vehículo ${vehiculoExiste.marca} ${vehiculoExiste.modelo}`,
        data: resultReparacion.recordset[0]
      };
    });
  }

  // VALIDAR SI VEHÍCULO EXISTE EN LA SEDE ACTUAL
  async validarVehiculoExisteEnSede(matricula, sede = null) {
    const targetSede = sede || this.currentSede;
    
    try {
      return await this.executeOnNode(async (pool) => {
        const request = pool.request();
        request.input('matricula', sql.VarChar, matricula);
        
        const tablaVehiculo = `Vehiculo_General_${targetSede}`;
        const result = await request.query(`
          SELECT v.*, c.nombre as nombre_cliente, c.apellido as apellido_cliente
          FROM ${tablaVehiculo} v
          LEFT JOIN Cliente c ON v.cedula_cliente = c.cedula
          WHERE v.matricula = @matricula;
        `);
        
        return result.recordset.length > 0 ? result.recordset[0] : null;
      }, targetSede);
    } catch (error) {
      console.warn(`⚠️  Error validando vehículo en nodo ${targetSede}:`, error.message);
      return null;
    }
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

  // =====================================================
  // DEMOSTRACIÓN DE FRAGMENTACIÓN VERTICAL
  // =====================================================

  // Mostrar la fragmentación vertical de vehículos
  async demostrarFragmentacionVertical() {
    const resultado = {
      concepto: "FRAGMENTACIÓN VERTICAL - Tabla Vehículo",
      descripcion: "Los datos del vehículo se dividen verticalmente entre diferentes tablas y sedes",
      fragmentos: {}
    };

    const activePools = getAllActivePools();

    // 1. Consultar tabla replicada Vehiculo_Matricula
    for (const [poolKey, pool] of Object.entries(activePools)) {
      const sede = poolKey.includes('Sur') ? 'Sur' : 'Norte';
      
      try {
        const datos = await this.executeOnNode(async (pool) => {
          const request = pool.request();
          
          // Fragmento 1: Solo matrículas (replicado)
          const matriculasResult = await request.query(`
            SELECT matricula 
            FROM Vehiculo_Matricula 
            ORDER BY matricula
          `);
          
          // Fragmento 2: Datos completos por sede
          const vehiculosResult = await request.query(`
            SELECT 
              matricula,
              cedula_cliente,
              marca,
              modelo,
              fecha_compra,
              anio
            FROM Vehiculo_General_${sede}
            ORDER BY matricula
          `);
          
          return {
            matriculas_replicadas: matriculasResult.recordset,
            vehiculos_completos: vehiculosResult.recordset
          };
        }, sede);

        resultado.fragmentos[`Sede_${sede}`] = {
          tipo: "Fragmentación Vertical",
          descripcion: `Datos distribuidos verticalmente en Sede ${sede}`,
          tabla_replicada: {
            nombre: "Vehiculo_Matricula",
            proposito: "Solo matrículas (replicado para referencias rápidas)",
            registros: datos.matriculas_replicadas.length,
            datos: datos.matriculas_replicadas
          },
          tabla_fragmentada: {
            nombre: `Vehiculo_General_${sede}`,
            proposito: `Datos completos del vehículo en Sede ${sede}`,
            registros: datos.vehiculos_completos.length,
            datos: datos.vehiculos_completos
          }
        };

      } catch (error) {
        resultado.fragmentos[`Sede_${sede}`] = {
          error: error.message
        };
      }
    }

    return resultado;
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

  // Obtener todos los vehículos de ambas sedes (USANDO VISTAS PARTICIONADAS)
  async obtenerVehiculosGlobales() {
    try {
      // Intentar usar vistas particionadas primero
      return await this.executeGlobalQuery(async (pool) => {
        const request = pool.request();
        // Primero verificar qué columnas están disponibles
        const columnasResult = await request.query(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'Vista_Vehiculos_Global'
        `);
        
        console.log('🔍 Columnas disponibles en Vista_Vehiculos_Global:', 
          columnasResult.recordset.map(c => c.COLUMN_NAME));
        
        const result = await request.query(`
          SELECT 
            matricula as Matricula,
            cedula_cliente as CI_Cliente,
            marca as Marca,
            modelo as Modelo,
            fecha_compra as Fecha_Registro,
            anio,
            Origen_Nodo,
            Origen_Nodo as Sede
          FROM Vista_Vehiculos_Global
          ORDER BY fecha_compra DESC;
        `);
        return result.recordset;
      });
    } catch (error) {
      console.warn('⚠️  Error con vistas particionadas, usando modo distribuido:', error.message);
      
      // Fallback: usar consultas distribuidas
      const vehiculosGlobales = [];
      const activePools = getAllActivePools();

      for (const [poolKey, pool] of Object.entries(activePools)) {
        const sede = poolKey.includes('Sur') ? 'Sur' : 'Norte';
        
        if (poolKey === 'central') continue; // Saltar la conexión central
        
        try {
          const vehiculos = await this.executeOnNode(async (pool) => {
            const request = pool.request();
            
            // Primero verificar qué columnas están disponibles
            const columnasResult = await request.query(`
              SELECT COLUMN_NAME 
              FROM INFORMATION_SCHEMA.COLUMNS 
              WHERE TABLE_NAME = 'Vehiculo_General_${sede}'
            `);
            
            console.log(`🔍 Columnas disponibles en Vehiculo_General_${sede}:`, 
              columnasResult.recordset.map(c => c.COLUMN_NAME));
            
            const result = await request.query(`
              SELECT 
                vg.matricula as Matricula,
                vg.cedula_cliente as CI_Cliente,
                vg.marca as Marca,
                vg.modelo as Modelo,
                vg.fecha_compra as Fecha_Registro,
                vg.anio,
                '${sede}' as Origen_Nodo,
                '${sede}' as Sede,
                c.nombre as nombre_cliente,
                c.apellido as apellido_cliente
              FROM Vehiculo_General_${sede} vg
              LEFT JOIN Cliente c ON vg.cedula_cliente = c.cedula
              ORDER BY vg.fecha_compra DESC;
            `);
            
            return result.recordset;
          }, sede);

          vehiculosGlobales.push(...vehiculos);
          
        } catch (error) {
          console.warn(`⚠️  Error obteniendo vehículos de nodo ${sede}:`, error.message);
        }
      }

      return vehiculosGlobales;
    }
  }

  // Obtener estadísticas generales de ambas sedes (RESPALDO sin vistas particionadas)
  async obtenerEstadisticasGlobalesRespaldo() {
    const estadisticas = [];
    const activePools = getAllActivePools();

    for (const [poolKey, pool] of Object.entries(activePools)) {
      const sede = poolKey.includes('Sur') ? 'Sur' : 'Norte';
      
      if (poolKey === 'central') continue; // Saltar la conexión central
      
      try {
        const resultado = await this.executeOnNode(async (pool) => {
          const request = pool.request();
          
          // Obtener estadísticas básicas de cada sede
          const vehiculosResult = await request.query(`
            SELECT COUNT(*) as total FROM Vehiculo_General_${sede}
          `);
          
          const empleadosResult = await request.query(`
            SELECT COUNT(*) as total FROM Empleado
          `);
          
          const repuestosResult = await request.query(`
            SELECT COUNT(*) as total FROM Repuesto_${sede}
          `);
          
          const reparacionesResult = await request.query(`
            SELECT 
              COUNT(*) as total_reparaciones,
              AVG(precio) as precio_promedio,
              SUM(precio) as ingresos_totales
            FROM Reparacion_${sede}
          `);
          
          return {
            Sede: sede,
            Total_Vehiculos: vehiculosResult.recordset[0].total,
            Total_Empleados: empleadosResult.recordset[0].total,
            Total_Repuestos: repuestosResult.recordset[0].total,
            Total_Reparaciones: reparacionesResult.recordset[0].total_reparaciones,
            Reparaciones_Activas: 0, // No tenemos esta información en el esquema actual
            Reparaciones_Completadas: reparacionesResult.recordset[0].total_reparaciones,
            Costo_Promedio_Reparacion: reparacionesResult.recordset[0].precio_promedio || 0,
            Ingresos_Totales: reparacionesResult.recordset[0].ingresos_totales || 0
          };
        }, sede);

        estadisticas.push(resultado);
        
      } catch (error) {
        console.warn(`⚠️  Error obteniendo estadísticas de nodo ${sede}:`, error.message);
        estadisticas.push({
          Sede: sede,
          error: error.message,
          Total_Vehiculos: 0,
          Total_Empleados: 0,
          Total_Repuestos: 0,
          Total_Reparaciones: 0,
          Reparaciones_Activas: 0,
          Reparaciones_Completadas: 0,
          Costo_Promedio_Reparacion: 0,
          Ingresos_Totales: 0
        });
      }
    }

    return {
      success: true,
      data: estadisticas,
      message: `Estadísticas obtenidas de ${estadisticas.length} sede(s) - modo respaldo`,
      modo_respaldo: true
    };
  }

  // Obtener estadísticas generales de ambas sedes (CON VISTAS PARTICIONADAS Y FALLBACK)
  async obtenerEstadisticasGlobales() {
    try {
      // Intentar usar vistas particionadas primero
      return await this.executeGlobalQuery(async (pool) => {
        const request = pool.request();
        
        // Obtener estadísticas usando las vistas existentes
        const vehiculosResult = await request.query(`
          SELECT 
            Origen_Nodo as sede,
            COUNT(*) as total_vehiculos
          FROM Vista_Vehiculos_Global
          GROUP BY Origen_Nodo
        `);
        
        const empleadosResult = await request.query(`
          SELECT 
            Origen_Nodo as sede,
            COUNT(*) as total_empleados
          FROM Vista_Empleados_Global
          GROUP BY Origen_Nodo
        `);
        
        const repuestosResult = await request.query(`
          SELECT 
            Origen_Nodo as sede,
            COUNT(*) as total_repuestos
          FROM Vista_Repuestos_Global
          GROUP BY Origen_Nodo
        `);
        
        const reparacionesResult = await request.query(`
          SELECT 
            Origen_Nodo as sede,
            COUNT(*) as total_reparaciones,
            AVG(precio) as precio_promedio_reparacion,
            SUM(precio) as ingresos_totales
          FROM Vista_Reparaciones_Global
          GROUP BY Origen_Nodo
        `);
        
        // Combinar resultados
        const estadisticas = [];
        const sedes = ['Norte', 'Sur'];
        
        for (const sede of sedes) {
          const vehiculos = vehiculosResult.recordset.find(v => v.sede === sede)?.total_vehiculos || 0;
          const empleados = empleadosResult.recordset.find(e => e.sede === sede)?.total_empleados || 0;
          const repuestos = repuestosResult.recordset.find(r => r.sede === sede)?.total_repuestos || 0;
          const reparacionesData = reparacionesResult.recordset.find(r => r.sede === sede);
          
          estadisticas.push({
            Sede: sede,
            Total_Vehiculos: vehiculos,
            Total_Empleados: empleados,
            Total_Repuestos: repuestos,
            Total_Reparaciones: reparacionesData?.total_reparaciones || 0,
            Reparaciones_Activas: 0, // No tenemos esta información en las vistas actuales
            Reparaciones_Completadas: reparacionesData?.total_reparaciones || 0,
            Costo_Promedio_Reparacion: reparacionesData?.precio_promedio_reparacion || 0,
            Ingresos_Totales: reparacionesData?.ingresos_totales || 0
          });
        }
        
        return {
          success: true,
          data: estadisticas,
          message: 'Estadísticas obtenidas desde vistas particionadas',
          modo_vista_particionada: true
        };
      });
    } catch (error) {
      console.warn('⚠️  Error con vistas particionadas, usando modo respaldo:', error.message);
      // Si falla, usar el método de respaldo
      return await this.obtenerEstadisticasGlobalesRespaldo();
    }
  }

  // Búsqueda global de reparaciones por criterios (USANDO VISTAS PARTICIONADAS)
  async buscarReparacionesGlobales(criterio = {}) {
    try {
      // Intentar usar vistas particionadas primero
      return await this.executeGlobalQuery(async (pool) => {
        const request = pool.request();
        
        // Primero verificar qué columnas están disponibles
        const columnasResult = await request.query(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'Vista_Reparaciones_Global'
        `);
        
        console.log('🔍 Columnas disponibles en Vista_Reparaciones_Global:', 
          columnasResult.recordset.map(c => c.COLUMN_NAME));
        
        let whereClause = '1=1';
        
        if (criterio.sede) {
          request.input('sede', sql.VarChar, criterio.sede);
          whereClause += ' AND Origen_Nodo = @sede';
        }
        
        if (criterio.fechaDesde) {
          request.input('fechaDesde', sql.DateTime, criterio.fechaDesde);
          whereClause += ' AND fecha >= @fechaDesde';
        }

        const result = await request.query(`
          SELECT 
            id_reparacion as Reparacion_ID,
            matricula as Vehiculo_ID,
            id_taller as Empleado_ID,
            tipo as Descripcion,
            'Completada' as Estado,
            precio as Costo_Total,
            fecha as Fecha_Inicio,
            Origen_Nodo,
            Origen_Nodo as Sede
          FROM Vista_Reparaciones_Global
          WHERE ${whereClause}
          ORDER BY fecha DESC;
        `);
        
        return result.recordset;
      });
    } catch (error) {
      console.warn('⚠️  Error con vistas particionadas, usando modo distribuido:', error.message);
      
      // Fallback: usar consultas distribuidas
      const reparacionesGlobales = [];
      const activePools = getAllActivePools();

      for (const [poolKey, pool] of Object.entries(activePools)) {
        const sede = poolKey.includes('Sur') ? 'Sur' : 'Norte';
        
        if (poolKey === 'central') continue; // Saltar la conexión central
        
        // Si se especifica sede y no coincide, saltar
        if (criterio.sede && criterio.sede !== sede) continue;
        
        try {
          const reparaciones = await this.executeOnNode(async (pool) => {
            const request = pool.request();
            
            let whereClause = '1=1';
            
            if (criterio.fechaDesde) {
              request.input('fechaDesde', sql.DateTime, criterio.fechaDesde);
              whereClause += ' AND r.fecha >= @fechaDesde';
            }

            const result = await request.query(`
              SELECT 
                r.id_reparacion as Reparacion_ID,
                r.matricula as Vehiculo_ID,
                r.id_taller as Empleado_ID,
                r.tipo as Descripcion,
                'Completada' as Estado,
                r.precio as Costo_Total,
                r.fecha as Fecha_Inicio,
                '${sede}' as Origen_Nodo,
                '${sede}' as Sede,
                vg.marca,
                vg.modelo,
                c.nombre as nombre_cliente
              FROM Reparacion_${sede} r
              LEFT JOIN Vehiculo_General_${sede} vg ON r.matricula = vg.matricula
              LEFT JOIN Cliente c ON vg.cedula_cliente = c.cedula
              WHERE ${whereClause}
              ORDER BY r.fecha DESC;
            `);
            
            return result.recordset;
          }, sede);

          reparacionesGlobales.push(...reparaciones);
          
        } catch (error) {
          console.warn(`⚠️  Error obteniendo reparaciones de nodo ${sede}:`, error.message);
        }
      }

      return reparacionesGlobales;
    }
  }

  // Reporte consolidado de todas las sedes (USANDO VISTAS PARTICIONADAS)
  async generarReporteConsolidado() {
    try {
      // Intentar usar vistas particionadas primero
      return await this.executeGlobalQuery(async (pool) => {
        const request = pool.request();
        
        // Obtener totales generales
        const totalesResult = await request.query(`
          SELECT 
            'RESUMEN GENERAL' as Tipo,
            (SELECT COUNT(*) FROM Vista_Vehiculos_Global) as Total_Vehiculos,
            (SELECT COUNT(*) FROM Vista_Empleados_Global) as Total_Empleados,
            (SELECT COUNT(*) FROM Vista_Repuestos_Global) as Total_Repuestos,
            (SELECT COUNT(*) FROM Vista_Reparaciones_Global) as Total_Reparaciones,
            (SELECT SUM(precio) FROM Vista_Reparaciones_Global) as Ingresos_Totales
        `);
        
        // Obtener estadísticas por sede
        const porSedeResult = await request.query(`
          SELECT 
            'SEDE ' + Origen_Nodo as Tipo,
            (SELECT COUNT(*) FROM Vista_Vehiculos_Global v WHERE v.Origen_Nodo = vg.Origen_Nodo) as Total_Vehiculos,
            (SELECT COUNT(*) FROM Vista_Empleados_Global e WHERE e.Origen_Nodo = vg.Origen_Nodo) as Total_Empleados,
            (SELECT COUNT(*) FROM Vista_Repuestos_Global r WHERE r.Origen_Nodo = vg.Origen_Nodo) as Total_Repuestos,
            (SELECT COUNT(*) FROM Vista_Reparaciones_Global rp WHERE rp.Origen_Nodo = vg.Origen_Nodo) as Total_Reparaciones,
            (SELECT SUM(precio) FROM Vista_Reparaciones_Global rp WHERE rp.Origen_Nodo = vg.Origen_Nodo) as Ingresos_Totales
          FROM (SELECT DISTINCT Origen_Nodo FROM Vista_Vehiculos_Global) vg
        `);
        
        // Combinar resultados
        const reporte = [...totalesResult.recordset, ...porSedeResult.recordset];
        
        return reporte;
      });
    } catch (error) {
      console.warn('⚠️  Error con vistas particionadas, usando modo distribuido:', error.message);
      
      // Fallback: usar consultas distribuidas
      const reporteConsolidado = [];
      const activePools = getAllActivePools();
      
      let totalVehiculos = 0;
      let totalEmpleados = 0;
      let totalRepuestos = 0;
      let totalReparaciones = 0;
      let ingresosTotales = 0;

      for (const [poolKey, pool] of Object.entries(activePools)) {
        const sede = poolKey.includes('Sur') ? 'Sur' : 'Norte';
        
        if (poolKey === 'central') continue; // Saltar la conexión central
        
        try {
          const estadisticasSede = await this.executeOnNode(async (pool) => {
            const request = pool.request();
            
            // Obtener conteos por sede
            const vehiculosResult = await request.query(`
              SELECT COUNT(*) as total FROM Vehiculo_General_${sede}
            `);
            
            const empleadosResult = await request.query(`
              SELECT COUNT(*) as total FROM Empleado
            `);
            
            const repuestosResult = await request.query(`
              SELECT COUNT(*) as total FROM Repuesto_${sede}
            `);
            
            const reparacionesResult = await request.query(`
              SELECT 
                COUNT(*) as total_reparaciones,
                SUM(precio) as ingresos_totales
              FROM Reparacion_${sede}
            `);
            
            const vehiculos = vehiculosResult.recordset[0].total;
            const empleados = empleadosResult.recordset[0].total;
            const repuestos = repuestosResult.recordset[0].total;
            const reparaciones = reparacionesResult.recordset[0].total_reparaciones;
            const ingresos = reparacionesResult.recordset[0].ingresos_totales || 0;
            
            return {
              Tipo: `SEDE ${sede}`,
              Total_Vehiculos: vehiculos,
              Total_Empleados: empleados,
              Total_Repuestos: repuestos,
              Total_Reparaciones: reparaciones,
              Ingresos_Totales: ingresos
            };
          }, sede);

          reporteConsolidado.push(estadisticasSede);
          
          // Acumular totales
          totalVehiculos += estadisticasSede.Total_Vehiculos;
          totalEmpleados += estadisticasSede.Total_Empleados;
          totalRepuestos += estadisticasSede.Total_Repuestos;
          totalReparaciones += estadisticasSede.Total_Reparaciones;
          ingresosTotales += estadisticasSede.Ingresos_Totales;
          
        } catch (error) {
          console.warn(`⚠️  Error obteniendo reporte de nodo ${sede}:`, error.message);
          reporteConsolidado.push({
            Tipo: `SEDE ${sede}`,
            Total_Vehiculos: 0,
            Total_Empleados: 0,
            Total_Repuestos: 0,
            Total_Reparaciones: 0,
            Ingresos_Totales: 0,
            Error: error.message
          });
        }
      }

      // Agregar resumen general al inicio
      reporteConsolidado.unshift({
        Tipo: 'RESUMEN GENERAL',
        Total_Vehiculos: totalVehiculos,
        Total_Empleados: totalEmpleados,
        Total_Repuestos: totalRepuestos,
        Total_Reparaciones: totalReparaciones,
        Ingresos_Totales: ingresosTotales
      });

      return reporteConsolidado;
    }
  }

  // =====================================================
  // OPERACIONES UPDATE (EDITAR)
  // =====================================================

  // ACTUALIZAR VEHÍCULO (Fragmentación Vertical - Sin validación de cliente)
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
        
        SELECT v.*, c.nombre as nombre_cliente, c.apellido as apellido_cliente
        FROM ${tablaVehiculo} v
        LEFT JOIN Cliente c ON v.cedula_cliente = c.cedula
        WHERE v.matricula = @matricula;
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

  // ELIMINAR VEHÍCULO (Fragmentación Vertical + validación de integridad)
  async eliminarVehiculo(matricula) {
    return await this.executeOnNode(async (pool) => {
      const request = pool.request();
      request.input('matricula', sql.VarChar, matricula);
      
      // Primero verificar si tiene reparaciones asociadas
      const tableName = `Reparacion_${this.currentSede}`;
      const reparacionesResult = await request.query(`
        SELECT COUNT(*) as total_reparaciones 
        FROM ${tableName} 
        WHERE matricula = @matricula;
      `);
      
      if (reparacionesResult.recordset[0].total_reparaciones > 0) {
        throw new Error(`No se puede eliminar el vehículo. Tiene ${reparacionesResult.recordset[0].total_reparaciones} reparación(es) registrada(s)`);
      }
      
      // Obtener los datos antes de eliminar (incluyendo información del cliente)
      const tablaVehiculo = `Vehiculo_General_${this.currentSede}`;
      const selectResult = await request.query(`
        SELECT v.*, c.nombre as nombre_cliente, c.apellido as apellido_cliente
        FROM ${tablaVehiculo} v
        LEFT JOIN Cliente c ON v.cedula_cliente = c.cedula
        WHERE v.matricula = @matricula;
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
        console.warn(`⚠️  No se pudo eliminar de Vehiculo_Matricula (puede estar en uso en otra sede): ${error.message}`);
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

  // LISTAR TODOS LOS CLIENTES (Optimizado para replicación completa - Solo campos existentes)
  async listarClientes() {
    try {
      console.log(`🔍 Listando clientes (datos replicados en ambas sedes)`);
      
      // Como los clientes están replicados, podemos consultar cualquier sede disponible
      const activePools = getAllActivePools();
      let ultimoError = null;
      
      for (const [poolKey, pool] of Object.entries(activePools)) {
        const sede = poolKey.includes('Sur') ? 'Sur' : 'Norte';
        
        try {
          console.log(`🗃️  Intentando obtener clientes desde sede ${sede}`);
          
          const resultado = await this.executeOnNode(async (pool) => {
            const request = pool.request();
            
            console.log(`📊 Ejecutando consulta de clientes replicados en ${sede}`);
            const result = await request.query(`
              SELECT 
                cedula,
                nombre,
                apellido,
                zona
              FROM Cliente
              ORDER BY apellido, nombre
            `);
            
            console.log(`✅ Clientes encontrados en ${sede}: ${result.recordset.length}`);
            
            // Agregar campos adicionales para estadísticas
            const clientesConEstadisticas = result.recordset.map(cliente => ({
              ...cliente,
              total_vehiculos: 0,
              total_reparaciones: 0,
              total_gastado: 0
            }));
            
            return {
              success: true,
              data: clientesConEstadisticas,
              message: `${clientesConEstadisticas.length} clientes encontrados (datos replicados desde nodo ${sede})`,
              origen_sede: sede
            };
          }, sede);
          
          // Si llegamos aquí, la consulta fue exitosa
          console.log(`🎯 Clientes obtenidos exitosamente desde sede ${sede}`);
          return resultado;
          
        } catch (error) {
          ultimoError = error;
          console.warn(`⚠️  Error obteniendo clientes desde nodo ${sede}:`, error.message);
          continue; // Intentar con la siguiente sede
        }
      }
      
      // Si llegamos aquí, ninguna sede funcionó
      throw new Error(`No se pudo obtener clientes desde ninguna sede: ${ultimoError?.message || 'Conexiones no disponibles'}`);
      
    } catch (error) {
      console.error(`❌ Error completo en listarClientes:`, error);
      
      // RESPALDO: Si falla todo, devolver lista vacía pero funcional
      console.warn('🔄 Usando respaldo - devolviendo lista vacía');
      return {
        success: true,
        data: [],
        message: `Sin clientes disponibles (modo respaldo)`,
        warning: `Error de conexión: ${error.message}`,
        modo_respaldo: true
      };
    }
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