const STORAGE_KEY = "escuelaEnAccionDemoV1";
const INITIAL_STATE = {
  points: 0,
  totalEarnedPoints: 0,
  completedMissions: [],
  missionRewards: {},
  redemptions: [],
  history: [],
  teamPoints: 750
};
const missions = [
  { id: "recycle", title: "Separar y reciclar residuos", category: "ambiente", label: "Ambiente", description: "Clasificá los residuos del aula y llevá los reciclables al punto verde.", points: 50, icon: "♧", tone: "teal", duration: "10–15 min" },
  { id: "classroom", title: "Dejar el aula ordenada", category: "orden", label: "Orden", description: "Acomodá las sillas, guardá los materiales y dejá las mesas despejadas.", points: 100, icon: "⌂", tone: "gold", duration: "10 min" },
  { id: "blackboard", title: "Limpiar el pizarrón", category: "limpieza", label: "Limpieza", description: "Dejá el pizarrón limpio y listo para la próxima clase.", points: 30, icon: "▤", tone: "coral", duration: "5 min" },
  { id: "courtyard", title: "Cuidar el patio", category: "limpieza", label: "Limpieza", description: "Recorré el sector asignado y juntá los residuos visibles con los elementos adecuados.", points: 80, icon: "✿", tone: "teal", duration: "15 min" },
  { id: "report", title: "Informar un desperfecto", category: "mantenimiento", label: "Mantenimiento", description: "Avisá a un adulto responsable sobre una luminaria, canilla o mueble que necesite revisión.", points: 70, icon: "⚙", tone: "violet", duration: "5 min" },
  { id: "library", title: "Ordenar la biblioteca", category: "orden", label: "Orden", description: "Acomodá libros y materiales en el lugar indicado, siguiendo las instrucciones del encargado.", points: 60, icon: "▥", tone: "gold", duration: "10–15 min" },
  { id: "plants", title: "Cuidar las plantas", category: "ambiente", label: "Ambiente", description: "Regá las plantas del sector indicado y revisá que el espacio quede limpio.", points: 40, icon: "❋", tone: "teal", duration: "8 min" },
  { id: "materials", title: "Organizar materiales compartidos", category: "mantenimiento", label: "Mantenimiento", description: "Revisá que los materiales comunes estén completos y guardados correctamente.", points: 90, icon: "▣", tone: "violet", duration: "12 min" }
];
const physicalRewards = [
  { id: "study-basic", title: "Kit de estudio básico", description: "Cuaderno, carpeta, lapiceras, lápiz, goma y regla para el día a día escolar.", cost: 1000, icon: "✎", art: "", tag: "Básica" },
  { id: "study-medium", title: "Kit de estudio mediano", description: "Incluye el kit básico más resaltadores, fibras, hojas, separadores y cartuchera.", cost: 2000, icon: "▤", art: "gold-art", tag: "Mediana" },
  { id: "study-large", title: "Kit de estudio grande", description: "Kit completo con mochila escolar y calculadora científica básica, según disponibilidad.", cost: 3000, icon: "🎒", art: "violet-art", tag: "Grande" }
];
// Los primeros niveles conservan la progresión original; luego se avanza de a 500 puntos hasta el nivel 20.
const levelSteps = [0, 300, 650, 1000, 1500, 2200, 3000, ...Array.from({ length: 13 }, (_, index) => 3500 + index * 500)];
const MAX_LEVEL = 20;
const classmates = [
  { name: "Camila M.", initials: "CM", points: 1480, level: 5 },
  { name: "Julián R.", initials: "JR", points: 1360, level: 4 },
  { name: "Vos", initials: "ES", points: 1250, level: 4, current: true },
  { name: "Florencia C.", initials: "FC", points: 1110, level: 4 },
  { name: "Mateo G.", initials: "MG", points: 980, level: 3 }
];
let state = loadState();
let activeFilter = "todas";
let pendingAction = null;
let toastTimer;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Number.isFinite(saved.points) && Array.isArray(saved.completedMissions) && Array.isArray(saved.history)) {
      // Compatibilidad con datos guardados antes de agregar niveles hasta el 20.
      const earnedFromHistory = saved.history.reduce((total, entry) => total + Math.max(0, Number(entry.points) || 0), 0);
      saved.totalEarnedPoints = Math.max(saved.points, Number(saved.totalEarnedPoints) || 0, earnedFromHistory);
      saved.missionRewards = saved.missionRewards && typeof saved.missionRewards === "object" ? saved.missionRewards : {};
      // Las misiones completadas antes de este cambio conservaron su puntaje base.
      missions.forEach(mission => {
        if (saved.completedMissions.includes(mission.id) && !Number.isFinite(saved.missionRewards[mission.id])) {
          saved.missionRewards[mission.id] = mission.points;
        }
      });
      return saved;
    }
  } catch (error) { console.warn("No se pudieron leer los datos guardados.", error); }
  return structuredClone(INITIAL_STATE);
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function formatPoints(value) { return new Intl.NumberFormat("es-AR").format(value); }
function escapeHTML(value) { return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
function currentLevel() {
  const earned = state.totalEarnedPoints ?? state.points;
  let level = 1;
  for (let i = 0; i < levelSteps.length; i++) if (earned >= levelSteps[i]) level = i + 1;
  level = Math.min(MAX_LEVEL, level);
  const start = levelSteps[level - 1] ?? 0;
  const next = levelSteps[level] ?? levelSteps[levelSteps.length - 1] + 500;
  const percent = level === MAX_LEVEL && earned >= next ? 100 : Math.min(100, Math.max(0, Math.round(((earned - start) / (next - start)) * 100)));
  return { level, start, next, percent, bonus: Math.min(19, level - 1) };
}
function missionPoints(mission) {
  return mission.points + currentLevel().bonus;
}
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}
function addHistory(title, type, points, evidenceUrl = null) {
  state.history.unshift({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), title, type, points, evidenceUrl, date: new Date().toISOString() });
}
function updateDashboard() {
  const level = currentLevel();
  const completed = state.completedMissions.length;
  const teamPercent = Math.min(100, Math.round((state.teamPoints / 1000) * 100));
  document.getElementById("points-total").textContent = formatPoints(state.points);
  document.getElementById("level-value").textContent = `Nivel ${level.level}`;
  document.getElementById("level-progress").style.width = `${level.percent}%`;
  document.getElementById("level-caption").textContent = level.level === MAX_LEVEL
    ? `Nivel máximo · +${level.bonus} pts extra por misión`
    : `Próximo nivel: ${formatPoints(level.next)} pts acumulados · +${level.bonus} por misión`;
  document.getElementById("completed-total").textContent = completed;
  document.getElementById("sidebar-level").textContent = level.level;
  document.getElementById("mission-count").textContent = missions.filter(m => !state.completedMissions.includes(m.id)).length;
  document.getElementById("team-progress-number").textContent = `${teamPercent}%`;
  document.getElementById("team-progress-bar").style.width = `${teamPercent}%`;
  const teamNumber = document.querySelector(".team-progress-row span");
  if (teamNumber) teamNumber.textContent = `${formatPoints(state.teamPoints)} / 1.000 pts`;
  ["mission-balance", "reward-balance"].forEach(id => document.getElementById(id).textContent = formatPoints(state.points));
  document.getElementById("activity-balance").textContent = `${formatPoints(state.points)} pts`;
  document.getElementById("activity-missions").textContent = completed;
  document.getElementById("activity-redemptions").textContent = state.redemptions.length;
  document.querySelectorAll("[data-mission-count]").forEach(node => node.textContent = completed);
}
function missionMarkup(mission, compact = false) {
  const completed = state.completedMissions.includes(mission.id);
  const symbol = `<span class="mission-symbol ${mission.tone}">${mission.icon}</span>`;
  const rewardPoints = completed && Number.isFinite(state.missionRewards?.[mission.id]) ? state.missionRewards[mission.id] : missionPoints(mission);
  if (compact) return `<article class="mission-row">${symbol}<div class="mission-info"><strong>${escapeHTML(mission.title)}</strong><small>${escapeHTML(mission.label)} · ${mission.duration}</small></div><span class="mission-reward">+${rewardPoints} pts</span>${completed ? '<span class="mission-status">Hecha ✓</span>' : ''}</article>`;
  return `<article class="mission-card"><div class="mission-card-head">${symbol}<span class="category-chip">${escapeHTML(mission.label)}</span></div><h3>${escapeHTML(mission.title)}</h3><p>${escapeHTML(mission.description)}</p><div class="mission-card-bottom"><span class="points-tag">+${rewardPoints} pts</span><button class="button button-primary small-button" data-complete="${mission.id}" ${completed ? "disabled" : ""}>${completed ? "Completada ✓" : "Completar con foto"}</button></div></article>`;
}
function renderMissions() {
  document.getElementById("home-missions").innerHTML = missions.filter(m => !state.completedMissions.includes(m.id)).slice(0, 3).map(m => missionMarkup(m, true)).join("") || '<p class="muted">¡Completaste todas las misiones disponibles!</p>';
  const filtered = missions.filter(m => activeFilter === "todas" || m.category === activeFilter);
  document.getElementById("all-missions").innerHTML = filtered.map(m => missionMarkup(m)).join("");
  document.querySelectorAll(".filter-button").forEach(button => button.classList.toggle("selected", button.dataset.filter === activeFilter));
}
function rewardMarkup(reward) {
  const affordable = state.points >= reward.cost;
  return `<article class="reward-card"><div class="reward-art ${reward.art}">${reward.icon}</div><div class="reward-body"><span class="category-chip">${reward.tag}</span><h3>${escapeHTML(reward.title)}</h3><p>${escapeHTML(reward.description)}</p><div class="reward-card-foot"><span class="cost">${formatPoints(reward.cost)} pts</span><button class="button button-primary small-button" data-redeem="${reward.id}" ${affordable ? "" : "disabled"}>${affordable ? "Canjear" : "Te faltan puntos"}</button></div></div></article>`;
}
function renderRewards() {
  document.getElementById("physical-rewards").innerHTML = physicalRewards.map(rewardMarkup).join("");
}
function renderRanking() {
  const list = classmates.map(person => ({ ...person, points: person.current ? state.points : person.points }));
  list.sort((a, b) => b.points - a.points);
  document.getElementById("ranking-list").innerHTML = list.map((person, index) => `<div class="ranking-row"><span class="rank-number">${index + 1}</span><div class="rank-person"><span class="rank-avatar">${person.initials}</span><div><strong>${person.name}${person.current ? " (vos)" : ""}</strong><small>${person.current ? "Tu posición actual" : "Participante"}</small></div></div><span class="rank-level">Nivel ${person.current ? currentLevel().level : person.level}</span><span class="rank-points">${formatPoints(person.points)} pts</span></div>`).join("");
}
function renderActivity() {
  const rows = document.getElementById("activity-rows");
  const empty = document.getElementById("activity-empty");
  rows.innerHTML = state.history.map(entry => {
    const date = new Date(entry.date).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
    const isGain = entry.points > 0;
    const type = entry.type === "redeem" ? "Canje" : entry.type === "initial" ? "Inicial" : "Misión";
    const badge = entry.type === "redeem" ? "type-badge redeem" : "type-badge";
    const points = `${isGain ? "+" : "−"}${formatPoints(Math.abs(entry.points))} pts`;
    const evidence = entry.evidenceUrl ? ` <a class="evidence-link" href="${escapeHTML(entry.evidenceUrl)}" target="_blank" rel="noopener">Ver foto</a>` : "";
    return `<tr><td>${escapeHTML(entry.title)}${evidence}</td><td>${date}</td><td><span class="${badge}">${type}</span></td><td class="align-right ${isGain ? "gain" : "spent"}">${points}</td></tr>`;
  }).join("");
  empty.hidden = state.history.length > 0;
  document.querySelector(".activity-table-wrap").hidden = state.history.length === 0;
}
function renderAll() {
  updateDashboard();
  renderMissions();
  renderRewards();
  renderRanking();
  renderActivity();
}
function navigate(page) {
  const title = { inicio: "Inicio", misiones: "Misiones", recompensas: "Recompensas", ranking: "Ranking", actividad: "Mi actividad" }[page] || "Inicio";
  document.querySelectorAll(".page-section").forEach(section => section.classList.toggle("active-page", section.dataset.section === page));
  document.querySelectorAll(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.page === page));
  document.getElementById("breadcrumb-current").textContent = title;
  closeSidebar();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("show");
}
function showModal({ mark = "✦", eyebrow, title, description, extra = "", confirmText = "Confirmar", action }) {
  pendingAction = action;
  document.getElementById("modal-mark").textContent = mark;
  document.getElementById("modal-eyebrow").textContent = eyebrow;
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-description").textContent = description;
  document.getElementById("modal-extra").innerHTML = extra;
  document.getElementById("modal-confirm").textContent = confirmText;
  document.getElementById("action-modal").showModal();
}
const activeMissionSessions = new Set();
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function startMission(id) {
  const mission = missions.find(item => item.id === id);
  if (!mission || state.completedMissions.includes(id) || activeMissionSessions.has(id)) return;

  const earnedPoints = missionPoints(mission);
  activeMissionSessions.add(id);

  // Abrimos el modal inmediatamente al tocar el botón de la misión.
  // El QR se inserta en ese mismo modal apenas el servidor crea la sesión.
  const qrMarkup = `<div class="qr-session">
    <div class="qr-code-frame"><div id="mission-qr"><span class="qr-loading">Generando código QR…</span></div></div>
    <div class="qr-instructions"><strong>1. Conectá la computadora y el celular a la misma Wi-Fi.</strong><span>2. Escaneá este código con la cámara del celular.</span><span>3. Sacá una foto de la tarea terminada y enviála.</span></div>
    <div class="qr-status" id="photo-session-status" role="status" aria-live="polite"><span class="qr-wait-dot"></span> Preparando la misión y el código QR…</div>
    <div class="qr-manual" id="qr-manual-link" hidden></div>
    <small class="qr-expiration">El código vence en 30 minutos. No cierres el servidor de la computadora.</small>
  </div>`;

  showModal({
    mark: '📷',
    eyebrow: 'FOTO OBLIGATORIA PARA COMPLETAR',
    title: mission.title,
    description: 'El código QR corresponde a esta misión. Escanealo con tu celular y enviá una foto para acreditar los puntos automáticamente.',
    extra: `<div class="modal-points"><span>Vas a recibir</span><strong>+${earnedPoints} pts</strong></div>${qrMarkup}`,
    confirmText: 'Cerrar',
    action: () => true
  });

  try {
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missionId: mission.id, title: mission.title, points: earnedPoints })
    });
    const session = await response.json();
    if (!response.ok) throw new Error(session.error || 'No se pudo crear el código QR.');

    const qrContainer = document.getElementById('mission-qr');
    if (qrContainer) {
      qrContainer.innerHTML = '';
      if (window.QRCode) {
        new QRCode(qrContainer, { text: session.mobileUrl, width: 208, height: 208, colorDark: '#173F5F', colorLight: '#FFFFFF', correctLevel: QRCode.CorrectLevel.M });
      } else {
        qrContainer.innerHTML = '<span class="qr-unavailable">No se pudo cargar el generador del QR. Usá el enlace que aparece debajo.</span>';
      }
    }

    const manualLink = document.getElementById('qr-manual-link');
    if (manualLink) {
      manualLink.hidden = false;
      manualLink.innerHTML = `<span>¿No podés escanearlo?</span><a href="${escapeHTML(session.mobileUrl)}" target="_blank" rel="noopener">Abrir página del celular</a>`;
    }

    const status = document.getElementById('photo-session-status');
    if (status) status.innerHTML = '<span class="qr-wait-dot"></span> QR listo. Esperando la foto del celular…';
    monitorMissionSession(session.token, mission, earnedPoints);
  } catch (error) {
    activeMissionSessions.delete(id);
    const status = document.getElementById('photo-session-status');
    if (status) {
      status.innerHTML = `<span class="qr-error-icon">!</span> ${escapeHTML(error.message)}. Iniciá el servidor con start-windows.bat o start-linux.sh y volvé a tocar el botón de la misión.`;
    } else {
      showToast(`${error.message} Iniciá el servidor y volvé a tocar el botón de la misión.`);
    }
  }
}

