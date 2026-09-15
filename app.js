/**
 * AZU Science Portal - Application Core (app.js)
 * Navigation: Branch → Department → Subject → Files
 * No AI, No Semester.
 */

// ─────────────────────────────────────────────────────────────
//  App State
// ─────────────────────────────────────────────────────────────
const AppState = {
  currentRole:      "student", // "student" | "admin"
  currentBranchId:  "boys",
  currentDeptId:    null,      // Drive folder ID of selected dept
  currentDeptName:  "",        // display name
  currentSubjectId: null,      // Drive folder ID of selected subject
  currentSubjectName: "",
  departments:      [],        // [{id, name}]
  subjects:         [],        // [{id, name}]
  files:            []         // [{id, name, url, mimeType}]
};

// ─────────────────────────────────────────────────────────────
//  Init
// ─────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Read branch from URL query param (?branch=girls)
  const params = new URLSearchParams(window.location.search);
  const b = params.get("branch");
  if (b === "boys" || b === "girls") AppState.currentBranchId = b;

  AppState.currentRole = sessionStorage.getItem("azu_user_role") || "student";
  updateRoleUi();

  // Activate correct branch button
  document.querySelectorAll("[data-branch-id]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.branchId === AppState.currentBranchId);
  });

  await loadDepartments();
  bindAppEvents();
});

// ─────────────────────────────────────────────────────────────
//  Role UI
// ─────────────────────────────────────────────────────────────
function updateRoleUi() {
  const badge = document.getElementById("userRoleBadge");
  if (badge) {
    if (AppState.currentRole === "admin") {
      badge.innerHTML = `<span class="badge-dot admin"></span> مسؤول المنصة (Admin)`;
      badge.className = "role-badge badge-admin";
    } else {
      badge.innerHTML = `<span class="badge-dot student"></span> طالب / مستخدم (Student)`;
      badge.className = "role-badge badge-student";
    }
  }
  document.querySelectorAll(".admin-only").forEach(el => {
    el.classList.toggle("hidden", AppState.currentRole !== "admin");
  });
}

// ─────────────────────────────────────────────────────────────
//  STEP 1: Branch Selection
// ─────────────────────────────────────────────────────────────
function selectBranch(branchId) {
  AppState.currentBranchId  = branchId;
  AppState.currentDeptId    = null;
  AppState.currentDeptName  = "";
  AppState.currentSubjectId = null;
  AppState.currentSubjectName = "";
  AppState.departments      = [];
  AppState.subjects         = [];
  AppState.files            = [];

  document.querySelectorAll("[data-branch-id]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.branchId === branchId);
  });

  loadDepartments();
}

// ─────────────────────────────────────────────────────────────
//  STEP 2: Load & Render Departments
// ─────────────────────────────────────────────────────────────
async function loadDepartments() {
  // Reset subjects/files views
  renderSubjectsView([]);
  renderFilesView([]);
  updateBreadcrumb();

  showDeptLoading(true);
  try {
    AppState.departments = await window.gasClient.getDepartments(AppState.currentBranchId);
  } catch (e) {
    AppState.departments = [];
  }
  showDeptLoading(false);

  renderDepartmentTabs();
}

function showDeptLoading(on) {
  const el = document.getElementById("departmentTabsContainer");
  if (!el) return;
  if (on) el.innerHTML = `<span class="loading-text">جاري تحميل الأقسام...</span>`;
}

function renderDepartmentTabs() {
  const container = document.getElementById("departmentTabsContainer");
  if (!container) return;

  if (AppState.departments.length === 0) {
    container.innerHTML = `<span class="empty-inline-text">لا توجد أقسام في هذا الفرع حالياً.</span>`;
    return;
  }

  container.innerHTML = AppState.departments.map(dept => `
    <button
      class="dept-tab-btn ${dept.id === AppState.currentDeptId ? 'active' : ''}"
      onclick="selectDepartment('${dept.id}', '${escapeHtml(dept.name)}')"
    >${escapeHtml(dept.name)}</button>
  `).join("");
}

function selectDepartment(deptId, deptName) {
  AppState.currentDeptId    = deptId;
  AppState.currentDeptName  = deptName;
  AppState.currentSubjectId = null;
  AppState.currentSubjectName = "";
  AppState.subjects         = [];
  AppState.files            = [];

  renderDepartmentTabs();   // update active tab
  renderFilesView([]);      // clear files
  updateBreadcrumb();

  loadSubjects(deptId);
}

