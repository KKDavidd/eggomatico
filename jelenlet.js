/* Jelenléti rendszer — be-/kilépés kezelése NFC matricával vagy kézzel, szerepkör alapú jogosultsággal.
   Adatmodell (Firestore):
     employees/{uid}   { name, role: 'admin'|'dolgozo', active, currentlyIn, lastChangeAt, lastTag, createdAt }
     attendance/{auto} { uid, name, type: 'be'|'ki', at, method: 'nfc'|'kezi', tag }
*/

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

let myProfile = null;       // { id, name, role, active, currentlyIn, lastChangeAt, ... }
let myUid = null;
let isAdminUser = false;
let unsubOwnHist = null;
let unsubTeam = null;
let unsubEmployees = null;
let unsubLog = null;
let allEmployees = [];
let allLogRows = [];
let pendingConfirmShown = false;

function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('show'), 2800);
}

function formatDateTime(ts) {
  if (!ts) return '–';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }) +
    ' ' + d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
}

/* ---------------- Bejelentkezés / kijelentkezés ---------------- */

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
    .catch(function () {
      err.textContent = 'Hibás e-mail cím vagy jelszó.';
      err.classList.add('show');
    })
    .finally(function () {
      btn.disabled = false;
      btn.textContent = 'Bejelentkezés';
    });
});

function doLogout() {
  auth.signOut();
}
$('#logoutBtn').addEventListener('click', doLogout);
$('#pendingLogoutBtn').addEventListener('click', doLogout);

auth.onAuthStateChanged(function (user) {
  cleanupListeners();
  if (user) {
    myUid = user.uid;
    $('#loginScreen').style.display = 'none';
    db.collection('employees').doc(user.uid).get().then(function (doc) {
      if (doc.exists) {
        myProfile = Object.assign({ id: doc.id }, doc.data());
        isAdminUser = myProfile.role === 'admin';
        $('#pendingScreen').style.display = 'none';
        $('#adminShell').classList.add('show');
        $('#whoBox').textContent = myProfile.name + (isAdminUser ? ' · admin' : '');
        $all('.admin-only').forEach(el => el.style.display = isAdminUser ? '' : 'none');
        startOwnListener();
        if (isAdminUser) { startTeamListener(); startEmployeesListener(); startLogListener(); }
        maybeProcessPendingTag();
      } else {
        myProfile = null;
        $('#adminShell').classList.remove('show');
        $('#pendingScreen').style.display = 'flex';
        $('#pendingUid').textContent = user.uid;
        try { sessionStorage.setItem('pendingTag', getTagFromUrl() || ''); } catch (e) {}
      }
    }).catch(function (e) {
      console.error(e);
      showToast('Hiba történt a profil betöltésekor.');
    });
  } else {
    myUid = null; myProfile = null; isAdminUser = false;
    $('#adminShell').classList.remove('show');
    $('#pendingScreen').style.display = 'none';
    $('#loginScreen').style.display = 'flex';
  }
});

function cleanupListeners() {
  if (unsubOwnHist) { unsubOwnHist(); unsubOwnHist = null; }
  if (unsubTeam) { unsubTeam(); unsubTeam = null; }
  if (unsubEmployees) { unsubEmployees(); unsubEmployees = null; }
  if (unsubLog) { unsubLog(); unsubLog = null; }
}

/* ---------------- Fülek / navigáció ---------------- */

const TAB_TITLES = { own: 'Jelenlétem', team: 'Csapat', employees: 'Alkalmazottak', log: 'Teljes napló' };
$all('.nav-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    $all('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    ['own', 'team', 'employees', 'log'].forEach(function (t) {
      $('#tab-' + t).style.display = (t === tab) ? '' : 'none';
    });
    $('#topbarTitle').textContent = TAB_TITLES[tab];
    $('#adminSide').classList.remove('open');
  });
});
$('#burgerBtn').addEventListener('click', function () {
  $('#adminSide').classList.toggle('open');
});

/* ---------------- Saját jelenlét ---------------- */

function renderStatusHero() {
  if (!myProfile) return;
  const hero = $('#statusHero');
  const inNow = !!myProfile.currentlyIn;
  hero.classList.toggle('is-in', inNow);
  hero.classList.toggle('is-out', !inNow);
  $('#shState').textContent = inNow ? 'BENT VAGY' : 'KINT VAGY';
  $('#shMeta').innerHTML = myProfile.lastChangeAt
    ? 'Utolsó változás: <b>' + formatDateTime(myProfile.lastChangeAt) + '</b>' + (myProfile.lastTag ? ' · ' + myProfile.lastTag : '')
    : 'Még nincs rögzített esemény.';
  $('#bigToggleBtn').textContent = inNow ? 'Kilépés rögzítése' : 'Belépés rögzítése';
}

