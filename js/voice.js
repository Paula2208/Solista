// ===============================================
// voice.js — Mic input, pitch detection, tuning UI
// ===============================================

let audioCtx;
let analyser;
let micStream;
let freqData = new Float32Array(2048);
window.__NOTE_PREVIEW_FACTOR__ = 0.5/120;

let running = false;
window.lastIndex = 0;

const pitchText = document.getElementById("pitchData");

// ----------------------------
// GLOBAL LINK WITH PIANO ROLL
// ----------------------------
window.__USER_MIDI__ = null;     // nota detectada por mic
window.__TARGET_MIDI__ = null;   // nota objetivo actual

// ----------------------------
// 1. START / STOP MIC
// ----------------------------
export async function startMic() {
    if (running) return;

    audioCtx = new AudioContext();
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = audioCtx.createMediaStreamSource(micStream);

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 4096;

    source.connect(analyser);

    running = true;
    loop();
}

export function stopMic() {
    running = false;
    if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
    }
    if (audioCtx) audioCtx.close();
}

// ----------------------------
// 2. MAIN LOOP — extract pitch
// ----------------------------
function loop() {
    if (!running) return;
    analyser.getFloatTimeDomainData(freqData);

    const freq = detectPitch(freqData, audioCtx.sampleRate);

    if (freq > 0) {
        const midi = freqToMidi(freq);
        const name = midiToNoteName(midi);

        window.__USER_MIDI__ = midi;

        pitchText.textContent = `${freq.toFixed(1)} Hz (${name})`;

        window.updateSingingLine();
    }

    requestAnimationFrame(loop);
}

// ----------------------------
// 3. YIN PITCH DETECTION
// ----------------------------
function detectPitch(buffer, sampleRate) {

    let threshold = 0.10;
    let tau = 0;

    let yin = new Float32Array(buffer.length / 2);

    // Step 1: Difference function
    for (let t = 1; t < yin.length; t++) {
        let sum = 0;
        for (let i = 0; i < yin.length; i++) {
            let d = buffer[i] - buffer[i + t];
            sum += d * d;
        }
        yin[t] = sum;
    }

    // Step 2: Cumulative mean normalized difference
    yin[0] = 1;
    let runningSum = 0;
    for (let t = 1; t < yin.length; t++) {
        runningSum += yin[t];
        yin[t] *= t / runningSum;
    }

    // Step 3: Absolute threshold
    for (let t = 2; t < yin.length; t++) {
        if (yin[t] < threshold) {
            tau = t;
            break;
        }
    }
    if (tau === 0) return 0;

    // Step 4: Parabolic interpolation
    let betterTau =
        tau + (yin[tau - 1] - yin[tau + 1]) / (2 * (2 * yin[tau] - yin[tau - 1] - yin[tau + 1]));

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
// 5. CENTS DIFFERENCE (solo si lo necesitas)
// ----------------------------
function getCentsDiff(freq, targetFreq) {
    return 1200 * Math.log2(freq / targetFreq);
}

// ----------------------------
// 6. LINK WITH PIANO-ROLL
// ----------------------------

export function getCurrentTargetNote() {
    if (window.__CURRENT_PLAY_POS__ == null) return null;

    if (window.lastIndex == null) window.lastIndex = 0;

    const t = window.__CURRENT_PLAY_POS__;
    const notes = window.__VOICE_NOTES__;

    if (!notes || notes.length === 0) return null;

    const idx = window.lastIndex;
    const note = notes[idx];
    if (!note) return null;

    const nextNote = notes[idx + 1];
    if (!nextNote) return {
        midi: note.midi,
        name: midiToNoteName(note.midi),
        start: note.start,
        end: note.end
    };

    const preview = window.getPreviewTime();

    // ---- 2. Detectar INICIO de nueva nota (transición) ----
    if (nextNote && t + preview >= nextNote.start) {
        window.lastIndex = idx + 1;

        return {
            midi: nextNote.midi,
            name: midiToNoteName(nextNote.midi),
            start: nextNote.start,
            end: nextNote.end
        };
    }

    if (note && t + preview >= note.start) {
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