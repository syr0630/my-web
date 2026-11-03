# Draftly

> Polish your draft in seconds.
> 面向学生、研究者、职场人与内容创作者的中英双语 AI 文本工作台。

Draftly 是一个 Next.js 全栈应用：界面默认简体中文，可切换英文；**界面语言与文本处理语言相互独立**。所有 AI 请求都在服务端完成，浏览器不接触 API Key。

---

## 当前交付状态

| 模块 | 路由 | 状态 |
| --- | --- | --- |
| 首页（品牌 Hero、功能入口、反馈与 Footer） | `/` | ✅ 已完成 |
| 用户反馈表单 | `/#feedback` | ✅ 真实写入 SQLite，含成功/失败状态 |
| 反馈管理后台 | `/admin/feedback` | ✅ 服务端会话鉴权、筛选、备注、归档、删除 |
| 隐私说明 / 使用条款 | `/privacy`、`/terms` | ✅ 真实内容页 |
| 文本润色（9 种标准 / 3 档强度） | `/polisher` | ✅ 已完成，已接入真实 AI |
| 人性化改写 | `/humanize` | ✅ 已完成，已接入真实 AI |
| 中英翻译（自然 / 正式 / 学术） | `/translate` | ✅ 已完成，已接入真实 AI |
| 语法检查（逐条定位与接受/忽略） | `/grammar` | ✅ 已完成，已接入真实 AI |
| 写作风格画像（导入 / 分析 / 多画像 CRUD） | `/tools/style-profile` | ✅ 已完成，真实 TXT/DOCX/PDF 解析与 AI 分析 |
| AI 文本检测（概率性辅助信号） | `/ai-detector` | ✅ 已完成，含置信度与局限说明 |
| 设置 | `/settings` | ✅ 已完成（语言、限制、隐私、AI 状态） |
| DOCX / TXT 正文导入导出 | — | ⛔ 未启用（预留接口返回 501；风格画像样本导入不受影响） |
| 草稿 / 版本管理 | — | ⛔ 未启用（当前只有浏览器内撤销/重做） |

> 正文文档导入/导出仍为预留能力，接口统一返回 `501 FEATURE_NOT_ENABLED`，页面不提供假入口；
> `/tools/style-profile` 的 TXT/DOCX/PDF 仅用于提取风格样本，不是正文编辑器导入。
> 语法检查与 AI 检测均为真实服务；AI 检测只给出概率性语言特征估计，不声称确定作者身份。

### 已实现的核心能力

