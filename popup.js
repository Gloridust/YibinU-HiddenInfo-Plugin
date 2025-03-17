// 弹出窗口初始化
document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const statusElement = document.getElementById('status');
  const currentStatusElement = document.getElementById('current-status');
  const dataStatusElement = document.getElementById('data-status');
  const pageUrlElement = document.getElementById('page-url');
  const refreshButton = document.getElementById('refresh-status');
  
  // 刷新状态按钮点击事件
  refreshButton.addEventListener('click', function() {
    refreshStatus();
  });
  
  // 初始化时获取状态
  refreshStatus();
  
  // 刷新状态函数
  function refreshStatus() {
    currentStatusElement.textContent = "正在获取...";
    dataStatusElement.textContent = "正在获取...";
    pageUrlElement.textContent = "正在获取...";
    
    // 获取当前标签页
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        updateStatus(false, '无法获取当前标签页信息');
        currentStatusElement.textContent = "无法获取标签页";
        dataStatusElement.textContent = "未知";
        pageUrlElement.textContent = "未知";
        return;
      }
      
      const currentUrl = tabs[0].url;
      pageUrlElement.textContent = currentUrl || "未知";
      
      // 判断当前是否在宜宾大学的网站上
      if (currentUrl && currentUrl.includes('yibinu.edu.cn')) {
        updateStatus(true, '插件已激活，正在监听宜宾大学项目评分系统。');
        
        // 获取后台脚本的状态
        chrome.runtime.sendMessage({ action: "getStatus" }, function(response) {
          if (chrome.runtime.lastError) {
            console.error("获取状态时出错:", chrome.runtime.lastError);
            currentStatusElement.textContent = "通信错误";
            return;
          }
          
          if (response && response.status) {
            currentStatusElement.textContent = response.status;
          } else {
            currentStatusElement.textContent = "未知状态";
          }
        });
        
        // 获取内容脚本的数据状态
        chrome.tabs.sendMessage(tabs[0].id, { action: "getStatus" }, function(response) {
          if (chrome.runtime.lastError) {
            console.error("获取内容脚本状态时出错:", chrome.runtime.lastError);
            dataStatusElement.textContent = "未注入或通信错误";
            return;
          }
          
          if (response && response.status) {
            dataStatusElement.textContent = response.status;
          } else {
            dataStatusElement.textContent = "未知";
          }
        });
      } else {
        updateStatus(false, '您当前不在宜宾大学网站上，插件处于待命状态。');
        currentStatusElement.textContent = "未在目标网站";
        dataStatusElement.textContent = "未激活";
      }
    });
  }
});

// 更新状态显示
function updateStatus(isActive, message) {
  const statusElement = document.getElementById('status');
  
  if (isActive) {
    statusElement.className = 'status active';
  } else {
    statusElement.className = 'status inactive';
  }
  
  statusElement.textContent = message;
} 