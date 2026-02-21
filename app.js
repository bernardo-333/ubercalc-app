// CONFIGURAÇÕES BASE E BANCO DE DADOS (LOCALSTORAGE)
const defaultConfig = { savingsPercentage: 10, totalVehicleKm: 0, theme: 'light', alertKm: 500 };
let appData = { records: [], maintenance: [], config: { ...defaultConfig } };

document.addEventListener('DOMContentLoaded', () => { initApp(); });

// HELPER FIX TIMEZONE
function getLocalTodayISO() {
    const d = new Date();
    const z = n => n < 10 ? '0' + n : n;
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function initApp() {
    loadData();
    document.getElementById('input-date').value = getLocalTodayISO();
    applyTheme();
    loadTodayData();
    calculateVirtualReserve();
}

function loadData() {
    const saved = localStorage.getItem('ubercalc_v3');
    if (saved) {
        const parsed = JSON.parse(saved);
        appData = { records: parsed.records || [], maintenance: parsed.maintenance || [], config: { ...defaultConfig, ...(parsed.config || {}) } };
    }
}

function saveData() { localStorage.setItem('ubercalc_v3', JSON.stringify(appData)); }

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast ' + type + ' show';
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// FUNÇÕES DE UI E NAVEGAÇÃO
function showTab(tabName, title, element) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    if (element) element.classList.add('active');
    if (title) document.getElementById('header-title').innerText = title;

    if (tabName === 'hoje') loadTodayData();
    if (tabName === 'historico') loadHistoryTabs();
    if (tabName === 'manutencao') loadMaintenance();
    if (tabName === 'config') loadSettings();
}

function applyTheme() {
    const theme = appData.config.theme || 'light';
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');

    document.querySelectorAll('.theme-option').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.check-icon').forEach(el => el.style.display = 'none');
    const opt = document.getElementById('theme-' + theme);
    if (opt) { opt.classList.add('active'); document.getElementById('check-' + theme).style.display = 'block'; }
}

function setTheme(t) { appData.config.theme = t; applyTheme(); saveData(); }

// MÁSCARAS E FORMATAÇÃO
const fMoney = (v) => 'R$ ' + (parseFloat(v) || 0).toFixed(2).replace('.', ',');
const fNum = (v) => (parseFloat(v) || 0).toLocaleString('pt-BR');
const fDate = (d) => { const p = d.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }

// CALCULAR RESERVA GLOBAL
function getVirtualReserveTotal() {
    let guardado = appData.records.reduce((sum, r) => {
        // Se for registro antigo (undefined) ou se for um registro novo que já foi guardado (true), então acumula o valor na reserva.
        if (r.profit > 0 && r.saved_to_reserve !== false) {
            return sum + (r.profit * (appData.config.savingsPercentage / 100));
        }
        return sum;
    }, 0);
    let totalGastoManut = appData.maintenance.reduce((sum, m) => sum + (m.isCompleted ? (m.cost || 0) : 0), 0);
    return guardado - totalGastoManut;
}

function calculateVirtualReserve() {
    let saldo = getVirtualReserveTotal();
    const el = document.getElementById('reserva-total');
    if (el) {
        el.textContent = fMoney(saldo);
        el.className = 'card-value ' + (saldo >= 0 ? 'text-primary' : 'text-danger');
    }
}

// LÓGICA DA ABA: HOJE
function loadTodayData() {
    const today = getLocalTodayISO();
    const record = appData.records.find(r => r.date === today);

    if (record) {
        document.getElementById('today-km').textContent = fNum(record.km) + ' km';
        document.getElementById('today-income').textContent = fMoney(record.total_income);
        document.getElementById('today-expenses').textContent = fMoney(record.total_expenses);
        document.getElementById('today-profit').textContent = fMoney(record.profit);

        const savingsAmount = record.profit * (appData.config.savingsPercentage / 100);
        if (savingsAmount > 0) {
            if (record.saved_to_reserve) {
                document.getElementById('savings-card').style.display = 'none';
                document.getElementById('savings-done-card').style.display = 'block';
                document.getElementById('savings-done-amount').textContent = fMoney(savingsAmount);
            } else {
                document.getElementById('savings-card').style.display = 'block';
                document.getElementById('savings-done-card').style.display = 'none';
                document.getElementById('savings-amount-display').textContent = fMoney(savingsAmount);
                document.getElementById('savings-percent-display').textContent = appData.config.savingsPercentage;
            }
        } else {
            document.getElementById('savings-card').style.display = 'none';
            document.getElementById('savings-done-card').style.display = 'none';
        }
    } else {
        document.getElementById('today-km').textContent = '0 km';
        document.getElementById('today-income').textContent = 'R$ 0,00';
        document.getElementById('today-expenses').textContent = 'R$ 0,00';
        document.getElementById('today-profit').textContent = 'R$ 0,00';
        document.getElementById('savings-card').style.display = 'none';
        document.getElementById('savings-done-card').style.display = 'none';
    }
    calculateVirtualReserve();
}