async function monitorMissionSession(token, mission, earnedPoints) {
  const status = document.getElementById('photo-session-status');
  const maxChecks = 900; // 30 minutos, consultando cada 2 segundos.
  try {
    for (let check = 0; check < maxChecks; check++) {
      await sleep(2000);
      if (state.completedMissions.includes(mission.id)) return;
      const response = await fetch(`/api/sessions/${token}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'La sesión de fotos dejó de estar disponible.');
      if (data.status === 'uploaded') {
        completeMissionWithEvidence(mission, earnedPoints, data.evidenceUrl);
        const liveStatus = document.getElementById('photo-session-status');
        if (liveStatus) liveStatus.innerHTML = `<span class="qr-success-icon">✓</span> ¡Foto recibida! Misión completada y puntos acreditados.<img class="evidence-thumbnail" src="${escapeHTML(data.evidenceUrl)}" alt="Foto enviada como evidencia">`;
        return;
      }
    }
    const liveStatus = document.getElementById('photo-session-status');
    if (liveStatus) liveStatus.textContent = 'El código venció. Volvé a iniciar la misión para generar otro QR.';
  } catch (error) {
    const liveStatus = document.getElementById('photo-session-status');
    if (liveStatus) liveStatus.textContent = error.message;
  } finally {
    activeMissionSessions.delete(mission.id);
  }
}

function completeMissionWithEvidence(mission, earnedPoints, evidenceUrl) {
  if (state.completedMissions.includes(mission.id)) return;
  state.completedMissions.push(mission.id);
  state.missionRewards[mission.id] = earnedPoints;
  state.points += earnedPoints;
  state.totalEarnedPoints = (state.totalEarnedPoints ?? state.points) + earnedPoints;
  state.teamPoints = Math.min(1000, state.teamPoints + earnedPoints);
  addHistory(mission.title, 'mission', earnedPoints, evidenceUrl);
  saveState();
  renderAll();
  showToast(`¡Foto verificada! Misión completada: +${earnedPoints} puntos.`);
}
function findReward(id) {
  return physicalRewards.find(reward => reward.id === id);
}
function startRedemption(id) {
  const reward = findReward(id);
  if (!reward) return;
  if (state.points < reward.cost) { showToast("Todavía no tenés puntos suficientes para este canje."); return; }
  showModal({
    mark: reward.icon,
    eyebrow: "CANJE DE MATERIAL DE ESTUDIO",
    title: `Canjear: ${reward.title}`,
    description: `Vas a utilizar ${formatPoints(reward.cost)} puntos de tu saldo disponible.`,
    extra: `<div class="modal-points"><span>Costo del canje</span><strong>−${formatPoints(reward.cost)} pts</strong></div><div class="modal-hint">El canje se registrará como una solicitud. La entrega dependerá de la disponibilidad y de la coordinación con la institución.</div>`,
    confirmText: "Confirmar canje",
    action: () => {
      state.points -= reward.cost;
      const title = reward.title;
      state.redemptions.push({ id: Date.now(), title, cost: reward.cost, status: "Pendiente", date: new Date().toISOString() });
      addHistory(title, "redeem", -reward.cost);
      saveState(); renderAll();
      showToast("Canje registrado. Coordiná la entrega con la institución.");
      return true;
    }
  });
}
function resetDemo() {
  showModal({ mark: "↻", eyebrow: "REINICIAR DEMOSTRACIÓN", title: "¿Volver al estado inicial?", description: "Se borrarán las misiones completadas, los canjes y los movimientos registrados en este navegador.", confirmText: "Sí, reiniciar", action: () => { state = structuredClone(INITIAL_STATE); saveState(); renderAll(); showToast("La demostración volvió al estado inicial."); } });
}
function exportActivity() {
  const header = ["Actividad", "Fecha", "Tipo", "Puntos"];
  const lines = state.history.map(entry => [entry.title, new Date(entry.date).toLocaleDateString("es-AR"), entry.type, entry.points]);
  const csv = [header, ...lines].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = "mi-actividad-escuela-en-accion.csv"; link.click(); URL.revokeObjectURL(url);
}

document.addEventListener("click", event => {
  const nav = event.target.closest("[data-page]");
  if (nav) { navigate(nav.dataset.page); return; }
  const complete = event.target.closest("[data-complete]");
  if (complete) { startMission(complete.dataset.complete); return; }
  const redeem = event.target.closest("[data-redeem]");
  if (redeem) { startRedemption(redeem.dataset.redeem); return; }
  const filter = event.target.closest("[data-filter]");
  if (filter) { activeFilter = filter.dataset.filter; renderMissions(); return; }
});
document.getElementById("modal-confirm").addEventListener("click", event => {
  event.preventDefault();
  if (typeof pendingAction === "function") {
    const result = pendingAction();
    if (result === false) return;
  }
  document.getElementById("action-modal").close();
  pendingAction = null;
});
document.getElementById("mobile-menu").addEventListener("click", () => {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebar-overlay").classList.add("show");
});
document.getElementById("sidebar-overlay").addEventListener("click", closeSidebar);
document.getElementById("reset-demo").addEventListener("click", resetDemo);
document.getElementById("reset-demo-secondary").addEventListener("click", resetDemo);
document.getElementById("export-activity").addEventListener("click", exportActivity);
document.getElementById("notification-button").addEventListener("click", () => showToast("No tenés notificaciones nuevas."));
renderAll();
