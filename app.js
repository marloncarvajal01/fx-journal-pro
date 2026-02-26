let trades = JSON.parse(localStorage.getItem("trades")) || [];
let startingBalance = Number(localStorage.getItem("startingBalance")) || 500;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let equityChart = null;

function saveData() { localStorage.setItem("trades", JSON.stringify(trades)); }
function updateBalance(val) { startingBalance = Number(val); localStorage.setItem("startingBalance", startingBalance); renderDashboard(); }

function navigate(page) {
  if (page === "dashboard") renderDashboard();
  if (page === "newTrade") renderNewTrade();
  if (page === "history") renderCalendar();
  if (page === "stats") renderStats();
  if (page === "calendar") renderCalendar();
}

// Lista simplificada solo con Confirmaciones
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

function renderNewTrade(editIndex = null) {
  let trade = editIndex !== null ? trades[editIndex] : {};
  let savedConf = trade.confirmations || "";

  document.getElementById("content").innerHTML = `
    <h1>${editIndex !== null ? "Editar" : "Nuevo"} Trade</h1>
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
        <input id="result" type="number" placeholder="Resultado Final ($)" value="${trade.result || ""}">
      </div>

      <select id="errorTag">
        <option value="none" ${trade.errorTag==="none"?"selected":""}>Trade Perfecto</option>
        <option value="fomo" ${trade.errorTag==="fomo"?"selected":""}>FOMO</option>
        <option value="overtrading" ${trade.errorTag==="overtrading"?"selected":""}>Overtrading</option>
        <option value="sl_moved" ${trade.errorTag==="sl_moved"?"selected":""}>Moví el Stop Loss</option>
        <option value="early_exit" ${trade.errorTag==="early_exit"?"selected":""}>Cierre Prematuro</option>
      </select>
      
      <div class="input-row">
        <input id="emoBefore" placeholder="Emociones ANTES del trade" value="${trade.emoBefore || ""}">
        <input id="emoAfter" placeholder="Emociones DESPUÉS del trade" value="${trade.emoAfter || ""}">
      </div>

      <div class="checklist-group">
        <h4 style="margin-top:0; color:#22c55e; margin-bottom: 15px;">🔥 Confirmaciones de Entrada</h4>
        ${confList.map(item => `<label class="checklist-item"><input type="checkbox" class="chk-conf" value="${item}" ${savedConf.includes(item)?'checked':''}> ${item}</label>`).join('')}
      </div>

      <input type="file" id="imageInput">
      <button onclick="saveTrade(${editIndex})">Guardar Trade</button>
    </div>
  `;
}

