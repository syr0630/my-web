"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/common/Icon";
import { countVisibleChars } from "@/lib/text/char-count";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  type FeedbackCategory,
} from "@/lib/feedback/types";

const MESSAGE_MIN = 5;
const MESSAGE_MAX = 5000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Values = {
  email: string;
  category: FeedbackCategory | "";
  message: string;
  consent: boolean;
};

type FieldErrors = {
  email?: string;
  category?: string;
  message?: string;
  consent?: string;
};

const INITIAL_VALUES: Values = {
  email: "",
  category: "",
  message: "",
  consent: false,
};

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="mt-1.5 text-xs leading-relaxed text-[var(--danger)]">
      {children}
    </p>
  );
}

export function FeedbackForm() {
  const [values, setValues] = useState<Values>(INITIAL_VALUES);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle"
  );
  const [serverError, setServerError] = useState("");
  const [honeypot, setHoneypot] = useState("");

  const emailRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const messageLength = countVisibleChars(values.message.trim());

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    if (status === "error") {
      setStatus("idle");
      setServerError("");
    }
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    const email = values.email.trim();
    const message = values.message.trim();

    if (email && !EMAIL_PATTERN.test(email)) {
      next.email = "邮箱格式看起来不太对，请检查一下。";
    }
    if (!values.category) {
      next.category = "请选择一个反馈类别。";
    }
    if (countVisibleChars(message) < MESSAGE_MIN) {
      next.message = `至少写 ${MESSAGE_MIN} 个字符，让我们理解你的想法。`;
    }
    if (!values.consent) {
      next.consent = "请先确认你了解反馈数据的用途。";
    }
    return next;
  }

  function focusFirstError(next: FieldErrors) {
    if (next.email) emailRef.current?.focus();
    else if (next.category) categoryRef.current?.focus();
    else if (next.message) messageRef.current?.focus();
    else if (next.consent) consentRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setServerError("");
      setStatus("idle");
      focusFirstError(nextErrors);
      return;
    }

    setStatus("submitting");
    setErrors({});
    setServerError("");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email.trim(),
          category: values.category,
          message: values.message.trim(),
          consent: values.consent,
          website: honeypot,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setStatus("error");
        setServerError(
          payload?.message ||
            "Please try again. 请稍后重试。"
        );
        requestAnimationFrame(() => errorSummaryRef.current?.focus());
        return;
      }

      setStatus("success");
      setValues(INITIAL_VALUES);
    } catch {
      setStatus("error");
      setServerError(
        "Please try again. 网络似乎断开了，请保留内容后重试。"
      );
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
    }
  }

  function sendAnother() {
    setStatus("idle");
    setServerError("");
    setErrors({});
    requestAnimationFrame(() => messageRef.current?.focus());
  }

  if (status === "success") {
    return (
      <div
        className="flex min-h-[430px] flex-col justify-between rounded-[22px] border border-[var(--success-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] sm:p-9"
        data-testid="feedback-success"
        role="status"
        aria-live="polite"
      >
        <div>
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
            <Icon name="check" size={25} />
          </span>
          <h3 className="mt-7 max-w-md font-display text-3xl leading-tight tracking-tight text-[var(--text)] sm:text-[2.15rem]">
            Thanks for helping Draftly grow.
          </h3>
          <p className="mt-3 text-[13px] italic text-[var(--muted)]">
            感谢你帮助 Draftly 变得更好。
          </p>
          <p className="mt-5 max-w-md text-sm leading-7 text-[var(--text-soft)]">
            Your feedback has been received. We appreciate you taking the time to
            make Draftly better.
          </p>
          <p className="mt-2 max-w-md text-sm leading-7 text-[var(--muted)]">
            我们已经收到你的反馈。每一条具体的意见，都会让下一次写作更顺手。
          </p>
        </div>
        <button
          type="button"
          onClick={sendAnother}
          className="mt-8 inline-flex w-fit items-center gap-2 border-b border-[var(--primary)] pb-1 text-sm font-medium text-[var(--primary-strong)] transition hover:gap-3"
          data-testid="feedback-another"
        >
          Send another
          <span className="text-xs text-[var(--muted)]">再写一条</span>
          <Icon name="arrowRight" size={15} />
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] sm:p-8"
      data-testid="feedback-form"
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-xl tracking-tight text-[var(--text)]">
            Tell us what matters.
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            可选邮箱，必填类别与想法。带 * 的字段为必填。
          </p>
        </div>
        <span className="hidden shrink-0 rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] sm:inline-flex">
          Private
        </span>
      </div>

      <div
        ref={errorSummaryRef}
        tabIndex={-1}
        role={serverError ? "alert" : undefined}
        aria-live="polite"
        className={
          serverError
            ? "mb-5 flex gap-2.5 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] p-3.5 text-xs leading-5 text-[var(--danger)]"
            : "sr-only"
        }
        data-testid="feedback-error"
      >
        {serverError ? (
          <>
            <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
            <span>
              <strong className="font-semibold">Something went wrong.</strong>{" "}
              {serverError}
            </span>
          </>
        ) : null}
      </div>

      <div className="space-y-5">
        <div>
          <label
            htmlFor="feedback-email"
            className="mb-1.5 flex items-baseline justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]"
          >
            <span>Email</span>
            <span className="font-normal normal-case tracking-normal text-[var(--muted)]">
              邮箱 · 选填
            </span>
          </label>
          <input
            ref={emailRef}
            id="feedback-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => update("email", event.target.value)}
            placeholder="Your email (optional)"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "feedback-email-error" : undefined}
            className="min-h-[46px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] hover:border-[var(--border-strong)] focus:border-[var(--primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-[var(--ring)]"
            data-testid="feedback-email"
          />
          {errors.email ? (
            <FieldError id="feedback-email-error">{errors.email}</FieldError>
          ) : (
            <p className="mt-1.5 text-[11px] text-[var(--muted)]">
              Only used to reply. Never shown publicly. 仅用于回复，不会公开。
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="feedback-category"
            className="mb-1.5 flex items-baseline justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]"
          >
            <span>Feedback type *</span>
            <span className="font-normal normal-case tracking-normal text-[var(--muted)]">
              反馈类别
            </span>
          </label>
          <div className="relative">
            <select
              ref={categoryRef}
              id="feedback-category"
              name="category"
              value={values.category}
              onChange={(event) =>
                update("category", event.target.value as FeedbackCategory | "")
              }
              aria-invalid={Boolean(errors.category)}
              aria-describedby={
                errors.category ? "feedback-category-error" : undefined
              }
              className="min-h-[46px] w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 pr-10 text-sm text-[var(--text)] outline-none transition hover:border-[var(--border-strong)] focus:border-[var(--primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-[var(--ring)]"
              data-testid="feedback-category"
            >
              <option value="" disabled>
                选择类别 / Choose a type
              </option>
              {FEEDBACK_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {FEEDBACK_CATEGORY_LABELS[category].en} ·{" "}
                  {FEEDBACK_CATEGORY_LABELS[category].zh}
                </option>
              ))}
            </select>
            <Icon
              name="chevronDown"
              size={16}
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
          </div>
          {errors.category ? (
            <FieldError id="feedback-category-error">{errors.category}</FieldError>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="feedback-message"
            className="mb-1.5 flex items-baseline justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]"
          >
            <span>Your thoughts *</span>
            <span className="font-normal normal-case tracking-normal text-[var(--muted)]">
              你的想法
            </span>
          </label>
          <textarea
            ref={messageRef}
            id="feedback-message"
            name="message"
            value={values.message}
            onChange={(event) => update("message", event.target.value)}
            placeholder="Tell us what you think..."
            rows={6}
            maxLength={MESSAGE_MAX}
            aria-invalid={Boolean(errors.message)}
            aria-describedby={
              errors.message ? "feedback-message-error" : "feedback-message-hint"
            }
            className="min-h-[150px] w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-3 text-[15px] leading-7 text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] hover:border-[var(--border-strong)] focus:border-[var(--primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-[var(--ring)]"
            data-testid="feedback-message"
          />
          <div
            id="feedback-message-hint"
            className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-[var(--muted)]"
          >
            <span>
              {errors.message ? (
                <span className="text-[var(--danger)]">{errors.message}</span>
              ) : (
                "具体一点，会更容易被采纳。"
              )}
            </span>
            <span
              className={
                messageLength > MESSAGE_MAX
                  ? "font-medium text-[var(--danger)]"
                  : ""
              }
            >
              {messageLength} / {MESSAGE_MAX}
            </span>
          </div>
        </div>

        <div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-transparent p-0.5 text-xs leading-5 text-[var(--text-soft)] transition hover:text-[var(--text)]">
            <input
              ref={consentRef}
              type="checkbox"
              checked={values.consent}
              onChange={(event) => update("consent", event.target.checked)}
              aria-invalid={Boolean(errors.consent)}
              aria-describedby={
                errors.consent ? "feedback-consent-error" : undefined
              }
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--border-strong)] accent-[var(--primary)]"
              data-testid="feedback-consent"
            />
            <span>
              I understand this feedback is stored so Draftly can improve.{" "}
              <Link
                href="/privacy"
                className="underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--primary-strong)]"
              >
                Privacy notice
              </Link>
              <span className="mt-0.5 block text-[11px] text-[var(--muted)]">
                我了解反馈会被安全保存，仅用于改进产品与回复我。
              </span>
            </span>
          </label>
          {errors.consent ? (
            <FieldError id="feedback-consent-error">{errors.consent}</FieldError>
          ) : null}
        </div>

        <div className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
          <label htmlFor="feedback-website">Website</label>
          <input
            id="feedback-website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={status === "submitting"}
            className="group inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-full bg-[var(--primary)] px-6 text-sm font-semibold text-white shadow-[0_14px_28px_-18px_rgba(76,108,194,0.55)] transition hover:-translate-y-0.5 hover:bg-[var(--primary-strong)] disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0"
            data-testid="feedback-submit"
          >
            {status === "submitting" ? (
              <>
                <Icon name="loader" size={16} className="spin" />
                Sending…
              </>
            ) : (
              <>
                Send feedback
                <Icon
                  name="arrowRight"
                  size={16}
                  className="transition group-hover:translate-x-0.5"
                />
              </>
            )}
            <span className="sr-only">发送反馈</span>
          </button>
          <p className="text-[11px] leading-5 text-[var(--muted)]">
            发送反馈 · 不会用于营销，也不会公开你的邮箱。
          </p>
        </div>
      </div>
    </form>
  );
}
