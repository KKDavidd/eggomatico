function initGalleryInteractions() {
  var filterBtns = document.querySelectorAll('.filter-bar button');
  var galleryItems = document.querySelectorAll('.gallery-item');
  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var cat = btn.dataset.filter;
      galleryItems.forEach(function (item) {
        if (cat === 'all' || item.dataset.cat === cat) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });

  var lightbox = document.querySelector('.lightbox');
  if (lightbox) {
    var lbCap = lightbox.querySelector('.lb-cap');
    var lbPh = lightbox.querySelector('.lb-ph');
    galleryItems.forEach(function (item) {
      item.addEventListener('click', function () {
        lbCap.textContent = item.dataset.caption || '';
        if (lbPh) {
          var img = item.dataset.img;
          if (img) {
            lbPh.style.backgroundImage = "url('" + img + "')";
            lbPh.style.backgroundSize = 'cover';
            lbPh.style.backgroundPosition = 'center';
          } else {
            lbPh.style.backgroundImage = '';
          }
        }
        lightbox.classList.add('open');
      });
    });
    lightbox.querySelector('.lb-close').addEventListener('click', function () {
      lightbox.classList.remove('open');
    });
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) lightbox.classList.remove('open');
    });
  }
}
window.initGalleryInteractions = initGalleryInteractions;

document.addEventListener('DOMContentLoaded', function () {
  var burger = document.querySelector('.burger');
  var header = document.querySelector('.site-header');
  if (burger && header) {
    burger.addEventListener('click', function () {
      header.classList.toggle('open');
    });
  }

  var navProducts = document.querySelector('.nav-products > button');
  if (navProducts) {
    navProducts.addEventListener('click', function (e) {
      var parent = navProducts.parentElement;
      var dd = parent.querySelector('.dropdown');
      if (window.innerWidth <= 980) {
        dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
      }
    });
  }

  if (!document.querySelector('[data-dynamic-gallery]')) {
    initGalleryInteractions();
  }

  document.querySelectorAll('form.lead-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('.form-submit');
      var original = btn.textContent;
      var nameInput = form.querySelector('input[type="text"]');
      var emailInput = form.querySelector('input[type="email"]');
      var telInput = form.querySelector('input[type="tel"]');
      var msgInput = form.querySelector('textarea');

      var pagePath = window.location.pathname.split('/').pop();
      var lead = {
        name: nameInput ? nameInput.value.trim() : '',
        email: emailInput ? emailInput.value.trim() : '',
        phone: telInput ? telInput.value.trim() : '',
        message: msgInput ? msgInput.value.trim() : '',
        source: pagePath ? pagePath : 'fooldal',
        status: 'new'
      };

      function showSent() {
        btn.textContent = 'Köszönjük, elküldve!';
        form.reset();
        setTimeout(function () { btn.textContent = original; btn.disabled = false; }, 3000);
      }

      function showError() {
        btn.textContent = 'Hiba történt, próbálja újra';
        setTimeout(function () { btn.textContent = original; btn.disabled = false; }, 3000);
      }

      btn.disabled = true;

      if (typeof db !== 'undefined') {
        lead.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        db.collection('leads').add(lead).then(showSent).catch(function (err) {
          console.error(err);
          showError();
        });
      } else {
        showSent();
      }
    });
  });
});