- **统一编辑器状态**：分别保存 `originalText`、`generatedText`、`currentText`、`sourceVersion`，结果区与原文区共用同一套历史与差异模型。
- **文本润色**：9 种标准（标准、流畅、人性化、正式、学术、简洁、创意、扩写、缩写），3 档强度，可选写作场景。
- **人性化改写**：拆分编辑器、语言自动识别 / 手动选择、强度、逐句高亮、恢复原句、复制、替代表达、修改原因。英文文本润色时，正文与替代表达保持英文，**修改原因统一用中文说明**。
- **真实差异**：基于句子对齐 + 词级 LCS 的绿色高亮；黄色波浪线表示该句已有替代表达；可切换显示删除内容。
- **润色结果内替换**：只在润色结果的 AI 改写词上提供交互；桌面悬停 240ms / 移动端点按打开固定定位浮层，3–5 个上下文候选，只替换精确字符区间，支持撤销与复制最新结果，失败不修改文本。候选按上下文缓存，不会在鼠标移动时发请求。
- **中英翻译**：中↔英、自动识别、交换语言、自然/正式/学术三种语气；译文可编辑、复制、重新翻译，并可带到文本润色或语法检查。
- **语法检查**：真实 AI 校对，返回 `start/end/original/replacement`，服务端重新锚定偏移并生成修正文本；用户可逐条应用或忽略。
- **写作风格画像**：粘贴或上传 TXT/DOCX/PDF，真实文本提取；AI 分析语气、用词、句式、表达、段落与修辞，生成概述、六维画像、推荐写法、避免项、置信度与样本局限。支持最多 8 份样本、40,000 字、20 个命名画像，支持新建/重命名/删除/追加样本/重新分析；画像按匿名浏览器 Cookie 隔离。扫描版 PDF 明确返回 `PDF_NO_TEXT`，不做假 OCR。
- **风格感知润色**：文本润色可选择 Default Style 或已保存画像；优先级为“事实/立场/数字/引用 > 所选润色标准 > 风格画像 > 非必要改写 > 内部一致”，不会把样本中的具体内容带入正文。
- **风格一致性反馈**：使用画像润色后自动分析五维一致性（高/中/低，不显示未经校准的百分比），指出具体差异位置、原因与替换建议；可应用建议进行第二次风格调整（保留原版本与撤销），或逐项接受差异。未选画像时不显示。
- **AI 文本检测**：真实 AI 分析句式、套话、信息密度等表面信号，返回 0–100 辅助分数、置信度、信号与免责声明；不伪造随机分数，不把结果表述为作者身份证明。
- **1000 可见字符限制**：以中文 1000 字为基准；客户端实时计数并在超限时禁用运行，服务端再次校验，前后端规则一致。
- **本地编辑能力**：逐句恢复、复制单句、应用替代、复制全文、撤销、重做、二次确认清空。
- **请求时序保护**：每次请求携带 `sourceVersion` 与序号；旧请求的响应不会覆盖请求期间的新编辑。浏览器测试中通过 CDP 暂停请求验证。
- **失败保留原文**：网络失败、校验失败、AI 上游失败时保留用户输入，显示可读错误、错误码与 `request_id`；可重试。
- **零 HTML 注入**：AI 返回内容只作为 React 文本节点渲染，不使用 `dangerouslySetInnerHTML`。
- **桌面 / 移动端**：桌面左侧导航 + 双栏编辑器；移动端紧凑顶栏、全屏抽屉菜单、上下堆叠编辑器。
- **品牌首页**：暖白纸感背景、超大衬线字标、左侧品牌文案 + 中间过渡 + 右侧固定产品演示；五个功能入口（润色、人性化、翻译、语法、检测）；演示不调用 API、不阻塞 CTA，并支持暂停与 `prefers-reduced-motion`。
- **真实反馈链路**：邮箱选填、类别（含“翻译质量”）/正文/隐私同意服务端校验、蜜罐与 5 次/分钟限流、SQLite 持久化；成功、失败、加载状态齐全，失败保留输入。
- **受保护的后台**：`/admin/feedback` 使用 HMAC 签名的 HttpOnly Cookie；服务端页面与每个管理 API 双重校验；支持搜索、类别/状态筛选、时间排序、详情、状态、内部备注、归档与删除确认。
- **真实隐私与条款页**：`/privacy`、`/terms` 有实际内容，不是空链接；开发者署名“一元硬币”保留中文原名，版权年份动态生成。

---

## 快速开始

要求：Node.js **24+**（反馈与风格画像共用 Node 内置 `node:sqlite`；本次在 v26.13.0 验证）、npm。

```bash
npm install
copy .env.example .env.local     # Windows
# cp .env.example .env.local     # macOS / Linux
npm run db:migrate
```

编辑 `.env.local`，填入 AI 服务与管理员配置：

```dotenv
AI_API_KEY=your-api-key-here
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-flash

FEEDBACK_DB_PATH=.data/draftly.sqlite
ADMIN_PASSWORD=replace-with-a-long-random-password
ADMIN_SESSION_SECRET=replace-with-at-least-32-random-characters
ADMIN_COOKIE_SECURE=false
```

生成管理员会话密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

启动开发服务器：

```bash
npm run dev
```

打开 <http://localhost:3000>。首页、`/polisher`、`/humanize`、`/settings` 均可直接访问与刷新；反馈后台在 <http://localhost:3000/admin/login>。

生产构建：

```bash
npm run build
npm run start
```

### 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `AI_API_KEY` | 是 | 仅服务端读取，不会进入浏览器 bundle |
| `AI_BASE_URL` | 是 | OpenAI 兼容根地址，例如 `https://api.deepseek.com`、`https://api.openai.com/v1` |
| `AI_MODEL` | 是 | 例如 `deepseek-flash`、`deepseek-v4-pro`、`gpt-4o-mini` |
| `FEEDBACK_DB_PATH` | 否 | SQLite 文件，默认 `.data/draftly.sqlite`；生产环境请指向持久卷 |
| `ADMIN_PASSWORD` | 是（后台） | 管理员登录密码，只在服务端读取 |
| `ADMIN_SESSION_SECRET` | 是（后台） | 至少 32 字符，签名 8 小时管理员 Cookie |
| `ADMIN_COOKIE_SECURE` | 否 | HTTPS 部署时设为 `true`，本地 HTTP 保持 `false` |

未配置 `AI_API_KEY` 时，`/api/v1/health` 返回 `aiConfigured: false`，AI 接口返回 `503 AI_NOT_CONFIGURED`；页面会显示清晰提示，不会假装生成成功。未配置管理员变量时，`/admin/login` 会明确显示“后台尚未配置”。

