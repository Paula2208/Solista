// ----------------------------------------------------
// Mostrar Popup final con audio grabado
// ----------------------------------------------------
export function showFinalPopup({ audioBlob, metrics}) {
    let url = "";

    if (audioBlob) {
        url = URL.createObjectURL(audioBlob);
    } else {
        console.warn("⚠ No se recibió audioBlob");
        return;
    }

    // HTML del popup
    const modalHtml = `
        <!-- Modal Solista -->
        <div class="modal fade" id="finalPopupModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered" style="max-width: 420px;">
                <div class="modal-content" style="
                    background:  rgba(255,255,255,0.06);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255,255,255,0.15);
                    border-radius: 14px;
                    color: var(--text-soft);
                ">
                
                <div class="modal-header border-0">
                    <h5 class="modal-title" style="color:white; font-weight:600;">🎤 Análisis Final</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>

                <div class="modal-body">
                    <p><b>Desviación promedio:</b> ${metrics.desviacionPromedio} cents</p>
                    <p><b>Notas perfectas:</b> ${metrics.notasPerfectas} / ${metrics.totalNotas}</p>

                    ${url ? `
                    <h6 class="mt-3 mb-2" style="color:white;">Tu grabación</h6>
                    <audio controls src="${url}" class="w-100 mb-3"></audio>
                    ` : `
                    <p class="opacity-50">No hay grabación disponible.</p>
                    `}
                </div>

                <div class="modal-footer border-0">
                    <button type="button" class="btn btn-outline-light w-100 py-2" data-bs-dismiss="modal"
                        style="border-radius:10px;">
                    Cerrar
                    </button>
                </div>

                </div>
            </div>
        </div>

    `;

    // Insertar modal en el DOM
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Inicializar el modal Bootstrap
    const modal = new bootstrap.Modal(document.getElementById("finalPopupModal"));
    modal.show();

    // Limpieza al cerrar
    document.getElementById("finalPopupModal").addEventListener("hidden.bs.modal", () => {
        if (url) URL.revokeObjectURL(url);
        document.getElementById("finalPopupModal").remove();
    });
}
