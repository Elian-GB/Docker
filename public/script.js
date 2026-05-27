document.addEventListener('DOMContentLoaded', () => {
    // Referencias al DOM
    const authSection = document.getElementById('auth-section');
    const userSection = document.getElementById('user-section');
    const adminSection = document.getElementById('admin-section');
    
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const authForm = document.getElementById('auth-form');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const emailGroup = document.getElementById('email-group');
    const emailInput = document.getElementById('email');
    const rememberMeGroup = document.getElementById('remember-me-group');
    const rememberMeInput = document.getElementById('rememberMe');
    const strengthMeter = document.getElementById('strength-meter');
    const strengthBar = document.getElementById('strength-bar');
    const strengthText = document.getElementById('strength-text');
    
    const userNameDisplay = document.getElementById('user-name-display');
    const personalVisitsCount = document.getElementById('personal-visits-count');
    const adminStatsList = document.getElementById('admin-stats-list');
    const togglePasswordBtn = document.getElementById('toggle-password-btn');
    const eyeIcon = document.getElementById('eye-icon');

    // Toast Container
    const toastContainer = document.getElementById('toast-container');

    // Estado local
    let currentMode = 'login'; // 'login' o 'register'
    let adminChartInstance = null; // Instancia global del gráfico

    // Función para mostrar Toast Notifications
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        toastContainer.appendChild(toast);
        
        // Remover después de 5 segundos
        setTimeout(() => {
            toast.classList.add('hiding');
            toast.addEventListener('transitionend', () => {
                toast.remove();
            });
        }, 5000);
    }

    // Inicialización
    checkAuthStatus();
    registrarVisita();

    // Event Listeners Tabs
    tabLogin.addEventListener('click', () => switchMode('login'));
    tabRegister.addEventListener('click', () => switchMode('register'));

    function switchMode(mode) {
        currentMode = mode;
        strengthMeter.classList.add('hidden');
        
        if (mode === 'login') {
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            authSubmitBtn.textContent = 'Entrar';
            emailGroup.classList.add('hidden');
            emailInput.removeAttribute('required');
            rememberMeGroup.classList.remove('hidden');
        } else {
            tabRegister.classList.add('active');
            tabLogin.classList.remove('active');
            authSubmitBtn.textContent = 'Registrarse';
            emailGroup.classList.remove('hidden');
            emailInput.setAttribute('required', 'required');
            rememberMeGroup.classList.add('hidden');
            if (authForm.password.value) {
                strengthMeter.classList.remove('hidden');
                updatePasswordStrength(authForm.password.value);
            }
        }
    }

    // Manejar envío de formulario (Login o Registro)
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = authForm.username.value;
        const password = authForm.password.value;
        const email = currentMode === 'register' ? authForm.email.value : undefined;
        const rememberMe = currentMode === 'login' ? rememberMeInput.checked : false;
        const endpoint = currentMode === 'login' ? '/api/login' : '/api/register';

        try {
            const bodyData = { username, password };
            if (currentMode === 'register') {
                bodyData.email = email;
            } else {
                bodyData.rememberMe = rememberMe;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            const data = await response.json();

            if (response.ok) {
                if (currentMode === 'register') {
                    showToast(data.message || 'Registro exitoso. Revisa tu correo.', 'success');
                    switchMode('login'); // Cambiar a pestaña de login tras registro
                    authForm.reset();
                } else {
                    showToast('Inicio de sesión exitoso', 'success');
                    checkAuthStatus(); // Actualizar UI
                }
            } else {
                showToast(data.error || 'Error en la solicitud', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Error de conexión con el servidor', 'error');
        }
    });

    // Cerrar Sesión
    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
            showToast('Sesión cerrada', 'info');
            checkAuthStatus();
            registrarVisita(); // Registrar visita anónima tras logout
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    });

    // Verificar estado de autenticación y actualizar UI
    async function checkAuthStatus() {
        try {
            const response = await fetch('/api/me');
            const data = await response.json();

            if (data.loggedIn) {
                authSection.classList.add('hidden');
                logoutBtn.classList.remove('hidden');
                
                userNameDisplay.textContent = data.username;
                personalVisitsCount.textContent = data.visitas;
                userSection.classList.remove('hidden');

                if (data.role === 'admin') {
                    adminSection.classList.remove('hidden');
                    loadAdminStats();
                } else {
                    adminSection.classList.add('hidden');
                }
            } else {
                authSection.classList.remove('hidden');
                userSection.classList.add('hidden');
                adminSection.classList.add('hidden');
                logoutBtn.classList.add('hidden');
                authForm.reset();
            }
        } catch (error) {
            console.error('Error verificando auth:', error);
        }
    }

    // Registrar visita (anónima o logueada)
    async function registrarVisita() {
        try {
            const response = await fetch('/api/visitas');
            const data = await response.json();
            
            // Si el usuario está logueado y la API devuelve sus visitas personales actualizadas
            if (data.personalVisits !== null) {
                personalVisitsCount.textContent = data.personalVisits;
            }
        } catch (error) {
            console.error('Error registrando visita:', error);
        }
    }

    // Cargar estadísticas para el admin
    async function loadAdminStats() {
        try {
            const response = await fetch('/api/admin/stats');
            
            if (!response.ok) {
                adminStatsList.innerHTML = '<div class="error-msg">Error cargando estadísticas</div>';
                return;
            }

            const stats = await response.json();
            adminStatsList.innerHTML = ''; // Limpiar lista

            if (stats.length === 0) {
                adminStatsList.innerHTML = '<div class="loading">No hay datos aún.</div>';
                return;
            }

            // Ordenar cronológicamente (ascendente) para el gráfico
            const chronoStats = [...stats].reverse();

            // --- RENDERIZAR GRÁFICO CHART.JS ---
            const canvas = document.getElementById('adminChart');
            const ctx = canvas.getContext('2d');

            // Crear degradado morado/azul para el área bajo la curva
            const gradient = ctx.createLinearGradient(0, 0, 0, 250);
            gradient.addColorStop(0, 'rgba(139, 92, 246, 0.5)');
            gradient.addColorStop(1, 'rgba(139, 92, 246, 0.0)');

            // Si ya hay un gráfico previo, destruirlo antes de crear uno nuevo
            if (adminChartInstance) {
                adminChartInstance.destroy();
            }

            adminChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chronoStats.map(s => s.date),
                    datasets: [{
                        label: 'Visitas',
                        data: chronoStats.map(s => s.count),
                        fill: true,
                        backgroundColor: gradient,
                        borderColor: 'rgba(139, 92, 246, 1)',
                        borderWidth: 2.5,
                        pointBackgroundColor: '#8b5cf6',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                        pointHoverBackgroundColor: '#a78bfa',
                        tension: 0.4,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 1000,
                        easing: 'easeInOutQuart'
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1,
                            titleColor: '#94a3b8',
                            bodyColor: '#f8fafc',
                            bodyFont: { family: 'Inter', size: 14, weight: '600' },
                            padding: 12,
                            displayColors: false,
                            callbacks: {
                                label: (ctx) => ` ${ctx.parsed.y} visitas`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } }
                        },
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: '#64748b', font: { family: 'Inter', size: 11 }, stepSize: 1 }
                        }
                    }
                }
            });

            // --- RENDERIZAR LISTA DETALLADA ABAJO DEL GRÁFICO ---
            stats.forEach(stat => {
                const item = document.createElement('div');
                item.className = 'admin-stat-item fade-in';
                
                const dateSpan = document.createElement('span');
                dateSpan.className = 'admin-stat-date';
                dateSpan.textContent = stat.date;

                const countSpan = document.createElement('span');
                countSpan.className = 'admin-stat-count';
                countSpan.textContent = stat.count;

                item.appendChild(dateSpan);
                item.appendChild(countSpan);
                adminStatsList.appendChild(item);
            });

        } catch (error) {
            console.error('Error cargando stats de admin:', error);
            adminStatsList.innerHTML = '<div class="error-msg">Error de conexión</div>';
        }
    }

    // --- LÓGICA DEL BOTÓN OJO DE CONTRASEÑA ---
    const eyeOpenPaths = [
        { tag: 'path', d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' },
        { tag: 'circle', cx: '12', cy: '12', r: '3' }
    ];
    const eyeClosedPaths = [
        { tag: 'path', d: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19' },
        { tag: 'path', d: 'M1 1l22 22' }
    ];
    let passwordVisible = false;

    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', () => {
            const passwordInput = document.getElementById('password');
            passwordVisible = !passwordVisible;
            passwordInput.type = passwordVisible ? 'text' : 'password';

            // Limpiar el SVG y redibujar los paths correctos
            eyeIcon.innerHTML = '';
            const paths = passwordVisible ? eyeClosedPaths : eyeOpenPaths;
            paths.forEach(p => {
                const el = document.createElementNS('http://www.w3.org/2000/svg', p.tag);
                if (p.d) el.setAttribute('d', p.d);
                if (p.cx) el.setAttribute('cx', p.cx);
                if (p.cy) el.setAttribute('cy', p.cy);
                if (p.r) el.setAttribute('r', p.r);
                eyeIcon.appendChild(el);
            });

            togglePasswordBtn.setAttribute('aria-label', passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña');
        });
    }

    // --- LÓGICA DE MEDIDOR DE FORTALEZA DE CONTRASEÑA ---
    const passwordInput = document.getElementById('password');

    passwordInput.addEventListener('input', () => {
        if (currentMode !== 'register') {
            strengthMeter.classList.add('hidden');
            return;
        }

        const val = passwordInput.value;
        if (!val) {
            strengthMeter.classList.add('hidden');
            return;
        }

        strengthMeter.classList.remove('hidden');
        updatePasswordStrength(val);
    });

    function updatePasswordStrength(password) {
        const result = analyzePasswordStrength(password);
        
        strengthBar.className = 'strength-bar ' + result.scoreClass;
        strengthBar.style.width = result.percent + '%';
        
        strengthText.textContent = 'Fortaleza: ' + result.label;
        strengthText.className = 'strength-text ' + result.scoreClass + '-text';
    }

    function analyzePasswordStrength(password) {
        let score = 0;
        
        if (password.length >= 6) score += 1;
        if (password.length >= 10) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/[0-9]/.test(password)) score += 1;
        if (/[^A-Za-z0-9]/.test(password)) score += 1;

        let percent = 0;
        let label = 'Muy débil';
        let scoreClass = 'weak';

        if (password.length < 4) {
            percent = 10;
            label = 'Muy débil';
            scoreClass = 'weak';
        } else if (score <= 1) {
            percent = 25;
            label = 'Débil';
            scoreClass = 'weak';
        } else if (score === 2) {
            percent = 50;
            label = 'Aceptable';
            scoreClass = 'fair';
        } else if (score === 3) {
            percent = 70;
            label = 'Buena';
            scoreClass = 'good';
        } else if (score === 4) {
            percent = 85;
            label = 'Fuerte';
            scoreClass = 'strong';
        } else if (score >= 5) {
            percent = 100;
            label = 'Excelente';
            scoreClass = 'excellent';
        }

        return { percent, label, scoreClass };
    }
});