function saveTrade(editIndex) {
  const pair = document.getElementById("pair").value;
  const resultType = document.getElementById("resultType").value;
  const resultVal = Math.abs(Number(document.getElementById("result").value));
  const riskVal = Math.abs(Number(document.getElementById("riskAmount").value));
  const errorTag = document.getElementById("errorTag").value;
  const emoBefore = document.getElementById("emoBefore").value;
  const emoAfter = document.getElementById("emoAfter").value;
  const date = document.getElementById("date").value;
  const session = document.getElementById("session").value;
  const imageFile = document.getElementById("imageInput").files[0];
  
  const checkedBoxes = Array.from(document.querySelectorAll('.chk-conf:checked')).map(cb => "• " + cb.value);
  const confirmations = checkedBoxes.join('\n');

  let finalResult = resultType === "win" ? resultVal : resultType === "loss" ? -resultVal : 0;
  let rrRatio = (resultType === "win" && riskVal > 0) ? (resultVal / riskVal).toFixed(2) : (resultType === "loss" ? -1 : 0);

  if (imageFile) {
    const reader = new FileReader();
    reader.onload = (e) => saveFinal(e.target.result);
    reader.readAsDataURL(imageFile);
  } else {
    saveFinal(editIndex !== null ? trades[editIndex].image : null);
  }

  function saveFinal(imageData) {
    const newTrade = { pair, result: finalResult, resultType, date, session, confirmations, emoBefore, emoAfter, image: imageData, riskAmount: riskVal, rrRatio: Number(rrRatio), errorTag };
    if (editIndex !== null) trades[editIndex] = newTrade;
    else trades.push(newTrade);
    saveData();
    navigate("dashboard");
  }
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
                <p><strong>Sesión:</strong> ${t.session || "N/A"}</p>
            </div>
            <div>
                <p><strong>Emoción Antes:</strong> ${t.emoBefore || "No registrada"}</p>
                <p><strong>Emoción Después:</strong> ${t.emoAfter || "No registrada"}</p>
            </div>
        </div>
        <div style="margin-top:15px; padding:15px; background:#0f172a; border-radius:8px;">
            <strong>Confirmaciones del Trade:</strong><br>
            <p style="white-space: pre-wrap; margin-top:10px; line-height: 1.5;">${t.confirmations || "Sin confirmaciones registradas."}</p>
        </div>
        ${t.image ? `<img src="${t.image}" class="trade-image" onclick="openImage('${t.image}')">` : ""}
        <div style="margin-top:20px;">
            <button onclick="renderNewTrade(${trades.indexOf(t)})">Editar</button>
            <button class="delete" onclick="deleteTrade(${trades.indexOf(t)}); renderCalendar();">Eliminar</button>
        </div>
      </div>`;
  });
  html += `<button onclick="renderCalendar()" style="width:100%">Volver al Calendario</button>`;
  document.getElementById("content").innerHTML = html;
}

// ... (renderCalendar, renderStats, renderDashboard, exportData se mantienen igual) ...

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
    html += `<div onclick="showDayTrades('${dateStr}')" style="background:${bg}"><strong>${d}</strong><br><span style="font-size:10px;">${dayTrades.length} Trades</span><br><strong>$${dayTotal.toFixed(2)}</strong></div>`;
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

function renderStats() {
  const wins = trades.filter(t => t.resultType === "win").length;
  const losses = trades.filter(t => t.resultType === "loss").length;
  const totalTrades = wins + losses;
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : 0;
  const lossByErrors = trades.filter(t => t.errorTag !== "none" && t.result < 0).reduce((a, t) => a + Math.abs(t.result), 0);
  const netProfit = trades.reduce((a, t) => a + t.result, 0);
  document.getElementById("content").innerHTML = `
    <h1>Análisis de Rendimiento</h1>
    <div class="stats-container">
      <div class="stat-card">🎯 <h3>Win Rate</h3><span class="value green">${winRate}%</span></div>
      <div class="stat-card">⚠️ <h3>Pérdida por Errores</h3><span class="value red">$${lossByErrors.toFixed(2)}</span></div>
      <div class="stat-card">💰 <h3>Beneficio Neto</h3><span class="value ${netProfit >= 0 ? 'green' : 'red'}">$${netProfit.toFixed(2)}</span></div>
    </div>`;
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
  let netProfit = currentBalance - startingBalance;

  document.getElementById("content").innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 25px;">
        <h1 style="margin:0;">DASHBOARD</h1>
        <button onclick="exportData()" style="width:auto; background:#3b82f6; display:flex; align-items:center; gap:8px;">
           📥 Exportar a Excel
        </button>
    </div>
    
    <div class="card" style="display: flex; gap: 15px; align-items: center; background: #0e1626;">
      <label style="color: #9ca3af; font-weight: bold;">Capital Inicial ($):</label>
      <input type="number" value="${startingBalance}" onchange="updateBalance(this.value)" style="width: 150px; margin: 0;">
    </div>

    <div class="stats-container" style="margin-top: 0; margin-bottom: 25px;">
      <div class="stat-card">
        <h3>Balance Actual</h3>
        <span class="value ${currentBalance >= startingBalance ? 'green' : 'red'}">$${currentBalance.toFixed(2)}</span>
        <p style="font-size:13px; margin-top:10px;">Beneficio: $${netProfit.toFixed(2)}</p>
      </div>
      <div class="stat-card">
        <h3>Drawdown Actual</h3>
        <span class="value red">-$${drawdown.toFixed(2)}</span>
        <p style="font-size:13px; margin-top:10px;">${drawdownPercent}% desde el pico histórico</p>
      </div>
    </div>

    <div class="card"><canvas id="equityChart"></canvas></div>
  `;

  if (equityChart) equityChart.destroy();
  equityChart = new Chart(document.getElementById("equityChart"), { 
      type: "line", 
      data: { 
          labels: ["Inicio", ...trades.map((_, i) => "T" + (i + 1))], 
          datasets: [{ label: "Crecimiento del Capital", data: equityData, borderColor: "#22c55e", fill: true, backgroundColor: "rgba(34,197,94,0.1)" }] 
      } 
  });
}

function exportData() {
  let csvContent = "data:text/csv;charset=utf-8,Fecha,Sesion,Par,Resultado,Monto,Riesgo,Ratio_RR,Error,Confirmaciones\n";
  trades.forEach(t => {
      let confLimpio = (t.confirmations || "").replace(/\n/g, " | ");
      let row = `${t.date},${t.session},${t.pair},${t.resultType},${t.result},${t.riskAmount},${t.rrRatio},${t.errorTag},"${confLimpio}"`;
      csvContent += row + "\n";
  });
  let encodedUri = encodeURI(csvContent);
  let link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Mi_Journal_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function openImage(src) { document.getElementById("modalImg").src = src; document.getElementById("imgModal").style.display = "flex"; }
function changeMonth(dir) { currentMonth+=dir; if(currentMonth>11){currentMonth=0;currentYear++;} if(currentMonth<0){currentMonth=11;currentYear--;} renderCalendar(); }
function deleteTrade(index) { trades.splice(index,1); saveData(); }
navigate("dashboard");