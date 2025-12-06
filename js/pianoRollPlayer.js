// ====================================================================
//  pianoRollPlayer.js — Controla la reproducción y el scroll automático
// ====================================================================

import { midiToYAbsolute } from "./pianoRoll.js";
import { getCurrentTargetNote, getFirstTargetNote, getFinalAnalysis, resetAnalysis } from "./voice.js";
import { startRecording, stopRecording } from "./recorder.js";
import { showFinalPopup } from "./uiPopup.js";

window.midiToYAbsolute = midiToYAbsolute;

// ------------------------------
// Variables globales
// ------------------------------
let tempoFactor = 1;
window.__TEMPO_FACTOR__ = 1;

let audioCtx = null;
let startTime = null;
window.isPlaying = false;

let currentTimeOffset = 0;
let activeNodes = [];
let rafId = null;

let notesGlobal = [];
let svgElement = null;
let scrollContainer = null;
let pixelsPerSecond = parseInt(window.__TEMPO__);

let voiceGainNodes = [];
let SOLO_MODE_ACTIVE = false;
let SOLO_SELECTED_VOICE = 0;

let SOLO_OTHER_VOLUME = 0.15;
let SOLO_MAIN_VOLUME = 1.0;

// Estado global linkeado con voice.js
window.__TARGET_MIDI__ = null;
window.__USER_MIDI__ = null;
window.__VOICE_NOTES__ = [];

// Nuevos intervalos optimizados
let targetUpdaterInterval = null;
let singingLineInterval = null;

window.getPreviewTime = function () {
    const bpm = parseInt(window.__TEMPO__);
    const beatsAhead = window.__NOTE_PREVIEW_FACTOR__ || 0.1;
    window.preview = beatsAhead * (60 / bpm);
};

// ----------------------------------------------------
// Inicialización de Gains (para voces individuales)
// ----------------------------------------------------
export function initVoiceGains(totalVoices) {
    voiceGainNodes = [];

    for (let i = 0; i < totalVoices; i++) {
        const g = audioCtx.createGain();
        g.gain.value = 1.0;

        g.connect(audioCtx.destination);
        voiceGainNodes.push(g);
    }
}

// ----------------------------------------------------
// Inicialización del Reproductor
// ----------------------------------------------------
export function initPianoRollPlayer(notes, svg, container, totalVoices) {
    notesGlobal = notes;
    svgElement = svg;
    scrollContainer = container;

    window.__ALL_NOTES__ = notes;
    getFirstTargetNote();
    window.getPreviewTime();

    if (!audioCtx) audioCtx = new AudioContext();

    initVoiceGains(totalVoices);
}

// ----------------------------------------------------
// Iniciar reproducción
// ----------------------------------------------------
export function playSong() {
    if (window.isPlaying || notesGlobal.length === 0) return;

    if (!audioCtx) audioCtx = new AudioContext();

    startTime = audioCtx.currentTime - currentTimeOffset;
    window.isPlaying = true;

    getFirstTargetNote();

    scheduleNotes();
    startScroll();
}

// ----------------------------------------------------
// Detener canción + grabación
// ----------------------------------------------------
export async function stopSong() {
    if (!window.isPlaying) return;
    window.isPlaying = false;

    currentTimeOffset = audioCtx.currentTime - startTime;
    window.lastIndex = 0;

    clearAudioNodes();

    const audioBlob = await stopRecording();
    const metrics = getFinalAnalysis();
    resetAnalysis();

    showFinalPopup({
        audioBlob,
        metrics,
    });
}

// ----------------------------------------------------
// Reiniciar y volver a reproducir
// ----------------------------------------------------
export function restartSong() {
    window.isPlaying = false;
    currentTimeOffset = 0;
    clearAudioNodes();
    setSoloMode(SOLO_MODE_ACTIVE, SOLO_SELECTED_VOICE);
    playSong();
}

// ----------------------------------------------------
// Programar notas MIDI simuladas en el "piano"
// ----------------------------------------------------
function scheduleNotes() {
    const ctx = audioCtx;
    const allNotesVoiceFixedTime = [];

    notesGlobal.forEach(note => {
        const noteStart = startTime + (note.time / tempoFactor);
        const now = ctx.currentTime;

        if (noteStart >= now - 0.05) {
            if (`${window.__SELECTED_VOICE__}` === `${note.voice}`)
                allNotesVoiceFixedTime.push({
                    ...note,
                    start: noteStart,
                    end: noteStart + note.duration
                });

            playNotePianoLike(
                midiToFreq(note.midi),
                noteStart,
                note.duration / tempoFactor,
                note
            );
        }
    });

    window.__VOICE_NOTES__ = allNotesVoiceFixedTime;
}

// ----------------------------------------------------
// Scroll con animación 60fps
// + bucles optimizados para target y singing line
// ----------------------------------------------------
function startScroll() {
    const start = audioCtx.currentTime;

    // ----------------------
    // FRAME LOOP (60 fps)
    // ----------------------
    function step() {
        if (!window.isPlaying) return;

        const t = audioCtx.currentTime - start + currentTimeOffset;
        window.__CURRENT_PLAY_POS__ = t;

        scrollContainer.scrollLeft = t * pixelsPerSecond * tempoFactor;

        rafId = requestAnimationFrame(step);
    }

    if (window.micOn) startRecording();
    rafId = requestAnimationFrame(step);

    // ----------------------
    // LOOP TARGET-NOTE (8 fps)
    // ----------------------
    if (targetUpdaterInterval) clearInterval(targetUpdaterInterval);
    targetUpdaterInterval = setInterval(() => {
        if (!window.isPlaying) return;

        const t = getCurrentTargetNote();
        if (t) {
            window.__TARGET_MIDI__ = t.midi;
            document.getElementById("targetNote").innerText = t.name;
        }
    }, 120);

    // ----------------------
    // LOOP SING-LINE (13 fps)
    // ----------------------
    if (singingLineInterval) clearInterval(singingLineInterval);
    singingLineInterval = setInterval(() => {
        if (!window.isPlaying) return;
        window.updateSingingLine();
    }, 75);
}

