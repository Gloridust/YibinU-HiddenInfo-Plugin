// 创建MutationObserver监听DOM变化
let observer = null;
let teacherData = null;
let requestDetails = null;

// 在页面加载完成后执行初始化
window.addEventListener('load', initializeExtension);

// 监听来自background的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkForTeachers") {
    // 保存请求详情（如果有）
    if (message.requestDetails) {
      requestDetails = message.requestDetails;
    }
    
    // 开始查找和处理网络响应数据
    findAndProcessTeacherData();
  }
});

// 初始化扩展
function initializeExtension() {
  console.log("宜宾学院隐藏信息插件已加载");
  
  // 创建观察器
  observer = new MutationObserver(mutations => {
    // 检查是否有相关的DOM变动
    const relevantChanges = mutations.some(mutation => {
      return mutation.addedNodes.length && 
        Array.from(mutation.addedNodes).some(node => {
          return node.nodeType === 1 && 
            (node.classList?.contains('el-table__body-wrapper') || 
             node.querySelector?.('.el-table__body-wrapper'));
        });
    });

    if (relevantChanges) {
      displayTeacherInfo();
    }
  });

  // 配置观察器
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });

  // 初始检查网络响应数据
  findAndProcessTeacherData();
  
  // 设置请求拦截
  setupFetchInterception();
  
  // 隔一段时间尝试检查一次（可以捕获到延迟加载的数据）
  setTimeout(findAndProcessTeacherData, 2000);
}

// 查找并处理教师数据
function findAndProcessTeacherData() {
  // 首先检查是否有缓存的教师数据
  chrome.storage.local.get(['teacherData', 'latestProjectRequest'], function(result) {
    if (result.teacherData) {
      teacherData = result.teacherData;
      
      // 如果有请求详情，保存它
      if (result.latestProjectRequest) {
        requestDetails = result.latestProjectRequest;
      }
      
      displayTeacherInfo();
    } else {
      // 如果没有缓存数据，从background请求最新数据
      getLatestRequestFromBackground();
    }
  });
}

// 从background获取最新的请求数据
function getLatestRequestFromBackground() {
  chrome.runtime.sendMessage({ action: "getStoredRequest" }, function(response) {
    if (response && response.teacherData) {
      teacherData = response.teacherData;
      
      if (response.request) {
        requestDetails = response.request;
      }
      
      displayTeacherInfo();
    } else {
      // 如果仍未获取到数据，尝试拦截新的请求
      interceptNetworkResponses();
    }
  });
}

// 设置Fetch API拦截
function setupFetchInterception() {
  // 保存原始的fetch函数
  const originalFetch = window.fetch;
  
  // 覆盖fetch
  window.fetch = async function(input, init) {
    // 调用原始fetch
    const response = await originalFetch.apply(this, arguments);
    
    // 创建响应的克隆，因为响应体只能被读取一次
    const responseClone = response.clone();
    
    // 检查URL是否含有我们想要的关键字
    let url = "";
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof Request) {
      url = input.url;
    }
    
    if (url.includes('stuProjectShow')) {
      // 处理响应
      responseClone.json().then(data => {
        if (data && data.result && data.result.college_export_score) {
          // 保存教师数据
          teacherData = data.result.college_export_score;
          
          // 发送数据到background.js进行存储
          chrome.runtime.sendMessage({
            action: "saveTeacherData",
            data: teacherData
          });
          
          // 更新显示
          displayTeacherInfo();
        }
      }).catch(error => {
        console.error('解析fetch响应失败:', error);
      });
    }
    
    // 返回原始响应
    return response;
  };
}

// 拦截网络响应
function interceptNetworkResponses() {
  // 创建一个钩子函数来拦截XHR响应
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function() {
    this._url = arguments[1];
    this._method = arguments[0];
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    if (this._url && this._url.includes('stuProjectShow')) {
      // 保存请求的原始数据以便后续重放
      this._requestData = arguments[0];
      
      const originalOnReadyStateChange = this.onreadystatechange;
      
      this.onreadystatechange = function() {
        if (this.readyState === 4 && this.status === 200) {
          try {
            const response = JSON.parse(this.responseText);
            if (response && response.result && response.result.college_export_score) {
              // 存储教师数据
              teacherData = response.result.college_export_score;
              
              // 发送数据到background.js进行存储
              chrome.runtime.sendMessage({
                action: "saveTeacherData",
                data: teacherData
              });
              
              // 更新显示
              displayTeacherInfo();
            }
          } catch (e) {
            console.error('解析响应失败:', e);
          }
        }
        
        if (originalOnReadyStateChange) {
          return originalOnReadyStateChange.apply(this, arguments);
        }
      };
    }
    
    return originalSend.apply(this, arguments);
  };
}