---

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/v1/health` | 服务与 AI 配置状态（不暴露密钥） |
| `POST` | `/api/v1/polish` | 文本润色 |
| `POST` | `/api/v1/humanize` | 人性化改写 |
| `POST` | `/api/v1/alternatives` | 为单句生成 1–5 条替代表达 |
| `POST` | `/api/v1/explain-change` | 解释单句修改原因（英文文本也返回中文说明） |
| `POST` | `/api/v1/translate` | 中英翻译，支持 `natural` / `formal` / `academic` |
| `POST` | `/api/v1/grammar/check` | 语法检查，返回带精确偏移的 issue 列表与修正文本 |
| `POST` | `/api/v1/detector/analyze` | AI 写作特征估计（0–100、置信度、信号、免责声明） |
| `POST` | `/api/v1/word-suggestions` | 润色结果的上下文替换候选（3–5 条，最多 5 条） |
| `POST` | `/api/style-profile/analyze` | 分析样本并生成风格画像（真实 AI） |
| `GET` / `POST` | `/api/style-profile` | 列出 / 创建当前匿名访客的风格画像 |
| `GET` / `PATCH` / `DELETE` | `/api/style-profile/:id` | 读取 / 重命名·更新 / 删除画像 |
| `POST` | `/api/style-profile/extract` | 从 TXT/DOCX/PDF 提取样本文字（multipart） |
| `POST` | `/api/style-consistency/analyze` | 所选画像与当前润色稿的五维一致性反馈 |
| `POST` | `/api/style-consistency/apply` | 应用风格建议的第二次调整（数字变动会被拒绝） |
| `POST` | `/api/v1/documents/extract` | 预留，返回 `501` |
| `POST` | `/api/v1/documents/export` | 预留，返回 `501` |
| `POST` | `/api/feedback` | 提交反馈（公开，5 次/分钟，蜜罐 + 服务端校验） |
| `POST` | `/api/admin/login` | 管理员登录（HttpOnly 会话 Cookie） |
| `POST` | `/api/admin/logout` | 退出管理员会话 |
| `GET` | `/api/admin/feedback` | 管理员列表（搜索/筛选/排序/分页） |
| `GET` | `/api/admin/feedback/:id` | 管理员查看详情 |
| `PATCH` | `/api/admin/feedback/:id` | 管理员更新状态/内部备注 |
| `DELETE` | `/api/admin/feedback/:id` | 管理员删除记录 |

错误响应统一为：

```json
{
  "request_id": "…",
  "error_code": "TEXT_TOO_LONG",
  "message": "文本超过 1000 个可见字符…",
  "retryable": false
}
```

服务端校验：JSON 结构、文本非空、1000 可见字符、标准枚举、强度枚举、内容语言枚举、场景枚举、`sourceVersion` 长度；普通 AI 请求体上限 64 KB。风格画像分析与 CRUD 的上限为 320 KB；文件提取请求上限 12 MB、单文件 10 MB。限流为每客户端 **20 次/分钟**。

### 反馈与管理员后台

反馈不是前端假成功：`POST /api/feedback` 会写入 SQLite 的 `feedback` 表，后台列表从同一张表读取。邮箱可选，类别/正文/隐私同意必填；正文 5–5000 个可见字符；接口有 5 次/分钟限流和隐形蜜罐。

后台地址 `/admin/feedback`，登录页 `/admin/login`。页面在服务端检查会话，未登录直接重定向；每个管理 API 还会再次校验 HMAC 签名的 HttpOnly Cookie。支持搜索邮箱/正文、按类别与状态筛选、按时间排序、查看详情、修改状态、写内部备注、归档和删除确认。

完整的数据库字段、环境变量、接口、安全边界、备份与 Serverless 迁移步骤见 [`docs/FEEDBACK-ADMIN.md`](docs/FEEDBACK-ADMIN.md)。

---

## 设计系统

当前视觉方向：**编辑工作室**。功能页保持白色底 + 深绿交互 + 暖米白辅助；首页使用暖白纸感背景、超大衬线 `Draftly` 字标、细线与大留白，Footer 以浅米色承载反馈表单；后台登录以深绿“back room”与暖白表单形成品牌对照。完整色板、组件规则、对比度与禁止项见 [`design-system/draftly/MASTER.md`](design-system/draftly/MASTER.md)。

---

## 测试

```bash
npm run test:core       # 纯函数：字符计数、语言识别、断句、diff、句子对齐
npm run test:api        # 真实 HTTP + 真实 AI 的接口测试
npm run test:feedback   # 反馈提交、校验、管理员鉴权、增删改查
npm run test:style      # 风格画像导入/分析/CRUD、风格一致性分析与二次调整
npm run test:browser    # 无头 Chrome 桌面 / 移动端端到端测试
```

后三项需要先启动服务：

```bash
npm run build
npm run start -- -p 3100
# 另开终端
set BASE_URL=http://127.0.0.1:3100
npm run test:api
npm run test:feedback
npm run test:style
npm run test:browser
```

浏览器测试使用本机 Chrome 的 CDP 接口（`--headless=new`），不依赖 Playwright。截图输出在 `artifacts/`。

最近一次结果（2026-10-31）：

| 套件 | 结果 |
| --- | --- |
| 单元测试 | **24 / 24 通过** |
| 接口集成测试 | **37 / 37 通过**（含真实中英文润色、人性化、翻译、语法、检测与词替换建议） |
| 反馈接口测试 | **16 / 16 通过**（真实 SQLite、登录、权限、增删改查） |
| 风格画像接口测试 | **13 / 13 通过**（TXT/DOCX/PDF 提取、扫描件拒绝、真实风格分析、画像 CRUD、风格一致性、二次调整） |
| 浏览器端到端测试 | **39 / 39 通过**（桌面 1440px + 移动 390px，含首页演示、润色词替换、风格画像、真实翻译/语法/检测与后台操作） |
| `next build` | 通过（类型检查 + ESLint） |

完整证据、真实 AI 输出样例与验收对照见 [`docs/TEST-RESULTS.md`](docs/TEST-RESULTS.md)；反馈模块配置见 [`docs/FEEDBACK-ADMIN.md`](docs/FEEDBACK-ADMIN.md)。

---

## 部署

### 通用 Node 主机 / Docker

1. 使用 Node 24+；设置 `AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL` 环境变量（不要写进镜像）。
2. 设置 `FEEDBACK_DB_PATH` 指向持久卷（例如 `/var/lib/draftly/draftly.sqlite`），并配置 `ADMIN_PASSWORD`、至少 32 位的 `ADMIN_SESSION_SECRET`。
3. HTTPS 部署时设置 `ADMIN_COOKIE_SECURE=true`；风格画像 Cookie 会根据请求协议与 `x-forwarded-proto` 自动加 `Secure`。
4. `npm ci && npm run build`；首次运行前可执行 `npm run db:migrate`（启动后也会自动建表，含 `003_style_profiles`）。
5. `npm run start`（默认 3000 端口，可用 `-p` 指定）。
6. 用 Nginx / Caddy 反向代理并启用 HTTPS；定期备份 SQLite 文件与其 WAL 文件。风格画像样本也在这个数据库里，备份策略需覆盖。
7. 反向代理的请求体上限至少设为 12 MB，否则风格样本文件上传会在到达应用前被拒绝。TXT/DOCX/PDF 解析在应用内完成，不需要额外 OCR 服务；扫描版 PDF 会明确返回 `PDF_NO_TEXT`。

### Vercel

SQLite 不适合 Vercel 的临时文件系统。若必须使用 Vercel，请先把反馈存储替换为 Postgres/Supabase 并配置服务端连接串；具体迁移字段与步骤见 [`docs/FEEDBACK-ADMIN.md`](docs/FEEDBACK-ADMIN.md#7-生产部署)。AI 部分仍可按原方式配置三个变量。

### 限流与代理

限流是**单实例内存实现**，并按 `x-forwarded-for` / `x-real-ip` 区分客户端。生产环境请确保反向代理覆盖而不是透传客户端自带的 `x-forwarded-for`；多实例部署时应替换为 Redis 等共享存储。若直接暴露 Node 服务，应改为读取可信的 socket 地址。反馈与登录接口的限流同样受此边界影响。

---

## 隐私与安全

- API Key 只在服务端读取；接口测试会扫描首页 HTML 与全部 JS chunk，确认不含 Key。
- 匿名润色文本默认不写数据库、不写入磁盘；错误日志只记录错误码和 `request_id`，不记录用户全文。
- 反馈表单会真实写入 SQLite：类别、正文、可选邮箱、同意时间、状态与内部备注；反馈只可通过管理员后台读取，公开接口只写不读。
- 风格画像与样本会真实写入同一 SQLite：画像名称、AI 分析、样本文本、来源/字数与时间戳；按 HttpOnly 匿名 Cookie `draftly_style_owner` 隔离，删除画像会连带删除样本。该 Cookie 是数据隔离，不是账号登录安全；原始上传文件只在内存中解析，不落盘。
- 画像分析时样本文本会发给第三方 AI；套用画像润色时只发送分析结果，不发送样本全文。
- 管理员密码与会话密钥只保存在服务端环境变量；会话 Cookie 使用 HttpOnly + SameSite=Strict + HMAC 签名。
- 普通日志不包含完整文档；请求体大小受限。
- 用户文本会经本站服务端转发给第三方 AI 服务商（DeepSeek 或所配置的兼容服务），页面与设置页均明确披露。
- AI 输出永远按纯文本渲染，不执行 HTML/脚本。
- 浏览器只保存两项偏好：`draftly.uiLocale`、`draftly.contentLanguage`，可在设置页一键清除；管理员 Cookie 仅登录后台时设置；风格画像匿名 Cookie 仅在使用风格画像时设置。

---

## 项目结构

```
src/
  app/                    # 首页、polisher、humanize、translate、grammar、ai-detector、style-profile、settings、privacy、terms
    admin/                # 登录与受保护的反馈后台
    api/                  # AI、反馈、管理员、风格画像/一致性接口（含 word-suggestions）
  components/
    admin/                # 登录表单、反馈后台客户端
    common/               # 图标、计数器、分段控件、提示、页头
    detector/             # AI 检测工作区与分数环
    editor/               # 双栏编辑器、交互式差异、逐句面板、工具栏、工作区、风格选择与一致性面板
    feedback/             # 首页反馈表单与状态
    grammar/              # 语法检查工作区与问题列表
    home/                 # 固定产品演示 PolishDemo
    layout/               # 侧栏、移动端抽屉、AppShell
    polisher/             # 9 种标准胶囊、场景选择
    style-profile/        # 样本导入、画像编辑、画像工作区
    translate/            # 中英翻译工作区
  hooks/useEditorState.ts # 统一编辑器状态机（历史、恢复、替代、精确区间替换、整稿二次调整）
  lib/
    admin/                # 管理员密码、HMAC 会话、Cookie 选项
    ai/                   # 服务端 AI 客户端、润色/翻译/语法/检测/风格提示词、校验
    api/                  # 浏览器请求封装（含 multipart）与错误本地化
    diff/                 # 断句、对齐、LCS 差异
    feedback/             # SQLite 读写、类型、服务端校验
    style-profile/        # 文件提取、owner Cookie、画像 CRUD、校验、一致性归一化
    handoff.ts            # 工具间安全的 sessionStorage 文本交接
    i18n/                 # 中英文文案与 LocaleProvider
    language/             # 语言识别
    text/                 # 可见字符计数
  types/node-sqlite.d.ts  # Node 24 内置 SQLite 的最小类型声明
