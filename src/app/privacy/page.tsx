import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy notice",
  description:
    "Draftly 的隐私说明：AI 文本如何处理、反馈数据保存什么、管理员如何使用这些信息。",
};

const updated = "2026-10-31";

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-[var(--landing-bg)]">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-5 px-5 py-5 sm:px-8 sm:py-7">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <span className="brand-seed brand-seed-small" aria-hidden="true">
            <span />
          </span>
          <span className="font-display text-xl tracking-[-0.04em]">Draftly</span>
        </Link>
        <Link
          href="/"
          className="text-[11px] text-[var(--muted)] transition hover:text-[var(--primary-strong)]"
        >
          ← Back home
        </Link>
      </header>

      <main id="main" className="mx-auto w-full max-w-3xl px-5 pb-16 pt-8 sm:px-8 sm:pb-24 sm:pt-14">
        <p className="landing-eyebrow justify-start">
          <span className="h-px w-8 bg-[var(--border-strong)]" />
          Privacy / 隐私说明
        </p>
        <h1 className="mt-4 font-display text-[clamp(2.8rem,7vw,5.2rem)] leading-[0.94] tracking-[-0.055em]">
          Your words are
          <br />
          <span className="italic text-[var(--primary-strong)]">not a product.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[13px] leading-7 text-[var(--muted)]">
          这份说明用大白话解释 Draftly 会接触哪些数据、为什么接触，以及你可以怎么要求删除。
          它不是法律意见，也不会用模糊措辞掩盖实际的数据流。
        </p>
        <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Last updated · {updated}
        </p>

        <div className="mt-12 space-y-10 text-[14px] leading-8 text-[var(--text-soft)]">
          <section>
            <h2 className="font-display text-2xl tracking-[-0.025em] text-[var(--text)]">
              1. 谁会看到你的内容
            </h2>
            <p className="mt-3">
              Draftly 是一个由开发者“一元硬币”维护的独立写作工具。你提交的待处理文本会通过本项目的服务端，
              转发给已配置的第三方 AI 服务（当前为 DeepSeek 的 OpenAI 兼容接口）完成润色、改写、翻译、
              语法检查、AI 写作特征分析或替换建议。服务端 API 密钥只保存在服务器环境变量中，不会进入浏览器。
            </p>
            <p className="mt-3">
              为了展示差异、撤销与重做，编辑器会在当前浏览器页面内保留原文和结果；Draftly
              不会把普通写作文档写入自己的反馈数据库。第三方 AI 服务商对请求的处理受其自身条款约束，
              因此请不要提交密码、身份证号、未公开的商业机密等敏感内容。
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-[-0.025em] text-[var(--text)]">
              2. 反馈表单保存什么
            </h2>
            <p className="mt-3">
              当你通过首页底部的反馈表单发送意见时，我们会保存：反馈类别、反馈正文、
              可选邮箱、提交时间、处理状态、内部处理备注，以及你勾选隐私同意的时间。
              邮箱仅用于回复该条反馈；不填写邮箱也可以提交。
            </p>
            <p className="mt-3">
              反馈正文与邮箱不会通过公开接口读取，也不会展示在网站前台。它们只存储在部署本项目的
              SQLite 数据库中，由持有管理员密码的维护者通过受保护的后台查看。
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-[-0.025em] text-[var(--text)]">
              3. 写作风格画像与样本
            </h2>
            <p className="mt-3">
              当你主动导入参考文本并保存风格画像时，Draftly 会在服务端 SQLite 中保存：
              画像名称、AI 生成的风格分析、你导入的样本文本、样本来源与字数、创建与更新时间。
              上传的 TXT、DOCX、PDF 只在服务端内存中解析，原始文件不会落盘；解析出的文本会作为样本保存。
            </p>
            <p className="mt-3">
              这些数据按匿名浏览器 Cookie 隔离，只有携带同一 Cookie 的浏览器能读取自己的画像。
              这不是账号登录，也不提供跨设备同步；任何获得该 Cookie 的人都能读取对应画像。
              删除画像时，关联样本会一并删除。分析样本时，样本文本会发送给第三方 AI 服务；
              使用画像润色时，发送的是画像分析结果，而不是原始样本全文。
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-[-0.025em] text-[var(--text)]">
              4. 本地存储与 Cookie
            </h2>
            <p className="mt-3">
              网站使用浏览器 localStorage 记住界面语言与默认文本语言，你可以在设置页清除。
              管理员登录后会设置一个 HttpOnly、SameSite=Strict 的会话 Cookie，有效期 8 小时；
              普通访客不会获得该 Cookie。保存风格画像时，服务端会设置一个 HttpOnly、SameSite=Lax、
              有效期 1 年的匿名隔离 Cookie（draftly_style_owner），它不包含邮箱或账号身份。
              项目当前没有接入广告、行为分析或跨站追踪脚本。
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-[-0.025em] text-[var(--text)]">
              5. 保留与删除
            </h2>
            <p className="mt-3">
              反馈会被保留到处理完成或归档后的一段时间，以便追溯。若你希望查询或删除自己提交的反馈，
              请使用反馈表单选择“Other / 其他意见”，在正文中说明“删除我的反馈”并附上当时使用的邮箱；
              维护者核实后会删除对应记录。没有邮箱的匿名反馈无法可靠定位，因此可能无法按请求删除。
            </p>
            <p className="mt-3">
              普通润色文本不进入反馈数据库，因此没有可供后台检索的历史文档副本。关闭页面后，
              当前编辑内容只保留在浏览器内存与你的操作历史中。风格画像与样本会一直保留，直到你在风格画像页删除，
              或直接删除部署目录中的 SQLite 数据库。
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-[-0.025em] text-[var(--text)]">
              6. 安全边界
            </h2>
            <p className="mt-3">
              反馈提交接口有频率限制与蜜罐字段；后台接口在服务端验证管理员会话；数据库查询使用参数化语句，
              页面渲染默认转义文本。风格画像接口按匿名 owner 隔离，并限制样本数量、单份与总字符数；
              PDF/DOCX 解析有类型和大小检查，扫描版 PDF 会明确失败而不是伪造 OCR 结果。
              没有任何系统能承诺绝对安全，但我们会避免把邮箱公开、把密钥写进前端，
              或把反馈数据放进无需登录即可读取的接口。
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-[-0.025em] text-[var(--text)]">
              7. 说明更新
            </h2>
            <p className="mt-3">
              如果数据流或第三方服务发生变化，这份说明会同步更新，并在页首标注日期。
              继续使用 Draftly 即表示你了解上述处理方式。
            </p>
          </section>
        </div>

        <div className="mt-14 border-t border-[var(--border)] pt-5">
          <Link
            href="/feedback"
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--primary-strong)]"
          >
            去反馈表单
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </main>
    </div>
  );
}

