const CATEGORY_LABELS = {
  redonyok: 'Redőnyök',
  mesh: 'Szúnyoghálók',
  napellenzo: 'Napellenzők / Külső árnyékolók',
  belso: 'Belső árnyékolók',
  pergola: 'Pergola'
};

let unsubLeads = null;
let unsubGallery = null;
let unsubUsers = null;
let allLeads = [];
let allGallery = [];
let allUsers = [];
let leadFilter = 'all';
let galleryFilter = 'all';

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }) +
    ' ' + d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
}

$('#loginForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const email = $('#li-email').value.trim();
  const pass = $('#li-pass').value;
  const btn = $('#loginBtn');
  const err = $('#loginError');
  err.classList.remove('show');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span>Bejelentkezés…';
  auth.signInWithEmailAndPassword(email, pass)
    .catch(function (error) {
      err.textContent = 'Hibás e-mail cím vagy jelszó.';
      err.classList.add('show');
    })
    .finally(function () {
      btn.disabled = false;
      btn.textContent = 'Bejelentkezés';
    });
});

$('#logoutBtn').addEventListener('click', function () {
  auth.signOut();
});

auth.onAuthStateChanged(function (user) {
  if (user) {
    $('#loginScreen').style.display = 'none';
    $('#adminShell').classList.add('show');
    $('#whoBox').textContent = user.email;
    startListeners();
  } else {
    $('#adminShell').classList.remove('show');
    $('#loginScreen').style.display = 'flex';
    if (unsubLeads) { unsubLeads(); unsubLeads = null; }
    if (unsubGallery) { unsubGallery(); unsubGallery = null; }
    if (unsubUsers) { unsubUsers(); unsubUsers = null; }
    allLeads = []; allGallery = []; allUsers = [];
  }
});

const TAB_TITLES = { dashboard: 'Áttekintés', leads: 'Ajánlatkérések', gallery: 'Galéria', users: 'Felhasználók', payroll: 'Bérezés' };
$all('.nav-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    $all('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    ['dashboard', 'leads', 'gallery', 'users', 'payroll'].forEach(function (t) {
      $('#tab-' + t).style.display = (t === tab) ? '' : 'none';
    });
    $('#topbarTitle').textContent = TAB_TITLES[tab];
    $('#adminSide').classList.remove('open');
  });
});
$('#burgerBtn').addEventListener('click', function () {
  $('#adminSide').classList.toggle('open');
});

function startListeners() {
  if (unsubLeads) unsubLeads();
  if (unsubGallery) unsubGallery();
  if (unsubUsers) unsubUsers();

  unsubUsers = db.collection('employees').orderBy('name', 'asc')
    .onSnapshot(function (snap) {
      allUsers = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
      renderUsers();
    }, function (error) {
      console.error(error);
      $('#usersList').innerHTML = '<div class="empty-state">Hiba az adatok betöltésekor.</div>';
    });

  unsubLeads = db.collection('leads').orderBy('createdAt', 'desc')
    .onSnapshot(function (snap) {
      allLeads = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
      renderDashboard();
      renderLeads();
    }, function (error) {
      console.error(error);
      $('#leadsList').innerHTML = '<div class="empty-state">Hiba az adatok betöltésekor.</div>';
    });

  unsubGallery = db.collection('gallery').orderBy('order', 'asc')
    .onSnapshot(function (snap) {
      allGallery = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
      renderDashboard();
      renderGallery();
    }, function (error) {
      console.error(error);
      $('#galleryGrid').innerHTML = '<div class="empty-state">Hiba az adatok betöltésekor.</div>';
    });
}

