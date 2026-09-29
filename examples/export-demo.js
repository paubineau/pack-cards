import {normalizeAppearance, resolveAppearances} from '../appearance.js';
import {createExportCard} from '../export-material.js';
import {artwork, cards, node} from './shared.js';

const canvas = document.getElementById('export-canvas');
const select = document.getElementById('export-card');
const png = document.getElementById('export-png');
const gif = document.getElementById('export-gif');
const cancel = document.getElementById('export-cancel');
const status = document.getElementById('export-status');
const preview = document.getElementById('gif-preview');
const download = document.getElementById('gif-download');
const appearances = resolveAppearances(normalizeAppearance(), artwork,
  cards.map(card => ({identity: card.id, rarity: card.rarity})), 'field-notes');
const downloads = new Map();
let activeJob = null;
let gifURL = null;
let disposed = false;
let generation = 0;

for (const card of cards) {
  const option = node('option', card.name);
  option.value = card.id;
  select.append(option);
}
select.value = cards.at(-1).id;

function drawCard(target, index) {
  const data = cards[index];
  target.getContext('2d').clearRect(0, 0, target.width, target.height);
  // This is canvas composition, not a DOM screenshot: the library supplies stock and materials.
  const {ctx, ink, accent, left, width} = createExportCard(target, artwork, {
    appearance: appearances[index], heading: 'FIELD NOTES',
    footer: 'A fictional collection', label: data.rarity.replaceAll('_', ' ').toUpperCase(),
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = ink;
  ctx.font = '300px Georgia, serif';
  ctx.fillText(data.symbol, 540, 610);
  ctx.font = '700 80px sans-serif';
  ctx.fillText(data.name, 540, 800, width);
  ctx.fillStyle = '#c2ccda';
  ctx.font = '38px sans-serif';
  const lines = [];
  let line = '';
  for (const word of data.description.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > width - 80) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  lines.push(line);
  lines.forEach((text, row) => ctx.fillText(text, left + width / 2, 915 + row * 56));
  ctx.fillStyle = accent;
  ctx.font = '600 26px sans-serif';
  ctx.fillText(`${index + 1} / ${cards.length}`, 540, 1200);
}

function selectedIndex() {
  return cards.findIndex(card => card.id === select.value);
}

function updateCanvas() {
  const index = selectedIndex();
  drawCard(canvas, index);
  canvas.setAttribute('aria-label', `Canvas export of ${cards[index].name}`);
}

function clearGif() {
  preview.hidden = true;
  preview.removeAttribute('src');
  download.hidden = true;
  download.removeAttribute('href');
  if (gifURL) URL.revokeObjectURL(gifURL);
  gifURL = null;
}

function stopJob() {
  if (activeJob) {
    activeJob.worker.terminate();
    clearTimeout(activeJob.timeout);
    activeJob = null;
  }
  gif.disabled = false;
  cancel.hidden = true;
}

function failJob(message) {
  stopJob();
  status.textContent = message;
}

png.addEventListener('click', () => {
  if (disposed) return;
  const requestGeneration = generation;
  const filename = `field-notes-${cards[selectedIndex()].id}.png`;
  png.disabled = true;
  canvas.toBlob(blob => {
    // A callback queued before navigation must not download after a cached page is restored.
    if (disposed || requestGeneration !== generation) return;
    png.disabled = false;
    if (!blob) {
      status.textContent = 'The browser could not create a PNG. Try another browser.';
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = node('a');
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    // Keep the URL alive briefly so the browser can begin the download.
    downloads.set(url, setTimeout(() => {
      URL.revokeObjectURL(url);
      downloads.delete(url);
    }, 30000));
    status.textContent = `PNG download prepared: ${filename} (1080 × 1440).`;
  }, 'image/png');
});

gif.addEventListener('click', () => {
  if (disposed || activeJob) return;
  clearGif();
  gif.disabled = true;
  cancel.hidden = false;
  status.textContent = 'Starting the GIF worker…';
  try {
    const worker = new Worker(new URL('../gif-worker.js', import.meta.url), {type: 'module'});
    const job = {worker, next: 0, finishing: false, timeout: null};
    activeJob = job;
    const frame = document.createElement('canvas');
    frame.width = 1080;
    frame.height = 1440;
    const small = document.createElement('canvas');
    small.width = 270;
    small.height = 360;
    const ctx = small.getContext('2d', {willReadFrequently: true});
    function awaitReply() {
      clearTimeout(job.timeout);
      job.timeout = setTimeout(() => {
        if (activeJob === job) failJob('The GIF worker took too long. You can try again.');
      }, 30000);
    }
    worker.onmessage = ({data}) => {
      if (activeJob !== job) return;
      if (data.error) {
        failJob('The GIF worker could not encode these frames. You can try again.');
        return;
      }
      if (data.bytes) {
        gifURL = URL.createObjectURL(new Blob([data.bytes], {type: 'image/gif'}));
        preview.src = gifURL;
        preview.hidden = false;
        download.href = gifURL;
        download.download = 'field-notes-collection.gif';
        download.hidden = false;
        stopJob();
        status.textContent = `GIF ready: ${cards.length} cards, 270 × 360, 800 ms per card. Preview or download it below.`;
        return;
      }
      if (!data.ready || job.finishing) return;
      try {
        // One frame per acknowledgement bounds memory and keeps the main thread responsive.
        if (job.next < cards.length) {
          drawCard(frame, job.next);
          ctx.clearRect(0, 0, small.width, small.height);
          ctx.drawImage(frame, 0, 0, small.width, small.height);
          const pixels = ctx.getImageData(0, 0, small.width, small.height).data;
          worker.postMessage({pixels, width: small.width, height: small.height, delay: 800}, [pixels.buffer]);
          job.next += 1;
          status.textContent = `Encoding card ${job.next} of ${cards.length} in the GIF worker…`;
        } else {
          job.finishing = true;
          worker.postMessage({finish: true});
          status.textContent = 'Finishing the GIF…';
        }
        awaitReply();
      } catch {
        failJob('The browser could not prepare a GIF frame. You can try again.');
      }
    };
    worker.onerror = event => {
      event.preventDefault();
      if (activeJob === job) failJob('The GIF worker could not load. Serve this example over HTTP and try again.');
    };
    worker.onmessageerror = () => {
      if (activeJob === job) failJob('The GIF worker returned an unreadable frame. You can try again.');
    };
    awaitReply();
  } catch {
    failJob('This browser could not start a module worker. PNG export is still available.');
  }
});

cancel.addEventListener('click', () => {
  stopJob();
  status.textContent = 'GIF encoding cancelled. You can start again at any time.';
});
select.addEventListener('change', updateCanvas);
window.addEventListener('pagehide', () => {
  disposed = true;
  generation += 1;
  stopJob();
  clearGif();
  for (const [url, timer] of downloads) {
    clearTimeout(timer);
    URL.revokeObjectURL(url);
  }
  downloads.clear();
});
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  disposed = false;
  png.disabled = false;
  gif.disabled = false;
  cancel.hidden = true;
  updateCanvas();
  status.textContent = 'Choose a card to export, or create a new six-card GIF.';
});
updateCanvas();