// ─────────────────────────────────────────────────────────────
//  STEP 3: Load & Render Subjects
// ─────────────────────────────────────────────────────────────
async function loadSubjects(deptFolderId) {
  renderSubjectsView(null); // show loading

  try {
    AppState.subjects = await window.gasClient.getSubjects(AppState.currentBranchId, deptFolderId);
  } catch (e) {
    AppState.subjects = [];
  }

  renderSubjectsView(AppState.subjects);
}

function renderSubjectsView(subjects) {
  const container = document.getElementById("subjectsListContainer");
  if (!container) return;

  if (subjects === null) {
    // loading state
    container.innerHTML = `<div class="loading-block">جاري تحميل المواد...</div>`;
    return;
  }

  if (!AppState.currentDeptId) {
    container.innerHTML = `<div class="empty-subjects-state"><h3>اختر قسماً لعرض المواد الدراسية</h3></div>`;
    return;
  }

  if (subjects.length === 0) {
    const isAdmin = AppState.currentRole === "admin";
    container.innerHTML = `
      <div class="empty-subjects-state">
        <h3>لا توجد مواد مضافة في هذا القسم حالياً</h3>
        <p>يتم جلب وعرض المواد الموجودة على Google Drive تلقائياً.</p>
        ${isAdmin ? `<div style="margin-top:16px;"><button class="btn-primary-sketch" onclick="openUploadModal()">رفع ملفات جديدة</button></div>` : ""}
      </div>
    `;
    return;
  }

  const isAdmin = AppState.currentRole === "admin";

  container.innerHTML = `
    <div class="subjects-grid">
      ${subjects.map(sub => `
        <button
          class="subject-card-btn ${sub.id === AppState.currentSubjectId ? 'active' : ''}"
          onclick="selectSubject('${sub.id}', '${escapeHtml(sub.name)}')"
        >
          <span class="sub-icon">&#128196;</span>
          <span class="sub-name">${escapeHtml(sub.name)}</span>
        </button>
      `).join("")}
    </div>
    ${isAdmin ? `<div class="admin-upload-row"><button class="btn-upload-admin" onclick="openUploadModal()">رفع ملفات جديدة (أدمن)</button></div>` : ""}
  `;
}

function selectSubject(subjectId, subjectName) {
  AppState.currentSubjectId   = subjectId;
  AppState.currentSubjectName = subjectName;

  // Update active state
  document.querySelectorAll(".subject-card-btn").forEach(btn => {
    btn.classList.remove("active");
  });
  // re-render is cheap enough
  renderSubjectsView(AppState.subjects);

  updateBreadcrumb();
  loadFiles(subjectId);
}

// ─────────────────────────────────────────────────────────────
//  STEP 4: Load & Render Files
// ─────────────────────────────────────────────────────────────
async function loadFiles(subjectFolderId) {
  renderFilesView(null); // loading

  try {
    AppState.files = await window.gasClient.getFiles(subjectFolderId);
  } catch (e) {
    AppState.files = [];
  }

  renderFilesView(AppState.files);
}

function renderFilesView(files) {
  const container = document.getElementById("filesListContainer");
  if (!container) return;

  if (files === null) {
    container.innerHTML = `<div class="loading-block">جاري تحميل الملفات...</div>`;
    return;
  }

  if (!AppState.currentSubjectId) {
    container.innerHTML = ``;
    return;
  }

  if (files.length === 0) {
    container.innerHTML = `
      <div class="empty-subjects-state">
        <h3>لا توجد ملفات مرفوعة في هذه المادة حالياً</h3>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="files-section-title">ملفات مادة: <strong>${escapeHtml(AppState.currentSubjectName)}</strong></div>
    <div class="files-grid">
      ${files.map(f => `
        <div class="file-card">
          <div class="file-icon">${getMimeIcon(f.mimeType)}</div>
          <div class="file-info">
            <span class="file-name">${escapeHtml(f.name)}</span>
          </div>
          <div class="file-actions">
            <button class="btn-lec-download" onclick="openArchiveDocViewer('${escapeHtml(f.name)}', '${escapeHtml(f.url)}')">
              عرض
            </button>
            <a class="btn-lec-external" href="${escapeHtml(f.url)}" target="_blank" rel="noopener">
              فتح في Drive
            </a>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function getMimeIcon(mimeType) {
  if (!mimeType) return "&#128196;";
  if (mimeType.includes("pdf"))   return "&#128209;";
  if (mimeType.includes("video")) return "&#127910;";
  if (mimeType.includes("image")) return "&#128247;";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "&#128202;";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))       return "&#128200;";
  if (mimeType.includes("document") || mimeType.includes("word"))           return "&#128203;";
  return "&#128196;";
}