function renderDashboard() {
  const newCount = allLeads.filter(l => l.status !== 'done').length;
  $('#statTotalLeads').textContent = allLeads.length;
  $('#statNewLeads').textContent = newCount;
  $('#statGallery').textContent = allGallery.length;

  const pill = $('#newLeadPill');
  if (newCount > 0) { pill.style.display = ''; pill.textContent = newCount; }
  else { pill.style.display = 'none'; }

  const recent = allLeads.slice(0, 5);
  const box = $('#recentLeadsList');
  if (!recent.length) {
    box.innerHTML = '<div class="empty-state">Még nincs beérkezett ajánlatkérés.</div>';
    return;
  }
  box.innerHTML = recent.map(leadRowHtml).join('');
  bindLeadRowEvents(box);
}

$all('#tab-leads .filter-chips button').forEach(function (btn) {
  btn.addEventListener('click', function () {
    $all('#tab-leads .filter-chips button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    leadFilter = btn.dataset.status;
    renderLeads();
  });
});

function leadRowHtml(l) {
  const status = l.status === 'done' ? 'done' : 'new';
  const preview = (l.message || '').slice(0, 90);
  return '' +
    '<div class="lead-row ' + (status === 'new' ? 'is-new' : '') + '" data-id="' + l.id + '">' +
      '<div class="lr-main">' +
        '<div class="lr-top">' +
          '<span class="lr-name">' + escapeHtml(l.name || 'Névtelen') + '</span>' +
          '<span class="status-badge ' + status + '">' + (status === 'done' ? 'Elintézve' : 'Új') + '</span>' +
          '<span class="lr-date">' + formatDate(l.createdAt) + '</span>' +
        '</div>' +
        '<div class="lr-contact">' +
          (l.email ? '<a href="mailto:' + escapeHtml(l.email) + '">' + escapeHtml(l.email) + '</a>' : '') +
          (l.phone ? '  ·  <a href="tel:' + escapeHtml(l.phone) + '">' + escapeHtml(l.phone) + '</a>' : '') +
          (l.source ? '  ·  <span style="color:var(--line);">' + escapeHtml(l.source) + '</span>' : '') +
        '</div>' +
        '<div class="lr-preview">' + escapeHtml(preview) + (l.message && l.message.length > 90 ? '…' : '') + '</div>' +
        '<div class="lr-msg">' + escapeHtml(l.message || '') + '</div>' +
        '<div class="lr-actions">' +
          '<button class="a-btn ghost toggle-status-btn" data-id="' + l.id + '" data-status="' + status + '">' +
            (status === 'done' ? 'Megjelölés újként' : 'Megjelölés elintézettként') +
          '</button>' +
          '<button class="a-btn danger delete-lead-btn" data-id="' + l.id + '">Törlés</button>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function renderLeads() {
  let list = allLeads;
  if (leadFilter === 'new') list = list.filter(l => l.status !== 'done');
  if (leadFilter === 'done') list = list.filter(l => l.status === 'done');

  const box = $('#leadsList');
  if (!list.length) {
    box.innerHTML = '<div class="empty-state">Nincs a szűrésnek megfelelő ajánlatkérés.</div>';
    return;
  }
  box.innerHTML = list.map(leadRowHtml).join('');
  bindLeadRowEvents(box);
}

function bindLeadRowEvents(scope) {
  scope.querySelectorAll('.lead-row').forEach(function (row) {
    row.addEventListener('click', function (e) {
      if (e.target.closest('button') || e.target.closest('a')) return;
      row.classList.toggle('open');
    });
  });
  scope.querySelectorAll('.toggle-status-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const id = btn.dataset.id;
      const newStatus = btn.dataset.status === 'done' ? 'new' : 'done';
      db.collection('leads').doc(id).update({ status: newStatus })
        .then(() => showToast(newStatus === 'done' ? 'Megjelölve elintézettként.' : 'Megjelölve újként.'))
        .catch(() => showToast('Hiba történt a mentés közben.'));
    });
  });
  scope.querySelectorAll('.delete-lead-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!confirm('Biztosan törli ezt az ajánlatkérést? A művelet nem vonható vissza.')) return;
      db.collection('leads').doc(btn.dataset.id).delete()
        .then(() => showToast('Ajánlatkérés törölve.'))
        .catch(() => showToast('Hiba történt a törlés közben.'));
    });
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function buildGalleryFilterChips() {
  const wrap = $('#galleryFilterChips');
  const cats = Object.keys(CATEGORY_LABELS);
  wrap.innerHTML = '<button class="' + (galleryFilter === 'all' ? 'active' : '') + '" data-cat="all">Összes</button>' +
    cats.map(c => '<button class="' + (galleryFilter === c ? 'active' : '') + '" data-cat="' + c + '">' + CATEGORY_LABELS[c] + '</button>').join('');
  wrap.querySelectorAll('button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      galleryFilter = btn.dataset.cat;
      buildGalleryFilterChips();
      renderGallery();
    });
  });
}
buildGalleryFilterChips();

