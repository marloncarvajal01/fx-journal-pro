// CONFIGURACIÓN FIREBASE (Tus llaves)
const firebaseConfig = {
  apiKey: "AIzaSyBxiDprPh1U1bdSgnxNkgmeC4jnrp1JrhM",
  authDomain: "fx-journal-pro-2dc77.firebaseapp.com",
  projectId: "fx-journal-pro-2dc77",
  storageBucket: "fx-journal-pro-2dc77.firebasestorage.app",
  messagingSenderId: "118220289038",
  appId: "1:118220289038:web:0213b442d3bb729b4ab85f",
  measurementId: "G-5PK41BQGV2"
};

// INICIALIZACIÓN
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let trades = [];
let startingBalance = 500;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let equityChart = null;
let currentUser = null;

// DETECTOR DE USUARIO
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('sidebar').style.display = 'block';
        document.getElementById('main-content').style.display = 'block';
        loadUserData();
    } else {
        currentUser = null;
        document.getElementById('auth-container').style.display = 'block';
        document.getElementById('sidebar').style.display = 'none';
        document.getElementById('main-content').style.display = 'none';
    }
});

// LOGIN Y REGISTRO
async function register() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    try { await auth.createUserWithEmailAndPassword(email, pass); alert("¡Cuenta creada!"); } 
    catch (e) { alert(e.message); }
}

async function login() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    try { await auth.signInWithEmailAndPassword(email, pass); } 
    catch (e) { alert("Error: " + e.message); }
}

function logout() { auth.signOut(); }

// CARGAR DATOS DESDE LA NUBE
async function loadUserData() {
    // Cargar Balance Inicial
    const settings = await db.collection('settings').doc(currentUser.uid).get();
    if (settings.exists) startingBalance = Number(settings.data().startingBalance);
    
    // Cargar Trades en tiempo real
    db.collection('trades').doc(currentUser.uid).collection('userTrades')
    .orderBy('date', 'asc').onSnapshot(snapshot => {
        trades = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
        renderDashboard();
    });
}

async function updateBalance(val) {
    startingBalance = Number(val);
    await db.collection('settings').doc(currentUser.uid).set({startingBalance});
    renderDashboard();
}

// NAVEGACIÓN Y LOGICA DE TRADES
const confList = [
  "Soporte o Resistencia fuerte con mas de 2 toques en M30 Y H1",
  "Velas envolventes",
  "Cierre de vela en M30",
  "Toma de liquidez",
  "Trafico limpio",
  "Rompimiento de Estructura",
  "Continuación de Estructura",
  "Cierre de vela M15 si hay bastante volumen"
];

function navigate(page) {
    if (page === "dashboard") renderDashboard();
    if (page === "newTrade") renderNewTrade();
    if (page === "calendar") renderCalendar();
    if (page === "stats") renderStats();
}

function renderNewTrade(editId = null) {
    let trade = editId ? trades.find(t => t.id === editId) : {};
    let savedConf = trade.confirmations || "";

    document.getElementById("dynamic-content").innerHTML = `
        <h1>${editId ? "Editar" : "Nuevo"} Trade</h1>
        <div class="card">
            <div class="input-row">
                <input id="date" type="date" value="${trade.date || new Date().toISOString().split("T")[0]}">
                <select id="session">
                    <option value="">Seleccionar Sesión</option>
                    <option ${trade.session==="New York"?"selected":""}>New York</option>
                    <option ${trade.session==="Tokyo"?"selected":""}>Tokyo</option>
                    <option ${trade.session==="Londres"?"selected":""}>Londres</option>
                </select>
                <input id="pair" placeholder="Par (ej: XAUUSD)" value="${trade.pair || ""}">
            </div>
            <div class="input-row">
                <select id="resultType">
                    <option value="">Resultado</option>
                    <option value="win" ${trade.resultType==="win"?"selected":""}>TP (Ganancia)</option>
                    <option value="loss" ${trade.resultType==="loss"?"selected":""}>SL (Pérdida)</option>
                    <option value="be" ${trade.resultType==="be"?"selected":""}>BE (Breakeven)</option>
                </select>
                <input id="riskAmount" type="number" placeholder="Riesgo ($)" value="${trade.riskAmount || ""}">
                <input id="result" type="number" placeholder="Resultado Final ($)" value="${Math.abs(trade.result) || ""}">
            </div>
            <select id="errorTag">
                <option value="none" ${trade.errorTag==="none"?"selected":""}>Trade Perfecto</option>
                <option value="fomo" ${trade.errorTag==="fomo"?"selected":""}>FOMO</option>
                <option value="overtrading" ${trade.errorTag==="overtrading"?"selected":""}>Overtrading</option>
                <option value="sl_moved" ${trade.errorTag==="sl_moved"?"selected":""}>Moví el Stop Loss</option>
                <option value="early_exit" ${trade.errorTag==="early_exit"?"selected":""}>Cierre Prematuro</option>
            </select>
            <div class="input-row">
                <input id="emoBefore" placeholder="Emociones ANTES" value="${trade.emoBefore || ""}">
                <input id="emoAfter" placeholder="Emociones DESPUÉS" value="${trade.emoAfter || ""}">
            </div>
            <div class="checklist-group">
                <h4 style="margin-top:0; color:#22c55e;">🔥 Confirmaciones</h4>
                ${confList.map(item => `<label class="checklist-item"><input type="checkbox" class="chk-conf" value="${item}" ${savedConf.includes(item)?'checked':''}> ${item}</label>`).join('')}
            </div>
            <input type="file" id="imageInput">
            <button onclick="processAndSave('${editId || ""}')" style="width:100%">Guardar en la Nube</button>
        </div>`;
}

