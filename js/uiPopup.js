// ----------------------------------------------------
// Mostrar Popup final con análisis galáctico + medalla + rango vocal + gráfico de afinación
// ----------------------------------------------------
export function showFinalPopup({ audioBlob, metrics }) {
    if (!audioBlob) {
        console.warn("⚠ No se recibió audioBlob");
        return;
    }

    const url = URL.createObjectURL(audioBlob);

    // ============================
    // 1. MEDALLA SEGÚN RENDIMIENTO
    // ============================
    let percentage = (metrics.perfectNotes / metrics.totalNotes) * 100;
    let medal = "";
    let medalColor = "";
    let medalDesc = "";
    let chips = [];

    if (percentage >= 80) {
        medal = "🥇 Precisión Galáctica";
        medalColor = "linear-gradient(90deg, #ffdd55, #ffb347)";
        medalDesc = "Tu afinación es impecable: cada nota cae exactamente en su frecuencia ideal. ¡Tu control vocal atraviesa el espacio-tiempo con precisión!";
        chips = ['Profesional', 'Técnico', 'Épico'];
    } else if (percentage >= 65) {
        medal = "🥈 Intérprete de Nebulosa";
        medalColor = "linear-gradient(90deg, #b16cea, #5d26c1)";
        medalDesc = "Tu voz fluye con estabilidad y musicalidad a través de las capas sonoras del cosmos. Tu control melódico revela una técnica en expansión constante.";
        chips = ['Elegante', 'Estable', 'En Crecimiento'];
    } else if (percentage >= 45) {
        medal = "🥉 Explorador Armónico";
        medalColor = "linear-gradient(90deg, #4facfe, #00f2fe)";
        medalDesc = "Tu exploración continúa avanzando. Cada nota te impulsa más lejos en tu viaje musical.";
        chips = ['Motivador', 'En Proceso de Mejora'];
    } else {
        medal = "✨ Aprendiz Estelar";
        medalColor = "linear-gradient(90deg, #9795f0, #fbc8d4)";
        medalDesc = "Tu travesía apenas comienza, pero ya brillas con potencial. Cada práctica te impulsa a nuevas galaxias musicales.";
        chips = ['Tierno', 'Comenzando Fuerte'];
    }

    // ============================
    // 2. RANGO VOCAL DETECTADO
    // ============================
    const { lowestNote, highestNote, bestNote, worstNote } = metrics;

    console.log('Metrics:', metrics);

    // ============================
    // HTML DEL MODAL (con canvas)
    // ============================
    const modalHtml = `
        <div class="modal fade" id="finalPopupModal" tabindex="-1" aria-hidden="true" style="z-index: 100003">
            <div class="modal-dialog modal-dialog-centered" style="max-width: 57%;">
                <div class="modal-content" style="
                    background: rgba(255,255,255,0.06);
                    backdrop-filter: blur(14px);
                    border: 1px solid rgba(255,255,255,0.18);
                    border-radius: 16px;
                    color: var(--text-soft);
                    box-shadow: 0 0 22px rgba(120,80,255,0.25);
                ">
                
                <div class="modal-header border-0">
                    <h5 class="modal-title" style="color:white; font-weight:600;">🎤 Análisis Final</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>

                <div class="modal-body">

                    <!-- ⭐ MEDALLA -->
                    <div style="
                        background: ${medalColor};
                        padding: 14px;
                        border-radius: 14px;
                        text-align: center;
                        color: #1a1a1a;
                        font-weight: 600;
                        font-size: 1.1rem;
                        margin-bottom: 12px;
                        box-shadow: 0 0 16px rgba(255,255,255,0.25);
                    ">
                        ${medal}
                    </div>


                    <hr class="my-4" style="border-color:rgba(255,255,255,0.1);">

                    <div style="display: flex; gap: 1em; flex: 2;">
                        <div>
                            <p style="color:white; opacity:0.8; text-align: center;">
                                ${medalDesc}
                            </p>

                            <!-- Chips -->
                            <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-bottom:14px;">
                                ${chips.map(c => `
                                        <span style="
                                            padding: 6px 12px;
                                            border-radius: 20px;
                                            font-size: 0.74rem;
                                            background: rgba(255,255,255,0.12);
                                            border: 1px solid rgba(255,255,255,0.15);
                                            backdrop-filter: blur(6px);
                                            color: white;
                                        ">${c}</span>
                                    `).join("")
        }
                            </div>
                        </div>
                        <div style="width: 100%; display: flex; flex-direction: column; align-items: center;">
                            <p><b>${percentage.toFixed(1)}% de Notas Perfectas</b></p>
                            <p><b>Rango cantado:</b> ${lowestNote} – ${highestNote}</p>
                            <p><b>Nota más afinada:</b> ${bestNote}</p>
                            <p><b>Nota más desafinada:</b> ${worstNote}</p>
                        </div>
                    </div>

                    <hr class="my-4" style="border-color:rgba(255,255,255,0.1);">

                    <h6 style="color:white;">📈 Afinación durante la sesión</h6>
                    <canvas id="pitchChart" width="440" height="140" style="
                        width:100%;
                        margin-top: 10px;
                        border-radius:12px;
                        background: rgba(255,255,255,0.05);
                    "></canvas>

                    <hr class="my-4" style="border-color:rgba(255,255,255,0.06);">

                    <h6 class="mt-3 mb-2" style="color:white;">🎧 Tu grabación</h6>
                    <audio controls src="${url}" class="w-100 mb-3"></audio>

                    <a download="solista_recording.webm" href="${url}" 
                        class="btn btn-outline-light w-100"
                        style="border-radius:10px; margin-bottom:10px;">
                        Descargar audio
                    </a>
                </div>

                </div>
            </div>
        </div>
    `;

    // Insertar modal
    document.body.insertAdjacentHTML("beforeend", modalHtml);
    const modal = new bootstrap.Modal(document.getElementById("finalPopupModal"));
    modal.show();

    // Cuando el modal ya está visible → dibujamos gráfico
    setTimeout(() => drawPitchChart(metrics.pitchHistory), 250);

    document.getElementById("finalPopupModal").addEventListener("hidden.bs.modal", () => {
        URL.revokeObjectURL(url);
        document.getElementById("finalPopupModal").remove();
    });
}


