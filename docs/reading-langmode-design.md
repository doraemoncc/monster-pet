# 阅读任务简化 + 书库管理修复 设计文档

> 状态：**已实现并验证**（2026-11-07）。本文件为事后对齐记录，反映最终落地内容。

## 1. 背景与目标
「每日阅读」原本有一个「每日阅读语言模式」开关（只读英文 / 只读中文 / 中英都读），位于家长面板 → 📚 阅读书目页。
用户要求：去掉该开关；任务里直接显示当天在读的书；中文或英文任一进行了阅读即算完成当天任务。
实施过程中用户又提出两项改动：① 书库增删有 bug 要修；② 拍照识别功能识别太差，整个去掉。

## 2. 最终实现内容
1. **去掉语言模式开关**：家长面板阅读书目页不再显示语言模式区块。
2. **任务同时显示中英文两本书**：分配逻辑固定取中文 + 英文各一本（有啥取啥），每本一个 chip。完成任一即可（当前点「完成」即标记，无强制门槛）。
3. **修复书库增删失效 bug**（关键）：原 `renderReadingBooksManagement` 的「添加」事件里，`const lang` 声明在 click 回调内部，导致循环体后续 `container.querySelector('#book-add-${lang}')` 抛出 `ReferenceError: lang is not defined`，使循环中断——**英文添加尚可，中文添加与所有删除/标已读按钮的事件根本没挂上**。
4. **移除拍照 OCR 识别功能**：删除 tesseract 资源、相关函数与样式、设计文档。

## 3. 改动文件清单
- `js/weekly-plan.js`：`assignReadingBooksForTask()` 去掉 mode 参数，固定 `langs = ['cn','en']`；`ensureReadingBooks` 不再读 `readingLangMode`，置 `readingMode='both'`。
- `js/parent-panel.js`：删除语言模式 UI 块 + 切换事件 + `mode`/`modeBtn` 变量；**修复 add 事件 `lang` 作用域**（移到循环体）；删除 OCR 函数块（`ensureTesseract`/`showOcrOverlay`/`openBookOcr`/`renderOcrCandidates` 等）、📷 按钮与绑定。
- `css/parent.css`：删除 `.btn-langmode`、`.btn-ocr`、`.book-ocr-hint` 及 `.ocr-*` 全部样式。
- `js/lib/tesseract/`、`monster-pet/js/lib/tesseract/`：整个目录删除。
- `docs/reading-ocr-design.md`：删除（功能已移除）。
- `js/store.js`：`readingLangMode` 字段保留但不再被引用（兼容旧数据）。

## 4. 未实施项（按用户最新口径，留作可选）
- **「至少读一本才能标记完成」的门槛**：v2 方案曾设想加此门槛，但用户未确认且该门槛会改变完成流程；当前保持「点完成即完成、确认弹窗仅记录每本读完状态」的原有行为（已满足「任一读完即算完成」）。如需强制门槛可后续追加。

## 5. 防回退
- `lang` 作用域修复是本次最易回退点：add 事件里 `const lang` 必须在 `forEach` 循环体（click 回调外）声明，否则会重现「删除/中文添加失效」且无任何报错。
- 分配固定双语言后，`reconcileTodayTasks` / `ensureAllReadingBooksForToday` 自动生效。
- 验证务必确认：① 家长面板无语言模式三按钮、无📷按钮；② 删除/添加中文书真实生效；③ 任务卡片有中英文两本 chip。

## 6. 验证（Playwright 无头，2026-11-07）
- 家长面板阅读书目页：`hasLangMode=false`、`hasOcrBtn=false` ✓
- 添加中文书：6→7 且含新书 ✓；删除：`7→6` ✓；`pageErrors=[]`（原 `lang is not defined` 已消失）✓
- 每日阅读任务 `books: ["cn:猜猜我有多爱你","en:The Very Hungry Caterpillar"]` ✓