$('#bigToggleBtn').addEventListener('click', function () {
  recordEvent('kezi', null);
});

function startOwnListener() {
  if (unsubOwnHist) unsubOwnHist();
  // Élő figyelés a saját profilra (állapot) + saját eseménynaplóra
  db.collection('employees').doc(myUid).onSnapshot(function (doc) {
    if (doc.exists) {
      myProfile = Object.assign({ id: doc.id }, doc.data());
      isAdminUser = myProfile.role === 'admin';
      renderStatusHero();
    }
  });
  unsubOwnHist = db.collection('attendance')
    .where('uid', '==', myUid)
    .orderBy('at', 'desc')
    .limit(25)
    .onSnapshot(function (snap) {
      const rows = snap.docs.map(d => d.data());
      renderOwnHistory(rows);
    }, function (err) {
      console.error(err);
      $('#ownHistBody').innerHTML = '<tr><td colspan="4" class="empty-state">Hiba a napló betöltésekor.</td></tr>';
    });
}

function renderOwnHistory(rows) {
  const body = $('#ownHistBody');
  if (!rows.length) { body.innerHTML = '<tr><td colspan="4" class="empty-state">Még nincs rögzített esemény.</td></tr>'; return; }
  body.innerHTML = rows.map(function (r) {
    return '<tr>' +
      '<td class="type-' + r.type + '">' + (r.type === 'be' ? 'Belépés' : 'Kilépés') + '</td>' +
      '<td>' + formatDateTime(r.at) + '</td>' +
      '<td>' + (r.method === 'nfc' ? 'NFC' : 'Kézi') + '</td>' +
      '<td>' + (r.tag ? '<span class="hist-tag">' + escapeHtml(r.tag) + '</span>' : '–') + '</td>' +
      '</tr>';
  }).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------------- Esemény rögzítése (be/ki váltás) ---------------- */

let recording = false;
function recordEvent(method, tag) {
  if (!myProfile || !myUid || recording) return;
  recording = true;
  $('#bigToggleBtn').disabled = true;

  const nextIn = !myProfile.currentlyIn;
  const type = nextIn ? 'be' : 'ki';
  const now = firebase.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();

  const attRef = db.collection('attendance').doc();
  batch.set(attRef, {
    uid: myUid,
    name: myProfile.name,
    type: type,
    method: method,
    tag: tag || null,
    at: now
  });

  const empRef = db.collection('employees').doc(myUid);
  batch.update(empRef, {
    currentlyIn: nextIn,
    lastChangeAt: now,
    lastTag: tag || (method === 'kezi' ? 'kézi rögzítés' : null)
  });

  batch.commit().then(function () {
    showToast(type === 'be' ? 'Belépés rögzítve.' : 'Kilépés rögzítve.');
    if (tag) showNfcConfirmation(type, tag);
  }).catch(function (e) {
    console.error(e);
    showToast('Nem sikerült rögzíteni. Próbáld újra.');
  }).finally(function () {
    recording = false;
    $('#bigToggleBtn').disabled = false;
  });
}

/* ---------------- NFC — 1) matricára írt URL automatikus feldolgozása ---------------- */

function getTagFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('tag');
}

function cleanUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('tag');
  window.history.replaceState({}, '', url.pathname + (url.search || ''));
}

function maybeProcessPendingTag() {
  let tag = getTagFromUrl();
  if (!tag) {
    try {
      const stored = sessionStorage.getItem('pendingTag');
      if (stored) { tag = stored; sessionStorage.removeItem('pendingTag'); }
    } catch (e) {}
  }
  if (tag && myProfile && !pendingConfirmShown) {
    pendingConfirmShown = true;
    recordEvent('nfc', tag);
    cleanUrl();
  }
}

function showNfcConfirmation(type, tag) {
  const overlay = $('#confirmOverlay');
  overlay.classList.remove('co-in', 'co-out');
  overlay.classList.add(type === 'be' ? 'co-in' : 'co-out');
  $('#coIcon').textContent = type === 'be' ? '✓' : '⏻';
  $('#coTitle').textContent = type === 'be' ? 'Belépés rögzítve' : 'Kilépés rögzítve';
  $('#coSub').textContent = myProfile ? myProfile.name : '';
  $('#coTag').textContent = tag || '';
  overlay.classList.add('show');
  setTimeout(function () { overlay.classList.remove('show'); }, 2600);
}

