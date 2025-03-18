// 存储最近的stuProjectShow请求详情
let latestProjectShowRequest = null;

// 监听网络请求
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    // 检查请求URL是否包含stuProjectShow
    if (details.url.includes('stuProjectShow') && details.method === 'POST') {
      // 存储请求详情以便重放
      try {
        latestProjectShowRequest = {
          url: details.url,
          method: 'POST',
          requestId: details.requestId,
          timeStamp: details.timeStamp
        };
        
        // 如果存在请求体，保存它
        if (details.requestBody) {
          latestProjectShowRequest.requestBody = details.requestBody;
        }
        
        // 存储请求信息，以便内容脚本可以使用
        chrome.storage.local.set({ 
          'latestProjectRequest': latestProjectShowRequest,
          'isProjectShowRequest': true 
        });
      } catch (error) {
        console.error('保存请求详情时出错:', error);
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]  // 请求权限捕获请求体
);

// 监听网络响应
chrome.webRequest.onCompleted.addListener(
  function(details) {
    // 检查是否是我们感兴趣的请求
    if (details.url.includes('stuProjectShow') && details.method === 'POST') {
      // 更新请求状态
      if (latestProjectShowRequest && latestProjectShowRequest.requestId === details.requestId) {
        latestProjectShowRequest.completed = true;
        latestProjectShowRequest.statusCode = details.statusCode;
        
        // 更新存储
        chrome.storage.local.set({ 'latestProjectRequest': latestProjectShowRequest });
      }
      
      // 主动获取响应数据
      fetchTeacherData(details.url);
      
      // 通知内容脚本刷新页面数据
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs && tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            action: "checkForTeachers",
            requestDetails: latestProjectShowRequest
          });
        }
      });
    }
  },
  { urls: ["<all_urls>"] }
);

// 主动获取教师数据
function fetchTeacherData(url) {
  // 使用存储的请求信息重新发送请求
  if (latestProjectShowRequest) {
    let fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include' // 包含cookies
    };
    
    // 添加请求体（如果有）
    if (latestProjectShowRequest.requestBody && latestProjectShowRequest.requestBody.formData) {
      const formData = new FormData();
      for (const key in latestProjectShowRequest.requestBody.formData) {
        latestProjectShowRequest.requestBody.formData[key].forEach(value => {
          formData.append(key, value);
        });
      }
      fetchOptions.body = formData;
    } else if (latestProjectShowRequest.requestBody && latestProjectShowRequest.requestBody.raw) {
      // 处理原始请求体
      try {
        const decoder = new TextDecoder();
        const raw = latestProjectShowRequest.requestBody.raw[0].bytes;
        fetchOptions.body = decoder.decode(raw);
      } catch (e) {
        console.error('处理原始请求体失败', e);
      }
    }
    
    // 发送请求
    fetch(url, fetchOptions)
      .then(response => response.json())
      .then(data => {
        if (data && data.result && data.result.college_export_score) {
          // 保存教师数据
          chrome.storage.local.set({ 
            'teacherData': data.result.college_export_score,
            'dataTimestamp': Date.now()
          }, function() {
            console.log('成功获取并保存教师数据', data.result.college_export_score.length);
          });
        }
      })
      .catch(error => {
        console.error('获取教师数据失败:', error);
      });
  }
}

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveTeacherData" && message.data) {
    // 保存教师数据到本地存储
    chrome.storage.local.set({ 
      'teacherData': message.data,
      'dataTimestamp': Date.now()
    }, function() {
      console.log('教师数据已保存');
      sendResponse({ status: "success" });
    });
    return true; // 表示将异步发送响应
  }
  
  if (message.action === "getStoredRequest") {
    // 发送存储的请求信息给内容脚本
    chrome.storage.local.get(['latestProjectRequest', 'teacherData'], function(result) {
      sendResponse({ 
        request: result.latestProjectRequest,
        teacherData: result.teacherData
      });
    });
    return true; // 表示将异步发送响应
  }
}); 