async function processAndSave(editId) {
    const file = document.getElementById("imageInput").files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => saveTrade(editId, e.target.result);
        reader.readAsDataURL(file);
    } else {
        const existingImg = editId ? trades.find(t => t.id === editId).image : null;
        saveTrade(editId, existingImg);
    }
}

async function saveTrade(editId, imageData) {
    const resultType = document.getElementById("resultType").value;
    const resultVal = Math.abs(Number(document.getElementById("result").value));
    const riskVal = Math.abs(Number(document.getElementById("riskAmount").value));
    
    let finalResult = resultType === "win" ? resultVal : resultType === "loss" ? -resultVal : 0;
    let rrRatio = (resultType === "win" && riskVal > 0) ? (resultVal / riskVal).toFixed(2) : (resultType === "loss" ? -1 : 0);

    const tradeData = {
        date: document.getElementById("date").value,
        session: document.getElementById("session").value,
        pair: document.getElementById("pair").value,
        resultType: resultType,
        riskAmount: riskVal,
        result: finalResult,
        rrRatio: Number(rrRatio),
        errorTag: document.getElementById("errorTag").value,
        emoBefore: document.getElementById("emoBefore").value,
        emoAfter: document.getElementById("emoAfter").value,
        confirmations: Array.from(document.querySelectorAll('.chk-conf:checked')).map(cb => "• " + cb.value).join('\n'),
        image: imageData
    };

    const userTradesRef = db.collection('trades').doc(currentUser.uid).collection('userTrades');
    
    if (editId) {
        await userTradesRef.doc(editId).update(tradeData);
    } else {
        await userTradesRef.add(tradeData);
    }
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

    document.getElementById("dynamic-content").innerHTML = `
        <h1>DASHBOARD</h1>
        <div class="card" style="display: flex; gap: 15px; align-items: center; background: #0e1626;">
            <label style="color: #9ca3af; font-weight: bold;">Capital Inicial ($):</label>
            <input type="number" value="${startingBalance}" onchange="updateBalance(this.value)" style="width: 150px; margin: 0;">
        </div>
        <div class="stats-container">
            <div class="stat-card"><h3>Balance Actual</h3><span class="value ${currentBalance >= startingBalance ? 'green' : 'red'}">$${currentBalance.toFixed(2)}</span></div>
            <div class="stat-card"><h3>Drawdown</h3><span class="value red">-$${drawdown.toFixed(2)}</span><p style="font-size:13px; margin-top:5px;">${drawdownPercent}% desde el pico</p></div>
        </div>
        <div class="card"><canvas id="equityChart"></canvas></div>
        <button onclick="exportData()" style="background:#3b82f6;">📥 Exportar a Excel</button>`;

    if (equityChart) equityChart.destroy();
    equityChart = new Chart(document.getElementById("equityChart"), {
        type: "line",
        data: {
            labels: ["Inicio", ...trades.map((_, i) => "T" + (i + 1))],
            datasets: [{ label: "Capital", data: equityData, borderColor: "#22c55e", fill: true, backgroundColor: "rgba(34,197,94,0.1)" }]
        }
    });
}

function renderCalendar() {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const monthName = firstDay.toLocaleString("es-ES", { month: "long" }).toUpperCase();
    
    let html = `<h1><button onclick="changeMonth(-1)">◀</button> ${monthName} ${currentYear} <button onclick="changeMonth(1)">▶</button></h1><div class="calendar">`;
    const headers = ["Dom","Lun","Mar","Mie","Jue","Vie","Sab","Σ"];
    headers.forEach(h => html += `<div class="calendar-header">${h}</div>`);
    
    let startDay = firstDay.getDay();
    for (let i = 0; i < startDay; i++) html += `<div></div>`;
    
    let weekSum = 0;
    for (let d = 1; d <= lastDay.getDate(); d++) {
        const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        const dayTrades = trades.filter(t => t.date === dateStr);
        const dayTotal = dayTrades.reduce((a, t) => a + t.result, 0);
        weekSum += dayTotal;
        
        let bg = dayTotal > 0 ? "#14532d" : dayTotal < 0 ? "#7f1d1d" : "#1e293b";
        html += `<div onclick="showDayTrades('${dateStr}')" style="background:${bg}">
                    <strong>${d}</strong><br>
                    <span style="font-size:10px;">${dayTrades.length} Trades</span><br>
                    <strong>$${dayTotal.toFixed(2)}</strong>
                 </div>`;

        if ((startDay + d) % 7 === 0 || d === lastDay.getDate()) {
            if (d === lastDay.getDate() && (startDay + d) % 7 !== 0) {
                let rem = 7 - ((startDay + d) % 7);
                for(let r=0; r<rem; r++) html += `<div></div>`;
            }
            html += `<div class="calendar-header" style="background:#0e1626 !important; border:1px solid #1f2937 !important; color:white;">$${weekSum.toFixed(2)}</div>`;
            weekSum = 0;
        }
    }
    document.getElementById("dynamic-content").innerHTML = html + "</div>";
}

