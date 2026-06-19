import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. KONFIGURACJA FIREBASE
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

// Zabezpieczenie sesji
setPersistence(auth, browserLocalPersistence).catch((err) => console.error("Błąd persystencji:", err));

// Słownik tłumaczący klasy statków
const shipNames = {
    "ship-light": "Lekki Zwiadowca",
    "ship-cargo": "Transportowiec Ciężki",
    "ship-miner": "Koparka Planetarna",
    "ship-combat": "Fregata Bojowa"
};

let isInitialCheck = true;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        isInitialCheck = false;
        try {
            // Pobieramy dane użytkownika z kolekcji "users"
            const userSnap = await getDoc(doc(db, "users", user.uid));
            
            if (userSnap.exists()) {
                const data = userSnap.data();
                
                // 1. Nick (jeśli brak w dokumencie, bierzemy z profilu auth lub dajemy fallback)
                document.getElementById('prof-nickname').innerText = data.nickname || user.displayName || "Nieznany Pilot";
                
                // 2. Avatar
                document.getElementById('prof-avatar').src = data.avatar || user.photoURL || "https://api.dicebear.com/7.x/bottts/svg?seed=default";
                
                // 3. Data dołączenia
                document.getElementById('prof-joined').innerText = data.joinedAt || new Date().toLocaleDateString('pl-PL');
                
                // 4. Klasa statku (Zabezpieczenie przed undefined dla starych kont)
                const shipCode = data.spaceship || "ship-light";
                document.getElementById('prof-ship').innerText = shipNames[shipCode] || "Lekki Zwiadowca";

                // 5. Status połączenia
                const statusText = document.getElementById('prof-status-text');
                if (data.isOnline !== undefined) {
                    statusText.innerText = data.isOnline ? "Operacyjny (Online)" : "Brak Łączności (Offline)";
                    statusText.style.color = data.isOnline ? "var(--terminal-green)" : "var(--text-muted)";
                } else {
                    statusText.innerText = "Operacyjny (Online)";
                    statusText.style.color = "var(--terminal-green)";
                }

                // 6. Bio / Dziennik
                if (data.bio) {
                    document.getElementById('prof-bio').innerText = data.bio;
                } else {
                    document.getElementById('prof-bio').innerText = "Modyfikacja dziennika zablokowana. Brak nowych wpisów.";
                }

            } else {
                // Jeśli dokument w ogóle nie istnieje w Firestore dla tego UID
                document.getElementById('prof-nickname').innerText = "Nie znaleziono dokumentu pilota";
                document.getElementById('prof-ship').innerText = "Nieznana (Załóż nowe konto)";
                document.getElementById('prof-joined').innerText = "Brak danych";
            }
        } catch (error) {
            console.error("Błąd krytyczny Firestore:", error);
            document.getElementById('prof-nickname').innerText = "Błąd odczytu danych";
        }
    } else {
        if (isInitialCheck) {
            setTimeout(() => {
                if (!auth.currentUser) {
                    window.location.href = "index.html";
                }
            }, 2500); 
        } else {
            window.location.href = "index.html";
        }
    }
});
