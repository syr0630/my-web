# Draftly 全站 UI 改版 V1.0

## 视觉方向

- 马卡龙淡彩、扁平 2D、风琴文件袋。
- 无衬线字体；无人物/卡通插画；无玻璃拟态、模糊透明、3D、深色科技渐变。
- 浅色主题以奶油纸色为底，深色主题以低饱和夜蓝为底；主题色为柔和的蓝色，而不是高饱和科技蓝。
- 所有页面共用一套语义色变量（`src/app/globals.css`），不再在组件里新增品牌色硬编码。

## 设计令牌

| 角色 | 浅色 | 深色 |
| --- | --- | --- |
| 页面底色 | `#faf8f3` | `#1a2030` |
| 卡片 | `#fffdf8` | `#222a3d` |
| 主文字 | `#35425e` | `#f1f2f7` |
| 次文字 | `#6a7180` | `#a7afc2` |
| 主色 | `#4c6cc2` | `#a9beff` |
| 边框 | `#e7e1d6` | `#343e54` |

七个工具各有自己的功能色，并配套 `--tone-*-ink` 与深色版本：

- 人性化改写：雾蓝
- 中英翻译：薄荷
- 文本润色：奶油
- 语法检查：青绿
- AI 文本检测：薰衣草
- 风格画像：藕粉
- 学术写作：浅天蓝
- 反馈：暖灰

## 页面结构

### 首页

- 顶栏：文件袋标志、主题切换、打开工作台。
- 首屏：8 个顶部页签；文件袋主体约占视口 76%–80%；文件夹内是标题、双行 slogan、主 CTA、四个信息点；底部口袋与 `SCROLL` 提示。
- 页签：桌面悬停弹出预览卡；触屏第一次点按展开、第二次进入工具；其余页签降低强调。
- 服务区：7 张可堆叠卡片，`position: sticky`，每张顶部露出 12px，滚动方向自然反转；移动端改为普通纵向列表。
- 反馈区：入口进入独立 `/feedback` 页面，不再把长表单塞在首页底部。
- 页脚保留 `一元硬币`。

### 工具页

- 取消常驻侧栏，改为顶栏 + 左侧文件袋抽屉。
- 抽屉宽度 40vw（最大 560px、最小 360px），移动端 88vw；支持遮罩、Esc、关闭按钮和焦点循环。
- 抽屉内包含首页、7 个工具、反馈、设置、界面语言与日夜模式。
- 所有原有编辑器、API、数据结构、diff、撤销/重做、复制、导出、风格画像、风格一致性逻辑保持原样。

### 新页面

- `/academic`：学术写作工作区。已接入 `public-management-c-journal-writing-zh` Skill，支持 DOCX / TXT / Markdown 文档导入、论文润色、结构审阅与摘要改写；不设学科路由。
- `/feedback`：独立反馈页，复用真实 `FeedbackForm` 与 `/api/feedback`。

## 交互与状态

- 日夜切换：圆形遮罩或星形遮罩从按钮位置扩散，700ms；7px 浅色边缘；星形旋转 69°。
- 减少动态效果：`prefers-reduced-motion` 下关闭遮罩与动画。
- 加载：按钮内旋转图标 + `processing` 文案，禁用重复提交。
- 成功：蓝色对号与语义化成功提示；复制成功在按钮内反馈。
- 失败：错误提示保留原文，提供重试；表单错误靠近字段并通过 `aria-live` 宣告。
- 破坏性操作：学术页清空文本使用可复用 `Modal`，支持 Esc、焦点管理和危险色确认按钮。
- 所有图标为内联 SVG，不使用 emoji 作为结构图标。

## 响应式

- 桌面 ≥1280：风格画像为上下工作流，依次为样本导入、分析编辑、已保存画像；工具页抽屉 40vw。
- 平板 641–1279：首页页签 4×2；服务卡仍堆叠；风格画像保持上下工作流。
- 移动 ≤640：首页页签 4×2，服务卡改为静态列表；抽屉 88vw；顶栏控件 ≥44px。

## 可访问性

- 主文字与背景对比度按 4.5:1 调整；语义色（成功/警告/危险）使用深色文字令牌。
- 顶栏菜单、主题、图标链接为 44×44px；表单主按钮 48px；移动端弹窗按钮 44px。
- 抽屉与弹窗均有焦点陷阱、Esc 关闭、焦点回归与 `aria-modal`。
- 跳转主内容链接、可见 focus ring、`aria-current`、`aria-pressed`、`aria-expanded` 保留。
- 深色模式独立检查：所有页面无横向溢出、无纯白大色块。

## 验证

- `node node_modules/typescript/bin/tsc --noEmit`
- `node node_modules/next/dist/bin/next build`
- `BASE_URL=http://127.0.0.1:3107 node scripts/test-browser.mjs`
- 结果：40 项通过，0 项失败。
- 额外检查：`scripts/audit-ui.mjs` 覆盖 12 个桌面页面、5 个移动页面、6 个深色页面；无横向溢出、无纯白表面、无未捕获异常。

## 已知限制

- 学术写作已接入 `public-management-c-journal-writing-zh` Skill，服务端提示词内置完整规则；单次处理上限 8,000 字符，超出时提示按章节拆分。
- 文档导入支持 DOCX、TXT、Markdown；不支持 PDF、图片、扫描件和旧版 `.doc`。DOCX 只提取 `word/document.xml` 中的正文文字，不解析批注、脚注或修订记录。
- 学术处理依赖服务端 `AI_API_KEY` 与 `AI_BASE_URL`；项目不会保存论文的服务端副本。
- 管理后台是内部页面，已统一语义色与布局；未新增后台业务功能。

## 主要文件

新增：

- `src/components/home/FolderHome.tsx`
- `src/components/home/FolderTabs.tsx`
- `src/components/home/ServiceStack.tsx`
- `src/components/home/ScrollIndicator.tsx`
- `src/components/layout/FolderDrawer.tsx`
- `src/components/theme/ThemeProvider.tsx`
- `src/components/theme/ThemeToggle.tsx`
- `src/components/common/Modal.tsx`
- `src/components/academic/AcademicWorkspace.tsx`
- `src/app/academic/page.tsx`
- `src/app/api/v1/academic/route.ts`
- `src/app/api/v1/documents/extract/route.ts`
- `src/lib/ai/academic-skill.ts`
- `src/lib/ai/prompts-academic.ts`
- `src/app/feedback/page.tsx`
- `scripts/preview-ui.mjs`
- `scripts/check-ui.mjs`
- `scripts/audit-ui.mjs`

重写 / 调整：

- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/layout/Logo.tsx`
- `src/components/layout/nav-items.ts`
- `src/components/common/Icon.tsx`
- `src/components/common/PageHeader.tsx`
- `src/components/common/Notice.tsx`
- `src/components/common/DisabledFeature.tsx`
- `src/components/feedback/FeedbackForm.tsx`
- `src/lib/i18n/messages.ts`
- 工具工作区与编辑器组件的语义色迁移
- `src/app/settings/page.tsx`
- `src/app/privacy/page.tsx`
- `src/app/terms/page.tsx`
- `src/components/admin/AdminLoginForm.tsx`
- `src/components/admin/AdminFeedbackClient.tsx`
- `scripts/test-browser.mjs`