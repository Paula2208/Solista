// ====================================================================
//  pianoRollPlayer.js — Controla la reproducción y el scroll automático
// ====================================================================

let audioCtx = null;
let startTime = null;
let isPlaying = false;

let notesGlobal = [];
let svgElement = null;
let scrollContainer = null;
let pixelsPerSecond = 120;   // VELOCIDAD DE SCROLL (ajústala)

export function initPianoRollPlayer(notes, svg, container) {
    notesGlobal = notes;
    svgElement = svg;
    scrollContainer = container;
}

export function playSong() {
    if (!notesGlobal || notesGlobal.length === 0) return;
    
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();

    startTime = audioCtx.currentTime;
    isPlaying = true;

    // Lanzar notas
    notesGlobal.forEach(n => {
        playOscillatorNote(n);
    });

    // Iniciar loop de scroll
    requestAnimationFrame(scrollLoop);
}

export function stopSong() {
    isPlaying = false;
    if (audioCtx) audioCtx.suspend();
}

function playOscillatorNote(n) {
    if (!audioCtx) return;

    // Validar datos
    if (
        !n ||
        typeof n.midi !== "number" ||
        isNaN(n.midi) ||
        typeof n.time !== "number" ||
        typeof n.duration !== "number"
    ) {
        console.warn("Nota inválida, se ignora:", n);
        return;
    }

    const freq = midiToFreq(n.midi);
    if (!isFinite(freq)) {
        console.warn("Frecuencia no válida para nota:", n);
        return;
    }

    const osc = audioCtx.createOscillator();
    osc.frequency.value = freq;

    const gain = audioCtx.createGain();
    gain.gain.value = 0.15;

    osc.connect(gain).connect(audioCtx.destination);

    const t0 = startTime + n.time;
    const t1 = startTime + n.time + n.duration;

    osc.start(t0);
    osc.stop(t1);
}


function midiToFreq(m) {
    if (typeof m !== "number" || isNaN(m)) return NaN;
    return 440 * Math.pow(2, (m - 69) / 12);
}


// -------------------------------------------------------
// SCROLL ANIMADO
// -------------------------------------------------------
function scrollLoop() {
    if (!isPlaying) return;

    const elapsed = audioCtx.currentTime - startTime;
    const x = elapsed * pixelsPerSecond;

    scrollContainer.scrollLeft = x;

    requestAnimationFrame(scrollLoop);
}
