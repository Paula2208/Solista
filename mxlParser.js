// -------------------------------
// CARGAR Y PARSEAR MUSICXML
// -------------------------------

export async function loadMusicXML(file) {
  const xmlText = await file.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");

  const parts = [...xml.querySelectorAll("part")].map(p => parsePart(p, xml));

  return { parts };
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
function parsePart(partNode, xml) {
  const measures = [...partNode.querySelectorAll("measure")];
  let notes = [];
  let divisions = 1;
  let currentTime = 0; // <-- Nuevo: tiempo acumulado

  for (const m of measures) {
    const divNode = m.querySelector("divisions");
    if (divNode) divisions = parseInt(divNode.textContent);

    const measureNotes = [...m.querySelectorAll("note")];

    for (const n of measureNotes) {
      const durationNode = n.querySelector("duration");
      const duration = durationNode ? parseInt(durationNode.textContent) / divisions : 1;

      const lyricNode = n.querySelector("lyric > text");
      const lyric = lyricNode ? lyricNode.textContent : null;

      // ----------------------------
      // ES UN SILENCIO
      // ----------------------------
      const restNode = n.querySelector("rest");
      if (restNode) {
        notes.push({
          type: "rest",
          duration,
          time: currentTime  // <-- agregado
        });

        currentTime += duration;
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

      const midi = pitchToMidi(step, alter, octave);  // <-- Nuevo

      notes.push({
        type: "note",
        step,
        alter,
        octave,
        midi,         // <-- agregado
        duration,
        time: currentTime, // <-- agregado
        lyric
      });

      currentTime += duration;
    }
  }

  return { notes };
}
