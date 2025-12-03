// -------------------------------
// CARGAR Y PARSEAR MUSICXML
// -------------------------------
window.__TEMPO__ = 120; 

export async function loadMusicXML(file) {
  const xmlText = await file.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");

  // Leer tempo global (si existe)
  const soundNode = xml.querySelector("sound[tempo]");
  const tempo = soundNode ? parseFloat(soundNode.getAttribute("tempo")) : 120;

  const secondsPerBeat = 60 / tempo;

  const parts = [...xml.querySelectorAll("part")].map(p =>
    parsePart(p, xml, secondsPerBeat)
  );

  return { parts, tempo };
}

// --------------------------------
// Convertir altura → MIDI number
// --------------------------------
export function pitchToMidi(step, alter, octave) {
  const STEPS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return 12 * (octave + 1) + STEPS[step] + alter;
}

// --------------------------------
// PARSEAR UNA PARTE
// --------------------------------
function parsePart(partNode, xml, secondsPerBeat) {
  const measures = [...partNode.querySelectorAll("measure")];
  let notes = [];
  let divisions = 1;
  let currentTime = 0; // tiempo en BEATS

  for (const m of measures) {
    const divNode = m.querySelector("divisions");
    if (divNode) divisions = parseInt(divNode.textContent);

    const measureNotes = [...m.querySelectorAll("note")];

    for (const n of measureNotes) {
      const durationNode = n.querySelector("duration");
      const durationBeats = durationNode
        ? parseInt(durationNode.textContent) / divisions
        : 1;

      const lyricNode = n.querySelector("lyric > text");
      const lyric = lyricNode ? lyricNode.textContent : null;

      // ----------------------------
      // ES UN SILENCIO
      // ----------------------------
      if (n.querySelector("rest")) {
        const startSec = currentTime * secondsPerBeat;
        const endSec = startSec + durationBeats * secondsPerBeat;

        notes.push({
          type: "rest",
          duration: durationBeats,
          time: currentTime,      // beats
          start: startSec,        // segundos
          end: endSec
        });

        currentTime += durationBeats;
        continue;
      }

      // ----------------------------
      // ES UNA NOTA
      // ----------------------------
      const pitchNode = n.querySelector("pitch");
      if (!pitchNode) continue;

      const step = pitchNode.querySelector("step")?.textContent ?? null;
      const alter = parseInt(pitchNode.querySelector("alter")?.textContent ?? 0);
      const octave = parseInt(pitchNode.querySelector("octave")?.textContent ?? null);

      const midi = pitchToMidi(step, alter, octave);

      const startSec = currentTime * secondsPerBeat;
      const endSec = startSec + durationBeats * secondsPerBeat;

      notes.push({
        type: "note",
        step,
        alter,
        octave,
        midi,
        duration: durationBeats,
        time: currentTime,   // beats
        start: startSec,     // segundos
        end: endSec,
        lyric
      });

      currentTime += durationBeats;
    }
  }

  return { notes };
}
