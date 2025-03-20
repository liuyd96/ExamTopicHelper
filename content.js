// content.js
const overlay = document.createElement('div');
overlay.style.cssText = `
  position: fixed;
  top: 20px;
  right: 20px;
  width: 320px;
  background: rgba(255,255,255,0.95);
  border: 1px solid #ccc;
  padding: 15px;
  z-index: 9999;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  max-height: 80vh;
  overflow-y: auto;
`;

const shadow = overlay.attachShadow({ mode: 'open' });

const style = document.createElement('style');
style.textContent = `
  /* 保持原有样式不变 */
  .container { padding: 10px; }
  .header { margin-bottom: 15px; }
  .file-status { margin: 5px 0; color: #666; font-size: 0.9em; }
  .question-list { 
    margin: 10px 0; 
    max-height: 450px; 
    overflow-y: auto;
    display: flex;
    flex-wrap: wrap;
    gap: 2px; 
  }
  .question-item { 
    display: inline-block;
    margin: 2px;
    padding: 5px 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    width: calc(20% - 6px);
    text-align: center;
    box-sizing: border-box;
  }
  .pagination-controls {
    margin-top: 10px;
    display: flex;
    gap: 10px;
    align-items: center;
  }
  #pageStatus {
    font-size: 0.9em;
    color: #666;
  }
  .controls { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }
  button { 
    padding: 6px 12px;
    cursor: pointer;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #f8f8f8;
  }
  button:hover { background: #e8e8e8; }
  .current { background: #e0f0ff!important; }
  .correct { background: #98fb98!important; }
  .wrong { background: #ffb3b3!important; }
  .forgot { background: #ffd699!important; }
  .file-input { margin-bottom: 8px; }
`;

const container = document.createElement('div');
container.className = 'container';
container.innerHTML = `
  <div class="header">
    <input type="file" id="fileInput" class="file-input" accept=".txt">
    <div class="file-status">已加载文件：<span id="fileNameDisplay">无</span></div>
    <div class="controls">
      <button id="prevBtn">← 上一题</button>
      <button id="nextBtn">下一题 →</button>
    </div>
    <div class="controls">
      <button id="markCorrect" style="background: #98fb98">✔ 正确</button>
      <button id="markWrong" style="background: #ffb3b3">✖ 错误</button>
      <button id="markForgot" style="background: #ffd699">? 忘记</button>
    </div>
  </div>
  <div class="question-list" id="questionList"></div>
   <div class="pagination-controls">
      <button id="prevPage">上一页</button>
      <span id="pageStatus">第 <span id="currentPage">1</span> 页/共 <span id="totalPages">1</span> 页</span>
      <button id="nextPage">下一页</button>
    </div>
`;

shadow.appendChild(style);
shadow.appendChild(container);
document.body.appendChild(overlay);

// 状态管理
let questions = [];
let currentIndex = 0;
let marks = {};
let currentFileName = '无';
let pageIndex = 0;
const PAGE_SIZE = 50;

// 初始化时同步当前URL
chrome.storage.local.get(
    ['questions', 'currentIndex', 'marks', 'fileName', 'pageIndex'],
    async (result) => {
      questions = result.questions || [];
      marks = result.marks || {};
      currentFileName = result.fileName || '无';
  
      // 强制同步当前URL到索引
      if (questions.length > 0) {
        const currentURL = window.location.href;
        const actualIndex = questions.findIndex(url => url === currentURL);
        if (actualIndex !== -1) {
          currentIndex = actualIndex;
          pageIndex = Math.floor(currentIndex / PAGE_SIZE); // 强制计算页码
        } else {
          currentIndex = result.currentIndex || 0;
          pageIndex = result.pageIndex || 0;
        }
      }
  
      // 持久化最新状态
      await chrome.storage.local.set({ 
        currentIndex,
        pageIndex,
        questions,
        marks,
        fileName: currentFileName
      });
  
      shadow.getElementById('fileNameDisplay').textContent = currentFileName;
      renderQuestions();
    }
  );

// 文件上传处理（保持不变）
shadow.getElementById('fileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file && file.name.endsWith('.txt')) {
    const reader = new FileReader();
    reader.onload = (event) => {
      questions = event.target.result
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
      pageIndex = 0; // 新增重置页码
      chrome.storage.local.set({ pageIndex }); 
       
      currentIndex = 0;
      marks = {};
      currentFileName = file.name;

      chrome.storage.local.set({ 
        questions,
        currentIndex,
        marks,
        fileName: currentFileName
      });

      shadow.getElementById('fileNameDisplay').textContent = currentFileName;
      renderQuestions();
      navigateToCurrentQuestion(); // 新增立即跳转
    };
    reader.readAsText(file);
  }
});

