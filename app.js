/**
 * DrivePhoto - 前端上傳應用程式邏輯
 */

// 預設配置
// 預設配置與預設課程清單
// 執行配置 (由 config.js 提供，並支援 localStorage 臨時測試覆蓋)
let activeConfig = {
    GAS_WEB_APP_URL: "",
    PARENT_FOLDER_ID: "",
    DEFAULT_COURSES: []
};

let uploadQueue = [];
let isUploading = false;
let currentUploadIndex = 0;

// DOM 元素
const dateInput = document.getElementById('dateInput');
const minguoDateDisplay = document.getElementById('minguoDateDisplay');
const courseSelect = document.getElementById('courseSelect');
const customCourseGroup = document.getElementById('customCourseGroup');
const customCourseInput = document.getElementById('customCourseInput');
const folderNamePreview = document.getElementById('folderNamePreview');

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');

const queueList = document.getElementById('queueList');
const queueCountBadge = document.getElementById('queueCountBadge');
const uploadActionsContainer = document.getElementById('uploadActionsContainer');
const overallProgressText = document.getElementById('overallProgressText');
const overallPercentText = document.getElementById('overallPercentText');
const overallProgressBar = document.getElementById('overallProgressBar');

const startUploadBtn = document.getElementById('startUploadBtn');
const clearQueueBtn = document.getElementById('clearQueueBtn');
const setupWarning = document.getElementById('setupWarning');

// 成功 Modal DOM
const successModal = document.getElementById('successModal');
const successModalMessage = document.getElementById('successModalMessage');
const targetFolderLink = document.getElementById('targetFolderLink');
const targetFolderLinkContainer = document.getElementById('targetFolderLinkContainer');
const successCloseBtn = document.getElementById('successCloseBtn');

/* ==========================================
   1. 初始化與設定管理
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 載入儲存的設定
    loadSettings();
    
    // 初始化日期為今日
    initDefaultDate();
    
    // 更新民國日期與資料夾名稱預覽
    updateFolderPreview();
    
    // 綁定事件監聽器
    bindEvents();
    
    // 檢查 API 是否已設定
    checkApiStatus();
});

// 載入設定
function loadSettings() {
    // 1. 讀取全域 config.js 的內容 (若有)
    const baseConfig = (typeof CONFIG !== 'undefined') ? CONFIG : { GAS_WEB_APP_URL: "", PARENT_FOLDER_ID: "", DEFAULT_COURSES: [] };
    
    // 2. 讀取瀏覽器 localStorage 的臨時設定 (管理者測試用)
    const savedUrl = localStorage.getItem('gas_web_app_url');
    const savedFolder = localStorage.getItem('gas_parent_folder_id');
    const savedCourses = localStorage.getItem('custom_courses');
    
    // 3. 優先順序：localStorage 臨時覆蓋 > config.js 全域設定
    activeConfig.GAS_WEB_APP_URL = savedUrl || baseConfig.GAS_WEB_APP_URL || "";
    activeConfig.PARENT_FOLDER_ID = savedFolder || baseConfig.PARENT_FOLDER_ID || "";
    
    // 4. 載入並更新課程選單
    let coursesList = savedCourses;
    if (!coursesList && baseConfig.DEFAULT_COURSES) {
        coursesList = baseConfig.DEFAULT_COURSES.join('\n');
    }
    
    updateCourseDropdown(coursesList);
}

// 更新課程下拉選單
function updateCourseDropdown(courseListString) {
    const defaultCourses = [
        "寶藏寺探險",
        "戶外教學活動",
        "科學實驗大挑戰",
        "程式設計體驗",
        "手作DIY美勞"
    ];
    
    let courses = [...defaultCourses];
    
    if (courseListString && courseListString.trim() !== "") {
        courses = courseListString.split('\n')
            .map(c => c.trim())
            .filter(c => c !== "");
    }
    
    const currentValue = courseSelect.value;
    
    // 清空
    courseSelect.innerHTML = "";
    
    // 填充
    courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course;
        option.textContent = course;
        courseSelect.appendChild(option);
    });
    
    // 加入「自訂」
    const customOption = document.createElement('option');
    customOption.value = "CUSTOM_COURSE";
    customOption.textContent = "[其他] 自訂課程名稱";
    courseSelect.appendChild(customOption);
    
    // 嘗試還原選取值
    if (currentValue && Array.from(courseSelect.options).some(opt => opt.value === currentValue)) {
        courseSelect.value = currentValue;
    } else {
        courseSelect.selectedIndex = 0;
    }
    
    // 觸發顯示/隱藏自訂輸入框
    if (courseSelect.value === 'CUSTOM_COURSE') {
        customCourseGroup.classList.remove('hidden');
    } else {
        customCourseGroup.classList.add('hidden');
    }
}

// 檢查 API 設定狀態
function checkApiStatus() {
    if (!activeConfig.GAS_WEB_APP_URL || activeConfig.GAS_WEB_APP_URL.includes("YOUR_SCRIPT_ID")) {
        setupWarning.classList.remove('hidden');
    } else {
        setupWarning.classList.add('hidden');
    }
}

// 初始化預設日期 (今日)
function initDefaultDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    dateInput.value = `${year}-${month}-${day}`;
}

// 綁定所有事件
function bindEvents() {
    // 表單事件
    dateInput.addEventListener('input', updateFolderPreview);
    courseSelect.addEventListener('change', (e) => {
        if (e.target.value === 'CUSTOM_COURSE') {
            customCourseGroup.classList.remove('hidden');
            customCourseInput.focus();
        } else {
            customCourseGroup.classList.add('hidden');
        }
        updateFolderPreview();
    });
    customCourseInput.addEventListener('input', updateFolderPreview);

    // 拖曳區事件
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
        }, false);
    });

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    });

    // 佇列控制按鈕
    startUploadBtn.addEventListener('click', startUploadProcess);
    clearQueueBtn.addEventListener('click', clearQueue);

    // 成功 Modal 關閉
    successCloseBtn.addEventListener('click', () => successModal.classList.add('hidden'));
    successModal.addEventListener('click', (e) => {
        if (e.target === successModal) successModal.classList.add('hidden');
    });
}

/* ==========================================
   2. 日期轉換與資料夾命名邏輯
   ========================================== */

