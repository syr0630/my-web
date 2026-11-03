# Draftly 测试与验收记录

- 日期：2026-10-31（Asia/Shanghai）
- 构建：Next.js 15.1.0 / React 19 / TypeScript strict / Tailwind CSS 3.4
- 运行环境：Windows，Node.js v26.13.0，Chrome 155.0.8059.86（headless）
- 服务地址：`http://127.0.0.1:3100`（生产构建 `next start`）
- AI 服务：DeepSeek OpenAI 兼容接口，模型 `deepseek-flash`

## 1. 构建

```text
$ node node_modules/next/dist/bin/next build
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Generating static pages (30/30)
```

共 34 条路由：12 条页面路由与 22 条 API 路由。其中 `/admin/login`、`/admin/feedback` 为动态页面；构建日志的 `30/30` 是静态生成步骤的计数，不是路由总数。风格画像新增 `/api/style-profile`、`/api/style-profile/[id]`、`/api/style-profile/analyze`、`/api/style-profile/extract`、`/api/style-consistency/analyze`、`/api/style-consistency/apply` 六条动态 API。

## 2. 单元测试

命令：`npm run test:core`

```text
24 passed, 0 failed
```

覆盖：

- 可见字符：中文、CRLF、emoji 码点、截断、1000 边界
- 语言识别：中文、英文、混合、过短不可靠
- 断句：中英文标点、混合、小数点、换行、前导空白
- 词级 diff：相等、插入、删除、按当前文本可重建
- 句子对齐：相同文本、跨句改写的 span 精确性、新增句恢复、英文合并句

## 3. 接口集成测试

命令：`npm run test:api`

```text
37 passed, 0 failed
```

覆盖：

| 类别 | 内容 |
| --- | --- |
| 服务 | `/api/v1/health` 返回 `ok/aiConfigured/model`，`cache-control: no-store` |
| 路由 | 页面直接访问 200；未知路径 404；函数页共享新 Footer 文案 |
| 首页 | 仅 `AI WRITING STUDIO`，无“中文优先”；`DRAFTLY`、指定 tagline/CTA、五个工具入口 |
| 密钥 | 首页 HTML + 全部 JS chunk 均不含 `sk-` / `AI_API_KEY` |
| 真实 AI | 中文“学术”润色、英文“流畅”润色、中文人性化、语法检查（含长文本）、AI 检测、中英翻译、上下文词替换、替代表达、修改原因 |
| 结构校验 | 语法 issue 的原文与偏移可重新锚定；检测分数 0–100 且带 confidence/signals/disclaimer；翻译目标语言与目标文字脚本一致；词替换 0–5 条、去重且排除原词 |
| 参数校验 | 空文本、1001 字、恰好 1000 字、非法标准/强度/语言/场景、缺 `sourceVersion`、坏 JSON、数组 body、超大请求体 413 |
| 新接口校验 | 语法空文本、检测空文本、翻译同源同目标、非法翻译风格、词替换缺选中文本 |
| 未启用 | 仅文档提取、文档导出返回 501 `FEATURE_NOT_ENABLED` |
| 限流 | 独立客户端第 21 次请求返回 429 `RATE_LIMITED`，`retryable: true` |

真实 AI 调用耗时（本次，每次请求使用独立限流客户端键）：短文本约 1.4–6.8 s；接近 1000 字的语法检查约 20–60 s。DeepSeek 可能先返回 `reasoning_content`，客户端固定预留 1200 token，避免可见回答被截断为空。

语法检查现在向模型申请 6000 token 的回答预算（客户端另加 1200 token 推理余量，合计 7200）；若仍出现空 `content` 或结构不完整，服务端会按句/段边界二分并并行重试，最多 6 次模型调用，合并后重新校验偏移与重叠。长文本因此可能需要更久，但不会再静默返回“未检测到问题”；全部重试失败时才返回明确错误。

### 真实输出样例

> 以下为测试输入与真实模型返回，实际输出会因模型版本而变化。

