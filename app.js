// CONFIGURACIÓN DE TU BASE DE DATOS
const firebaseConfig = {
    apiKey: "AIzaSyBxiDprPh1U1bdSgnxNkgmeC4jnrp1JrhM",
    authDomain: "fx-journal-pro-2dc77.firebaseapp.com",
    projectId: "fx-journal-pro-2dc77",
    storageBucket: "fx-journal-pro-2dc77.firebasestorage.app",
    messagingSenderId: "118220289038",
    appId: "1:118220289038:web:0213b442d3bb729b4ab85f"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let trades = [];
let startingBalance = 500;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
// Variables para el navegador de estadísticas
let statsMonth = new Date().getMonth();
let statsYear = new Date().getFullYear();

let equityChart = null;
let currentUser = null;

// GESTIÓN DE USUARIO
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        loadCloudData();
    } else {
        document.getElementById('auth-container').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
        
        if(!document.getElementById('beta-tag')) {
            const loginBox = document.querySelector('#auth-container .card') || document.querySelector('#auth-container');
            const betaMsg = document.createElement('p');
            betaMsg.id = 'beta-tag';
            betaMsg.innerHTML = '<i class="fas fa-lock"></i> VERSIÓN BETA: Solo usuarios con código de invitación.';
            betaMsg.style.cssText = "color: #f59e0b; font-size: 13px; margin-top: 15px; text-align: center; background: rgba(245,158,11,0.1); padding: 8px; border-radius: 5px; border: 1px solid rgba(245,158,11,0.2);";
            loginBox.appendChild(betaMsg);
        }
    }
});

async function login() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    try { await auth.signInWithEmailAndPassword(email, pass); } catch(e) { alert("Error: " + e.message); }
}

async function register() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    if(!email || !pass) { alert("Por favor completa los campos."); return; }
    const userKey = prompt("🔒 ACCESO RESTRINGIDO: Ingresa el código de invitación:");
    const masterKey = "TRADER-BETA-2026"; 
    if (userKey !== masterKey) { alert("❌ Código incorrecto."); return; }
    try { 
        await auth.createUserWithEmailAndPassword(email, pass); 
        alert("¡Bienvenido!"); 
    } catch(e) { alert("Error: " + e.message); }
}

function logout() { auth.signOut(); }

async function loadCloudData() {
    const doc = await db.collection('settings').doc(currentUser.uid).get();
    if (doc.exists) startingBalance = Number(doc.data().startingBalance);
    db.collection('trades').doc(currentUser.uid).collection('userTrades')
    .orderBy('date', 'asc').onSnapshot(snap => {
        trades = snap.docs.map(d => ({id: d.id, ...d.data()}));
        navigate('dashboard'); 
    });
}

async function updateBalance(val) {
    startingBalance = Number(val);
    await db.collection('settings').doc(currentUser.uid).set({startingBalance});
    renderDashboard();
}

function navigate(page) {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  const navMap = { 'newTrade': 0, 'dashboard': 1, 'calendar': 2, 'stats': 3 };
  if(navMap[page] !== undefined) document.querySelectorAll('.nav-item')[navMap[page]].classList.add('active');
  if (page === "dashboard") renderDashboard();
  if (page === "newTrade") renderNewTrade();
  if (page === "calendar") renderCalendar();
  if (page === "stats") renderStats();
}

const confList = ["Soporte o Resistencia fuerte con mas de 2 toques en M30 Y H1", "Velas envolventes", "Cierre de vela en M30", "Toma de liquidez", "Trafico limpio", "Rompimiento de Estructura", "Continuación de Estructura", "Cierre de vela M15 si hay bastante volumen"];