function salvarRegistro(e) {
    e.preventDefault();
    const date = document.getElementById('input-date').value;
    const km = parseFloat(document.getElementById('input-km').value) || 0;
    const uber = parseFloat(document.getElementById('input-uber').value) || 0;
    const n99 = parseFloat(document.getElementById('input-99').value) || 0;
    const otherIncome = parseFloat(document.getElementById('input-other-income').value) || 0;
    const fuel = parseFloat(document.getElementById('input-fuel').value) || 0;
    const otherExpense = parseFloat(document.getElementById('input-other-expense').value) || 0;

    const totalIncome = uber + n99 + otherIncome;
    const totalExpenses = fuel + otherExpense;

    const idx = appData.records.findIndex(r => r.date === date);
    let savedReserveFlag = false; // Sempre zera a flag ao atualizar, para garantir que confirme o novo valor

    const record = { date, km, uber, n99, other_income: otherIncome, fuel, other_expense: otherExpense, total_income: totalIncome, total_expenses: totalExpenses, profit: totalIncome - totalExpenses, saved_to_reserve: savedReserveFlag };

    if (idx >= 0) { appData.records[idx] = record; showToast('Registro atualizado!'); }
    else { appData.records.push(record); showToast('Salvo com sucesso!'); }

    if (km > 0 && appData.records.length > 0) {
        // Atualiza o painel mestre somando os KMs lançados, se quiser lógica incremental. 
        // Para ficar fiel ao print, ele lança KM do dia.
        appData.config.totalVehicleKm += km;
    }

    saveData();
    loadTodayData();

    // Limpa form exceto data
    ['input-km', 'input-uber', 'input-99', 'input-other-income', 'input-fuel', 'input-other-expense'].forEach(id => document.getElementById(id).value = '');
}

function markAsSavedToday() {
    const today = getLocalTodayISO();
    const idx = appData.records.findIndex(r => r.date === today);
    if (idx >= 0) {
        appData.records[idx].saved_to_reserve = true;
        saveData();
        loadTodayData();
        showToast('Valor adicionado à reserva virtual!', 'success');
    }
}

// LÓGICA DA ABA: HISTÓRICO E RELATÓRIOS (MESCLADA)
function showHistory(type, el) {
    document.querySelectorAll('.segment').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('#tab-historico .report-section').forEach(s => s.classList.remove('active'));
    document.getElementById('history-' + type).classList.add('active');
    loadHistoryTabs();
}

function loadHistoryTabs() {
    loadHistoryDiario();
    loadHistorySemanal();
    loadHistoryMensal();
    loadHistoryGeral();
}

function toggleAccordion(el) {
    const acc = el.closest('.accordion');
    acc.classList.toggle('open');
}

// --- DIÁRIO ---
function loadHistoryDiario() {
    const container = document.getElementById('history-diario-content');
    if (appData.records.length === 0) { container.innerHTML = '<p style="text-align:center; color: var(--text-gray); padding: 30px;">Nenhum registro ainda.</p>'; return; }

    const sorted = [...appData.records].sort((a, b) => new Date(b.date) - new Date(a.date));
    const today = getLocalTodayISO();

    container.innerHTML = sorted.map((r, index) => {
        const isToday = r.date === today;
        const isOpen = index === 0;
        const rPorKM = r.km > 0 ? r.profit / r.km : 0;
        const margem = r.total_income > 0 ? (r.profit / r.total_income) * 100 : 0;
        const pUber = r.total_income > 0 ? ((r.uber || 0) / r.total_income) * 100 : 0;
        const p99 = r.total_income > 0 ? ((r.n99 || 0) / r.total_income) * 100 : 0;
        const pOther = r.total_income > 0 ? ((r.other_income || 0) / r.total_income) * 100 : 0;

        return `
                <div class="accordion ${isOpen ? 'open' : ''}">
                    <div class="accordion-header" onclick="toggleAccordion(this)">
                        <div class="accordion-title">
                            <i class="fa-regular fa-calendar-days text-primary"></i>
                            <h3>${isToday ? 'Hoje (' + fDate(r.date) + ')' : fDate(r.date)}</h3>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span class="accordion-badge ${r.profit >= 0 ? 'badge-positive' : 'badge-negative'}">${fMoney(r.profit)}</span>
                            <i class="fa-solid fa-chevron-down accordion-icon"></i>
                        </div>
                    </div>
                    <div class="accordion-body">
                        <div class="accordion-content">
                            <div class="accordion-content-inner">
                                <div class="grid-2" style="margin-bottom: 16px;">
                                    <div class="metric-box">
                                        <div class="metric-label">KM Rodados</div>
                                        <div class="metric-value">${fNum(r.km)} <span style="font-size:12px; font-weight:normal; color:var(--text-gray)">km</span></div>
                                    </div>
                                    <div class="metric-box">
                                        <div class="metric-label">R$ por KM</div>
                                        <div class="metric-value text-primary">${fMoney(rPorKM)}</div>
                                    </div>
                                    <div class="metric-box">
                                        <div class="metric-label">Margem</div>
                                        <div class="metric-value text-success">${fNum(margem)}%</div>
                                    </div>
                                    <div class="metric-box">
                                        <div class="metric-label">Líquido</div>
                                        <div class="metric-value ${r.profit >= 0 ? 'text-success' : 'text-danger'}">${fMoney(r.profit)}</div>
                                    </div>
                                </div>
                                <div style="margin-bottom: 16px;">
                                    <h4 style="font-size: 13px; color: var(--text-gray); margin-bottom: 12px; text-transform: uppercase;">Receita por Plataforma</h4>
                                    <div style="margin-bottom: 8px;">
                                        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600;">
                                            <span>Uber</span><span>${fMoney(r.uber || 0)} <span style="color:var(--text-gray); font-weight:normal">(${fNum(pUber)}%)</span></span>
                                        </div>
                                        <div class="progress-bar"><div class="progress-fill" style="width: ${pUber}%; background: var(--uber);"></div></div>
                                    </div>
                                    <div style="margin-bottom: 8px;">
                                        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600;">
                                            <span>99</span><span>${fMoney(r.n99 || 0)} <span style="color:var(--text-gray); font-weight:normal">(${fNum(p99)}%)</span></span>
                                        </div>
                                        <div class="progress-bar"><div class="progress-fill" style="width: ${p99}%; background: var(--warning);"></div></div>
                                    </div>
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600;">
                                            <span>Outros</span><span>${fMoney(r.other_income || 0)} <span style="color:var(--text-gray); font-weight:normal">(${fNum(pOther)}%)</span></span>
                                        </div>
                                        <div class="progress-bar"><div class="progress-fill" style="width: ${pOther}%; background: var(--primary);"></div></div>
                                    </div>
                                </div>
                                <div style="display:flex; justify-content: space-between; align-items:center; padding-top: 12px; border-top: 1px dashed var(--border-color);">
                                    <div style="font-size: 13px;">
                                        <span class="text-success" style="font-weight:600"><i class="fa-solid fa-arrow-up"></i> ${fMoney(r.total_income)}</span>
                                        <span style="color:var(--border-color); margin: 0 6px;">|</span>
                                        <span class="text-danger" style="font-weight:600"><i class="fa-solid fa-arrow-down"></i> ${fMoney(r.total_expenses)}</span>
                                    </div>
                                    <div style="display: flex; gap: 8px;">
                                        <button class="btn btn-sm btn-outline" style="padding: 6px 12px;" onclick="loadRecordForEdit('${r.date}')"><i class="fa-solid fa-pen"></i></button>
                                        <button class="btn btn-sm" style="padding: 6px 12px; background: rgba(239, 68, 68, 0.1); color: var(--danger); border: none;" onclick="deleteRecord('${r.date}')"><i class="fa-solid fa-trash"></i></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                `;
    }).join('');
}

