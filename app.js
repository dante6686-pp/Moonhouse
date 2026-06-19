import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged,
    setPersistence, browserLocalPersistence 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, getDoc, collection, addDoc, onSnapshot, query, orderBy, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

setPersistence(auth, browserLocalPersistence).catch((err) => console.error("Błąd pamięci sesji głównej:", err));

// Domyślne wartości z graficznych pickerów
let currentUserData = null;
let selectedCharType = "char-1";
let selectedShipType = "ship-light";

// ==========================================
// OBSŁUGA PICKERÓW GRAFICZNYCH (Rejestracja)
// ==========================================

function closeAllModals() {
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('register-modal').style.display = 'none';
}

// Picker kombinezonów
document.querySelectorAll('#character-picker .picker-item').forEach(img => {
    img.addEventListener('click', (e) => {
        document.querySelectorAll('#character-picker .picker-item').forEach(i => i.classList.remove('selected'));
        e.target.classList.add('selected');
        selectedCharType = e.target.getAttribute('data-type') || "char-1";
    });
});

// Picker statków kosmicznych
document.querySelectorAll('#ship-picker .picker-item').forEach(img => {
    img.addEventListener('click', (e) => {
        document.querySelectorAll('#ship-picker .picker-item').forEach(i => i.classList.remove('selected'));
        e.target.classList.add('selected');
        selectedShipType = e.target.getAttribute('data-type') || "ship-light"; 
    });
});

// Zmiana statusu Online w Firestore
async function setUserOnlineStatus(uid, isOnline) {
    if (!uid) return;
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { isOnline: isOnline }).catch(() => {});
}

// ==========================================
// AKCJE AUTORYZACYJNE
// ==========================================

// Rejestracja e-mail
document.getElementById('btn-register').addEventListener('click', async () => {
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const nickname = document.getElementById('reg-nickname').value || "Nieznany Pilot";

    if (!email || !password) {
        alert("System wymaga podania adresu e-mail oraz hasła.");
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Tworzenie pełnego wpisu astronauty w Firestore
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            nickname: nickname,
            avatar: `assets/${selectedCharType}.png`,
            character: selectedCharType,
            spaceship: selectedShipType,
            joinedAt: new Date().toLocaleDateString('pl-PL'),
            isOnline: true
        });

        closeAllModals();
    } catch (error) {
        alert("Błąd rejestracji kadrowej: " + error.message);
    }
});

// Logowanie e-mail
document.getElementById('btn-login').addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, email, password)
        .then(() => closeAllModals())
        .catch(err => alert("Odmowa autoryzacji: " + err.message));
});

// Logowanie Google
document.getElementById('btn-google').addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            await setDoc(userRef, {
                uid: user.uid,
                nickname: user.displayName || "Pilot Google",
                avatar: "assets/char-1.png",
                character: "char-1",
                spaceship: "ship-light",
                joinedAt: new Date().toLocaleDateString('pl-PL'),
                isOnline: true
            });
        } else {
            await setUserOnlineStatus(user.uid, true);
        }
        closeAllModals();
    } catch (error) {
        alert("Błąd sieci kosmicznej Google: " + error.message);
    }
});

// Wylogowanie
document.getElementById('btn-logout').addEventListener('click', async () => {
    await setUserOnlineStatus(auth.currentUser?.uid, false);
    signOut(auth);
});

window.addEventListener('beforeunload', () => {
    if (auth.currentUser) {
        setUserOnlineStatus(auth.currentUser.uid, false);
    }
});

// ==========================================
// NASŁUCHIWANIE STANU ZALOGOWANIA I LIVE DANYCH
// ==========================================

onAuthStateChanged(auth, async (user) => {
    const navUnauth = document.getElementById('nav-unauth');
    const navAuth = document.getElementById('nav-auth');

    if (user) {
        navUnauth.classList.add('hidden');
        navAuth.classList.remove('hidden');
        
        await setUserOnlineStatus(user.uid, true);

        const userSnap = await getDoc(doc(db, "users", user.uid));
        currentUserData = userSnap.data();
        
        document.getElementById('nav-nickname').innerText = currentUserData?.nickname || "Pilot";
        document.getElementById('nav-avatar').src = currentUserData?.avatar || "assets/char-1.png";

        startLiveListeners();
    } else {
        navUnauth.classList.remove('hidden');
        navAuth.classList.add('hidden');
        currentUserData = null;
    }
});

let unsubscribeUsers = null;
let unsubscribeChat = null;

function startLiveListeners() {
    if (unsubscribeUsers) unsubscribeUsers();
    if (unsubscribeChat) unsubscribeChat();

    // 1. Renderowanie listy zalogowanych astronautów
    unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
        const usersListDiv = document.getElementById('users-list');
        usersListDiv.innerHTML = "";
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            if(data.isOnline) {
                const userRow = document.createElement('div');
                userRow.style.display = "flex";
                userRow.style.alignItems = "center";
                userRow.style.marginBottom = "10px";
                userRow.innerHTML = `
                    <img src="${data.avatar || 'assets/char-1.png'}" style="width:28px; height:28px; margin-right:12px; image-rendering:pixelated; border: 1px solid var(--accent);">
                    <span style="font-size: 14px;">${data.nickname}</span>
                `;
                usersListDiv.appendChild(userRow);
            }
        });
        
        if(usersListDiv.innerHTML === "") {
            usersListDiv.innerHTML = "<span style='color: var(--text-muted); font-size: 12px;'>Brak innych pilotów.</span>";
        }
    });

    // 2. Kanał komunikacyjny (Czat)
    const chatQuery = query(collection(db, "messages"), orderBy("timestamp", "asc"));
    unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
        const chatBox = document.getElementById('chat-box');
        chatBox.innerHTML = "";
        
        snapshot.forEach((doc) => {
            const msg = doc.data();
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

// Wysyłanie komunikatów na czacie
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
