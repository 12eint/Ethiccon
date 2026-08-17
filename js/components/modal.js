/**
 * Modal dialog component.
 * Uses the #modalOverlay element defined in index.html.
 */
import { initSearchableSelects } from '../app.js';

let escHandler = null;

/**
 * Open a modal dialog.
 * @param {{ title: string, content: string|HTMLElement, onSave?: Function, saveText?: string, width?: string }} options
 */
export function openModal({ title, content, onSave, saveText = 'Kaydet', width }) {
    const overlay = document.getElementById('modalOverlay');
    if (!overlay) return;

    const modalStyle = width ? `style="max-width:${width}"` : '';

    // Build footer buttons
    let footerHTML = `
        <div class="modal-footer">
            <button class="btn btn-secondary modal-cancel-btn">İptal</button>
    `;
    if (onSave) {
        footerHTML += `<button class="btn btn-primary modal-save-btn">${saveText}</button>`;
    }
    footerHTML += `</div>`;

    // Build body content
    const bodyContent = typeof content === 'string' ? content : '';

    overlay.innerHTML = `
        <div class="modal" ${modalStyle}>
            <div class="modal-header">
                <h2 class="modal-title">${title}</h2>
                <button class="modal-close" title="Kapat">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div class="modal-body">
                ${bodyContent}
            </div>
            ${footerHTML}
        </div>
    `;

    // If content is an HTMLElement, append it to the body
    if (typeof content !== 'string' && content instanceof HTMLElement) {
        const modalBody = overlay.querySelector('.modal-body');
        modalBody.innerHTML = '';
        modalBody.appendChild(content);
    }

    // Show overlay
    overlay.classList.add('active');

    // --- Event listeners ---

    // Close button
    const closeBtn = overlay.querySelector('.modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    // Cancel button
    const cancelBtn = overlay.querySelector('.modal-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }

    // Save button
    if (onSave) {
        const saveBtn = overlay.querySelector('.modal-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                onSave();
            });
        }
    }

    // Backdrop click
    overlay.addEventListener('click', handleBackdropClick);

    // Escape key
    escHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    };
    document.addEventListener('keydown', escHandler);

    // Process icons inside the modal
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
    
    // Process searchable selects inside the modal
    initSearchableSelects(overlay);
}

/**
 * Close the modal and clean up listeners.
 */
export function closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (!overlay) return;

    overlay.classList.remove('active');
    overlay.removeEventListener('click', handleBackdropClick);

    if (escHandler) {
        document.removeEventListener('keydown', escHandler);
        escHandler = null;
    }
}

/**
 * Handle clicks on the backdrop (outside the modal).
 */
function handleBackdropClick(e) {
    if (e.target.classList.contains('modal-overlay')) {
        closeModal();
    }
}
