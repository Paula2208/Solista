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

    if (
        !n ||
        typeof n.midi !== "number" ||
        isNaN(n.midi) ||
        typeof n.time !== "number" ||
        typeof n.duration !== "number"
    ) return;

    const fundamental = midiToFreq(n.midi);
    const t0 = startTime + n.time;
    const t1 = t0 + n.duration;

    // ADSR estilo piano suave
    const attack = 0.003;
    const decay = 0.18;
    const sustain = 0.25;
    const release = 0.25;

    // Oscilador dulce (triangle)
    const osc = audioCtx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(fundamental, t0);

    // Pequeño "timbre boost" al inicio
    const harmonicsOsc = audioCtx.createOscillator();
    harmonicsOsc.type = "sine";
    harmonicsOsc.frequency.setValueAtTime(fundamental * 2, t0);

    // Ganancia de los armónicos
    const harmGain = audioCtx.createGain();
    harmGain.gain.setValueAtTime(0.2, t0);
    harmGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12); // desaparece rápido

    // Filtro para cuerpo cálido
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2800, t0); // menos brillante → más piano
    filter.Q.value = 0.7;

    // Envolvente principal
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(1.0, t0 + attack);         // ataque
    gain.gain.exponentialRampToValueAtTime(sustain, t0 + decay); // decay
    gain.gain.setValueAtTime(sustain, t1);                       // sustain
    gain.gain.exponentialRampToValueAtTime(0.0001, t1 + release);// release

    osc.connect(filter);
    harmonicsOsc.connect(harmGain).connect(filter);

    filter.connect(gain).connect(audioCtx.destination);

    // Iniciar y parar
    osc.start(t0);
    harmonicsOsc.start(t0);
    osc.stop(t1 + release);
    harmonicsOsc.stop(t1 + 0.15);
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
