// routes/apiRoutes.js
const express = require('express');
const router = express.Router();
const dataService = require('../services/dataService');
const { checkConnectionHealth } = require('../config/database');

// Middleware para logging de requests
router.use((req, res, next) => {
  console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// --- RUTA DE LOGIN Y SELECCIÓN DE SEDE ---
router.post('/login', async (req, res) => {
  try {
    const { sede } = req.body;
    
    if (!sede || (sede !== 'Sur' && sede !== 'Norte')) {
      return res.status(400).json({
        success: false,
        message: 'Sede inválida. Por favor, selecciona Sur o Norte.'
      });
    }

    // Establecer la sede en el servicio de datos
    dataService.setSede(sede);
    
    // Verificar que la sede tenga conexión disponible
    const healthStatus = await checkConnectionHealth();
    const nodoKey = sede === 'Sur' ? 'nodoSur' : 'nodoNorte';
    
    if (healthStatus[nodoKey] === 'healthy') {
      res.json({
        success: true,
        message: `🏢 Bienvenido a POLI-CAR Nodo ${sede}. Sistema conectado y listo.`,
        sede: sede,
        conexion: 'activa'
      });
    } else {
      res.status(503).json({
        success: false,
        message: `❌ Nodo ${sede} temporalmente no disponible. Intenta más tarde.`,
        sede: sede,
        conexion: 'desconectada'
      });
    }
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor durante el login.'
    });
  }
});

// --- RUTAS DE VEHÍCULOS ---
router.post('/vehiculos', async (req, res) => {
  try {
    const { ciCliente, matricula, marca, modelo } = req.body;
    
    // Validaciones básicas
    if (!ciCliente || !matricula || !marca || !modelo) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son obligatorios: CI Cliente, Matrícula, Marca y Modelo.'
      });
    }

    const resultado = await dataService.registrarVehiculo({
      ciCliente, matricula, marca, modelo
    });

    res.status(201).json(resultado);

  } catch (error) {
    console.error('Error registrando vehículo:', error);
    
    if (error.message.includes('no disponible')) {
      res.status(503).json({
        success: false,
        message: 'Nodo de base de datos temporalmente no disponible. Intenta más tarde.'
      });
    } else if (error.message.includes('duplicate') || error.message.includes('violation')) {
      res.status(409).json({
        success: false,
        message: 'La matrícula ya existe en el sistema. Por favor verifica los datos.'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor al registrar vehículo.'
      });
    }
  }
});

// --- RUTAS DE EMPLEADOS ---
router.post('/empleados', async (req, res) => {
  try {
    const { id, nombre, cedula, fechaContratacion, salario } = req.body;
    
    if (!id || !nombre || !cedula || !fechaContratacion || !salario) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son obligatorios.'
      });
    }

    if (isNaN(salario) || salario <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El salario debe ser un número positivo.'
      });
    }

    const resultado = await dataService.registrarEmpleado({
      id, nombre, cedula, fechaContratacion, salario: parseFloat(salario)
    });

    res.status(201).json(resultado);

  } catch (error) {
    console.error('Error registrando empleado:', error);
    
    if (error.message.includes('no disponible')) {
      res.status(503).json({
        success: false,
        message: 'Nodo de base de datos temporalmente no disponible.'
      });
    } else if (error.message.includes('duplicate') || error.message.includes('violation')) {
      res.status(409).json({
        success: false,
        message: 'El ID de empleado o cédula ya existe en el sistema.'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor al registrar empleado.'
      });
    }
  }
});

