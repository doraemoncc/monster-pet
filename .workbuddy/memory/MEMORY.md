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
- **预览页面变量命名冲突**：preview-pets.html 等页面不能与 pet-renderer.js 使用相同顶级变量名（如 `frameCount`, `PET_TYPES`, `STAGE_NAMES`），否则 inline script 静默失败。**用 `var` + 独特前缀（如 `previewFrame`, `PREVIEW_PET_TYPES`）**
- **脚本放 `<body>` 不放 `<head>`**——避免 DOM 未就绪问题

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
- **任务重复 bug 根因**：`resetRepeatTasks()` 和 `reconcileTodayTasks()` 执行顺序问题，前者重置昨天任务时设置 `lastResetDate=today`，导致后者统计时误判。修复：在 `resetRepeatTasks` 中添加重复检查，发现已有相同模板+今天日期的任务时删除旧任务而非重置
- **商城横屏显示问题**：flex 布局在横屏时需要显式设置 `flex-shrink: 0` 防止项目被压缩
- **门卫遮罩遮挡 bug**：`showShopGuard` 创建的 `.guard-overlay` 挂在 `body` 上，`navigateTo` 切换页面时从不清理。用户进宠物页触发门卫后，不点"去做任务"直接切到家长面板，门卫仍盖在最顶层拦截点击 → 家长面板密码 keypad 点不动（"输 0000 没反应"）。**修复**：`navigateTo` 开头 `document.querySelectorAll('.guard-overlay:not(.unlock-celebration)').forEach(o => o.remove())`。此 bug 与协议无关（file:// 和 http 都会触发），之前 http 截图因手动移除弹窗漏测
- **阅读确认弹窗遮挡 bug（"选还没没反应"）**：`showBookFinishedConfirm`（task-list.js）用的 `.food-panel-overlay` 样式由 pet-interaction.js 的 `injectFoodPanelStyles()` **懒加载注入**，且 `z-index:200` 低于 `.result-overlay`（"任务完成"弹窗，z250）。导致：①没开过宠物面板的用户样式未注入、弹窗无样式被完全盖住；②即使注入，层级也低于任务完成弹窗，"还没"按钮点不到。**修复**：`injectFoodPanelStyles` 里 food-panel-overlay `z-index:200→400`；`showBookFinishedConfirm` 开头显式调 `injectFoodPanelStyles()` 确保注入；确认关闭时一并 `document.querySelectorAll('.result-overlay').forEach(o=>o.remove())`。注：food-panel-overlay 是底部半屏面板（align-items:flex-end），与 result-overlay 居中风格不同，阅读确认仍会与任务完成弹窗短暂叠加，如需可改为单一居中弹窗
- **store 初始化致命坑**：`init()` 的 `else` 分支（localStorage 为空、首次打开）也必须调用 `_migrate()`。否则默认激活的周计划模板不会被 `switchPlanTemplate` apply 到 `weeklyPlan`，新用户任务中心**完全空白**（老用户因 localStorage 有数据才正常，极易漏测）。改 store 初始化/迁移后必须用空 localStorage 验证一次任务生成

### 装扮图片替换系统（2026-06-14 实现，06-16 更新）
- **旧方案废弃**：Canvas 2D 绘制装扮（drawAccessories）定位不准，效果差
- **新方案**：为每种「宠物类型+装扮」组合生成独立 AI 图片，佩戴时直接替换整张图
- **单装扮模式**：只显示第一个已装备装扮（`getPetImageKey()` 取 `accessories[0]`）
- **图片路径**：`images/pets/accessories/{type}_{stage}_{accId}.png`（覆盖 baby/teen/adult 三阶段）
- **`getPetImageKey(type, stage, accessories)`**：自动选择正确图片 key，装扮图未加载时降级到基础图
- **预加载**：`preloadPetImages()` 加载基础图后设 `_petImagesReady=true`（不等待装扮图）；`preloadAccessoryImages()` 异步加载装扮图（51张：17 baby + 17 teen + 17 adult）
- **`drawPetFromImage()`** 接受 `accessories` 参数，通过 `getPetImageKey()` 选择图片
- **preview-pets.html**：装扮选择改为单选（radio button），`selectedAccessory` 变量
- **重要发现**：宠物默认 stage=1（baby），不是 stage=2（teen），装扮图片必须覆盖所有3个阶段

