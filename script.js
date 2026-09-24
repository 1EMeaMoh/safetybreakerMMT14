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

let base64ImageMT = "";
let imageMimeTypeMT = "";
let imageNameMT = "";
let mediaStreamMT = null;
let completedMtSteps = new Set();
let completedMtLvSteps = new Set();

let kksType = "MV";
let kksData = {};

let gpsCoords = null;
let gpsCoordsMT = null;

// ==========================================
// 1. INIT
// ==========================================
document.addEventListener("DOMContentLoaded", function () {
  const urlParams = new URLSearchParams(window.location.search);
  const tab = parseInt(urlParams.get('tab')) || 2;
  const kks = urlParams.get('kks') || "MMP-T14BBA01GH001";
  
  document.getElementById("kksCode").value = kks;
  document.getElementById("kksCodeMT").value = kks;

  fetchKksData(kks);
  loadEmailList();
  updateClock();
  setInterval(updateClock, 1000);
  requestGPS();
  requestGPSMT();
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
// 2. FETCH KKS DATA
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

        document.getElementById("descriptionMT").value = data.description || "-";
        document.getElementById("localFieldMT").value = data.local || "-";
        document.getElementById("panelFieldMT").value = data.panel || "-";
        document.getElementById("rackFieldMT").value = data.rack || "-";

        applyKksType(kksType);
      } else {
        kksType = "MV";
        document.getElementById("description").value = "ไม่พบข้อมูลในระบบ";
        document.getElementById("descriptionMT").value = "ไม่พบข้อมูลในระบบ";
        applyKksType("MV");
      }
    })
    .catch(() => {
      kksType = "MV";
      document.getElementById("description").value = "ไม่พบข้อมูลในระบบ";
      document.getElementById("descriptionMT").value = "ไม่พบข้อมูลในระบบ";
      applyKksType("MV");
    });
}

function applyKksType(type) {
  const badge = document.getElementById("typeBadge");
  const checklistMV = document.getElementById("checklistMV");
  const checklistLV = document.getElementById("checklistLV");
  
  const badgeMT = document.getElementById("typeBadgeMT");
  const checklistMT_MV = document.getElementById("checklistMT_MV");
  const checklistMT_LV = document.getElementById("checklistMT_LV");

  if (type === "LV") {
    badge.textContent = "LV";
    badge.className = "type-badge lv";
    badge.classList.remove("hidden");
    checklistMV.classList.add("hidden");
    checklistLV.classList.remove("hidden");
    completedSteps.clear();
    updateProgress();
    
    badgeMT.textContent = "LV";
    badgeMT.className = "type-badge lv";
    badgeMT.classList.remove("hidden");
    checklistMT_MV.classList.add("hidden");
    checklistMT_LV.classList.remove("hidden");
    completedMtSteps.clear();
    updateProgressMT();
    
  } else {
    badge.textContent = "MV";
    badge.className = "type-badge mv";
    badge.classList.remove("hidden");
    checklistMV.classList.remove("hidden");
    checklistLV.classList.add("hidden");
    completedLvSteps.clear();
    updateProgress();
    
    badgeMT.textContent = "MV";
    badgeMT.className = "type-badge mv";
    badgeMT.classList.remove("hidden");
    checklistMT_MV.classList.remove("hidden");
    checklistMT_LV.classList.add("hidden");
    completedMtLvSteps.clear();
    updateProgressMT();
  }
  
  validateChecklistForm();
  validateMaintenanceForm();
}