// -------------------------------------------------------------
// GRÁFICO DE AFINACIÓN con línea central (0 cents)
// ------------------------------------------------------------- -------------------------------------------------------------
function drawPitchChart(data) {
    if (!data || !data.length) return;

    const canvas = document.getElementById("pitchChart");
    const ctx = canvas.getContext("2d");

    const dpr = window.devicePixelRatio || 1;

    // El canvas tiene un width="440" height="140",
    // pero visualmente se estira con CSS → lo escalamos:
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);
    // ===================================================

    const W = rect.width;
    const H = rect.height;

    ctx.clearRect(0, 0, W, H);

    // ------------------------------
    // 1. Determinar rango en cents
    // ------------------------------
    const maxAbs = Math.max(...data.map(v => Math.abs(v)));
    const padding = 1.15;
    const range = (maxAbs || 50) * padding;  // si no hay rango, usar 50c

    // La línea central (0 cents)
    const centerY = H / 2;

    // Convertir cents → y
    const centsToY = cents => centerY - (cents / range) * (H / 2 - 8);

    // ------------------------------
    // 2. Dibujar línea central
    // ------------------------------
    ctx.beginPath();
    ctx.strokeStyle = "#3BDFFF";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.moveTo(0, centerY);
    ctx.lineTo(W, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    // ------------------------------
    // 3. Animación progresiva
    // ------------------------------
    let progress = 0;

    function animate() {
        progress += 0.025;
        if (progress > 1) progress = 1;

        ctx.clearRect(0, 0, W, H);

        // REDIBUJAR línea central
        ctx.beginPath();
        ctx.strokeStyle = "#3BDFFF";
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        ctx.moveTo(0, centerY);
        ctx.lineTo(W, centerY);
        ctx.stroke();
        ctx.setLineDash([]);

        // ------------------------------
        // 4. Degradado del área
        // ------------------------------
        const gradient = ctx.createLinearGradient(0, 0, 0, H);
        gradient.addColorStop(0, "rgba(171,126,255,0.35)");
        gradient.addColorStop(1, "rgba(171,126,255,0.05)");

        ctx.beginPath();
        for (let i = 0; i < data.length * progress; i++) {
            const x = (i / (data.length - 1)) * W;
            const y = centsToY(data[i]);

            if (i === 0) ctx.moveTo(x, centerY);
            ctx.lineTo(x, y);
        }
        ctx.lineTo((data.length * progress) / (data.length - 1) * W, centerY);
        ctx.closePath();

        ctx.fillStyle = gradient;
        ctx.fill();

        // ------------------------------
        // 5. Curva principal con glow
        // ------------------------------
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(220,200,255,1)";

        ctx.shadowBlur = 12;
        ctx.shadowColor = "rgba(190,150,255,0.8)";

        for (let i = 0; i < data.length * progress; i++) {
            const x = (i / (data.length - 1)) * W;
            const y = centsToY(data[i]);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        ctx.stroke();
        ctx.shadowBlur = 0;

        if (progress < 1) requestAnimationFrame(animate);
    }

    animate();
}