function renderNewTrade(editId = null) {
  let trade = editId !== null ? trades.find(t => t.id === editId) : {};
  let savedConf = trade.confirmations || "";
  document.getElementById("content").innerHTML = `
    <h1 class="page-title">${editId !== null ? "Editar" : "Nuevo"} <span class="green-text">Trade</span></h1>
    <div class="card glass-effect">
      <div class="input-row">
        <div class="input-group"><label>Fecha</label><input id="date" type="date" value="${trade.date || new Date().toISOString().split("T")[0]}"></div>
        <div class="input-group"><label>Sesión</label><select id="session">
          <option value="">Seleccionar Sesión</option>
          <option ${trade.session==="New York"?"selected":""}>New York</option>
          <option ${trade.session==="Tokyo"?"selected":""}>Tokyo</option>
          <option ${trade.session==="Londres"?"selected":""}>Londres</option>
        </select></div>
        <div class="input-group"><label>Par</label><input id="pair" placeholder="ej: XAUUSD" value="${trade.pair || ""}"></div>
      </div>
      <div class="input-row">
        <div class="input-group"><label>Resultado</label><select id="resultType">
          <option value="win" ${trade.resultType==="win"?"selected":""}>WIN</option>
          <option value="loss" ${trade.resultType==="loss"?"selected":""}>LOSS</option>
          <option value="be" ${trade.resultType==="be"?"selected":""}>BE</option>
        </select></div>
        <div class="input-group"><label>Riesgo ($)</label><input id="riskAmount" type="number" value="${trade.riskAmount || ""}"></div>
        <div class="input-group"><label>Ganancia/Pérdida ($)</label><input id="result" type="number" value="${Math.abs(trade.result) || ""}"></div>
      </div>
      <div class="checklist-group" style="margin-top: 25px;">
        <h4 style="color:var(--accent); margin-bottom:15px;"><i class="fas fa-check-double"></i> Confirmaciones</h4>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            ${confList.map(item => `<label class="checklist-item"><input type="checkbox" class="chk-conf" value="${item}" ${savedConf.includes(item)?'checked':''}> ${item}</label>`).join('')}
        </div>
      </div>
      <div class="input-group" style="margin-top: 20px;"><label>Captura de Pantalla</label><input type="file" id="imageInput" style="padding: 10px;"></div>
      <button onclick="saveToCloud('${editId || ""}')" class="main-btn" style="margin-top:20px; width:100%;">GUARDAR EN TERMINAL</button>
    </div>`;
}

async function saveToCloud(editId) {
  const rType = document.getElementById("resultType").value;
  const rVal = Math.abs(Number(document.getElementById("result").value));
  const riskVal = Math.abs(Number(document.getElementById("riskAmount").value));
  const imageFile = document.getElementById("imageInput").files[0];
  const data = {
    pair: document.getElementById("pair").value,
    resultType: rType,
    result: rType === "win" ? rVal : rType === "loss" ? -rVal : 0,
    riskAmount: riskVal,
    date: document.getElementById("date").value,
    session: document.getElementById("session").value,
    confirmations: Array.from(document.querySelectorAll('.chk-conf:checked')).map(cb => "• " + cb.value).join('\n')
  };
  if (imageFile) {
    const reader = new FileReader();
    reader.onload = async (e) => { data.image = e.target.result; await pushData(editId, data); };
    reader.readAsDataURL(imageFile);
  } else {
    if (editId) data.image = trades.find(t => t.id === editId).image;
    await pushData(editId, data);
  }
}

async function pushData(editId, data) {
    const ref = db.collection('trades').doc(currentUser.uid).collection('userTrades');
    if (editId) await ref.doc(editId).update(data); else await ref.add(data);
    navigate("dashboard");
}