// --- RUTAS DE REPUESTOS ---
router.post('/repuestos', async (req, res) => {
  try {
    const { idRepuesto, descripcionRepuesto, cantidadRepuesto } = req.body;
    
    if (!idRepuesto || !descripcionRepuesto || cantidadRepuesto === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son obligatorios: ID, Descripción y Cantidad.'
      });
    }

    if (isNaN(cantidadRepuesto) || cantidadRepuesto < 0) {
      return res.status(400).json({
        success: false,
        message: 'La cantidad debe ser un número no negativo.'
      });
    }

    const resultado = await dataService.registrarRepuesto({
      idRepuesto, descripcionRepuesto, cantidadRepuesto: parseInt(cantidadRepuesto)
    });

    res.status(201).json(resultado);

  } catch (error) {
    console.error('Error registrando repuesto:', error);
    
    if (error.message.includes('no disponible')) {
      res.status(503).json({
        success: false,
        message: 'Nodo de base de datos temporalmente no disponible.'
      });
    } else if (error.message.includes('duplicate') || error.message.includes('violation')) {
      res.status(409).json({
        success: false,
        message: 'El ID de repuesto ya existe en el sistema.'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor al registrar repuesto.'
      });
    }
  }
});

// --- RUTAS DE REPARACIONES ---
router.post('/reparaciones', async (req, res) => {
  try {
    const { id, matricula, fechaReparacion, idRepuesto, observacion, precio } = req.body;
    
    if (!id || !matricula || !fechaReparacion || !idRepuesto || !precio) {
      return res.status(400).json({
        success: false,
        message: 'Los campos ID, Matrícula, Fecha, ID Repuesto y Precio son obligatorios.'
      });
    }

    if (isNaN(precio) || precio <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El precio debe ser un número positivo.'
      });
    }

    const resultado = await dataService.registrarReparacion({
      id, matricula, fechaReparacion, idRepuesto, 
      observacion: observacion || '', precio: parseFloat(precio)
    });

    res.status(201).json(resultado);

  } catch (error) {
    console.error('Error registrando reparación:', error);
    
    if (error.message.includes('no disponible')) {
      res.status(503).json({
        success: false,
        message: 'Nodo de base de datos temporalmente no disponible.'
      });
    } else if (error.message.includes('duplicate') || error.message.includes('violation')) {
      res.status(409).json({
        success: false,
        message: 'El ID de reparación ya existe en el sistema.'
      });
    } else if (error.message.includes('FOREIGN KEY')) {
      res.status(400).json({
        success: false,
        message: 'La matrícula del vehículo o ID del repuesto no existen en el sistema.'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor al registrar reparación.'
      });
    }
  }
});

// --- RUTAS DE CONSULTAS ---
router.get('/consultar-reparacion', async (req, res) => {
  try {
    const { ci, matricula } = req.query;
    
    if (!ci && !matricula) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar al menos CI del cliente o matrícula del vehículo.'
      });
    }

    const resultado = await dataService.consultarReparaciones({ ci, matricula });
    
    if (resultado.data && resultado.data.length > 0) {
      res.json(resultado);
    } else {
      res.json({
        success: true,
        data: [],
        message: 'No se encontraron reparaciones con los criterios especificados.',
        nodosConsultados: resultado.nodosConsultados || []
      });
    }

  } catch (error) {
    console.error('Error consultando reparaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al consultar reparaciones.'
    });
  }
});

// --- RUTAS DE ADMINISTRACIÓN ---
router.get('/health', async (req, res) => {
  try {
    const healthStatus = await checkConnectionHealth();
    const estadisticas = await dataService.obtenerEstadisticas();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      conexiones: healthStatus,
      estadisticas: estadisticas,
      sedeActual: dataService.currentSede,
      arquitectura: '2 nodos distribuidos'
    });
  } catch (error) {
    console.error('Error en health check:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar el estado del sistema.'
    });
  }
});

router.get('/estadisticas', async (req, res) => {
  try {
    const estadisticas = await dataService.obtenerEstadisticas();
    res.json({
      success: true,
      data: estadisticas,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas del sistema.'
    });
  }
});

// Ruta para cambiar de sede dinámicamente
router.post('/cambiar-sede', (req, res) => {
  try {
    const { sede } = req.body;
    
    if (!sede || (sede !== 'Sur' && sede !== 'Norte')) {
      return res.status(400).json({
        success: false,
        message: 'Sede inválida. Debe ser Sur o Norte.'
      });
    }

    const sedeAnterior = dataService.currentSede;
    dataService.setSede(sede);
    
    res.json({
      success: true,
      message: `Sede cambiada exitosamente de ${sedeAnterior} a ${sede}`,
      sedeAnterior: sedeAnterior,
      sedeActual: sede
    });
  } catch (error) {
    console.error('Error cambiando sede:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar de sede.'
    });
  }
});

