// server.js
const express = require('express');
const path = require('path');
const sql = require('mssql'); // ¡Cambiado para SQL Server!

const app = express();
const port = process.env.PORT || 3000;

// Middleware para procesar datos JSON y de formularios enviados desde el frontend
app.use(express.json()); // Para requests con body en JSON
app.use(express.urlencoded({ extended: true })); // Para datos de formularios URL-encoded

// --- Configuración de Conexión a la Base de Datos SQL Server ---
// ¡IMPORTANTE! Aquí es donde tu amigo configurará los datos de la base de datos.
// Por ahora, puedes dejarlo así. Cuando la BD esté lista, necesitará tus credenciales reales.
const dbConfig = {
    user: 'your_db_user',        // Usuario de SQL Server (ej. 'sa' o un usuario específico)
    password: 'your_db_password',// Contraseña del usuario
    server: 'your_db_host',      // IP o nombre del servidor SQL Server (ej. 'localhost' o 'DESKTOP-XXXXXX')
    database: 'your_db_name',    // Nombre de tu base de datos (ej. 'PoliCarDB')
    options: {
        encrypt: false,          // Para Azure SQL Database (true), para local SQL Server (false)
        trustServerCertificate: true // Cambia a false en producción si tienes un certificado SSL válido
    }
};

// Mensaje de prueba de conexión a la BD al iniciar el servidor
sql.connect(dbConfig)
    .then(pool => {
        if (pool.connected) {
            console.log('Conectado exitosamente a la base de datos SQL Server (o al menos intentándolo...).');
            // Puedes cerrar la conexión de prueba si quieres, pero 'mssql' maneja el pool internamente
            // pool.close();
        }
    })
    .catch(err => {
        console.error('Error al conectar con la base de datos SQL Server:', err.message);
        console.error('Asegúrate de que SQL Server esté corriendo y las credenciales sean correctas.');
        console.error('No te preocupes si no está conectada todavía, tu amigo la conectará luego.');
    });

// Sirve los archivos estáticos de tu Frontend desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- Rutas de API para interactuar con la Base de Datos ---
// Estas rutas simularán la interacción con la BD por ahora, y luego se conectarán realmente.

// 1. Ruta de Login (simulada para la selección de sede)
app.post('/api/login', (req, res) => {
    const { sede } = req.body;
    console.log(`Intento de login en sede: ${sede}`); // Para ver en la consola del servidor
    if (sede === 'Sur' || sede === 'Norte') { // Validación básica
        res.json({ success: true, message: `Bienvenido a POLI-CAR Sede ${sede}` });
    } else {
        res.status(400).json({ success: false, message: 'Sede inválida. Por favor, elige Sur o Norte.' });
    }
});