function renderDashboard() {
  let currentBalance = startingBalance;
  let peakBalance = startingBalance;
  let equityData = [startingBalance];
  trades.forEach(t => {
      currentBalance += t.result;
      if(currentBalance > peakBalance) peakBalance = currentBalance;
      equityData.push(currentBalance);
  });
  let drawdown = peakBalance - currentBalance;
  let drawdownPercent = peakBalance > 0 ? ((drawdown / peakBalance) * 100).toFixed(2) : 0;

  document.getElementById("content").innerHTML = `
    <div class="dashboard-header-pro">
        <h1 class="page-title">TERMINAL <span class="green-text">DASHBOARD</span></h1>
        <button onclick="exportData()" class="btn-export-pro"><i class="fas fa-file-excel"></i> Exportar Datos</button>
    </div>

    <div class="stats-grid-premium">
      <div class="stat-card-glass main-stat">
          <div class="stat-info">
              <h3>BALANCE NETO</h3>
              <span class="value ${currentBalance >= startingBalance ? 'green' : 'red'}">$${currentBalance.toFixed(2)}</span>
          </div>
          <div class="balance-setting">
              <label>Capital Inicial:</label>
              <input type="number" value="${startingBalance}" onchange="updateBalance(this.value)">
          </div>
      </div>
      
      <div class="stat-card-glass">
          <div class="stat-info">
              <h3>MAX DRAWDOWN</h3>
              <span class="value red">-$${drawdown.toFixed(2)}</span>
              <p class="stat-subtext">📉 ${drawdownPercent}% desde el pico</p>
          </div>
      </div>

      <div class="stat-card-glass">
          <div class="stat-info">
              <h3>TOTAL TRADES</h3>
              <span class="value white">${trades.length}</span>
              <p class="stat-subtext">Operaciones registradas</p>
          </div>
      </div>
    </div>

    <div class="card glass-effect chart-container-pro animate-fade-in">
       <div class="chart-label"><i class="fas fa-chart-line"></i> Curva de Equidad</div>
       <canvas id="equityChart"></canvas>
    </div>
  `;
  
  if (equityChart) equityChart.destroy();
  equityChart = new Chart(document.getElementById("equityChart"), { 
      type: "line", 
      data: { 
          labels: ["INICIO", ...trades.map((_, i) => "T" + (i + 1))], 
          datasets: [{ 
              label: "Balance", 
              data: equityData, 
              borderColor: "#22c55e", 
              borderWidth: 3,
              pointBackgroundColor: "#22c55e",
              pointRadius: 4,
              fill: true, 
              backgroundColor: "rgba(34,197,94,0.05)",
              tension: 0.4
          }] 
      },
      options: { 
          responsive: true,
          maintainAspectRatio: false,
          scales: { 
            y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#94a3b8" } }, 
            x: { grid: { display: false }, ticks: { color: "#94a3b8" } } 
          },
          plugins: { legend: { display: false } }
      }
  });
}

function renderCalendar() {
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const monthName = firstDay.toLocaleString("es-ES", { month: "long" }).toUpperCase();
  
  let html = `
    <div class="calendar-wrapper-pro animate-fade-in">
        <div class="calendar-nav-pro">
            <button onclick="changeMonth(-1)" class="btn-cal-nav">◀</button>
            <h2 class="calendar-title-pro">${monthName} <span class="green-text">${currentYear}</span></h2>
            <button onclick="changeMonth(1)" class="btn-cal-nav">▶</button>
        </div>
        <div class="calendar-grid-premium">`;

  const headers = ["Dom","Lun","Mar","Mie","Jue","Vie","Sab","Σ"];
  headers.forEach(h => html += `<div class="cal-header-cell">${h}</div>`);

  let startDay = firstDay.getDay();
  for (let i = 0; i < startDay; i++) html += `<div class="cal-day-empty"></div>`;

  let weekSum = 0;
  let weekTradeCount = 0;

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const dayTrades = trades.filter(t => t.date === dateStr);
    const dayTotal = dayTrades.reduce((a, t) => a + t.result, 0);
    
    weekSum += dayTotal;
    weekTradeCount += dayTrades.length;

    let dayClass = dayTotal > 0 ? "cal-day-win" : dayTotal < 0 ? "cal-day-loss" : "cal-day-neutral";
    
    html += `
        <div onclick="showDayTrades('${dateStr}')" class="cal-day-pro ${dayClass}">
            <span class="cal-day-num">${d}</span>
            <span class="cal-day-pnl">$${dayTotal.toFixed(0)}</span>
            ${dayTrades.length > 0 ? `<span style="font-size: 8px; opacity: 0.6; margin-top: 2px;">${dayTrades.length} Trades</span>` : ''}
        </div>`;

    if ((startDay + d) % 7 === 0 || d === lastDay.getDate()) {
      if (d === lastDay.getDate() && (startDay + d) % 7 !== 0) {
          let rem = 7 - ((startDay + d) % 7);
          for(let r=0; r<rem; r++) html += `<div class="cal-day-empty"></div>`;
      }
      
      let weekColor = weekSum > 0 ? "var(--accent)" : (weekSum < 0 ? "#ef4444" : "var(--text-dim)");
      html += `
        <div class="cal-week-total" style="flex-direction: column; justify-content: center; gap: 2px;">
            <span style="color: ${weekColor}; font-weight: 900;">$${weekSum.toFixed(0)}</span>
            <span style="font-size: 8px; color: var(--text-dim); opacity: 0.8;">${weekTradeCount} Trades</span>
        </div>`;
      
      weekSum = 0;
      weekTradeCount = 0;
    }
  }
  document.getElementById("content").innerHTML = html + "</div></div>";
}