中文“学术 / 中等”：

```text
输入：随着人工智能技术的快速发展，越来越多的研究者开始关注大语言模型在教育领域的应用。本文通过对相关文献的梳理，分析了该技术对学生学习效果的影响。
输出：随着人工智能技术的迅速发展，越来越多的研究者开始关注大语言模型在教育领域的应用。本文通过梳理相关文献，分析该技术对学生学习效果的影响。
```

英文“流畅 / 中等”：

```text
输入：The experiment was conducted in a laboratory, and the results shows that the new method is more better than the traditional one.
输出：The experiment was conducted in a laboratory, and the results show that the new method is better than the traditional one.
```

中英翻译（自动识别 → English / Natural）：

```text
输入：这家公司正在重新设计它的客户支持流程，希望在不增加人手的情况下，把平均响应时间缩短一半。
输出：The company is redesigning its customer support process in hopes of cutting the average response time in half without adding headcount.
```

词替换建议（真实 `/api/v1/word-suggestions`）：

```json
{
  "suggestions": ["有价值的", "富有意义", "值得重视"],
  "selectedText": "有价值"
}
```

修改原因（节选）：

```text
原句“由于……所以……”的因果连接冗余，且“对……进行优化”搭配较啰嗦；改句删去关联词、改用“这一功能”作主语，并简化为“继续优化”，使表达更简洁、逻辑更直接。
```

## 4. 反馈接口与管理权限测试

命令：`npm run test:feedback`

```text
16 passed, 0 failed
```

覆盖：

| 类别 | 内容 |
| --- | --- |
| 提交 | 合法反馈返回 201 并真实写入 SQLite；请求体含 `request_id` |
| 校验 | 非法邮箱、少于 5 字、缺少隐私同意、蜜罐字段、非法状态均被拒绝 |
| 类别 | 首次提交使用新增的 `translation_quality`，后台可检索并正确显示 |
| 公开读取 | 匿名 `GET /api/admin/feedback` 返回 401 `UNAUTHORIZED` |
| 登录 | 错误密码 401；正确密码设置 `draftly_admin` Cookie，断言 `HttpOnly`、`SameSite=Strict` |
| 数据 | 登录后按唯一正文搜索到刚写入的记录；详情返回完整正文与邮箱 |
| 更新 | `PATCH` 修改状态为 `in_progress`、写入内部备注，`updated_at` 前进 |
| 筛选 | `status=in_progress` 能返回该记录，统计数同步 |
| 归档 | `PATCH status=archived` 成功 |
| 删除 | 未登录删除 401；管理员删除 200；随后详情 404 |

所有测试记录在结束前删除，不污染本地数据库。数据库迁移通过 `schema_migrations` 记录 001 / 002 / 003，已有数据在 002 表重建时保留；003 新增 `style_profiles`，不修改原有反馈数据。

## 5. 风格画像与风格一致性接口测试

命令：`npm run test:style`

```text
13 passed, 0 failed
```

覆盖：

| # | 场景 | 断言 |
| --- | --- | --- |
| 1 | 匿名 owner | `GET /api/style-profile` 返回画像列表并设置 `HttpOnly`、`SameSite=Lax` 的 `draftly_style_owner` |
| 2 | TXT 导入 | UTF-8 / BOM 正确解码，字符数、样本名与数量准确 |
| 3 | DOCX 导入 | 用真实 zip 结构生成 DOCX，服务端从 `word/document.xml` 提取正文，不依赖外部服务 |
| 4 | PDF 导入 | 用真实 PDF 文本对象验证 `unpdf` 提取，不需要 OCR |
| 5 | 扫描版 PDF | 无文本层时返回明确失败码 `PDF_NO_TEXT`，不伪造识别结果 |
| 6 | 不支持文件 | 旧 `.doc`、图片等按文件返回错误；其他合法文件仍可成功，不因单文件失败整体 500 |
| 7 | 真实风格分析 | 真实 AI 返回六维描述、摘要、推荐指令、避免项、置信度与样本评估；结果中不包含伪造百分比；短样本置信度为 `low` |
| 8 | 画像持久化与隔离 | 创建返回 201，样本数与名称落库；owner B 列表为空，读取 owner A 的画像返回 404 |
| 9 | 重命名 | `PATCH` 后再次 `GET` 名称一致 |
| 10 | 风格感知润色 | `/api/v1/polish` 接受 `styleProfileId`，响应回显使用的画像 id/name，正文仍为完整结果 |
| 11 | 风格一致性 | 返回 `high/medium/low` 总体评级、五个维度、可重新锚定的差异区间与建议；不含百分比 |
| 12 | 二次调整 | `/api/style-consistency/apply` 返回完整新文本、应用变更列表并保留 `sourceVersion`；数字被改动时拒绝 |
| 13 | 删除 | 删除画像后再次读取 404，关联样本随画像删除 |