function loadRecordForEdit(date) {
    const r = appData.records.find(x => x.date === date);
    if (!r) return;
    document.getElementById('input-date').value = r.date;
    document.getElementById('input-km').value = r.km;
    document.getElementById('input-uber').value = r.uber || '';
    document.getElementById('input-99').value = r.n99 || '';
    document.getElementById('input-other-income').value = r.other_income || '';
    document.getElementById('input-fuel').value = r.fuel || '';
    document.getElementById('input-other-expense').value = r.other_expense || '';
    showTab('hoje', 'Editar Registro', document.querySelector('.nav-item'));
    showToast('Dados carregados', 'success');
}

function deleteRecord(date) {
    if (confirm('Tem certeza que deseja apagar o dia ' + fDate(date) + '?')) {
        appData.records = appData.records.filter(r => r.date !== date);
        saveData(); loadHistoryTabs(); calculateVirtualReserve(); showToast('Excluído');
    }
}

// --- SEMANAL ---
function getWeekKey(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);

    // Calculate start and end dates
    const simple = new Date(date.getFullYear(), 0, 1 + (weekNo - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4)
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());

    const ISOweekEnd = new Date(ISOweekStart);
    ISOweekEnd.setDate(ISOweekStart.getDate() + 6);

    return {
        key: `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`,
        start: ISOweekStart.toISOString().split('T')[0],
        end: ISOweekEnd.toISOString().split('T')[0]
    };
}