// 將西元日期轉換為民國格式 (e.g. "2026-07-07" -> "115.07.07")
function convertToMinguoDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    
    const year = parseInt(parts[0], 10);
    const month = parts[1];
    const day = parts[2];
    
    const minguoYear = year - 1911;
    return `${minguoYear}.${month}.${day}`;
}

// 更新資料夾名稱預覽
function updateFolderPreview() {
    const minguoDate = convertToMinguoDate(dateInput.value);
    if (minguoDate) {
        minguoDateDisplay.innerText = `民國日期：${minguoDate}`;
    } else {
        minguoDateDisplay.innerText = '民國日期：請選擇正確日期';
    }

    let courseName = '';
    if (courseSelect.value === 'CUSTOM_COURSE') {
        courseName = customCourseInput.value.trim();
    } else {
        courseName = courseSelect.value;
    }

    if (!courseName) {
        courseName = '請輸入或選擇課程';
    }

    const folderName = `${minguoDate} ${courseName}`;
    folderNamePreview.innerText = folderName;
}

// 取得目前的資料夾名稱 (上傳時使用)
function getCurrentFolderName() {
    const minguoDate = convertToMinguoDate(dateInput.value);
    let courseName = '';
    if (courseSelect.value === 'CUSTOM_COURSE') {
        courseName = customCourseInput.value.trim() || '自訂課程';
    } else {
        courseName = courseSelect.value;
    }
    return {
        date: minguoDate,
        course: courseName,
        folderName: `${minguoDate} ${courseName}`
    };
}

/* ==========================================
   3. 拖曳檔案與佇列管理
   ========================================== */

function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
    // 重設 input 讓同檔名可以重複觸發 select
    fileInput.value = '';
}

