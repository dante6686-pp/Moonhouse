import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged,
    setPersistence, browserLocalPersistence // <-- DODANE
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, getDoc, collection, addDoc, onSnapshot, query, orderBy, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// KONFIGURACJA FIREBASE
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
const googleProvider = new GoogleAuthProvider();

// Wymuszenie zapamiętywania sesji w app.js (DODANE)
setPersistence(auth, browserLocalPersistence);

// Zmienne pomocnicze
let currentUserData = null;
let selectedAvatarUrl = "https://api.dicebear.com/7.x/bottts/svg?seed=A";
let selectedShipType = "ship-light";

// ==========================================
// OBSŁUGA INTERFEJSU (Pickery i Modale)
// ==========================================

function closeAllModals() {
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('register-modal').style.display = 'none';
}

// Wybór postaci (kombinezonu)
document.querySelectorAll('#character-picker .picker-item').forEach(img => {
    img.addEventListener('click', (e) => {
        document.querySelectorAll('#character-picker .picker-item').forEach(i => i.classList.remove('selected'));
        e.target.classList.add('selected');
        selectedAvatarUrl = e.target.src; // Pobieramy link do obrazka
    });
});

// Wybór statku w formularzu rejestracji
document.querySelectorAll('#ship-picker .picker-item').forEach(img => {
    img.addEventListener('click', (e) => {
        // Usuń podświetlenie ze wszystkich statków w pickerze
        document.querySelectorAll('#ship-picker .picker-item').forEach(i => i.classList.remove('selected'));
        
        // Dodaj podświetlenie do klikniętego obrazka
        e.target.classList.add('selected');
        
        // Zapisz wybrany typ do zmiennej, która leci do Firebase
        selectedShipType = e.target.getAttribute('data-type'); 
    });
});




// ==========================================
// AUTORYZACJA I BAZA DANYCH
// ==========================================

// Zmiana statusu Online/Offline
async function setUserOnlineStatus(uid, isOnline) {
    if (!uid) return;
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { isOnline: isOnline }).catch(() => {
        // Ignorujemy błąd, jeśli dokument jeszcze nie istnieje (np. przy pierwszym logowaniu Google)
    });
}

// REJESTRACJA (Email)
document.getElementById('btn-register').addEventListener('click', async () => {
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const nickname = document.getElementById('reg-nickname').value || "Nieznany Pilot";

    if (!email || !password) {
        alert("Wprowadź email i hasło!");
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Zapis do bazy z nowymi polami statku
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            nickname: nickname,
            avatar: selectedAvatarUrl,
            spaceship: selectedShipType,
            joinedAt: new Date().toLocaleDateString('pl-PL'),
            isOnline: true
        });

        closeAllModals();
    } catch (error) {
        alert("Błąd systemów rejestracji: " + error.message);
    }
});

// LOGOWANIE (Email)
document.getElementById('btn-login').addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, email, password)
        .then(() => closeAllModals())
        .catch(err => alert("Odmowa dostępu: " + err.message));
});

// LOGOWANIE (Google)
document.getElementById('btn-google').addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        // Tworzenie profilu, jeśli loguje się pierwszy raz
        if (!userSnap.exists()) {
            await setDoc(userRef, {
                uid: user.uid,
                nickname: user.displayName || "Pilot Google",
                avatar: user.photoURL || "https://api.dicebear.com/7.x/bottts/svg?seed=default",
                spaceship: "ship-light", // Domyślny statek dla kont Google
                joinedAt: new Date().toLocaleDateString('pl-PL'),
                isOnline: true
            });
        } else {
            await setUserOnlineStatus(user.uid, true);
        }
        closeAllModals();
    } catch (error) {
        alert("Błąd łącza Google: " + error.message);
    }
});

// WYLOGOWANIE
document.getElementById('btn-logout').addEventListener('click', async () => {
    await setUserOnlineStatus(auth.currentUser?.uid, false);
    signOut(auth);
});

