// public/js/main.js

// Función auxiliar para mostrar mensajes
function showMessage(elementId, message, isSuccess) {
  const messageElement = document.getElementById(elementId);
  if (messageElement) {
    messageElement.textContent = message;
    messageElement.style.display = 'block'; // Mostrar el elemento
    if (isSuccess) {
      messageElement.className = 'success'; // Clase para éxito (verde)
    } else {
      messageElement.className = ''; // Limpiar clase para error (rojo por defecto en CSS)
    }
    // Ocultar el mensaje después de 3 segundos
    setTimeout(() => {
      messageElement.style.display = 'none';
      messageElement.textContent = '';
    }, 3000);
  }
}


// --- Lógica para el Login (index.html) ---
const ingresarBtn = document.getElementById('ingresarBtn');
if (ingresarBtn) {
  ingresarBtn.addEventListener('click', async () => {
    const selectedSede = document.querySelector('input[name="sede"]:checked').value;
    const messageElementId = 'message';

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sede: selectedSede })
      });

      const data = await response.json();
      if (data.success) {
        showMessage(messageElementId, data.message, true);
        setTimeout(() => {
          window.location.href = 'dashboard.html'; // Redirige al dashboard
        }, 1500); // Dar un poco de tiempo para leer el mensaje
      } else {
        showMessage(messageElementId, data.message, false);
      }
    } catch (error) {
      console.error('Error en el login:', error);
      showMessage(messageElementId, 'Error de conexión con el servidor. Inténtalo de nuevo.', false);
    }
  });
}

// --- Lógica para Registrar Vehículo (registrar-vehiculo.html) ---
const registrarVehiculoForm = document.getElementById('registrarVehiculoForm');
if (registrarVehiculoForm) {
  registrarVehiculoForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Evita que el formulario se envíe de la forma tradicional

    const ciCliente = document.getElementById('ciCliente').value;
    const matricula = document.getElementById('matricula').value;
    const marca = document.getElementById('marca').value;
    const modelo = document.getElementById('modelo').value;
    const messageElementId = 'message';

    try {
      const response = await fetch('/api/vehiculos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ciCliente, matricula, marca, modelo })
      });

      const data = await response.json();
      if (data.success) {
        showMessage(messageElementId, data.message, true);
        registrarVehiculoForm.reset(); // Limpia el formulario
      } else {
        showMessage(messageElementId, data.message, false);
      }
    } catch (error) {
      console.error('Error al registrar vehículo:', error);
      showMessage(messageElementId, 'Error de conexión con el servidor al registrar vehículo.', false);
    }
  });
}

// --- Lógica para Registrar Empleado (registrar-empleado.html) ---
const registrarEmpleadoForm = document.getElementById('registrarEmpleadoForm');
if (registrarEmpleadoForm) {
  registrarEmpleadoForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const id = document.getElementById('idEmpleado').value;
    const nombre = document.getElementById('nombreEmpleado').value;
    const cedula = document.getElementById('cedulaEmpleado').value;
    const fechaContratacion = document.getElementById('fechaContratacion').value;
    const salario = parseFloat(document.getElementById('salarioEmpleado').value);
    const messageElementId = 'message';

    try {
      const response = await fetch('/api/empleados', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id, nombre, cedula, fechaContratacion, salario })
      });

      const data = await response.json();
      if (data.success) {
        showMessage(messageElementId, data.message, true);
        registrarEmpleadoForm.reset();
      } else {
        showMessage(messageElementId, data.message, false);
      }
    } catch (error) {
      console.error('Error al registrar empleado:', error);
      showMessage(messageElementId, 'Error de conexión con el servidor al registrar empleado.', false);
    }
  });
}

// --- Lógica para Registrar Reparación (registrar-reparacion.html) ---
const registrarReparacionForm = document.getElementById('registrarReparacionForm');
if (registrarReparacionForm) {
  registrarReparacionForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const id = document.getElementById('idReparacion').value;
    const matricula = document.getElementById('matriculaReparacion').value;
    const fechaReparacion = document.getElementById('fechaReparacion').value;
    const idRepuesto = document.getElementById('idRepuestoReparacion').value;
    const observacion = document.getElementById('observacionReparacion').value;
    const precio = parseFloat(document.getElementById('precioReparacion').value);
    const messageElementId = 'message';

    try {
      const response = await fetch('/api/reparaciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id, matricula, fechaReparacion, idRepuesto, observacion, precio })
      });

      const data = await response.json();
      if (data.success) {
        showMessage(messageElementId, data.message, true);
        registrarReparacionForm.reset();
      } else {
        showMessage(messageElementId, data.message, false);
      }
    } catch (error) {
      console.error('Error al registrar reparación:', error);
      showMessage(messageElementId, 'Error de conexión con el servidor al registrar reparación.', false);
    }
  });
}