function changeStatsMonth(dir) { 
    statsMonth += dir; 
    if(statsMonth > 11) { statsMonth = 0; statsYear++; } 
    if(statsMonth < 0) { statsMonth = 11; statsYear--; } 
    renderStats(); 
}

function renderStats() {
  // Filtrar trades solo del mes seleccionado (Para Profit y Win Rate mensual)
  const monthTrades = trades.filter(t => {
      const [y, m] = t.date.split('-'); 
      return parseInt(y) === statsYear && (parseInt(m) - 1) === statsMonth;
  });

  // NUEVO: Filtrar todos los trades HASTA el mes seleccionado (Para el Balance Total real)
  const tradesUntilThisMonth = trades.filter(t => {
      const [y, m] = t.date.split('-');
      const tradeYear = parseInt(y);
      const tradeMonth = parseInt(m) - 1;
      if (tradeYear < statsYear) return true;
      if (tradeYear === statsYear && tradeMonth <= statsMonth) return true;
      return false;
  });

  const monthName = new Date(statsYear, statsMonth, 1).toLocaleString("es-ES", { month: "long" }).toUpperCase();

  const wins = monthTrades.filter(t => t.resultType === "win").length;
  const losses = monthTrades.filter(t => t.resultType === "loss").length;
  const totalTrades = wins + losses;
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : 0;
  
  // PROFIT SOLO DEL MES
  const netProfitMonth = monthTrades.reduce((a, t) => a + t.result, 0);
  
  // BALANCE ACUMULADO (Fondeo + Todas las ganancias hasta ese mes)
  const accumulatedProfit = tradesUntilThisMonth.reduce((a, t) => a + t.result, 0);
  const totalBalance = startingBalance + accumulatedProfit;

  let dailyPnl = {};
  monthTrades.forEach(t => {
      if(!dailyPnl[t.date]) dailyPnl[t.date] = 0;
      dailyPnl[t.date] += t.result;
  });

  let bestDay = { date: 'N/A', pnl: 0 };
  let worstDay = { date: 'N/A', pnl: 0 };
  let tradingDays = Object.keys(dailyPnl).length;

  for(const [date, pnl] of Object.entries(dailyPnl)) {
      if(pnl > bestDay.pnl) { bestDay.pnl = pnl; bestDay.date = date; }
      if(pnl < worstDay.pnl) { worstDay.pnl = pnl; worstDay.date = date; }
  }

  const formatShortDate = (dateStr) => {
      if(dateStr === 'N/A') return 'N/A';
      const parts = dateStr.split('-');
      const d = new Date(parts[0], parts[1]-1, parts[2]);
      return d.getDate() + " " + d.toLocaleString("es-ES", { month: "short" }).toUpperCase();
  };

  document.getElementById("content").innerHTML = `
    <div class="calendar-nav-pro animate-fade-in" style="justify-content: center; gap: 30px; margin-bottom: 30px;">
        <button onclick="changeStatsMonth(-1)" class="btn-cal-nav">◀</button>
        <h1 class="page-title" style="margin:0;">MÉTRICAS <span class="green-text">${monthName} ${statsYear}</span></h1>
        <button onclick="changeStatsMonth(1)" class="btn-cal-nav">▶</button>
    </div>

    <div class="stats-grid-dominion animate-fade-in">
      
      <div class="stat-card-glass dominion-card" style="border-top: 3px solid var(--accent);">
          <h3>PROFIT DEL MES</h3>
          <span class="value glow-text ${netProfitMonth >= 0 ? 'green' : 'red'}">$${netProfitMonth.toFixed(2)}</span>
      </div>
      <div class="stat-card-glass dominion-card" style="border-top: 3px solid #3b82f6;">
          <h3>BALANCE TOTAL</h3>
          <span class="value white">$${totalBalance.toFixed(2)}</span>
          <span class="stat-subtext">Capital + Profit Acumulado</span>
      </div>
      <div class="stat-card-glass dominion-card">
          <h3>WIN RATE</h3>
          <span class="value white">${winRate}%</span>
          <span class="stat-subtext">${wins} Ganados | ${losses} Perdidos</span>
      </div>

      <div class="stat-card-glass dominion-card">
          <h3>TOTAL TRADES</h3>
          <span class="value white">${totalTrades}</span>
          <span class="stat-subtext">En ${tradingDays} días operativos</span>
      </div>
      <div class="stat-card-glass dominion-card" style="border-left: 3px solid var(--accent); background: rgba(34, 197, 94, 0.05);">
          <h3>MEJOR DÍA</h3>
          <span class="value green">+$${bestDay.pnl.toFixed(2)}</span>
          <span class="stat-subtext green" style="font-weight:bold;">📅 ${formatShortDate(bestDay.date)}</span>
      </div>
      <div class="stat-card-glass dominion-card" style="border-left: 3px solid #ef4444; background: rgba(239, 68, 68, 0.05);">
          <h3>PEOR DÍA</h3>
          <span class="value red">-$${Math.abs(worstDay.pnl).toFixed(2)}</span>
          <span class="stat-subtext red" style="font-weight:bold;">📅 ${formatShortDate(worstDay.date)}</span>
      </div>

    </div>
    
    <div class="dominion-footer animate-fade-in">
        <p><i class="fas fa-bolt"></i> Analiza. Mejora. Ejecuta.</p>
        <small>Built with Tradelogix Journal.</small>
    </div>
    `;
}

