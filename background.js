// 存储捕获到的项目评分数据
let capturedData = {};

// 监听网络请求
chrome.webRequest.onCompleted.addListener(
  async (details) => {
    // 只处理相关请求
    if ((details.type === 'xmlhttprequest' || details.type === 'fetch') && 
        details.url.includes('stuProjectShow')) {
      
      console.log('网络监听捕获请求:', details.url);
      
      // 尝试通过消息通知content script提取响应内容
      try {
        chrome.tabs.sendMessage(
          details.tabId,
          { action: "captureResponse", requestId: details.requestId, url: details.url }
        );
      } catch (error) {
        console.error('发送消息到content script时出错:', error);
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

// 处理捕获到的数据
function processResponseData(responseText, url) {
  try {
    // 尝试解析JSON数据
    const responseData = JSON.parse(responseText);
    console.log('解析到响应数据, URL:', url);
    
    // 检查是否包含我们需要的数据结构
    if (responseData && 
        responseData.result && 
        responseData.result.college_export_score &&
        responseData.result.college_export_score.length > 0) {
      
      const scoreData = responseData.result.college_export_score;
      const projectId = scoreData[0].project_id;
      
      // 提取项目基本信息
      const projectInfo = {
        name: responseData.result.name || '未知项目',
        summary: responseData.result.summary || '',
        department: responseData.result.dep_name || '未知学院'
      };
      
      console.log('找到项目评分数据，项目ID:', projectId, '，评分人数:', scoreData.length);
      
      // 存储捕获的数据
      capturedData[projectId] = {
        timestamp: new Date().toISOString(),
        scores: scoreData,
        projectInfo: projectInfo
      };
      
      // 将数据保存到Chrome存储
      chrome.storage.local.set({ 'capturedProjectData': capturedData }, () => {
        console.log('项目打分数据已保存');
        
        // 发送通知给popup
        chrome.runtime.sendMessage({
          action: "newDataCaptured",
          projectId: projectId,
          count: scoreData.length
        });
      });
      
      return true;
    } else {
      console.log('响应中未找到评分数据结构');
      return false;
    }
  } catch (error) {
    console.error('处理响应数据时出错:', error);
    return false;
  }
}

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 处理从content script接收到的响应数据
  if (message.action === "responseData" && message.data) {
    console.log('接收到来自content script的响应数据');
    
    const success = processResponseData(message.data, message.url);
    sendResponse({ success: success });
    return true;
  }
  
  // 处理popup请求获取所有捕获的数据
  if (message.action === "getProjectData") {
    console.log('接收到获取项目数据请求，当前有', Object.keys(capturedData).length, '个项目');
    sendResponse({ data: capturedData });
    return true; // 保持消息通道开放以进行异步响应
  }
  
  // 处理popup请求特定项目的数据
  if (message.action === "getProjectDetails" && message.projectId) {
    sendResponse({ data: capturedData[message.projectId] || null });
    return true;
  }
  
  // 处理清除数据的请求
  if (message.action === "clearCapturedData") {
    capturedData = {};
    chrome.storage.local.remove('capturedProjectData', () => {
      console.log('已清除所有捕获的项目数据');
    });
    sendResponse({ success: true });
    return true;
  }
  
  // 处理手动测试数据请求
  if (message.action === "testData" && message.data) {
    try {
      console.log('收到手动测试数据');
      const success = processResponseData(message.data, "manual_test");
      sendResponse({ success: success });
    } catch (error) {
      console.error('处理测试数据时出错:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});

// 启动时从存储中加载之前捕获的数据
chrome.storage.local.get('capturedProjectData', (result) => {
  if (result.capturedProjectData) {
    capturedData = result.capturedProjectData;
    console.log('已加载之前捕获的项目数据，共', Object.keys(capturedData).length, '个项目');
  }
});

// 为用户提供手动处理响应数据的函数
// 可以在插件的devtools面板中调用此函数测试
function manualProcessData(jsonData) {
  try {
    let dataStr;
    if (typeof jsonData === 'string') {
      dataStr = jsonData;
    } else {
      dataStr = JSON.stringify(jsonData);
    }
    return processResponseData(dataStr, "manual_input");
  } catch (error) {
    console.error('手动处理数据时出错:', error);
    return false;
  }
} 