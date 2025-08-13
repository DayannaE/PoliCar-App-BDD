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

// =====================================================
// --- ENDPOINT DE PRUEBA ---
router.get('/test', (req, res) => {
  console.log('🧪 Test endpoint llamado');
  res.json({ 
    success: true, 
    message: 'API funcionando correctamente',
    timestamp: new Date().toISOString(),
    endpoints_disponibles: [
      'GET /api/test',
      'GET /api/diagnostico/vistas-particionadas',
      'GET /api/diagnostico/estructura-tablas',
      'GET /api/estadisticas-globales',
      'GET /api/fragmentacion-vertical',
      'GET /api/vehiculos/global',
      'GET /api/estadisticas/global',
      'GET /api/reparaciones/global',
      'GET /api/reporte/consolidado'
    ]
  });
});

// --- ENDPOINT PARA DIAGNÓSTICO DE VISTAS PARTICIONADAS ---
router.get('/diagnostico/vistas-particionadas', async (req, res) => {
  try {
    console.log('🔍 Realizando diagnóstico de vistas particionadas...');
    const resultado = await dataService.diagnosticarVistasParticionadas();
    res.json(resultado);
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    res.status(500).json({
      success: false,
      message: 'Error realizando diagnóstico',
      error: error.message
    });
  }
});

// --- ENDPOINT PARA ESTADÍSTICAS GLOBALES CON FALLBACK ---
router.get('/estadisticas-globales', async (req, res) => {
  try {
    console.log('📊 Obteniendo estadísticas globales...');
    const resultado = await dataService.obtenerEstadisticasGlobales();
    res.json(resultado);
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas globales:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas globales',
      error: error.message
    });
  }
});

// --- ENDPOINT PARA DEMOSTRAR FRAGMENTACIÓN VERTICAL ---
router.get('/fragmentacion-vertical', async (req, res) => {
  try {
    console.log('🧩 Demostrando fragmentación vertical...');
    const resultado = await dataService.demostrarFragmentacionVertical();
    res.json(resultado);
  } catch (error) {
    console.error('❌ Error demostrando fragmentación vertical:', error);
    res.status(500).json({
      success: false,
      message: 'Error demostrando fragmentación vertical',
      error: error.message
    });
  }
});

// --- ENDPOINT PARA VERIFICAR ESTRUCTURA DE TABLAS ---
router.get('/diagnostico/estructura-tablas', async (req, res) => {
  try {
    console.log('🔍 Verificando estructura de tablas...');
    const estructura = await dataService.verificarEstructuraTablas();
    res.json({
      success: true,
      estructura: estructura,
      message: 'Estructura de tablas verificada'
    });
  } catch (error) {
    console.error('❌ Error verificando estructura:', error);
    res.status(500).json({
      success: false,
      message: 'Error verificando estructura de tablas',
      error: error.message
    });
  }
});

// --- RUTAS DE CLIENTES ---
// =====================================================

// REGISTRAR CLIENTE
router.post('/clientes', async (req, res) => {
  try {
    const { cedula, nombre, apellido, zona, telefono, email } = req.body;
    
    // Validaciones básicas
    if (!cedula || !nombre || !apellido || !zona) {
      return res.status(400).json({
        success: false,
        message: 'Los campos cédula, nombre, apellido y zona son obligatorios.'
      });
    }

    if (zona !== 'Sur' && zona !== 'Norte') {
      return res.status(400).json({
        success: false,
        message: 'La zona debe ser "Sur" o "Norte".'
      });
    }

    const resultado = await dataService.registrarCliente({
      cedula, nombre, apellido, zona, telefono, email
    });

    res.status(201).json(resultado);

  } catch (error) {
    console.error('Error registrando cliente:', error);
    
    if (error.message.includes('ya está registrado')) {
      res.status(409).json({
        success: false,
        message: error.message
      });
    } else if (error.message.includes('no disponible')) {
      res.status(503).json({
        success: false,
        message: 'Servicio de base de datos temporalmente no disponible. Intenta más tarde.'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor al registrar cliente.'
      });
    }
  }
});

// ENDPOINT DE PRUEBA PARA DIAGNÓSTICO
router.get('/test-dataservice', async (req, res) => {
  try {
    console.log('🧪 Endpoint de prueba - verificando dataService...');
    console.log('📋 Métodos disponibles:', Object.getOwnPropertyNames(dataService).filter(name => typeof dataService[name] === 'function'));
    
    res.json({
      success: true,
      message: 'dataService funciona correctamente',
      metodos_disponibles: Object.getOwnPropertyNames(dataService).filter(name => typeof dataService[name] === 'function'),
      tiene_listarClientes: typeof dataService.listarClientes === 'function',
      tiene_getConnectionPool: typeof dataService.getConnectionPool !== 'undefined'
    });
  } catch (error) {
    console.error('❌ Error en test-dataservice:', error);
    res.status(500).json({
      success: false,
      message: 'Error en dataService',
      error: error.message
    });
  }
});

// LISTAR CLIENTES
router.get('/clientes', async (req, res) => {
  try {
    console.log('🔄 Iniciando petición para listar clientes...');
    
    // Verificación adicional
    if (typeof dataService.listarClientes !== 'function') {
      throw new Error('dataService.listarClientes no es una función');
    }
    
    const resultado = await dataService.listarClientes();
    console.log('✅ Clientes obtenidos exitosamente:', resultado.data?.length || 0);
    res.json(resultado);

  } catch (error) {
    console.error('❌ Error listando clientes:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: `Error al obtener la lista de clientes: ${error.message}`,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      debug_info: {
        dataService_type: typeof dataService,
        listarClientes_type: typeof dataService.listarClientes,
        available_methods: Object.getOwnPropertyNames(dataService).filter(name => typeof dataService[name] === 'function')
      }
    });
  }
});