db/migrations/            # 001 建表、002 增加 translation_quality 类别、003 风格画像
scripts/                  # 单元 / 接口 / 反馈 / 浏览器 / 风格画像测试与迁移脚本
docs/                     # 测试、反馈后台配置与验收记录
artifacts/                # 测试截图
```

---

## 已知限制

- 文档正文导入/导出、草稿版本仍未实现；正文 DOCX/TXT 接口返回 `501`，不提供假入口。风格画像的样本导入是单独能力。
- 风格画像没有账号体系，只按匿名 Cookie 隔离；清除浏览器 Cookie 或换设备后无法找回画像。浏览器测试/部署切换域名时也会得到新的 owner。
- 扫描版 PDF 不支持 OCR，会明确失败；加密/损坏的 PDF、DOCX 可能无法提取文本。
- 风格一致性是辅助判断，只有高/中/低三档，不含校准过的百分比；短文本或混合文体时可信度有限。
- AI 检测结果依赖模型对语言特征的估计，可能误判；产品内已明确标注“不是作者身份证明”，不作为学术、人事或法律裁决依据。
- 翻译与 AI 检测通常比润色更慢；界面有加载态与可取消请求，失败时保留输入。
- AI 结果为一次性返回，未实现流式输出。
- 反馈使用 SQLite，适合单 Node 实例 + 持久磁盘；无状态 Serverless 多副本需迁移到 Postgres/Supabase。
- 管理员是单一共享密码，没有多用户角色、邮件验证或找回密码流程；请使用强密码并置于服务端环境变量。
- 反馈与登录限流为单实例内存实现，不适合多实例直接横向扩展。
- 未做账号体系与云端同步；清空浏览器存储后编辑内容不保留。
- 页面语言切换依赖 `localStorage`，首次加载会先渲染默认中文再切换到已保存语言。
- 第三方模型输出质量与延迟取决于所配置的服务商。