// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 获取页面元素
  const projectList = document.getElementById('project-list');
  const openDevToolsBtn = document.getElementById('openDevToolsBtn');
  const clearDataBtn = document.getElementById('clearDataBtn');
  const testPageBtn = document.getElementById('testPageBtn');
  
  // 加载捕获的项目数据
  function loadProjectData() {
    chrome.runtime.sendMessage({ action: "getProjectData" }, (response) => {
      const data = response.data || {};
      
      if (Object.keys(data).length === 0) {
        projectList.innerHTML = '<div class="no-data">暂无捕获的项目数据</div>';
        return;
      }
      
      let html = '';
      // 获取最近的5个项目
      const recentProjects = Object.entries(data)
        .sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp))
        .slice(0, 5);
      
      recentProjects.forEach(([projectId, project]) => {
        const captureTime = new Date(project.timestamp).toLocaleString('zh-CN');
        const teacherCount = project.scores.length;
        const projectName = project.projectInfo?.name || '未知项目';
        
        html += `
          <div class="project-item" data-id="${projectId}">
            <div class="project-title">${projectName}</div>
            <div class="project-meta">
              ID: ${projectId.substring(0, 8)}...
              <span class="badge">${teacherCount} 位老师</span>
            </div>
            <div class="project-meta">
              捕获时间: ${captureTime}
            </div>
          </div>
        `;
      });
      
      projectList.innerHTML = html;
      
      // 添加项目点击事件
      document.querySelectorAll('.project-item').forEach(item => {
        item.addEventListener('click', () => {
          // 打开DevTools并切换到我们的面板
          chrome.tabs.create({ url: 'devtools/panel.html' });
        });
      });
    });
  }
  
  // 清除所有数据
  function clearAllData() {
    if (confirm('确定要清除所有捕获的项目数据吗？此操作不可撤销。')) {
      chrome.runtime.sendMessage({ action: "clearCapturedData" }, (response) => {
        if (response.success) {
          loadProjectData();
          showToast('所有数据已清除');
        }
      });
    }
  }
  
  // 显示Toast提示
  function showToast(message) {
    const statusSection = document.getElementById('status-section');
    statusSection.innerHTML = `<div class="status">${message}</div>`;
    
    // 3秒后恢复原状态
    setTimeout(() => {
      statusSection.innerHTML = '<div class="status">插件已激活，正在监听网络请求</div>';
    }, 3000);
  }
  
  // 打开DevTools面板页面
  function openDevToolsPanel() {
    chrome.tabs.create({ url: 'devtools/panel.html' });
  }
  
  // 打开测试页面
  function openTestPage() {
    chrome.tabs.create({ url: 'test.html' });
  }
  
  // 处理用户提供的JSON数据
  function processJsonData(jsonString) {
    try {
      chrome.runtime.sendMessage({
        action: "testData",
        data: jsonString
      }, (response) => {
        if (response && response.success) {
          showToast('数据处理成功，已添加到项目列表');
          // 刷新显示
          loadProjectData();
        } else {
          showToast('数据处理失败: ' + (response?.error || '未找到有效的评分数据'));
        }
      });
    } catch (error) {
      showToast('处理数据出错: ' + error.message);
    }
  }
  
  // 事件监听
  openDevToolsBtn.addEventListener('click', openDevToolsPanel);
  clearDataBtn.addEventListener('click', clearAllData);
  testPageBtn.addEventListener('click', openTestPage);
  
  // 监听来自background的更新消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "newDataCaptured") {
      // 更新数据
      loadProjectData();
      showToast(`新项目数据已捕获: ${message.projectId.substring(0, 8)}...`);
    }
    
    // 处理直接数据处理请求
    if (message.action === "processJsonData" && message.data) {
      processJsonData(message.data);
      sendResponse({ received: true });
      return true;
    }
  });
  
  // 初始加载数据
  loadProjectData();
  
  // 添加右键菜单支持 - 仅在开发者模式下显示，为了调试方便
  if (chrome.contextMenus) {
    chrome.contextMenus.create({
      id: "processJsonData",
      title: "处理宜宾学院项目数据",
      contexts: ["selection"]
    });
    
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === "processJsonData" && info.selectionText) {
        processJsonData(info.selectionText);
      }
    });
  }
}); 