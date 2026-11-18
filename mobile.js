const token = new URLSearchParams(location.search).get('token');
const titleEl = document.getElementById('mission-title');
const pointsEl = document.getElementById('mission-points');
const statusEl = document.getElementById('status-message');
const inputEl = document.getElementById('mission-photo');
const previewEl = document.getElementById('photo-preview');
const sendButton = document.getElementById('send-photo');
let selectedFile = null;
let sessionData = null;
let uploadStarted = false;

function setStatus(message, kind = '') {
  statusEl.textContent = message;
  statusEl.className = `status-message ${kind}`;
}

function applyMissionToThisDevice(evidenceUrl) {
  if (!sessionData?.missionId || !Number.isFinite(Number(sessionData.points))) return;
  const key = 'escuelaEnAccionDemoV1';
  const initial = { points: 0, totalEarnedPoints: 0, completedMissions: [], missionRewards: {}, redemptions: [], history: [], teamPoints: 750 };
  let state;
  try {
    state = JSON.parse(localStorage.getItem(key)) || initial;
  } catch {
    state = initial;
  }
  state.completedMissions = Array.isArray(state.completedMissions) ? state.completedMissions : [];
  state.missionRewards = state.missionRewards && typeof state.missionRewards === 'object' ? state.missionRewards : {};
  state.history = Array.isArray(state.history) ? state.history : [];
  state.redemptions = Array.isArray(state.redemptions) ? state.redemptions : [];
  const points = Number(sessionData.points);
  if (state.completedMissions.includes(sessionData.missionId)) return;
  state.completedMissions.push(sessionData.missionId);
  state.missionRewards[sessionData.missionId] = points;
  state.points = (Number(state.points) || 0) + points;
  state.totalEarnedPoints = Math.max(Number(state.totalEarnedPoints) || 0, Number(state.points) - points) + points;
  state.teamPoints = Math.min(1000, (Number(state.teamPoints) || 0) + points);
  state.history.unshift({
    id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()),
    title: sessionData.title,
    type: 'mission',
    points,
    evidenceUrl,
    date: new Date().toISOString()
  });
  localStorage.setItem(key, JSON.stringify(state));
}

async function loadSession() {
  if (!token || !/^[a-f0-9]{36}$/.test(token)) {
    titleEl.textContent = 'Código QR inválido';
    setStatus('Volvé a EduPoint y generá un nuevo código QR.', 'error');
    inputEl.disabled = true;
    return;
  }
  try {
    const response = await fetch(`/api/sessions/${token}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se encontró la misión.');
    sessionData = data;
    titleEl.textContent = data.title;
    pointsEl.textContent = `+${data.points} pts`;
    if (data.status === 'uploaded') {
      applyMissionToThisDevice(data.evidenceUrl);
      setStatus('Esta misión ya recibió una foto y quedó completada.', 'success');
      inputEl.disabled = true;
    }
  } catch (error) {
    titleEl.textContent = 'No se pudo abrir la misión';
    setStatus(error.message, 'error');
    inputEl.disabled = true;
  }
}

function imageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(imageUrl);
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('No se pudo preparar la imagen.'));
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.82);
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error('El formato de la foto no es compatible. Probá sacarla nuevamente.'));
    };
    image.src = imageUrl;
  });
}

async function uploadSelectedPhoto() {
  if (!selectedFile || !sessionData || uploadStarted) return;
  uploadStarted = true;
  sendButton.disabled = true;
  inputEl.disabled = true;
  setStatus('Foto tomada. Enviándola a EduPoint…');
  try {
    const imageData = await imageToDataUrl(selectedFile);
    const response = await fetch(`/api/sessions/${token}/photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo enviar la foto.');
    applyMissionToThisDevice(data.evidenceUrl || `/evidencias/${token}.jpg`);
    setStatus('¡Listo! La foto se envió y la misión quedó completada. Ya podés volver a EduPoint.', 'success');
    document.getElementById('upload-title').textContent = '¡Misión completada!';
    sendButton.hidden = true;
  } catch (error) {
    uploadStarted = false;
    setStatus(`${error.message} Volvé a tocar el botón para intentar otra vez.`, 'error');
    inputEl.disabled = false;
    sendButton.disabled = !selectedFile;
  }
}

inputEl.addEventListener('change', () => {
  selectedFile = inputEl.files?.[0] || null;
  sendButton.disabled = !selectedFile;
  if (!selectedFile) {
    previewEl.hidden = true;
    return;
  }
  previewEl.src = URL.createObjectURL(selectedFile);
  previewEl.hidden = false;
  document.getElementById('upload-title').textContent = 'Foto tomada · enviando…';
  // La carga comienza automáticamente en cuanto la cámara devuelve la foto.
  uploadSelectedPhoto();
});

sendButton.addEventListener('click', uploadSelectedPhoto);
loadSession();
