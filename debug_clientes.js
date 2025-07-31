// debug_clientes.js - Script para diagnosticar el problema con listar clientes
const dataService = require('./services/dataService');
const { checkConnectionHealth } = require('./config/database');

async function diagnosticarProblema() {
    console.log('🔍 DIAGNÓSTICO DEL PROBLEMA DE LISTAR CLIENTES');
    console.log('================================================');
    
    try {
        // 1. Verificar conexiones de base de datos
        console.log('\n1️⃣ Verificando conexiones de base de datos...');
        const health = await checkConnectionHealth();
        console.log('Estado de conexiones:', JSON.stringify(health, null, 2));
        
        // 2. Establecer sede
        console.log('\n2️⃣ Estableciendo sede Sur...');
        dataService.setSede('Sur');
        
        // 3. Intentar listar clientes
        console.log('\n3️⃣ Intentando listar clientes...');
        const resultado = await dataService.listarClientes();
        console.log('✅ Resultado exitoso:', JSON.stringify(resultado, null, 2));
        
    } catch (error) {
        console.error('❌ Error en diagnóstico:', error);
        console.error('Stack trace:', error.stack);
        
        // Intentar con validaciones más básicas
        console.log('\n🔧 Intentando validaciones básicas...');
        try {
            const cliente = await dataService.validarClienteExiste('1234567890');
            console.log('Cliente de prueba encontrado:', cliente);
        } catch (basicError) {
            console.error('Error en validación básica:', basicError.message);
        }
    }
    
    process.exit(0);
}

// Ejecutar diagnóstico
diagnosticarProblema();