function handleFiles(files) {
    if (isUploading) {
        alert('照片正在上傳中，請等候上傳完成後再加入新照片！');
        return;
    }

    let addedCount = 0;
    Array.from(files).forEach(file => {
        // 只接受圖片
        if (!file.type.startsWith('image/')) {
            alert(`檔案「${file.name}」不是圖片，已自動忽略。`);
            return;
        }

        // 大小限制 (建議 25MB)
        const sizeInMB = file.size / (1024 * 1024);
        if (sizeInMB > 25) {
            alert(`檔案「${file.name}」大小超過 25MB (目前 ${sizeInMB.toFixed(1)}MB)，可能導致上傳失敗，已自動忽略。`);
            return;
        }

        // 產生一個唯一 ID
        const id = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        uploadQueue.push({
            id: id,
            file: file,
            status: 'waiting', // waiting, uploading, done, failed
            progress: 0,
            errorMsg: '',
            objectUrl: URL.createObjectURL(file) // 快速縮圖預覽
        });
        addedCount++;
    });

    if (addedCount > 0) {
        renderQueue();
    }
}

// 渲染佇列清單
function renderQueue() {
    queueCountBadge.innerText = `${uploadQueue.length} 張`;

    if (uploadQueue.length === 0) {
        queueList.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-image"></i>
                <p>目前尚未選取任何相片</p>
                <span>請先從左側選擇日期與課程，然後加入相片！</span>
            </div>
        `;
        queueList.classList.add('empty');
        uploadActionsContainer.classList.add('hidden');
        return;
    }

    queueList.classList.remove('empty');
    uploadActionsContainer.classList.remove('hidden');
    
    // 保留或更新 DOM
    queueList.innerHTML = '';
    
    uploadQueue.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = `queue-item ${item.status}`;
        itemEl.id = item.id;
        
        let statusBadgeClass = 'status-waiting';
        let statusText = '等待中';
        
        if (item.status === 'uploading') {
            statusBadgeClass = 'status-uploading';
            statusText = '上傳中...';
        } else if (item.status === 'done') {
            statusBadgeClass = 'status-done';
            statusText = '完成';
        } else if (item.status === 'failed') {
            statusBadgeClass = 'status-failed';
            statusText = '失敗';
        }

        const sizeFormatted = formatFileSize(item.file.size);
        
        itemEl.innerHTML = `
            <img src="${item.objectUrl}" class="queue-item-thumb" alt="${item.file.name}">
            <div class="queue-item-info">
                <div class="queue-item-name" title="${item.file.name}">${item.file.name}</div>
                <div class="queue-item-meta">
                    <span>${sizeFormatted}</span>
                    <span class="status-badge ${statusBadgeClass}">${statusText}</span>
                    ${item.errorMsg ? `<span class="text-danger" title="${item.errorMsg}">(${item.errorMsg})</span>` : ''}
                </div>
            </div>
            ${!isUploading && item.status !== 'done' ? `
                <button class="btn-item-remove" onclick="removeQueueItem('${item.id}')" title="移除此檔案">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            ` : ''}
            <div class="queue-item-progress-bar ${item.status === 'done' ? 'success' : (item.status === 'failed' ? 'error' : '')}" style="width: ${item.progress}%"></div>
        `;
        
        queueList.appendChild(itemEl);
    });
}

// 移除佇列中的特定檔案
window.removeQueueItem = function(id) {
    const index = uploadQueue.findIndex(item => item.id === id);
    if (index > -1) {
        // 釋放記憶體中的 Object URL
        URL.revokeObjectURL(uploadQueue[index].objectUrl);
        uploadQueue.splice(index, 1);
        renderQueue();
    }
};

// 清空佇列
function clearQueue() {
    if (isUploading) return;
    
    // 釋放所有 Object URL
    uploadQueue.forEach(item => URL.revokeObjectURL(item.objectUrl));
    uploadQueue = [];
    renderQueue();
}

// 格式化檔案大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/* ==========================================
   4. 後端傳輸與 API 通訊 (核心上傳邏輯)
   ========================================== */

// 開始上傳程序
async function startUploadProcess() {
    if (isUploading) return;
    
    // 1. 檢查設定
    if (!activeConfig.GAS_WEB_APP_URL || activeConfig.GAS_WEB_APP_URL.includes("YOUR_SCRIPT_ID")) {
        alert('上傳服務尚未配置，請聯絡系統管理員設定！');
        return;
    }

    // 2. 篩選出需要上傳的檔案 (等待中或先前失敗的)
    const filesToUpload = uploadQueue.filter(item => item.status === 'waiting' || item.status === 'failed');
    
    if (filesToUpload.length === 0) {
        alert('目前佇列中沒有待上傳的照片！');
        return;
    }

    // 3. 鎖定 UI
    setUiLocked(true);
    isUploading = true;
    
    let successCount = 0;
    let failedCount = 0;
    let folderUrl = ""; // 用來紀錄回傳的雲端資料夾網址
    
    const folderMetadata = getCurrentFolderName();
    const totalFiles = uploadQueue.length;

    // 4. 開始循序上傳
    for (let i = 0; i < uploadQueue.length; i++) {
        const item = uploadQueue[i];
        
        // 跳過已成功的檔案
        if (item.status === 'done') {
            successCount++;
            continue;
        }

        item.status = 'uploading';
        item.progress = 10; // 起始進度值
        renderQueue();
        updateOverallProgress(i, totalFiles);

        try {
            // A. 將圖片轉為 Base64
            item.progress = 30;
            renderQueue();
            const base64Data = await readFileAsBase64(item.file);

            // B. 傳送至 Google Apps Script
            item.progress = 50;
            renderQueue();
            
            const payload = {
                date: folderMetadata.date,
                course: folderMetadata.course,
                fileName: item.file.name,
                mimeType: item.file.type,
                fileBase64: base64Data,
                parentFolderId: activeConfig.PARENT_FOLDER_ID
            };

            const response = await fetch(activeConfig.GAS_WEB_APP_URL, {
                method: 'POST',
                mode: 'cors',
                redirect: 'follow', // 重要：Apps Script 會進行 302 重導向
                headers: {
                    // 使用 text/plain 來規避瀏覽器的 CORS Preflight OPTIONS 預檢請求
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`伺服器回應異常: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.status === 'success') {
                item.status = 'done';
                item.progress = 100;
                successCount++;
                if (result.folderUrl) {
                    folderUrl = result.folderUrl;
                }
            } else {
                throw new Error(result.message || '上傳回傳未知錯誤');
            }

        } catch (error) {
            console.error('上傳失敗：', error);
            item.status = 'failed';
            item.progress = 100;
            item.errorMsg = error.message || '連線錯誤';
            failedCount++;
        }

        renderQueue();
    }

    // 5. 解鎖 UI
    isUploading = false;
    setUiLocked(false);
    updateOverallProgress(totalFiles, totalFiles);

    // 6. 上傳結束處理
    if (successCount > 0) {
        showSuccessModal(successCount, folderUrl);
    } else {
        alert('所有照片上傳失敗，請檢查設定與網路連線！');
    }
}

