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

    // Toast Container
    const toastContainer = document.getElementById('toast-container');

    // Estado local
    let currentMode = 'login'; // 'login' o 'register'

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
            adminStatsList.innerHTML = ''; // Limpiar

            if (stats.length === 0) {
                adminStatsList.innerHTML = '<div class="loading">No hay datos aún.</div>';
                return;
            }

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
