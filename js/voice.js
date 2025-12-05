// ===============================================
// voice.js — Mic input, pitch detection, tuning UI
// ===============================================

// -------------------------------------------
// Variables globales
// -------------------------------------------
import { startRecording, stopRecording } from "./recorder.js";

window.audioCtx = null;
let analyser;
window.micStream = null;

let freqData = new Float32Array(4096);
window.__NOTE_PREVIEW_FACTOR__ = 0.5 / 200;
window.preview = 0.5;

window.micOn = false;
let running = false;

window.lastIndex = 0;

const pitchText = document.getElementById("pitchData");

// Datos compartidos con pianoRollPlayer.js
window.__USER_MIDI__ = null;
window.__TARGET_MIDI__ = null;

// ===============================
//  ANALYSIS MODULE
// ===============================
let deviations = [];
let perfectNotes = 0;

export function trackDeviation(deltaCents) {
    deviations.push(deltaCents);

    if (Math.abs(deltaCents) < 15) {
        perfectNotes++;
    }
}

export function resetAnalysis() {
    deviations = [];
    perfectNotes = 0;
}

export function getFinalAnalysis() {
    if (deviations.length === 0) {
        return { desviacionPromedio: 0, perfectNotes, totalNotes: 0 };
    }

    const absAvg = deviations.reduce((a, b) => a + Math.abs(b), 0) / deviations.length;

    return {
        desviacionPromedio: absAvg.toFixed(2),
        perfectNotes,
        totalNotes: deviations.length
    };
}


// ----------------------------
// 1. START / STOP MIC
// ----------------------------
export async function startMic() {
    if (running) return;

    window.audioCtx = new AudioContext();
    window.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            voiceIsolation: false,
            googNoiseReduction: false,
            googEchoCancellation: false,
            googAutoGainControl: false,
            channelCount: 1,
            latency: 0
        }
    });

    const source = window.audioCtx.createMediaStreamSource(window.micStream);

    analyser = window.audioCtx.createAnalyser();
    analyser.fftSize = 4096;

    source.connect(analyser);

    running = true;
    window.micOn = true;

    if (window.isPlaying) startRecording();

    loop();
}

export function stopMic() {
    running = false;
    window.micOn = false;

    if (window.audioCtx) window.audioCtx.close();
    stopRecording();
}

// ----------------------------
// 2. MAIN LOOP — extract pitch
// ----------------------------
function loop() {
    if (!running) return;

    analyser.getFloatTimeDomainData(freqData);

    const freq = detectPitchFast(freqData, window.audioCtx.sampleRate);

    if (freq > 0) {
        const midi = freqToMidi(freq);
        const name = midiToNoteName(midi);

        window.__USER_MIDI__ = midi;

        pitchText.textContent = `${freq.toFixed(1)} Hz (${name})`;

        const targetFreq = midiToFreq(window.__TARGET_MIDI__);
        const deltaCents = getCentsDiff(freq, targetFreq);

        // Registrar desviación
        trackDeviation(deltaCents);
    }

    requestAnimationFrame(loop);
}

// ======================================================
// 3. OPTIMIZED YIN PITCH DETECTION
// ======================================================

function detectPitchFast(buffer, sampleRate) {
    const threshold = 0.12;

    const size = buffer.length;
    const half = size >> 1;

    // Difference function (optimizada con step=2)
    let yin = new Float32Array(half);
    for (let tau = 1; tau < half; tau++) {
        let sum = 0;
        for (let i = 0; i < half; i += 2) {
            let delta = buffer[i] - buffer[i + tau];
            sum += delta * delta;
        }
        yin[tau] = sum;
    }

    // Cumulative mean normalized difference
    yin[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < half; tau++) {
        runningSum += yin[tau];
        yin[tau] = (runningSum === 0) ? 1 : (yin[tau] * tau / runningSum);
    }

    // Absolute threshold
    let tau = -1;
    for (let i = 2; i < half; i++) {
        if (yin[i] < threshold) {
            tau = i;
            while (i + 1 < half && yin[i + 1] < yin[i]) {
                i++;
                tau = i;
            }
            break;
        }
    }

    if (tau === -1) return 0;

    // Parabolic interpolation
    let betterTau = tau;
    if (tau > 1 && tau < half - 1) {
        const y1 = yin[tau];
        const y0 = yin[tau - 1];
        const y2 = yin[tau + 1];
        betterTau = tau + (y0 - y2) / (2 * (2 * y1 - y0 - y2));
    }

    return sampleRate / betterTau;
}

// ----------------------------
// 4. Frequency ↔ MIDI
// ----------------------------
function freqToMidi(f) {
    return Math.round(69 + 12 * Math.log2(f / 440));
}

function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
}

function midiToNoteName(m) {
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    return names[m % 12] + (Math.floor(m / 12) - 1);
}

// ----------------------------
// 5. Cents (si necesitas análisis)
// ----------------------------
function getCentsDiff(freq, targetFreq) {
    return 1200 * Math.log2(freq / targetFreq);
}

// ======================================================
// 6. Target Note Handling
// (solo funciones exportadas, el cálculo se hace en pianoRollPlayer)
// ======================================================

export function getCurrentTargetNote() {
    if (window.__CURRENT_PLAY_POS__ == null) return null;
    if (window.lastIndex == null) window.lastIndex = 0;

    const t = window.__CURRENT_PLAY_POS__;
    const notes = window.__VOICE_NOTES__;

    if (!notes || notes.length === 0) return null;

    const idx = window.lastIndex;
    const note = notes[idx];
    if (!note) return null;

    const next = notes[idx + 1];

    if (!next) {
        return {
            midi: note.midi,
            name: midiToNoteName(note.midi),
            start: note.start,
            end: note.end
        };
    }

    // Si estamos cerca de la siguiente nota → cambiar target
    if (t + window.preview >= next.start) {
        window.lastIndex = idx + 1;
        return {
            midi: next.midi,
            name: midiToNoteName(next.midi),
            start: next.start,
            end: next.end
        };
    }

    // Continuar en la actual
    if (t + window.preview >= note.start) {
        return {
            midi: note.midi,
            name: midiToNoteName(note.midi),
            start: note.start,
            end: note.end
        };
    }

    return null;
}

export function getFirstTargetNote() {
    for (const note of window.__ALL_NOTES__) {
        if (`${window.__SELECTED_VOICE__}` !== `${note.voice}`) continue;

        document.getElementById("targetNote").innerText = midiToNoteName(note.midi);
        window.__TARGET_MIDI__ = note.midi;

        return {
            midi: note.midi,
            name: midiToNoteName(note.midi),
            start: note.start,
            end: note.end
        };
    }
    return null;
}