本次真实 AI 调用耗时：风格分析约 15–30 s，风格一致性约 15–60 s，二次调整约 4–12 s。风格一致性对空响应或结构不完整最多重试 3 次，并提高回答 token 预算，避免长推理挤占 JSON。测试结束会删除创建的画像；测试通过独立 Cookie 模拟两个匿名用户，验证隔离而不是登录权限。本轮全部测试结束后已清空自动化产生的测试画像与反馈记录（`style_profiles=0`、`feedback=0`）。

## 6. 浏览器端到端测试

命令：`npm run test:browser`

```text
39 passed, 0 failed
```

使用 Chrome DevTools Protocol，桌面 1440×1000、移动 390×844（DPR 2）。

| # | 场景 | 结果 |
| --- | --- | --- |
| 1 | 首页渲染 45/5/50 分栏、`AI WRITING STUDIO`、左对齐 `DRAFTLY`、指定文案、双 CTA 和真实 Footer；无“中文优先” | 通过 |
| 2 | 固定示例演示逐词播出、停留、可暂停；不调用 API、不遮挡 CTA | 通过 |
| 3 | Hero CTA 进入现有 `/polisher` 工作台 | 通过 |
| 4 | 首页反馈真实提交并出现成功状态 | 通过 |
| 5 | 填入示例后运行按钮启用 | 通过 |
| 6 | 选择“学术”，标准胶囊状态正确 | 通过 |
| 7 | 真实润色返回结果，出现绿色 `.diff-insert`、句子卡片、桌面双栏并排 | 通过 |
| 8 | 润色结果中的改写词可打开候选浮层；首项获得焦点；替换只作用于该精确区间；撤销回到替换前 | 通过 |
| 9 | 加载替代表达 → 应用 → 结果包含所选表达 | 通过 |
| 10 | 恢复原句 → 撤销 → 重做 | 通过 |
| 11 | 复制全文，剪贴板与结果一致 | 通过 |
| 12 | CDP 暂停润色请求并修改原文，旧响应不覆盖新结果 | 通过 |
| 13 | 二次确认清空，双栏归零 | 通过 |
| 14 | 1001 字时超限提示、`aria-invalid=true`、运行按钮禁用 | 通过 |
| 15 | 强制请求失败：显示错误、保留原文、不渲染结果 | 通过 |
| 16 | 切换 English：`lang=en`、导航更新；内容语言不被界面语言改变 | 通过 |
| 17 | 英文内容以英文完成润色，修改原因仍为中文 | 通过 |
| 18 | 人性化页面无润色标准，真实改写并解释变化 | 通过 |
| 19 | 设置页显示真实 AI 状态与模型；清除本地偏好 | 通过 |
| 20 | 未登录访问后台被重定向到登录页 | 通过 |
| 21 | 管理员登录并搜索到第 4 步的真实反馈 | 通过 |
| 22 | 打开详情、保存状态与内部备注 | 通过 |
| 23 | 归档并确认列表刷新 | 通过 |
| 24 | 永久删除（接受原生确认框），记录与统计同步消失 | 通过 |
| 25 | 语法检查调用真实 AI，逐条显示问题并应用修正 | 通过 |
| 26 | AI 检测显示有界分数、置信度、信号和“不是作者身份证明”的局限说明 | 通过 |
| 27 | 翻译：中文→英文、真实 AI 返回、风格切换、交换语言、送到语法检查 | 通过 |
| 28 | 翻译页对英文输入自动切换目标为中文，并返回中文译文 | 通过 |
| 29 | 语法页、检测页、翻译页均可直接访问，不出现模拟结果 | 通过 |
| 30 | `/privacy`、`/terms` 为真实可读页面，覆盖翻译/语法/检测与责任边界 | 通过 |
| 31 | 移动首页 390px 无横向溢出；顺序为“品牌文案 → CTA → 演示”；表单纵向堆叠 | 通过 |
| 32 | 移动后台无横向溢出，无侧栏，搜索与筛选可用 | 通过 |
| 33 | 移动润色结果无横向溢出，双栏上下堆叠 | 通过 |
| 34 | 风格画像页显示样本导入、已保存画像与分析编辑区，无横向溢出 | 通过 |
| 35 | 粘贴样本后真实 AI 生成六维画像，可编辑名称、摘要、置信度与各维度 | 通过 |
| 36 | 命名并保存画像后，可从润色页风格选择器选中并带入 `styleProfileId` | 通过 |
| 37 | 带画像润色后自动出现风格一致性面板：定性总体评级、五个维度、可逐条查看的差异与建议；打开差异审阅后可接受或忽略单条建议 | 通过 |
| 38 | 移动端风格画像页 390px 无横向溢出，导入区宽度受限 | 通过 |
| 39 | 无未捕获页面异常；除故意制造的 `net::ERR_FAILED` 外无 console error | 通过 |

