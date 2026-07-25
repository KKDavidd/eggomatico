const CATEGORY_LABELS = {
  redonyok: 'Redőnyök',
  mesh: 'Szúnyoghálók',
  napellenzo: 'Napellenzők / Külső árnyékolók',
  belso: 'Belső árnyékolók',
  pergola: 'Pergola'
};

let unsubLeads = null;
let unsubGallery = null;
let allLeads = [];
let allGallery = [];
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
    allLeads = []; allGallery = [];
  }
});

const TAB_TITLES = { dashboard: 'Áttekintés', leads: 'Ajánlatkérések', gallery: 'Galéria' };
$all('.nav-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    $all('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    ['dashboard', 'leads', 'gallery'].forEach(function (t) {
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
