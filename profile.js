import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
    "ship-heavy": "Koparka Planetarna",
    "ship-combat": "Fregata Bojowa"
};

onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('profile-main-content');
    
    if (user) {
        try {
            const userSnap = await getDoc(doc(db, "users", user.uid));
            
            if (userSnap.exists()) {
                const data = userSnap.data();
                
                document.getElementById('prof-nickname').innerText = data.nickname || user.displayName || "Nieznany Pilot";
                document.getElementById('prof-joined').innerText = data.joinedAt || "Nieznana";
                
                const shipCode = data.spaceship || "ship-light";
                document.getElementById('prof-ship').innerText = shipNames[shipCode] || "Lekki Zwiadowca";

                const userAvatar = data.avatar || "assets/char-1.png";
                document.getElementById('prof-avatar').src = userAvatar;

                const statusText = document.getElementById('prof-status-text');
                statusText.innerText = "Operacyjny (Online)";
                statusText.style.color = "var(--terminal-green)";

                if (data.bio) {
                    document.getElementById('prof-bio').innerText = data.bio;
                }

                // DIORAMA PIXEL ART
                const charCode = data.character || "char-1";
                const charImg = document.getElementById('diorama-char');
                charImg.src = `assets/${charCode}.png`;
                charImg.classList.remove('hidden');

                const shipImg = document.getElementById('diorama-ship');
                shipImg.src = `assets/${shipCode}.png`;
                shipImg.classList.remove('hidden');

                // Pomyślnie załadowano dane - pokazujemy profil użytkownikowi
                mainContent.classList.remove('auth-loading');

            } else {
                alert("Nie odnaleziono Twojej karty identyfikacyjnej w bazie Firestore. Załóż nowe konto.");
                window.location.href = "index.html";
            }
        } catch (error) {
            console.error("Błąd bazy danych:", error);
            document.getElementById('prof-nickname').innerText = "Błąd odczytu danych";
            mainContent.classList.remove('auth-loading');
        }
    } else {
        // Definitywny brak sesji - natychmiastowe odesłanie do panelu głównego
        window.location.href = "index.html";
    }
});
