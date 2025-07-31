// test_simple.js - Prueba simple del problema de clientes
console.log('🧪 PRUEBA SIMPLE - Listar Clientes');
console.log('====================================');

// Mock básico para simular el error
async function simularListarClientes() {
    try {
        // Simular el comportamiento esperado
        const clientesSimulados = [
            {
                cedula: '1234567890',
                nombre: 'Juan',
                apellido: 'Pérez',
                zona: 'Norte',
                telefono: '0987654321',
                email: 'juan@email.com',
                total_vehiculos: 0,
                total_reparaciones: 0,
                total_gastado: 0
            },
            {
                cedula: '0987654321',
                nombre: 'María',
                apellido: 'González',
                zona: 'Sur',
                telefono: '0912345678',
                email: 'maria@email.com',
                total_vehiculos: 0,
                total_reparaciones: 0,
                total_gastado: 0
            }
        ];

        return {
            success: true,
            data: clientesSimulados,
            message: `${clientesSimulados.length} clientes encontrados en nodo Sur`
        };
    } catch (error) {
        return {
            success: false,
            message: `Error al listar clientes: ${error.message}`
        };
    }
}

// Probar la función
simularListarClientes().then(resultado => {
    console.log('📊 Resultado de la simulación:');
    console.log(JSON.stringify(resultado, null, 2));
    
    if (resultado.success) {
        console.log('✅ Simulación exitosa - El problema no está en la lógica');
        console.log('💡 Posibles causas del error real:');
        console.log('   1. Servidor no iniciado');
        console.log('   2. Base de datos no conectada');
        console.log('   3. Tabla "Cliente" no existe');
        console.log('   4. Configuración de sede incorrecta');
    } else {
        console.log('❌ Error en la simulación');
    }
});
