// ==========================================
// CONFIGURATION
// ==========================================
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz3emiy06lay_rPnWqHCgfSpm5-0K_CS_5gXdOJDABQ0wwlzelc66mwpqJBtM7_VLw9/exec";

// ==========================================
// STATE
// ==========================================
let base64Image = "";
let imageMimeType = "";
let imageName = "";
let mediaStream = null;
let completedSteps = new Set();
let completedLvSteps = new Set();

// KKS Info
let kksType = "MV"; // "MV" | "LV"
let kksData = {};

// GPS
let gpsCoords = null;
let gpsWatchId = null;

// ==========================================
// 1. INIT
// ==========================================
document.addEventListener("DOMContentLoaded", function () {
  const urlParams = new URLSearchParams(window.location.search);
  const tab = parseInt(urlParams.get('tab')) || 2;
  const kks = urlParams.get('kks') || "MMP-T14BBA01GH001";
  document.getElementById("kksCode").value = kks;

  fetchKksData(kks);
  loadEmailList();
  updateClock();
  setInterval(updateClock, 1000);
  requestGPS();
  switchTab(tab);
});

function updateClock() {
  const now = new Date();
  const el = document.getElementById('liveTime');
  if (el) {
    el.textContent = now.toLocaleTimeString('th-TH', { 
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  }
}

// ==========================================
// 2. FETCH KKS DATA (MV / LV)
// ==========================================
function fetchKksData(kks) {
  fetch(`${GAS_WEB_APP_URL}?action=getKksData&kks=${encodeURIComponent(kks)}`)
    .then(res => res.json())
    .then(data => {
      if (data && data.found) {
        kksType = (data.type || "MV").toUpperCase();
        kksData = data;

        document.getElementById("description").value = data.description || "-";
        document.getElementById("localField").value = data.local || "-";
        document.getElementById("panelField").value = data.panel || "-";
        document.getElementById("rackField").value = data.rack || "-";

        applyKksType(kksType);
      } else {
        kksType = "MV";
        document.getElementById("description").value = "ไม่พบข้อมูลในระบบ";
        applyKksType("MV");
      }
    })
    .catch(() => {
      kksType = "MV";
      document.getElementById("description").value = "ไม่พบข้อมูลในระบบ";
      applyKksType("MV");
    });
}

function applyKksType(type) {
  const badge = document.getElementById("typeBadge");
  const checklistMV = document.getElementById("checklistMV");
  const checklistLV = document.getElementById("checklistLV");

  if (type === "LV") {
    badge.textContent = "LV";
    badge.className = "type-badge lv";
    badge.classList.remove("hidden");
    checklistMV.classList.add("hidden");
    checklistLV.classList.remove("hidden");
    completedSteps.clear();
    updateProgress();
  } else {
    badge.textContent = "MV";
    badge.className = "type-badge mv";
    badge.classList.remove("hidden");
    checklistMV.classList.remove("hidden");
    checklistLV.classList.add("hidden");
    completedLvSteps.clear();
    updateProgress();
  }
  validateChecklistForm();
}

// ==========================================
// 3. TAB SWITCHING
// ==========================================
function switchTab(tabIndex) {
  stopCameraStream();
  [1, 2, 3].forEach(i => {
    const tab = document.getElementById(`tab${i}`);
    const btn = document.getElementById(`btnTab${i}`);
    if (tab) tab.classList.add("hidden");
    if (btn) btn.classList.remove("active");
  });
  const activeTab = document.getElementById(`tab${tabIndex}`);
  const activeBtn = document.getElementById(`btnTab${tabIndex}`);
  if (activeTab) activeTab.classList.remove("hidden");
  if (activeBtn) activeBtn.classList.add("active");
}

// ==========================================
// 4. GPS
// ==========================================
function requestGPS() {
  const box = document.getElementById("gpsBox");
  const text = document.getElementById("gpsText");
  const sub = document.getElementById("gpsSub");

  box.className = "gps-box loading";
  text.textContent = "กำลังดึงพิกัด GPS...";
  sub.textContent = "";

  if (!navigator.geolocation) {
    box.className = "gps-box error";
    text.textContent = "อุปกรณ์นี้ไม่รองรับ GPS";
    sub.textContent = "สามารถบันทึกได้โดยไม่มีพิกัด";
    gpsCoords = null;
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      gpsCoords = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      };
      box.className = "gps-box";
      text.textContent = `📍 ${gpsCoords.lat.toFixed(6)}, ${gpsCoords.lng.toFixed(6)}`;
      sub.textContent = `ความแม่นยำ ±${Math.round(gpsCoords.accuracy)} ม.`;
    },
    (err) => {
      box.className = "gps-box error";
      text.textContent = "ไม่สามารถดึงพิกัดได้";
      sub.textContent = err.message || "กรุณาอนุญาต Location";
      gpsCoords = null;
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

// ==========================================
// 5. CAMERA
// ==========================================
async function startCamera() {
  const video = document.getElementById("cameraVideo");
  const guide = document.getElementById("cameraGuide");
  const placeholder = document.getElementById("cameraPlaceholder");
  const btnStart = document.getElementById("btnStartCamera");
  const btnCapture = document.getElementById("btnCapture");
  const preview = document.getElementById("imagePreview");

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = mediaStream;
    video.classList.remove("hidden");
    guide.classList.remove("hidden");
    placeholder.classList.add("hidden");
    preview.classList.add("hidden");
    btnStart.classList.add("hidden");
    btnCapture.disabled = false;
    btnCapture.className = "btn-primary flex-1 sm:flex-none";
    btnCapture.innerHTML = '<i class="fa-solid fa-camera"></i> ถ่ายภาพ';
    showToast("เปิดกล้องสำเร็จ", "success");
  } catch (err) {
    showToast("ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้งานกล้อง", "error");
    console.error("Camera Error:", err);
  }
}

function capturePhoto() {
  const video = document.getElementById("cameraVideo");
  const canvas = document.getElementById("cameraCanvas");
  const preview = document.getElementById("imagePreview");
  const guide = document.getElementById("cameraGuide");
  const btnCapture = document.getElementById("btnCapture");
  const btnRetake = document.getElementById("btnRetake");
  const photoStatus = document.getElementById("photoStatus");

  const context = canvas.getContext("2d");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  base64Image = dataUrl.split(",")[1];
  imageMimeType = "image/jpeg";
  imageName = `inspection_${Date.now()}.jpg`;

  preview.src = dataUrl;
  preview.classList.remove("hidden");
  video.classList.add("hidden");
  guide.classList.add("hidden");
  stopCameraStream();

  btnCapture.classList.add("hidden");
  btnRetake.classList.remove("hidden");
  photoStatus.classList.remove("hidden");
  photoStatus.innerHTML = '<i class="fa-regular fa-circle-check text-emerald-500 mr-1"></i> ถ่ายภาพเรียบร้อย';

  showToast("ถ่ายภาพสำเร็จ", "success");
  validateChecklistForm();
}

function retakePhoto() {
  base64Image = "";
  imageMimeType = "";
  imageName = "";
  document.getElementById("btnRetake").classList.add("hidden");
  document.getElementById("btnCapture").classList.remove("hidden");
  document.getElementById("btnStartCamera").classList.remove("hidden");
  document.getElementById("imagePreview").classList.add("hidden");
  document.getElementById("photoStatus").classList.add("hidden");
  validateChecklistForm();
  startCamera();
}

function stopCameraStream() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
}

// ==========================================
// 6. CHECKLIST - MV (8 items) — with Skip Support
// ==========================================
const MV_CHECKBOX_LIST = [
  "chk_ptw", "chk_ppe", "chk_led", "chk_selector",
  "chk_release", "chk_rackout", "chk_ground", "chk_loto"
];

function onStepCheck(stepNumber) {
  const currentChk = document.getElementById(MV_CHECKBOX_LIST[stepNumber - 1]);
  const item = currentChk.closest('.checklist-item');

  if (currentChk.checked) {
    completedSteps.add(stepNumber);
    item.classList.add('done');
    item.classList.remove('skipped');
    
    // ถ้าติ๊กข้อ 7 → ซ่อน skip checkbox (เพราะเลือกแล้วว่ามี Ground Switch)
    if (stepNumber === 7) {
      const skipWrapper = document.getElementById('skipGroundWrapper');
      if (skipWrapper) {
        skipWrapper.classList.add('hidden');
        const skipChk = document.getElementById('chk_ground_skip');
        if (skipChk) skipChk.checked = false;
      }
    }
    
    // ปลดล็อกข้อถัดไป
    if (stepNumber < MV_CHECKBOX_LIST.length) {
      unlockStep(stepNumber + 1);
    }
  } else {
    completedSteps.delete(stepNumber);
    item.classList.remove('done');
    
    // ถ้ายกเลิกติ๊กข้อ 7 → แสดง skip checkbox
    if (stepNumber === 7) {
      const skipWrapper = document.getElementById('skipGroundWrapper');
      if (skipWrapper) skipWrapper.classList.remove('hidden');
    }
    
    // ล็อกข้อถัดไปทั้งหมด
    lockFromStep(stepNumber + 1);
  }

  updateProgress();
  validateChecklistForm();
}

// ==========================================
// 6.1 Ground Switch Skip Logic
// ==========================================
function onGroundSkipChange() {
  const skipChk = document.getElementById("chk_ground_skip");
  const groundChk = document.getElementById("chk_ground");
  const item7 = groundChk.closest('.checklist-item');
  
  if (skipChk.checked) {
    // เลือกข้าม → mark as skipped, ปลดล็อกข้อ 8
    groundChk.checked = false;
    groundChk.disabled = true;
    item7.classList.remove('done');
    item7.classList.add('skipped');
    
    completedSteps.add(7); // นับเป็น complete (skip)
    
    unlockStep(8);
    
    showToast("ข้ามข้อ 7 — Ground Switch", "info");
  } else {
    // ยกเลิกข้าม → กลับมาให้ติ๊กข้อ 7 ได้
    groundChk.disabled = false;
    item7.classList.remove('skipped');
    completedSteps.delete(7);
    
    // ถ้าข้อ 8 ติ๊กอยู่ ให้ uncheck และ lock
    const chk8 = document.getElementById("chk_loto");
    if (chk8 && chk8.checked) {
      chk8.checked = false;
      completedSteps.delete(8);
      chk8.closest('.checklist-item').classList.remove('done');
    }
    lockFromStep(8);
  }
  
  updateProgress();
  validateChecklistForm();
}

// ปลดล็อกข้อที่กำหนด
function unlockStep(stepNumber) {
  if (stepNumber > MV_CHECKBOX_LIST.length) return;
  const nextChk = document.getElementById(MV_CHECKBOX_LIST[stepNumber - 1]);
  const nextItem = nextChk.closest('.checklist-item');
  nextChk.disabled = false;
  nextItem.classList.remove('disabled');
  nextItem.querySelector('label').classList.remove('cursor-not-allowed');
  
  // ถ้าเป็นข้อ 7 → แสดง skip checkbox
  if (stepNumber === 7) {
    const skipWrapper = document.getElementById('skipGroundWrapper');
    if (skipWrapper) skipWrapper.classList.remove('hidden');
  }
}

// ล็อกจากข้อที่กำหนด
function lockFromStep(stepNumber) {
  for (let i = stepNumber - 1; i < MV_CHECKBOX_LIST.length; i++) {
    const target = document.getElementById(MV_CHECKBOX_LIST[i]);
    const targetItem = target.closest('.checklist-item');
    target.checked = false;
    target.disabled = true;
    targetItem.classList.add('disabled');
    targetItem.classList.remove('done');
    targetItem.classList.remove('skipped');
    targetItem.querySelector('label').classList.add('cursor-not-allowed');
    completedSteps.delete(i + 1);
  }
  
  // ซ่อน skip wrapper ถ้า lock กลับมาถึงข้อ 7 หรือต่ำกว่า
  if (stepNumber <= 7) {
    const skipWrapper = document.getElementById('skipGroundWrapper');
    if (skipWrapper) {
      skipWrapper.classList.add('hidden');
      const skipChk = document.getElementById('chk_ground_skip');
      if (skipChk) skipChk.checked = false;
    }
  }
}

// ==========================================
// 7. CHECKLIST - LV (3 items)
// ==========================================
const LV_CHECKBOX_LIST = ["chk_lv_breaker", "chk_lv_rackout", "chk_lv_ppe"];

function onLvStepCheck(stepNumber) {
  const currentChk = document.getElementById(LV_CHECKBOX_LIST[stepNumber - 1]);
  const item = currentChk.closest('.checklist-item');

  if (currentChk.checked) {
    completedLvSteps.add(stepNumber);
    item.classList.add('done');
    if (stepNumber < LV_CHECKBOX_LIST.length) {
      const nextChk = document.getElementById(LV_CHECKBOX_LIST[stepNumber]);
      const nextItem = nextChk.closest('.checklist-item');
      nextChk.disabled = false;
      nextItem.classList.remove('disabled');
      nextItem.querySelector('label').classList.remove('cursor-not-allowed');
    }
  } else {
    completedLvSteps.delete(stepNumber);
    item.classList.remove('done');
    for (let i = stepNumber; i < LV_CHECKBOX_LIST.length; i++) {
      const target = document.getElementById(LV_CHECKBOX_LIST[i]);
      const targetItem = target.closest('.checklist-item');
      target.checked = false;
      target.disabled = true;
      targetItem.classList.add('disabled');
      targetItem.classList.remove('done');
      targetItem.querySelector('label').classList.add('cursor-not-allowed');
      completedLvSteps.delete(i + 1);
    }
  }
  updateProgress();
  validateChecklistForm();
}

// ==========================================
// 8. PROGRESS
// ==========================================
function updateProgress() {
  const total = kksType === "LV" ? 3 : 8;
  const count = kksType === "LV" ? completedLvSteps.size : completedSteps.size;
  document.getElementById('progressText').textContent = `${count}/${total}`;
  document.getElementById('progressFill').style.width = `${(count / total) * 100}%`;
}

// ==========================================
// 9. VALIDATION
// ==========================================
function validateChecklistForm() {
  const operatorId = document.getElementById("operatorId").value.trim();
  const hasPhoto = base64Image !== "";
  const btnSubmit = document.getElementById("btnSubmit");

  let allRequiredChecked = false;
  let requiredCount = 0;

  if (kksType === "LV") {
    const required = ["chk_lv_breaker", "chk_lv_rackout", "chk_lv_ppe"];
    allRequiredChecked = required.every(id => document.getElementById(id).checked);
    requiredCount = 3;
  } else {
    // ⭐ MV: ข้อ 7 ไม่บังคับ → เช็ค 7 ข้อ (1-6, 8)
    const required = [
      "chk_ptw", "chk_ppe", "chk_led", "chk_selector",
      "chk_release", "chk_rackout", "chk_loto"
    ];
    allRequiredChecked = required.every(id => document.getElementById(id).checked);
    requiredCount = 7;
  }

  if (operatorId && allRequiredChecked && hasPhoto) {
    btnSubmit.disabled = false;
    btnSubmit.className = "w-full py-3 sm:py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-sm text-sm sm:text-base";
    btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane mr-2"></i> ส่งรายงานการตรวจสอบ';
  } else {
    btnSubmit.disabled = true;
    btnSubmit.className = "w-full py-3 sm:py-3.5 bg-slate-200 text-slate-500 font-bold rounded-xl cursor-not-allowed transition text-sm sm:text-base";
    let msg = "กรุณา";
    if (!operatorId) msg += " กรอกรหัสผู้ปฏิบัติงาน,";
    if (!allRequiredChecked) msg += ` ติ๊ก Checklist ให้ครบ ${requiredCount} ข้อ,`;
    if (!hasPhoto) msg += " ถ่ายภาพหน้าตู้,";
    btnSubmit.innerHTML = `<i class="fa-regular fa-circle-check mr-2"></i> ${msg.slice(0, -1)}`;
  }
}

// ==========================================
// 10. SUBMIT
// ==========================================
function submitInspection() {
  const btnSubmit = document.getElementById("btnSubmit");
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> กำลังบันทึก...';
  btnSubmit.className = "w-full py-3 sm:py-3.5 bg-blue-600 text-white font-bold rounded-xl transition text-sm sm:text-base";

  const groundSkipChk = document.getElementById("chk_ground_skip");
  
  const payload = {
    action: "submitInspection",
    kksType: kksType,
    kksCode: document.getElementById("kksCode").value,
    description: document.getElementById("description").value,
    local: document.getElementById("localField").value,
    panel: document.getElementById("panelField").value,
    rack: document.getElementById("rackField").value,
    operatorId: document.getElementById("operatorId").value,
    imageBase64: base64Image,
    imageMimeType: imageMimeType,
    imageName: imageName,
    gps: gpsCoords ? {
      lat: gpsCoords.lat,
      lng: gpsCoords.lng,
      accuracy: gpsCoords.accuracy
    } : null,
    checklist: kksType === "LV" ? {
      chk_lv_breaker: document.getElementById("chk_lv_breaker").checked,
      chk_lv_rackout: document.getElementById("chk_lv_rackout").checked,
      chk_lv_ppe: document.getElementById("chk_lv_ppe").checked
    } : {
      chk_ptw: document.getElementById("chk_ptw").checked,
      chk_ppe: document.getElementById("chk_ppe").checked,
      chk_led: document.getElementById("chk_led").checked,
      chk_selector: document.getElementById("chk_selector").checked,
      chk_release: document.getElementById("chk_release").checked,
      chk_rackout: document.getElementById("chk_rackout").checked,
      chk_ground: document.getElementById("chk_ground").checked,
      chk_ground_skip: groundSkipChk ? groundSkipChk.checked : false,  // ⭐ ส่ง skip flag
      chk_loto: document.getElementById("chk_loto").checked
    }
  };

  fetch(GAS_WEB_APP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(() => {
      showToast("✅ บันทึกข้อมูลสำเร็จ! กำลังส่งการแจ้งเตือน", "success");
      btnSubmit.innerHTML = '<i class="fa-regular fa-circle-check mr-2"></i> ส่งข้อมูลสำเร็จ!';
      btnSubmit.className = "w-full py-3 sm:py-3.5 bg-emerald-600 text-white font-bold rounded-xl transition text-sm sm:text-base";
      setTimeout(() => location.reload(), 3000);
    })
    .catch(err => {
      showToast("❌ เกิดข้อผิดพลาด: " + err.message, "error");
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane mr-2"></i> ส่งรายงานการตรวจสอบ';
      btnSubmit.className = "w-full py-3 sm:py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-sm text-sm sm:text-base";
    });
}

// ==========================================
// 11. EMAIL MANAGEMENT
// ==========================================
function resetEmailActionState() {
  document.getElementById("emailResultBox").classList.add("hidden");
}

function checkEmailState() {
  const email = document.getElementById("emailInput").value.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    showToast("กรุณากรอก Email ให้ถูกต้อง", "warning");
    return;
  }
  fetch(`${GAS_WEB_APP_URL}?action=checkEmail&email=${encodeURIComponent(email)}`)
    .then(res => res.json())
    .then(data => {
      const box = document.getElementById("emailResultBox");
      const text = document.getElementById("emailStatusText");
      const sub = document.getElementById("emailStatusSub");
      const icon = document.getElementById("emailStatusIcon");
      const btnAdd = document.getElementById("btnAddEmail");
      const btnDelete = document.getElementById("btnDeleteEmail");
      box.classList.remove("hidden");
      if (data.exists) {
        box.className = "p-3 sm:p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-3";
        icon.textContent = "✅";
        text.className = "text-sm font-semibold text-amber-800 break-all";
        text.innerText = `📧 ${email} อยู่ในระบบแล้ว`;
        sub.innerText = "Email นี้รับการแจ้งเตือนอยู่แล้ว";
        btnAdd.classList.add("hidden");
        btnDelete.classList.remove("hidden");
      } else {
        box.className = "p-3 sm:p-4 rounded-xl border border-blue-200 bg-blue-50 space-y-3";
        icon.textContent = "📧";
        text.className = "text-sm font-semibold text-blue-800 break-all";
        text.innerText = `📧 ${email} ยังไม่ได้ลงทะเบียน`;
        sub.innerText = "คุณสามารถเพิ่ม Email นี้เพื่อรับการแจ้งเตือน";
        btnAdd.classList.remove("hidden");
        btnDelete.classList.add("hidden");
      }
    })
    .catch(() => showToast("เกิดข้อผิดพลาดในการตรวจสอบ", "error"));
}

function executeAddEmail() {
  const email = document.getElementById("emailInput").value.trim().toLowerCase();
  fetch(GAS_WEB_APP_URL, {
    method: "POST", mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "addEmail", email: email })
  })
    .then(() => {
      showToast(`✅ เพิ่ม ${email} เรียบร้อย`, "success");
      resetEmailActionState();
      document.getElementById("emailInput").value = "";
      loadEmailList();
    })
    .catch(() => showToast("เกิดข้อผิดพลาดในการเพิ่ม Email", "error"));
}