// ----------------------------------------------------
// Conversión MIDI ↔ Hz
// ----------------------------------------------------
function midiToFreq(m) {
    if (typeof m !== "number" || isNaN(m)) return NaN;
    return 440 * Math.pow(2, (m - 69) / 12);
}

// ----------------------------------------------------
// Limpiar osciladores + reset audioContext
// ----------------------------------------------------
function clearAudioNodes() {
    activeNodes.forEach(n => {
        try { n.disconnect(); } catch (e) { }
        try { n.stop(); } catch (e) { }
    });
    activeNodes = [];

    if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
    }

    cancelAnimationFrame(rafId);

    audioCtx = new AudioContext();

    if (voiceGainNodes.length > 0) {
        const totalVoices = voiceGainNodes.length;
        initVoiceGains(totalVoices);
    }

    clearInterval(targetUpdaterInterval);
    clearInterval(singingLineInterval);
}

// ----------------------------------------------------
// Simulación de "piano" con osciladores
// ----------------------------------------------------
function playNotePianoLike(freq, t0, dur, noteObj) {
    const ctx = audioCtx;
    const t1 = t0 + dur;

    // ---- ENVOLVENTE MEJORADA (suave, sin golpe) ----
    const attack = 0.008;       // ataque más suave (antes 0.003)
    const decay = 0.10;
    const sustain = 0.22;
    const release = 0.12;       // colas MUCHO más cortas (antes 0.25)

    // ---- OSCILADOR PRINCIPAL ----
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t0);

    // ---- ARMÓNICO (más controlado) ----
    const harm = ctx.createOscillator();
    harm.type = "sine";
    harm.frequency.setValueAtTime(freq * 2, t0);

    const harmGain = ctx.createGain();
    harmGain.gain.setValueAtTime(0.12, t0);                    // menos armónico inicial
    harmGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);

    // ---- FILTRO DINÁMICO: evita barro + brillo controlado ----
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";

    // Ajuste dinámico según frecuencia de la nota (piano-like)
    const cutoff = Math.min(4200, 1800 + freq * 1.4);
    filter.frequency.setValueAtTime(cutoff, t0);
    filter.Q.value = 0.6;

    // ---- High-pass para evitar acumulación de graves ----
    const hpf = ctx.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.setValueAtTime(40, t0);            // elimina rumbles
    hpf.Q.value = 0.7;

    // ---- ENVOLVENTE DE AMPLITUD LIMPIA ----
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(0.85, t0 + attack);      // pico más bajo → no golpea
    gain.gain.exponentialRampToValueAtTime(sustain, t0 + decay);
    gain.gain.setValueAtTime(sustain, t1);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1 + release);

    // ---- CONEXIONES ----
    osc.connect(filter);
    harm.connect(harmGain).connect(filter);
    filter.connect(hpf).connect(gain).connect(voiceGainNodes[noteObj.voice]);

    // ---- INICIO / FIN ----
    osc.start(t0);
    harm.start(t0);

    osc.stop(t1 + release);
    harm.stop(t1 + release * 0.8);

    activeNodes.push(osc, harm, harmGain, filter, hpf, gain);
}


// ----------------------------------------------------
// Cambiar tempo
// ----------------------------------------------------
export function applyTempo() {
    let lastPlay = window.isPlaying;

    window.isPlaying = false;
    currentTimeOffset = 0;
    window.lastIndex = 0;
    clearAudioNodes();

    const bpm = parseFloat(document.getElementById("tempoInput").value);
    if (!isNaN(bpm) && bpm > 0) {
        tempoFactor = bpm / parseInt(window.__TEMPO__);
    }

    window.__TEMPO_FACTOR__ = tempoFactor;
    window.getPreviewTime();

    setSoloMode(SOLO_MODE_ACTIVE, SOLO_SELECTED_VOICE);

    if (lastPlay) playSong();
}

// ----------------------------------------------------
// Solo mode
// ----------------------------------------------------
export function setSoloMode(isSolo, selectedVoice) {
    SOLO_MODE_ACTIVE = isSolo;
    SOLO_SELECTED_VOICE = selectedVoice;
    window.__SELECTED_VOICE__ = selectedVoice;

    let lastPlay = window.isPlaying;

    window.isPlaying = false;
    currentTimeOffset = 0;
    window.lastIndex = 0;
    clearAudioNodes();

    voiceGainNodes.forEach((g, i) => {
        if (!isSolo) g.gain.value = SOLO_MAIN_VOLUME;
        else g.gain.value = (i === selectedVoice ? SOLO_MAIN_VOLUME : SOLO_OTHER_VOLUME);
    });

    if (lastPlay) playSong();
}

// ----------------------------------------------------
// Seguimiento de la línea del usuario
// ----------------------------------------------------
window.updateSingingLine = function () {
    if (window.__TARGET_MIDI__ == null || window.__USER_MIDI__ == null) return;
    const sing = document.getElementById("sing_line");
    if (!sing) return;

    const minMidi = window.__MIN_MIDI__;
    const maxMidi = window.__MAX_MIDI__;

    const yUser = window.midiToYAbsolute(window.__USER_MIDI__, minMidi, maxMidi);
    sing.style.transform = `translateY(${yUser}px)`;

    const diff = window.__USER_MIDI__ - window.__TARGET_MIDI__;
    document.getElementById("diffData").innerText = diff.toFixed(2);
};
