const token = new URLSearchParams(location.search).get('token');
const titleEl = document.getElementById('mission-title');
const pointsEl = document.getElementById('mission-points');
const statusEl = document.getElementById('status-message');
const inputEl = document.getElementById('mission-photo');
const previewEl = document.getElementById('photo-preview');
const sendButton = document.getElementById('send-photo');
let selectedFile = null;
let sessionData = null;

function setStatus(message, kind = '') {
  statusEl.textContent = message;
  statusEl.className = `status-message ${kind}`;
}
async function loadSession() {
  if (!token || !/^[a-f0-9]{36}$/.test(token)) {
    titleEl.textContent = 'Código QR inválido';
    setStatus('Volvé a la computadora y generá un nuevo código QR.', 'error');
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
      setStatus('Esta misión ya recibió una foto. Revisá la computadora.', 'success');
      inputEl.disabled = true;
    }
  } catch (error) {
    titleEl.textContent = 'No se pudo abrir la misión';
    setStatus(error.message, 'error');
    inputEl.disabled = true;
  }
}
inputEl.addEventListener('change', () => {
  selectedFile = inputEl.files?.[0] || null;
  sendButton.disabled = !selectedFile;
  if (!selectedFile) { previewEl.hidden = true; return; }
  previewEl.src = URL.createObjectURL(selectedFile);
  previewEl.hidden = false;
  document.getElementById('upload-title').textContent = 'Foto lista para enviar';
  setStatus('Revisá que la imagen muestre claramente la misión terminada.');
});
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
    image.onerror = () => { URL.revokeObjectURL(imageUrl); reject(new Error('El formato de la foto no es compatible. Probá sacarla nuevamente.')); };
    image.src = imageUrl;
  });
}
document.getElementById('photo-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!selectedFile || !sessionData) return;
  sendButton.disabled = true;
  inputEl.disabled = true;
  setStatus('Preparando y enviando la foto…');
  try {
    const imageData = await imageToDataUrl(selectedFile);
    const response = await fetch(`/api/sessions/${token}/photo`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageData })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo enviar la foto.');
    setStatus('¡Foto enviada! La misión se completó y los puntos se acreditaron en la computadora.', 'success');
    document.getElementById('upload-title').textContent = '¡Evidencia recibida!';
  } catch (error) {
    setStatus(error.message, 'error');
    inputEl.disabled = false;
    sendButton.disabled = false;
  }
});
loadSession();
