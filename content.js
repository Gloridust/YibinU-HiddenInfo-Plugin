// 用于存储教师信息的缓存
let teacherInfoCache = null;
// 插件状态
let pluginStatus = "等待页面加载";

// 向background.js发送状态更新
function updateStatus(status) {
  pluginStatus = status;
  chrome.runtime.sendMessage({ 
    action: "updateStatus", 
    status: status 
  });
  console.log("[宜宾大学插件] 状态更新:", status);
}

// 监听来自background.js的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkForTeacherInfo") {
    if (teacherInfoCache) {
      updateStatus("已获取到教师信息，正在显示...");
      displayTeacherInfo();
      sendResponse({ success: true, status: pluginStatus });
    } else {
      updateStatus("等待页面请求数据...");
      sendResponse({ success: false, status: pluginStatus });
    }
  } else if (message.action === "getStatus") {
    sendResponse({ status: pluginStatus });
  }
  return true;
});

// 拦截XHR请求以获取教师信息
function interceptXHR() {
  updateStatus("已设置XHR拦截，等待页面请求数据...");
  
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    return originalXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    if (this._url && this._url.includes("stuProjectShow")) {
      updateStatus("检测到stuProjectShow请求，准备获取数据...");
      
      const originalOnReadyStateChange = this.onreadystatechange;
      this.onreadystatechange = function() {
        if (this.readyState === 4) {
          if (this.status === 200) {
            try {
              console.log("[宜宾大学插件] 收到响应:", this.responseText.substring(0, 200) + "...");
              const response = JSON.parse(this.responseText);
              
              if (response && response.result && response.result.college_export_score) {
                teacherInfoCache = response.result.college_export_score;
                updateStatus(`已获取到${teacherInfoCache.length}条教师信息，正在显示...`);
                console.log("[宜宾大学插件] 教师信息:", teacherInfoCache);
                displayTeacherInfo();
              } else {
                console.log("[宜宾大学插件] 响应中没有找到college_export_score:", response);
                updateStatus("响应中未找到教师信息");
              }
            } catch (e) {
              console.error("[宜宾大学插件] 解析教师信息时出错:", e);
              updateStatus("解析数据时出错: " + e.message);
            }
          } else {
            console.error("[宜宾大学插件] 请求失败，状态码:", this.status);
            updateStatus("请求失败，状态码: " + this.status);
          }
        }
        
        if (originalOnReadyStateChange) {
          originalOnReadyStateChange.apply(this, arguments);
        }
      };
    }
    return originalXHRSend.apply(this, arguments);
  };
}

// 显示教师信息
function displayTeacherInfo() {
  if (!teacherInfoCache || teacherInfoCache.length === 0) {
    updateStatus("没有教师信息可显示");
    return;
  }
  
  // 查找分数表格
  const tables = document.querySelectorAll("table");
  let scoreTable = null;
  
  // 寻找可能包含分数的表格
  for (const table of tables) {
    if (table.textContent.includes("分数") || 
        table.textContent.includes("评审") || 
        table.textContent.includes("打分")) {
      scoreTable = table;
      break;
    }
  }
  
  if (!scoreTable) {
    console.log("[宜宾大学插件] 未找到分数表格，创建新表格");
    createTeacherInfoTable();
    return;
  }
  
  // 如果找到表格，尝试向表格添加教师信息
  const headers = scoreTable.querySelectorAll("th");
  let hasTeacherColumn = false;
  
  // 检查是否已存在教师列
  for (const header of headers) {
    if (header.textContent.includes("评审教师")) {
      hasTeacherColumn = true;
      break;
    }
  }
  
  if (!hasTeacherColumn) {
    // 向表头添加教师列
    const headerRow = scoreTable.querySelector("thead tr");
    if (headerRow) {
      const teacherHeader = document.createElement("th");
      teacherHeader.textContent = "评审教师";
      teacherHeader.className = "yibinu-plugin-added";
      headerRow.appendChild(teacherHeader);
      
      // 为每行添加教师信息
      const rows = scoreTable.querySelectorAll("tbody tr");
      rows.forEach((row, index) => {
        if (index < teacherInfoCache.length) {
          const teacherCell = document.createElement("td");
          teacherCell.textContent = teacherInfoCache[index].tea_name || "未知";
          teacherCell.className = "yibinu-plugin-added";
          
          // 如果有评语，添加悬停提示
          if (teacherInfoCache[index].opinion) {
            teacherCell.title = `评语: ${teacherInfoCache[index].opinion}`;
            teacherCell.style.cursor = "help";
          }
          
          row.appendChild(teacherCell);
        }
      });
      
      updateStatus("已成功显示教师信息");
    } else {
      console.error("[宜宾大学插件] 未找到表头行");
      updateStatus("未找到表头行，无法添加教师信息");
    }
  } else {
    updateStatus("教师信息列已存在");
  }
}