function loadHistorySemanal() {
    const container = document.getElementById('history-semanal-content');
    if (appData.records.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: var(--text-gray); padding: 30px;">Nenhum registro encontrado.</p>';
        return;
    }

    const weeks = {};
    appData.records.forEach(r => {
        const d = new Date(r.date);
        // Fix timezone issue when parsing "YYYY-MM-DD"
        const localDate = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
        const wInfo = getWeekKey(localDate);
        const weekKey = wInfo.key;

        if (!weeks[weekKey]) weeks[weekKey] = { label: `${fDate(wInfo.start).substring(0, 5)} até ${fDate(wInfo.end).substring(0, 5)}`, records: [], km: 0, income: 0, expenses: 0, uber: 0, n99: 0, other: 0 };
        weeks[weekKey].records.push(r);
        weeks[weekKey].km += r.km;
        weeks[weekKey].income += r.total_income;
        weeks[weekKey].expenses += r.total_expenses;
        weeks[weekKey].uber += r.uber || 0;
        weeks[weekKey].n99 += r.n99 || 0;
        weeks[weekKey].other += r.other_income || 0;
    });

    const sortedWeeks = Object.keys(weeks).sort().reverse();

    container.innerHTML = sortedWeeks.map((weekKey, index) => {
        const w = weeks[weekKey];
        const profit = w.income - w.expenses;
        const rPorKM = w.km > 0 ? profit / w.km : 0;
        const margem = w.income > 0 ? (profit / w.income) * 100 : 0;
        const avgPerDay = w.records.length > 0 ? profit / w.records.length : 0;
        const pUber = w.income > 0 ? (w.uber / w.income) * 100 : 0;
        const p99 = w.income > 0 ? (w.n99 / w.income) * 100 : 0;
        const pOther = w.income > 0 ? (w.other / w.income) * 100 : 0;

        return `
                <div class="accordion ${index === 0 ? 'open' : ''}">
                    <div class="accordion-header" onclick="toggleAccordion(this)">
                        <div class="accordion-title">
                            <i class="fa-solid fa-calendar-week text-primary"></i>
                            <h3>${w.label}</h3>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span class="accordion-badge ${profit >= 0 ? 'badge-positive' : 'badge-negative'}">${fMoney(profit)}</span>
                            <i class="fa-solid fa-chevron-down accordion-icon"></i>
                        </div>
                    </div>
                    <div class="accordion-body">
                        <div class="accordion-content">
                            <div class="accordion-content-inner">
                                <div class="grid-2" style="margin-bottom: 16px;">
                                    <div class="metric-box">
                                        <div class="metric-label">Dias Trabalhados</div>
                                        <div class="metric-value">${w.records.length}</div>
                                    </div>
                                    <div class="metric-box">
                                        <div class="metric-label">KM Total</div>
                                        <div class="metric-value">${fNum(w.km)}</div>
                                    </div>
                                    <div class="metric-box">
                                        <div class="metric-label">Média/Dia</div>
                                        <div class="metric-value text-success">${fMoney(avgPerDay)}</div>
                                    </div>
                                    <div class="metric-box">
                                        <div class="metric-label">R$ por KM</div>
                                        <div class="metric-value text-primary">${fMoney(rPorKM)}</div>
                                    </div>
                                </div>
                                
                                <div style="margin-bottom: 16px;">
                                    <h4 style="font-size: 13px; color: var(--text-gray); margin-bottom: 12px; text-transform: uppercase;">Receita por Plataforma</h4>
                                    <div style="margin-bottom: 8px;">
                                        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600;">
                                            <span>Uber</span><span>${fMoney(w.uber)} <span style="color:var(--text-gray); font-weight:normal">(${fNum(pUber)}%)</span></span>
                                        </div>
                                        <div class="progress-bar"><div class="progress-fill" style="width: ${pUber}%; background: var(--uber);"></div></div>
                                    </div>
                                    <div style="margin-bottom: 8px;">
                                        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600;">
                                            <span>99</span><span>${fMoney(w.n99)} <span style="color:var(--text-gray); font-weight:normal">(${fNum(p99)}%)</span></span>
                                        </div>
                                        <div class="progress-bar"><div class="progress-fill" style="width: ${p99}%; background: var(--warning);"></div></div>
                                    </div>
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600;">
                                            <span>Outros</span><span>${fMoney(w.other)} <span style="color:var(--text-gray); font-weight:normal">(${fNum(pOther)}%)</span></span>
                                        </div>
                                        <div class="progress-bar"><div class="progress-fill" style="width: ${pOther}%; background: var(--primary);"></div></div>
                                    </div>
                                </div>

                                <div style="border-top: 1px dashed var(--border-color); padding-top: 12px; font-size: 13px;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                                        <span style="color: var(--text-gray); font-weight: 500;">Entradas</span><span class="text-success" style="font-weight:600">${fMoney(w.income)}</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between;">
                                        <span style="color: var(--text-gray); font-weight: 500;">Saídas/Custos</span><span class="text-danger" style="font-weight:600">${fMoney(w.expenses)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                `;
    }).join('');
}

