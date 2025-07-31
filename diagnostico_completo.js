// diagnostico_completo.js - Diagnóstico detallado del error
console.log('🔍 DIAGNÓSTICO COMPLETO DEL ERROR');
console.log('==================================');

try {
    // 1. Verificar que dataService se importe correctamente
    console.log('\n1️⃣ Verificando importación de dataService...');
    const dataService = require('./services/dataService');
    console.log('✅ dataService importado correctamente');
    console.log('📋 Métodos disponibles:', Object.getOwnPropertyNames(dataService).filter(name => typeof dataService[name] === 'function'));
    
    // 2. Verificar que listarClientes existe
    console.log('\n2️⃣ Verificando método listarClientes...');
    if (typeof dataService.listarClientes === 'function') {
        console.log('✅ Método listarClientes existe');
    } else {
        console.log('❌ Método listarClientes NO existe');
    }
    
    // 3. Verificar que getConnectionPool NO existe (como debe ser)
    console.log('\n3️⃣ Verificando que getConnectionPool NO existe...');
    if (typeof dataService.getConnectionPool === 'undefined') {
        console.log('✅ getConnectionPool NO existe (correcto)');
    } else {
        console.log('❌ getConnectionPool aún existe (problema)');
    }
    
    // 4. Verificar conexiones de base de datos
    console.log('\n4️⃣ Verificando conexiones de base de datos...');
    const { checkConnectionHealth } = require('./config/database');
    
    checkConnectionHealth().then(health => {
        console.log('📊 Estado de conexiones:', JSON.stringify(health, null, 2));
        
        // 5. Intentar ejecutar listarClientes
        console.log('\n5️⃣ Probando listarClientes...');
        return dataService.listarClientes();
    }).then(resultado => {
        console.log('✅ listarClientes funcionó:', resultado.success);
        console.log('📋 Clientes encontrados:', resultado.data?.length || 0);
        console.log('💬 Mensaje:', resultado.message);
        if (resultado.warning) {
            console.log('⚠️ Advertencia:', resultado.warning);
        }
    }).catch(error => {
        console.error('❌ Error en listarClientes:', error.message);
        console.error('📍 Stack trace:', error.stack);
    });
    
} catch (error) {
    console.error('❌ Error crítico en diagnóstico:', error.message);
    console.error('📍 Stack trace:', error.stack);
}