// 將 File 物件轉換為 Base64 字串的 Promise 封裝
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

// 鎖定/解鎖前端輸入
function setUiLocked(locked) {
    dateInput.disabled = locked;
    courseSelect.disabled = locked;
    customCourseInput.disabled = locked;
    fileInput.disabled = locked;
    
    if (locked) {
        startUploadBtn.disabled = true;
        clearQueueBtn.disabled = true;
        startUploadBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 上傳中...`;
        dropzone.style.pointerEvents = 'none';
        dropzone.style.opacity = '0.5';
    } else {
        startUploadBtn.disabled = false;
        clearQueueBtn.disabled = false;
        startUploadBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> 開始上傳照片`;
        dropzone.style.pointerEvents = 'auto';
        dropzone.style.opacity = '1';
    }
}

// 更新整體進度條與文字
function updateOverallProgress(current, total) {
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    overallPercentText.innerText = `${percent}%`;
    overallProgressBar.style.width = `${percent}%`;
    
    if (current === total) {
        overallProgressText.innerText = `上傳完畢！共成功 ${current} 張。`;
    } else {
        overallProgressText.innerText = `正在上傳第 ${current + 1} / ${total} 張相片...`;
    }
}

// 顯示成功上傳 Modal
function showSuccessModal(count, folderUrl) {
    successModalMessage.innerText = `成功將 ${count} 張照片上傳至 Google 雲端硬碟`;
    
    if (folderUrl) {
        targetFolderLink.href = folderUrl;
        targetFolderLinkContainer.classList.remove('hidden');
    } else {
        targetFolderLinkContainer.classList.add('hidden');
    }
    
    successModal.classList.remove('hidden');
}
