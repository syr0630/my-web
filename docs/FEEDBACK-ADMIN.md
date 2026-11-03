# 反馈系统与管理员后台

本文档说明 Draftly 首页反馈表单、SQLite 数据存储、管理员登录与 `/admin/feedback` 后台的配置、部署和安全边界。

## 1. 架构

```text
首页 /#feedback
  └─ POST /api/feedback
       ├─ 频率限制 5 次/分钟/客户端
       ├─ 蜜罐字段 + 服务端字段校验
       └─ SQLite feedback 表

/admin/login
  └─ POST /api/admin/login
       ├─ ADMIN_PASSWORD 常量时间比较
       └─ HMAC-SHA256 签名的 HttpOnly Cookie（8 小时）

/admin/feedback（服务端校验会话，未登录 302 到登录页）
  ├─ GET    /api/admin/feedback
  ├─ GET    /api/admin/feedback/:id
  ├─ PATCH  /api/admin/feedback/:id
  └─ DELETE /api/admin/feedback/:id
```

没有使用外部数据库，也不依赖 Supabase。数据库是 Node 24 内置的 `node:sqlite`，文件默认位于 `.data/draftly.sqlite`，首次打开时自动执行 [`db/migrations/001_feedback.sql`](../db/migrations/001_feedback.sql)，并通过 `schema_migrations` 记录已应用版本；已有数据库会执行 [`002_feedback_translation_category.sql`](../db/migrations/002_feedback_translation_category.sql)，重建表以加入“翻译质量”类别并保留全部记录。

## 2. 数据结构

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | TEXT / UUID | 主键 |
| `email` | TEXT NULL | 可选邮箱；不公开 |
| `category` | TEXT | `feature_request` / `bug_report` / `translation_quality` / `writing_experience` / `other` |
| `message` | TEXT | 5–5000 可见字符 |
| `status` | TEXT | `new` / `in_progress` / `resolved` / `archived` |
| `admin_note` | TEXT NULL | 仅管理员可见 |
| `consent` | INTEGER | 是否勾选隐私同意（0/1） |
| `consented_at` | TEXT | 同意时间（ISO 8601） |
| `created_at` | TEXT | 提交时间 |
| `updated_at` | TEXT | 最近更新 |

迁移脚本：

```bash
npm run db:migrate
```

脚本是幂等的，可以重复执行。生产环境应把 `FEEDBACK_DB_PATH` 指向持久卷；不要指向临时文件系统。

## 3. 环境变量

```dotenv
FEEDBACK_DB_PATH=.data/draftly.sqlite
ADMIN_PASSWORD=replace-with-a-long-random-password
ADMIN_SESSION_SECRET=replace-with-at-least-32-random-characters
ADMIN_COOKIE_SECURE=false
```

| 变量 | 说明 |
| --- | --- |
| `FEEDBACK_DB_PATH` | SQLite 路径；相对路径从项目根目录解析 |
| `ADMIN_PASSWORD` | 管理员登录密码；只在服务端读取 |
| `ADMIN_SESSION_SECRET` | 至少 32 字符；签名管理员会话 Cookie |
| `ADMIN_COOKIE_SECURE` | HTTPS 部署时设为 `true`；本地 HTTP 保持 `false` |

生成密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

不要提交 `.env.local`。`.env.example` 只有占位值。修改 `ADMIN_SESSION_SECRET` 会让所有现有管理员会话立即失效。

本机开发环境已经生成了一组随机密码与会话密钥，写在 `.env.local`（被 `.gitignore` 忽略）。登录 `/admin/login` 时使用该文件里的 `ADMIN_PASSWORD`；部署前必须替换。

## 4. 本地运行

```bash
npm install
cp .env.example .env.local      # Windows: copy
# 填入 AI 配置与管理员配置
npm run db:migrate
npm run build
npm run start -- -p 3100
```

访问：

- 首页反馈表单：<http://localhost:3100/#feedback>
- 管理员登录：<http://localhost:3100/admin/login>
- 反馈后台：<http://localhost:3100/admin/feedback>

如果没有配置 `ADMIN_PASSWORD` 或 `ADMIN_SESSION_SECRET`，登录页会显示“后台尚未配置”，不会接受默认密码。

## 5. 接口

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| `POST` | `/api/feedback` | 公开 | 提交反馈；201 成功；5 次/分钟/客户端 |
| `POST` | `/api/admin/login` | 公开 | 密码登录；5 次/分钟/客户端；成功设置 Cookie |
| `POST` | `/api/admin/logout` | 公开 | 清除管理员 Cookie |
| `GET` | `/api/admin/feedback` | 管理员 | 分页、搜索、类别/状态筛选、时间排序、状态统计 |
| `GET` | `/api/admin/feedback/:id` | 管理员 | 查看完整反馈 |
| `PATCH` | `/api/admin/feedback/:id` | 管理员 | 更新 `status` / `admin_note` |
| `DELETE` | `/api/admin/feedback/:id` | 管理员 | 删除记录 |