function renderGallery() {
  let list = allGallery;
  if (galleryFilter !== 'all') list = list.filter(g => g.category === galleryFilter);

  const grid = $('#galleryGrid');
  if (!list.length) {
    grid.innerHTML = '<div class="empty-state">Nincs még ilyen kategóriájú kép.</div>';
    return;
  }
  grid.innerHTML = list.map(function (g) {
    return '' +
      '<div class="g-admin-item" data-id="' + g.id + '">' +
        '<div class="thumb" style="background-image:url(\'' + escapeHtml(g.imageUrl || '') + '\')">' +
          '<span class="cat-tag">' + (CATEGORY_LABELS[g.category] || g.category) + '</span>' +
        '</div>' +
        '<div class="body">' +
          '<div class="cap">' + escapeHtml(g.caption || '') + '</div>' +
          '<div class="row-actions">' +
            '<button class="a-btn outline edit-gallery-btn" data-id="' + g.id + '" style="flex:1;">Szerkesztés</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }).join('');

  grid.querySelectorAll('.edit-gallery-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openGalleryModal(allGallery.find(g => g.id === btn.dataset.id));
    });
  });
}

const galleryModal = $('#galleryModal');
const galleryForm = $('#galleryForm');

$('#addGalleryBtn').addEventListener('click', function () { openGalleryModal(null); });
$('#galleryModalClose').addEventListener('click', closeGalleryModal);
galleryModal.addEventListener('click', function (e) { if (e.target === galleryModal) closeGalleryModal(); });

function openGalleryModal(item) {
  galleryForm.reset();
  $('#galleryFormMsg').className = 'form-msg';
  $('#g-preview').classList.remove('show');

  if (item) {
    $('#galleryModalTitle').textContent = 'Kép szerkesztése';
    $('#g-id').value = item.id;
    $('#g-category').value = item.category || 'redonyok';
    $('#g-caption').value = item.caption || '';
    $('#g-order').value = (item.order !== undefined && item.order !== null) ? item.order : '';
    $('#g-url').value = item.imageUrl || '';
    if (item.imageUrl) {
      $('#g-preview').src = item.imageUrl;
      $('#g-preview').classList.add('show');
    }
    $('#galleryDeleteBtn').style.display = '';
  } else {
    $('#galleryModalTitle').textContent = 'Új kép hozzáadása';
    $('#g-id').value = '';
    $('#galleryDeleteBtn').style.display = 'none';
  }
  galleryModal.classList.add('show');
}

function closeGalleryModal() {
  galleryModal.classList.remove('show');
}

$('#g-url').addEventListener('input', function () {
  if (this.value) {
    $('#g-preview').src = this.value;
    $('#g-preview').classList.add('show');
  } else {
    $('#g-preview').classList.remove('show');
  }
});