// --- MENSAL ---
function loadHistoryMensal() {
    const container = document.getElementById('history-mensal-content');
    if (appData.records.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: var(--text-gray); padding: 30px;">Nenhum registro encontrado.</p>';
        return;
    }

    const months = {};
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    appData.records.forEach(r => {
        const [year, month] = r.date.split('-');
        const key = `${year}-${month}`;
        if (!months[key]) months[key] = { year, monthName: monthNames[parseInt(month) - 1], records: [], km: 0, income: 0, expenses: 0, uber: 0, n99: 0, other: 0, fuel: 0 };
        months[key].records.push(r);
        months[key].km += r.km;
        months[key].income += r.total_income;
        months[key].expenses += r.total_expenses;
        months[key].uber += r.uber || 0;
        months[key].n99 += r.n99 || 0;
        months[key].other += r.other_income || 0;
        months[key].fuel += r.fuel || 0;
    });

    const sortedMonths = Object.keys(months).sort().reverse();

    container.innerHTML = sortedMonths.map((key, index) => {
        const m = months[key];
        const profit = m.income - m.expenses;
        const avgPerDay = m.records.length > 0 ? profit / m.records.length : 0;
        const rPorKM = m.km > 0 ? profit / m.km : 0;
        const margem = m.income > 0 ? (profit / m.income) * 100 : 0;
        const avgKmDia = m.km / m.records.length;
        const pUber = m.income > 0 ? (m.uber / m.income) * 100 : 0;
        const p99 = m.income > 0 ? (m.n99 / m.income) * 100 : 0;
        const pOther = m.income > 0 ? (m.other / m.income) * 100 : 0;

        return `
                <div class="accordion ${index === 0 ? 'open' : ''}">
                    <div class="accordion-header" onclick="toggleAccordion(this)">
                        <div class="accordion-title">
                            <i class="fa-regular fa-calendar text-primary"></i>
                            <h3>${m.monthName} ${m.year}</h3>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span class="accordion-badge ${profit >= 0 ? 'badge-positive' : 'badge-negative'}">${fMoney(profit)}</span>
                            <i class="fa-solid fa-chevron-down accordion-icon"></i>
                        </div>
                    </div>
                    <div class="accordion-body">
                        <div class="accordion-content">
                            <div class="accordion-content-inner">
                                <div class="grid-2" style="margin-bottom: 16px;">
                                    <div class="metric-box">
                                        <div class="metric-label">Dias Trabalhados</div>
                                        <div class="metric-value">${m.records.length}</div>
                                    </div>
                                    <div class="metric-box">
                                        <div class="metric-label">KM Total</div>
                                        <div class="metric-value">${fNum(m.km)}</div>
                                    </div>
                                    <div class="metric-box">
                                        <div class="metric-label">Média Lucro/Dia</div>
                                        <div class="metric-value text-success">${fMoney(avgPerDay)}</div>
                                    </div>
                                    <div class="metric-box">
                                        <div class="metric-label">R$ por KM</div>
                                        <div class="metric-value text-primary">${fMoney(rPorKM)}</div>
                                    </div>
                                    <div class="metric-box">
                                        <div class="metric-label">Média KM/Dia</div>
                                        <div class="metric-value text-primary">${fNum(avgKmDia)}</div>
                                    </div>
                                    <div class="metric-box">
                                        <div class="metric-label">Margem</div>
                                        <div class="metric-value text-success">${fNum(margem)}%</div>
                                    </div>
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <h4 style="font-size: 13px; color: var(--text-gray); margin-bottom: 12px; text-transform: uppercase;">Receita por Plataforma</h4>
                                    <div style="margin-bottom: 8px;">
                                        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600;">
                                            <span>Uber</span><span>${fMoney(m.uber)} <span style="color:var(--text-gray); font-weight:normal">(${fNum(pUber)}%)</span></span>
                                        </div>
                                        <div class="progress-bar"><div class="progress-fill" style="width: ${pUber}%; background: var(--uber);"></div></div>
                                    </div>
                                    <div style="margin-bottom: 8px;">
                                        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600;">
                                            <span>99</span><span>${fMoney(m.n99)} <span style="color:var(--text-gray); font-weight:normal">(${fNum(p99)}%)</span></span>
                                        </div>
                                        <div class="progress-bar"><div class="progress-fill" style="width: ${p99}%; background: var(--warning);"></div></div>
                                    </div>
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600;">
                                            <span>Outros</span><span>${fMoney(m.other)} <span style="color:var(--text-gray); font-weight:normal">(${fNum(pOther)}%)</span></span>
                                        </div>
                                        <div class="progress-bar"><div class="progress-fill" style="width: ${pOther}%; background: var(--primary);"></div></div>
                                    </div>
                                </div>

                                <div style="border-top: 1px dashed var(--border-color); padding-top: 12px; font-size: 13px;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                                        <span style="color: var(--text-gray); font-weight: 500;">Total Entradas</span><span class="text-success" style="font-weight:600">${fMoney(m.income)}</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                                        <span style="color: var(--text-gray); font-weight: 500;">Combustível</span><span style="font-weight:600">${fMoney(m.fuel)}</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between;">
                                        <span style="color: var(--text-gray); font-weight: 500;">Total Saídas</span><span class="text-danger" style="font-weight:600">${fMoney(m.expenses)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                `;
    }).join('');
}

