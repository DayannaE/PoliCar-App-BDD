// scripts/testConnection.js
const { initializeConnections, checkConnectionHealth, closeAllConnections } = require('../config/database');

async function testConnections() {
  console.log('🔬 Iniciando prueba de conexiones POLI-CAR...');
  console.log('=' * 50);

  try {
    // Inicializar conexiones
    await initializeConnections();
    
    // Verificar estado de salud
    console.log('\n📊 Verificando estado de conexiones...');
    const healthStatus = await checkConnectionHealth();
    
    console.log('\n📋 RESULTADO DE CONEXIONES:');
    console.log('=' * 40);
    
    let healthyCount = 0;
    for (const [key, status] of Object.entries(healthStatus)) {
      const emoji = status === 'healthy' ? '✅' : status === 'unhealthy' ? '⚠️' : '❌';
      console.log(`${key.padEnd(20)} | ${emoji} ${status.toUpperCase()}`);
      if (status === 'healthy') healthyCount++;
    }
    
    console.log('=' * 40);
    console.log(`Conexiones saludables: ${healthyCount}/${Object.keys(healthStatus).length}`);
    
    if (healthyCount > 0) {
      console.log('\n🎉 Sistema listo para funcionar!');
      console.log('💡 Inicia el servidor con: npm start');
    } else {
      console.log('\n❌ No hay conexiones disponibles');
      console.log('🔧 Verifica la configuración en config/database.js');
      console.log('🏥 Asegúrate de que SQL Server esté ejecutándose');
    }

  } catch (error) {
    console.error('❌ Error durante la prueba:', error.message);
  } finally {
    await closeAllConnections();
    console.log('\n🔌 Conexiones cerradas');
  }
}

if (require.main === module) {
  testConnections();
}

module.exports = { testConnections };