galleryForm.addEventListener('submit', function (e) {
  e.preventDefault();
  const id = $('#g-id').value;
  const category = $('#g-category').value;
  const caption = $('#g-caption').value.trim();
  const orderVal = $('#g-order').value;
  const imageUrl = $('#g-url').value.trim();
  const msg = $('#galleryFormMsg');
  msg.className = 'form-msg';
  const saveBtn = $('#gallerySaveBtn');

  if (!caption) {
    msg.textContent = 'Adjon meg egy feliratot / leírást.';
    msg.classList.add('err');
    return;
  }
  if (!imageUrl) {
    msg.textContent = 'Adjon meg egy kép URL-t.';
    msg.classList.add('err');
    return;
  }

  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="loader dark"></span>Mentés…';

  const data = {
    category: category,
    caption: caption,
    imageUrl: imageUrl,
    order: orderVal !== '' ? Number(orderVal) : Date.now(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  const promise = id
    ? db.collection('gallery').doc(id).update(data)
    : db.collection('gallery').add(Object.assign({ createdAt: firebase.firestore.FieldValue.serverTimestamp() }, data));

  promise.then(function () {
    showToast(id ? 'Kép frissítve.' : 'Kép hozzáadva a galériához.');
    closeGalleryModal();
  }).catch(function (err) {
    console.error(err);
    msg.textContent = 'Hiba történt a mentés közben.';
    msg.classList.add('err');
  }).finally(function () {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Mentés';
  });
});

$('#galleryDeleteBtn').addEventListener('click', function () {
  const id = $('#g-id').value;
  if (!id) return;
  if (!confirm('Biztosan törli ezt a képet a galériából?')) return;
  db.collection('gallery').doc(id).delete()
    .then(function () {
      showToast('Kép törölve.');
      closeGalleryModal();
    })
    .catch(function () {
      showToast('Hiba történt a törlés közben.');
    });
});

/* ---------------- Felhasználók (jelenléti rendszer jogosultságai) ---------------- */

$('#addUserForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const uid = $('#au-uid').value.trim();
  const name = $('#au-name').value.trim();
  const role = $('#au-role').value;
  const payType = $('#au-paytype').value;
  const rate = Number($('#au-rate').value) || 0;
  const msg = $('#auMsg');
  msg.className = 'form-msg';
  if (!uid || !name) return;

  db.collection('employees').doc(uid).set({
    name: name,
    role: role,
    active: true,
    currentlyIn: false,
    lastChangeAt: null,
    lastTag: null,
    payType: payType,
    rate: rate,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).then(function () {
    msg.textContent = 'Felhasználó mentve.';
    msg.classList.add('ok');
    $('#addUserForm').reset();
  }).catch(function (err) {
    console.error(err);
    msg.textContent = 'Hiba történt a mentéskor.';
    msg.classList.add('err');
  });
});

function formatForint(n) {
  return (Number(n) || 0).toLocaleString('hu-HU') + ' Ft';
}

function payLabel(u) {
  if (u.payType === 'havidij') return 'Havi fix: ' + formatForint(u.rate) + '/hó';
  return 'Órabér: ' + formatForint(u.rate) + '/óra';
}

function renderUsers() {
  const box = $('#usersList');
  if (!allUsers.length) {
    box.innerHTML = '<div class="empty-state">Még nincs felvett felhasználó.</div>';
    return;
  }
  box.innerHTML = allUsers.map(function (u) {
    const inNow = !!u.currentlyIn;
    return '<div class="lead-row" style="cursor:default;">' +
      '<div class="lr-main">' +
        '<div class="lr-top">' +
          '<span class="lr-name">' + escapeHtml(u.name || 'Névtelen') + '</span>' +
          '<span class="role-pill' + (u.role === 'admin' ? ' admin' : '') + '">' + (u.role === 'admin' ? 'Admin' : 'Dolgozó') + '</span>' +
          (u.active === false ? '<span class="status-badge new">Inaktív</span>' : '') +
          '<span class="lr-date">' + escapeHtml(u.id) + '</span>' +
        '</div>' +
        '<div class="lr-contact">' +
          '<span class="user-status ' + (inNow ? 'in' : 'out') + '">' + (inNow ? '● Jelenleg bent' : '○ Nincs bent') + '</span>' +
          (u.lastChangeAt ? '  ·  utolsó változás: ' + formatDate(u.lastChangeAt) : '') +
          '  ·  ' + escapeHtml(payLabel(u)) +
        '</div>' +
        '<div class="lr-actions">' +
          '<button class="a-btn outline" data-act="editPay" data-id="' + u.id + '">Bérezés szerkesztése</button>' +
          '<button class="a-btn outline" data-act="toggleRole" data-id="' + u.id + '">Szerepkör váltása</button>' +
          '<button class="a-btn ghost" data-act="toggleActive" data-id="' + u.id + '">' + (u.active === false ? 'Aktiválás' : 'Deaktiválás') + '</button>' +
          '<button class="a-btn danger" data-act="remove" data-id="' + u.id + '">Törlés</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  box.querySelectorAll('button[data-act]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      const u = allUsers.find(x => x.id === id);
      if (!u) return;
      if (act === 'toggleRole') {
        db.collection('employees').doc(id).update({ role: u.role === 'admin' ? 'dolgozo' : 'admin' });
      } else if (act === 'toggleActive') {
        db.collection('employees').doc(id).update({ active: u.active === false });
      } else if (act === 'remove') {
        if (confirm('Biztosan törlöd ' + (u.name || 'ezt a felhasználót') + '? (a korábbi jelenléti naplóbejegyzései megmaradnak)')) {
          db.collection('employees').doc(id).delete();
        }
      } else if (act === 'editPay') {
        openPayEditModal(u);
      }
    });
  });
}