function showDayTrades(dateStr) {
  let html = `<h1 class="page-title">Trades: ${dateStr}</h1>`;
  const filtered = trades.filter(t => t.date === dateStr);
  if(filtered.length === 0) html += `<p style="color:#94a3b8">Día sin actividad.</p>`;
  filtered.forEach(t => {
    const resColor = t.resultType === "win" ? "green" : t.resultType === "loss" ? "red" : "blue";
    html += `
    <div class="card glass-effect">
        <h2 style="margin:0; color:white;">${t.pair} <span class="${resColor}">[${t.resultType.toUpperCase()}]</span></h2>
        <p>PNL: <span class="${resColor}">$${t.result}</span> | Riesgo: $${t.riskAmount}</p>
        <div style="margin-top:10px; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px;">
            <strong style="color:var(--accent)">Confirmaciones:</strong><p style="white-space: pre-wrap; font-size:12px; color:#94a3b8; margin:5px 0;">${t.confirmations}</p>
        </div>
        ${t.image ? `<img src="${t.image}" onclick="openImage('${t.image}')" style="width:120px; border-radius:8px; cursor:pointer; margin-top:10px;">` : ""}
        <div style="margin-top:15px; display:flex; gap:10px;">
            <button onclick="renderNewTrade('${t.id}')" class="btn-ghost" style="width:auto; padding:8px 15px;">Editar</button>
            <button onclick="deleteFromCloud('${t.id}')" class="btn-ghost" style="color:#ef4444; width:auto; padding:8px 15px;">Eliminar</button>
        </div>
    </div>`;
  });
  html += `<button onclick="renderCalendar()" class="main-btn" style="width:100%;">Volver al Calendario</button>`;
  document.getElementById("content").innerHTML = html;
}

async function deleteFromCloud(id) { 
    if(confirm("¿Eliminar registro?")) await db.collection('trades').doc(currentUser.uid).collection('userTrades').doc(id).delete(); 
}
function changeMonth(dir) { currentMonth+=dir; if(currentMonth>11){currentMonth=0;currentYear++;} if(currentMonth<0){currentMonth=11;currentYear--;} renderCalendar(); }

function openImage(src) { 
    let dialog = document.getElementById("imgDialog");
    if(!dialog) {
        dialog = document.createElement("dialog");
        dialog.id = "imgDialog";
        dialog.style.cssText = "padding: 0; border: none; background: transparent; outline: none; margin: auto;";
        const style = document.createElement("style");
        style.innerHTML = `
            #imgDialog::backdrop { background-color: rgba(0, 0, 0, 0.9); backdrop-filter: blur(5px); }
            #imgDialog img { max-width: 90vw; max-height: 90vh; border: 2px solid #22c55e; border-radius: 10px; object-fit: contain; }
        `;
        document.head.appendChild(style);
        dialog.innerHTML = `<img id="dialogImg" src="">`;
        dialog.onclick = () => dialog.close();
        document.body.appendChild(dialog); 
    }
    document.getElementById("dialogImg").src = src; 
    dialog.showModal(); 
}

function exportData() {
    let csv = "data:text/csv;charset=utf-8,Fecha,Par,Resultado,Riesgo,Sesion\n";
    trades.forEach(t => csv += `${t.date},${t.pair},${t.result},${t.riskAmount},${t.session}\n`);
    window.open(encodeURI(csv));
}