// --- Lógica para Registrar Repuesto (registrar-repuesto.html) ---
const registrarRepuestoForm = document.getElementById('registrarRepuestoForm');
if (registrarRepuestoForm) {
  registrarRepuestoForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const idRepuesto = document.getElementById('idRepuesto').value;
    const descripcionRepuesto = document.getElementById('descripcionRepuesto').value;
    const cantidadRepuesto = parseInt(document.getElementById('cantidadRepuesto').value);
    const messageElementId = 'message';

    try {
      const response = await fetch('/api/repuestos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ idRepuesto, descripcionRepuesto, cantidadRepuesto })
      });

      const data = await response.json();
      if (data.success) {
        showMessage(messageElementId, data.message, true);
        registrarRepuestoForm.reset();
      } else {
        showMessage(messageElementId, data.message, false);
      }
    } catch (error) {
      console.error('Error al registrar repuesto:', error);
      showMessage(messageElementId, 'Error de conexión con el servidor al registrar repuesto.', false);
    }
  });
}


// --- Lógica para Consultar Reparación (consultar-reparacion.html) ---
const consultarReparacionForm = document.getElementById('consultarReparacionForm');
if (consultarReparacionForm) {
  consultarReparacionForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const ci = document.getElementById('ciConsulta').value;
    const matricula = document.getElementById('matriculaConsulta').value;
    const resultsDiv = document.getElementById('results');
    const messageElementId = 'message';

    resultsDiv.innerHTML = ''; // Limpiar resultados anteriores
    showMessage(messageElementId, 'Consultando...', true); // Mensaje de carga

    const queryParams = new URLSearchParams();
    if (ci) queryParams.append('ci', ci);
    if (matricula) queryParams.append('matricula', matricula);

    try {
      const response = await fetch(`/api/consultar-reparacion?${queryParams.toString()}`);
      const data = await response.json();

      if (data.success && data.data && data.data.length > 0) {
        let html = '<h3>Resultados de la Consulta:</h3>';
        html += '<div class="reparaciones-grid">';
        data.data.forEach(reparacion => {
          html += `
            <div class="reparacion-card">
              <div class="card-header">
                <h4>🔧 Reparación #${reparacion.id_reparacion || 'N/A'}</h4>
                <span class="sede-badge">Sede: ${data.sede || 'N/A'}</span>
              </div>
              <div class="card-body">
                <div class="info-row">
                  <span class="label">🚗 Matrícula:</span>
                  <span class="value">${reparacion.matricula || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="label">📅 Fecha:</span>
                  <span class="value">${reparacion.fecha ? new Date(reparacion.fecha).toLocaleDateString('es-ES') : 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="label">🔨 Tipo:</span>
                  <span class="value">${reparacion.tipo || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="label">📝 Observaciones:</span>
                  <span class="value">${reparacion.observaciones || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="label">💰 Precio:</span>
                  <span class="value price">$${reparacion.precio ? parseFloat(reparacion.precio).toFixed(2) : '0.00'}</span>
                </div>
                ${reparacion.marca ? `
                <div class="info-row">
                  <span class="label">🏷️ Vehículo:</span>
                  <span class="value">${reparacion.marca} ${reparacion.modelo || ''}</span>
                </div>` : ''}
                ${reparacion.nombre_cliente ? `
                <div class="info-row">
                  <span class="label">👤 Cliente:</span>
                  <span class="value">${reparacion.nombre_cliente} ${reparacion.apellido_cliente || ''}</span>
                </div>` : ''}
              </div>
            </div>
          `;
        });
        html += '</div>';
        resultsDiv.innerHTML = html;
        showMessage(messageElementId, `${data.data.length} reparación(es) encontrada(s) en ${data.sede}`, true);
      } else {
        resultsDiv.innerHTML = '<p>No se encontraron reparaciones o la búsqueda no arrojó resultados.</p>';
        showMessage(messageElementId, data.message || 'No se encontraron resultados.', false);
      }
    } catch (error) {
      console.error('Error al consultar reparaciones:', error);
      showMessage(messageElementId, 'Error de conexión con el servidor al consultar reparaciones.', false);
      resultsDiv.innerHTML = '<p style="color: red;">Error al consultar reparaciones.</p>';
    }
  });
}