// --- GERAL ---
function loadHistoryGeral() {
    const container = document.getElementById('history-geral-content');
    const totalRec = appData.records.length;
    if (totalRec === 0) {
        container.innerHTML = '<p style="text-align:center; color: var(--text-gray); padding: 30px;">Sem dados para análise.</p>';
        return;
    }

    let tKM = 0, tInc = 0, tExp = 0, tUber = 0, t99 = 0, tOther = 0;
    appData.records.forEach(r => {
        tKM += r.km;
        tInc += r.total_income;
        tExp += r.total_expenses;
        tUber += r.uber || 0;
        t99 += r.n99 || 0;
        tOther += r.other_income || 0;
    });

    const tProf = tInc - tExp;
    const rPorKM = tKM > 0 ? (tProf / tKM) : 0;
    const margem = tInc > 0 ? (tProf / tInc) * 100 : 0;
    const mediaKmDia = tKM / totalRec;
    const mediaProfDia = tProf / totalRec;
    const pUber = tInc > 0 ? (tUber / tInc) * 100 : 0;
    const p99 = tInc > 0 ? (t99 / tInc) * 100 : 0;
    const pOther = tInc > 0 ? (tOther / tInc) * 100 : 0;

    container.innerHTML = `
                <div class="card" style="box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.1);">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h3 style="font-size: 18px; color: var(--text-dark); margin-bottom: 4px;">Lucro Histórico Total</h3>
                        <div style="font-size: 36px; font-weight: 800;" class="${tProf >= 0 ? 'text-success' : 'text-danger'}">${fMoney(tProf)}</div>
                    </div>

                    <div class="grid-2" style="margin-bottom: 20px;">
                        <div class="metric-box">
                            <div class="metric-label">Dias Totais</div>
                            <div class="metric-value">${totalRec}</div>
                        </div>
                        <div class="metric-box">
                            <div class="metric-label">KM Totais</div>
                            <div class="metric-value">${fNum(tKM)}</div>
                        </div>
                        <div class="metric-box">
                            <div class="metric-label">R$ por KM</div>
                            <div class="metric-value text-primary">${fMoney(rPorKM)}</div>
                        </div>
                        <div class="metric-box">
                            <div class="metric-label">Margem</div>
                            <div class="metric-value text-success">${fNum(margem)}%</div>
                        </div>
                        <div class="metric-box">
                            <div class="metric-label">Média KM/Dia</div>
                            <div class="metric-value text-primary">${fNum(mediaKmDia)}</div>
                        </div>
                        <div class="metric-box">
                            <div class="metric-label">Média Lucro/Dia</div>
                            <div class="metric-value text-success">${fMoney(mediaProfDia)}</div>
                        </div>
                    </div>

                    <div style="margin-bottom: 24px; padding: 16px; background: var(--bg-body); border-radius: 12px;">
                        <h4 style="font-size: 13px; color: var(--text-gray); margin-bottom: 12px; text-transform: uppercase;">Receita por Plataforma Global</h4>
                        <div style="margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600;">
                                <span>Uber</span><span>${fMoney(tUber)} <span style="color:var(--text-gray); font-weight:normal">(${fNum(pUber)}%)</span></span>
                            </div>
                            <div class="progress-bar"><div class="progress-fill" style="width: ${pUber}%; background: var(--uber);"></div></div>
                        </div>
                        <div style="margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600;">
                                <span>99</span><span>${fMoney(t99)} <span style="color:var(--text-gray); font-weight:normal">(${fNum(p99)}%)</span></span>
                            </div>
                            <div class="progress-bar"><div class="progress-fill" style="width: ${p99}%; background: var(--warning);"></div></div>
                        </div>
                        <div>
                            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600;">
                                <span>Outros</span><span>${fMoney(tOther)} <span style="color:var(--text-gray); font-weight:normal">(${fNum(pOther)}%)</span></span>
                            </div>
                            <div class="progress-bar"><div class="progress-fill" style="width: ${pOther}%; background: var(--primary);"></div></div>
                        </div>
                    </div>

                    <div style="font-size: 14px; border-top: 1px dashed var(--border-color); padding-top: 16px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="color: var(--text-gray); font-weight: 500;">Entradas Globais</span><span class="text-success" style="font-weight:700">${fMoney(tInc)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--text-gray); font-weight: 500;">Saídas/Custos Globais</span><span class="text-danger" style="font-weight:700">${fMoney(tExp)}</span>
                        </div>
                    </div>
                </div>
            `;
}

// LÓGICA DA ABA: MANUTENÇÃO
const maintTypesInfo = { oil_change: 'oil', oil_filter: 'oil', air_filter: 'air', cabin_filter: 'air', fuel_filter: 'air', brake_pads: 'general', tires: 'general', alignment: 'general', general: 'general' };
const maintLabels = { oil_change: 'Troca de Óleo', oil_filter: 'Filtro de Óleo', air_filter: 'Filtro de Ar', cabin_filter: 'Filtro de Cabine', fuel_filter: 'Filtro de Combustível', brake_pads: 'Pastilhas de Freio', tires: 'Pneus', alignment: 'Alinhamento/Balanceamento', general: 'Serviço Geral' };

