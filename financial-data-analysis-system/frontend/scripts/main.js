document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('financial-record-form');
    const resultSection = document.getElementById('results');
    const API_BASE_URL = 'http://localhost:5000/api';
    const AUTH_BASE_URL = 'http://localhost:5000/api/auth';

    let currentFilter = 'monthly';
    let chartInstance = null;
    let isAuthenticated = false;
    let currentUsername = '';
    
    let allTransactions = []; 

    initializeForm();
    initializeAuthForms();
    initializeAuthButtons();
    checkAuthStatus();
    initializeNavigation();
    initializeTimeFilters();
    initializeSearch();

    setInterval(loadData, 5000);

    form.addEventListener('submit', function(event) {
        event.preventDefault();
        const formData = new FormData(form);
        const data = {
            date: formData.get('date'),
            category: formData.get('category'),
            amount: parseFloat(formData.get('amount')),
            type: formData.get('type'),
            description: formData.get('description')
        };
        fetch(`${API_BASE_URL}/finance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadData(); 
                form.reset();
                document.getElementById('date').value = new Date().toISOString().split('T')[0];
                showMessage('Запис успішно доданий!', 'success');
            } else {
                alert('Error adding record: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
    });

    function initializeNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                const section = this.getAttribute('data-section');
                const isProtectedRoute = document.getElementById(section)?.classList.contains('protected-route');
                
                if (isProtectedRoute && !isAuthenticated) {
                    showSection(section);
                } else {
                    showSection(section);
                    navItems.forEach(nav => nav.classList.remove('active'));
                    this.classList.add('active');
                }
            });
        });
    }

    function showSection(sectionId) {
        const sections = document.querySelectorAll('.section');
        sections.forEach(section => section.classList.remove('active'));
        
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            const isProtectedRoute = targetSection.classList.contains('protected-route');
            if (isProtectedRoute && !isAuthenticated) {
                showMessage('Будь ласка, увійдіть, щоб отримати доступ до цієї сторінки.', 'error', 'login-message');
                document.getElementById('login').classList.add('active'); 
                document.querySelectorAll('.nav-menu .nav-item').forEach(nav => nav.classList.remove('active'));
                const loginHeaderBtn = document.getElementById('login-btn');
                if (loginHeaderBtn) {
                    document.getElementById('register-btn')?.classList.remove('active');
                    document.getElementById('login-btn')?.classList.add('active');
                }
                return;
            }

            targetSection.classList.add('active');
            
            if ((sectionId === 'dashboard' || sectionId === 'analytics') && isAuthenticated) { 
                loadData(); 
            } else if (sectionId === 'dashboard' && !isAuthenticated) {
                displayMetrics({ total_income: 0, total_expenses: 0, profit: 0, profit_margin: 0, expense_ratio: 0, record_count: 0 });
                displayRecords([]);
                renderChart({ labels: [], incomeData: [], expenseData: [] });
            }
        }
    }

    function updateUIForAuthStatus(loggedIn, username = '') {
        isAuthenticated = loggedIn;
        currentUsername = username;

        const registerBtn = document.getElementById('register-btn');
        const loginBtn = document.getElementById('login-btn');
        const userInfoDisplay = document.getElementById('user-info-display');
        const displayUsernameEl = document.getElementById('display-username');
        const userAvatarEl = userInfoDisplay ? userInfoDisplay.querySelector('.user-avatar') : null;
        const protectedRouteSections = document.querySelectorAll('.protected-route');
        const protectedRouteNavItems = document.querySelectorAll('.protected-route-nav');
        const navItems = document.querySelectorAll('.nav-item'); 

        if (loggedIn) {
            registerBtn?.classList.add('hidden');
            loginBtn?.classList.add('hidden');
            userInfoDisplay?.classList.remove('hidden');
            if (displayUsernameEl) displayUsernameEl.textContent = username;
            if (userAvatarEl) userAvatarEl.textContent = username.substring(0, 2).toUpperCase();

            protectedRouteSections.forEach(section => section.classList.remove('hidden')); 
            protectedRouteNavItems.forEach(nav => nav.classList.remove('hidden')); 

            if (document.getElementById('login')?.classList.contains('active') || document.getElementById('register')?.classList.contains('active')) {
                document.getElementById('login')?.classList.remove('active');
                document.getElementById('register')?.classList.remove('active');
                showSection('dashboard');
                navItems.forEach(nav => nav.classList.remove('active'));
                document.querySelector('.nav-item[data-section="dashboard"]')?.classList.add('active'); 
            } else {
                 loadData();
            }
        } else {
            registerBtn?.classList.remove('hidden');
            loginBtn?.classList.remove('hidden');
            userInfoDisplay?.classList.add('hidden');
            if (userAvatarEl) userAvatarEl.textContent = '';
            
            protectedRouteSections.forEach(section => section.classList.add('hidden'));
            protectedRouteNavItems.forEach(nav => nav.classList.add('hidden'));

            if (document.getElementById('add-record')?.classList.contains('active') || document.getElementById('analytics')?.classList.contains('active')) {
                 showSection('dashboard');
                 navItems.forEach(nav => nav.classList.remove('active'));
                 document.querySelector('.nav-item[data-section="dashboard"]')?.classList.add('active');
            }
            displayMetrics({ total_income: 0, total_expenses: 0, profit: 0, profit_margin: 0, expense_ratio: 0, record_count: 0 });
            displayRecords([]);
            renderChart({ labels: [], incomeData: [], expenseData: [] });
        }
    }

    async function checkAuthStatus() {
        try {
            const response = await fetch(`${AUTH_BASE_URL}/status`, { credentials: 'include' });
            if (!response.ok) throw new Error(`HTTP статус: ${response.status}`);
            const data = await response.json();
            updateUIForAuthStatus(data.isAuthenticated, data.username);
        } catch (error) {
            console.error('Помилка перевірки статусу авторизації:', error);
            updateUIForAuthStatus(false);
        }
    }

    function initializeAuthForms() {
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                const username = document.getElementById('register-username').value;
                const password = document.getElementById('register-password').value;
                await handleAuthSubmit(`${AUTH_BASE_URL}/register`, { username, password }, 'register-message');
            });
        }
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                const username = document.getElementById('login-username').value;
                const password = document.getElementById('login-password').value;
                await handleAuthSubmit(`${AUTH_BASE_URL}/login`, { username, password }, 'login-message');
            });
        }
    }

    async function handleAuthSubmit(url, data, messageElementId) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include' 
            });
            const responseData = await response.json();
            if (!response.ok) throw new Error(responseData.error || 'Помилка авторизації');

            showMessage(responseData.message, 'success', messageElementId);
            document.getElementById(messageElementId.replace('-message', '-form'))?.reset();
            await checkAuthStatus();
        } catch (error) {
            console.error('Помилка:', error);
            showMessage(error.message, 'error', messageElementId);
        }
    }

    function initializeAuthButtons() {
        document.getElementById('login-btn')?.addEventListener('click', function() {
            showSection('login');
            document.querySelectorAll('.nav-menu .nav-item').forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
        });
        document.getElementById('register-btn')?.addEventListener('click', function() {
            showSection('register');
            document.querySelectorAll('.nav-menu .nav-item').forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
        });
        document.getElementById('logout-btn')?.addEventListener('click', async function() {
            try {
                const response = await fetch(`${AUTH_BASE_URL}/logout`, { method: 'POST', credentials: 'include' });
                const data = await response.json();
                if (response.ok) {
                    showMessage(data.message, 'success');
                    updateUIForAuthStatus(false);
                    showSection('dashboard');
                    document.querySelectorAll('.nav-menu .nav-item').forEach(nav => nav.classList.remove('active'));
                    document.querySelector('.nav-item[data-section="dashboard"]')?.classList.add('active');
                } else {
                    throw new Error(data.error || 'Помилка виходу');
                }
            } catch (error) {
                console.error('Помилка виходу:', error);
                showMessage(error.message, 'error');
            }
        });
        document.getElementById('delete-account-btn')?.addEventListener('click', async function() {
            if (confirm('Ви впевнені, що хочете видалити свій обліковий запис?')) {
                try {
                    const response = await fetch(`${AUTH_BASE_URL}/delete_account`, { method: 'DELETE', credentials: 'include' });
                    const data = await response.json();
                    if (response.ok) {
                        showMessage(data.message, 'success');
                        updateUIForAuthStatus(false);
                        showSection('register'); 
                        document.querySelectorAll('.nav-menu .nav-item').forEach(nav => nav.classList.remove('active'));
                        document.getElementById('register-btn')?.classList.add('active'); 
                    } else {
                        throw new Error(data.error || 'Помилка видалення облікового запису');
                    }
                } catch (error) {
                    console.error('Помилка видалення облікового запису:', error);
                    showMessage(error.message, 'error');
                }
            }
        });
    }

    function showMessage(text, type, elementId = 'form-message') {
        const messageEl = document.getElementById(elementId);
        if (!messageEl) return;
        messageEl.textContent = text;
        messageEl.className = `form-message show ${type}`;
        setTimeout(() => { messageEl.classList.remove('show'); }, 4000);
    }

    function initializeForm() {
        const form = document.getElementById('financial-record-form');
        if (!form) return;
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('date');
        if (dateInput) dateInput.value = today;
    }

    function initializeTimeFilters() {
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                const filter = this.getAttribute('data-filter');
                filterButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                currentFilter = filter;
                loadData();
            });
        });
    }

    function initializeSearch() {
        const searchInput = document.getElementById('search-input');
        if (!searchInput) return;

        searchInput.addEventListener('input', function() {
            filterRecords();
        });
    }

    function filterRecords() {
        const searchInput = document.getElementById('search-input');
        if (!searchInput) return;

        const query = searchInput.value.toLowerCase().trim();

        if (!query || !allTransactions.length) {
            displayRecords(allTransactions);
            return;
        }

        const filtered = allTransactions.filter(record => {
            const matchCategory = record.category.toLowerCase().includes(query);
            const matchDescription = record.description && record.description.toLowerCase().includes(query);
            const matchAmount = record.amount.toString().includes(query);
            return matchCategory || matchDescription || matchAmount;
        });

        displayRecords(filtered);
    }

    async function loadData() {
        if (!isAuthenticated) return;
        try {
            const [records, metrics, chartData] = await Promise.all([
                getFinancialRecords(),
                getFinancialMetrics(),
                getChartData(currentFilter)
            ]);

            allTransactions = records;

            displayMetrics(metrics);
            
            filterRecords(); 
            
            renderChart(chartData);
        } catch (error) {
            console.error('Помилка при завантаженні даних:', error);
            if (error.message.includes('401')) {
                showMessage('Ваша сесія закінчилася. Будь ласка, увійдіть знову.', 'error');
                updateUIForAuthStatus(false);
                showSection('login');
            }
        }
    }

    async function getFinancialRecords() {
        try {
            let url = `${API_BASE_URL}/finance`;
            if (currentFilter !== 'all') url += `?filter=${currentFilter}`;
            const response = await fetch(url, { credentials: 'include' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Помилка при отриманні записів:', error);
            throw error;
        }
    }

    async function getFinancialMetrics() {
        try {
            let url = `${API_BASE_URL}/metrics`;
            if (currentFilter !== 'all') url += `?filter=${currentFilter}`;
            const response = await fetch(url, { credentials: 'include' }); 
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Помилка при отриманні показників:', error);
            throw error; 
        }
    }

    async function getChartData(filterType) {
        try {
            const response = await fetch(`${API_BASE_URL}/chart_data?filter=${filterType}`, { credentials: 'include' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Помилка при отриманні даних для графіка:', error);
            throw error; 
        }
    }

    function renderChart(chartData) {
        const ctx = document.getElementById('income-expense-chart-canvas');
        if (!ctx) return;
        if (chartInstance) chartInstance.destroy(); 

        const data = {
            labels: chartData.labels,
            datasets: [
                {
                    label: 'Дохід',
                    data: chartData.incomeData,
                    borderColor: '#10b981', 
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#fff',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                },
                {
                    label: 'Видатки',
                    data: chartData.expenseData,
                    borderColor: '#ef4444', 
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: '#ef4444',
                    pointBorderColor: '#fff',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                }
            ]
        };

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#cbd5e1' } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) label += new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                            return label;
                        }
                    },
                    titleColor: '#f1f5f9',
                    bodyColor: '#cbd5e1',
                    backgroundColor: '#1e293b', 
                    borderColor: '#334155', 
                    borderWidth: 1,
                }
            },
            scales: {
                x: {
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(51, 65, 85, 0.5)' }
                },
                y: {
                    ticks: {
                        color: '#94a3b8', 
                        callback: function(value) {
                            return new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
                        }
                    },
                    grid: { color: 'rgba(51, 65, 85, 0.5)' }
                }
            }
        };

        chartInstance = new Chart(ctx, { type: 'line', data: data, options: options });
    }

    function displayMetrics(metrics) {
        if (!metrics) return;
        document.getElementById('revenue-value').textContent = `$${(metrics.total_income || 0).toFixed(2)}`;
        document.getElementById('expenses-value').textContent = `$${(metrics.total_expenses || 0).toFixed(2)}`;
        document.getElementById('profit-value').textContent = `$${(metrics.profit || 0).toFixed(2)}`;
        document.getElementById('margin-value').textContent = `${(metrics.profit_margin || 0).toFixed(2)}%`;
        document.getElementById('expense-ratio').textContent = `${(metrics.expense_ratio || 0).toFixed(2)}%`;
        document.getElementById('records-count').textContent = metrics.record_count || 0;
    }

    function displayRecords(records) {
        const container = document.getElementById('records-container');
        if (!container) return;
    
        if (!records || records.length === 0) {
            container.innerHTML = '<div class="loading">Записи не знайдені.</div>';
            return;
        }
    
        const sortedRecords = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));
    
        const html = sortedRecords.map(record => {
            const typeClass = record.type === 'income' ? 'income' : 'expense';
            const sign = record.type === 'income' ? '+' : '-';
            const typeLabel = record.type === 'income' ? 'ДОХІД' : 'ВИДАТКИ';
            const recordId = record.id || record._id;
    
            return `
                <div class="record" data-id="${recordId}">
                    <div class="record-header">
                        <span class="record-type ${typeClass}">${typeLabel}</span>
                        
                        <div class="record-actions">
                            <button class="action-btn edit-btn" data-id="${recordId}" title="Редагувати">
                                &#9998;
                            </button>
                            <button class="action-btn delete-btn" data-id="${recordId}" title="Видалити">
                                &#10005;
                            </button>
                        </div>

                    </div>
                    <div class="record-amount ${typeClass}">${sign}$${record.amount.toFixed(2)}</div>
                    <div class="record-info">
                        <p><strong>Категорія:</strong> ${record.category}</p>
                        <p><strong>Дата:</strong> ${record.date}</p>
                        ${record.description ? `<p><strong>Опис:</strong> ${record.description}</p>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    
        container.innerHTML = html;
    
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = e.currentTarget.dataset.id;
                if (!id) return;
                
                if (confirm('Ви дійсно хочете видалити цей запис?')) {
                    await deleteRecord(id);
                }
            });
        });
    
        container.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.currentTarget.dataset.id;
                
                const record = allTransactions.find(r => {
                    const rId = String(r.id || r._id);
                    return rId === String(id);
                });
                
                if(record) {
                    openEditModal(record);
                } else {
                    console.error("Запис не знайдено для редагування, ID:", id);
                }
            });
        });
    }

    async function deleteRecord(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/finance/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Не вдалося видалити запис');
            }
            showMessage('Запис видалено', 'success');
            await loadData();
        } catch (error) {
            console.error('Помилка видалення:', error);
            alert('Помилка при видаленні: ' + error.message);
        }
    }

    function openEditModal(record) {
        const existingModal = document.getElementById('edit-modal-backdrop');
        if (existingModal) existingModal.remove();

        const recordId = record.id || record._id;

        const modalHtml = `
            <div id="edit-modal-backdrop" style="position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:1000;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;">
                <div id="edit-modal" style="background:#1e293b; color:white; padding:24px;width:90%;max-width:400px;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.4);position:relative;">
                    <h3 style="margin-top:0;margin-bottom:20px;">Редагування запису</h3>
                    <form id="edit-record-form" style="display:flex;flex-direction:column;gap:10px;">
                        <label>Дата: <input type="date" name="date" value="${record.date}" required style="width:100%;padding:8px;border-radius:4px;border:1px solid #334155;background:#0f172a;color:white;"></label>
                        <label>Категорія: <input type="text" name="category" value="${record.category}" required style="width:100%;padding:8px;border-radius:4px;border:1px solid #334155;background:#0f172a;color:white;"></label>
                        <label>Сума: <input type="number" step="0.01" name="amount" value="${record.amount}" required style="width:100%;padding:8px;border-radius:4px;border:1px solid #334155;background:#0f172a;color:white;"></label>
                        <label>Тип:
                            <select name="type" style="width:100%;padding:8px;border-radius:4px;border:1px solid #334155;background:#0f172a;color:white;">
                                <option value="income" ${record.type === 'income' ? 'selected' : ''}>Дохід</option>
                                <option value="expense" ${record.type === 'expense' ? 'selected' : ''}>Видатки</option>
                            </select>
                        </label>
                        <label>Опис: <input type="text" name="description" value="${record.description || ''}" style="width:100%;padding:8px;border-radius:4px;border:1px solid #334155;background:#0f172a;color:white;"></label>
                        <div style="display:flex;gap:10px;margin-top:10px;">
                            <button type="submit" style="flex:1;padding:10px;background:#10b981;color:white;border:none;border-radius:4px;cursor:pointer;">Зберегти</button>
                            <button type="button" id="close-modal-btn" style="flex:1;padding:10px;background:#64748b;color:white;border:none;border-radius:4px;cursor:pointer;">Скасувати</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('close-modal-btn').onclick = closeEditModal;
        document.getElementById('edit-modal-backdrop').onclick = function(e) {
            if (e.target.id === 'edit-modal-backdrop') closeEditModal();
        };

        document.getElementById('edit-record-form').onsubmit = async function(e) {
            e.preventDefault();
            const formData = new FormData(e.target);
            const updatedRecord = {
                date: formData.get('date'),
                category: formData.get('category'),
                amount: parseFloat(formData.get('amount')),
                type: formData.get('type'),
                description: formData.get('description')
            };

            await updateRecord(recordId, updatedRecord);
            closeEditModal();
        };
    }

    function closeEditModal() {
        const backdrop = document.getElementById('edit-modal-backdrop');
        if (backdrop) backdrop.remove();
    }

    async function updateRecord(id, data) {
        try {
            const response = await fetch(`${API_BASE_URL}/finance/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                 const errData = await response.json();
                throw new Error(errData.message || 'Не вдалося оновити запис');
            }
            showMessage('Запис оновлено', 'success');
            await loadData();
        } catch (error) {
            console.error('Помилка оновлення:', error);
            alert('Помилка при оновленні: ' + error.message);
        }
    }
});