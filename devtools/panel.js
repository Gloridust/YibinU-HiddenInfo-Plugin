// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 获取页面元素
  const projectList = document.getElementById('project-list');
  const projectDetails = document.getElementById('project-details');
  const projectIdSpan = document.getElementById('project-id');
  const scoresTableBody = document.getElementById('scores-table-body');
  const refreshBtn = document.getElementById('refreshBtn');
  const clearBtn = document.getElementById('clearBtn');
  const exportXlsxBtn = document.getElementById('exportXlsxBtn');
  const backBtn = document.getElementById('backBtn');
  
  let currentData = {};
  let currentProjectId = null;
  
  // 加载所有捕获的项目数据
  function loadProjectData() {
    chrome.runtime.sendMessage({ action: "getProjectData" }, (response) => {
      currentData = response.data || {};
      renderProjectList();
    });
  }
  
  // 渲染项目列表
  function renderProjectList() {
    if (Object.keys(currentData).length === 0) {
      projectList.innerHTML = '<p class="no-data">暂无捕获到的项目数据，请浏览相关页面触发捕获。</p>';
      return;
    }
    
    let html = '<table><thead><tr><th>项目名称</th><th>项目ID</th><th>捕获时间</th><th>评分教师数</th><th>操作</th></tr></thead><tbody>';
    
    for (const projectId in currentData) {
      const project = currentData[projectId];
      const captureTime = new Date(project.timestamp).toLocaleString('zh-CN');
      const teacherCount = project.scores.length;
      const projectName = project.projectInfo?.name || '未知项目';
      const department = project.projectInfo?.department || '未知学院';
      
      html += `<tr>
                <td title="${projectName}">${projectName.length > 15 ? projectName.substring(0, 15) + '...' : projectName}</td>
                <td title="${projectId}">${projectId.substring(0, 8)}...</td>
                <td>${captureTime}</td>
                <td>${teacherCount}</td>
                <td><button class="button view-details" data-id="${projectId}">查看详情</button></td>
              </tr>`;
    }
    
    html += '</tbody></table>';
    projectList.innerHTML = html;
    
    // 添加查看详情按钮事件
    document.querySelectorAll('.view-details').forEach(button => {
      button.addEventListener('click', (e) => {
        const projectId = e.target.getAttribute('data-id');
        showProjectDetails(projectId);
      });
    });
  }
  
  // 显示项目详情
  function showProjectDetails(projectId) {
    currentProjectId = projectId;
    const project = currentData[projectId];
    
    if (!project) {
      alert('项目数据不存在或已被清除');
      return;
    }
    
    // 设置项目ID和标题
    const projectName = project.projectInfo?.name || '未知项目';
    document.querySelector('#project-details h2').textContent = projectName;
    projectIdSpan.textContent = `(ID: ${projectId})`;
    
    // 渲染教师评分表格
    let tableHtml = '';
    project.scores.forEach(score => {
      tableHtml += `<tr>
                      <td>${score.tea_name || '未知'}</td>
                      <td>${score.tch_no || '未知'}</td>
                      <td>${score.score || '未知'}</td>
                      <td>${score.audit_time || '未知'}</td>
                      <td>${score.opinion || '无意见'}</td>
                    </tr>`;
    });
    scoresTableBody.innerHTML = tableHtml;
    
    // 显示详情页面，隐藏列表页面
    projectList.parentElement.style.display = 'none';
    projectDetails.style.display = 'block';
  }
  
  // 返回项目列表
  function backToProjectList() {
    projectDetails.style.display = 'none';
    projectList.parentElement.style.display = 'block';
    currentProjectId = null;
  }
  
  // 导出为Excel文件
  function exportToExcel() {
    if (!currentProjectId || !currentData[currentProjectId]) {
      alert('无法导出：项目数据不存在');
      return;
    }
    
    try {
      const project = currentData[currentProjectId];
      const workbook = XLSX.utils.book_new();
      
      // 准备数据
      const tableData = project.scores.map(score => ({
        '老师姓名': score.tea_name || '未知',
        '工号': score.tch_no || '未知',
        '打分': score.score || '未知',
        '打分时间': score.audit_time || '未知',
        '是否支持': score.is_support === 1 ? '支持' : '不支持',
        '意见': score.opinion || '无意见'
      }));
      
      // 项目信息
      const projectName = project.projectInfo?.name || '未知项目';
      const projectInfo = [
        { '项目信息': '值' },
        { '项目信息': '项目名称', '值': projectName },
        { '项目信息': '项目ID', '值': currentProjectId },
        { '项目信息': '所属学院', '值': project.projectInfo?.department || '未知' },
        { '项目信息': '项目简介', '值': project.projectInfo?.summary || '无' },
        { '项目信息': '捕获时间', '值': new Date(project.timestamp).toLocaleString('zh-CN') },
        { '项目信息': '评分教师数', '值': project.scores.length }
      ];
      
      // 创建项目信息工作表
      const infoWorksheet = XLSX.utils.json_to_sheet(projectInfo, { skipHeader: true });
      XLSX.utils.book_append_sheet(workbook, infoWorksheet, '项目信息');
      
      // 创建评分工作表
      const scoreWorksheet = XLSX.utils.json_to_sheet(tableData);
      XLSX.utils.book_append_sheet(workbook, scoreWorksheet, '教师评分');
      
      // 设置列宽
      const columnWidths = [
        { wch: 10 },  // 老师姓名
        { wch: 12 },  // 工号
        { wch: 8 },   // 打分
        { wch: 20 },  // 打分时间
        { wch: 10 },  // 是否支持
        { wch: 40 }   // 意见
      ];
      scoreWorksheet['!cols'] = columnWidths;
      
      // 导出文件
      const fileName = `${projectName.substring(0, 20)}_评分_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('导出Excel时出错:', error);
      alert('导出失败：' + error.message);
    }
  }
  
  // 清除所有数据
  function clearAllData() {
    if (confirm('确定要清除所有捕获的项目数据吗？此操作不可撤销。')) {
      chrome.runtime.sendMessage({ action: "clearCapturedData" }, (response) => {
        if (response.success) {
          currentData = {};
          renderProjectList();
          // 如果正在查看详情，返回列表页面
          if (currentProjectId) {
            backToProjectList();
          }
          alert('所有数据已清除');
        }
      });
    }
  }
  
  // 事件监听
  refreshBtn.addEventListener('click', loadProjectData);
  clearBtn.addEventListener('click', clearAllData);
  backBtn.addEventListener('click', backToProjectList);
  exportXlsxBtn.addEventListener('click', exportToExcel);
  
  // 初始加载数据
  loadProjectData();
  
  // 监听来自background的更新消息
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "newDataCaptured") {
      // 刷新数据
      loadProjectData();
    }
  });
}); 