// Bezpiecznik przy zamknięciu okna przeglądarki
window.addEventListener('beforeunload', () => {
    if (auth.currentUser) {
        setUserOnlineStatus(auth.currentUser.uid, false);
    }
});


// ==========================================
// GŁÓWNA PĘTLA STANU (Słuchacz Logowania)
// ==========================================

onAuthStateChanged(auth, async (user) => {
    const navUnauth = document.getElementById('nav-unauth');
    const navAuth = document.getElementById('nav-auth');

    if (user) {
        // Pilot autoryzowany
        navUnauth.classList.add('hidden');
        navAuth.classList.remove('hidden');
        
        await setUserOnlineStatus(user.uid, true);

        // Pobranie danych profilu z Firestore
        const userSnap = await getDoc(doc(db, "users", user.uid));
        currentUserData = userSnap.data();
        
        // Aktualizacja górnego paska
        document.getElementById('nav-nickname').innerText = currentUserData?.nickname || "Pilot";
        document.getElementById('nav-avatar').src = currentUserData?.avatar || "";

        startLiveListeners();
    } else {
        // Brak autoryzacji
        navUnauth.classList.remove('hidden');
        navAuth.classList.add('hidden');
        currentUserData = null;
    }
});


// ==========================================
// NASŁUCHIWANIE DANYCH LIVE (Firestore)
// ==========================================

let unsubscribeUsers = null;
let unsubscribeChat = null;

function startLiveListeners() {
    if (unsubscribeUsers) unsubscribeUsers();
    if (unsubscribeChat) unsubscribeChat();

    // 1. LISTA OBECNYCH NA KSIĘŻYCU
    unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
        const usersListDiv = document.getElementById('users-list');
        usersListDiv.innerHTML = "";
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            // Pokazujemy tylko tych, którzy są online
            if(data.isOnline) {
                const userRow = document.createElement('div');
                userRow.style.display = "flex";
                userRow.style.alignItems = "center";
                userRow.style.marginBottom = "8px";
                userRow.innerHTML = `
                    <img src="${data.avatar}" style="width:24px; height:24px; border-radius:50%; margin-right:10px; border: 1px solid var(--accent);">
                    <span style="font-size: 14px;">${data.nickname}</span>
                `;
                usersListDiv.appendChild(userRow);
            }
        });
        
        if(usersListDiv.innerHTML === "") {
            usersListDiv.innerHTML = "<span style='color: var(--text-muted); font-size: 12px;'>Brak pilotów w sektorze.</span>";
        }
    });

    // 2. CZAT GLOBALNY
    const chatQuery = query(collection(db, "messages"), orderBy("timestamp", "asc"));
    unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
        const chatBox = document.getElementById('chat-box');
        chatBox.innerHTML = "";
        
        snapshot.forEach((doc) => {
            const msg = doc.data();
            
            // Formatowanie czasu jeśli istnieje
            let timeStr = "";
            if (msg.timestamp) {
                const date = msg.timestamp.toDate();
                timeStr = `[${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}] `;
            }

            const msgRow = document.createElement('div');
            msgRow.style.marginBottom = "8px";
            msgRow.style.fontSize = "13px";
            msgRow.innerHTML = `
                <span style="color: var(--text-muted);">${timeStr}</span>
                <span style="color: var(--accent); font-weight: bold;">${msg.nickname}:</span> 
                <span style="color: var(--text-main);">${msg.text}</span>
            `;
            chatBox.appendChild(msgRow);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}


// ==========================================
// WYSYŁANIE WIADOMOŚCI
// ==========================================

document.getElementById('btn-send').addEventListener('click', sendChatMessage);
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !currentUserData) return;

    await addDoc(collection(db, "messages"), {
        text: text,
        uid: currentUserData.uid,
        nickname: currentUserData.nickname,
        timestamp: new Date()
    });

    input.value = "";
}
