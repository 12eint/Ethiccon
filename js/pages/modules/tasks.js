import { DB } from '../../core/store.js';
import { openModal, closeModal } from '../../components/modal.js';
import { escapeHtml, showToast, refreshIcons } from '../../core/ui.js';
import { formatShortDate } from '../../core/format.js';

export function renderTasksModule(container, eventId, onChange) {
    const render = () => {
        const tasks = DB.tasks.getByEventId(eventId);
        
        const cols = {
            todo: tasks.filter(t => t.status === 'todo'),
            progress: tasks.filter(t => t.status === 'progress'),
            done: tasks.filter(t => t.status === 'done')
        };

        const renderCard = (t) => `
            <div class="task-card" style="background: white; border: 1px solid var(--slate-200); padding: 12px; border-radius: var(--radius-md); margin-bottom: 12px; box-shadow: var(--shadow-sm); cursor: grab; position: relative;">
                <div style="display:flex; justify-content: space-between; align-items:flex-start; margin-bottom: 8px;">
                    <h5 style="margin:0; font-size: 0.9rem; font-weight: 600;">${escapeHtml(t.title)}</h5>
                    <div class="task-actions" style="display:flex; gap:4px;">
                        <button class="btn-ghost btn-sm btn-icon btn-edit-task" data-id="${t.id}" style="padding: 2px;"><i data-lucide="edit-2" style="width:14px;"></i></button>
                        <button class="btn-ghost btn-sm btn-icon btn-del-task" data-id="${t.id}" style="padding: 2px; color: var(--danger);"><i data-lucide="trash-2" style="width:14px;"></i></button>
                    </div>
                </div>
                ${t.description ? `<p style="margin: 0 0 12px 0; font-size: 0.8rem; color: var(--slate-500); line-height: 1.4;">${escapeHtml(t.description)}</p>` : ''}
                <div style="display:flex; justify-content: space-between; align-items:center; font-size: 0.75rem;">
                    <span style="color: var(--slate-500);"><i data-lucide="calendar" style="width:12px; vertical-align:middle; margin-right:4px;"></i>${t.dueDate ? formatShortDate(t.dueDate) : 'Tarih Yok'}</span>
                    <span class="badge ${t.priority === 'high' ? 'badge-danger' : t.priority === 'medium' ? 'badge-warning' : 'badge-gray'}">${t.priority === 'high' ? 'Yüksek' : t.priority === 'medium' ? 'Orta' : 'Düşük'}</span>
                </div>
                ${t.assignee ? `<div style="margin-top:8px; padding-top:8px; border-top: 1px dashed var(--slate-200); font-size: 0.75rem; color: var(--slate-600);"><strong>Sorumlu:</strong> ${escapeHtml(t.assignee)}</div>` : ''}
                
                <div style="margin-top:12px; display:flex; gap:4px;">
                    ${t.status !== 'todo' ? `<button class="btn btn-secondary btn-sm change-status" data-id="${t.id}" data-status="todo" style="flex:1; font-size:0.7rem; padding: 4px;">Yapılacak</button>` : ''}
                    ${t.status !== 'progress' ? `<button class="btn btn-secondary btn-sm change-status" data-id="${t.id}" data-status="progress" style="flex:1; font-size:0.7rem; padding: 4px;">Devam Ediyor</button>` : ''}
                    ${t.status !== 'done' ? `<button class="btn btn-secondary btn-sm change-status" data-id="${t.id}" data-status="done" style="flex:1; font-size:0.7rem; padding: 4px;">Bitti</button>` : ''}
                </div>
            </div>
        `;

        let html = `
            <div class="page-header">
                <h2>Görev Yönetimi</h2>
                <button class="btn btn-primary btn-sm" id="btnNewTask">
                    <i data-lucide="plus"></i> Yeni Görev
                </button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                <!-- TODO Column -->
                <div class="kanban-col" style="background: var(--slate-50); padding: 16px; border-radius: var(--radius-lg); border: 1px solid var(--slate-200);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
                        <h4 style="margin:0; font-size:1rem; font-weight:600; color:var(--slate-700);">Yapılacaklar</h4>
                        <span class="badge badge-gray">${cols.todo.length}</span>
                    </div>
                    <div class="task-list">
                        ${cols.todo.length === 0 ? '<div style="text-align:center; padding: 20px; color: var(--slate-400); font-size: 0.85rem;">Görev yok</div>' : cols.todo.map(renderCard).join('')}
                    </div>
                </div>

                <!-- IN PROGRESS Column -->
                <div class="kanban-col" style="background: var(--info-light); padding: 16px; border-radius: var(--radius-lg); border: 1px solid #bfdbfe;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
                        <h4 style="margin:0; font-size:1rem; font-weight:600; color:var(--info);">Devam Edenler</h4>
                        <span class="badge badge-info">${cols.progress.length}</span>
                    </div>
                    <div class="task-list">
                        ${cols.progress.length === 0 ? '<div style="text-align:center; padding: 20px; color: var(--info); opacity:0.5; font-size: 0.85rem;">Görev yok</div>' : cols.progress.map(renderCard).join('')}
                    </div>
                </div>

                <!-- DONE Column -->
                <div class="kanban-col" style="background: var(--success-light); padding: 16px; border-radius: var(--radius-lg); border: 1px solid #a7f3d0;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
                        <h4 style="margin:0; font-size:1rem; font-weight:600; color:var(--success);">Tamamlananlar</h4>
                        <span class="badge badge-success">${cols.done.length}</span>
                    </div>
                    <div class="task-list">
                        ${cols.done.length === 0 ? '<div style="text-align:center; padding: 20px; color: var(--success); opacity:0.5; font-size: 0.85rem;">Görev yok</div>' : cols.done.map(renderCard).join('')}
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        refreshIcons(container);

        // Add Event Listeners for actions
        container.querySelectorAll('.change-status').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const newStatus = e.currentTarget.dataset.status;
                DB.tasks.update(id, { status: newStatus });
                render();
            });
        });

        container.querySelectorAll('.btn-del-task').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if(confirm('Bu görevi silmek istiyor musunuz?')) {
                    DB.tasks.delete(e.currentTarget.dataset.id);
                    render();
                }
            });
        });

        container.querySelectorAll('.btn-edit-task').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const t = DB.tasks.getById(id);
                if(t) openTaskModal(t);
            });
        });

        container.querySelector('#btnNewTask')?.addEventListener('click', () => {
            openTaskModal();
        });
    };

    const openTaskModal = (task = null) => {
        const isEdit = !!task;
        const formHTML = `
            <div class="form-group">
                <label class="form-label">Görev Başlığı *</label>
                <input type="text" class="form-input" id="tskTitle" value="${task?.title || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Açıklama</label>
                <textarea class="form-textarea" id="tskDesc" rows="3">${task?.description || ''}</textarea>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Son Tarih (Deadline)</label>
                    <input type="date" class="form-input" id="tskDue" value="${task?.dueDate || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Sorumlu Kişi</label>
                    <input type="text" class="form-input" id="tskAssignee" value="${task?.assignee || ''}" placeholder="Örn: Ayşe Hanım">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Öncelik</label>
                    <select class="form-select" id="tskPriority">
                        <option value="low" ${task?.priority === 'low' ? 'selected' : ''}>Düşük</option>
                        <option value="medium" ${!task || task?.priority === 'medium' ? 'selected' : ''}>Orta</option>
                        <option value="high" ${task?.priority === 'high' ? 'selected' : ''}>Yüksek</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Durum</label>
                    <select class="form-select" id="tskStatus">
                        <option value="todo" ${!task || task?.status === 'todo' ? 'selected' : ''}>Yapılacaklar</option>
                        <option value="progress" ${task?.status === 'progress' ? 'selected' : ''}>Devam Ediyor</option>
                        <option value="done" ${task?.status === 'done' ? 'selected' : ''}>Tamamlandı</option>
                    </select>
                </div>
            </div>
        `;

        openModal({
            title: isEdit ? 'Görevi Düzenle' : 'Yeni Görev',
            content: formHTML,
            width: '500px',
            onSave: () => {
                const title = document.getElementById('tskTitle').value;
                if(!title) { alert('Görev başlığı zorunludur.'); return; }

                const data = {
                    eventId,
                    title,
                    description: document.getElementById('tskDesc').value,
                    dueDate: document.getElementById('tskDue').value,
                    assignee: document.getElementById('tskAssignee').value,
                    priority: document.getElementById('tskPriority').value,
                    status: document.getElementById('tskStatus').value
                };

                if(isEdit) {
                    DB.tasks.update(task.id, data);
                    showToast('Görev güncellendi.');
                } else {
                    DB.tasks.create(data);
                    DB.logs.add(`Yeni bir görev oluşturuldu: ${title}`);
                    showToast('Görev oluşturuldu.');
                }

                closeModal();
                // Sekme başlığındaki sayaç da güncellensin diye üst sayfayı tazeleriz.
                if (onChange) onChange(); else render();
            }
        });
    };

    render();
}
