document.addEventListener('DOMContentLoaded', () => {
    const counterElement = document.getElementById('visit-count');

    // Llamar a nuestra API de Node.js
    fetch('/api/visitas')
        .then(response => {
            if (!response.ok) {
                throw new Error('Error en la red');
            }
            return response.json();
        })
        .then(data => {
            // Añadir una pequeña animación al mostrar el número
            counterElement.style.opacity = '0';
            setTimeout(() => {
                counterElement.innerHTML = data.visitas;
                counterElement.style.transition = 'opacity 0.5s ease';
                counterElement.style.opacity = '1';
            }, 300);
        })
        .catch(error => {
            console.error('Error fetching visitas:', error);
            counterElement.innerHTML = '<span style="font-size: 1.5rem; color: #ef4444;">Error de conexión</span>';
        });
});
