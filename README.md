# 🌌 **Solista — Entrenador Vocal Intergaláctico**

> *Una herramienta diseñada para cantantes que vienen de otra galaxia.*

Solista es una plataforma web que permite cargar partituras en **formato MusicXML** y visualizar la línea vocal en un **piano roll galáctico**, mientras analiza tu voz en tiempo real usando técnicas modernas de procesamiento de audio.

---

## 📦 **Usar Solista**

Abre:
👉 [https://paucode.com/Solista/](https://paucode.com/Solista/)

---

## 🎶 **Cómo usar Solista**

1. Abre **demo.html**.
2. Sube un archivo **.musicxml**.
3. Selecciona tu voz (Soprano, Alto, Tenor, Bajo).
4. Se generará automáticamente el **piano roll galáctico**.
5. Activa el micrófono.
6. Comienza a cantar siguiendo la línea vocal.

Solista analizará tu afinación en tiempo real y mostrará:

* Nota detectada
* Nota objetivo
* Desviación

---

## 🚀 **Características principales**

### 🎼 Carga de Partituras (.musicxml)

* Soporte completo para archivos **MusicXML** estándar.
* Extracción de:

  * Notas (step, octave, alter)
  * Duración relativa
  * Lyrics asociados a cada nota
  * Rests (silencios)
* Mapeo automático para construcción del piano roll.

### 🎹 Piano Roll Intergaláctico

* Visualización horizontal estilo DAW.
* Colores animados tipo *nebula-gradient*.
* Scroll suave e infinito.
* Mapeo automático del rango vocal real.
* Lyrics bajo cada nota.
* Compatible con líneas vocales complejas y melismas.

### 🎤 Análisis de Voz en Tiempo Real

* Detección de tono (pitch detection).
* Comparación con la nota objetivo.
* Cálculo de desviación en centésimas.
* Feedback visual inmediato.

---

## 📁 **Estructura del proyecto**

```
solista/
│
├── index.html            # Landing page con estilo galáctico
├── demo.html             # Página principal donde ocurre la magia
│
├── css/
│   ├── styles.css        # Tema oscuro intergaláctico
│   └── components.css    # Tarjetas, botones, etc.
│
├── js/
│   ├── mxlParser.js      # Parser MusicXML → JSON de notas
│   ├── pianoRoll.js      # Renderización avanzada del piano roll
│   ├── audioEngine.js    # Detección de pitch y análisis
│   ├── ui.js             # Interacciones y control de la interfaz
│   └── utils.js          # Funciones compartidas
│
└── assets/
    ├── logos/
    ├── icons/
    └── demo-files/
```

---

## 🧠 **Tecnologías utilizadas**

* **JavaScript puro (Vanilla JS)**
* **MusicXML parsing (DOMParser)**
* **Web Audio API** (pitch detection)
* **SVG Rendering** (piano roll)
* **CSS variables galácticas**
* **Bootstrap Icons**

---

## 🔭 Roadmap

* 🎧 Playback MIDI integrado
* ⭐ Sistema de evaluación por frases
* 🪐 Modo "constelación de notas"
* 🧪 Test de afinación y rango vocal
* 🛰️ Exportación de grabaciones

---

## 🖤 Créditos

Creado por artistas, diseñadores y programadores que creen que *la música es tecnología estelar*.

Si te gustó el proyecto, deja una ⭐ en GitHub.