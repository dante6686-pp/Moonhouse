import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. KONFIGURACJA FIREBASE
// Wklej tutaj swoje poprawne klucze z konsoli Firebase!
const firebaseConfig = {
    apiKey: "TWÓJ_API_KEY",
    authDomain: "TWÓJ_AUTH_DOMAIN",
    projectId: "TWÓJ_PROJECT_ID",
    storageBucket: "TWÓJ_STORAGE_BUCKET",
    messagingSenderId: "TWÓJ_MESSAGING_SENDER_ID",
    appId: "TWÓJ_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Wymuszenie lokalnego zapamiętywania sesji
setPersistence(auth, browserLocalPersistence).catch((err) => console.error("Błąd persystencji sesji:", err));

// Słownik tłumaczący klasy statków na nazwy interfejsu
const shipNames = {
    "ship-light": "Lekki Zwiadowca",
    "ship-cargo": "Transportowiec Ciężki",
    "ship-miner": "Koparka Planetarna",
    "ship-combat": "Fregata Bojowa"
};

// Flaga określająca, czy Firebase dokonał już pierwszego sprawdzenia sesji
let firebaseLoaded = false;

onAuthStateChanged(auth, async (user) => {
    // Jeśli przy pierwszym załadowaniu Firebase jeszcze nie wie, czy użytkownik istnieje,
    // dajemy przeglądarce ułamek sekundy na pobranie tokenu zamiast od razu wyrzucać.
    if (!user && !firebaseLoaded) {
        firebaseLoaded = true;
        setTimeout(() => {
            if (!auth.currentUser) window.location.href = "index.html";
        }, 300);
        return;
    }

    if (user) {
        firebaseLoaded = true;
        try {
            // Pobieramy dokument zalogowanego użytkownika z kolekcji "users"
            const userSnap = await getDoc(doc(db, "users", user.uid));
            
            if (userSnap.exists()) {
                const data = userSnap.data();
                
                // 1. Mapowanie podstawowych tekstów profilu
                document.getElementById('prof-nickname').innerText = data.nickname || user.displayName || "Nieznany Pilot";
                document.getElementById('prof-joined').innerText = data.joinedAt || new Date().toLocaleDateString('pl-PL');
                
                // Wyświetlanie nazwy klasy statku ze słownika
                const shipCode = data.spaceship || "ship-light";
                document.getElementById('prof-ship').innerText = shipNames[shipCode] || "Lekki Zwiadowca";

                // Awatar profilowy na górnym pasku i karcie
                const userAvatar = data.avatar || "assets/char-1.png";
                document.getElementById('prof-avatar').src = userAvatar;

                // 2. Zielony status Online
                const statusText = document.getElementById('prof-status-text');
                statusText.innerText = "Operacyjny (Online)";
                statusText.style.color = "var(--terminal-green)";

                // 3. Ładowanie Dziennika Pokładowego (Bio)
                if (data.bio) {
                    document.getElementById('prof-bio').innerText = data.bio;
                } else {
                    document.getElementById('prof-bio').innerText = "Modyfikacja dziennika zablokowana. Brak nowych wpisów.";
                }

                // ===================================================
                // 4. GENEROWANIE PIXEL ART DIORAMY (Sektor lądowania)
                // ===================================================
                
                // Warstwa Postaci (Kombinezonu)
                const charCode = data.character || "char-1";
                const charImg = document.getElementById('diorama-char');
                charImg.src = `assets/${charCode}.png`;
                charImg.classList.remove('hidden');

                // Warstwa Statku Kosmicznego
                const shipImg = document.getElementById('diorama-ship');
                shipImg.src = `assets/${shipCode}.png`;
                shipImg.classList.remove('hidden');

            } else {
                console.warn("Autoryzacja powiodła się, ale brak dokumentu w Firestore.");
                document.getElementById('prof-nickname').innerText = "Nie znaleziono dokumentu pilota";
            }
        } catch (error) {
            console.error("Błąd krytyczny odczytu z bazy Firestore:", error);
            document.getElementById('prof-nickname').innerText = "Błąd odczytu danych terminala";
        }
    } else {
        // Jeśli użytkownik jest definitywnie niezalogowany lub kliknął wyloguj - powrót
        window.location.href = "index.html";
    }
});
