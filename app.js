// TU CONFIGURACIÓN DE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyBxiDprPh1U1bdSgnxNkgmeC4jnrp1JrhM",
  authDomain: "fx-journal-pro-2dc77.firebaseapp.com",
  projectId: "fx-journal-pro-2dc77",
  storageBucket: "fx-journal-pro-2dc77.firebasestorage.app",
  messagingSenderId: "118220289038",
  appId: "1:118220289038:web:0213b442d3bb729b4ab85f",
  measurementId: "G-5PK41BQGV2"
};

// INICIALIZAR FIREBASE
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let trades = [];
let startingBalance = 500;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let equityChart = null;
let currentUser = null;

// CONTROL DE AUTENTICACIÓN
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('sidebar').style.display = 'block';
        document.getElementById('main-content').style.display = 'block';
        loadUserData();
    } else {
        document.getElementById('auth-container').style.display = 'block';
        document.getElementById('sidebar').style.display = 'none';
        document.getElementById('main-content').style.display = 'none';
    }
});

// FUNCIONES DE LOGIN/REGISTRO
async function register() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    try {
        await auth.createUserWithEmailAndPassword(email, pass);
        alert("Cuenta creada con éxito");
    } catch (e) { alert(e.message); }
}

async function login() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (e) { alert("Error al iniciar sesión: " + e.message); }
}

function logout() { auth.signOut(); }

// CARGAR DATOS DESDE LA NUBE (FIRESTORE)
async function loadUserData() {
    const doc = await db.collection('settings').doc(currentUser.uid).get();
    if (doc.exists) startingBalance = doc.data().startingBalance;
    
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

    document.getElementById("content").innerHTML = `
        <h1>${editId ? "Editar" : "Nuevo"} Trade</h1>
        <div class="card">
            <div class="input-row">
                <input id="date" type="date" value="${trade.date || new Date().toISOString().split("T")[0]}">
                <select id="session">
                    <option value="">Sesión</option>
                    <option ${trade.session==="New York"?"selected":""}>New York</option>
                    <option ${trade.session==="Tokyo"?"selected":""}>Tokyo</option>
                    <option ${trade.session==="Londres"?"selected":""}>Londres</option>
                </select>
                <input id="pair" placeholder="Par (ej: XAUUSD)" value="${trade.pair || ""}">
            </div>
            <div class="input-row">
                <select id="resultType">
                    <option value="win" ${trade.resultType==="win"?"selected":""}>TP</option>
                    <option value="loss" ${trade.resultType==="loss"?"selected":""}>SL</option>
                    <option value="be" ${trade.resultType==="be"?"selected":""}>BE</option>
                </select>
                <input id="riskAmount" type="number" placeholder="Riesgo ($)" value="${trade.riskAmount || ""}">
                <input id="result" type="number" placeholder="Resultado ($)" value="${Math.abs(trade.result) || ""}">
            </div>
            <div class="input-row">
                <input id="emoBefore" placeholder="Emoción Antes" value="${trade.emoBefore || ""}">
                <input id="emoAfter" placeholder="Emoción Después" value="${trade.emoAfter || ""}">
            </div>
            <div class="checklist-group">
                <h4 style="color:#22c55e;">🔥 Confirmaciones</h4>
                ${confList.map(item => `<label class="checklist-item"><input type="checkbox" class="chk-conf" value="${item}" ${savedConf.includes(item)?'checked':''}> ${item}</label>`).join('')}
            </div>
            <button onclick="saveTrade('${editId || ""}')" style="width:100%">Guardar en la Nube</button>
        </div>`;
}

async function saveTrade(editId) {
    const resultType = document.getElementById("resultType").value;
    const resultVal = Math.abs(Number(document.getElementById("result").value));
    const tradeData = {
        date: document.getElementById("date").value,
        session: document.getElementById("session").value,
        pair: document.getElementById("pair").value,
        resultType: resultType,
        riskAmount: Number(document.getElementById("riskAmount").value),
        result: resultType === "win" ? resultVal : resultType === "loss" ? -resultVal : 0,
        emoBefore: document.getElementById("emoBefore").value,
        emoAfter: document.getElementById("emoAfter").value,
        confirmations: Array.from(document.querySelectorAll('.chk-conf:checked')).map(cb => "• " + cb.value).join('\n')
    };

    if (editId) {
        await db.collection('trades').doc(currentUser.uid).collection('userTrades').doc(editId).update(tradeData);
    } else {
        await db.collection('trades').doc(currentUser.uid).collection('userTrades').add(tradeData);
    }
    navigate("dashboard");
}

function renderDashboard() {
    let currentBalance = startingBalance;
    let equityData = [startingBalance];
    trades.forEach(t => { currentBalance += t.result; equityData.push(currentBalance); });

    document.getElementById("content").innerHTML = `
        <h1>Dashboard</h1>
        <div class="card" style="display:flex; align-items:center; gap:20px;">
            <label>Capital Inicial:</label>
            <input type="number" value="${startingBalance}" onchange="updateBalance(this.value)" style="width:120px; margin:0;">
            <h2 style="margin:0;">Balance: <span class="${currentBalance>=startingBalance?'green':'red'}">$${currentBalance.toFixed(2)}</span></h2>
        </div>
        <div class="card"><canvas id="equityChart"></canvas></div>`;

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
        html += `<div onclick="showDayTrades('${dateStr}')" style="background:${bg}"><strong>${d}</strong><br><strong>$${dayTotal.toFixed(2)}</strong></div>`;
        if ((startDay + d) % 7 === 0 || d === lastDay.getDate()) {
            if (d === lastDay.getDate() && (startDay + d) % 7 !== 0) {
                let rem = 7 - ((startDay + d) % 7);
                for(let r=0; r<rem; r++) html += `<div></div>`;
            }
            html += `<div class="calendar-header" style="background:#0e1626 !important; border:1px solid #1f2937 !important; color:white;">$${weekSum.toFixed(2)}</div>`;
            weekSum = 0;
        }
    }
    document.getElementById("content").innerHTML = html + "</div>";
}

function showDayTrades(dateStr) {
    const dayTrades = trades.filter(t => t.date === dateStr);
    let html = `<h1>Trades del ${dateStr}</h1>`;
    dayTrades.forEach(t => {
        html += `<div class="card">
            <h3>${t.pair} (${t.resultType.toUpperCase()}) - $${t.result}</h3>
            <p><strong>Confirmaciones:</strong><br>${t.confirmations.replace(/\n/g, '<br>')}</p>
            <button onclick="renderNewTrade('${t.id}')">Editar</button>
            <button class="delete" onclick="deleteTrade('${t.id}')">Eliminar</button>
        </div>`;
    });
    html += `<button onclick="renderCalendar()" style="width:100%">Volver</button>`;
    document.getElementById("content").innerHTML = html;
}

async function deleteTrade(id) {
    if(confirm("¿Seguro?")) {
        await db.collection('trades').doc(currentUser.uid).collection('userTrades').doc(id).delete();
    }
}

function changeMonth(dir) { currentMonth+=dir; if(currentMonth>11){currentMonth=0;currentYear++;} if(currentMonth<0){currentMonth=11;currentYear--;} renderCalendar(); }
function renderStats() {
    const wins = trades.filter(t => t.resultType === "win").length;
    const losses = trades.filter(t => t.resultType === "loss").length;
    const winRate = (wins+losses) > 0 ? ((wins / (wins+losses)) * 100).toFixed(1) : 0;
    document.getElementById("content").innerHTML = `<h1>Estadísticas</h1><div class="stat-card"><h3>Win Rate Global</h3><span class="value green">${winRate}%</span></div>`;
}