> 第 15 条会故意制造一次 `net::ERR_FAILED`，来自测试本身，断言已排除。
> 第 8 条的浏览器测试对 `/api/v1/word-suggestions` 使用固定响应以保证替换交互可重复；同一接口的真实 AI 行为由第 3 节接口测试覆盖。
> 第 4 条提交的反馈会在第 24 条通过后台真实删除。

截图（`artifacts/`）：

- [`home-desktop.png`](../artifacts/home-desktop.png)
- [`home-mobile.png`](../artifacts/home-mobile.png)
- [`feedback-success-desktop.png`](../artifacts/feedback-success-desktop.png)
- [`feedback-form-mobile.png`](../artifacts/feedback-form-mobile.png)
- [`admin-login-desktop.png`](../artifacts/admin-login-desktop.png)
- [`admin-feedback-desktop.png`](../artifacts/admin-feedback-desktop.png)
- [`admin-feedback-mobile.png`](../artifacts/admin-feedback-mobile.png)
- [`polisher-result-desktop.png`](../artifacts/polisher-result-desktop.png)
- [`polisher-alternatives-desktop.png`](../artifacts/polisher-alternatives-desktop.png)
- [`polisher-english-desktop.png`](../artifacts/polisher-english-desktop.png)
- [`polisher-result-mobile.png`](../artifacts/polisher-result-mobile.png)
- [`style-profile-desktop.png`](../artifacts/style-profile-desktop.png)
- [`style-analysis-desktop.png`](../artifacts/style-analysis-desktop.png)
- [`style-consistency-desktop.png`](../artifacts/style-consistency-desktop.png)
- [`style-profile-mobile.png`](../artifacts/style-profile-mobile.png)
- [`humanize-result-desktop.png`](../artifacts/humanize-result-desktop.png)
- [`translation-desktop.png`](../artifacts/translation-desktop.png)
- [`grammar-desktop.png`](../artifacts/grammar-desktop.png)
- [`detector-desktop.png`](../artifacts/detector-desktop.png)
- [`settings-desktop.png`](../artifacts/settings-desktop.png)

## 7. PRD 验收对照

### 7.1 PRD V2.1