/* ---------------- Bérezés szerkesztése (modal) ---------------- */

const payEditModal = $('#payEditModal');
function openPayEditModal(u) {
  $('#pe-id').value = u.id;
  $('#pe-name-label').textContent = u.name || 'Névtelen';
  $('#pe-paytype').value = u.payType === 'havidij' ? 'havidij' : 'orabér';
  $('#pe-rate').value = u.rate || 0;
  $('#payEditMsg').className = 'form-msg';
  payEditModal.classList.add('show');
}
function closePayEditModal() { payEditModal.classList.remove('show'); }
$('#payEditModalClose').addEventListener('click', closePayEditModal);
payEditModal.addEventListener('click', function (e) { if (e.target === payEditModal) closePayEditModal(); });

$('#payEditForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const id = $('#pe-id').value;
  const payType = $('#pe-paytype').value;
  const rate = Number($('#pe-rate').value) || 0;
  const msg = $('#payEditMsg');
  db.collection('employees').doc(id).update({ payType: payType, rate: rate })
    .then(function () {
      showToast('Bérezés frissítve.');
      closePayEditModal();
    })
    .catch(function (err) {
      console.error(err);
      msg.textContent = 'Hiba történt a mentéskor.';
      msg.className = 'form-msg err';
    });
});

/* ---------------- Havi bérszámítás ---------------- */

(function initPayrollMonth() {
  const now = new Date();
  const val = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const input = $('#payrollMonth');
  if (input) input.value = val;
})();

function overlapMs(aStart, aEnd, bStart, bEnd) {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, end - start);
}

function computeWorkedMs(events, rangeStart, rangeEnd) {
  let totalMs = 0;
  let openStart = null;
  let hadOrphanKi = false;
  let longSessionWarning = false;
  events.forEach(function (ev) {
    if (ev.type === 'be') {
      openStart = ev.at;
    } else if (ev.type === 'ki') {
      if (openStart) {
        const dur = ev.at.getTime() - openStart.getTime();
        if (dur > 16 * 3600 * 1000) longSessionWarning = true;
        totalMs += overlapMs(openStart, ev.at, rangeStart, rangeEnd);
        openStart = null;
      } else {
        hadOrphanKi = true;
      }
    }
  });
  let ongoing = false;
  if (openStart) {
    const now = new Date();
    totalMs += overlapMs(openStart, now, rangeStart, rangeEnd);
    ongoing = true;
  }
  return { ms: totalMs, ongoing: ongoing, warning: hadOrphanKi || longSessionWarning };
}

function formatHoursMin(ms) {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h + ' óra ' + String(m).padStart(2, '0') + ' perc';
}

let lastPayrollRows = [];

