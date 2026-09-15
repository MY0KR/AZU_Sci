/**
 * AZU Science Portal — Google Apps Script Backend
 * ================================================
 * File: Code.gs
 *
 * انسخ هذا الكود كاملاً والصقه في محرر Apps Script الخاص بك
 * ثم انشره كـ Web App بصلاحية "Anyone" للقراءة والكتابة.
 *
 * Navigation: Branch (boys/girls) → Department (subfolder) → Subject (subfolder) → Files
 *
 * Endpoints:
 *   GET  ?action=getDepts&branch=boys&folderId=ROOT_ID
 *   GET  ?action=getSubs&folderId=DEPT_FOLDER_ID
 *   GET  ?action=getFiles&folderId=SUBJECT_FOLDER_ID
 *   POST { action:"uploadFile", branchId, rootFolderId, deptName, subjectName, fileName, mimeType, base64Data }
 *   POST { action:"saveAboutUs", payload:{...} }
 */

// ─── Root folder IDs ──────────────────────────────────────────
var ROOT_FOLDERS = {
  boys:  "1Uw3UZd-qKvEMjbodv8K8ExxMq8iVpKkd",
  girls: "1jvJeVQTv2Rrn5zL2TDjoMk-Qf9-RpW70"
};

// ─── CORS helper ─────────────────────────────────────────────
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── doGet ────────────────────────────────────────────────────
function doGet(e) {
  try {
    var action   = e.parameter.action   || "";
    var folderId = e.parameter.folderId || "";
    var branch   = e.parameter.branch   || "";

    if (action === "getDepts") {
      // List immediate subfolders of the branch root
      var rootId = folderId || ROOT_FOLDERS[branch];
      if (!rootId) return jsonResponse({ error: "Missing folderId or branch" });
      return jsonResponse(listSubfolders(rootId));
    }

    if (action === "getSubs") {
      // List immediate subfolders of a department folder
      if (!folderId) return jsonResponse({ error: "Missing folderId" });
      return jsonResponse(listSubfolders(folderId));
    }

    if (action === "getFiles") {
      // List all files (non-folder) inside a subject folder
      if (!folderId) return jsonResponse({ error: "Missing folderId" });
      return jsonResponse(listFiles(folderId));
    }

    return jsonResponse({ error: "Unknown action: " + action });

  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ─── doPost ───────────────────────────────────────────────────
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action || "";

    if (action === "uploadFile") {
      return handleUpload(body);
    }

    if (action === "saveAboutUs") {
      // Optionally store in Script Properties
      PropertiesService.getScriptProperties().setProperty(
        "aboutUs", JSON.stringify(body.payload)
      );
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Unknown POST action: " + action });

  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ─── listSubfolders ───────────────────────────────────────────
/**
 * Returns [{id, name}] for all direct subfolders of parentFolderId.
 */
function listSubfolders(parentFolderId) {
  var parent  = DriveApp.getFolderById(parentFolderId);
  var folders = parent.getFolders();
  var result  = [];

  while (folders.hasNext()) {
    var f = folders.next();
    result.push({ id: f.getId(), name: f.getName() });
  }

  // Sort alphabetically by name
  result.sort(function(a, b) { return a.name.localeCompare(b.name, "ar"); });
  return result;
}

// ─── listFiles ────────────────────────────────────────────────
/**
 * Returns [{id, name, url, mimeType}] for all files in a folder (non-recursive).
 */
function listFiles(folderId) {
  var folder = DriveApp.getFolderById(folderId);
  var files  = folder.getFiles();
  var result = [];

  while (files.hasNext()) {
    var f = files.next();
    result.push({
      id:       f.getId(),
      name:     f.getName(),
      url:      f.getUrl(),            // standard Drive view URL
      mimeType: f.getMimeType()
    });
  }

  // Sort by name
  result.sort(function(a, b) { return a.name.localeCompare(b.name, "ar"); });
  return result;
}

// ─── handleUpload ─────────────────────────────────────────────
/**
 * Receives a base64-encoded file, creates folders if needed, and saves the file.
 *
 * Expected body:
 * {
 *   action:       "uploadFile",
 *   branchId:     "boys" | "girls",
 *   rootFolderId: "...",     // branch root ID
 *   deptName:     "قسم الكيمياء",
 *   subjectName:  "كيمياء عضوية",
 *   fileName:     "lecture1.pdf",
 *   mimeType:     "application/pdf",
 *   base64Data:   "JVBERi0xLjQ..."   // pure base64, no data-url prefix
 * }
 */
function handleUpload(body) {
  try {
    var rootFolderId = body.rootFolderId || (typeof ROOT_FOLDERS !== 'undefined' ? ROOT_FOLDERS[body.branchId] : null);
    if (!rootFolderId) return jsonResponse({ success: false, message: "Missing rootFolderId" });

    // 1. Get or create Department folder
    var deptFolder = getOrCreateSubfolder(
      DriveApp.getFolderById(rootFolderId),
      body.deptName
    );

    // 2. Get or create Subject folder inside Department
    var subjectFolder = getOrCreateSubfolder(deptFolder, body.subjectName);

    // 3. Clean Base64 Data if data-url header exists
    var base64Data = body.base64Data || "";
    if (base64Data.indexOf(',') !== -1) {
      base64Data = base64Data.split(',')[1];
    }

    // 4. Decode base64 and create file
    var decoded = Utilities.base64Decode(base64Data);
    var blob    = Utilities.newBlob(decoded, body.mimeType, body.fileName);
    var file    = subjectFolder.createFile(blob);

    // 5. Make file readable by anyone with the link (View only — Admin uploads, Students view)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return jsonResponse({
      success:  true,
      fileId:   file.getId(),
      fileName: file.getName(),
      url:      file.getUrl()
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      message: error.toString()
    });
  }
}

// ─── getOrCreateSubfolder ─────────────────────────────────────
/**
 * Returns existing subfolder by name (trimmed), or creates it.
 */
function getOrCreateSubfolder(parentFolder, name) {
  var cleanName = name ? name.toString().trim() : "Untitled Folder";
  var iter = parentFolder.getFoldersByName(cleanName);
  if (iter.hasNext()) return iter.next();
  return parentFolder.createFolder(cleanName);
}