// BUSCAR CLIENTE POR CÉDULA
router.get('/clientes/:cedula', async (req, res) => {
  try {
    const { cedula } = req.params;
    
    if (!cedula) {
      return res.status(400).json({
        success: false,
        message: 'Cédula es requerida.'
      });
    }

    // Primero buscar si existe en cualquier sede
    const clienteExiste = await dataService.validarClienteExiste(cedula);
    
    if (!clienteExiste) {
      return res.status(404).json({
        success: false,
        message: `Cliente con cédula ${cedula} no encontrado.`
      });
    }

    res.json({
      success: true,
      data: clienteExiste,
      message: 'Cliente encontrado'
    });

  } catch (error) {
    console.error('Error buscando cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar cliente.'
    });
  }
});

// OBTENER DETALLES COMPLETOS DEL CLIENTE
router.get('/clientes/:cedula/detalles', async (req, res) => {
  try {
    const { cedula } = req.params;
    
    const resultado = await dataService.consultarClientePorCedula(cedula);
    
    if (!resultado.success) {
      return res.status(404).json(resultado);
    }

    res.json(resultado);

  } catch (error) {
    console.error('Error obteniendo detalles del cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener detalles del cliente.'
    });
  }
});

// ACTUALIZAR CLIENTE
router.put('/clientes/:cedula', async (req, res) => {
  try {
    const { cedula } = req.params;
    const { nombre, apellido, zona, telefono, email } = req.body;
    
    // Validaciones básicas
    if (!nombre || !apellido || !zona) {
      return res.status(400).json({
        success: false,
        message: 'Los campos nombre, apellido y zona son obligatorios.'
      });
    }

    if (zona !== 'Sur' && zona !== 'Norte') {
      return res.status(400).json({
        success: false,
        message: 'La zona debe ser "Sur" o "Norte".'
      });
    }

    const resultado = await dataService.actualizarCliente(cedula, {
      nombre, apellido, zona, telefono, email
    });

    res.json(resultado);

  } catch (error) {
    console.error('Error actualizando cliente:', error);
    
    if (error.message.includes('no encontrado')) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor al actualizar cliente.'
      });
    }
  }
});

// ELIMINAR CLIENTE
router.delete('/clientes/:cedula', async (req, res) => {
  try {
    const { cedula } = req.params;
    
    const resultado = await dataService.eliminarCliente(cedula);
    res.json(resultado);

  } catch (error) {
    console.error('Error eliminando cliente:', error);
    
    if (error.message.includes('no encontrado')) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else if (error.message.includes('no se puede eliminar')) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor al eliminar cliente.'
      });
    }
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
      cedulaCliente: ciCliente, 
      placa: matricula,
      marca, 
      modelo
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
    console.log('🔧 Datos recibidos para reparación:', req.body);
    
    const { id, matricula, fechaReparacion, tipo, observacion, precio, idTaller } = req.body;
    
    if (!id || !matricula || !fechaReparacion || !precio) {
      return res.status(400).json({
        success: false,
        message: 'Los campos ID, Matrícula, Fecha y Precio son obligatorios.'
      });
    }

    if (isNaN(precio) || precio <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El precio debe ser un número positivo.'
      });
    }

    // Mapear correctamente los parámetros esperados por dataService.registrarReparacion
    const resultado = await dataService.registrarReparacion({
      idReparacion: parseInt(id),
      placa: matricula,
      fecha: new Date(fechaReparacion),
      descripcion: tipo || 'Reparación General',
      observaciones: observacion || '',
      anio: new Date().getFullYear(),
      precio: parseFloat(precio),
      sedeTaller: parseInt(idTaller) || 1
    });

    res.status(201).json(resultado);

  } catch (error) {
    console.error('❌ Error registrando reparación:', error);
    
    if (error.message.includes('no está registrado')) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    } else if (error.message.includes('no disponible')) {
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
        message: 'La matrícula del vehículo no existe en el sistema.'
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

    const resultado = await dataService.consultarReparaciones({ ci, placa: matricula });
    
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
    const resultado = await dataService.obtenerEstadisticasGlobales();
    // obtenerEstadisticasGlobales ya devuelve un objeto con success, data, etc.
    res.json(resultado);
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

// ===== NUEVAS RUTAS DE CONSULTA DE CLIENTES =====

// LISTAR TODOS LOS CLIENTES CON ESTADÍSTICAS (endpoint alternativo)
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

// ===== ENDPOINTS DE CONSULTAS GLOBALES CON RESPALDO =====
router.get('/estadisticas-globales', async (req, res) => {
  try {
    console.log('📊 Obteniendo estadísticas globales...');
    const resultado = await dataService.obtenerEstadisticasGlobales();
    res.json(resultado);
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas globales:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas globales',
      error: error.message
    });
  }
});

// ===== ENDPOINT DE PRUEBA =====
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Endpoint de prueba funcionando',
    timestamp: new Date().toISOString()
  });
});

// ===== ENDPOINT DE DIAGNÓSTICO =====
router.get('/diagnostico/vistas-particionadas', async (req, res) => {
  try {
    console.log('🔍 Iniciando diagnóstico de vistas particionadas...');
    const diagnostico = await dataService.diagnosticarVistasParticionadas();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      diagnostico: diagnostico
    });
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    res.status(500).json({
      success: false,
      message: 'Error en diagnóstico de vistas particionadas',
      error: error.message
    });
  }
});

module.exports = router;