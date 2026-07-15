/**
 * Google Drive 相片上傳後端程式碼 (Google Apps Script)
 * 
 * 部署說明：
 * 1. 登入 Google 雲端硬碟，建立一個「Google Apps Script」專案。
 * 2. 將此檔案內容複製並貼上到專案的 Code.gs 中。
 * 3. 修改下方的 PARENT_FOLDER_ID 為您預期的主要儲存資料夾 ID（若留空，則預設儲存在您的雲端硬碟根目錄）。
 * 4. 點擊右上角「部署」->「新增部署」。
 * 5. 設定類型為「網頁應用程式 (Web App)」：
 *    - 執行身分：我 (Me)
 *    - 誰有權限存取：所有人 (Anyone)
 * 6. 點擊部署，並複製產生的「網頁應用程式網址」，此網址即為您的 API 端點。
 */

// [設定] 請將此處替換為您的 Google 雲端硬碟資料夾 ID
// 例如資料夾網址為 https://drive.google.com/drive/folders/1abc123XYZ... 則 ID 為 "1abc123XYZ..."
var PARENT_FOLDER_ID = "1n8rvdutEJQTENwieYUgjjJEU6rDQ44_u";

/**
 * 處理 GET 請求
 * 如果使用者直接訪問此網址，可以提供簡單的導頁或狀態說明
 */
function doGet(e) {
  return HtmlService.createHtmlOutput(
    "<html><head><meta charset='UTF-8'><style>body{font-family:sans-serif;text-align:center;padding-top:100px;background:#f5f5f7;color:#333;} .card{background:#fff;padding:40px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);display:inline-block;} h1{color:#1a73e8;}</style></head>" +
    "<body><div class='card'><h1>Google Drive 相片上傳服務</h1><p>API 服務正常運行中！請使用 GitHub Pages 前端網頁進行上傳。</p></div></body></html>"
  );
}

/**
 * 處理 POST 請求 (接收前端上傳的相片)
 */
function doPost(e) {
  // 設定 CORS 回應標頭（透過 ContentService 提供 JSON 格式）
  var output;
  try {
    // 檢查是否有 POST 內容
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("找不到上傳的資料內容");
    }

    // 解析前端傳來的 JSON 資料 (因為避開 CORS Preflight，前端 Content-Type 會是 text/plain)
    var payload = JSON.parse(e.postData.contents);
    
    var dateStr = payload.date;         // 例如 "115.07.07"
    var courseStr = payload.course;     // 例如 "寶藏寺探險"
    var fileName = payload.fileName;     // 例如 "photo.jpg"
    var mimeType = payload.mimeType;     // 例如 "image/jpeg"
    var fileBase64 = payload.fileBase64; // Base64 編碼的檔案內容
    
    // 如果前端有傳遞自訂的 parentFolderId 則使用，否則使用預設值
    var customParentId = payload.parentFolderId || PARENT_FOLDER_ID;

    if (!dateStr || !courseStr) {
      throw new Error("缺少日期或課程名稱參數");
    }
    if (!fileBase64 || !fileName) {
      throw new Error("缺少檔案內容或檔名");
    }

    // 1. 取得主要儲存資料夾 (Parent Folder)
    var parentFolder;
    if (customParentId && customParentId !== "YOUR_GOOGLE_DRIVE_FOLDER_ID_HERE" && customParentId.trim() !== "") {
      parentFolder = DriveApp.getFolderById(customParentId);
    } else {
      parentFolder = DriveApp.getRootFolder(); // 預設存到根目錄
    }

    // 2. 建立或定位目標資料夾 (命名格式: "115.07.07 寶藏寺探險")
    var folderName = dateStr.trim() + " " + courseStr.trim();
    var targetFolder = findOrCreateFolder(parentFolder, folderName);

    // 3. 解密 Base64 並儲存檔案
    // 去除 Base64 前綴（例如 "data:image/jpeg;base64,"）如果前端不小心附帶的話
    var base64Data = fileBase64;
    if (fileBase64.indexOf(",") > -1) {
      base64Data = fileBase64.split(",")[1];
    }
    
    var decodedBytes = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
    var file = targetFolder.createFile(blob);

    // 回傳成功訊息與檔案連結
    var response = {
      status: "success",
      message: "檔案上傳成功",
      fileId: file.getId(),
      fileName: file.getName(),
      fileUrl: file.getUrl(),
      folderName: folderName,
      folderUrl: targetFolder.getUrl()
    };
    
    output = JSON.stringify(response);

  } catch (error) {
    // 捕獲錯誤並回傳
    var errResponse = {
      status: "error",
      message: error.toString()
    };
    output = JSON.stringify(errResponse);
  }

  // 回傳 JSON 回應
  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 輔助函數：在指定父資料夾中搜尋子資料夾，若不存在則建立一個
 */
function findOrCreateFolder(parentFolder, folderName) {
  var folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next(); // 找到已存在的資料夾，直接返回
  } else {
    return parentFolder.createFolder(folderName); // 建立新資料夾
  }
}