// ==========================================
// 3. TAB SWITCHING (4 Tabs)
// ==========================================
function switchTab(tabIndex) {
  stopCameraStream();
  stopCameraStreamMT();
  
  [1, 2, 3, 4].forEach(i => {
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

function requestGPSMT() {
  const box = document.getElementById("gpsBoxMT");
  const text = document.getElementById("gpsTextMT");
  const sub = document.getElementById("gpsSubMT");

  box.className = "gps-box loading";
  text.textContent = "กำลังดึงพิกัด GPS...";
  sub.textContent = "";

  if (!navigator.geolocation) {
    box.className = "gps-box error";
    text.textContent = "อุปกรณ์นี้ไม่รองรับ GPS";
    gpsCoordsMT = null;
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      gpsCoordsMT = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      };
      box.className = "gps-box";
      text.textContent = `📍 ${gpsCoordsMT.lat.toFixed(6)}, ${gpsCoordsMT.lng.toFixed(6)}`;
      sub.textContent = `ความแม่นยำ ±${Math.round(gpsCoordsMT.accuracy)} ม.`;
    },
    (err) => {
      box.className = "gps-box error";
      text.textContent = "ไม่สามารถดึงพิกัดได้";
      sub.textContent = err.message || "กรุณาอนุญาต Location";
      gpsCoordsMT = null;
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

// ==========================================
// 5. CAMERA — OPERATOR
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
    showToast("ไม่สามารถเข้าถึงกล้องได้", "error");
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
  imageName = `operator_${Date.now()}.jpg`;

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
// 6. CAMERA — MAINTENANCE
// ==========================================
async function startCameraMT() {
  const video = document.getElementById("cameraVideoMT");
  const guide = document.getElementById("cameraGuideMT");
  const placeholder = document.getElementById("cameraPlaceholderMT");
  const btnStart = document.getElementById("btnStartCameraMT");
  const btnCapture = document.getElementById("btnCaptureMT");
  const preview = document.getElementById("imagePreviewMT");

  try {
    mediaStreamMT = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = mediaStreamMT;
    video.classList.remove("hidden");
    guide.classList.remove("hidden");
    placeholder.classList.add("hidden");
    preview.classList.add("hidden");
    btnStart.classList.add("hidden");
    btnCapture.disabled = false;
    btnCapture.className = "btn-warning flex-1 sm:flex-none";
    btnCapture.innerHTML = '<i class="fa-solid fa-camera"></i> ถ่ายภาพ';
    showToast("เปิดกล้องสำเร็จ", "success");
  } catch (err) {
    showToast("ไม่สามารถเข้าถึงกล้องได้", "error");
  }
}

function capturePhotoMT() {
  const video = document.getElementById("cameraVideoMT");
  const canvas = document.getElementById("cameraCanvasMT");
  const preview = document.getElementById("imagePreviewMT");
  const guide = document.getElementById("cameraGuideMT");
  const btnCapture = document.getElementById("btnCaptureMT");
  const btnRetake = document.getElementById("btnRetakeMT");
  const photoStatus = document.getElementById("photoStatusMT");

  const context = canvas.getContext("2d");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  base64ImageMT = dataUrl.split(",")[1];
  imageMimeTypeMT = "image/jpeg";
  imageNameMT = `maintenance_${Date.now()}.jpg`;

  preview.src = dataUrl;
  preview.classList.remove("hidden");
  video.classList.add("hidden");
  guide.classList.add("hidden");
  stopCameraStreamMT();

  btnCapture.classList.add("hidden");
  btnRetake.classList.remove("hidden");
  photoStatus.classList.remove("hidden");
  photoStatus.innerHTML = '<i class="fa-regular fa-circle-check text-amber-500 mr-1"></i> ถ่ายภาพเรียบร้อย';

  showToast("ถ่ายภาพสำเร็จ", "success");
  validateMaintenanceForm();
}

function retakePhotoMT() {
  base64ImageMT = "";
  imageMimeTypeMT = "";
  imageNameMT = "";
  document.getElementById("btnRetakeMT").classList.add("hidden");
  document.getElementById("btnCaptureMT").classList.remove("hidden");
  document.getElementById("btnStartCameraMT").classList.remove("hidden");
  document.getElementById("imagePreviewMT").classList.add("hidden");
  document.getElementById("photoStatusMT").classList.add("hidden");
  validateMaintenanceForm();
  startCameraMT();
}

function stopCameraStreamMT() {
  if (mediaStreamMT) {
    mediaStreamMT.getTracks().forEach(track => track.stop());
    mediaStreamMT = null;
  }
}

// ==========================================
// 7. CHECKLIST — OPERATOR (MV) — บังคับ 8 ข้อ
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
    
    if (stepNumber < MV_CHECKBOX_LIST.length) {
      unlockStep(stepNumber + 1);
    }
  } else {
    completedSteps.delete(stepNumber);
    item.classList.remove('done');
    
    lockFromStep(stepNumber + 1);
  }

  updateProgress();
  validateChecklistForm();
}

function unlockStep(stepNumber) {
  if (stepNumber > MV_CHECKBOX_LIST.length) return;
  const nextChk = document.getElementById(MV_CHECKBOX_LIST[stepNumber - 1]);
  const nextItem = nextChk.closest('.checklist-item');
  nextChk.disabled = false;
  nextItem.classList.remove('disabled');
  nextItem.querySelector('label').classList.remove('cursor-not-allowed');
}

function lockFromStep(stepNumber) {
  for (let i = stepNumber - 1; i < MV_CHECKBOX_LIST.length; i++) {
    const target = document.getElementById(MV_CHECKBOX_LIST[i]);
    const targetItem = target.closest('.checklist-item');
    target.checked = false;
    target.disabled = true;
    targetItem.classList.add('disabled');
    targetItem.classList.remove('done');
    targetItem.querySelector('label').classList.add('cursor-not-allowed');
    completedSteps.delete(i + 1);
  }
}

// ==========================================
// 8. CHECKLIST — OPERATOR (LV)
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
// 9. CHECKLIST — MAINTENANCE (MV — 8 items)
// ==========================================
const MT_CHECKBOX_LIST = [
  "mt_visual", "mt_ground", "mt_loto", "mt_breaker",
  "mt_voltage", "mt_ppe", "mt_env", "mt_approve"
];

function onMtStepCheck(stepNumber) {
  const currentChk = document.getElementById(MT_CHECKBOX_LIST[stepNumber - 1]);
  const item = currentChk.closest('.checklist-item');

  if (currentChk.checked) {
    completedMtSteps.add(stepNumber);
    item.classList.add('done');
    
    if (stepNumber < MT_CHECKBOX_LIST.length) {
      const nextChk = document.getElementById(MT_CHECKBOX_LIST[stepNumber]);
      const nextItem = nextChk.closest('.checklist-item');
      nextChk.disabled = false;
      nextItem.classList.remove('disabled');
      nextItem.querySelector('label').classList.remove('cursor-not-allowed');
    }
  } else {
    completedMtSteps.delete(stepNumber);
    item.classList.remove('done');
    
    for (let i = stepNumber; i < MT_CHECKBOX_LIST.length; i++) {
      const target = document.getElementById(MT_CHECKBOX_LIST[i]);
      const targetItem = target.closest('.checklist-item');
      target.checked = false;
      target.disabled = true;
      targetItem.classList.add('disabled');
      targetItem.classList.remove('done');
      targetItem.querySelector('label').classList.add('cursor-not-allowed');
      completedMtSteps.delete(i + 1);
    }
  }
  updateProgressMT();
  validateMaintenanceForm();
}

// ==========================================
// 10. CHECKLIST — MAINTENANCE (LV — 3 items)
// ==========================================
const MT_LV_CHECKBOX_LIST = ["mt_lv_breaker", "mt_lv_rackout", "mt_lv_ppe"];

function onMtLvStepCheck(stepNumber) {
  const currentChk = document.getElementById(MT_LV_CHECKBOX_LIST[stepNumber - 1]);
  const item = currentChk.closest('.checklist-item');

  if (currentChk.checked) {
    completedMtLvSteps.add(stepNumber);
    item.classList.add('done');
    
    if (stepNumber < MT_LV_CHECKBOX_LIST.length) {
      const nextChk = document.getElementById(MT_LV_CHECKBOX_LIST[stepNumber]);
      const nextItem = nextChk.closest('.checklist-item');
      nextChk.disabled = false;
      nextItem.classList.remove('disabled');
      nextItem.querySelector('label').classList.remove('cursor-not-allowed');
    }
  } else {
    completedMtLvSteps.delete(stepNumber);
    item.classList.remove('done');
    
    for (let i = stepNumber; i < MT_LV_CHECKBOX_LIST.length; i++) {
      const target = document.getElementById(MT_LV_CHECKBOX_LIST[i]);
      const targetItem = target.closest('.checklist-item');
      target.checked = false;
      target.disabled = true;
      targetItem.classList.add('disabled');
      targetItem.classList.remove('done');
      targetItem.querySelector('label').classList.add('cursor-not-allowed');
      completedMtLvSteps.delete(i + 1);
    }
  }
  updateProgressMT();
  validateMaintenanceForm();
}

// ==========================================
// 11. PROGRESS
// ==========================================
function updateProgress() {
  const total = kksType === "LV" ? 3 : 8;
  const count = kksType === "LV" ? completedLvSteps.size : completedSteps.size;
  document.getElementById('progressText').textContent = `${count}/${total}`;
  document.getElementById('progressFill').style.width = `${(count / total) * 100}%`;
}

function updateProgressMT() {
  const total = kksType === "LV" ? 3 : 8;
  const count = kksType === "LV" ? completedMtLvSteps.size : completedMtSteps.size;
  document.getElementById('progressTextMT').textContent = `${count}/${total}`;
  document.getElementById('progressFillMT').style.width = `${(count / total) * 100}%`;
}

// ==========================================
// 12. VALIDATION
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
    // ⭐ MV: บังคับ 8 ข้อ (รวมข้อ 7)
    const required = [
      "chk_ptw", "chk_ppe", "chk_led", "chk_selector",
      "chk_release", "chk_rackout", "chk_ground", "chk_loto"
    ];
    allRequiredChecked = required.every(id => document.getElementById(id).checked);
    requiredCount = 8;
  }

  if (operatorId && allRequiredChecked && hasPhoto) {
    btnSubmit.disabled = false;
    btnSubmit.className = "w-full py-3 sm:py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-sm text-sm sm:text-base";
    btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane mr-2"></i> ส่งรายงาน OPERATOR';
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

function validateMaintenanceForm() {
  const maintenanceId = document.getElementById("maintenanceId").value.trim();
  const hasPhoto = base64ImageMT !== "";
  const btnApprove = document.getElementById("btnApprove");
  const btnReject = document.getElementById("btnReject");

  let allChecked = false;
  let requiredCount = 0;

  if (kksType === "LV") {
    // ⭐ LV: บังคับ 3 ข้อ
    const required = MT_LV_CHECKBOX_LIST;
    allChecked = required.every(id => document.getElementById(id).checked);
    requiredCount = 3;
  } else {
    // ⭐ MV: บังคับ 8 ข้อ
    const required = MT_CHECKBOX_LIST;
    allChecked = required.every(id => document.getElementById(id).checked);
    requiredCount = 8;
  }

  if (maintenanceId && allChecked && hasPhoto) {
    btnApprove.disabled = false;
    btnApprove.className = "w-full py-3 sm:py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-sm text-sm sm:text-base";
    btnApprove.innerHTML = '<i class="fa-solid fa-circle-check mr-2"></i> อนุมัติให้ปฏิบัติงาน';
    
    btnReject.disabled = false;
    btnReject.className = "w-full py-3 sm:py-3.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition shadow-sm text-sm sm:text-base";
    btnReject.innerHTML = '<i class="fa-solid fa-circle-xmark mr-2"></i> ปฏิเสธ ส่งกลับ';
  } else {
    btnApprove.disabled = true;
    btnApprove.className = "w-full py-3 sm:py-3.5 bg-slate-200 text-slate-500 font-bold rounded-xl cursor-not-allowed transition text-sm sm:text-base";
    let msgA = "กรุณา";
    if (!maintenanceId) msgA += " กรอกรหัสผู้ตรวจสอบ,";
    if (!allChecked) msgA += ` ติ๊ก Recheck ให้ครบ ${requiredCount} ข้อ,`;
    if (!hasPhoto) msgA += " ถ่ายภาพ,";
    btnApprove.innerHTML = `<i class="fa-regular fa-circle-check mr-2"></i> ${msgA.slice(0, -1)}`;
    
    btnReject.disabled = true;
    btnReject.className = "w-full py-3 sm:py-3.5 bg-slate-200 text-slate-500 font-bold rounded-xl cursor-not-allowed transition text-sm sm:text-base";
    btnReject.innerHTML = '<i class="fa-solid fa-circle-xmark mr-2"></i> ปฏิเสธ ส่งกลับ';
  }
}

// ==========================================
// 13. SUBMIT — OPERATOR
// ==========================================
function submitInspection(role) {
  const btnSubmit = document.getElementById("btnSubmit");
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> กำลังบันทึก...';
  btnSubmit.className = "w-full py-3 sm:py-3.5 bg-blue-600 text-white font-bold rounded-xl transition text-sm sm:text-base";
  
  const payload = {
    action: "submitInspection",
    role: "OPERATOR",
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
      showToast("✅ OPERATOR: บันทึกสำเร็จ!", "success");
      btnSubmit.innerHTML = '<i class="fa-regular fa-circle-check mr-2"></i> ส่งข้อมูลสำเร็จ!';
      btnSubmit.className = "w-full py-3 sm:py-3.5 bg-emerald-600 text-white font-bold rounded-xl transition text-sm sm:text-base";
      setTimeout(() => location.reload(), 3000);
    })
    .catch(err => {
      showToast("❌ เกิดข้อผิดพลาด: " + err.message, "error");
      validateChecklistForm();
    });
}

// ==========================================
// 14. SUBMIT — MAINTENANCE
// ==========================================
function submitMaintenance(action) {
  const btnApprove = document.getElementById("btnApprove");
  const btnReject = document.getElementById("btnReject");
  
  const isApprove = action === "APPROVE";
  const resultText = isApprove ? "อนุมัติ" : "ปฏิเสธ";
  const resultColor = isApprove ? "emerald" : "red";
  
  btnApprove.disabled = true;
  btnReject.disabled = true;
  
  const activeBtn = isApprove ? btnApprove : btnReject;
  activeBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> กำลัง${resultText}...`;

  const payload = {
    action: "submitMaintenance",
    role: "MAINTENANCE",
    result: action,
    kksType: kksType,
    kksCode: document.getElementById("kksCodeMT").value,
    description: document.getElementById("descriptionMT").value,
    local: document.getElementById("localFieldMT").value,
    panel: document.getElementById("panelFieldMT").value,
    rack: document.getElementById("rackFieldMT").value,
    maintenanceId: document.getElementById("maintenanceId").value,
    note: document.getElementById("maintenanceNote").value.trim(),
    imageBase64: base64ImageMT,
    imageMimeType: imageMimeTypeMT,
    imageName: imageNameMT,
    gps: gpsCoordsMT ? {
      lat: gpsCoordsMT.lat,
      lng: gpsCoordsMT.lng,
      accuracy: gpsCoordsMT.accuracy
    } : null,
    checklist: kksType === "LV" ? {
      mt_lv_breaker: document.getElementById("mt_lv_breaker").checked,
      mt_lv_rackout: document.getElementById("mt_lv_rackout").checked,
      mt_lv_ppe: document.getElementById("mt_lv_ppe").checked
    } : {
      mt_visual: document.getElementById("mt_visual").checked,
      mt_ground: document.getElementById("mt_ground").checked,
      mt_loto: document.getElementById("mt_loto").checked,
      mt_breaker: document.getElementById("mt_breaker").checked,
      mt_voltage: document.getElementById("mt_voltage").checked,
      mt_ppe: document.getElementById("mt_ppe").checked,
      mt_env: document.getElementById("mt_env").checked,
      mt_approve: document.getElementById("mt_approve").checked
    }
  };

  fetch(GAS_WEB_APP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(() => {
      const icon = isApprove ? "✅" : "❌";
      showToast(`${icon} MAINTENANCE: ${resultText}สำเร็จ!`, isApprove ? "success" : "warning");
      activeBtn.innerHTML = `<i class="fa-regular fa-circle-check mr-2"></i> ${resultText}สำเร็จ!`;
      activeBtn.className = `w-full py-3 sm:py-3.5 bg-${resultColor}-600 text-white font-bold rounded-xl transition text-sm sm:text-base`;
      setTimeout(() => location.reload(), 3000);
    })
    .catch(err => {
      showToast("❌ เกิดข้อผิดพลาด: " + err.message, "error");
      validateMaintenanceForm();
    });
}

// ==========================================
// 15. EMAIL MANAGEMENT
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
  if (confirm(`คุณแน่ใจหรือว่าต้องการลบ Email "${email}"?`)) {
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
// 16. TOAST
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
// 17. INIT
// ==========================================
updateProgress();
updateProgressMT();
validateChecklistForm();
validateMaintenanceForm();

window.addEventListener('beforeunload', function() {
  if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
  if (mediaStreamMT) mediaStreamMT.getTracks().forEach(track => track.stop());
});

console.log('🔌 Breaker Safety Inspection v3.3 (MT LV + Force Ground)');
