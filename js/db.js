export const DB = {
  init() {
    const initialized = localStorage.getItem('ethiccon_initialized');
    if (!initialized) {
      this.seedData();
      localStorage.setItem('ethiccon_initialized', 'true');
    }
    
    // Force seed users if empty (for existing users who didn't get the updated seedData)
    const users = this._getData('ethiccon_users');
    if (users.length === 0) {
      const newUsers = [
        { id: 'admin', username: 'admin', password: '123', name: 'Sistem Yöneticisi', role: 'admin', permissions: ['all'] },
        { id: 'staff', username: 'staff', password: '123', name: 'Operasyon Sorumlusu', role: 'staff', permissions: ['view_participants', 'add_participants'] }
      ];
      this._saveData('ethiccon_users', newUsers);
      localStorage.setItem('ethiccon_current_user', newUsers[0].id);
    }

    // Force seed companies if empty
    const comps = this._getData('ethiccon_companies');
    if (comps.length === 0) {
      const newComps = [
        { id: crypto.randomUUID(), name: 'Firma A', commercialTitle: 'A Medikal ve Sağlık Hizmetleri A.Ş.', taxOffice: 'Beşiktaş', taxNumber: '1234567890', address: 'Levent, İstanbul', contactName: 'Ahmet Yılmaz', contactPhone: '05321112233', createdAt: new Date().toISOString() },
        { id: crypto.randomUUID(), name: 'Firma B', commercialTitle: 'B İlaç Sanayi Ltd. Şti.', taxOffice: 'Kadıköy', taxNumber: '0987654321', address: 'Kozyatağı, İstanbul', contactName: 'Ayşe Kaya', contactPhone: '05332223344', createdAt: new Date().toISOString() }
      ];
      this._saveData('ethiccon_companies', newComps);
    }
  },

  seedData() {
    const events = [
      {
        id: crypto.randomUUID(),
        name: '15. Ulusal Kardiyoloji Kongresi',
        city: 'İstanbul',
        venue: 'İstanbul Kongre Merkezi',
        startDate: '2026-09-15',
        endDate: '2026-09-18',
        capacity: 1500,
        status: 'active',
        description: 'Türkiye\'nin en büyük kardiyoloji buluşması.',
        assignedManagerId: null, // Admin or anyone
        createdAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: 'Uluslararası Nöroloji Sempozyumu 2026',
        city: 'Antalya',
        venue: 'Regnum Carya Convention Centre',
        startDate: '2026-11-05',
        endDate: '2026-11-08',
        capacity: 800,
        status: 'planned',
        description: 'Uluslararası katılımlı nöroloji güncel gelişmeler sempozyumu.',
        assignedManagerId: null, // Will be assigned to Zeynep dynamically below
        createdAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: '10. Ortopedi ve Travmatoloji Kongresi',
        city: 'Ankara',
        venue: 'Ankara Congresium',
        startDate: '2026-03-10',
        endDate: '2026-03-13',
        capacity: 600,
        status: 'completed',
        description: 'Geleneksel ortopedi kongresi.',
        createdAt: new Date().toISOString()
      }
    ];

    localStorage.setItem('ethiccon_events', JSON.stringify(events));

    const participants = [];
    const sponsors = [];
    const budgetItems = [];
    const proformas = [];
    const proformaItems = [];
    const tasks = [];

    // Seed data for 1st event
    const e1 = events[0].id;
    participants.push(
      { id: crypto.randomUUID(), eventId: e1, authorizedPerson: 'Ahmet Yılmaz', company: 'Cerrahpaşa Tıp', firstName: 'Ahmet', lastName: 'Yılmaz', email: 'ahmet@example.com', phone: '05321112233', birthDate: '1980-05-15', tcNo: '12345678901', passportNo: '', passportExpiry: '', depCity: 'İstanbul', type: 'speaker', accommodation: true, roomType: 'SNG', transfer: true, notes: '', createdAt: new Date().toISOString() },
      { id: crypto.randomUUID(), eventId: e1, authorizedPerson: 'Ayşe Demir', company: 'Hacettepe Üniv.', firstName: 'Ayşe', lastName: 'Demir', email: 'ayse@example.com', phone: '05332223344', birthDate: '1975-08-22', tcNo: '23456789012', passportNo: 'U123456', passportExpiry: '2030-01-01', depCity: 'Ankara', type: 'vip', accommodation: true, roomType: 'DBL', transfer: false, notes: '', createdAt: new Date().toISOString() },
      { id: crypto.randomUUID(), eventId: e1, authorizedPerson: 'Mehmet Kaya', company: 'Ankara Şehir', firstName: 'Mehmet', lastName: 'Kaya', email: 'mehmet@example.com', phone: '05343334455', birthDate: '1990-11-10', tcNo: '34567890123', passportNo: '', passportExpiry: '', depCity: 'İzmir', type: 'standard', accommodation: false, roomType: '', transfer: false, notes: '', createdAt: new Date().toISOString() }
    );
    const accommodations = [
      { id: crypto.randomUUID(), eventId: e1, allotment: { SNG: { count: 50, buyPrice: 1500, sellPrice: 2000 }, DBL: { count: 30, buyPrice: 2500, sellPrice: 3500 }, TRPL: { count: 10, buyPrice: 3000, sellPrice: 4500 } }, createdAt: new Date().toISOString() }
    ];
    const flights = [
      { 
        id: crypto.randomUUID(), eventId: e1, participantId: participants[0].id, 
        supplier: 'TourCo', airline: 'Türk Hava Yolları', buyPrice: 3500, sellPrice: 5000,
        outbound: { depCity: 'İstanbul', arrDate: '2026-09-14', domFlightCode: 'TK100', depTime: '10:00', arrTime: '11:15', arrCity: 'Antalya', intFlightCode: '', intDepTime: '', intArrTime: '', arrArea: 'Terminal 1' },
        inbound: { depDate: '2026-09-19', intFlightCode: '', intDepTime: '', intArrTime: '', domDepDate: '2026-09-19', domFlightCode: 'TK101', domDepTime: '15:00', domArrTime: '16:20' },
        createdAt: new Date().toISOString() 
      }
    ];
    const technicalRequests = [
      { id: crypto.randomUUID(), eventId: e1, description: 'Ana salon LED ekran 4x3m', status: 'pending', createdAt: new Date().toISOString() },
      { id: crypto.randomUUID(), eventId: e1, description: 'VIP yaka mikrofonu x2', status: 'confirmed', createdAt: new Date().toISOString() }
    ];
    const s1 = crypto.randomUUID();
    sponsors.push(
      { id: s1, eventId: e1, companyName: 'PharmaTech', contactPerson: 'Ali Veli', contactEmail: 'ali@pharmatech.com', contactPhone: '02125556677', packageType: 'ana-sponsor', standArea: 50, additionalRequests: 'Özel aydınlatma', status: 'confirmed', createdAt: new Date().toISOString() },
      { id: crypto.randomUUID(), eventId: e1, companyName: 'MediSupplies', contactPerson: 'Zeynep Çelik', contactEmail: 'zeynep@medisupplies.com', contactPhone: '02124445566', packageType: 'gold', standArea: 30, additionalRequests: '', status: 'confirmed', createdAt: new Date().toISOString() }
    );
    budgetItems.push(
      { id: crypto.randomUUID(), eventId: e1, category: 'Sponsorluk Geliri', description: 'Ana sponsor ödemesi', amount: 500000, type: 'income', createdAt: new Date().toISOString() },
      { id: crypto.randomUUID(), eventId: e1, category: 'Kayıt Geliri', description: 'Erken kayıt ödemeleri', amount: 250000, type: 'income', createdAt: new Date().toISOString() },
      { id: crypto.randomUUID(), eventId: e1, category: 'Otel Gideri', description: 'Konaklama peşinatı', amount: 300000, type: 'expense', createdAt: new Date().toISOString() },
      { id: crypto.randomUUID(), eventId: e1, category: 'Organizasyon Gideri', description: 'Salon kirası', amount: 150000, type: 'expense', createdAt: new Date().toISOString() }
    );
    const p1 = crypto.randomUUID();
    proformas.push({ id: p1, eventId: e1, sponsorId: s1, invoiceNo: 'PF-2026-001', issueDate: '2026-06-01', dueDate: '2026-06-15', vatRate: 20, notes: 'Erken ödeme indirimi uygulanmıştır.', createdAt: new Date().toISOString() });
    proformaItems.push(
      { id: crypto.randomUUID(), proformaId: p1, description: 'Ana Sponsorluk Paketi', quantity: 1, unitPrice: 400000 },
      { id: crypto.randomUUID(), proformaId: p1, description: 'Ekstra Stand Alanı (m2)', quantity: 10, unitPrice: 10000 }
    );

    localStorage.setItem('ethiccon_participants', JSON.stringify(participants));
    localStorage.setItem('ethiccon_accommodations', JSON.stringify(accommodations));
    localStorage.setItem('ethiccon_flights', JSON.stringify(flights));
    localStorage.setItem('ethiccon_technicalRequests', JSON.stringify(technicalRequests));
    localStorage.setItem('ethiccon_sponsors', JSON.stringify(sponsors));
    localStorage.setItem('ethiccon_budgetItems', JSON.stringify(budgetItems));
    localStorage.setItem('ethiccon_proformas', JSON.stringify(proformas));
    localStorage.setItem('ethiccon_proformaItems', JSON.stringify(proformaItems));
    localStorage.setItem('ethiccon_tasks', JSON.stringify(tasks));

    const users = [
      { id: 'admin', username: 'admin', password: '123', name: 'Sistem Yöneticisi', role: 'admin', permissions: ['all'] },
      { id: 'staff', username: 'staff', password: '123', name: 'Operasyon Sorumlusu', role: 'staff', permissions: ['view_participants', 'add_participants'] }
    ];
    
    // Assign Zeynep to the second event
    events[1].assignedManagerId = users[1].id;

    const companies = [
      { id: crypto.randomUUID(), name: 'Firma A', commercialTitle: 'A Medikal ve Sağlık Hizmetleri A.Ş.', taxOffice: 'Beşiktaş', taxNumber: '1234567890', address: 'Levent, İstanbul', contactName: 'Ahmet Yılmaz', contactPhone: '05321112233', createdAt: new Date().toISOString() },
      { id: crypto.randomUUID(), name: 'Firma B', commercialTitle: 'B İlaç Sanayi Ltd. Şti.', taxOffice: 'Kadıköy', taxNumber: '0987654321', address: 'Kozyatağı, İstanbul', contactName: 'Ayşe Kaya', contactPhone: '05332223344', createdAt: new Date().toISOString() }
    ];
    localStorage.setItem('ethiccon_companies', JSON.stringify(companies));
    
    // Budgets
    const budgets = [];
    localStorage.setItem('ethiccon_budgets', JSON.stringify(budgets));
    
    localStorage.setItem('ethiccon_events', JSON.stringify(events));
    localStorage.setItem('ethiccon_users', JSON.stringify(users));
    localStorage.setItem('ethiccon_current_user', users[0].id);
  },

  // Helper methods
  _getData(key) {
    return JSON.parse(localStorage.getItem(key) || '[]');
  },
  _saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },

  settings: {
    get() {
      const data = localStorage.getItem('ethiccon_settings');
      return data ? JSON.parse(data) : { agencyName: '', agencyAddress: '', agencyIban: '', agencyLogo: '' };
    },
    save(settings) {
      localStorage.setItem('ethiccon_settings', JSON.stringify(settings));
    }
  },

  events: {
    getAll() { return DB._getData('ethiccon_events'); },
    getById(id) { return this.getAll().find(e => e.id === id) || null; },
    create(data) {
      const events = this.getAll();
      const newEvent = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      events.push(newEvent);
      DB._saveData('ethiccon_events', events);
      return newEvent;
    },
    update(id, data) {
      const events = this.getAll();
      const index = events.findIndex(e => e.id === id);
      if (index !== -1) {
        events[index] = { ...events[index], ...data };
        DB._saveData('ethiccon_events', events);
        return events[index];
      }
      return null;
    },
    delete(id) {
      const events = this.getAll().filter(e => e.id !== id);
      DB._saveData('ethiccon_events', events);
      
      // Cascading delete
      const keepByEventId = item => item.eventId !== id;
      DB._saveData('ethiccon_participants', DB._getData('ethiccon_participants').filter(keepByEventId));
      DB._saveData('ethiccon_accommodations', DB._getData('ethiccon_accommodations').filter(keepByEventId));
      DB._saveData('ethiccon_flights', DB._getData('ethiccon_flights').filter(keepByEventId));
      DB._saveData('ethiccon_sponsors', DB._getData('ethiccon_sponsors').filter(keepByEventId));
      DB._saveData('ethiccon_budgetItems', DB._getData('ethiccon_budgetItems').filter(keepByEventId));
      DB._saveData('ethiccon_tasks', DB._getData('ethiccon_tasks').filter(keepByEventId));
      
      const proformas = DB._getData('ethiccon_proformas');
      const proformasToDelete = proformas.filter(p => p.eventId === id).map(p => p.id);
      DB._saveData('ethiccon_proformas', proformas.filter(keepByEventId));
      
      const proformaItems = DB._getData('ethiccon_proformaItems');
      DB._saveData('ethiccon_proformaItems', proformaItems.filter(item => !proformasToDelete.includes(item.proformaId)));
    }
  },

  participants: {
    getAll() { return DB._getData('ethiccon_participants'); },
    getByEventId(eventId) { return this.getAll().filter(p => p.eventId === eventId); },
    getById(id) { return this.getAll().find(p => p.id === id) || null; },
    create(data) {
      const items = this.getAll();
      const newItem = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      items.push(newItem);
      DB._saveData('ethiccon_participants', items);
      return newItem;
    },
    update(id, data) {
      const items = this.getAll();
      const index = items.findIndex(p => p.id === id);
      if (index !== -1) {
        items[index] = { ...items[index], ...data };
        DB._saveData('ethiccon_participants', items);
        return items[index];
      }
      return null;
    },
    delete(id) {
      DB._saveData('ethiccon_participants', this.getAll().filter(p => p.id !== id));
      // Optionally cascade delete flight entries for this participant
      const flights = DB._getData('ethiccon_flights').filter(f => f.participantId !== id);
      DB._saveData('ethiccon_flights', flights);
    }
  },

  accommodations: {
    getAll() { return DB._getData('ethiccon_accommodations'); },
    getByEventId(eventId) { return this.getAll().find(a => a.eventId === eventId) || null; },
    createOrUpdate(eventId, data) {
      const items = this.getAll();
      const index = items.findIndex(a => a.eventId === eventId);
      if (index !== -1) {
        items[index] = { ...items[index], ...data };
        DB._saveData('ethiccon_accommodations', items);
        return items[index];
      } else {
        const newItem = { eventId, ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
        items.push(newItem);
        DB._saveData('ethiccon_accommodations', items);
        return newItem;
      }
    }
  },

  flights: {
    getAll() { return DB._getData('ethiccon_flights'); },
    getByEventId(eventId) { return this.getAll().filter(f => f.eventId === eventId); },
    create(data) {
      const items = this.getAll();
      const newItem = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      items.push(newItem);
      DB._saveData('ethiccon_flights', items);
      return newItem;
    },
    update(id, data) {
      const items = this.getAll();
      const index = items.findIndex(f => f.id === id);
      if (index !== -1) {
        items[index] = { ...items[index], ...data };
        DB._saveData('ethiccon_flights', items);
        return items[index];
      }
      return null;
    },
    delete(id) {
      DB._saveData('ethiccon_flights', this.getAll().filter(f => f.id !== id));
    }
  },

  technicalRequests: {
    getAll() { return DB._getData('ethiccon_technicalRequests'); },
    getByEventId(eventId) { return this.getAll().filter(t => t.eventId === eventId); },
    create(data) {
      const items = this.getAll();
      const newItem = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      items.push(newItem);
      DB._saveData('ethiccon_technicalRequests', items);
      return newItem;
    },
    delete(id) {
      DB._saveData('ethiccon_technicalRequests', this.getAll().filter(t => t.id !== id));
    }
  },

  users: {
    getAll() {
      let users = DB._getData('ethiccon_users');
      if (users.length === 0) {
        // Initialize default users if none
        users = [
          { 
            id: 'admin', username: 'admin', password: '123', name: 'Sistem Yöneticisi', role: 'admin',
            permissions: ['all'] 
          },
          { 
            id: 'staff', username: 'staff', password: '123', name: 'Operasyon Sorumlusu', role: 'staff',
            permissions: ['view_participants', 'add_participants'] 
          }
        ];
        DB._saveData('ethiccon_users', users);
      }
      return users;
    },
    getCurrentUser() {
      const u = sessionStorage.getItem('auth_user');
      if (u) {
          const parsed = JSON.parse(u);
          const fullUser = this.getAll().find(user => user.id === parsed.id);
          return fullUser || parsed;
      }
      return null;
    },
    update(id, data) {
      const users = this.getAll();
      const index = users.findIndex(u => u.id === id);
      if (index !== -1) {
        users[index] = { ...users[index], ...data };
        DB._saveData('ethiccon_users', users);
        return users[index];
      }
      return null;
    }
  },

  companies: {
    getAll() { return DB._getData('ethiccon_companies'); },
    getById(id) { return this.getAll().find(c => c.id === id); },
    create(data) {
      const companies = this.getAll();
      const newCompany = {
        id: crypto.randomUUID(),
        ...data,
        createdAt: new Date().toISOString()
      };
      companies.push(newCompany);
      DB._saveData('ethiccon_companies', companies);
      return newCompany;
    },
    update(id, data) {
      const companies = this.getAll();
      const idx = companies.findIndex(c => c.id === id);
      if (idx !== -1) {
        companies[idx] = { ...companies[idx], ...data, updatedAt: new Date().toISOString() };
        DB._saveData('ethiccon_companies', companies);
        return companies[idx];
      }
      return null;
    },
    delete(id) {
      let companies = this.getAll();
      companies = companies.filter(c => c.id !== id);
      DB._saveData('ethiccon_companies', companies);
    }
  },

  budgets: {
    getAll() { return DB._getData('ethiccon_budgets'); },
    getByEventId(eventId) { return this.getAll().filter(b => b.eventId === eventId); },
    create(data) {
      const budgets = this.getAll();
      const newItem = { id: crypto.randomUUID(), ...data, createdAt: new Date().toISOString() };
      budgets.push(newItem);
      DB._saveData('ethiccon_budgets', budgets);
      return newItem;
    },
    delete(id) {
      let budgets = this.getAll();
      budgets = budgets.filter(b => b.id !== id);
      DB._saveData('ethiccon_budgets', budgets);
    }
  },

  sponsors: {
    getAll() { return DB._getData('ethiccon_sponsors'); },
    getByEventId(eventId) { return this.getAll().filter(s => s.eventId === eventId); },
    getById(id) { return this.getAll().find(s => s.id === id) || null; },
    create(data) {
      const items = this.getAll();
      const newItem = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      items.push(newItem);
      DB._saveData('ethiccon_sponsors', items);
      return newItem;
    },
    update(id, data) {
      const items = this.getAll();
      const index = items.findIndex(s => s.id === id);
      if (index !== -1) {
        items[index] = { ...items[index], ...data };
        DB._saveData('ethiccon_sponsors', items);
        return items[index];
      }
      return null;
    },
    delete(id) {
      DB._saveData('ethiccon_sponsors', this.getAll().filter(s => s.id !== id));
    }
  },

  budgetItems: {
    getAll() { return DB._getData('ethiccon_budgetItems'); },
    getByEventId(eventId) { return this.getAll().filter(b => b.eventId === eventId); },
    create(data) {
      const items = this.getAll();
      const newItem = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      items.push(newItem);
      DB._saveData('ethiccon_budgetItems', items);
      return newItem;
    },
    update(id, data) {
      const items = this.getAll();
      const index = items.findIndex(b => b.id === id);
      if (index !== -1) {
        items[index] = { ...items[index], ...data };
        DB._saveData('ethiccon_budgetItems', items);
        return items[index];
      }
      return null;
    },
    delete(id) {
      DB._saveData('ethiccon_budgetItems', this.getAll().filter(b => b.id !== id));
    }
  },

  proformas: {
    getAll() { return DB._getData('ethiccon_proformas'); },
    getByEventId(eventId) { return this.getAll().filter(p => p.eventId === eventId); },
    getById(id) { return this.getAll().find(p => p.id === id) || null; },
    create(data) {
      const items = this.getAll();
      const newItem = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      items.push(newItem);
      DB._saveData('ethiccon_proformas', items);
      return newItem;
    },
    update(id, data) {
      const items = this.getAll();
      const index = items.findIndex(p => p.id === id);
      if (index !== -1) {
        items[index] = { ...items[index], ...data };
        DB._saveData('ethiccon_proformas', items);
        return items[index];
      }
      return null;
    },
    delete(id) {
      DB._saveData('ethiccon_proformas', this.getAll().filter(p => p.id !== id));
      DB.proformaItems.deleteByProformaId(id);
    }
  },

  proformaItems: {
    getByProformaId(proformaId) { 
      return DB._getData('ethiccon_proformaItems').filter(i => i.proformaId === proformaId); 
    },
    create(data) {
      const items = DB._getData('ethiccon_proformaItems');
      const newItem = { ...data, id: crypto.randomUUID() };
      items.push(newItem);
      DB._saveData('ethiccon_proformaItems', items);
      return newItem;
    },
    update(id, data) {
      const items = DB._getData('ethiccon_proformaItems');
      const index = items.findIndex(i => i.id === id);
      if (index !== -1) {
        items[index] = { ...items[index], ...data };
        DB._saveData('ethiccon_proformaItems', items);
        return items[index];
      }
      return null;
    },
    delete(id) {
      const items = DB._getData('ethiccon_proformaItems').filter(i => i.id !== id);
      DB._saveData('ethiccon_proformaItems', items);
    },
    deleteByProformaId(proformaId) {
      const items = DB._getData('ethiccon_proformaItems').filter(i => i.proformaId !== proformaId);
      DB._saveData('ethiccon_proformaItems', items);
    }
  },

  tasks: {
    getAll() { return DB._getData('ethiccon_tasks'); },
    getByEventId(eventId) { return this.getAll().filter(t => t.eventId === eventId); },
    getById(id) { return this.getAll().find(t => t.id === id) || null; },
    create(data) {
      const items = this.getAll();
      const newItem = { ...data, id: crypto.randomUUID(), status: data.status || 'pending', createdAt: new Date().toISOString() };
      items.push(newItem);
      DB._saveData('ethiccon_tasks', items);
      return newItem;
    },
    update(id, data) {
      const items = this.getAll();
      const index = items.findIndex(t => t.id === id);
      if (index !== -1) {
        items[index] = { ...items[index], ...data };
        DB._saveData('ethiccon_tasks', items);
        return items[index];
      }
      return null;
    },
    delete(id) {
      DB._saveData('ethiccon_tasks', this.getAll().filter(t => t.id !== id));
    }
  },

    logs: {
    getAll() { return DB._getData('ethiccon_logs'); },
    add(message, type = 'info') {
      const logs = this.getAll();
      const currentUser = DB.users.getCurrentUser();
      logs.unshift({
        id: crypto.randomUUID(),
        message,
        type,
        user: currentUser ? currentUser.name : 'Sistem',
        timestamp: new Date().toISOString()
      });
      // Keep only last 50 logs
      if (logs.length > 50) logs.pop();
      DB._saveData('ethiccon_logs', logs);
    }
  },

  transfers: {
    getAll() { return DB._getData('ethiccon_transfers'); },
    getByEventId(eventId) { return this.getAll().filter(t => t.eventId === eventId); },
    getById(id) { return this.getAll().find(t => t.id === id) || null; },
    create(data) {
      const items = this.getAll();
      const newItem = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      items.push(newItem);
      DB._saveData('ethiccon_transfers', items);
      return newItem;
    },
    update(id, data) {
      const items = this.getAll();
      const index = items.findIndex(t => t.id === id);
      if (index !== -1) {
        items[index] = { ...items[index], ...data };
        DB._saveData('ethiccon_transfers', items);
        return items[index];
      }
      return null;
    },
    delete(id) {
      DB._saveData('ethiccon_transfers', this.getAll().filter(t => t.id !== id));
    }
  },

  hotels: {
    getAll() { return DB._getData('ethiccon_hotels'); },
    getByEventId(eventId) { return this.getAll().filter(h => h.eventId === eventId); },
    getById(id) { return this.getAll().find(h => h.id === id) || null; },
    create(data) {
      const items = this.getAll();
      const newItem = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      items.push(newItem);
      DB._saveData('ethiccon_hotels', items);
      return newItem;
    },
    update(id, data) {
      const items = this.getAll();
      const index = items.findIndex(h => h.id === id);
      if (index !== -1) {
        items[index] = { ...items[index], ...data };
        DB._saveData('ethiccon_hotels', items);
        return items[index];
      }
      return null;
    },
    delete(id) {
      DB._saveData('ethiccon_hotels', this.getAll().filter(h => h.id !== id));
    }
  }
};