// =====================================================
// RUTAS PARA CONSULTAS GLOBALES (BASE CENTRAL)
// =====================================================

// Obtener todos los vehículos de ambas sedes
router.get('/vehiculos/global', async (req, res) => {
  try {
    const vehiculos = await dataService.obtenerVehiculosGlobales();
    res.json({
      success: true,
      data: vehiculos,
      total: vehiculos.length,
      message: 'Vehículos globales obtenidos exitosamente'
    });
  } catch (error) {
    console.error('Error obteniendo vehículos globales:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener vehículos de ambas sedes',
      error: error.message
    });
  }
});

// Obtener estadísticas de ambas sedes
router.get('/estadisticas/global', async (req, res) => {
  try {
    const estadisticas = await dataService.obtenerEstadisticasGlobales();
    res.json({
      success: true,
      data: estadisticas,
      message: 'Estadísticas globales obtenidas exitosamente'
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas globales:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas globales',
      error: error.message
    });
  }
});

// Búsqueda global de reparaciones
router.get('/reparaciones/global', async (req, res) => {
  try {
    const { sede, estado, fechaDesde } = req.query;
    const criterio = {};
    
    if (sede) criterio.sede = sede;
    if (estado) criterio.estado = estado;
    if (fechaDesde) criterio.fechaDesde = new Date(fechaDesde);
    
    const reparaciones = await dataService.buscarReparacionesGlobales(criterio);
    res.json({
      success: true,
      data: reparaciones,
      total: reparaciones.length,
      criterio: criterio,
      message: 'Búsqueda global de reparaciones completada'
    });
  } catch (error) {
    console.error('Error en búsqueda global de reparaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error en búsqueda global de reparaciones',
      error: error.message
    });
  }
});

// Reporte consolidado de todo el sistema
router.get('/reporte/consolidado', async (req, res) => {
  try {
    const reporte = await dataService.generarReporteConsolidado();
    res.json({
      success: true,
      data: reporte,
      message: 'Reporte consolidado generado exitosamente'
    });
  } catch (error) {
    console.error('Error generando reporte consolidado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar reporte consolidado',
      error: error.message
    });
  }
});

// =====================================================
// RUTAS CRUD COMPLETO PARA GESTIÓN
// =====================================================

// --- VEHÍCULOS ---
// Listar todos los vehículos
router.get('/vehiculos', async (req, res) => {
  try {
    const result = await dataService.listarVehiculos();
    res.json(result);
  } catch (error) {
    console.error('❌ Error listando vehículos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar vehículos',
      error: error.message
    });
  }
});

// Actualizar vehículo
router.put('/vehiculos/:matricula', async (req, res) => {
  try {
    const { matricula } = req.params;
    const vehiculoData = req.body;
    
    const result = await dataService.actualizarVehiculo(matricula, vehiculoData);
    res.json(result);
  } catch (error) {
    console.error('❌ Error actualizando vehículo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar vehículo',
      error: error.message
    });
  }
});

// Eliminar vehículo
router.delete('/vehiculos/:matricula', async (req, res) => {
  try {
    const { matricula } = req.params;
    
    const result = await dataService.eliminarVehiculo(matricula);
    res.json(result);
  } catch (error) {
    console.error('❌ Error eliminando vehículo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar vehículo',
      error: error.message
    });
  }
});

// --- EMPLEADOS ---
// Listar todos los empleados
router.get('/empleados', async (req, res) => {
  try {
    const result = await dataService.listarEmpleados();
    res.json(result);
  } catch (error) {
    console.error('❌ Error listando empleados:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar empleados',
      error: error.message
    });
  }
});

