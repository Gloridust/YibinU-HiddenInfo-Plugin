// 创建一个通用拦截器，用于捕获网络请求响应
const originalFetch = window.fetch;
const originalXHR = window.XMLHttpRequest.prototype.open;
const originalSend = window.XMLHttpRequest.prototype.send;
let pendingRequests = {};

// 拦截 Fetch API
window.fetch = async function(...args) {
  const url = args[0].url || args[0];
  const method = args[1]?.method || 'GET';
  
  // 继续原始fetch请求
  const response = await originalFetch.apply(this, args);
  
  // 如果URL包含目标关键字，获取响应内容
  if (url.toString().includes('stuProjectShow')) {
    try {
      // 克隆响应以不影响原始响应流
      const responseClone = response.clone();
      const responseText = await responseClone.text();
      
      console.log('Fetch 捕获到数据:', url.toString());
      
      // 发送数据到background.js
      chrome.runtime.sendMessage({
        action: "responseData",
        url: url.toString(),
        data: responseText
      });
    } catch (error) {
      console.error('拦截fetch响应时出错:', error);
    }
  }
  
  return response;
};

// 拦截 XMLHttpRequest
window.XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
  // 保存原始URL以便在send和onload事件中使用
  this._url = url;
  // 调用原始方法
  return originalXHR.apply(this, arguments);
};

// 拦截 XMLHttpRequest 的 send 方法
window.XMLHttpRequest.prototype.send = function(body) {
  const xhr = this;
  const url = xhr._url;
  
  if (url && url.toString().includes('stuProjectShow')) {
    // 添加加载完成事件监听器
    xhr.addEventListener('load', function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        try {
          console.log('XHR 捕获到数据:', url.toString());
          
          // 发送响应数据到background.js
          chrome.runtime.sendMessage({
            action: "responseData",
            url: url.toString(),
            data: xhr.responseText
          });
        } catch (error) {
          console.error('拦截XHR响应时出错:', error);
        }
      }
    });
  }
  
  // 调用原始方法
  return originalSend.apply(this, arguments);
};

// 页面加载完成后注入测试数据处理函数
window.addEventListener('load', () => {
  console.log('页面加载完成，准备监听网络请求...');
  
  // 注入一个用于手动测试的函数
  window.testCaptureData = function(jsonData) {
    try {
      if (typeof jsonData === 'string') {
        // 如果是字符串，尝试解析为JSON
        const data = JSON.parse(jsonData);
        processDataAndSend(data);
      } else {
        // 如果已经是对象，直接处理
        processDataAndSend(jsonData);
      }
    } catch (error) {
      console.error('测试数据处理出错:', error);
    }
  };
  
  // 处理并发送数据的辅助函数
  function processDataAndSend(data) {
    chrome.runtime.sendMessage({
      action: "responseData",
      url: "manual_test",
      data: JSON.stringify(data)
    }, response => {
      console.log('测试数据已发送到后台，响应:', response);
    });
  }
});

// 监听来自background.js的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "captureResponse" && message.url) {
    console.log('收到捕获请求:', message.url);
    sendResponse({received: true});
    return true;
  }
  
  // 如果收到了处理测试数据的请求
  if (message.action === "processTestData" && message.data) {
    try {
      const testData = JSON.parse(message.data);
      console.log('收到测试数据请求，数据长度:', message.data.length);
      
      // 将数据发送到background.js
      chrome.runtime.sendMessage({
        action: "responseData",
        url: "test_data_request",
        data: message.data
      });
      
      sendResponse({success: true});
    } catch (error) {
      console.error('处理测试数据出错:', error);
      sendResponse({success: false, error: error.message});
    }
    return true;
  }
}); 