// 手动重新发送XHR请求获取数据
function replayStuProjectRequest() {
  if (!requestDetails || !requestDetails.url) {
    console.warn('没有可重放的请求详情');
    return;
  }
  
  console.log('尝试重放请求:', requestDetails.url);
  
  const xhr = new XMLHttpRequest();
  xhr.open('POST', requestDetails.url, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.withCredentials = true; // 发送cookies
  
  xhr.onload = function() {
    if (xhr.status === 200) {
      try {
        const response = JSON.parse(xhr.responseText);
        if (response && response.result && response.result.college_export_score) {
          teacherData = response.result.college_export_score;
          
          // 保存数据
          chrome.runtime.sendMessage({
            action: "saveTeacherData",
            data: teacherData
          });
          
          console.log('成功通过重放获取数据', teacherData);
          displayTeacherInfo();
        } else {
          console.warn('重放请求获取的数据不包含教师评分', response);
        }
      } catch (e) {
        console.error('解析重放响应失败:', e);
      }
    } else {
      console.error('重放请求失败，状态码:', xhr.status);
    }
  };
  
  xhr.onerror = function() {
    console.error('重放请求出错');
  };
  
  // 尝试发送请求体
  let requestBody = null;
  if (requestDetails.requestBody) {
    if (requestDetails.requestBody.formData) {
      const formData = new FormData();
      for (const key in requestDetails.requestBody.formData) {
        requestDetails.requestBody.formData[key].forEach(value => {
          formData.append(key, value);
        });
      }
      requestBody = formData;
    } else if (requestDetails.requestBody.raw) {
      try {
        const decoder = new TextDecoder();
        const raw = requestDetails.requestBody.raw[0].bytes;
        requestBody = decoder.decode(raw);
      } catch (e) {
        console.error('处理原始请求体失败', e);
      }
    }
  }
  
  xhr.send(requestBody);
}

// 显示教师信息
function displayTeacherInfo() {
  if (!teacherData) {
    console.warn('没有教师数据可显示，尝试重放请求');
    replayStuProjectRequest();
    return;
  }
  
  // 查找表格
  const tables = document.querySelectorAll('.el-table__body');
  if (!tables || tables.length === 0) {
    console.log('未找到相关表格，延迟尝试');
    setTimeout(displayTeacherInfo, 1000);
    return;
  }

  let teacherTableExists = document.getElementById('teacher-info-table');
  if (teacherTableExists) return; // 避免重复创建

  // 查找最合适的表格并在其后添加我们的教师信息表格
  const targetTable = Array.from(tables).find(table => {
    const headers = table.parentElement?.previousElementSibling?.querySelectorAll('.cell');
    return headers && Array.from(headers).some(cell => 
      cell.textContent.includes('审核阶段') || 
      cell.textContent.includes('审核时间') || 
      cell.textContent.includes('项目状态')
    );
  });
  
  if (!targetTable) {
    console.log('未找到目标表格，延迟尝试');
    setTimeout(displayTeacherInfo, 1000);
    return;
  }
  
  // 创建教师信息表格
  createTeacherInfoTable(targetTable);
}

// 创建教师信息表格
function createTeacherInfoTable(targetTable) {
  const parentDiv = targetTable.closest('.el-collapse-item__content');
  if (!parentDiv) {
    console.warn('未找到合适的父容器');
    return;
  }
  
  // 创建标题
  const titleDiv = document.createElement('div');
  titleDiv.style.fontSize = '16px';
  titleDiv.style.fontWeight = 'bold';
  titleDiv.style.margin = '20px 0 10px 0';
  titleDiv.textContent = '评审教师信息（由插件显示）';
  
  // 创建表格容器
  const tableContainer = document.createElement('div');
  tableContainer.id = 'teacher-info-table';
  tableContainer.className = 'el-table el-table--fit el-table--border el-table--enable-row-hover el-table--enable-row-transition el-table--small';
  tableContainer.style.width = '100%';
  
  // 创建表格HTML
  tableContainer.innerHTML = `
    <div class="el-table__header-wrapper">
      <table cellspacing="0" cellpadding="0" border="0" class="el-table__header" style="width: 100%;">
        <colgroup>
          <col width="15%">
          <col width="15%">
          <col width="15%">
          <col width="15%">
          <col width="40%">
        </colgroup>
        <thead>
          <tr>
            <th class="el-table__cell">
              <div class="cell">教师姓名</div>
            </th>
            <th class="el-table__cell">
              <div class="cell">教师编号</div>
            </th>
            <th class="el-table__cell">
              <div class="cell">评分</div>
            </th>
            <th class="el-table__cell">
              <div class="cell">评审时间</div>
            </th>
            <th class="el-table__cell">
              <div class="cell">评审意见</div>
            </th>
          </tr>
        </thead>
      </table>
    </div>
    <div class="el-table__body-wrapper is-scrolling-none">
      <table cellspacing="0" cellpadding="0" border="0" class="el-table__body" style="width: 100%;">
        <colgroup>
          <col width="15%">
          <col width="15%">
          <col width="15%">
          <col width="15%">
          <col width="40%">
        </colgroup>
        <tbody></tbody>
      </table>
    </div>
  `;
  
  // 添加表格和标题到页面
  parentDiv.appendChild(titleDiv);
  parentDiv.appendChild(tableContainer);
  
  // 填充表格数据
  const tbody = tableContainer.querySelector('tbody');
  
  if (teacherData.length > 0) {
    teacherData.forEach(teacher => {
      const row = document.createElement('tr');
      row.className = 'el-table__row';
      
      row.innerHTML = `
        <td class="el-table__cell">
          <div class="cell">${teacher.tea_name || '未知'}</div>
        </td>
        <td class="el-table__cell">
          <div class="cell">${teacher.tch_no || '未知'}</div>
        </td>
        <td class="el-table__cell">
          <div class="cell">${teacher.score || '未知'}</div>
        </td>
        <td class="el-table__cell">
          <div class="cell">${teacher.audit_time || '未知'}</div>
        </td>
        <td class="el-table__cell">
          <div class="cell">${teacher.opinion || '无评审意见'}</div>
        </td>
      `;
      
      tbody.appendChild(row);
    });
    
    // 添加成功获取数据的信息到控制台
    console.log(`成功显示${teacherData.length}位教师的评分信息`);
  } else {
    // 如果没有数据，显示提示信息
    const emptyRow = document.createElement('tr');
    emptyRow.className = 'el-table__row';
    emptyRow.innerHTML = `
      <td class="el-table__cell" colspan="5">
        <div class="cell" style="text-align: center;">暂无教师评分数据</div>
      </td>
    `;
    tbody.appendChild(emptyRow);
  }
} 