// Actualizar empleado
router.put('/empleados/:cedula', async (req, res) => {
  try {
    const { cedula } = req.params;
    const empleadoData = req.body;
    
    const result = await dataService.actualizarEmpleado(cedula, empleadoData);
    res.json(result);
  } catch (error) {
    console.error('❌ Error actualizando empleado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar empleado',
      error: error.message
    });
  }
});

// Eliminar empleado
router.delete('/empleados/:cedula', async (req, res) => {
  try {
    const { cedula } = req.params;
    
    const result = await dataService.eliminarEmpleado(cedula);
    res.json(result);
  } catch (error) {
    console.error('❌ Error eliminando empleado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar empleado',
      error: error.message
    });
  }
});

// --- REPUESTOS ---
// Listar todos los repuestos
router.get('/repuestos', async (req, res) => {
  try {
    const result = await dataService.listarRepuestos();
    res.json(result);
  } catch (error) {
    console.error('❌ Error listando repuestos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar repuestos',
      error: error.message
    });
  }
});

// Actualizar repuesto
router.put('/repuestos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const repuestoData = req.body;
    
    const result = await dataService.actualizarRepuesto(parseInt(id), repuestoData);
    res.json(result);
  } catch (error) {
    console.error('❌ Error actualizando repuesto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar repuesto',
      error: error.message
    });
  }
});

// Eliminar repuesto
router.delete('/repuestos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await dataService.eliminarRepuesto(parseInt(id));
    res.json(result);
  } catch (error) {
    console.error('❌ Error eliminando repuesto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar repuesto',
      error: error.message
    });
  }
});

// --- REPARACIONES ---
// Listar todas las reparaciones
router.get('/reparaciones', async (req, res) => {
  try {
    const result = await dataService.listarReparaciones();
    res.json(result);
  } catch (error) {
    console.error('❌ Error listando reparaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar reparaciones',
      error: error.message
    });
  }
});

// Actualizar reparación
router.put('/reparaciones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const reparacionData = req.body;
    
    const result = await dataService.actualizarReparacion(parseInt(id), reparacionData);
    res.json(result);
  } catch (error) {
    console.error('❌ Error actualizando reparación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar reparación',
      error: error.message
    });
  }
});

// Eliminar reparación
router.delete('/reparaciones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await dataService.eliminarReparacion(parseInt(id));
    res.json(result);
  } catch (error) {
    console.error('❌ Error eliminando reparación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar reparación',
      error: error.message
    });
  }
});

// --- CLIENTES ---
// Listar todos los clientes
router.get('/clientes', async (req, res) => {
  try {
    // Obtener clientes desde el nodo actual
    const pool = dataService.getConnectionPool(dataService.currentSede);
    if (!pool) {
      return res.status(500).json({
        success: false,
        message: 'No hay conexión disponible'
      });
    }

    const request = pool.request();
    const result = await request.query(`
      SELECT cedula, nombre, apellido, zona 
      FROM Cliente 
      ORDER BY nombre, apellido
    `);

    res.json({
      success: true,
      data: result.recordset,
      message: `${result.recordset.length} clientes encontrados en nodo ${dataService.currentSede}`
    });
  } catch (error) {
    console.error('❌ Error listando clientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar clientes',
      error: error.message
    });
  }
});

// ===== NUEVAS RUTAS DE CONSULTA DE CLIENTES =====

// LISTAR TODOS LOS CLIENTES CON ESTADÍSTICAS
router.get('/clientes-completo', async (req, res) => {
  try {
    const resultado = await dataService.listarClientes();
    res.json(resultado);
  } catch (error) {
    console.error('❌ Error listando clientes completo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar clientes',
      error: error.message
    });
  }
});

// CONSULTAR CLIENTE POR CÉDULA CON DETALLES
router.get('/clientes/:cedula', async (req, res) => {
  try {
    const { cedula } = req.params;
    const resultado = await dataService.consultarClientePorCedula(cedula);
    
    if (resultado.success) {
      res.json(resultado);
    } else {
      res.status(404).json(resultado);
    }
  } catch (error) {
    console.error('❌ Error consultando cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al consultar cliente',
      error: error.message
    });
  }
});

module.exports = router;