| # | 要求 | 证据 |
| --- | --- | --- |
| 1 | 首页只保留 `AI WRITING STUDIO`，移除“中文优先” | 浏览器 #1；接口首页断言无“中文优先” |
| 2 | 桌面 45% 左品牌 / 5% 过渡 / 50% 右演示；`DRAFTLY` 左移 | `globals.css` 的 `.landing-split`；浏览器 #1 |
| 3 | 文案：eyebrow、品牌、tagline、辅助句、CTA、中文副文案完全一致 | `src/app/page.tsx`；浏览器 #1 |
| 4 | 真实产品演示动画，固定示例，BEFORE/AFTER，不加假用户结果 | `PolishDemo.tsx`；浏览器 #2 |
| 5 | 指定 before/after 文本 | `PolishDemo.tsx` 常量；浏览器 #2 |
| 6 | 移动纵向顺序为品牌文案 → CTA → 演示 | 浏览器 #31 |
| 7 | 功能页 Footer 统一为“让每一句话，更接近你想表达的样子。” | 接口“function pages share the new footer line” |
| 8 | 润色结果内替换：悬停/点击、键盘、200–300ms、3–5 候选、精确区间、撤销、失败不修改 | 浏览器 #8；`InteractiveDiff.tsx`；接口真实建议测试 |
| 9 | 真实 `/api/v1/word-suggestions` | 接口 37/37 中的真实建议测试 |
| 10 | 九种润色标准、人性化、翻译、反馈/后台保留 | 浏览器 #5–#7、#18、#21–#24、#27；接口回归全部通过 |
| 11 | 真实语法检查与真实 AI 文本检测 | 浏览器 #25–#26；接口真实 AI 调用 |
| 12 | 检测器不声称确定作者身份 | 页面文案、接口 disclaimer、条款页；浏览器 #26 |
| 13 | 独立翻译页：中↔英、自动识别、交换、三种风格、编辑/复制/重译/转送 | 浏览器 #27–#28；接口翻译测试 |
| 14 | 反馈类别新增 `Translation quality`；开发者“一元硬币”；动态年份；真实持久化 | 反馈 16/16；浏览器 #4/#21–#24 |
| 15 | 最终可运行、构建通过、自动化回归 | 构建 34 条路由全部编译；核心 24 + 接口 37 + 反馈 16 + 风格 13 + 浏览器 39 |

### 7.2 Style Profile 与风格一致性 PRD

| # | 要求 | 证据 |
| --- | --- | --- |
| 1 | 支持粘贴与 TXT / DOCX / PDF 多样本导入、查看、删除、字符与数量校验 | 风格 API #2–#6；`StyleSampleImporter`；浏览器 #34 |
| 2 | 扫描版 PDF 必须明确失败，不伪造 OCR | 风格 API #5 返回 `PDF_NO_TEXT`；页面按文件显示错误 |
| 3 | 真实 AI 分析语气、用词、句式、表达、段落、修辞、禁忌，给出摘要、六维、推荐指令、避免项、置信度与样本充分性 | 风格 API #7；浏览器 #35；`prompts-style.ts` |
| 4 | 短文本不得声称风格稳定 | 195 字样本真实返回 `confidence=low`；分析编辑器显示“样本不足”评估与限制 |
| 5 | 多个命名画像的新建、打开、重命名、删除、补充样本、重新分析、时间与样本数展示 | 风格 API #8–#9、#13；浏览器 #36；`StyleProfileWorkspace` |
| 6 | 画像按 owner 隔离，不自动合并；删除画像同时删除样本 | 风格 API #8、#13；SQLite 行内 JSON 随行删除 |
| 7 | 润色页“写作风格”提供默认风格与已保存画像，九种标准仍可选 | `StyleProfilePicker`；浏览器 #36；`TransformWorkspace` |
| 8 | 优先级：事实/立场/数字/引用 > 润色标准 > 风格画像 > 非必要改写 > 内部一致 | `styleBlockZh/En` 与 polish system prompt；风格 API #10 |
| 9 | 选择画像润色后自动做风格一致性；未选画像不显示 | `StyleConsistencyPanel` 仅在 `styleProfileId` 存在时请求与渲染 |
| 10 | 只显示高/中/低，不用未校准百分比；五维、具体位置/原因、可执行建议 | 风格 API #11；浏览器 #37 断言无 `%` |
| 11 | 应用建议做仅风格二次修订，保留事实与逻辑，生成完整新稿，保留上一版并可撤销 | `/api/style-consistency/apply`；`applyFullText` 单步历史；数字变化拒绝 `STYLE_APPLY_UNSAFE` |
| 12 | 差异审阅列出具体词句、类型、原因，可逐条接受或忽略 | `style-accept-difference` / `style-ignore-difference`；浏览器 #37 实际忽略一条并确认列表减少 |
| 13 | API：分析、CRUD、一致性分析、应用建议；润色接受 `style_profile_id` | 六条 API 路由；`PolishRequest.styleProfileId`；风格 API #10 |
| 14 | 样本与画像仅 owner 可读，服务端保存 API Key，导入做大小/类型安全校验 | 匿名 Cookie + owner 查询；10 MB/文件、5 文件、12 MB 请求；Key 不进入客户端 |
| 15 | 构建、测试、环境模板与部署文档 | 构建通过（34 条路由）；五套测试通过；README / `.env.example` / 本文件 |

