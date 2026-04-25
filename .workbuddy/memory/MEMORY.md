# MEMORY.md — 长期记忆

## 项目关键信息
- **GitHub 仓库**：https://github.com/doraemoncc/monster-pet
- **Pages URL**：https://doraemoncc.github.io/monster-pet/
- **远程名**：origin（已配置）
- **远程协议**：SSH（`git@github.com:doraemoncc/monster-pet.git`），HTTPS 经常超时
- 注意：`monster-pet/` 子目录的嵌套 `.git` 已于 4/25 删除，统一只用外层仓库

## monster-pet 关键经验

### CSS 防回退规则
- **每个 `#page-*` 必须显式声明 `padding-top: calc(var(--safe-top) + Xpx)`**，不能用 `padding: Xpx` 简写覆盖掉安全区域
- `parentTab` 初始值必须与第一个 tab 的 `data-tab` 值一致，否则首次进入面板空白
- `body` 不设 padding-top/padding-bottom（已在 base.css 移除），各页面独立处理
- 每次改 CSS 后对照 `docs/monster-pet-design.md` 第十一章检查清单

### 历史踩坑
- CSS `padding` 简写会覆盖之前单独设置的 `padding-top`，导致安全区域失效——这是"顶部空白"bug反复出现的根因
- 4/19 修复了 scrollTo + padding-top，4/25 重构时覆盖了 padding-top → 修复无效
- git remote 配置可能丢失，需确认 origin 是否存在

## 用户偏好
- 偏好中文交流
- 做大更新时要求先规划确认能力，后用"执行"触发
- 重视 bug 不反复出现，要求反思和防回退策略