// 2. Ruta para Registrar Vehículo
app.post('/api/vehiculos', async (req, res) => {
    const { ciCliente, matricula, marca, modelo } = req.body;
    console.log('Datos de Vehículo recibidos:', { ciCliente, matricula, marca, modelo });
    try {
        const pool = await sql.connect(dbConfig); // Abre una conexión desde el pool
        const request = pool.request();
        // Ejemplo de inserción real en SQL Server (descomenta y adapta cuando la BD esté lista)
        /*
        request.input('ciCliente', sql.VarChar, ciCliente);
        request.input('matricula', sql.VarChar, matricula);
        request.input('marca', sql.VarChar, marca);
        request.input('modelo', sql.VarChar, modelo);
        const result = await request.query(
            'INSERT INTO Vehiculos (CI_Cliente, Matricula, Marca, Modelo) VALUES (@ciCliente, @matricula, @marca, @modelo); SELECT * FROM Vehiculos WHERE Matricula = @matricula;'
        );
        */
        res.status(201).json({ success: true, message: 'Vehículo registrado (simulado).' /*, data: result.recordset[0] */ });
    } catch (error) {
        console.error('Error al registrar vehículo (en server):', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor al registrar vehículo.' });
    }
});

// 3. Ruta para Registrar Empleado
app.post('/api/empleados', async (req, res) => {
    const { id, nombre, cedula, fechaContratacion, salario } = req.body;
    console.log('Datos de Empleado recibidos:', { id, nombre, cedula, fechaContratacion, salario });
    try {
        const pool = await sql.connect(dbConfig);
        const request = pool.request();
        // Ejemplo de inserción real en SQL Server (descomenta y adapta cuando la BD esté lista)
        /*
        request.input('id', sql.VarChar, id);
        request.input('nombre', sql.VarChar, nombre);
        request.input('cedula', sql.VarChar, cedula);
        request.input('fechaContratacion', sql.Date, fechaContratacion);
        request.input('salario', sql.Decimal(10, 2), salario);
        const result = await request.query(
            'INSERT INTO Empleados (ID, Nombre, Cedula, Fecha_Contratacion, Salario) VALUES (@id, @nombre, @cedula, @fechaContratacion, @salario); SELECT * FROM Empleados WHERE ID = @id;'
        );
        */
        res.status(201).json({ success: true, message: 'Empleado registrado (simulado).' /*, data: result.recordset[0] */ });
    } catch (error) {
        console.error('Error al registrar empleado (en server):', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor al registrar empleado.' });
    }
});

// 4. Ruta para Registrar Reparación
app.post('/api/reparaciones', async (req, res) => {
    const { id, matricula, fechaReparacion, idRepuesto, observacion, precio } = req.body;
    console.log('Datos de Reparación recibidos:', { id, matricula, fechaReparacion, idRepuesto, observacion, precio });
    try {
        const pool = await sql.connect(dbConfig);
        const request = pool.request();
        // Ejemplo de inserción real en SQL Server (descomenta y adapta cuando la BD esté lista)
        /*
        request.input('id', sql.VarChar, id);
        request.input('matricula', sql.VarChar, matricula);
        request.input('fechaReparacion', sql.Date, fechaReparacion);
        request.input('idRepuesto', sql.VarChar, idRepuesto);
        request.input('observacion', sql.VarChar, observacion);
        request.input('precio', sql.Decimal(10, 2), precio);
        const result = await request.query(
            'INSERT INTO Reparaciones (ID, Matricula, Fecha_Reparacion, ID_Repuesto, Observacion, Precio) VALUES (@id, @matricula, @fechaReparacion, @idRepuesto, @observacion, @precio); SELECT * FROM Reparaciones WHERE ID = @id;'
        );
        */
        res.status(201).json({ success: true, message: 'Reparación registrada (simulada).' /*, data: result.recordset[0] */ });
    } catch (error) {
        console.error('Error al registrar reparación (en server):', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor al registrar reparación.' });
    }
});

// 5. Ruta para Registrar Repuesto
app.post('/api/repuestos', async (req, res) => {
    const { idRepuesto, descripcionRepuesto, cantidadRepuesto } = req.body;
    console.log('Datos de Repuesto recibidos:', { idRepuesto, descripcionRepuesto, cantidadRepuesto });
    try {
        const pool = await sql.connect(dbConfig);
        const request = pool.request();
        // Ejemplo de inserción real en SQL Server (descomenta y adapta cuando la BD esté lista)
        /*
        request.input('idRepuesto', sql.VarChar, idRepuesto);
        request.input('descripcionRepuesto', sql.VarChar, descripcionRepuesto);
        request.input('cantidadRepuesto', sql.Int, cantidadRepuesto);
        const result = await request.query(
            'INSERT INTO Repuestos (ID_Repuesto, Descripcion, Cantidad) VALUES (@idRepuesto, @descripcionRepuesto, @cantidadRepuesto); SELECT * FROM Repuestos WHERE ID_Repuesto = @idRepuesto;'
        );
        */
        res.status(201).json({ success: true, message: 'Repuesto registrado (simulado).' /*, data: result.recordset[0] */ });
    } catch (error) {
        console.error('Error al registrar repuesto (en server):', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor al registrar repuesto.' });
    }
});

// 6. Ruta para Consultar Reparación (simulada)
app.get('/api/consultar-reparacion', async (req, res) => {
    const { ci, matricula } = req.query; // Puedes consultar por CI o Matrícula
    console.log('Solicitud de consulta de reparación recibida:', { ci, matricula });
    try {
        // En un futuro, aquí irá la consulta SQL real para buscar en la BD
        // const pool = await sql.connect(dbConfig);
        // const request = pool.request();
        // let query = 'SELECT * FROM Reparaciones r JOIN Vehiculos v ON r.Matricula = v.Matricula JOIN Clientes c ON v.CI_Cliente = c.CI WHERE 1=1';
        // if (ci) {
        //     query += ' AND c.CI = @ci';
        //     request.input('ci', sql.VarChar, ci);
        // }
        // if (matricula) {
        //     query += ' AND v.Matricula = @matricula';
        //     request.input('matricula', sql.VarChar, matricula);
        // }
        // const result = await request.query(query);

        // Datos de ejemplo para simular una búsqueda si la BD no está conectada
        const dummyData = [
            { id: 'REP001', matricula: 'ABC-123', fecha_reparacion: '2025-07-20', id_repuesto: 'PART001', observacion: 'Cambio de aceite y filtro.', precio: 50.00 },
            { id: 'REP002', matricula: 'DEF-456', fecha_reparacion: '2025-07-22', id_repuesto: 'PART002', observacion: 'Revisión de frenos.', precio: 75.50 }
        ];

        // Filtra los datos dummy para simular una búsqueda
        const filteredData = dummyData.filter(item => {
            let match = true;
            if (ci && !item.matricula.includes(ci)) match = false; // Simulación: si hay CI, busca en matrícula
            if (matricula && item.matricula !== matricula) match = false;
            return match;
        });

        res.json({ success: true, data: filteredData, message: 'Consulta de reparación exitosa (simulada).' });
    } catch (error) {
        console.error('Error al consultar reparación (en server):', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor al consultar reparación.' });
    }
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor de POLI-CAR escuchando en http://localhost:${port}`);
    console.log(`Archivos del frontend servidos desde: ${path.join(__dirname, 'public')}`);
    console.log('¡Listo para que pruebes los formularios!');
});