/* ---------------- NFC — 2) Web NFC API (Android Chrome, app nyitva tartva) ---------------- */

if (!('NDEFReader' in window)) {
  $('#nfcSupport').textContent = 'A böngésződ nem támogatja a Web NFC-t — használd a matricára írt linket, vagy Android Chrome-ot.';
}

$('#nfcScanBtn').addEventListener('click', async function () {
  if (!('NDEFReader' in window)) {
    showToast('A Web NFC csak Android Chrome-ban érhető el. Használd a matricára írt linket.');
    return;
  }
  try {
    const reader = new NDEFReader();
    await reader.scan();
    showToast('Készen áll — érintsd a telefont a matricához.');
    reader.onreading = function (event) {
      const tag = 'nfc:' + (event.serialNumber || 'ismeretlen');
      recordEvent('nfc', tag);
    };
    reader.onreadingerror = function () {
      showToast('Nem sikerült beolvasni a matricát, próbáld újra.');
    };
  } catch (e) {
    console.error(e);
    showToast('NFC engedély megtagadva, vagy hiba történt.');
  }
});

/* ---------------- Csapat nézet (admin) ---------------- */

function startTeamListener() {
  if (unsubTeam) unsubTeam();
  unsubTeam = db.collection('employees').orderBy('name', 'asc')
    .onSnapshot(function (snap) {
      const rows = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
      renderTeam(rows);
    }, function (e) {
      console.error(e);
      $('#teamGrid').innerHTML = '<div class="empty-state">Hiba az adatok betöltésekor.</div>';
    });
}

function renderTeam(rows) {
  const grid = $('#teamGrid');
  const active = rows.filter(r => r.active !== false);
  if (!active.length) { grid.innerHTML = '<div class="empty-state">Nincs még felvett alkalmazott.</div>'; return; }
  grid.innerHTML = active.map(function (r) {
    const inNow = !!r.currentlyIn;
    return '<div class="team-card ' + (inNow ? 'is-in' : 'is-out') + '">' +
      '<div class="tc-name">' + escapeHtml(r.name) + '</div>' +
      '<div class="tc-role"><span class="role-pill' + (r.role === 'admin' ? ' admin' : '') + '">' + (r.role === 'admin' ? 'Admin' : 'Dolgozó') + '</span></div>' +
      '<div class="tc-state">' + (inNow ? 'Bent van' : 'Nincs bent') + '</div>' +
      '<div class="tc-meta">' + (r.lastChangeAt ? formatDateTime(r.lastChangeAt) : 'Nincs esemény') + '</div>' +
      '</div>';
  }).join('');
}

/* ---------------- Alkalmazottak kezelése (admin) ---------------- */

$('#addEmployeeForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const uid = $('#ae-uid').value.trim();
  const name = $('#ae-name').value.trim();
  const role = $('#ae-role').value;
  const msg = $('#aeMsg');
  msg.className = 'form-msg';
  if (!uid || !name) return;

  db.collection('employees').doc(uid).set({
    name: name,
    role: role,
    active: true,
    currentlyIn: false,
    lastChangeAt: null,
    lastTag: null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).then(function () {
    msg.textContent = 'Alkalmazott mentve.';
    msg.classList.add('ok');
    $('#addEmployeeForm').reset();
  }).catch(function (e) {
    console.error(e);
    msg.textContent = 'Hiba történt a mentéskor.';
    msg.classList.add('err');
  });
});

function startEmployeesListener() {
  if (unsubEmployees) unsubEmployees();
  unsubEmployees = db.collection('employees').orderBy('name', 'asc')
    .onSnapshot(function (snap) {
      allEmployees = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
      renderEmployeesList();
      renderLogEmployeeFilter();
    }, function (e) {
      console.error(e);
      $('#employeesList').innerHTML = '<div class="empty-state">Hiba az adatok betöltésekor.</div>';
    });
}

