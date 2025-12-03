
// === CONFIG ===
const CONFIG = {
    pxPerBeat: parseInt(window.__TEMPO__),   // Ancho por pulso
    noteHeight: 23,   // Alto por nota MIDI
    topPadding: 5,
    leftPadding: 10
};

export function renderPianoRoll(notes, selectedVoice, containerId = "pianoSvg") {
    const svg = document.getElementById(containerId);
    svg.innerHTML = "";

    ensureGradient(svg);

    const minMidi = Math.min(...notes.filter(n => n.type === "note").map(n => n.midi));
    const maxMidi = Math.max(...notes.filter(n => n.type === "note").map(n => n.midi));

    window.__MIN_MIDI__ = minMidi;
    window.__MAX_MIDI__ = maxMidi;
    window.__SELECTED_VOICE__ = selectedVoice;

    const totalTime = Math.max(...notes.map(n => n.time + n.duration));
    const width = totalTime * CONFIG.pxPerBeat + 200;
    const height = (maxMidi - minMidi + 1) * CONFIG.noteHeight + CONFIG.topPadding * 2;

    svg.setAttribute("width", width);
    svg.setAttribute("height", height);

    drawGrid(svg, minMidi, maxMidi, totalTime, width, height);
    drawNotes(svg, notes, minMidi, maxMidi, selectedVoice);
}

// === GRID ===
function drawGrid(svg, minMidi, maxMidi, totalTime, width, height) {
    for (let midi = minMidi; midi <= maxMidi; midi++) {
        const y = getY(midi, minMidi, maxMidi);

        const line = createSVG("line", {
            x1: 0,
            x2: width,
            y1: y,
            y2: y,
            stroke: "rgba(255,255,255,0.05)"
        });
        svg.appendChild(line);
    }

    for (let beat = 0; beat <= totalTime + 1; beat++) {
        const x = beat * CONFIG.pxPerBeat;

        const line = createSVG("line", {
            x1: x,
            x2: x,
            y1: 0,
            y2: height,
            stroke: beat % 4 === 0 ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.07)",
            "stroke-width": beat % 4 === 0 ? 2 : 1
        });
        svg.appendChild(line);
    }
}


// === DRAW NOTES ===
function drawNotes(svg, notes, minMidi, maxMidi, selectedVoice) {
    notes.forEach(n => {
        if (n.type !== "note") return;

        const x = n.time * CONFIG.pxPerBeat;
        const w = n.duration * CONFIG.pxPerBeat;
        const y = getY(n.midi, minMidi, maxMidi) + 2;

        const isSelected = Number(n.voice) === Number(selectedVoice);

        const color = isSelected
            ? "url(#selectedGradient)"  // gradiente azul-morado
            : "rgba(255,255,255,0.15)"; // gris claro para las demás

        const rect = createSVG("rect", {
            x,
            y,
            width: w,
            height: CONFIG.noteHeight - 4,
            rx: 3,
            fill: color,
            stroke: isSelected ? "#9b7bff" : "none",
            "stroke-width": isSelected ? 0.8 : 0
        });

        svg.appendChild(rect);

        if (n.lyric) {
            const text = createSVG("text", {
                x: x + 5,
                y: y + (CONFIG.noteHeight - 8),
                fill: isSelected ? "black" : "#494f59",
                "font-size": "15px",
                "font-weight": "500",
                "pointer-events": "none"
            });
            text.textContent = n.lyric;
            svg.appendChild(text);
        }

    });
}

function ensureGradient(svg) {
    if (svg.querySelector("#selectedGradient")) return;

    const defs = createSVG("defs", {});
    const grad = createSVG("linearGradient", {
        id: "selectedGradient",
        x1: "0%", y1: "0%", x2: "100%", y2: "0%"
    });

    grad.appendChild(createSVG("stop", { offset: "0%", "stop-color": "#6bc8ff" }));
    grad.appendChild(createSVG("stop", { offset: "100%", "stop-color": "#b266ff" }));

    defs.appendChild(grad);
    svg.appendChild(defs);
}

// === HELPERS ===
function createSVG(type, attrs) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", type);
    Object.entries(attrs).forEach(([k, v]) => element.setAttribute(k, v));
    return element;
}

function getY(midi, minMidi, maxMidi) {
    return (maxMidi - midi) * CONFIG.noteHeight + CONFIG.topPadding;
}

// Conversión global para que el micrófono pueda usar la misma escala

const escalaMientras = 10;

export function midiToYAbsolute(midi, minMidi, maxMidi) {
    return ((maxMidi - midi) * CONFIG.noteHeight + CONFIG.topPadding) - escalaMientras;
}
