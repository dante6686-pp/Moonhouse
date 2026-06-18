import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, getDoc, collection, addDoc, onSnapshot, query, orderBy, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. Twoja konfiguracja Firebase z konsoli
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
const googleProvider = new GoogleAuthProvider();

// Zmienne pomocnicze dla UI
let selectedAvatarUrl = "https://api.dicebear.com/7.x/pixel-art/svg?seed=1";
let currentUserData = null;

// Wybór avatara w formularzu
document.querySelectorAll('.avatar-option').forEach(img => {
    img.addEventListener('click', (e) => {
        document.querySelectorAll('.avatar-option').forEach(i => i.classList.remove('selected'));
        e.target.classList.add('selected');
        selectedAvatarUrl = e.target.src;
    });
});

// Zmiana statusu Online/Offline w bazie
async function setUserOnlineStatus(uid, isOnline) {
    if (!uid) return;
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { isOnline: isOnline }).catch(async () => {
        // Jeśli dokument nie istnieje (np. pierwsze logowanie Google), update rzuci błąd, 
        // ale obsłużymy to przy tworzeniu profilu.
    });
}

// 2. REJESTRACJA E-MAILEM
document.getElementById('btn-register').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const nickname = document.getElementById('nickname').value || "Anonim";

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Tworzymy profil użytkownika w Firestore
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            nickname: nickname,
            avatar: selectedAvatarUrl,
            joinedAt: new Date().toLocaleDateString('pl-PL'),
            isOnline: true
        });
    } catch (error) {
        alert("Błąd rejestracji: " + error.message);
    }
});

// 3. LOGOWANIE E-MAILEM
document.getElementById('btn-login').addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    signInWithEmailAndPassword(auth, email, password).catch(err => alert(err.message));
});

// 4. LOGOWANIE GOOGLE
document.getElementById('btn-google').addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        // Jeśli użytkownik loguje się przez Google pierwszy raz, tworzymy mu profil
        if (!userSnap.exists()) {
            await setDoc(userRef, {
                uid: user.uid,
                nickname: user.displayName || "Google User",
                avatar: user.photoURL || "https://api.dicebear.com/7.x/pixel-art/svg?seed=default",
                joinedAt: new Date().toLocaleDateString('pl-PL'),
                isOnline: true
            });
        } else {
            await setUserOnlineStatus(user.uid, true);
        }
    } catch (error) {
        alert("Błąd Google Auth: " + error.message);
    }
});

// 5. WYLOGOWANIE
document.getElementById('btn-logout').addEventListener('click', async () => {
    await setUserOnlineStatus(auth.currentUser?.uid, false);
    signOut(auth);
});

// Status przy zamknięciu karty
window.addEventListener('beforeunload', () => {
    if (auth.currentUser) {
        setUserOnlineStatus(auth.currentUser.uid, false);
    }
});

// 6. OBSŁUGA STANU ZALOGOWANIA (Serce aplikacji)
onAuthStateChanged(auth, async (user) => {
    const authSec = document.getElementById('auth-section');
    const mainSec = document.getElementById('main-section');

    if (user) {
        // Użytkownik zalogowany
        authSec.classList.add('hidden');
        mainSec.classList.remove('hidden');
        
        await setUserOnlineStatus(user.uid, true);

        // Pobieramy dane zalogowanego użytkownika
        const userSnap = await getDoc(doc(db, "users", user.uid));
        currentUserData = userSnap.data();
        document.getElementById('user-display-name').innerText = currentUserData?.nickname;

        // Uruchamiamy nasłuchiwanie bazy danych na żywo
        startLiveListeners();
    } else {
        // Użytkownik wylogowany
        authSec.classList.remove('hidden');
        mainSec.classList.add('hidden');
        currentUserData = null;
    }
});

// 7. NASŁUCHIWANIE NA ŻYWO (Firestore onSnapshot)
let unsubscribeUsers = null;
let unsubscribeChat = null;

function startLiveListeners() {
    // Jeśli już nasłuchiwaliśmy, czyścimy stare subskrypcje
    if (unsubscribeUsers) unsubscribeUsers();
    if (unsubscribeChat) unsubscribeChat();

    // LISTA UŻYTKOWNIKÓW (na żywo)
    unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
        const usersListDiv = document.getElementById('users-list');
        usersListDiv.innerHTML = "";
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            const statusClass = data.isOnline ? "online" : "offline";
            
            const userRow = document.createElement('div');
            userRow.className = "user-card";
            userRow.innerHTML = `
                <img src="${data.avatar}" class="avatar">
                <span><strong>${data.nickname}</strong> (Dołączył: ${data.joinedAt})</span>
                <div class="status-dot ${statusClass}"></div>
            `;
            usersListDiv.appendChild(userRow);
        });
    });

    // CZAT GLOBALNY (na żywo, posortowany po czasie)
    const chatQuery = query(collection(db, "messages"), orderBy("timestamp", "asc"));
    unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
        const chatBox = document.getElementById('chat-box');
        chatBox.innerHTML = "";
        
        snapshot.forEach((doc) => {
            const msg = doc.data();
            const msgRow = document.createElement('div');
            msgRow.style.margin = "4px 0";
            msgRow.innerHTML = `
                <img src="${msg.avatar}" class="avatar" style="width:20px; height:20px; vertical-align:middle;">
                <span style="color:#ff9900;">[${msg.nickname}]:</span> <span>${msg.text}</span>
            `;
            chatBox.appendChild(msgRow);
        });
        chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll na dół
    });
}

// 8. WYSYŁANIE WIADOMOŚCI NA CZACIE
document.getElementById('btn-send').addEventListener('click', sendMessage);
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !currentUserData) return;

    await addDoc(collection(db, "messages"), {
        text: text,
        uid: currentUserData.uid,
        nickname: currentUserData.nickname,
        avatar: currentUserData.avatar,
        timestamp: new Date()
    });

    input.value = "";
}