// ─────────────────────────────────────────────────────────────
//  Archive.org Style Document Viewer
// ─────────────────────────────────────────────────────────────
function openArchiveDocViewer(title, fileUrl) {
  const modal  = document.getElementById("archiveDocViewerModal");
  const ttl    = document.getElementById("archiveDocTitle");
  const iframe = document.getElementById("archiveDocIframe");
  const extBtn = document.getElementById("archiveDocExternalBtn");
  if (!modal) return;

  ttl.innerText = title || "عرض المستند";

  let previewUrl = fileUrl || "";
  if (previewUrl.includes("drive.google.com")) {
    const m = previewUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || previewUrl.match(/id=([a-zA-Z0-9_-]+)/);
    if (m && m[1]) previewUrl = `https://drive.google.com/file/d/${m[1]}/preview`;
  }

  iframe.src   = previewUrl || "about:blank";
  extBtn.href  = fileUrl || "https://drive.google.com";

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeArchiveDocViewer() {
  const modal  = document.getElementById("archiveDocViewerModal");
  const iframe = document.getElementById("archiveDocIframe");
  if (modal)  modal.classList.add("hidden");
  if (iframe) iframe.src = "about:blank";
  document.body.style.overflow = "";
}

// ─────────────────────────────────────────────────────────────
//  Admin Upload Modal
// ─────────────────────────────────────────────────────────────
function openUploadModal() {
  const modal = document.getElementById("uploadModal");
  if (!modal) return;

  // Pre-fill branch
  const branchSel = document.getElementById("uploadBranchSelect");
  if (branchSel) branchSel.value = AppState.currentBranchId;

  // Pre-fill dept if one is selected
  const deptInput = document.getElementById("uploadDeptInput");
  if (deptInput && AppState.currentDeptName) deptInput.value = AppState.currentDeptName;

  // Pre-fill subject if selected
  const subInput = document.getElementById("uploadSubjectInput");
  if (subInput && AppState.currentSubjectName) subInput.value = AppState.currentSubjectName;

  // Clear file input & status
  const fileInput = document.getElementById("uploadFileInput");
  if (fileInput) fileInput.value = "";
  setUploadStatus("");

  modal.classList.remove("hidden");
}

function closeUploadModal() {
  const modal = document.getElementById("uploadModal");
  if (modal) modal.classList.add("hidden");
}

function setUploadStatus(msg, isError) {
  const el = document.getElementById("uploadStatusMsg");
  if (!el) return;
  el.innerText = msg;
  el.style.color = isError ? "#c0392b" : "#2e7d32";
}

async function handleUploadSubmit(e) {
  e.preventDefault();

  const branchId   = document.getElementById("uploadBranchSelect").value;
  const deptName   = document.getElementById("uploadDeptInput").value.trim();
  const subName    = document.getElementById("uploadSubjectInput").value.trim();
  const fileInput  = document.getElementById("uploadFileInput");
  const files      = fileInput?.files;

  if (!deptName) { setUploadStatus("يرجى كتابة اسم القسم.", true); return; }
  if (!subName)  { setUploadStatus("يرجى كتابة اسم المادة.", true); return; }
  if (!files || files.length === 0) { setUploadStatus("يرجى اختيار ملف واحد على الأقل.", true); return; }

  const submitBtn = document.getElementById("uploadSubmitBtn");
  if (submitBtn) submitBtn.disabled = true;
  setUploadStatus("جاري الرفع...");

  let successCount = 0;
  let failCount    = 0;

  for (const file of files) {
    const result = await window.gasClient.uploadFile(
      branchId, deptName, subName, file,
      (pct) => setUploadStatus(`جاري رفع "${file.name}" — ${pct}%`)
    );
    if (result && result.success) {
      successCount++;
    } else {
      failCount++;
      console.warn("[Upload] Failed:", file.name, result?.message);
    }
  }

  if (submitBtn) submitBtn.disabled = false;

  if (failCount === 0) {
    setUploadStatus(`تم رفع ${successCount} ملف/ملفات بنجاح على Google Drive.`);
    // Refresh current view if branch/dept/subject match
    if (branchId === AppState.currentBranchId) {
      await loadDepartments();
    }
    // close after 2s
    setTimeout(closeUploadModal, 2000);
  } else {
    setUploadStatus(`تم رفع ${successCount}، فشل ${failCount}. تحقق من الاتصال.`, true);
  }
}

// Drag & Drop support on upload zone
function initUploadZone() {
  const zone  = document.getElementById("uploadDropZone");
  const input = document.getElementById("uploadFileInput");
  if (!zone || !input) return;

  zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", e => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    // merge dragged files into input (DataTransfer can't assign directly, so we use a workaround via state)
    const dt = e.dataTransfer;
    if (dt && dt.files.length > 0) {
      // Manually update display
      updateFileSelectionDisplay(dt.files);
      // Store in a temp variable
      window._pendingFiles = dt.files;
    }
  });

  zone.addEventListener("click", () => input.click());

  input.addEventListener("change", () => {
    window._pendingFiles = null;
    updateFileSelectionDisplay(input.files);
  });
}