$('#payrollCalcBtn').addEventListener('click', function () {
  const monthVal = $('#payrollMonth').value;
  if (!monthVal) { showToast('Válassz hónapot.'); return; }
  const [y, m] = monthVal.split('-').map(Number);
  const rangeStart = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const rangeEnd = new Date(y, m, 1, 0, 0, 0, 0);

  const status = $('#payrollStatus');
  const body = $('#payrollBody');
  const activeUsers = allUsers.filter(u => u.active !== false);
  if (!activeUsers.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty-state">Nincs felvett felhasználó.</td></tr>';
    return;
  }
  status.textContent = 'Számítás folyamatban…';
  body.innerHTML = '<tr><td colspan="6" class="empty-state"><span class="loader dark"></span>Betöltés…</td></tr>';

  Promise.all(activeUsers.map(function (u) {
    return db.collection('attendance').where('uid', '==', u.id).orderBy('at', 'asc').get()
      .then(function (snap) {
        const events = snap.docs
          .map(d => d.data())
          .filter(d => d.at) // csak lezárt (szerver-időbélyeggel rendelkező) események
          .map(d => ({ type: d.type, at: d.at.toDate() }));
        const result = computeWorkedMs(events, rangeStart, rangeEnd);
        return Object.assign({ user: u }, result);
      })
      .catch(function (err) {
        console.error(err);
        return { user: u, ms: 0, ongoing: false, warning: true, error: true };
      });
  })).then(function (rows) {
    lastPayrollRows = rows;
    renderPayroll(rows);
    status.textContent = 'Kész — ' + monthVal;
  });
});

function renderPayroll(rows) {
  const body = $('#payrollBody');
  let total = 0;
  body.innerHTML = rows.map(function (r) {
    const u = r.user;
    const hours = r.ms / 3600000;
    let pay;
    if (u.payType === 'havidij') {
      pay = Number(u.rate) || 0;
    } else {
      pay = Math.round(hours * (Number(u.rate) || 0));
    }
    total += pay;
    const warnIcon = r.warning
      ? '<span class="pay-warn" title="Páratlan be-/kilépés vagy szokatlanul hosszú műszak található a naplóban — érdemes ellenőrizni.">⚠</span>'
      : '';
    const ongoingNote = r.ongoing ? ' <span style="color:var(--steel);font-size:.75rem;">(most is bent van, a mai napig)</span>' : '';
    return '<tr>' +
      '<td>' + escapeHtml(u.name || '–') + '</td>' +
      '<td>' + (u.payType === 'havidij' ? 'Havi fix' : 'Órabér') + '</td>' +
      '<td>' + formatForint(u.rate) + (u.payType === 'havidij' ? '/hó' : '/óra') + '</td>' +
      '<td>' + formatHoursMin(r.ms) + ongoingNote + '</td>' +
      '<td><b>' + formatForint(pay) + '</b></td>' +
      '<td>' + warnIcon + '</td>' +
      '</tr>';
  }).join('');
  $('#payrollTotal').textContent = 'Összesen: ' + formatForint(total);
}

$('#payrollExportBtn').addEventListener('click', function () {
  if (!lastPayrollRows.length) { showToast('Előbb futtasd le a számítást.'); return; }
  const header = 'Nev;Berezes tipusa;Dij;Ledolgozott ora;Szamitott fizetes\n';
  const csvBody = lastPayrollRows.map(function (r) {
    const u = r.user;
    const hours = (r.ms / 3600000).toFixed(2);
    const pay = u.payType === 'havidij' ? (Number(u.rate) || 0) : Math.round((r.ms / 3600000) * (Number(u.rate) || 0));
    return [u.name || '', u.payType === 'havidij' ? 'Havi fix' : 'Oraber', u.rate || 0, hours, pay].join(';');
  }).join('\n');
  const blob = new Blob(['\uFEFF' + header + csvBody], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'berezes-' + ($('#payrollMonth').value || 'ismeretlen') + '.csv';
  a.click();
});