function loadMaintenance() {
    document.getElementById('vehicle-current-km').textContent = fNum(appData.config.totalVehicleKm) + ' km';
    ['oil-maintenance', 'general-maintenance', 'air-maintenance', 'fuel-maintenance', 'cabin-maintenance', 'completed-maintenance-list'].forEach(id => {
        const el = document.getElementById(id); if (el) el.innerHTML = '';
    });

    let hasAlert = false;
    let alertsHtml = '';
    const currentTotalBalance = getVirtualReserveTotal();

    // Separar concluídos de não concluídos
    const pendingMaint = appData.maintenance.filter(m => !m.isCompleted);
    const completedMaint = appData.maintenance.filter(m => m.isCompleted);

    // Renderizar pendentes
    pendingMaint.forEach(m => {
        const catId = maintTypesInfo[m.type] + '-maintenance';
        const container = document.getElementById(catId);
        if (!container) return;

        const kmFaltantes = m.nextKm - appData.config.totalVehicleKm;
        let sClass = 'ok', sBadge = 'status-ok', sText = `Faltam ${fNum(kmFaltantes)} km`;

        if (kmFaltantes <= 0) {
            sClass = 'danger'; sBadge = 'status-danger'; sText = `ATRASADO ${fNum(Math.abs(kmFaltantes))} km`;
            hasAlert = true;
            alertsHtml += `<div class="card" style="border-color:var(--danger); background: rgba(250, 82, 82, 0.05); padding: 10px; margin-bottom: 10px;"><i class="fa-solid fa-triangle-exclamation text-danger"></i> <strong>Atenção:</strong> Serviço atrasado - ${(maintLabels[m.type] || m.type).toUpperCase()}!</div>`;
        }
        else if (kmFaltantes <= appData.config.alertKm) {
            sClass = 'warning'; sBadge = 'status-warn'; sText = `Próximo: ${fNum(kmFaltantes)} km`;
            hasAlert = true;
            alertsHtml += `<div class="card" style="border-color:var(--warning); background: rgba(245, 158, 11, 0.05); padding: 10px; margin-bottom: 10px;"><i class="fa-solid fa-triangle-exclamation text-warning"></i> <strong>Aviso:</strong> Serviço próximo - ${(maintLabels[m.type] || m.type).toUpperCase()}!</div>`;
        }

        // KM Progress Calculation
        const targetKm = m.nextKm;
        const lastKm = m.km;
        const currentKm = appData.config.totalVehicleKm;
        const totalKmInterval = targetKm - lastKm;
        const drivenKm = currentKm - lastKm;
        let kmProgress = totalKmInterval > 0 ? (drivenKm / totalKmInterval) * 100 : 100;

        if (kmProgress < 0) kmProgress = 0;
        if (kmProgress > 100) kmProgress = 100;

        let kmColor = 'var(--success)';
        if (kmProgress >= 90) kmColor = 'var(--danger)';
        else if (kmProgress >= 70) kmColor = 'var(--warning)';

        // Budget Progress Calculation
        const estimatedCost = m.cost || 0;
        let budgetProgress = 0;
        let budgetColor = 'var(--success)';
        let budgetText = '';

        if (estimatedCost > 0) {
            budgetProgress = currentTotalBalance > 0 ? (currentTotalBalance / estimatedCost) * 100 : 0;
            if (budgetProgress > 100) budgetProgress = 100;
            if (budgetProgress < 0) budgetProgress = 0;

            if (currentTotalBalance < estimatedCost * 0.5) budgetColor = 'var(--danger)';
            else if (currentTotalBalance < estimatedCost) budgetColor = 'var(--warning)';

            if (currentTotalBalance >= estimatedCost) {
                budgetText = `Atingido! (${fMoney(estimatedCost)})`;
            } else {
                budgetText = `${fMoney(currentTotalBalance)} de ${fMoney(estimatedCost)}`;
            }
        } else {
            budgetProgress = 100; // No cost, fully covered
            budgetColor = 'var(--success)';
            budgetText = 'Sem Custo (R$ 0,00)';
        }

        container.insertAdjacentHTML('beforeend', `
                    <div class="card" style="border-left: 4px solid ${kmColor}; margin-bottom: 16px; padding: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                            <div>
                                <div style="font-weight: 700; font-size: 15px; margin-bottom: 4px; color: var(--text-dark);">${(maintLabels[m.type] || m.type).toUpperCase()} ${m.isCompleted ? '<i class="fa-solid fa-circle-check text-success" title="Serviço Concluído / Pago" style="font-size: 14px; margin-left: 4px;"></i>' : ''}</div>
                                <div style="font-size: 12px; color: var(--text-gray);">Última troca: ${fNum(m.km)} km (${fDate(m.date)})</div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span class="maint-status ${sBadge}" style="font-size: 11px; padding: 4px 8px; border-radius: 4px;">${sText}</span>
                                ${!m.isCompleted ? `<button class="btn btn-sm" style="padding: 4px 8px; font-size: 11px; width: auto;" onclick="completeMaintenance('${m.id}')" title="Marcar como Concluído (Deduz da Reserva)"><i class="fa-solid fa-check"></i> Pago</button>` : ''}
                                <i class="fa-solid fa-trash text-gray" style="cursor: pointer; opacity: 0.6; transition: 0.2s;" onmouseover="this.className='fa-solid fa-trash text-danger'; this.style.opacity='1';" onmouseout="this.className='fa-solid fa-trash text-gray'; this.style.opacity='0.6';" onclick="deleteMaintenance('${m.id}')"></i>
                            </div>
                        </div>

                        <div style="margin-bottom: 16px;">
                            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; font-weight: 600;">
                                <span style="color: var(--text-gray);">Progresso Quilometragem</span>
                                <span style="color: ${kmColor};">${fNum(drivenKm > 0 ? drivenKm : 0)} / ${fNum(totalKmInterval)} km</span>
                            </div>
                            <div class="progress-bar" style="height: 8px; background: rgba(0,0,0,0.05); border-radius: 8px;">
                                <div class="progress-fill" style="width: ${kmProgress}%; background: ${kmColor}; border-radius: 8px;"></div>
                            </div>
                        </div>

                        <div>
                            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; font-weight: 600;">
                                <span style="color: var(--text-gray);"><i class="fa-solid fa-piggy-bank text-primary"></i> Reserva vs Custo Estimado</span>
                                <span style="color: ${budgetColor};">${budgetText}</span>
                            </div>
                            <div class="progress-bar" style="height: 8px; background: rgba(0,0,0,0.05); border-radius: 8px;">
                                <div class="progress-fill" style="width: ${budgetProgress}%; background: ${budgetColor}; border-radius: 8px;"></div>
                            </div>
                        </div>
                    </div>
                `);
    });

    // Renderizar concluídos
    const completedContainer = document.getElementById('completed-maintenance-list');
    if (completedMaint.length === 0 && completedContainer) {
        completedContainer.innerHTML = '<p style="text-align:center; color: var(--text-gray); padding: 10px; font-size: 13px;">Nenhum serviço concluído ainda.</p>';
    } else if (completedContainer) {
        completedMaint.forEach(m => {
            completedContainer.insertAdjacentHTML('beforeend', `
                        <div class="card" style="border-left: 4px solid var(--text-gray); margin-bottom: 16px; padding: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); opacity: 0.8;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div>
                                    <div style="font-weight: 700; font-size: 15px; margin-bottom: 4px; color: var(--text-dark);">${(maintLabels[m.type] || m.type).toUpperCase()} <i class="fa-solid fa-circle-check text-success" title="Serviço Concluído / Pago" style="font-size: 14px; margin-left: 4px;"></i></div>
                                    <div style="font-size: 12px; color: var(--text-gray);">Data: ${fDate(m.date)} | KM: ${fNum(m.km)} km</div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <span class="maint-status status-ok" style="font-size: 11px; padding: 4px 8px; border-radius: 4px; background: rgba(16, 185, 129, 0.1); color: var(--success);"><i class="fa-solid fa-check"></i> Pago: ${fMoney(m.cost)}</span>
                                    <i class="fa-solid fa-trash text-gray" style="cursor: pointer; opacity: 0.6; transition: 0.2s;" onmouseover="this.className='fa-solid fa-trash text-danger'; this.style.opacity='1';" onmouseout="this.className='fa-solid fa-trash text-gray'; this.style.opacity='0.6';" onclick="deleteMaintenance('${m.id}')"></i>
                                </div>
                            </div>
                        </div>
                    `);
        });
    }

    document.getElementById('maintenance-alerts').innerHTML = alertsHtml;
    document.getElementById('nav-maint-alert').style.display = hasAlert ? 'block' : 'none';
}

