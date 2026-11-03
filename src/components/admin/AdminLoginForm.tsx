"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/common/Icon";
import { Logo } from "@/components/layout/Logo";

export function AdminLoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (!password) {
      setError("请输入管理员密码。");
      passwordRef.current?.focus();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setError(payload?.message || "登录失败，请重试。");
        setLoading(false);
        passwordRef.current?.select();
        requestAnimationFrame(() => errorRef.current?.focus());
        return;
      }

      router.replace("/admin/feedback");
      router.refresh();
    } catch {
      setLoading(false);
      setError("网络连接失败，请稍后重试。");
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }

  return (
    <div className="admin-login-shell">
      <div className="admin-login-brand">
        <Logo />
        <p className="admin-login-headline mt-16 font-display text-[clamp(2.8rem,6vw,5.4rem)] leading-[0.92] tracking-[-0.06em] text-[var(--tone-humanize-ink)]">
          The quiet
          <br />
          <span className="text-[var(--tone-humanize-accent)]">back room.</span>
        </p>
        <p className="admin-login-copy mt-6 max-w-sm text-[13px] leading-7 text-[color-mix(in_srgb,var(--tone-humanize-ink)_82%,transparent)]">
          反馈收件箱仅对维护者开放。这里保存的是用户愿意花时间写下的真实意见，
          请只把它们用于让 Draftly 变得更好。
        </p>
        <p className="admin-login-foot mt-auto text-[10px] uppercase tracking-[0.18em] text-[color-mix(in_srgb,var(--tone-humanize-ink)_68%,transparent)]">
          Authorized access only · 一元硬币
        </p>
      </div>

      <div
        id="main"
        className="admin-login-form flex items-center justify-center px-5 py-12 sm:px-10"
      >
        <div className="w-full max-w-md">
          <div className="mb-12 lg:hidden">
            <Logo size="sm" />
          </div>
          <p className="landing-eyebrow justify-start">
            <span className="h-px w-8 bg-[var(--border-strong)]" />
            Admin / 管理后台
          </p>
          <h1 className="mt-4 font-display text-4xl tracking-[-0.045em] text-[var(--text)] sm:text-5xl">
            Welcome back.
          </h1>
          <p className="mt-3 text-[13px] leading-6 text-[var(--muted)]">
            使用服务端配置的管理员密码登录。会话保存在 HttpOnly Cookie 中，8 小时后自动失效。
          </p>

          {!configured ? (
            <div className="mt-7 rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-4 text-xs leading-6 text-[var(--text)]">
              <p className="flex items-center gap-2 font-semibold">
                <Icon name="lock" size={15} />
                后台尚未配置
              </p>
              <p className="mt-2">
                请在服务端环境变量中设置 <code>ADMIN_PASSWORD</code> 与至少 32 位的{" "}
                <code>ADMIN_SESSION_SECRET</code>，然后重启服务。
                本机配置见 <code>.env.local</code>，示例见 <code>.env.example</code>。
              </p>
            </div>
          ) : null}

          <div
            ref={errorRef}
            tabIndex={-1}
            role={error ? "alert" : undefined}
            aria-live="polite"
            className={
              error
                ? "mt-6 flex gap-2.5 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] p-3.5 text-xs leading-5 text-[var(--danger)]"
                : "sr-only"
            }
            data-testid="admin-login-error"
          >
            {error ? (
              <>
                <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
                {error}
              </>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="mt-7" noValidate>
            <label
              htmlFor="admin-password"
              className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--text-soft)]"
            >
              Admin password · 管理员密码
            </label>
            <input
              ref={passwordRef}
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) setError("");
              }}
              disabled={!configured}
              placeholder="Enter your password"
              className="min-h-[50px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)]"
              data-testid="admin-password"
            />

            <button
              type="submit"
              disabled={!configured || loading}
              className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="admin-login-submit"
            >
              {loading ? (
                <>
                  <Icon name="loader" size={16} className="spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Enter the back room
                  <Icon name="arrowRight" size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 flex items-center justify-between gap-4 border-t border-[var(--border)] pt-5 text-[11px] text-[var(--muted)]">
            <Link href="/" className="transition hover:text-[var(--primary-strong)]">
              ← 返回首页
            </Link>
            <Link
              href="/privacy"
              className="transition hover:text-[var(--primary-strong)]"
            >
              隐私说明
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
