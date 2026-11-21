import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc, addDoc, onSnapshot, query, orderBy, limit, deleteDoc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAsT89zdpQwALQ0kmYta7mtwCXaj_yJc8Q",
  authDomain: "vuatiengviet-7a1cb.firebaseapp.com",
  projectId: "vuatiengviet-7a1cb",
  storageBucket: "vuatiengviet-7a1cb.firebasestorage.app",
  messagingSenderId: "563648012328",
  appId: "1:563648012328:web:9b6bdc3e45179dd90ed51d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const $ = id => document.getElementById(id), A = $('app');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm = s => String(s).toLowerCase().trim().replace(/[.,!?;:"“”()]/g,'');

let Q = [], i = 0, sc = 0, st = 0, ok = 0, tl = 25, tm = null, name = '', wrong = [], done = false;

// --- CẤU HÌNH CHỤP MÀN HÌNH & GIAN LẬN ---
let isCheating = false;
let displayStream = null;
let isKicked = false;

const CLOUDINARY_CLOUD_NAME = "w7xmgzco"; // ⚠️ ĐIỀN CLOUD NAME CỦA BẠN
const CLOUDINARY_UPLOAD_PRESET = "hocsinh_cheat";

async function initScreenShare() {
  try {
    // Yêu cầu học sinh chia sẻ toàn bộ màn hình
    displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    return true;
  } catch (err) {
    return false;
  }
}

async function captureScreenAndUpload() {
  if (!displayStream || isKicked) return;
  const videoTrack = displayStream.getVideoTracks()[0];
  const imageCapture = new ImageCapture(videoTrack);
  
  try {
    const bitmap = await imageCapture.grabFrame();
    const canvas = document.createElement('canvas');
    canvas.width = 480; // Thu nhỏ để nhẹ
    canvas.height = (480 / bitmap.width) * bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const formData = new FormData();
      formData.append('file', blob);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      
      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.secure_url) {
          await setDoc(doc(db, "active_sessions", window.sessionId), { cheatingImageUrl: data.secure_url, lastUpdate: new Date() }, { merge: true });
        }
      } catch (e) {}
    }, 'image/jpeg', 0.6);
  } catch (err) {}
}

// Lắng nghe sự kiện chuyển tab
document.addEventListener("visibilitychange", async () => {
  if (!window.sessionId || isKicked) return;
  
  if (document.visibilityState === "hidden") {
    isCheating = true;
    await captureScreenAndUpload(); // Chụp ảnh ngay khi chuyển tab
  } else {
    isCheating = false;
  }
  updateProgress();
});

// Gửi tín hiệu offline khi đóng tab
window.addEventListener("beforeunload", () => {
  if (!window.sessionId) return;
  const payload = JSON.stringify({ status: "offline" });
  const url = `https://firestore.googleapis.com/v1/projects/vuatiengviet-7a1cb/databases/(default)/documents/active_sessions/${window.sessionId}?updateMask.fieldPaths=status`;
  navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
});

// Lắng nghe lệnh Kick từ Giáo viên
function listenForKick() {
  onSnapshot(doc(db, "active_sessions", window.sessionId), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.kicked === true && !isKicked) {
        isKicked = true;
        clearInterval(tm);
        A.innerHTML = `
          <div class="c ctr" style="border-color:var(--bad); background:#ffebee; margin-top:50px;">
            <h1 style="color:var(--bad); font-size:2rem;">🚫 BẠN ĐÃ BỊ ĐUỔI</h1>
            <p style="font-size:1.2rem;">Giáo viên đã kết thúc phiên làm bài của bạn do vi phạm.</p>
            <p style="font-weight:bold; color:var(--bad);">Trình duyệt sẽ tự động đóng sau <span id="kick-timer">9</span> giây...</p>
          </div>`;
        
        let kickTime = 9;
        setInterval(() => {
          kickTime--;
          if ($('kick-timer')) $('kick-timer').textContent = kickTime;
          if (kickTime <= 0) {
            window.close(); // Cố gắng đóng tab
            window.location.href = "about:blank"; // Nếu không đóng được tab, chuyển sang trang trắng
          }
        }, 1000);
      }
    }
  });
}
// --- KẾT THÚC CẤU HÌNH ---

async function updateProgress() {
  if (!window.sessionId || isKicked) return;
  try {
    await setDoc(doc(db, "active_sessions", window.sessionId), {
      studentName: name, currentQuestionIndex: i + 1, totalQuestions: Q.length,
      score: sc, lastUpdate: new Date(), status: "playing", cheating: isCheating
    }, { merge: true });
  } catch (e) {}
}

// ... (Hàm saveScore, home, show, ans giữ nguyên như cũ) ...

async function go(n) {
  name = $('nm').value.trim() || 'Học sinh';
  A.innerHTML = `<div class="c ctr"><h2 style="color:var(--pri)">⏳ Đang kiểm tra màn hình...</h2><p>Vui lòng chọn <b>"Chia sẻ toàn bộ màn hình"</b> và bấm Cho phép để tiếp tục.</p></div>`;
  
  const screenOK = await initScreenShare();
  if (!screenOK) {
    A.innerHTML = `<div class="c ctr" style="border-color:var(--bad); background:#ffebee;">
        <h2 style="color:var(--bad)">🚫 TỪ CHỐI CHIA SẺ MÀN HÌNH</h2>
        <p>Hệ thống yêu cầu chia sẻ màn hình để đảm bảo tính công bằng. Bạn không thể làm bài.</p>
        <button class="b" onclick="location.reload()">🔄 Thử lại</button>
      </div>`;
    return;
  }

  window.sessionId = "s_" + Date.now();
  isCheating = false;
  isKicked = false;
  Q = [...QUIZ_DATA].sort(() => Math.random() - 0.5).slice(0, Math.min(n, QUIZ_DATA.length));
  i = 0; sc = 0; st = 0; ok = 0; wrong = [];
  
  listenForKick(); // Bắt đầu lắng nghe lệnh Kick
  show();
}