### 周计划模板系统（2026-06-05 实现）
- `planTemplates`：多套可复用周计划模板，内置 `tpl_semester`（学期计划）
- `activePlanTemplateId` + `planTemplateExpiry`：当前使用的模板及其有效期
- `weekOverrides`：单周临时覆盖（key=本周一日期），`getEffectivePlanForDay` 优先取覆盖
- 家长面板周计划 Tab：顶部模板栏 + 7天网格 + 底部模板管理列表
- 切换模板后立即调用 `reconcileTodayTasks`，今天任务实时更新

### 每日阅读·自定义书目系统（2026-10-31 实现）
- **数据**：`readingBooks`（书库，每项 `{id,title,lang:'en'|'cn',note,finished}`）、`readingLangMode`（`'en'|'cn'|'both'`）、`readingRotation`（`{en,cn}` 存"下一本待分配"bookId）
- **核心逻辑**（`weekly-plan.js`）：`assignReadingBooksForTask(mode)` 按语言池+轮转指针取书并推进指针；`ensureReadingBooks(task)` 用 `task.bookAssignDate` 守卫，**每天只为每个阅读任务分配一次**（避免重置/回填/新建重复推进轮转）；`ensureAllReadingBooksForToday()` 在 `checkDailyPlanGeneration` 启动时调用
- **语言模型（已移除）**：原按 `readingLangMode` 取书已取消；现统一为单个"每日阅读"任务，分配时**固定同时取中文+英文各一本**（`assignReadingBooksForTask()` 硬编码 `langs=['cn','en']`，有啥取啥），任一读完即算完成
- **手动换书**：任务 ⋮ 菜单"更换今日书目"（`showBookSwapPanel`），换书时把 `readingRotation[lang]` 拨到"换后那本下一本"，实现"后续轮转按新书继续"
- **读完状态**：任务完成时弹 `showBookFinishedConfirm` 更新 `readingBooks[i].finished`；卡片 chip 显示 ✓已读；家长面板可标已读/未读
- **家长面板**：新增"📚 阅读书目"标签页，仅做中英文书**增删 + 标已读**（语言模式开关已于 2026-11-07 移除）
- **⚠️ 关键坑**：每日重复任务是**原地重置**（`resetRepeatTasks` 改 status/lastResetDate，不重建对象），所以图书必须靠 `bookAssignDate` 守卫在跨天重置时重分配，否则轮转不推进
- `task.books` 存 `{bookId,bookTitle,lang}`（冗余书名防书被删后显示破图）；`getBookFinished(bookId)` 实时查状态
- `store.js` 迁移：播种 `readingBooks`/语言模式/轮转指针；把周计划里旧 `default_reading_chinese` 改成 `default_reading_daily`

### 阅读书目拍照识别（OCR）—— 已于 2026-11-07 移除
- **结论**：用户实测识别太差，整个功能下掉。已删除 `js/lib/tesseract/` 资源目录、OCR 函数块（`openBookOcr`/`renderOcrCandidates`/`ensureTesseract`/`showOcrOverlay`）、📷 按钮与绑定、`.ocr-*` 样式、`docs/reading-ocr-design.md`。`store.js` 的 `readingLangMode` 字段保留但不引用。

### ⚠️ 书库增删失效 bug（2026-11-07 修复，极易回退）
- **现象**：阅读书目页能正常显示书籍，但**删除按钮、标已读、添加中文书全部点不动**（英文添加因循环第一个还能挂上而正常）。
- **根因**：`renderReadingBooksManagement` 的「添加」事件里 `const lang = btn.dataset.addLang` 声明在 click 回调**内部**，导致循环体后续 `container.querySelector('#book-add-${lang}')`（在回调外）抛 `ReferenceError: lang is not defined`，forEach 循环在第一个 add 按钮处中断，后面所有删除/标已读监听从未挂载。
- **修复**：把 `const lang` 提到 `forEach` 循环体（click 回调外）。
- **防回退**：任何改这个 add 事件的人，必须保证 `lang` 在循环体作用域可见；改完用无头浏览器真实点一次「添加中文书 + 删除一本」验证。

## 用户偏好
- 偏好中文交流
- 做大更新时要求先规划确认能力，后用"执行"触发
- 重视 bug 不反复出现，要求反思和防回退策略
- **git 推送只在用户明确说"推送git"时才执行，不要主动推送**
- **功能改动流程约定**：做大/中功能改动时，必须先完善 `docs/<feature>-design.md` 方案设计文档（贴合 `weekly-plan-design.md` 等既有风格：背景/目标/技术方案/改动文件清单/实施步骤/防回退），请用户确认方案后再开始实施代码