// 创建新表格显示教师信息
function createTeacherInfoTable() {
  // 检查是否已经存在我们的表格
  if (document.querySelector(".yibinu-teacher-info-table")) {
    updateStatus("教师信息表格已存在");
    return;
  }
  
  const container = document.createElement("div");
  container.className = "yibinu-plugin-container";
  container.style.margin = "20px 0";
  container.style.padding = "15px";
  container.style.border = "1px solid #ddd";
  container.style.borderRadius = "4px";
  
  const title = document.createElement("h3");
  title.textContent = "评审教师信息";
  title.style.marginBottom = "10px";
  container.appendChild(title);
  
  const table = document.createElement("table");
  table.className = "yibinu-teacher-info-table";
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  
  // 创建表头
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  
  const headers = ["教师姓名", "评分", "评审时间", "评语"];
  headers.forEach(text => {
    const th = document.createElement("th");
    th.textContent = text;
    th.style.padding = "8px";
    th.style.borderBottom = "2px solid #ddd";
    th.style.textAlign = "left";
    headerRow.appendChild(th);
  });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // 创建表格内容
  const tbody = document.createElement("tbody");
  
  teacherInfoCache.forEach(teacher => {
    const row = document.createElement("tr");
    
    // 教师姓名
    const nameCell = document.createElement("td");
    nameCell.textContent = teacher.tea_name || "未知";
    nameCell.style.padding = "8px";
    nameCell.style.borderBottom = "1px solid #ddd";
    row.appendChild(nameCell);
    
    // 评分
    const scoreCell = document.createElement("td");
    scoreCell.textContent = teacher.score || "无";
    scoreCell.style.padding = "8px";
    scoreCell.style.borderBottom = "1px solid #ddd";
    row.appendChild(scoreCell);
    
    // 评审时间
    const timeCell = document.createElement("td");
    timeCell.textContent = teacher.audit_time || "无";
    timeCell.style.padding = "8px";
    timeCell.style.borderBottom = "1px solid #ddd";
    row.appendChild(timeCell);
    
    // 评语
    const opinionCell = document.createElement("td");
    opinionCell.textContent = teacher.opinion || "无评语";
    opinionCell.style.padding = "8px";
    opinionCell.style.borderBottom = "1px solid #ddd";
    row.appendChild(opinionCell);
    
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  container.appendChild(table);
  
  // 寻找合适的插入位置
  const mainContent = document.querySelector("main") || 
                      document.querySelector(".main-content") || 
                      document.querySelector(".content") || 
                      document.body;
  
  // 尝试放在第一个表格后面
  const firstTable = document.querySelector("table");
  if (firstTable && firstTable.parentNode) {
    firstTable.parentNode.insertBefore(container, firstTable.nextSibling);
    updateStatus("已创建并显示教师信息表格");
  } else {
    // 如果找不到表格，添加到主内容区域开头
    mainContent.insertBefore(container, mainContent.firstChild);
    updateStatus("已创建并显示教师信息表格（添加到页面开头）");
  }
}

// 添加样式
function addStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .yibinu-plugin-added {
      background-color: #f0f8ff !important;
    }
    .yibinu-teacher-info-table tr:hover {
      background-color: #f5f5f5;
    }
    .yibinu-status-indicator {
      position: fixed;
      bottom: 10px;
      right: 10px;
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 9999;
      max-width: 300px;
      transition: opacity 0.3s;
    }
  `;
  document.head.appendChild(style);
}

// 添加状态指示器到页面
function addStatusIndicator() {
  const indicator = document.createElement("div");
  indicator.className = "yibinu-status-indicator";
  indicator.id = "yibinu-status";
  indicator.textContent = pluginStatus;
  indicator.style.opacity = "1";
  
  // 5秒后自动隐藏
  setTimeout(() => {
    indicator.style.opacity = "0";
  }, 5000);
  
  document.body.appendChild(indicator);
  
  // 更新状态时显示
  updateStatus(pluginStatus);
}

// 更新页面上的状态指示器
function updatePageStatus(status) {
  const indicator = document.getElementById("yibinu-status");
  if (indicator) {
    indicator.textContent = status;
    indicator.style.opacity = "1";
    
    // 5秒后自动隐藏
    setTimeout(() => {
      indicator.style.opacity = "0";
    }, 5000);
  }
}

// 初始化
function init() {
  updateStatus("插件初始化中...");
  interceptXHR();
  addStyles();
  
  // 页面加载完成后添加状态指示器
  if (document.readyState === "complete") {
    addStatusIndicator();
  } else {
    window.addEventListener("load", addStatusIndicator);
  }
  
  // 监听状态更新
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "statusUpdated") {
      updatePageStatus(message.status);
    }
  });
  
  updateStatus("插件已激活，等待页面请求数据...");
  console.log("[宜宾大学插件] 初始化完成，等待页面请求数据...");
}

// 启动插件
init(); 