列表查询参数：`search`、`category`、`status`、`sort=newest|oldest`、`page`（每页 20 条）。

错误沿用 Draftly 统一信封：

```json
{
  "request_id": "…",
  "error_code": "UNAUTHORIZED",
  "message": "请先登录管理员账号。",
  "retryable": false
}
```

## 6. 安全控制

- 反馈与后台路由都在 Node.js 服务端执行；数据库模块不会进入浏览器 bundle。
- 管理员页面在服务端读取 Cookie 并重定向；即使知道 URL，没有有效会话也看不到数据。
- 所有管理 API 都再次校验会话（不仅是前端隐藏）。
- Cookie：`HttpOnly`、`SameSite=Strict`、`Path=/`，默认 8 小时；HTTPS 下开启 `Secure`。
- 密码使用 SHA-256 后常量时间比较；Cookie 使用 HMAC-SHA256 签名并校验过期时间。
- 反馈正文、邮箱、备注均通过参数化 SQL 写入；页面用 React 文本节点渲染，不使用 `dangerouslySetInnerHTML`。
- 公开接口只写不读；没有公开的反馈列表或邮箱查询接口。
- 蜜罐字段 `website` 一旦有值即拒绝；公开提交限制 5 次/分钟/客户端；登录限制 5 次/分钟/客户端。
- 反馈正文 5–5000 字符，邮箱选填且校验格式，备注最多 2000 字符，请求体上限沿用 64 KB。

### 已知边界

- 限流是单实例内存实现；多实例部署需要 Redis 等共享存储。
- SQLite 适合单 Node 实例和持久磁盘，不适合无状态 Serverless 多副本。若部署到 Vercel 等平台，需要改用 Postgres/Supabase；表结构与查询逻辑可直接迁移。
- 当前没有邮件发送、验证码、自动保留期任务或审计日志；删除请求需维护者手动处理。
- 管理员是单一共享密码，没有多用户角色；如需多人协作应接入正式身份提供商。

## 7. 生产部署

### 单台 Node 主机 / Docker

1. 准备持久化目录，例如 `/var/lib/draftly`，设置 `FEEDBACK_DB_PATH=/var/lib/draftly/draftly.sqlite`。
2. 设置 `ADMIN_PASSWORD` 与 `ADMIN_SESSION_SECRET`（至少 32 字符），HTTPS 时设置 `ADMIN_COOKIE_SECURE=true`。
3. `npm ci && npm run build`。
4. 启动 `npm run start`，前置 Nginx/Caddy 处理 HTTPS。
5. 只运行一个写入实例，或确认 SQLite 文件位于所有实例共享的持久存储（不推荐多实例共享 SQLite）。
6. 定期备份 `.data/draftly.sqlite`（以及同目录的 `-wal` / `-shm` 文件）；备份前可短暂停写或使用 SQLite 在线备份。

### Serverless / Vercel

当前 SQLite 实现不适合 Vercel 的临时文件系统。需要：

1. 建立 Postgres / Supabase 的 `feedback` 表（字段见第 2 节）。
2. 将 `src/lib/feedback/db.ts` 的读写函数替换为对应数据库客户端；接口签名保持不变。
3. 把数据库连接串放入服务端环境变量，不要使用 `NEXT_PUBLIC_` 前缀。
4. 配置数据库行级访问策略或仅允许服务端 service role 访问，禁止匿名读取。
5. 多实例部署时把内存限流替换为共享限流。

### 代理与 Cookie

反向代理必须覆盖而不是透传客户端伪造的 `x-forwarded-for`。如果站点通过 HTTPS 访问，必须设置 `ADMIN_COOKIE_SECURE=true`；否则浏览器不会发送管理员 Cookie。若使用自定义域名/子路径，保持 Cookie `Path=/` 与站点根路径一致。

## 8. 测试

```bash
npm run test:feedback   # 16 项：提交、校验、鉴权、增删改查、归档
npm run test:browser    # 含首页反馈提交、登录、后台操作、移动端布局
```

测试会读取 `.env.local` 的 `ADMIN_PASSWORD` 进行真实登录；不会打印密码。测试产生的反馈记录会在测试结束前删除。

## 9. 数据删除与保留

- 反馈默认保留至处理完成/归档之后，由维护者决定删除时间。
- 用户在反馈中要求删除时，维护者可在后台搜索邮箱/正文，确认后使用“永久删除”。
- 没有邮箱的匿名反馈无法可靠定位；如需匿名删除能力，应增加一次性删除凭证（当前未实现）。
- 普通润色文本不进入反馈数据库；关闭页面后不会在服务端留下可检索副本。