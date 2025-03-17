// 定义要监听的API URL
const targetUrl = "https://scjx2.yibinu.edu.cn/srtp/srtp/common/stuProjectShow";

// 插件当前状态
let currentStatus = "等待页面加载";

// 更新插件图标上的徽章
function updateBadge(text) {
  chrome.action.setBadgeText({ text: text });
  
  // 根据状态设置不同的徽章颜色
  if (text === "OK") {
    chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" }); // 绿色
  } else if (text === "等待") {
    chrome.action.setBadgeBackgroundColor({ color: "#2196F3" }); // 蓝色
  } else if (text === "错误") {
    chrome.action.setBadgeBackgroundColor({ color: "#F44336" }); // 红色
  }
}

// 使用chrome.webRequest API监听网络请求
chrome.webRequest.onCompleted.addListener(
  async (details) => {
    // 只处理来自浏览器本身的请求，不包括扩展发出的请求
    if (details.type !== "xmlhttprequest" || details.initiator && details.initiator.includes("chrome-extension")) return;
    
    try {
      console.log("[宜宾大学插件] 检测到API请求:", details.url);
      updateStatus("检测到API请求，正在处理...");
      
      // 获取当前标签页信息
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        console.error("[宜宾大学插件] 无法获取当前标签页");
        updateStatus("无法获取当前标签页");
        return;
      }
      
      // 向内容脚本发送消息，通知它刷新页面数据
      chrome.tabs.sendMessage(tab.id, { 
        action: "checkForTeacherInfo", 
        url: details.url 
      }, response => {
        if (chrome.runtime.lastError) {
          console.error("[宜宾大学插件] 发送消息时出错:", chrome.runtime.lastError);
          updateStatus("与内容脚本通信失败");
          return;
        }
        
        if (response && response.success) {
          updateBadge("OK");
        } else {
          updateBadge("等待");
        }
      });
    } catch (error) {
      console.error("[宜宾大学插件] 处理API响应时出错:", error);
      updateStatus("处理API响应时出错: " + error.message);
      updateBadge("错误");
    }
  },
  { urls: [targetUrl] }
);

// 更新插件状态
function updateStatus(status) {
  currentStatus = status;
  console.log("[宜宾大学插件] 状态更新:", status);
  
  // 向所有标签页广播状态更新
  chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => {
      if (tab.url && tab.url.includes("yibinu.edu.cn")) {
        chrome.tabs.sendMessage(tab.id, { 
          action: "statusUpdated", 
          status: status 
        }).catch(() => {
          // 忽略发送失败的错误
        });
      }
    });
  });
}

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getTeacherData") {
    sendResponse({ success: true, status: currentStatus });
  } else if (message.action === "updateStatus") {
    updateStatus(message.status);
    
    // 根据状态更新徽章
    if (message.status.includes("已获取") || message.status.includes("已成功")) {
      updateBadge("OK");
    } else if (message.status.includes("错误") || message.status.includes("失败")) {
      updateBadge("错误");
    } else {
      updateBadge("等待");
    }
    
    sendResponse({ success: true });
  } else if (message.action === "getStatus") {
    sendResponse({ status: currentStatus });
  }
  return true;
});

// 初始化
function init() {
  console.log("[宜宾大学插件] 后台脚本已启动");
  updateBadge("等待");
  updateStatus("插件已启动，等待访问宜宾大学项目评分系统");
}

// 启动插件
init(); 