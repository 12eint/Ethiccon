import { DB } from '../db.js';
import { openModal, closeModal } from '../components/modal.js';
import { createTable } from '../components/table.js';

export function renderTasks(container) {
    const currentUser = DB.users.getCurrentUser();
    const isAdmin = currentUser?.role === 'admin';
    const users = DB.users.getAll();

    const events = DB.events.getAll();
    if (events.length === 0) {
        container.innerHTML = `<div class="card" style="padding:48px; text-align:center;">Lütfen önce organizasyon oluşturun.</div>`;
        return;
    }

    let selectedEventId = events[0].id;

    const render = () => {
        let allTasks = DB.tasks.getByEventId(selectedEventId);
        
        // Managers only see tasks assigned to them
        if (!isAdmin) {
            allTasks = allTasks.filter(t => t.assignedTo === currentUser.id);
        }

        let html = `
            <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--slate-900);">Görev ve İş Takibi</h2>
                    <p style="color: var(--slate-500); font-size: 0.875rem;">Kongreye ait operasyonel görevleri yönetin</p>
                </div>
                <div style="display: flex; gap: 16px; align-items: center;">
                    <select class="form-select" id="eventSelector" style="width: 300px; font-weight: 600;">
                        ${events.map(e => `<option value="${e.id}" ${e.id === selectedEventId ? 'selected' : ''}>${e.name}</option>`).join('')}
                    </select>
                    ${isAdmin ? `
                    <button class="btn btn-primary" id="btnAddTask">
                        <i data-lucide="plus"></i> Yeni Görev Ata
                    </button>
                    ` : ''}
                </div>
            </div>

            <div class="card">
                <div id="tasksTableContainer"></div>
            </div>
        `;

        container.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons();

        container.querySelector('#eventSelector').addEventListener('change', (e) => {
            selectedEventId = e.target.value;
            render();
        });

        if (isAdmin) {
            container.querySelector('#btnAddTask').addEventListener('click', () => {
                const userOptions = users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
                
                const formHTML = `
                    <div class="form-group">
                        <label class="form-label">Görev Başlığı*</label>
                        <input type="text" id="taskTitle" class="form-input" placeholder="Örn: X Firması faturası kesilecek">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Açıklama</label>
                        <textarea id="taskDesc" class="form-textarea" placeholder="Detaylar..."></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Görevlendirilecek Kişi*</label>
                        <select id="taskAssignee" class="form-select">
                            <option value="">Seçiniz...</option>
                            ${userOptions}
                        </select>
                    </div>
                `;

                openModal({
                    title: 'Yeni Görev Ata',
                    content: formHTML,
                    width: '500px',
                    onSave: () => {
                        const title = document.getElementById('taskTitle').value;
                        const assignee = document.getElementById('taskAssignee').value;
                        
                        if (!title || !assignee) {
                            alert('Lütfen görev başlığı ve atanacak kişiyi seçin.');
                            return;
                        }

                        DB.tasks.create({
                            eventId: selectedEventId,
                            title: title,
                            description: document.getElementById('taskDesc').value,
                            assignedTo: assignee,
                            status: 'pending',
                            createdBy: currentUser.name
                        });

                        closeModal();
                        render();
                    }
                });
            });
        }

        if (allTasks.length === 0) {
            document.getElementById('tasksTableContainer').innerHTML = `
                <div style="padding: 48px; text-align: center; color: var(--slate-500);">
                    <i data-lucide="check-square" style="width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>Bu organizasyon için herhangi bir görev bulunmuyor.</p>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        createTable(document.getElementById('tasksTableContainer'), {
            columns: [
                { key: 'title', label: 'Görev', render: (val, row) => `<strong>${val}</strong><div style="font-size:0.75rem; color:var(--slate-500);">${row.description || ''}</div>` },
                { key: 'assignedTo', label: 'Atanan Kişi', render: (val) => {
                    const u = users.find(x => x.id === val);
                    return u ? u.name : 'Bilinmiyor';
                }},
                { key: 'createdBy', label: 'Oluşturan', render: (val) => `<div style="font-size:0.75rem; color:var(--slate-500);"><i data-lucide="user" style="width:12px; height:12px;"></i> ${val || '-'}</div>` },
                { key: 'status', label: 'Durum', render: (val) => {
                    return val === 'completed' 
                        ? '<span class="badge badge-success"><i data-lucide="check" style="width:12px; height:12px;"></i> Tamamlandı</span>' 
                        : '<span class="badge badge-warning"><i data-lucide="clock" style="width:12px; height:12px;"></i> Bekliyor</span>';
                }}
            ],
            data: allTasks,
            searchable: true,
            searchPlaceholder: 'Görevlerde ara...',
            pageSize: 10,
            actions: [
                {
                    icon: 'check-circle',
                    className: 'view', // styling trick to make it look active
                    title: 'Durumu Değiştir',
                    onClick: (row) => {
                        const newStatus = row.status === 'completed' ? 'pending' : 'completed';
                        DB.tasks.update(row.id, { status: newStatus });
                        render();
                    }
                },
                ...(isAdmin ? [{
                    icon: 'trash-2',
                    className: 'delete',
                    title: 'Sil',
                    onClick: (row) => {
                        if(confirm('Görevi silmek istediğinize emin misiniz?')) {
                            DB.tasks.delete(row.id);
                            render();
                        }
                    }
                }] : [])
            ]
        });
    };

    render();
}
