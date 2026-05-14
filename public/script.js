document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const authSection = document.getElementById('auth-section');
    const userSection = document.getElementById('user-section');
    const adminSection = document.getElementById('admin-section');
    
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const authForm = document.getElementById('auth-form');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authError = document.getElementById('auth-error');
    
    const logoutBtn = document.getElementById('logout-btn');
    const userNameDisplay = document.getElementById('user-name-display');
    const personalVisitsCount = document.getElementById('personal-visits-count');
    const adminStatsList = document.getElementById('admin-stats-list');

    let currentMode = 'login'; // 'login' or 'register'

    // --- INIT ---
    checkAuth();

    // --- EVENT LISTENERS ---
    
    // Tab Switching
    tabLogin.addEventListener('click', () => {
        currentMode = 'login';
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        authSubmitBtn.textContent = 'Entrar';
        authError.classList.add('hidden');
    });

    tabRegister.addEventListener('click', () => {
        currentMode = 'register';
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        authSubmitBtn.textContent = 'Crear Cuenta';
        authError.classList.add('hidden');
    });

    // Form Submit (Login / Register)
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = authForm.username.value;
        const password = authForm.password.value;
        const endpoint = currentMode === 'login' ? '/api/login' : '/api/register';
        
        try {
            authSubmitBtn.disabled = true;
            authSubmitBtn.textContent = 'Cargando...';
            authError.classList.add('hidden');

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error || 'Error en la petición');
            }

            if (currentMode === 'register') {
                // If registered successfully, switch to login
                tabLogin.click();
                authForm.username.value = username;
                authForm.password.value = '';
                showError('Registro exitoso, ahora puedes iniciar sesión.', true);
            } else {
                // If logged in successfully, reload UI
                authForm.reset();
                checkAuth();
            }

        } catch (error) {
            showError(error.message);
        } finally {
            authSubmitBtn.disabled = false;
            authSubmitBtn.textContent = currentMode === 'login' ? 'Entrar' : 'Crear Cuenta';
        }
    });

    // Logout
    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
            // Reset UI
            authSection.classList.remove('hidden');
            userSection.classList.add('hidden');
            adminSection.classList.add('hidden');
            logoutBtn.classList.add('hidden');
            // Trigger an anonymous visit to keep global counter ticking
            fetch('/api/visitas');
        } catch (e) {
            console.error('Error cerrando sesión', e);
        }
    });

    // --- CORE FUNCTIONS ---

    function showError(msg, isSuccess = false) {
        authError.textContent = msg;
        authError.classList.remove('hidden');
        authError.style.backgroundColor = isSuccess ? '#e8f5e9' : '#fcebeb';
        authError.style.color = isSuccess ? '#2e7d32' : '#dc3545';
    }

    async function checkAuth() {
        try {
            const res = await fetch('/api/me');
            const user = await res.json();

            if (user.loggedIn) {
                // Show User UI
                authSection.classList.add('hidden');
                userSection.classList.remove('hidden');
                logoutBtn.classList.remove('hidden');
                userNameDisplay.textContent = user.username;
                
                // Track visit as user
                trackVisit();

                // Load Admin Panel if admin
                if (user.role === 'admin') {
                    adminSection.classList.remove('hidden');
                    loadAdminStats();
                } else {
                    adminSection.classList.add('hidden');
                }
            } else {
                // Show Auth UI
                authSection.classList.remove('hidden');
                userSection.classList.add('hidden');
                adminSection.classList.add('hidden');
                logoutBtn.classList.add('hidden');
                
                // Track visit as anonymous
                fetch('/api/visitas');
            }
        } catch (error) {
            console.error('Auth check error', error);
        }
    }

    async function trackVisit() {
        try {
            const res = await fetch('/api/visitas');
            const data = await res.json();
            
            if (data.personalVisits !== null) {
                // Animate counter
                personalVisitsCount.style.opacity = '0';
                setTimeout(() => {
                    personalVisitsCount.textContent = data.personalVisits;
                    personalVisitsCount.style.opacity = '1';
                }, 300);
            }
        } catch (error) {
            console.error('Error registrando visita', error);
        }
    }

    async function loadAdminStats() {
        try {
            const res = await fetch('/api/admin/stats');
            const stats = await res.json();
            
            adminStatsList.innerHTML = ''; // clear loading
            
            if (stats.length === 0) {
                adminStatsList.innerHTML = '<p class="subtitle">No hay estadísticas disponibles aún.</p>';
                return;
            }

            stats.forEach(stat => {
                const row = document.createElement('div');
                row.className = 'admin-stat-item';
                
                // Format date nicely
                const dateObj = new Date(stat.date);
                const dateString = dateObj.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                
                row.innerHTML = `
                    <span class="admin-stat-date">${dateString}</span>
                    <span class="admin-stat-count">${stat.count} <span style="font-size: 0.8rem; font-weight: normal; color: var(--color-text-muted);">visitas</span></span>
                `;
                adminStatsList.appendChild(row);
            });
        } catch (error) {
            adminStatsList.innerHTML = '<div class="error-msg">Error cargando estadísticas.</div>';
        }
    }
});
