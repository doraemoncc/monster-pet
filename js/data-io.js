/**
 * 数据导入/导出模块
 * JSON 完整备份 + CSV 打卡报表 + 导入恢复
 */

// ===== 分类映射 =====
const CATEGORY_NAMES = {
  school: '学校作业',
  tutoring: '课外辅导',
  reading: '阅读',
  hobby: '兴趣爱好',
  sport: '运动',
  other: '其他',
  daily: '日常'
};

// ===== 工具函数 =====
function getDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}分${s}秒`;
}

function triggerDownload(content, filename, mimeType) {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType }); // BOM for Excel 兼容
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// ===== 导出 JSON 完整备份 =====
function exportJSONBackup() {
  const data = localStorage.getItem(window.store.STORAGE_KEY);
  if (!data) {
    window.showToast('没有数据可导出', 'warning');
    return;
  }

  // 添加导出元信息
  const exportData = {
    _meta: {
      appName: '小怪兽养成记',
      exportDate: new Date().toISOString(),
      version: '1.0'
    },
    ...JSON.parse(data)
  };

  const json = JSON.stringify(exportData, null, 2);
  const dateStr = getDateStr();
  triggerDownload(json, `打卡小达人_备份_${dateStr}.json`, 'application/json');
  window.showToast('备份导出成功！', 'success');
}

// ===== 导出 CSV 打卡报表 =====
function exportCSVReport() {
  const history = window.store.get('completedHistory') || [];

  if (history.length === 0) {
    window.showToast('还没有完成记录，快去打卡吧~', 'warning');
    return;
  }

  // CSV 表头
  const headers = ['日期', '任务名称', '分类', '获得星币', '经验值', '用时', '早鸟奖励', '连击加成'];

  // CSV 数据行
  const rows = history.map(h => {
    const date = h.completedAt ? h.completedAt.slice(0, 10) : '';
    const category = CATEGORY_NAMES[h.category] || h.category || '';
    const coins = h.coins || 0;
    const exp = h.exp || 0;
    const duration = formatDuration(h.duration);
    const earlyBird = h.isEarlyBird ? '是' : '否';
    const bonus = h.bonusDetail?.combo ? `x${h.bonusDetail.combo}` : '';

    return [date, h.title, category, coins, exp, duration, earlyBird, bonus]
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',');
  });

  // 汇总统计
  const totalCoins = history.reduce((sum, h) => sum + (h.coins || 0), 0);
  const totalExp = history.reduce((sum, h) => sum + (h.exp || 0), 0);
  const totalTasks = history.length;
  const dates = [...new Set(history.map(h => h.completedAt?.slice(0, 10)).filter(Boolean))];
  const totalDays = dates.length;

  // 统计摘要
  const summary = [
    '',
    '--- 统计摘要 ---',
    '',
    `总打卡次数,${totalTasks}`,
    `打卡天数,${totalDays}`,
    `累计星币,${totalCoins}`,
    `累计经验,${totalExp}`,
    '',
    '--- 每日明细 ---',
    ''
  ].map(r => {
    if (r.startsWith('---')) return r;
    if (r === '') return '';
    return r.split(',').map(v => `"${v}"`).join(',');
  }).join('\n');

  // 日期 → 每日统计
  const dailyStats = {};
  history.forEach(h => {
    const date = h.completedAt?.slice(0, 10) || '未知日期';
    if (!dailyStats[date]) dailyStats[date] = { tasks: 0, coins: 0, totalDuration: 0 };
    dailyStats[date].tasks++;
    dailyStats[date].coins += (h.coins || 0);
    dailyStats[date].totalDuration += (h.duration || 0);
  });

  const dailyRows = Object.entries(dailyStats)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stat]) => {
      const avgDuration = stat.tasks > 0 ? Math.round(stat.totalDuration / stat.tasks) : 0;
      return [date, stat.tasks, stat.coins, formatDuration(avgDuration)]
        .map(v => `"${v}"`).join(',');
    });

  const dailyHeader = '"日期","完成数","星币","平均用时"';

  const csv = [
    headers.join(','),
    ...rows,
    summary,
    dailyHeader,
    ...dailyRows
  ].join('\n');

  const dateStr = getDateStr();
  triggerDownload(csv, `打卡小达人_报表_${dateStr}.csv`, 'text/csv;charset=utf-8');
  window.showToast('报表导出成功！', 'success');
}

// ===== 导入 JSON 数据恢复 =====
function importJSONData(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const raw = e.target.result;
      const parsed = JSON.parse(raw);

      // 检查是否是我们导出的格式（有 _meta 或有 tasks/user 等核心字段）
      let data = parsed;
      if (data._meta) {
        // 移除元信息，只保留业务数据
        const { _meta, ...businessData } = data;
        data = businessData;
      }

      // 基本校验
      if (!data.tasks || !data.user) {
        window.showToast('文件格式不正确，请选择正确的备份文件', 'warning');
        return;
      }

      // 确认导入
      const taskCount = data.tasks.length;
      const coinCount = data.user.coins || 0;
      const confirmed = await window.showConfirm(
        `确认导入？\n\n📋 ${taskCount} 个任务\n💰 ${coinCount} 星币\n\n⚠️ 将覆盖当前所有数据！`
      );

      if (!confirmed) return;

      // 写入数据
      localStorage.setItem(window.store.STORAGE_KEY, JSON.stringify(data));
      window.store.init();

      // 刷新页面
      window.showToast('数据恢复成功！页面即将刷新...', 'success');
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      console.error('导入失败:', err);
      window.showToast('文件解析失败，请确认是正确的备份文件', 'warning');
    }
  };

  reader.readAsText(file);
}

// ===== 渲染数据管理页面 =====
function renderDataManagement(container) {
  const history = window.store.get('completedHistory') || [];
  const totalCoins = history.reduce((sum, h) => sum + (h.coins || 0), 0);
  const totalTasks = history.length;
  const dates = [...new Set(history.map(h => h.completedAt?.slice(0, 10)).filter(Boolean))];
  const totalDays = dates.length;

  container.innerHTML = `
    <div class="data-panel">
      <!-- 数据概览 -->
      <div class="data-overview">
        <div class="data-stat">
          <div class="data-stat-value">${totalTasks}</div>
          <div class="data-stat-label">累计打卡</div>
        </div>
        <div class="data-stat">
          <div class="data-stat-value">${totalDays}</div>
          <div class="data-stat-label">打卡天数</div>
        </div>
        <div class="data-stat">
          <div class="data-stat-value">💰${totalCoins}</div>
          <div class="data-stat-label">累计星币</div>
        </div>
      </div>

      <!-- 导出按钮 -->
      <div class="data-section">
        <div class="data-section-title">📤 导出数据</div>
        <div class="data-actions">
          <button class="btn-data" id="btn-export-json">
            <span class="data-btn-icon">📦</span>
            <div class="data-btn-text">
              <div class="data-btn-name">完整备份</div>
              <div class="data-btn-desc">导出全部数据为 JSON 文件</div>
            </div>
          </button>
          <button class="btn-data" id="btn-export-csv" ${totalTasks === 0 ? 'disabled' : ''}>
            <span class="data-btn-icon">📊</span>
            <div class="data-btn-text">
              <div class="data-btn-name">打卡报表</div>
              <div class="data-btn-desc">导出 CSV 表格，可用 Excel 打开</div>
            </div>
          </button>
        </div>
      </div>

      <!-- 导入按钮 -->
      <div class="data-section">
        <div class="data-section-title">📥 导入数据</div>
        <div class="data-actions">
          <button class="btn-data btn-data-import" id="btn-import-json">
            <span class="data-btn-icon">📋</span>
            <div class="data-btn-text">
              <div class="data-btn-name">恢复备份</div>
              <div class="data-btn-desc">从 JSON 文件恢复数据</div>
            </div>
          </button>
          <input type="file" id="import-file-input" accept=".json" style="display:none" />
        </div>
        <div class="data-import-hint">⚠️ 导入会覆盖当前所有数据，请谨慎操作</div>
      </div>
    </div>
  `;

  // 绑定事件
  document.getElementById('btn-export-json')?.addEventListener('click', exportJSONBackup);
  document.getElementById('btn-export-csv')?.addEventListener('click', exportCSVReport);

  const importBtn = document.getElementById('btn-import-json');
  const fileInput = document.getElementById('import-file-input');

  importBtn?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      importJSONData(file);
      fileInput.value = ''; // 清空以便再次选同一文件
    }
  });
}

// 暴露给 parent-panel 调用
window.renderDataManagement = renderDataManagement;
