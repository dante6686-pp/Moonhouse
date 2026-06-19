import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// KONFIGURACJA FIREBASE (Wklej tu swoje klucze, tak samo jak w app.js)
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

// Słownik tłumaczący identyfikatory maszyn na ładne nazwy systemowe
const shipNames = {
    "ship-light": "Lekki Zwiadowca",
    "ship-cargo": "Transportowiec Ciężki",
    "ship-miner": "Koparka Planetarna",
    "ship-combat": "Fregata Bojowa"
};

// Sprawdzamy stan zalogowania pilota
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            // Pobieramy dane użytkownika z kolekcji "users" w Firestore
            const userSnap = await getDoc(doc(db, "users", user.uid));
            
            if (userSnap.exists()) {
                const data = userSnap.data();
                
                // Mapowanie danych na elementy HTML
                document.getElementById('prof-nickname').innerText = data.nickname || "Nieznany Pilot";
                document.getElementById('prof-avatar').src = data.avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=default";
                document.getElementById('prof-joined').innerText = data.joinedAt || "Nieznana";
                
                // Tłumaczenie klasy statku
                const shipCode = data.spaceship || "ship-light";
                document.getElementById('prof-ship').innerText = shipNames[shipCode] || shipCode;

                // Status online
                const statusText = document.getElementById('prof-status-text');
                if (data.isOnline) {
                    statusText.innerText = "Operacyjny (Online)";
                    statusText.style.color = "var(--terminal-green)";
                } else {
                    statusText.innerText = "Brak Łączności (Offline)";
                    statusText.style.color = "var(--text-muted)";
                }

                // Bio placeholder (możesz później dodać edycję tego pola w bazie)
                if (data.bio) {
                    document.getElementById('prof-bio').innerText = data.bio;
                }

            } else {
                document.getElementById('prof-nickname').innerText = "Błąd: Brak profilu w bazie";
            }
        } catch (error) {
            console.error("Błąd pobierania danych sektora:", error);
            document.getElementById('prof-nickname').innerText = "Błąd połączenia z bazą";
        }
    } else {
        // Jeśli ktoś wejdzie na profil nie będąc zalogowanym, przekieruj go do bazy głównej
        window.location.href = "index.html";
    }
});

