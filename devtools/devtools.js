// 创建自定义面板
chrome.devtools.panels.create(
  "宜宾学院隐藏信息", // 面板标题
  "../icons/icon48.png", // 面板图标
  "panel.html", // 面板页面URL
  (panel) => {
    // 面板创建完成后的回调
    console.log("宜宾学院隐藏信息面板已创建");
  }
);

// 添加网络请求监听器
chrome.devtools.network.onRequestFinished.addListener((request) => {
  // 检查请求URL是否包含目标关键字
  if (request.request.url.includes('stuProjectShow')) {
    request.getContent((content, encoding) => {
      try {
        const data = JSON.parse(content);
        
        // 检查是否包含我们需要的数据结构
        if (data && 
            data.result && 
            data.result.college_export_score) {
          
          // 发送数据到background script
          chrome.runtime.sendMessage({
            action: "responseData",
            url: request.request.url,
            data: content
          });
        }
      } catch (error) {
        console.error('处理DevTools网络响应时出错:', error);
      }
    });
  }
}); 