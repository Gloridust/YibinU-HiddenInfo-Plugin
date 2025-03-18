// 创建一个通用拦截器，用于捕获网络请求响应
const originalFetch = window.fetch;
const originalXHR = window.XMLHttpRequest.prototype.open;
const originalSend = window.XMLHttpRequest.prototype.send;

// 拦截 Fetch API
window.fetch = async function(...args) {
  const url = args[0].url || args[0];
  
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

// 监听来自background.js的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "captureResponse" && message.url) {
    console.log('收到捕获请求:', message.url);
    sendResponse({received: true});
    return true;
  }
}); 