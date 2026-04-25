/**
 * 数据中心模块
 * 📊 统计 Tab：概览卡片 + 柱状图 + 时间范围图
 * 📤 数据 Tab：导出预览 + JSON备份 + CSV报表
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
  if (m === 0) return `${s}秒`;
  if (s === 0) return `${m}分`;
  return `${m}分${s}秒`;
}

function formatDurationHM(seconds) {
  if (!seconds || seconds <= 0) return '0';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function toLocalTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function toLocalDate(isoStr) {
  if (!isoStr) return '';
  return isoStr.slice(0, 10);
}

function shortDate(dateStr) {
  // '2026-04-25' → '4/25'
  const parts = dateStr.split('-');
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
}

function getRangeStart(range) {
  const now = new Date();
  if (range === '7d') {
    now.setDate(now.getDate() - 6);
    now.setHours(0, 0, 0, 0);
  } else if (range === '30d') {
    now.setDate(now.getDate() - 29);
    now.setHours(0, 0, 0, 0);
  }
  return now.toISOString();
}

function filterByRange(records, range) {
  if (range === 'all') return records;
  const start = getRangeStart(range);
  return records.filter(r => {
    const ts = r.completedAt || r.timestamp;
    return ts && ts >= start;
  });
}

function triggerDownload(content, filename, mimeType) {
  const isCSV = mimeType.includes('csv');
  const prefix = isCSV ? '\uFEFF' : '';
  const blob = new Blob([prefix + content], { type: mimeType });
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

// ===== 数据聚合 =====

function aggregateByDate(history, interactions, range) {
  const filtered = filterByRange(history, range);
  const filteredInter = filterByRange(interactions, range);

  // 按日期聚合任务
  const byDate = {};
  filtered.forEach(h => {
    const date = toLocalDate(h.completedAt);
    if (!date) return;
    if (!byDate[date]) {
      byDate[date] = {
        date,
        count: 0,
        totalDuration: 0,
        totalCoins: 0,
        totalExp: 0,
        earlyBirdCount: 0,
        earliestStart: null,
        latestEnd: null,
        tasks: []
      };
    }
    const d = byDate[date];
    d.count++;
    d.totalDuration += (h.duration || 0);
    d.totalCoins += (h.coins || 0);
    d.totalExp += (h.exp || 0);
    if (h.isEarlyBird) d.earlyBirdCount++;
    if (h.startedAt && (!d.earliestStart || h.startedAt < d.earliestStart)) {
      d.earliestStart = h.startedAt;
    }
    if (h.completedAt && (!d.latestEnd || h.completedAt > d.latestEnd)) {
      d.latestEnd = h.completedAt;
    }
    d.tasks.push(h);
  });

  // 合并互动数据
  filteredInter.forEach(i => {
    const date = toLocalDate(i.timestamp);
    if (!date || !byDate[date]) return;
    if (!byDate[date].feedCount) byDate[date].feedCount = 0;
    if (!byDate[date].playCount) byDate[date].playCount = 0;
    if (!byDate[date].feedCost) byDate[date].feedCost = 0;
    if (i.type === 'feed') {
      byDate[date].feedCount++;
      byDate[date].feedCost += (i.cost || 0);
    } else {
      byDate[date].playCount++;
    }
  });

  // 转为数组并按日期排序
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

function computeOverview(dailyData, interactions, range) {
  const totalTasks = dailyData.reduce((s, d) => s + d.count, 0);
  const activeDays = dailyData.length;
  const totalCoins = dailyData.reduce((s, d) => s + d.totalCoins, 0);
  const totalDuration = dailyData.reduce((s, d) => s + d.totalDuration, 0);
  const totalInter = filterByRange(interactions, range).length;
  return { totalTasks, activeDays, totalCoins, totalDuration, totalInter };
}

// ===== 柱状图渲染（纯 HTML/CSS）=====

function renderBarChart(container, data, type, onBarClick) {
  if (data.length === 0) {
    container.innerHTML = '<div class="stats-empty">暂无数据</div>';
    return;
  }

  const maxVal = Math.max(...data.map(d => type === 'count' ? d.count : Math.round(d.totalDuration / 60)), 1);
  // 计算合理的 Y 轴最大值（向上取整到 5 的倍数）
  const yMax = Math.max(Math.ceil(maxVal / 5) * 5, 5);

  container.innerHTML = `
    <div class="stats-chart">
      <div class="stats-chart-y">
        ${yMax}│
        <br>${Math.round(yMax * 0.75)}│
        <br>${Math.round(yMax * 0.5)}│
        <br>${Math.round(yMax * 0.25)}│
        <br>0 │
      </div>
      <div class="stats-chart-body">
        <div class="stats-chart-grid">
          <div class="stats-chart-line" style="bottom:100%"></div>
          <div class="stats-chart-line" style="bottom:75%"></div>
          <div class="stats-chart-line" style="bottom:50%"></div>
          <div class="stats-chart-line" style="bottom:25%"></div>
        </div>
        <div class="stats-chart-bars">
          ${data.map(d => {
            const val = type === 'count' ? d.count : Math.round(d.totalDuration / 60);
            const pct = Math.round((val / yMax) * 100);
            const label = type === 'count' ? `${val}` : `${val}m`;
            return `
              <div class="stats-chart-col" data-date="${d.date}">
                <div class="stats-chart-val">${val > 0 ? label : ''}</div>
                <div class="stats-chart-track">
                  <div class="stats-chart-bar" style="height:${Math.max(pct, 2)}%"></div>
                </div>
                <div class="stats-chart-label">${shortDate(d.date)}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  // 点击柱子展开明细
  container.querySelectorAll('.stats-chart-col').forEach(col => {
    col.addEventListener('click', () => {
      const date = col.dataset.date;
      const d = data.find(dd => dd.date === date);
      if (d && onBarClick) onBarClick(d, col);
    });
  });
}

// ===== 时间范围图渲染 =====

function renderTimelineChart(container, data) {
  // 过滤出有 startedAt 或 completedAt 的数据，取最近 60 天
  const timelineData = data.filter(d => d.earliestStart || d.latestEnd).slice(-60);
  if (timelineData.length === 0) {
    container.innerHTML = '<div class="stats-empty">暂无数据</div>';
    return;
  }

  // 时间轴范围：6:00 ~ 23:00（共 17 小时）
  const hourStart = 6;
  const hourEnd = 23;
  const totalHours = hourEnd - hourStart;

  container.innerHTML = `
    <div class="stats-timeline">
      <div class="stats-timeline-header">
        <div class="stats-timeline-date-col"></div>
        <div class="stats-timeline-hours">
          ${Array.from({length: totalHours}, (_, i) => {
            const h = hourStart + i;
            return `<span class="stats-timeline-hr">${h % 2 === 0 ? h : ''}</span>`;
          }).join('')}
        </div>
      </div>
      ${timelineData.map(d => {
        const start = d.earliestStart ? new Date(d.earliestStart) : null;
        const end = d.latestEnd ? new Date(d.latestEnd) : null;
        const startH = start ? Math.max((start.getHours() + start.getMinutes() / 60) - hourStart, 0) : 0;
        const endH = end ? Math.min((end.getHours() + end.getMinutes() / 60) - hourStart, totalHours) : startH + 0.5;
        const leftPct = (startH / totalHours * 100).toFixed(1);
        const widthPct = (Math.max(endH - startH, 0.3) / totalHours * 100).toFixed(1);
        const startLabel = start ? toLocalTime(d.earliestStart) : '';
        const endLabel = end ? toLocalTime(d.latestEnd) : '';
        return `
          <div class="stats-timeline-row" data-date="${d.date}" title="${startLabel} ~ ${endLabel}">
            <div class="stats-timeline-date-col">${shortDate(d.date)}</div>
            <div class="stats-timeline-track">
              <div class="stats-timeline-bar" style="left:${leftPct}%;width:${widthPct}%"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ===== 每日明细展开 =====

function renderDayDetail(dailyItem, anchorEl) {
  // 如果已经有展开的，先关闭
  const existing = anchorEl.closest('.stats-section').querySelector('.stats-day-detail');
  if (existing) { existing.remove(); return; }

  const tasks = dailyItem.tasks || [];
  const detail = document.createElement('div');
  detail.className = 'stats-day-detail';
  detail.innerHTML = `
    <div class="stats-detail-header">
      ${dailyItem.date} · ${dailyItem.count} 个任务 · ${formatDurationHM(dailyItem.totalDuration)}
      ${dailyItem.earliestStart ? ` · ${toLocalTime(dailyItem.earliestStart)} ~ ${toLocalTime(dailyItem.latestEnd)}` : ''}
    </div>
    ${tasks.map(t => `
      <div class="stats-detail-item">
        <span class="stats-detail-title">${t.title}</span>
        <span class="stats-detail-coins">💰${t.coins}</span>
        ${t.duration ? `<span class="stats-detail-dur">${formatDuration(t.duration)}</span>` : ''}
        ${t.isEarlyBird ? '<span class="stats-detail-early">🌅</span>' : ''}
      </div>
    `).join('')}
  `;
  anchorEl.after(detail);
}

// ===== 📊 统计 Tab 主渲染 =====

function renderStatsTab(container) {
  const history = window.store.get('completedHistory') || [];
  const interactions = window.store.get('interactionHistory') || [];
  let currentRange = '7d';

  function render() {
    const dailyData = aggregateByDate(history, interactions, currentRange);
    const overview = computeOverview(dailyData, interactions, currentRange);

    container.innerHTML = `
      <div class="stats-container">
        <!-- 时间范围选择器 -->
        <div class="stats-range-selector">
          <button class="stats-range-btn ${currentRange === '7d' ? 'active' : ''}" data-range="7d">近7天</button>
          <button class="stats-range-btn ${currentRange === '30d' ? 'active' : ''}" data-range="30d">近30天</button>
          <button class="stats-range-btn ${currentRange === 'all' ? 'active' : ''}" data-range="all">全部</button>
        </div>

        <!-- 概览卡片 -->
        <div class="stats-overview">
          <div class="stats-card">
            <div class="stats-card-value">${overview.totalTasks}</div>
            <div class="stats-card-label">完成数</div>
          </div>
          <div class="stats-card">
            <div class="stats-card-value">${overview.activeDays}</div>
            <div class="stats-card-label">天数</div>
          </div>
          <div class="stats-card">
            <div class="stats-card-value">${overview.totalCoins}</div>
            <div class="stats-card-label">星币</div>
          </div>
          <div class="stats-card">
            <div class="stats-card-value">${formatDurationHM(overview.totalDuration)}</div>
            <div class="stats-card-label">时长</div>
          </div>
          <div class="stats-card">
            <div class="stats-card-value">${overview.totalInter}</div>
            <div class="stats-card-label">互动</div>
          </div>
        </div>

        ${dailyData.length === 0 ? `
          <div class="stats-empty-big">
            <div class="stats-empty-icon">📋</div>
            <div>这段时间还没有任务记录哦</div>
            <div class="stats-empty-sub">开始做任务后，这里会显示统计数据</div>
          </div>
        ` : `
          <!-- 每日完成数趋势 -->
          <div class="stats-section">
            <div class="stats-section-title">每日任务完成数量</div>
            <div class="stats-chart-container" id="stats-chart-count"></div>
          </div>

          <!-- 每日时长趋势 -->
          <div class="stats-section">
            <div class="stats-section-title">每日完成时长（分钟）</div>
            <div class="stats-chart-container" id="stats-chart-duration"></div>
          </div>

          <!-- 每日时间范围 -->
          <div class="stats-section">
            <div class="stats-section-title">每日活动时间范围</div>
            <div class="stats-timeline-container" id="stats-timeline"></div>
          </div>
        `}
      </div>
    `;

    // 注入样式（首次）
    if (!document.getElementById('stats-io-styles')) {
      const style = document.createElement('style');
      style.id = 'stats-io-styles';
      style.textContent = getStatsCSS();
      document.head.appendChild(style);
    }

    // 绑定范围切换
    container.querySelectorAll('.stats-range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentRange = btn.dataset.range;
        render();
      });
    });

    // 渲染图表
    if (dailyData.length > 0) {
      const countChart = document.getElementById('stats-chart-count');
      const durationChart = document.getElementById('stats-chart-duration');
      const timeline = document.getElementById('stats-timeline');
      if (countChart) renderBarChart(countChart, dailyData, 'count', renderDayDetail);
      if (durationChart) renderBarChart(durationChart, dailyData, 'duration', renderDayDetail);
      if (timeline) renderTimelineChart(timeline, dailyData);
    }
  }

  render();
}

// ===== 📤 数据 Tab 主渲染 =====

function renderDataTab(container) {
  const history = window.store.get('completedHistory') || [];

  container.innerHTML = `
    <div class="data-panel">
      <div class="data-section">
        <div class="data-section-title">📤 数据导出</div>
        <div class="data-actions">
          <button class="btn-data" id="btn-export-json">
            <span class="data-btn-icon">📦</span>
            <div class="data-btn-text">
              <div class="data-btn-name">完整备份</div>
              <div class="data-btn-desc">导出所有数据为 JSON 文件，用于数据恢复</div>
            </div>
          </button>
          <button class="btn-data" id="btn-export-daily" ${history.length === 0 ? 'disabled' : ''}>
            <span class="data-btn-icon">📊</span>
            <div class="data-btn-text">
              <div class="data-btn-name">每日汇总报表</div>
              <div class="data-btn-desc">每天完成数、时长、时间范围、互动等</div>
            </div>
          </button>
          <button class="btn-data" id="btn-export-detail" ${history.length === 0 ? 'disabled' : ''}>
            <span class="data-btn-icon">📋</span>
            <div class="data-btn-text">
              <div class="data-btn-name">任务完成明细</div>
              <div class="data-btn-desc">每条任务的详细时间和加成信息</div>
            </div>
          </button>
        </div>
      </div>
      <div class="data-hint">
        💡 所有导出在本地完成，不经过任何网络。CSV 不含密码等敏感配置信息。
      </div>
    </div>
  `;

  // 注入样式
  if (!document.getElementById('stats-io-styles')) {
    const style = document.createElement('style');
    style.id = 'stats-io-styles';
    style.textContent = getStatsCSS();
    document.head.appendChild(style);
  }

  // 绑定导出
  document.getElementById('btn-export-json')?.addEventListener('click', () => showExportPreview('json'));
  document.getElementById('btn-export-daily')?.addEventListener('click', () => showExportPreview('daily-summary'));
  document.getElementById('btn-export-detail')?.addEventListener('click', () => showExportPreview('task-detail'));
}

// ===== 导出预览弹窗 =====

function showExportPreview(type) {
  const history = window.store.get('completedHistory') || [];
  const interactions = window.store.get('interactionHistory') || [];

  let title = '';
  let summaryHTML = '';
  let tableHTML = '';
  let downloadBtn = '';

  if (type === 'json') {
    title = '📦 完整备份 · 预览';
    const dates = [...new Set(history.map(h => toLocalDate(h.completedAt)).filter(Boolean))];
    summaryHTML = `
      <div class="preview-summary">
        <div class="preview-stat"><span>✅ 完成记录</span><span>${history.length} 条</span></div>
        <div class="preview-stat"><span>🐾 互动记录</span><span>${interactions.length} 条</span></div>
        <div class="preview-stat"><span>📅 数据范围</span><span>${dates.length > 0 ? dates[0] + ' ~ ' + dates[dates.length-1] : '无'}</span></div>
        <div class="preview-stat"><span>🏠 宠物数量</span><span>${(window.store.get('pets') || []).length}</span></div>
      </div>
    `;
    downloadBtn = '<button class="preview-download-btn" id="preview-do-download">📥 下载 JSON</button>';

  } else if (type === 'daily-summary') {
    title = '📊 每日汇总报表 · 预览';
    const dailyData = aggregateByDate(history, interactions, 'all');
    if (dailyData.length === 0) {
      summaryHTML = '<div class="stats-empty">还没有完成记录</div>';
    } else {
      const firstDate = dailyData[0].date;
      const lastDate = dailyData[dailyData.length - 1].date;
      summaryHTML = `
        <div class="preview-summary">
          <div class="preview-stat"><span>📅 数据范围</span><span>${firstDate} ~ ${lastDate}</span></div>
          <div class="preview-stat"><span>📋 共</span><span>${dailyData.length} 天记录</span></div>
        </div>
      `;
      tableHTML = `
        <div class="preview-table-wrap">
          <table class="preview-table">
            <thead>
              <tr>
                <th>日期</th><th>完成数</th><th>时长</th><th>最早</th><th>最晚</th><th>星币</th><th>早鸟</th><th>喂食</th><th>玩耍</th>
              </tr>
            </thead>
            <tbody>
              ${dailyData.map(d => `
                <tr>
                  <td>${shortDate(d.date)}</td>
                  <td>${d.count}</td>
                  <td>${formatDurationHM(d.totalDuration)}</td>
                  <td>${d.earliestStart ? toLocalTime(d.earliestStart) : '-'}</td>
                  <td>${d.latestEnd ? toLocalTime(d.latestEnd) : '-'}</td>
                  <td>${d.totalCoins}</td>
                  <td>${d.earlyBirdCount || 0}</td>
                  <td>${d.feedCount || 0}</td>
                  <td>${d.playCount || 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    downloadBtn = '<button class="preview-download-btn" id="preview-do-download">📥 下载 CSV</button>';

  } else if (type === 'task-detail') {
    title = '📋 任务完成明细 · 预览';
    if (history.length === 0) {
      summaryHTML = '<div class="stats-empty">还没有完成记录</div>';
    } else {
      const previewRows = history.slice(0, 20);
      summaryHTML = `
        <div class="preview-summary">
          <div class="preview-stat"><span>📋 共</span><span>${history.length} 条记录</span></div>
          <div class="preview-stat"><span>👁️ 预览</span><span>前 ${previewRows.length} 条</span></div>
        </div>
      `;
      tableHTML = `
        <div class="preview-table-wrap">
          <table class="preview-table">
            <thead>
              <tr>
                <th>日期</th><th>开始</th><th>完成</th><th>任务</th><th>星币</th><th>用时</th><th>早鸟</th><th>加成</th>
              </tr>
            </thead>
            <tbody>
              ${previewRows.map(h => `
                <tr>
                  <td>${shortDate(toLocalDate(h.completedAt))}</td>
                  <td>${h.startedAt ? toLocalTime(h.startedAt) : '-'}</td>
                  <td>${h.completedAt ? toLocalTime(h.completedAt) : '-'}</td>
                  <td class="preview-task-name">${h.title || ''}</td>
                  <td>${h.coins || 0}</td>
                  <td>${formatDuration(h.duration)}</td>
                  <td>${h.isEarlyBird ? '🌅' : ''}</td>
                  <td class="preview-bonus">${(h.bonusDetail || []).map(b => `${b.icon}${b.label}+${b.value}`).join(' ') || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    downloadBtn = '<button class="preview-download-btn" id="preview-do-download">📥 下载 CSV</button>';
  }

  // 弹窗遮罩
  const overlay = document.createElement('div');
  overlay.className = 'preview-overlay';
  overlay.innerHTML = `
    <div class="preview-modal">
      <div class="preview-title">${title}</div>
      ${summaryHTML}
      ${tableHTML}
      <div class="preview-warning">⚠️ JSON 文件包含全量数据（含密码），注意不要随意分享</div>
      <div class="preview-actions">
        <button class="preview-cancel-btn" id="preview-cancel">取消</button>
        ${downloadBtn}
      </div>
    </div>
  `;

  // 注入样式
  if (!document.getElementById('stats-io-styles')) {
    const style = document.createElement('style');
    style.id = 'stats-io-styles';
    style.textContent = getStatsCSS();
    document.head.appendChild(style);
  }

  document.body.appendChild(overlay);

  // 绑定事件
  const closeModal = () => overlay.remove();
  overlay.querySelector('#preview-cancel')?.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  overlay.querySelector('#preview-do-download')?.addEventListener('click', () => {
    doExport(type);
    closeModal();
  });
}

// ===== 执行导出 =====

function doExport(type) {
  if (type === 'json') {
    const data = localStorage.getItem(window.store.STORAGE_KEY);
    if (!data) { window.showToast('没有数据可导出', 'warning'); return; }

    const history = window.store.get('completedHistory') || [];
    const interactions = window.store.get('interactionHistory') || [];
    const dates = [...new Set(history.map(h => toLocalDate(h.completedAt)).filter(Boolean))];

    const exportData = {
      _meta: {
        appName: '小怪兽养成记',
        exportDate: new Date().toISOString(),
        version: '3.0',
        stats: {
          completedTasks: history.length,
          interactionCount: interactions.length,
          dateRange: dates.length > 0 ? `${dates[0]} ~ ${dates[dates.length-1]}` : '无'
        }
      },
      ...JSON.parse(data)
    };

    const json = JSON.stringify(exportData, null, 2);
    triggerDownload(json, `打卡小达人_备份_${getDateStr()}.json`, 'application/json');
    window.showToast('备份导出成功！', 'success');

  } else if (type === 'daily-summary') {
    const history = window.store.get('completedHistory') || [];
    const interactions = window.store.get('interactionHistory') || [];
    const dailyData = aggregateByDate(history, interactions, 'all');

    if (dailyData.length === 0) { window.showToast('还没有记录', 'warning'); return; }

    const headers = ['日期', '任务完成数', '总完成时长', '最早开始时间', '最晚完成时间', '获得星币', '早鸟奖励次数', '喂食次数', '玩耍次数', '喂食消耗星币'];
    const rows = dailyData.map(d => [
      d.date,
      d.count,
      formatDurationHM(d.totalDuration),
      d.earliestStart ? toLocalTime(d.earliestStart) : '',
      d.latestEnd ? toLocalTime(d.latestEnd) : '',
      d.totalCoins,
      d.earlyBirdCount || 0,
      d.feedCount || 0,
      d.playCount || 0,
      d.feedCost || 0
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    triggerDownload(csv, `打卡小达人_每日汇总_${getDateStr()}.csv`, 'text/csv;charset=utf-8');
    window.showToast('汇总报表导出成功！', 'success');

  } else if (type === 'task-detail') {
    const history = window.store.get('completedHistory') || [];
    if (history.length === 0) { window.showToast('还没有记录', 'warning'); return; }

    const headers = ['日期', '开始时间', '完成时间', '任务名称', '分类', '获得星币', '经验值', '用时', '早鸟奖励', '加成明细'];
    const rows = history.map(h => [
      toLocalDate(h.completedAt),
      h.startedAt ? toLocalTime(h.startedAt) : '',
      h.completedAt ? toLocalTime(h.completedAt) : '',
      h.title || '',
      CATEGORY_NAMES[h.category] || h.category || '',
      h.coins || 0,
      h.exp || 0,
      formatDuration(h.duration),
      h.isEarlyBird ? '是' : '否',
      (h.bonusDetail || []).map(b => `${b.icon}${b.label}+${b.value}`).join(' ')
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    triggerDownload(csv, `打卡小达人_任务明细_${getDateStr()}.csv`, 'text/csv;charset=utf-8');
    window.showToast('任务明细导出成功！', 'success');
  }
}

// ===== 样式（内联注入，不新增 CSS 文件）=====

function getStatsCSS() {
  return `
    /* ===== 统计 Tab ===== */
    .stats-container { display: flex; flex-direction: column; gap: 16px; padding-bottom: 20px; }

    .stats-range-selector { display: flex; gap: 8px; justify-content: center; }
    .stats-range-btn {
      padding: 6px 16px; border-radius: 20px; border: 1.5px solid #E0D5C8;
      background: white; font-size: 13px; font-weight: 600; color: #8D6E63;
      cursor: pointer; transition: all 0.15s;
    }
    .stats-range-btn.active { background: #FF9A56; color: white; border-color: #FF9A56; }

    .stats-overview {
      display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;
    }
    @media (max-width: 768px) {
      .stats-overview { grid-template-columns: repeat(3, 1fr); }
    }

    .stats-card {
      background: white; border-radius: 14px; padding: 12px 8px;
      text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .stats-card-value { font-size: 20px; font-weight: 700; color: #5D4037; margin-bottom: 2px; }
    .stats-card-label { font-size: 11px; color: #8D6E63; }

    .stats-section {
      background: white; border-radius: 14px; padding: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .stats-section-title { font-size: 14px; font-weight: 700; color: #5D4037; margin-bottom: 12px; }

    .stats-empty, .stats-empty-big {
      text-align: center; padding: 30px 16px; color: #8D6E63; font-size: 14px;
    }
    .stats-empty-big { padding: 50px 16px; }
    .stats-empty-icon { font-size: 40px; margin-bottom: 8px; }
    .stats-empty-sub { font-size: 12px; color: #BCAAA4; margin-top: 4px; }

    /* 柱状图 */
    .stats-chart { display: flex; align-items: stretch; gap: 4px; height: 140px; }
    .stats-chart-y {
      font-size: 10px; color: #BCAAA4; min-width: 28px; text-align: right;
      line-height: 35px; flex-shrink: 0;
    }
    .stats-chart-body { flex: 1; position: relative; }
    .stats-chart-grid { position: absolute; inset: 0; pointer-events: none; }
    .stats-chart-line {
      position: absolute; left: 0; right: 0; height: 1px;
      background: #F5F0EB;
    }
    .stats-chart-bars {
      display: flex; align-items: flex-end; gap: 4px; height: 100%;
      padding-bottom: 20px; position: relative; z-index: 1;
    }
    .stats-chart-col {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      height: 100%; justify-content: flex-end; cursor: pointer; min-width: 0;
    }
    .stats-chart-val {
      font-size: 9px; font-weight: 600; color: #FF9A56; margin-bottom: 2px;
      white-space: nowrap;
    }
    .stats-chart-track {
      width: 100%; max-width: 32px; display: flex; align-items: flex-end;
      height: calc(100% - 20px);
    }
    .stats-chart-bar {
      width: 100%; background: linear-gradient(180deg, #FF9A56, #FFB74D);
      border-radius: 4px 4px 0 0; min-height: 3px; transition: height 0.3s ease;
    }
    .stats-chart-label {
      font-size: 9px; color: #BCAAA4; margin-top: 4px; white-space: nowrap;
    }
    .stats-chart-container { overflow-x: auto; }

    /* 每日明细展开 */
    .stats-day-detail {
      background: #FFF8F0; border-radius: 10px; padding: 12px; margin-top: 8px;
      animation: fadeIn 0.2s ease;
    }
    .stats-detail-header {
      font-size: 12px; font-weight: 600; color: #5D4037; margin-bottom: 6px;
      padding-bottom: 6px; border-bottom: 1px solid #FFE0C0;
    }
    .stats-detail-item {
      display: flex; align-items: center; gap: 8px; padding: 4px 0;
      font-size: 12px; color: #8D6E63;
    }
    .stats-detail-title { flex: 1; }
    .stats-detail-coins { font-weight: 600; color: #FF9A56; }
    .stats-detail-dur { font-size: 11px; color: #BCAAA4; }
    .stats-detail-early { }

    /* 时间范围图 */
    .stats-timeline-container { overflow-x: auto; }
    .stats-timeline { min-width: 320px; }
    .stats-timeline-header { display: flex; gap: 8px; margin-bottom: 4px; }
    .stats-timeline-date-col { width: 44px; flex-shrink: 0; }
    .stats-timeline-hours { flex: 1; display: flex; }
    .stats-timeline-hr {
      flex: 1; font-size: 9px; color: #BCAAA4; text-align: center; min-width: 0;
    }
    .stats-timeline-row { display: flex; gap: 8px; height: 22px; }
    .stats-timeline-date-col {
      font-size: 11px; color: #8D6E63; line-height: 22px; text-align: right;
      padding-right: 4px;
    }
    .stats-timeline-track {
      flex: 1; position: relative; background: #F5F0EB; border-radius: 4px;
      height: 16px; margin-top: 3px;
    }
    .stats-timeline-bar {
      position: absolute; top: 0; height: 100%;
      background: linear-gradient(90deg, #FF9A56, #FFB74D);
      border-radius: 4px;
    }

    /* ===== 数据提示 ===== */
    .data-hint {
      font-size: 11px; color: #BCAAA4; text-align: center; padding: 8px;
    }

    /* ===== 预览弹窗 ===== */
    .preview-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9999;
      display: flex; align-items: center; justify-content: center; padding: 16px;
      animation: fadeIn 0.15s ease;
    }
    .preview-modal {
      background: white; border-radius: 20px; padding: 24px; width: 100%;
      max-width: 480px; max-height: 80vh; overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
    }
    .preview-title {
      font-size: 16px; font-weight: 700; color: #5D4037; margin-bottom: 16px;
      text-align: center;
    }
    .preview-summary { margin-bottom: 12px; }
    .preview-stat {
      display: flex; justify-content: space-between; padding: 6px 0;
      font-size: 13px; color: #8D6E63; border-bottom: 1px solid #F5F0EB;
    }
    .preview-stat span:last-child { font-weight: 600; color: #5D4037; }

    .preview-table-wrap {
      overflow-x: auto; margin-bottom: 12px;
      max-height: 300px; overflow-y: auto;
    }
    .preview-table {
      width: 100%; border-collapse: collapse; font-size: 12px;
    }
    .preview-table th {
      background: #FFF3E0; color: #5D4037; font-weight: 600;
      padding: 8px 6px; text-align: left; white-space: nowrap;
      position: sticky; top: 0; z-index: 1;
    }
    .preview-table td {
      padding: 6px; border-bottom: 1px solid #F5F0EB; white-space: nowrap;
    }
    .preview-task-name { max-width: 80px; overflow: hidden; text-overflow: ellipsis; }
    .preview-bonus { font-size: 11px; color: #FF9A56; }

    .preview-warning {
      font-size: 11px; color: #E65100; background: #FFF3E0;
      padding: 8px 12px; border-radius: 8px; margin-bottom: 12px; text-align: center;
    }
    .preview-actions { display: flex; gap: 10px; justify-content: flex-end; }
    .preview-cancel-btn {
      padding: 10px 20px; border-radius: 12px; border: 1.5px solid #E0D5C8;
      background: white; font-size: 14px; font-weight: 600; color: #8D6E63;
      cursor: pointer;
    }
    .preview-download-btn {
      padding: 10px 24px; border-radius: 12px; border: none;
      background: linear-gradient(135deg, #FF9A56, #FFB74D);
      font-size: 14px; font-weight: 600; color: white; cursor: pointer;
    }
    .preview-download-btn:active { transform: scale(0.96); }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  `;
}

// ===== 暴露给 parent-panel 调用 =====
window.renderStatsTab = renderStatsTab;
window.renderDataTab = renderDataTab;
