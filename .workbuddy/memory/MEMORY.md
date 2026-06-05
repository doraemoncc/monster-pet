# MEMORY.md — 长期记忆

## 项目关键信息
- **GitHub 仓库**：https://github.com/doraemoncc/monster-pet
- **Pages URL**：https://doraemoncc.github.io/monster-pet/
- **远程名**：origin（已配置）
- **远程协议**：SSH（`git@github.com:doraemoncc/monster-pet.git`），HTTPS 经常超时

## monster-pet 关键经验

### CSS 防回退规则
- **每个 `#page-*` 必须显式声明 `padding-top: calc(var(--safe-top) + Xpx)`**，不能用 `padding: Xpx` 简写覆盖掉安全区域
- `parentTab` 初始值必须与第一个 tab 的 `data-tab` 值一致，否则首次进入面板空白
- `body` 不设 padding-top/padding-bottom（已在 base.css 移除），各页面独立处理
- 每次改 CSS 后对照 `docs/monster-pet-design.md` 第十一章检查清单

### JS 防回退规则
- **`const`/`let` 不可在同一作用域重复声明**——会导致整个文件加载失败，页面静默空白（无报错）
- `navigateTo` 门卫拦截后 `currentPage` 可能保持 `null`，`showPage` 中 `hideAllPages()` 确保清除 HTML 初始 active
- `animations.css` 不可重复声明 `.page`/`.page.active` 的 display（会覆盖 base.css）

### 调试方法论（按优先级排序）
1. **页面空白/功能不工作** → 先 `node --check file.js` 检查所有相关 JS 语法（排除静默失败）
2. 用 `agent-browser eval "typeof funcName"` 确认函数/变量是否存在
3. 用 `agent-browser eval "document.getElementById('page-x').innerHTML.length"` 确认内容是否渲染
4. 检查 `getComputedStyle(el).display` 确认 CSS 没有把元素隐藏
5. 不要过早进入路由/状态逻辑分析，先排除最基本的"文件有没有加载成功"

### 历史踩坑
- CSS `padding` 简写会覆盖之前单独设置的 `padding-top`，导致安全区域失效——这是"顶部空白"bug反复出现的根因
- 4/19 修复了 scrollTo + padding-top，4/25 重构时覆盖了 padding-top → 修复无效
- git remote 配置可能丢失，需确认 origin 是否存在
- shop.js `const btn` 同一作用域重复声明导致整个文件静默失败——**用 `node --check file.js` 检查语法**
- **改完代码必须同步 monster-pet 子目录**（cp store.js/parent-panel.js/stats-io.js + 更新 index.html 脚本引用），否则部署后看不到变化
- **reconcileTodayTasks Step 2 统计模板计数时必须统计所有状态的任务**（不能只统计 pending），否则已完成任务编辑周计划后会重复出现

### 周计划模板系统（2026-06-05 实现）
- `planTemplates`：多套可复用周计划模板，内置 `tpl_semester`（学期计划）
- `activePlanTemplateId` + `planTemplateExpiry`：当前使用的模板及其有效期
- `weekOverrides`：单周临时覆盖（key=本周一日期），`getEffectivePlanForDay` 优先取覆盖
- 家长面板周计划 Tab：顶部模板栏 + 7天网格 + 底部模板管理列表
- 切换模板后立即调用 `reconcileTodayTasks`，今天任务实时更新

## 用户偏好
- 偏好中文交流
- 做大更新时要求先规划确认能力，后用"执行"触发
- 重视 bug 不反复出现，要求反思和防回退策略