function updateFileSelectionDisplay(files) {
  const label = document.getElementById("uploadFileLabel");
  if (!label) return;
  if (!files || files.length === 0) {
    label.innerText = "اضغط هنا أو اسحب الملفات للرفع";
  } else {
    label.innerText = `${files.length} ملف محدد: ${Array.from(files).map(f => f.name).join("، ")}`;
  }
}

// Override handleUploadSubmit to support drag-dropped files
const _origHandleUploadSubmit = handleUploadSubmit;

// ─────────────────────────────────────────────────────────────
//  Breadcrumb
// ─────────────────────────────────────────────────────────────
function updateBreadcrumb() {
  const bcEl = document.getElementById("appBreadcrumbs");
  if (!bcEl) return;

  const branchName  = AppState.currentBranchId === "boys" ? "فرع البنين" : "فرع البنات";
  const deptName    = AppState.currentDeptName  || "";
  const subjectName = AppState.currentSubjectName || "";

  let html = `<span class="bc-item" onclick="selectBranch('${AppState.currentBranchId}')">${branchName}</span>`;
  if (deptName)    html += `<span class="bc-sep">/</span><span class="bc-item" onclick="selectDepartment('${AppState.currentDeptId}','${escapeHtml(deptName)}')">${escapeHtml(deptName)}</span>`;
  if (subjectName) html += `<span class="bc-sep">/</span><span class="bc-item active">${escapeHtml(subjectName)}</span>`;

  bcEl.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────
//  Utilities
// ─────────────────────────────────────────────────────────────
function showToast(msg) {
  let toast = document.getElementById("appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.className = "app-toast";
    document.body.appendChild(toast);
  }
  toast.innerText = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3200);
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function handleLogout() {
  sessionStorage.removeItem("azu_user_role");
  window.location.href = "./index.html";
}

function bindAppEvents() {
  const uploadForm = document.getElementById("uploadForm");
  if (uploadForm) {
    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      // Support drag-dropped files
      const fileInput = document.getElementById("uploadFileInput");
      if (window._pendingFiles && window._pendingFiles.length > 0) {
        // temporarily replace files (not possible natively), use workaround:
        // call upload directly with _pendingFiles
        const branchId  = document.getElementById("uploadBranchSelect").value;
        const deptName  = document.getElementById("uploadDeptInput").value.trim();
        const subName   = document.getElementById("uploadSubjectInput").value.trim();
        if (!deptName) { setUploadStatus("يرجى كتابة اسم القسم.", true); return; }
        if (!subName)  { setUploadStatus("يرجى كتابة اسم المادة.", true); return; }

        const submitBtn = document.getElementById("uploadSubmitBtn");
        if (submitBtn) submitBtn.disabled = true;
        let successCount = 0, failCount = 0;

        for (const file of window._pendingFiles) {
          const result = await window.gasClient.uploadFile(branchId, deptName, subName, file, pct => setUploadStatus(`جاري رفع "${file.name}" — ${pct}%`));
          if (result && result.success) successCount++; else failCount++;
        }
        if (submitBtn) submitBtn.disabled = false;
        window._pendingFiles = null;

        if (failCount === 0) {
          setUploadStatus(`تم رفع ${successCount} ملف/ملفات بنجاح.`);
          if (branchId === AppState.currentBranchId) await loadDepartments();
          setTimeout(closeUploadModal, 2000);
        } else {
          setUploadStatus(`تم رفع ${successCount}، فشل ${failCount}.`, true);
        }
      } else {
        await handleUploadSubmit(e);
      }
    });
  }

  initUploadZone();
}