function confirmDeleteEmail() {
  const email = document.getElementById("emailInput").value.trim().toLowerCase();
  if (confirm(`คุณแน่ใจหรือว่าต้องการลบ Email "${email}" ออกจากระบบรับแจ้งเตือน?`)) {
    fetch(GAS_WEB_APP_URL, {
      method: "POST", mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteEmail", email: email })
    })
      .then(() => {
        showToast(`🗑️ ลบ ${email} เรียบร้อย`, "info");
        resetEmailActionState();
        document.getElementById("emailInput").value = "";
        loadEmailList();
      })
      .catch(() => showToast("เกิดข้อผิดพลาดในการลบ Email", "error"));
  }
}

function loadEmailList() {
  fetch(`${GAS_WEB_APP_URL}?action=getAllEmails`)
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById("emailList");
      if (data.emails && data.emails.length > 0) {
        container.innerHTML = data.emails.map((email, index) => `
          <div class="flex items-center justify-between p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span class="text-xs sm:text-sm text-slate-700 break-all"><i class="fa-regular fa-circle-check text-emerald-500 mr-2"></i> ${email}</span>
            <span class="text-[10px] sm:text-xs ${index === 0 ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'} px-2 py-0.5 rounded-full flex-shrink-0 ml-2">${index === 0 ? 'หลัก' : 'สำรอง'}</span>
          </div>
        `).join('');
      } else {
        container.innerHTML = `<div class="text-center text-slate-400 py-4 text-xs sm:text-sm">ยังไม่มี Email ในระบบ</div>`;
      }
    })
    .catch(() => {
      document.getElementById("emailList").innerHTML = `<div class="text-center text-red-400 py-4 text-xs sm:text-sm">ไม่สามารถโหลดข้อมูลได้</div>`;
    });
}

// ==========================================
// 12. TOAST
// ==========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  const icons = { success: '✅ ', error: '❌ ', warning: '⚠️ ', info: 'ℹ️ ' };
  toast.className = `toast ${type}`;
  toast.textContent = (icons[type] || '') + message;
  container.appendChild(toast);
  void toast.offsetWidth;
  setTimeout(() => toast.classList.add('show'), 50);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ==========================================
// 13. INIT
// ==========================================
updateProgress();
validateChecklistForm();

window.addEventListener('beforeunload', function() {
  if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
});

console.log('🔌 Breaker Safety Inspection v3.1 (MV + LV + GPS + Skip)');