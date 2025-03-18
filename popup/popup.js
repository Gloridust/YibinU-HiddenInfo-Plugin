document.addEventListener('DOMContentLoaded', function() {
  // 检查插件状态和数据
  chrome.storage.local.get(['teacherData', 'dataTimestamp', 'latestProjectRequest'], function(result) {
    const statusElement = document.getElementById('status');
    const featuresDiv = document.querySelector('.features');
    
    if (result.teacherData && result.teacherData.length > 0) {
      // 显示数据状态
      statusElement.className = 'status status-active';
      statusElement.textContent = '已获取到教师评分数据';
      
      // 显示收集到的教师数据数量
      const countElement = document.createElement('div');
      countElement.className = 'feature-item';
      countElement.innerHTML = `<strong>已收集数据：</strong> 共${result.teacherData.length}位教师的评分信息`;
      featuresDiv.appendChild(countElement);
      
      // 显示数据时间
      if (result.dataTimestamp) {
        const timeElement = document.createElement('div');
        timeElement.className = 'feature-item';
        const date = new Date(result.dataTimestamp);
        timeElement.innerHTML = `<strong>数据获取时间：</strong> ${date.toLocaleString()}`;
        featuresDiv.appendChild(timeElement);
      }
      
      // 添加刷新按钮
      const refreshBtn = document.createElement('button');
      refreshBtn.textContent = '刷新数据';
      refreshBtn.style.margin = '15px auto';
      refreshBtn.style.display = 'block';
      refreshBtn.style.padding = '5px 15px';
      refreshBtn.style.backgroundColor = '#409eff';
      refreshBtn.style.color = 'white';
      refreshBtn.style.border = 'none';
      refreshBtn.style.borderRadius = '4px';
      refreshBtn.style.cursor = 'pointer';
      
      refreshBtn.addEventListener('click', function() {
        // 清除现有数据
        chrome.storage.local.remove(['teacherData', 'dataTimestamp'], function() {
          // 通知激活的标签页重新获取数据
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {action: "checkForTeachers"});
              
              // 更新状态
              statusElement.textContent = '正在刷新数据...';
              
              // 2秒后刷新popup
              setTimeout(function() {
                window.location.reload();
              }, 2000);
            }
          });
        });
      });
      
      featuresDiv.appendChild(refreshBtn);
      
      // 添加教师数据摘要
      const dataPreview = document.createElement('div');
      dataPreview.className = 'feature-item';
      dataPreview.innerHTML = `<strong>教师评分摘要：</strong>`;
      
      const previewList = document.createElement('ul');
      previewList.style.margin = '5px 0';
      previewList.style.paddingLeft = '20px';
      
      // 最多显示3位教师的信息
      const previewCount = Math.min(result.teacherData.length, 3);
      for (let i = 0; i < previewCount; i++) {
        const teacher = result.teacherData[i];
        const item = document.createElement('li');
        item.textContent = `${teacher.tea_name}: ${teacher.score}分`;
        previewList.appendChild(item);
      }
      
      if (result.teacherData.length > 3) {
        const moreItem = document.createElement('li');
        moreItem.textContent = `...等${result.teacherData.length - 3}位教师`;
        previewList.appendChild(moreItem);
      }
      
      dataPreview.appendChild(previewList);
      featuresDiv.appendChild(dataPreview);
      
    } else {
      // 未获取到数据
      statusElement.className = 'status status-inactive';
      statusElement.textContent = '尚未获取到教师评分数据';
      
      // 如果有请求但没数据
      if (result.latestProjectRequest) {
        const requestInfo = document.createElement('div');
        requestInfo.className = 'feature-item';
        requestInfo.innerHTML = `<strong>检测到请求：</strong> 已捕获stuProjectShow请求，但未获取到评分数据`;
        featuresDiv.appendChild(requestInfo);
        
        // 添加指引
        const guideElement = document.createElement('div');
        guideElement.className = 'feature-item';
        guideElement.style.color = '#e6a23c';
        guideElement.innerHTML = `
          <strong>操作指引：</strong>
          <ol style="margin: 5px 0; padding-left: 20px;">
            <li>请确保您已登录宜宾学院系统</li>
            <li>访问项目评审页面</li>
            <li>点击"查看"按钮打开项目详情</li>
            <li>稍等片刻，插件将自动捕获数据</li>
          </ol>
        `;
        featuresDiv.appendChild(guideElement);
      } else {
        // 完全没有请求和数据
        const guideElement = document.createElement('div');
        guideElement.className = 'feature-item';
        guideElement.style.color = '#f56c6c';
        guideElement.innerHTML = `
          <strong>未检测到请求：</strong>
          <ol style="margin: 5px 0; padding-left: 20px;">
            <li>请访问宜宾学院项目评审系统</li>
            <li>点击项目"查看"按钮</li>
            <li>插件将自动捕获并显示教师评分信息</li>
          </ol>
        `;
        featuresDiv.appendChild(guideElement);
      }
      
      // 添加手动触发按钮
      const triggerBtn = document.createElement('button');
      triggerBtn.textContent = '手动触发数据获取';
      triggerBtn.style.margin = '15px auto';
      triggerBtn.style.display = 'block';
      triggerBtn.style.padding = '5px 15px';
      triggerBtn.style.backgroundColor = '#67c23a';
      triggerBtn.style.color = 'white';
      triggerBtn.style.border = 'none';
      triggerBtn.style.borderRadius = '4px';
      triggerBtn.style.cursor = 'pointer';
      
      triggerBtn.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "checkForTeachers", 
              forceRefresh: true
            });
            
            // 更新状态
            statusElement.textContent = '正在尝试获取数据...';
            
            // 3秒后刷新popup
            setTimeout(function() {
              window.location.reload();
            }, 3000);
          }
        });
      });
      
      featuresDiv.appendChild(triggerBtn);
    }
  });
  
  // 添加版本信息
  document.querySelector('.footer').innerHTML += '<br>更新时间: ' + new Date().toLocaleDateString();
}); 