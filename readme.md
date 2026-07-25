# Tibiredőny Kft — Admin felület, beüzemelési útmutató

## Mit kaptál?

- **admin.html / admin.css / admin.js** — a védett admin felület: bejelentkezés,
  beérkezett ajánlatkérések kezelése, galéria kezelése (kép feltöltéssel).
- **firebase-config.js** — közös Firebase-beállítás, ezt tölti be minden érintett oldal.
- **script.js** (frissítve) — a `kapcsolat.html` és a `fooldal.html` ajánlatkérő űrlapja
  mostantól a Firestore `leads` gyűjteményébe menti a beküldéseket (korábban csak
  egy hamis "elküldve" üzenetet mutatott, semmi nem történt a háttérben).
- **galeria.html** (frissítve) — a képek most már a Firestore `gallery` gyűjteményéből
  töltődnek be dinamikusan, tehát amit az admin felületen feltöltesz/szerkesztesz,
  az azonnal megjelenik a nyilvános galérián.
- **firestore.rules** — biztonsági szabályok, ezt kell beállítani a Firebase konzolon
  (lásd lent).

## 1. Bejelentkezés engedélyezése (Firebase Auth)

1. Nyisd meg a [Firebase konzolt](https://console.firebase.google.com/) → **tibiredonykft** projekt.
2. **Authentication → Sign-in method** → engedélyezd az **E-mail/jelszó** bejelentkezést.
3. **Authentication → Users → Add user** → hozd létre a saját admin fiókodat
   (pl. `tibiredony@gmail.com` + egy jelszó). Fontos: itt manuálisan add hozzá a
   felhasználót — az admin felületen nincs (és biztonsági okból nem is szabad, hogy legyen)
   önálló regisztráció.
4. Ha több személy is kezeli majd a felületet, ugyanitt vehetsz fel nekik is fiókot.

## 2. Firestore adatbázis

Ha még nincs Firestore adatbázisod a projektben: **Firestore Database → Create database**
(élesben: "Production mode"). Két gyűjteményt fog automatikusan létrehozni az admin felület,
amint először mentesz bennük adatot: `leads` és `gallery` — nem kell kézzel létrehoznod őket.

### Biztonsági szabályok

**Firestore Database → Rules** fülön illeszd be a mellékelt `firestore.rules` tartalmát,
majd kattints **Publish**-ra. Ez biztosítja, hogy:
- bárki tud ajánlatkérést beküldeni a weboldalról,
- de csak a bejelentkezett admin láthatja/törölheti/módosíthatja az ajánlatkéréseket,
- a galéria bárki számára látható, de csak az admin szerkesztheti.

## 3. Képek a galériához

A projekt szándékosan nem használ Firebase Storage-ot (ez fizetős Blaze-csomagot
igényelne) — az admin felület Galéria űrlapján mindig egy kép URL-t kell megadni
(pl. egy ingyenes képtárhelyen vagy CDN-en elhelyezett kép linkjét).

## 4. Telepítés Vercel-re

A projekt egy sima statikus oldal (HTML/CSS/JS), így közvetlenül telepíthető
Vercel-re: hozz létre egy új Vercel projektet, és kösd hozzá ezt a mappát
(pl. GitHub-repóként, vagy a Vercel CLI-vel: `vercel deploy`). Külön build-lépés
nem szükséges. A mellékelt `vercel.json` gondoskodik róla, hogy a gyökér-URL
(`/`) a `fooldal.html`-t szolgálja ki. Az `admin.html` nincs belinkelve a
nyilvános menüből — csak azok érik el, akik ismerik a pontos címét
(pl. `https://sajatdomain.hu/admin.html`).

## 5. Használat

- Lépj be az `admin.html` oldalon a Firebase-ben létrehozott e-mail címmel és jelszóval.
- **Áttekintés**: gyors összkép (ajánlatkérések, elintézetlenek, galéria elemek száma).
- **Ajánlatkérések**: a `kapcsolat.html` és a főoldal űrlapján beküldött jelentkezések
  valós időben megjelennek itt. Rákattintva kinyílik a teljes üzenet, megjelölhető
  "elintézett"-ként, illetve törölhető.
- **Galéria**: "+ Új kép hozzáadása" — kategória kiválasztása, felirat megadása, kép
  feltöltése (vagy URL megadása), majd Mentés. A publikus `galeria.html` oldal ezt
  azonnal megjeleníti.

## Megjegyzés a jelszó-visszaállításhoz

Az admin bejelentkezési oldalon nincs "Elfelejtett jelszó" gomb. Ha egy admin
elfelejti a jelszavát, a jelszót a Firebase konzolon lehet visszaállítani:
**Authentication → Users** → a felhasználó melletti menüben **Reset password**
(vagy egyszerűen törölj és hozz létre újra egy fiókot ugyanazzal az e-mail címmel).