function renderEmployeesList() {
  const box = $('#employeesList');
  if (!allEmployees.length) { box.innerHTML = '<div class="empty-state">Még nincs felvett alkalmazott.</div>'; return; }
  box.innerHTML = allEmployees.map(function (r) {
    return '<div class="lead-row" style="cursor:default;">' +
      '<div class="lr-main">' +
        '<div class="lr-top">' +
          '<span class="lr-name">' + escapeHtml(r.name) + '</span>' +
          '<span class="role-pill' + (r.role === 'admin' ? ' admin' : '') + '">' + (r.role === 'admin' ? 'Admin' : 'Dolgozó') + '</span>' +
          (r.active === false ? '<span class="status-badge new">Inaktív</span>' : '') +
          '<span class="lr-date">' + escapeHtml(r.id) + '</span>' +
        '</div>' +
        '<div class="lr-actions">' +
          '<button class="a-btn outline" data-act="toggleRole" data-id="' + r.id + '">Szerepkör váltása</button>' +
          '<button class="a-btn ghost" data-act="toggleActive" data-id="' + r.id + '">' + (r.active === false ? 'Aktiválás' : 'Deaktiválás') + '</button>' +
          '<button class="a-btn danger" data-act="remove" data-id="' + r.id + '">Törlés</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  box.querySelectorAll('button[data-act]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      const emp = allEmployees.find(e => e.id === id);
      if (!emp) return;
      if (act === 'toggleRole') {
        db.collection('employees').doc(id).update({ role: emp.role === 'admin' ? 'dolgozo' : 'admin' });
      } else if (act === 'toggleActive') {
        db.collection('employees').doc(id).update({ active: emp.active === false });
      } else if (act === 'remove') {
        if (confirm('Biztosan törlöd ' + emp.name + ' profilját? (a korábbi naplóbejegyzései megmaradnak)')) {
          db.collection('employees').doc(id).delete();
        }
      }
    });
  });
}

/* ---------------- Teljes napló (admin) ---------------- */

function renderLogEmployeeFilter() {
  const sel = $('#logEmployeeFilter');
  const current = sel.value;
  sel.innerHTML = '<option value="all">Mindenki</option>' +
    allEmployees.map(e => '<option value="' + e.id + '">' + escapeHtml(e.name) + '</option>').join('');
  sel.value = current || 'all';
}

function startLogListener() {
  if (unsubLog) unsubLog();
  unsubLog = db.collection('attendance').orderBy('at', 'desc').limit(500)
    .onSnapshot(function (snap) {
      allLogRows = snap.docs.map(d => d.data());
      renderLog();
    }, function (e) {
      console.error(e);
      $('#logBody').innerHTML = '<tr><td colspan="5" class="empty-state">Hiba az adatok betöltésekor.</td></tr>';
    });
}

$('#logFilterBtn').addEventListener('click', renderLog);

function renderLog() {
  const empFilter = $('#logEmployeeFilter').value;
  const from = $('#logFrom').value ? new Date($('#logFrom').value + 'T00:00:00') : null;
  const to = $('#logTo').value ? new Date($('#logTo').value + 'T23:59:59') : null;

  const filtered = allLogRows.filter(function (r) {
    if (empFilter !== 'all' && r.uid !== empFilter) return false;
    const d = r.at && r.at.toDate ? r.at.toDate() : null;
    if (from && d && d < from) return false;
    if (to && d && d > to) return false;
    return true;
  });

  const body = $('#logBody');
  if (!filtered.length) { body.innerHTML = '<tr><td colspan="5" class="empty-state">Nincs a szűrésnek megfelelő esemény.</td></tr>'; return; }
  body.innerHTML = filtered.map(function (r) {
    return '<tr>' +
      '<td>' + escapeHtml(r.name || '–') + '</td>' +
      '<td class="type-' + r.type + '">' + (r.type === 'be' ? 'Belépés' : 'Kilépés') + '</td>' +
      '<td>' + formatDateTime(r.at) + '</td>' +
      '<td>' + (r.method === 'nfc' ? 'NFC' : 'Kézi') + '</td>' +
      '<td>' + (r.tag ? '<span class="hist-tag">' + escapeHtml(r.tag) + '</span>' : '–') + '</td>' +
      '</tr>';
  }).join('');
}

$('#exportCsvBtn').addEventListener('click', function () {
  const empFilter = $('#logEmployeeFilter').value;
  const from = $('#logFrom').value ? new Date($('#logFrom').value + 'T00:00:00') : null;
  const to = $('#logTo').value ? new Date($('#logTo').value + 'T23:59:59') : null;
  const filtered = allLogRows.filter(function (r) {
    if (empFilter !== 'all' && r.uid !== empFilter) return false;
    const d = r.at && r.at.toDate ? r.at.toDate() : null;
    if (from && d && d < from) return false;
    if (to && d && d > to) return false;
    return true;
  });
  const header = 'Nev;Tipus;Idopont;Mod;Matrica\n';
  const csvBody = filtered.map(function (r) {
    return [r.name || '', r.type === 'be' ? 'Belepes' : 'Kilepes', formatDateTime(r.at), r.method, r.tag || ''].join(';');
  }).join('\n');
  const blob = new Blob(['\uFEFF' + header + csvBody], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'jelenleti-naplo.csv';
  a.click();
});