// 渲染题目列表（保持不变）
function renderQuestions() {
  const list = shadow.getElementById('questionList');
  list.innerHTML = '';
  
  const start = pageIndex * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  
  questions.slice(start, end).forEach((url, localIndex) => {
    const globalIndex = start + localIndex;
    const item = document.createElement('div');
    
    // 清除旧类名重新应用
    item.className = 'question-item';
    if (marks[globalIndex]) item.classList.add(marks[globalIndex]);
    if (globalIndex === currentIndex) item.classList.add('current');

    item.textContent = globalIndex + 1;
    item.title = `题目 ${globalIndex + 1}\n${url}`;
    
    // 优化点击事件处理
    item.addEventListener('click', () => {
      if (globalIndex !== currentIndex) {
        currentIndex = globalIndex;
        const newPage = Math.floor(currentIndex / PAGE_SIZE);
        if (newPage !== pageIndex) {
          pageIndex = newPage;
          chrome.storage.local.set({ pageIndex }, () => renderQuestions());
        }
        chrome.storage.local.set({ currentIndex }, () => navigateToCurrentQuestion());
      }
    });
    
    list.appendChild(item);
  });

  // 更新分页显示
  shadow.getElementById('currentPage').textContent = pageIndex + 1;
  shadow.getElementById('totalPages').textContent = Math.ceil(questions.length / PAGE_SIZE) || 1;
}

// 分页控制事件
shadow.getElementById('prevPage').addEventListener('click', () => {
    if (pageIndex > 0) {
      pageIndex--;
      chrome.storage.local.set({ pageIndex });
      renderQuestions();
    }
  });
  
shadow.getElementById('nextPage').addEventListener('click', () => {
    const totalPages = Math.ceil(questions.length / PAGE_SIZE);
    if (pageIndex < totalPages - 1) {
      pageIndex++;
      chrome.storage.local.set({ pageIndex });
      renderQuestions();
    }
  });
  

// // 新增页码同步逻辑
// function updatePageIndexByCurrent() {
//     const newPage = Math.floor(currentIndex / PAGE_SIZE);
//     if (newPage !== pageIndex) {
//       pageIndex = newPage;
//       chrome.storage.local.set({ pageIndex });
//     }
//   }


// 新增导航功能
function navigateToCurrentQuestion() {
  if (questions.length === 0) return;
  const targetURL = questions[currentIndex];
  if (window.location.href !== targetURL) {
    window.location.href = targetURL;
  }
}

// 高亮当前题目
function highlightCurrentQuestion() {
  const items = shadow.querySelectorAll('.question-item');
  items.forEach((item, index) => {
    item.classList.toggle('current', index === currentIndex);
  });
}

// 修改导航按钮事件
shadow.getElementById('prevBtn').addEventListener('click', () => {
    if (currentIndex > 0) {
      currentIndex--;
      const newPage = Math.floor(currentIndex / PAGE_SIZE);
      
      if (newPage !== pageIndex) {
        pageIndex = newPage;
        chrome.storage.local.set({ pageIndex }, () => renderQuestions());
      }
      
      chrome.storage.local.set({ currentIndex }, () => {
        navigateToCurrentQuestion();
        renderQuestions(); // 强制重新渲染
      });
    }
  });
  
  shadow.getElementById('nextBtn').addEventListener('click', () => {
    if (currentIndex < questions.length - 1) {
      currentIndex++;
      const newPage = Math.floor(currentIndex / PAGE_SIZE);
      
      if (newPage !== pageIndex) {
        pageIndex = newPage;
        chrome.storage.local.set({ pageIndex }, () => renderQuestions());
      }
      
      chrome.storage.local.set({ currentIndex }, () => {
        navigateToCurrentQuestion();
        renderQuestions(); // 强制重新渲染
      });
    }
  });

// 标记功能（保持不变）
function markQuestion(status) {
  if (questions.length === 0) return;
  marks[currentIndex] = status;
  chrome.storage.local.set({ marks });
  renderQuestions();
}

shadow.getElementById('markCorrect').addEventListener('click', () => markQuestion('correct'));
shadow.getElementById('markWrong').addEventListener('click', () => markQuestion('wrong'));
shadow.getElementById('markForgot').addEventListener('click', () => markQuestion('forgot'));

// 新增页面加载完成后的同步
window.addEventListener('load', () => {
  chrome.storage.local.get(['questions', 'currentIndex'], (result) => {
    if (result.questions) {
      const currentURL = window.location.href;
      const index = result.questions.indexOf(currentURL);
      if (index !== -1 && index !== result.currentIndex) {
        currentIndex = index;
        chrome.storage.local.set({ currentIndex });
        renderQuestions();
      }
    }
  });
});