## 8. 未覆盖与限制

- 润色页的 DOCX/TXT 文档导入导出与草稿版本仍未实现，对应接口返回 501；风格画像样本导入是独立能力，不要与润色文档流程混淆。
- 风格画像没有账号体系，只按匿名 `draftly_style_owner` Cookie 隔离，是数据隔离而非登录鉴权；清除 Cookie、换浏览器或换域名会得到新的 owner，原画像无法找回。需要跨设备时应接入正式账号。
- 风格样本支持 TXT、DOCX（正文段落）与带文本层的 PDF；不提供 OCR，扫描版 PDF 明确返回 `PDF_NO_TEXT`。复杂排版、表格、页眉页脚、批注与图片内容不保证保留，旧 `.doc` 不支持。
- 画像上限 20 个、单样本 12,000 字、合计 40,000 字、单文件 10 MB、单次 5 个文件、请求体 12 MB；超限会明确拒绝，不会静默截断。
- 风格分析是对语言表面特征的估计，不判断作者身份、写作水平或事实正确性；短样本会标为低置信度并提示补充，不能据此声称“已掌握稳定风格”。
- 风格一致性只给高/中/低定性评级，不提供未校准的百分比；评级与差异由模型生成，可能漏判或误判，最终取舍由用户完成。
- 二次调整只做窄范围数字一致性检查（ASCII 数字 token），不能证明所有事实、立场、引用都未改变；界面保留上一版与撤销，但仍建议用户复核。
- AI 检测是概率性语言特征估计，可能误判，不能作为作者身份证明或学术/人事/法律裁决依据。
- 翻译与检测比润色更慢；界面有加载态、错误态与取消请求，失败时保留输入。
- 反馈使用 SQLite 单实例存储；无状态 Serverless 多副本需迁移到 Postgres/Supabase。
- 管理员为单一共享密码，没有多用户角色、邮件验证或找回密码流程。
- 反馈/登录限流为单实例内存实现；多实例部署需换成共享存储。
- 未做真实用户可用性测试、屏幕阅读器实测与长时间浸泡测试；浏览器测试覆盖语义标签、`aria-*`、焦点与 Escape 基础可访问性。词替换的 Enter/Escape 键盘路径在组件内实现，但浏览器用例只直接断言了打开与首项焦点；翻译的编辑/复制/重译沿用与润色一致的本地状态，未逐项做端到端断言。
- 第三方 AI 输出每次不同，本文样例仅代表一次真实返回。
- 首次加载先渲染默认中文，再从 localStorage 切换到已保存语言。