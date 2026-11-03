import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "Draftly 的使用条款：服务范围、AI 输出、可接受使用方式与责任边界。",
};

const updated = "2026-10-31";

export default function TermsPage() {
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
          Terms / 使用条款
        </p>
        <h1 className="mt-4 font-display text-[clamp(2.8rem,7vw,5.2rem)] leading-[0.94] tracking-[-0.055em]">
          A tool, not
          <br />
          <span className="italic text-[var(--primary-strong)]">a guarantee.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[13px] leading-7 text-[var(--muted)]">
          这些条款说明 Draftly 提供什么、不提供什么，以及使用 AI 写作工具时需要你自己做的判断。
        </p>
        <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Last updated · {updated}
        </p>

        <div className="mt-12 space-y-10 text-[14px] leading-8 text-[var(--text-soft)]">
          <section>
            <h2 className="font-display text-2xl tracking-[-0.025em] text-[var(--text)]">
              1. 服务范围
            </h2>
            <p className="mt-3">
              Draftly 提供文本润色、人性化改写、中英翻译、语法检查、写作风格画像与差异对照等写作辅助功能。
              AI 文本检测基于语言特征给出概率性辅助估计，不构成作者身份证明，也不应作为学术、人事或法律决定的唯一依据。
              风格画像是对语言表面特征的估计，不代表对作者身份或写作水平的判断。
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-[-0.025em] text-[var(--text)]">
              2. AI 输出
            </h2>
            <p className="mt-3">
              AI 生成、翻译或改写的文本可能包含错误、遗漏或不适合你语境的说法。你应在使用前自行核对事实、
              引文、数字与语气，并对最终发布的内容负责。Draftly 不承诺输出完全准确、独特或符合特定
              学术、法律、医疗或商业标准，也不承诺任何文本能够通过第三方 AI 检测。
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-[-0.025em] text-[var(--text)]">
              3. 可接受使用
            </h2>
            <p className="mt-3">
              请勿使用 Draftly 提交违法内容、侵犯他人权利的材料、恶意代码，或试图绕过频率限制、
              攻击服务端、批量提交垃圾反馈。不要提交你无权处理的机密信息；第三方 AI
              服务会处理你发送的文本。
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-[-0.025em] text-[var(--text)]">
              4. 风格画像与样本
            </h2>
            <p className="mt-3">
              导入样本前请确认你有权使用这些文本。风格画像只用于辅助调整表达方式，
              不会改变原文事实、观点、数字或引用；AI 仍可能判断失误，保存和套用前应由你检查。
              画像按匿名浏览器隔离，不提供账号登录或跨设备同步；请不要在样本中放入密码、
              身份证号、未公开商业机密等敏感内容。你可以随时在风格画像页删除画像及其样本。
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-[-0.025em] text-[var(--text)]">
              5. 反馈与后台
            </h2>
            <p className="mt-3">
              反馈表单用于产品改进与回复。提交即表示你同意我们在隐私说明所述的范围内保存与处理这些信息。
              管理员后台仅限维护者使用；未经授权访问、修改或删除反馈数据是不被允许的。
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-[-0.025em] text-[var(--text)]">
              6. 可用性与责任
            </h2>
            <p className="mt-3">
              服务可能因维护、网络、第三方 AI 供应商故障而暂时不可用。在适用法律允许的范围内，
              Draftly 按“现状”提供，不对因使用或无法使用服务造成的间接损失承担责任。
              若你不接受这些边界，请停止使用本服务。
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-[-0.025em] text-[var(--text)]">
              7. 条款更新
            </h2>
            <p className="mt-3">
              条款可能随功能变化而更新，更新后在页首标注日期。继续使用即表示接受更新后的版本。
              如有疑问，请通过首页底部的反馈表单联系开发者“一元硬币”。
            </p>
          </section>
        </div>

        <div className="mt-14 flex flex-wrap items-center gap-5 border-t border-[var(--border)] pt-5 text-sm">
          <Link
            href="/privacy"
            className="font-medium text-[var(--primary-strong)] underline decoration-[var(--border-strong)] underline-offset-4"
          >
            隐私说明
          </Link>
          <Link
            href="/feedback"
            className="inline-flex items-center gap-2 text-[var(--muted)] transition hover:text-[var(--primary-strong)]"
          >
            去反馈表单 <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </main>
    </div>
  );
}

