// ====================================================================
//  pianoRollPlayer.js — Controla la reproducción y el scroll automático
// ====================================================================
let tempoFactor = 1; // 1 = normal

let audioCtx = null;
let startTime = null;
let isPlaying = false;

let currentTimeOffset = 0;  // <-- cuántos segundos ya avanzó la canción

let activeNodes = [];       // <-- aquí guardaremos osciladores, gains, etc.
let rafId = null;           // <-- requestAnimationFrame

let notesGlobal = [];
let svgElement = null;
let scrollContainer = null;
let pixelsPerSecond = 120;   // VELOCIDAD DE SCROLL (depende de los BPM)

// Solo Mode

let voiceGainNodes = [];
let SOLO_MODE_ACTIVE = false;

let SOLO_SELECTED_VOICE = 0;
let SOLO_OTHER_VOLUME = 0.15;
let SOLO_MAIN_VOLUME = 1.0;

export function initVoiceGains(totalVoices) {
    voiceGainNodes = [];

    for (let i = 0; i < totalVoices; i++) {
        const g = audioCtx.createGain();
        g.gain.value = 1.0;

        g.connect(audioCtx.destination);
        voiceGainNodes.push(g);
    }
}


export function initPianoRollPlayer(notes, svg, container, totalVoices) {
    notesGlobal = notes;
    svgElement = svg;
    scrollContainer = container;

    if (!audioCtx) audioCtx = new AudioContext();

    initVoiceGains(totalVoices);
}

export function playSong() {
    if (isPlaying || notesGlobal.length === 0) return;

    if (!audioCtx) audioCtx = new AudioContext();

    startTime = audioCtx.currentTime - currentTimeOffset;
    isPlaying = true;

    scheduleNotes();
    startScroll();
}

export function stopSong() {
    if (!isPlaying) return;
    isPlaying = false;

    currentTimeOffset = audioCtx.currentTime - startTime;

    clearAudioNodes(); // mata osciladores y animación pero guarda offset
}


export function restartSong() {
    isPlaying = false;
    currentTimeOffset = 0;
    clearAudioNodes();
    setSoloMode(SOLO_MODE_ACTIVE, SOLO_SELECTED_VOICE);
    playSong();
}

function scheduleNotes() {
    const ctx = audioCtx;

    notesGlobal.forEach(note => {
        const noteStart = startTime + (note.time / tempoFactor);
        const now = ctx.currentTime;

        if (noteStart >= now - 0.05) {
            playNotePianoLike(
                midiToFreq(note.midi),
                noteStart,
                note.duration / tempoFactor,
                note
            );
        }
    });
}

function startScroll() {
    const start = audioCtx.currentTime;

    function step() {
        if (!isPlaying) return;

        const t = audioCtx.currentTime - start + currentTimeOffset;

        scrollContainer.scrollLeft = t * pixelsPerSecond * tempoFactor;
        rafId = requestAnimationFrame(step);
    }

    rafId = requestAnimationFrame(step);
}


function midiToFreq(m) {
    if (typeof m !== "number" || isNaN(m)) return NaN;
    return 440 * Math.pow(2, (m - 69) / 12);
}

function clearAudioNodes() {
    activeNodes.forEach(n => {
        try { n.disconnect(); } catch (e) { }
        try { n.stop(); } catch (e) { }
    });
    activeNodes = [];

    // Cerrar audio context viejo
    if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
    }

    cancelAnimationFrame(rafId);

    // Crear audioCtx nuevo y regenear gains
    audioCtx = new AudioContext();

    if (voiceGainNodes.length > 0) {
        const totalVoices = voiceGainNodes.length;
        initVoiceGains(totalVoices);
    }
}


function playNotePianoLike(freq, t0, dur, noteObj) {
    const ctx = audioCtx;
    const t1 = t0 + dur;

    // ADSR estilo piano
    const attack = 0.003;
    const decay = 0.18;
    const sustain = 0.25;
    const release = 0.25;

    // Osc principal
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t0);

    // Armónico inicial
    const harm = ctx.createOscillator();
    harm.type = "sine";
    harm.frequency.setValueAtTime(freq * 2, t0);

    const harmGain = ctx.createGain();
    harmGain.gain.setValueAtTime(0.2, t0);
    harmGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);

    // Filtro cálido
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2800, t0);
    filter.Q.value = 0.7;

    // Envolvente
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(1.0, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(sustain, t0 + decay);
    gain.gain.setValueAtTime(sustain, t1);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1 + release);

    // Conexiones
    osc.connect(filter);
    harm.connect(harmGain).connect(filter);
    filter.connect(gain).connect(voiceGainNodes[noteObj.voice]);

    const voiceGain = voiceGainNodes[noteObj.voice];
    if (!voiceGain) {
        console.warn("voiceGainNodes no tiene voice:", noteObj.voice);
        return;
    }

    // Inicio / fin
    osc.start(t0);
    harm.start(t0);
    osc.stop(t1 + release);
    harm.stop(t1 + 0.15);

    // TRACKING para poder limpiar
    activeNodes.push(osc, harm, harmGain, filter, gain);
}

export function applyTempo() {
    let lastPlay = isPlaying;

    isPlaying = false;
    currentTimeOffset = 0;
    clearAudioNodes();

    const bpm = parseFloat(document.getElementById("tempoInput").value);
    if (!isNaN(bpm) && bpm > 0) {
        tempoFactor = bpm / 120; // 120 = tempo base del MusicXML
    }

    setSoloMode(SOLO_MODE_ACTIVE, SOLO_SELECTED_VOICE);

    if(lastPlay) playSong();
}

export function setSoloMode(isSolo, selectedVoice) {
    SOLO_MODE_ACTIVE = isSolo;
    SOLO_SELECTED_VOICE = selectedVoice;

    let lastPlay = isPlaying;

    isPlaying = false;
    currentTimeOffset = 0;
    clearAudioNodes();

    voiceGainNodes.forEach((g, i) => {
        if (!isSolo) {
            g.gain.value = SOLO_MAIN_VOLUME;      // normal
        } else {
            g.gain.value = (i === selectedVoice ? SOLO_MAIN_VOLUME : SOLO_OTHER_VOLUME);
        }
    });

    if(lastPlay) playSong();
}
