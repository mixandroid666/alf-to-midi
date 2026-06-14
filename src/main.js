import JSZip from 'jszip';
import { extractMidi } from './extractor.js';

const dropZone      = document.getElementById('drop-zone');
const fileInput     = document.getElementById('file-input');
const results       = document.getElementById('results');
const resultsCount  = document.getElementById('results-count');
const fileList      = document.getElementById('file-list');
const batchActions  = document.getElementById('batch-actions');
const downloadAllBtn = document.getElementById('download-all');
const clearBtn      = document.getElementById('clear-btn');

// { name: string, blob: Blob }[]
const converted = [];

// ── Drag & drop ──────────────────────────────────────────────────────────────

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  if (!dropZone.contains(e.relatedTarget)) {
    dropZone.classList.remove('drag-over');
  }
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const files = filterAifFiles(Array.from(e.dataTransfer.files));
  if (files.length) processFiles(files);
});

dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') fileInput.click();
});

// ── File input ───────────────────────────────────────────────────────────────

fileInput.addEventListener('change', () => {
  const files = filterAifFiles(Array.from(fileInput.files));
  if (files.length) processFiles(files);
  fileInput.value = '';
});

// ── Clear ─────────────────────────────────────────────────────────────────────

clearBtn.addEventListener('click', () => {
  converted.length = 0;
  fileList.innerHTML = '';
  results.classList.add('hidden');
  batchActions.classList.add('hidden');
});

// ── Download all ─────────────────────────────────────────────────────────────

downloadAllBtn.addEventListener('click', async () => {
  downloadAllBtn.disabled = true;
  downloadAllBtn.textContent = 'Zipping…';

  const zip = new JSZip();
  converted.forEach(({ name, blob }) => zip.file(name, blob));
  const zipBlob = await zip.generateAsync({ type: 'blob' });

  triggerDownload(zipBlob, 'midi-files.zip');

  downloadAllBtn.disabled = false;
  downloadAllBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    Download All as ZIP
  `;
});

// ── Core processing ───────────────────────────────────────────────────────────

async function processFiles(files) {
  results.classList.remove('hidden');
  updateCount();

  for (const file of files) {
    const card = appendCard(file.name);

    try {
      const buffer   = await file.arrayBuffer();
      const midiData = extractMidi(buffer);

      if (!midiData) {
        setError(card, 'No MIDI data found — is this a software instrument (green) loop?');
        continue;
      }

      const midiName = file.name.replace(/\.aiff?$/i, '.mid');
      const blob     = new Blob([midiData], { type: 'audio/midi' });
      converted.push({ name: midiName, blob });

      setSuccess(card, midiName, blob);
    } catch (err) {
      setError(card, `Read error: ${err.message}`);
    }

    updateCount();
  }

  batchActions.classList.toggle('hidden', converted.length < 2);
}

// ── Card helpers ──────────────────────────────────────────────────────────────

function appendCard(name) {
  const card = document.createElement('div');
  card.className = 'file-card loading';
  card.innerHTML = `
    <div class="card-icon">
      <span class="spinner"></span>
    </div>
    <div class="card-body">
      <span class="card-name">${esc(name)}</span>
      <span class="card-status">Converting…</span>
    </div>
    <div class="card-action"></div>
  `;
  fileList.appendChild(card);
  return card;
}

function setSuccess(card, midiName, blob) {
  card.className = 'file-card success';
  card.querySelector('.card-icon').innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  `;
  card.querySelector('.card-name').textContent = midiName;
  card.querySelector('.card-status').textContent = `${formatBytes(blob.size)} · ready`;
  card.querySelector('.card-action').innerHTML = `
    <a href="${URL.createObjectURL(blob)}" download="${esc(midiName)}" class="btn btn-sm">
      Download
    </a>
  `;
}

function setError(card, message) {
  card.className = 'file-card error';
  card.querySelector('.card-icon').innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  `;
  card.querySelector('.card-status').textContent = message;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function filterAifFiles(files) {
  return files.filter(f => /\.aiff?$/i.test(f.name));
}

function updateCount() {
  const total   = fileList.children.length;
  const success = fileList.querySelectorAll('.file-card.success').length;
  resultsCount.textContent = total === 1
    ? `${success} of 1 file converted`
    : `${success} of ${total} files converted`;
}

function triggerDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function esc(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
