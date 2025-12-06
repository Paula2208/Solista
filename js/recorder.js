// =====================================================
// Recording system — works with MediaRecorder
// =====================================================

let mediaRecorder = null;
let recordedChunks = [];
let recordedBlob = null;
let isRecording = false;

export async function startRecording() {
    try {
        if (isRecording) return;
        if (window.micStream == null) window.micStream = await navigator.mediaDevices.getUserMedia({
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

        recordedChunks = []; // limpiar grabaciones previas

        mediaRecorder = new MediaRecorder(micStream, {
            mimeType: "audio/webm" // máximo soporte cross-browser
        });

        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };

        mediaRecorder.start();
        isRecording = true;

        console.log("🎤 Grabación iniciada");
    } catch (err) {
        console.error("❌ Error al iniciar grabación:", err);
    }
}

export async function stopRecording() {
    return new Promise((resolve, reject) => {
        try {
            if (!isRecording || !mediaRecorder) {
                console.warn("stopRecording() llamado sin grabación activa.");
                resolve(null);
                return;
            }

            mediaRecorder.onstop = () => {
                try {
                    recordedBlob = new Blob(recordedChunks, { type: "audio/webm" });

                    // cerrar micrófono
                    if (micStream) {
                        micStream.getTracks().forEach(t => t.stop());
                    }

                    console.log("🎧 Grabación finalizada. Tamaño:", recordedBlob.size);

                    resolve(recordedBlob); // <- muy importante para tu popup
                } catch (err) {
                    console.error("Error procesando blob:", err);
                    reject(err);
                }
            };

            mediaRecorder.stop();
            isRecording = false;
        } catch (err) {
            console.error("❌ Error en stopRecording():", err);
            reject(err);
        }
    });
}
