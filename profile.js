import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. KONFIGURACJA FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyAQfMt3UGWwLUi853-GVF_xVVhG50NzHto",
  authDomain: "moonhouse-155b7.firebaseapp.com",
  projectId: "moonhouse-155b7",
  storageBucket: "moonhouse-155b7.firebasestorage.app",
  messagingSenderId: "792044657712",
  appId: "1:792044657712:web:2fbc166d505eecf81e61f5",
  measurementId: "G-E6Y84RCG7T"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

setPersistence(auth, browserLocalPersistence).catch((err) => console.error("Błąd persystencji:", err));

const shipNames = {
    "ship-light": "Lekki Zwiadowca",
    "ship-cargo": "Transportowiec Ciężki",
    "ship-miner": "Koparka Planetarna",
    "ship-combat": "Fregata Bojowa"
};

// Flaga określająca, czy Firebase dokonał już pierwszego sprawdzenia sesji
let firebaseLoaded = false;

onAuthStateChanged(auth, async (user) => {
    // Dopóki Firebase nie odpowie po raz pierwszy (user może być null na starcie),
    // ignorujemy pusty stan i czekamy na właściwy sygnał.
    if (!user && !firebaseLoaded) {
        firebaseLoaded = true;
        // Dajemy mikro-szansę sieci na zmianę stanu. Jeśli po chwili nadal nie ma usera, wyrzucamy.
        setTimeout(() => {
            if (!auth.currentUser) window.location.href = "index.html";
        }, 300);
        return;
    }

    if (user) {
        firebaseLoaded = true;
        try {
            const userSnap = await getDoc(doc(db, "users", user.uid));
            
            if (userSnap.exists()) {
                const data = userSnap.data();
                
                // Mapowanie danych na interfejs
                document.getElementById('prof-nickname').innerText = data.nickname || user.displayName || "Nieznany Pilot";
                document.getElementById('prof-avatar').src = data.avatar || user.photoURL || "https://api.dicebear.com/7.x/bottts/svg?seed=default";
                document.getElementById('prof-joined').innerText = data.joinedAt || "Nieznana";
                
                const shipCode = data.spaceship || "ship-light";
                document.getElementById('prof-ship').innerText = shipNames[shipCode] || "Lekki Zwiadowca";

                // Ustawiamy sztywno zielony status ONLINE, ponieważ autoryzacja właśnie przeszła pomyślnie
                const statusText = document.getElementById('prof-status-text');
                statusText.innerText = "Operacyjny (Online)";
                statusText.style.color = "var(--terminal-green)";

                if (data.bio) {
                    document.getElementById('prof-bio').innerText = data.bio;
                } else {
                    document.getElementById('prof-bio').innerText = "Modyfikacja dziennika zablokowana. Brak nowych wpisów.";
                }

            } else {
                document.getElementById('prof-nickname').innerText = "Nie znaleziono dokumentu pilota";
            }
        } catch (error) {
            console.error("Błąd Firestore:", error);
            document.getElementById('prof-nickname').innerText = "Błąd odczytu danych";
        }
    } else {
        // Jeśli user wylogował się intencjonalnie, natychmiast powrót
        window.location.href = "index.html";
    }
});
