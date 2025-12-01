// ===============================================
// voice.js — Mic input, pitch detection, tuning UI
// ===============================================

let audioCtx;
let analyser;
let micStream;
let freqData = new Float32Array(2048);

let running = false;

const pitchText = document.getElementById("pitchData");
const diffText  = document.getElementById("diffData");
const targetText = document.getElementById("targetNote");

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

        pitchText.textContent = `${freq.toFixed(1)} Hz (${name})`;

        let target = getCurrentTargetNote();
        if (target) {
            targetText.textContent = target.name;
            const diff = getCentsDiff(freq, midiToFreq(target.midi));
            diffText.textContent = diff.toFixed(1) + " cents";
            updatePitchLine(diff, target.midi);
        }
    }

    requestAnimationFrame(loop);
}

// ----------------------------
// 3. YIN PITCH DETECTION
// ----------------------------
function detectPitch(buffer, sampleRate) {

    let threshold = 0.10;
    let tau = 0;
    let minTau = 0;

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
    return names[m % 12] + Math.floor(m / 12);
}

// ----------------------------
// 5. CENTS DIFFERENCE
// ----------------------------
function getCentsDiff(freq, targetFreq) {
    return 1200 * Math.log2(freq / targetFreq);
}

// ----------------------------
// 6. LINK WITH PIANO-ROLL
// ----------------------------
// Buscar la nota actual del piano-roll según la línea vertical azul
function getCurrentTargetNote() {
    if (!window.__CURRENT_PLAY_POS__ || !window.__ALL_NOTES__) return null;

    const t = window.__CURRENT_PLAY_POS__;

    for (const note of window.__ALL_NOTES__) {
        if (t >= note.start && t <= note.end) {
            return {
                midi: note.midi,
                name: midiToNoteName(note.midi)
            };
        }
    }
    return null;
}

// ----------------------------
// 7. DRAW RED PITCH LINE
// ----------------------------
let pitchLineEl = null;

function updatePitchLine(diff, midiTarget) {
    const svg = document.getElementById("pianoSvg");

    if (!pitchLineEl) {
        pitchLineEl = document.createElementNS("http://www.w3.org/2000/svg", "line");
        pitchLineEl.setAttribute("stroke", "red");
        pitchLineEl.setAttribute("stroke-width", "3");
        pitchLineEl.setAttribute("x1", "0");
        pitchLineEl.setAttribute("x2", "3000");
        svg.appendChild(pitchLineEl);
    }

    // Cada nota ocupa 10px verticales → mismo mapeo que tu piano-roll
    const pxPerSemitone = 10;

    // diff en cents → convertir a desplazamiento en pixels
    const semitoneOffset = diff / 100;
    const pixelOffset = semitoneOffset * pxPerSemitone;

    // Posición vertical base de la nota target
    const baseY = (127 - midiTarget) * pxPerSemitone;

    pitchLineEl.setAttribute("y1", baseY + pixelOffset);
    pitchLineEl.setAttribute("y2", baseY + pixelOffset);
}
