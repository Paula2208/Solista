// ====================================================================
//  pianoRollPlayer.js — Controla la reproducción y el scroll automático
// ====================================================================
import { midiToYAbsolute } from "./pianoRoll.js";
import { getCurrentTargetNote, getFirstTargetNote } from "./voice.js";

window.midiToYAbsolute = midiToYAbsolute;

let tempoFactor = 1; // 1 = normal
window.__TEMPO_FACTOR__ = 1;

let audioCtx = null;
let startTime = null;
let isPlaying = false;

let currentTimeOffset = 0;  // <-- cuántos segundos ya avanzó la canción

let activeNodes = [];       // <-- aquí guardaremos osciladores, gains, etc.
let rafId = null;           // <-- requestAnimationFrame

let notesGlobal = [];
let svgElement = null;
let scrollContainer = null;
let pixelsPerSecond = parseInt(window.__TEMPO__);   // VELOCIDAD DE SCROLL (depende de los BPM)

// Solo Mode

let voiceGainNodes = [];
let SOLO_MODE_ACTIVE = false;

let SOLO_SELECTED_VOICE = 0;
let SOLO_OTHER_VOLUME = 0.15;
let SOLO_MAIN_VOLUME = 1.0;

window.__TARGET_MIDI__ = null;   // nota objetivo actual
window.__USER_MIDI__ = null;     // nota detectada por el micrófono
window.__SELECTED_VOICE__ = 0;
window.__ALL_NOTES__ = [];
window.__VOICE_NOTES__ = []; // Only selected voice


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

    window.__ALL_NOTES__ = notes;
    getFirstTargetNote();

    if (!audioCtx) audioCtx = new AudioContext();

    initVoiceGains(totalVoices);
}

export function playSong() {
    if (isPlaying || notesGlobal.length === 0) return;

    if (!audioCtx) audioCtx = new AudioContext();

    startTime = audioCtx.currentTime - currentTimeOffset;
    isPlaying = true;

    getFirstTargetNote();

    scheduleNotes();
    startScroll();
}

export function stopSong() {
    if (!isPlaying) return;
    isPlaying = false;

    currentTimeOffset = audioCtx.currentTime - startTime;
    window.lastIndex = 0; // Porque PlayPianoLike guardará solo las que le falte reproducir

    clearAudioNodes();
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
    const allNotesVoiceFixedTime = []

    notesGlobal.forEach(note => {
        const noteStart = startTime + (note.time / tempoFactor);
        const now = ctx.currentTime;

        if (noteStart >= now - 0.05) {
            
            if(`${window.__SELECTED_VOICE__}` === `${note.voice}`) allNotesVoiceFixedTime.push({
                ...note,
                start: noteStart,
                end: noteStart + note.duration
            })

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

function startScroll() {
    const start = audioCtx.currentTime;

    function step() {
        if (!isPlaying) return;

        const t = audioCtx.currentTime - start + currentTimeOffset;

        window.__CURRENT_PLAY_POS__ = t;

        scrollContainer.scrollLeft = t * pixelsPerSecond * tempoFactor;

        const target = getCurrentTargetNote();
        if (target) {
            window.__TARGET_MIDI__ = target.midi;
            document.getElementById("targetNote").innerText = target.name;
        }

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
    window.lastIndex = 0;
    clearAudioNodes();

    const bpm = parseFloat(document.getElementById("tempoInput").value);
    if (!isNaN(bpm) && bpm > 0) {
        tempoFactor = bpm / parseInt(window.__TEMPO__);
        window.previewNote = bpm * window.__NOTE_PREVIEW_FACTOR__;
    }

    window.__TEMPO_FACTOR__ = tempoFactor;

    setSoloMode(SOLO_MODE_ACTIVE, SOLO_SELECTED_VOICE);

    if (lastPlay) playSong();
}

export function setSoloMode(isSolo, selectedVoice) {
    SOLO_MODE_ACTIVE = isSolo;
    SOLO_SELECTED_VOICE = selectedVoice;
    window.__SELECTED_VOICE__ = selectedVoice;

    let lastPlay = isPlaying;

    isPlaying = false;
    currentTimeOffset = 0;
    window.lastIndex = 0;
    clearAudioNodes();

    voiceGainNodes.forEach((g, i) => {
        if (!isSolo) {
            g.gain.value = SOLO_MAIN_VOLUME;      // normal
        } else {
            g.gain.value = (i === selectedVoice ? SOLO_MAIN_VOLUME : SOLO_OTHER_VOLUME);
        }
    });

    if (lastPlay) playSong();
}

// ==============================================
// CONTROL DEL SING_LINE según NOTA OBJETIVO
// ==============================================

window.updateSingingLine = function () {
    if (window.__TARGET_MIDI__ == null || window.__USER_MIDI__ == null) return;

    const sing = document.getElementById("sing_line");
    if (!sing) return;

    const minMidi = window.__MIN_MIDI__;
    const maxMidi = window.__MAX_MIDI__;

    // Posición correcta del usuario en Y
    const yUser = window.midiToYAbsolute(window.__USER_MIDI__, minMidi, maxMidi);

    // Mover la línea EXACTAMENTE a ese Y
    sing.style.transform = `translateY(${yUser}px)`;

    // Mostrar diferencia (opcional)
    const diff = window.__USER_MIDI__ - window.__TARGET_MIDI__;
    document.getElementById("diffData").innerText = diff.toFixed(2);
};