function showDayTrades(dateStr) {
    let html = `<h1>Trades del ${dateStr}</h1>`;
    const dayTrades = trades.filter(t => t.date === dateStr);
    dayTrades.forEach(t => {
        const resColor = t.resultType === "win" ? "green" : t.resultType === "loss" ? "red" : "blue";
        html += `
            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h2 style="margin:0;">${t.pair} <span class="${resColor}">(${t.resultType.toUpperCase()})</span></h2>
                    <span class="orange">Error: ${t.errorTag.toUpperCase()}</span>
                </div>
                <hr style="border: 0.5px solid #1f2937; margin: 15px 0;">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                    <div>
                        <p><strong>Resultado:</strong> <span class="${resColor}">$${t.result}</span></p>
                        <p><strong>Riesgo:</strong> $${t.riskAmount}</p>
                        <p><strong>Ratio R:R:</strong> 1:${t.rrRatio}</p>
                    </div>
                    <div>
                        <p><strong>Emociones:</strong> ${t.emoBefore} ➡️ ${t.emoAfter}</p>
                        <p><strong>Sesión:</strong> ${t.session}</p>
                    </div>
                </div>
                <div style="margin-top:15px; padding:15px; background:#0f172a; border-radius:8px;">
                    <strong>Confirmaciones:</strong><br>
                    <p style="white-space: pre-wrap; margin-top:10px;">${t.confirmations}</p>
                </div>
                ${t.image ? `<img src="${t.image}" class="trade-image" onclick="openImage('${t.image}')">` : ""}
                <div style="margin-top:20px;">
                    <button onclick="renderNewTrade('${t.id}')">Editar</button>
                    <button class="delete" onclick="deleteTrade('${t.id}')">Eliminar</button>
                </div>
            </div>`;
    });
    html += `<button onclick="renderCalendar()" style="width:100%">Volver al Calendario</button>`;
    document.getElementById("dynamic-content").innerHTML = html;
}

async function deleteTrade(id) {
    if(confirm("¿Seguro que quieres eliminar este trade?")) {
        await db.collection('trades').doc(currentUser.uid).collection('userTrades').doc(id).delete();
    }
}

function renderStats() {
    const wins = trades.filter(t => t.resultType === "win").length;
    const losses = trades.filter(t => t.resultType === "loss").length;
    const total = wins + losses;
    const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : 0;
    const lossByErrors = trades.filter(t => t.errorTag !== "none" && t.result < 0).reduce((a, t) => a + Math.abs(t.result), 0);
    const netProfit = trades.reduce((a, t) => a + t.result, 0);

    document.getElementById("dynamic-content").innerHTML = `
        <h1>Análisis Pro</h1>
        <div class="stats-container">
            <div class="stat-card">🎯 <h3>Win Rate</h3><span class="value green">${winRate}%</span></div>
            <div class="stat-card">⚠️ <h3>Pérdida por Errores</h3><span class="value red">$${lossByErrors.toFixed(2)}</span></div>
            <div class="stat-card">💰 <h3>Beneficio Neto</h3><span class="value ${netProfit >= 0 ? 'green' : 'red'}">$${netProfit.toFixed(2)}</span></div>
        </div>`;
}

function exportData() {
    let csvContent = "data:text/csv;charset=utf-8,Fecha,Sesion,Par,Resultado,Monto,Riesgo,Ratio_RR,Error,Confirmaciones\n";
    trades.forEach(t => {
        let conf = (t.confirmations || "").replace(/\n/g, " | ");
        csvContent += `${t.date},${t.session},${t.pair},${t.resultType},${t.result},${t.riskAmount},${t.rrRatio},${t.errorTag},"${conf}"\n`;
    });
    window.open(encodeURI(csvContent));
}

function openImage(src) { document.getElementById("modalImg").src = src; document.getElementById("imgModal").style.display = "flex"; }
function changeMonth(dir) { currentMonth+=dir; if(currentMonth>11){currentMonth=0;currentYear++;} if(currentMonth<0){currentMonth=11;currentYear--;} renderCalendar(); }