function showAddMaintenanceModal() {
    document.getElementById('maint-date').value = getLocalTodayISO();
    document.getElementById('maint-km').value = appData.config.totalVehicleKm;
    document.getElementById('maintenance-modal').classList.add('show');
}
function closeMaintenanceModal() { document.getElementById('maintenance-modal').classList.remove('show'); document.getElementById('form-maintenance').reset(); }

function saveMaintenance(e) {
    e.preventDefault();
    const m = {
        id: Date.now().toString(),
        type: document.getElementById('maint-type').value,
        date: document.getElementById('maint-date').value,
        km: parseInt(document.getElementById('maint-km').value) || 0,
        nextKm: parseInt(document.getElementById('maint-next-km').value) || 0,
        cost: parseFloat(document.getElementById('maint-cost').value) || 0
    };
    if (m.nextKm <= m.km) { showToast('Próxima troca deve ser maior que KM atual', 'error'); return false; }

    appData.maintenance.push(m);
    if (m.km > appData.config.totalVehicleKm) appData.config.totalVehicleKm = m.km;

    saveData(); closeMaintenanceModal(); loadMaintenance(); calculateVirtualReserve(); showToast('Peça/Serviço salvo!');
    return false;
}

function deleteMaintenance(id) {
    if (confirm('Excluir registro desta manutenção?')) {
        appData.maintenance = appData.maintenance.filter(x => x.id !== id);
        saveData(); loadMaintenance(); calculateVirtualReserve(); showToast('Excluído');
    }
}

function completeMaintenance(id) {
    const mLine = appData.maintenance.find(x => x.id === id);
    if (!mLine) return;
    if (confirm(`Ao concluir este serviço, o custo de ${fMoney(mLine.cost)} será debitado do Saldo Virtual da Reserva permanentemente. Deseja continuar?`)) {
        mLine.isCompleted = true;
        saveData();
        loadMaintenance();
        calculateVirtualReserve();
        showToast('Serviço Concluído!', 'success');
    }
}

// LÓGICA DA ABA: CONFIGS E EXPORTAÇÃO
function loadSettings() {
    document.getElementById('config-percentage').value = appData.config.savingsPercentage;
    document.getElementById('config-km').value = appData.config.totalVehicleKm;
}

function salvarConfig() {
    appData.config.savingsPercentage = parseFloat(document.getElementById('config-percentage').value) || 10;
    appData.config.totalVehicleKm = parseInt(document.getElementById('config-km').value) || 0;
    saveData(); showToast('Configurações salvas!'); loadTodayData();
}

function exportData() {
    if (appData.records.length === 0) return showToast('Sem dados para exportar', 'error');
    const csv = ['Data,KM,Uber,99,Outros,Combustivel,Gastos,Lucro\n' + appData.records.map(r => `${r.date},${r.km},${r.uber},${r.n99},${r.other_income},${r.fuel},${r.other_expense},${r.profit} `).join('\n')];
    const blob = new Blob(csv, { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ubercalc_backup.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast('Backup por CSV gerado!');
}