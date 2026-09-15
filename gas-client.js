/**
 * AZU Science Portal - GAS Client (النسخة المبسطة السريعة)
 *
 * Navigation: Branch (boys/girls) → Department → Subject → Files
 */

const GAS_CONFIG = {
  ENDPOINT_URL: "https://script.google.com/macros/s/AKfycbybIxEhSMsdhVqg1h_YuqPMVeaBZWI1Wj8p3GXoGGjRu9QdLd_rR-3MDqF3w_q9WB_f/exec",

  DRIVE_FOLDERS: {
    boys:  { id: "1Uw3UZd-qKvEMjbodv8K8ExxMq8iVpKkd", name: "فرع البنين" },
    girls: { id: "1jvJeVQTv2Rrn5zL2TDjoMk-Qf9-RpW70", name: "فرع البنات" }
  },

  CACHE_KEY_DEPTS:   "azu_depts_v5",   
  CACHE_KEY_SUBS:    "azu_subs_v5",    
  CACHE_KEY_FILES:   "azu_files_v5",   
  CACHE_KEY_ABOUT:   "azu_about_v5"
};

const DEFAULT_ABOUT = {
  mainText:         "منصة طلاب كلية العلوم - جامعة الأزهر.",
  devTeamText:      "فريق إدارة وتطوير قواعد البيانات.",
  academicTeamText: "هيئة الإشراف والتدقيق الأكاديمي."
};

// ─────────────────────────────────────────────────────────────
//  Helpers: local-cache & GAS communication
// ─────────────────────────────────────────────────────────────
function _cacheGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function _cacheSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

async function _gasGet(params) {
  const url = new URL(GAS_CONFIG.ENDPOINT_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function _gasPost(payload) {
  await fetch(GAS_CONFIG.ENDPOINT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
}

// ─────────────────────────────────────────────────────────────
//  GasClient class
// ─────────────────────────────────────────────────────────────
class GasClient {
  constructor() {
    this.isOnline = navigator.onLine;
    window.addEventListener("online",  () => { this.isOnline = true; });
    window.addEventListener("offline", () => { this.isOnline = false; });
  }

  // ── Departments ─────────────────────────────────────────────
  async getDepartments(branchId) {
    const allCached = _cacheGet(GAS_CONFIG.CACHE_KEY_DEPTS) || {};

    if (this.isOnline) {
      try {
        const data = await _gasGet({ action: "getDepts", branch: branchId, folderId: GAS_CONFIG.DRIVE_FOLDERS[branchId].id });
        if (Array.isArray(data) && data.length >= 0) {
          allCached[branchId] = data;
          _cacheSet(GAS_CONFIG.CACHE_KEY_DEPTS, allCached);
          return data;
        }
      } catch (e) {
        console.warn("[GasClient] getDepts remote failed, using cache:", e.message);
      }
    }

    return allCached[branchId] || [];
  }

  // ── Subjects ─────────────────────────────────────────────────
  async getSubjects(branchId, deptFolderId) {
    const cacheKey = GAS_CONFIG.CACHE_KEY_SUBS;
    const slot     = `${branchId}::${deptFolderId}`;
    const allCached = _cacheGet(cacheKey) || {};

    if (this.isOnline) {
      try {
        const data = await _gasGet({ action: "getSubs", folderId: deptFolderId });
        if (Array.isArray(data)) {
          allCached[slot] = data;
          _cacheSet(cacheKey, allCached);
          return data;
        }
      } catch (e) {
        console.warn("[GasClient] getSubs remote failed, using cache:", e.message);
      }
    }

    return allCached[slot] || [];
  }

  // ── Files ─────────────────────────────────────────────────────
  async getFiles(subjectFolderId) {
    const cacheKey  = GAS_CONFIG.CACHE_KEY_FILES;
    const allCached = _cacheGet(cacheKey) || {};

    if (this.isOnline) {
      try {
        const data = await _gasGet({ action: "getFiles", folderId: subjectFolderId });
        if (Array.isArray(data)) {
          allCached[subjectFolderId] = data;
          _cacheSet(cacheKey, allCached);
          return data;
        }
      } catch (e) {
        console.warn("[GasClient] getFiles remote failed, using cache:", e.message);
      }
    }

    return allCached[subjectFolderId] || [];
  }

  // ── Admin: Upload File (النسخة المباشرة السريعة) ─────────────
  async uploadFile(branchId, deptName, subjectName, file, onProgress) {
    if (!this.isOnline) return { success: false, message: "لا يوجد اتصال بالإنترنت." };

    if (onProgress) onProgress(15);

    // إرسال الملف مباشرة كـ FormData يمنع تأخير التشفير ويحفظ سرعة الشبكة
    const formData = new FormData();
    formData.append("action", "uploadFile");
    formData.append("branchId", branchId);
    formData.append("rootFolderId", GAS_CONFIG.DRIVE_FOLDERS[branchId].id);
    formData.append("deptName", deptName);
    formData.append("subjectName", subjectName);
    formData.append("fileName", file.name);
    formData.append("mimeType", file.type || "application/octet-stream");
    formData.append("file", file);

    if (onProgress) onProgress(40);

    try {
      const res = await fetch(GAS_CONFIG.ENDPOINT_URL, {
        method: "POST",
        body: formData
      });

      if (onProgress) onProgress(85);
      const result = await res.json();
      if (onProgress) onProgress(100);

      // Invalidate relevant caches
      const subsCache = _cacheGet(GAS_CONFIG.CACHE_KEY_SUBS) || {};
      const deptsCache = _cacheGet(GAS_CONFIG.CACHE_KEY_DEPTS) || {};
      delete deptsCache[branchId];
      _cacheSet(GAS_CONFIG.CACHE_KEY_DEPTS, deptsCache);
      _cacheSet(GAS_CONFIG.CACHE_KEY_SUBS, subsCache);

      return result;
    } catch (e) {
      console.error("[GasClient] uploadFile error:", e);
      return { success: false, message: e.message };
    }
  }

  // ── About Us ────────────────────────────────────────────────
  async loadAboutUsContent() {
    const cached = _cacheGet(GAS_CONFIG.CACHE_KEY_ABOUT);
    return cached || JSON.parse(JSON.stringify(DEFAULT_ABOUT));
  }

  async saveAboutUsContent(newData) {
    _cacheSet(GAS_CONFIG.CACHE_KEY_ABOUT, newData);
    if (this.isOnline) {
      try { await _gasPost({ action: "saveAboutUs", payload: newData }); } catch {}
    }
    return true;
  }
}

window.gasClient = new GasClient();