"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/common/Icon";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const BEFORE =
  "I think this idea is very good and can help a lot.";
const AFTER_WORDS = [
  "I",
  "believe",
  "this",
  "idea",
  "is",
  "valuable",
  "and",
  "could",
  "make",
  "a",
  "real",
  "difference.",
];
const HIGHLIGHTED = new Set([1, 5, 7, 8, 9, 10, 11]);

type Phase = "before" | "writing" | "after";

export function PolishDemo() {
  const { uiLocale } = useLocale();
  const en = uiLocale === "en";
  const [phase, setPhase] = useState<Phase>("before");
  const [visibleWords, setVisibleWords] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [cycleKey, setCycleKey] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reduced) {
      setPhase("after");
      setVisibleWords(AFTER_WORDS.length);
      return;
    }
    if (paused) return;

    const timers: number[] = [];
    const clear = () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
    clear();
    setPhase("before");
    setVisibleWords(0);

    const startTyping = window.setTimeout(() => {
      setPhase("writing");
      let index = 0;
      intervalRef.current = window.setInterval(() => {
        index += 1;
        setVisibleWords(index);
        if (index >= AFTER_WORDS.length) {
          if (intervalRef.current) window.clearInterval(intervalRef.current);
          setPhase("after");
          timeoutRef.current = window.setTimeout(() => {
            setCycleKey((key) => key + 1);
          }, 5200);
        }
      }, 88);
    }, 1500);
    timers.push(startTyping);

    return clear;
  }, [paused, reduced, cycleKey]);

  const afterVisible = phase === "after" || reduced;

  return (
    <div
      className="demo-card"
      data-testid="polish-demo"
      aria-label={en ? "Fixed polish demonstration" : "固定润色演示"}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
        <div className="inline-flex items-center gap-2">
          <span className="demo-live-dot" aria-hidden="true" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
            {en ? "Live demo" : "产品演示"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="demo-control"
            onClick={() => setPaused((value) => !value)}
            aria-pressed={paused}
            disabled={reduced}
            data-testid="demo-pause"
            title={
              reduced
                ? en
                  ? "Reduced motion is on"
                  : "已根据系统设置减少动态"
                : paused
                  ? en
                    ? "Play"
                    : "播放"
                  : en
                    ? "Pause"
                    : "暂停"
            }
          >
            <Icon name={paused ? "play" : "pause"} size={12} />
            {paused ? (en ? "Play" : "播放") : en ? "Pause" : "暂停"}
          </button>
          <button
            type="button"
            className="demo-control"
            onClick={() => {
              setPaused(false);
              setCycleKey((key) => key + 1);
            }}
            disabled={reduced}
            title={en ? "Replay" : "重新播放"}
          >
            <Icon name="refresh" size={12} />
          </button>
        </div>
      </div>

      <div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
        <div className="demo-panel">
          <div className="flex items-center justify-between gap-2">
            <span className="demo-label">{en ? "Before" : "修改前"}</span>
            <span className="text-[9px] uppercase tracking-[0.12em] text-[#9aa59d]">
              Draft
            </span>
          </div>
          <p className="demo-before-text">{BEFORE}</p>
        </div>

        <div className="demo-divider" aria-hidden="true">
          <span />
          <span className="demo-arrow">
            <Icon name="arrowRight" size={13} />
          </span>
          <span />
        </div>

        <div className="demo-panel demo-panel-after" data-testid="demo-after">
          <div className="flex items-center justify-between gap-2">
            <span className="demo-label demo-label-after">
              {en ? "After" : "修改后"}
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.12em] text-[var(--primary)]">
              <Icon name="sparkles" size={10} />
              {en ? "Polished" : "润色结果"}
            </span>
          </div>
          <p className="demo-after-text" aria-live="off">
            {AFTER_WORDS.map((word, index) => {
              const visible = reduced || index < visibleWords || afterVisible;
              return (
                <span
                  key={`${word}-${index}`}
                  className={`demo-word ${
                    visible ? "demo-word-visible" : "demo-word-hidden"
                  } ${HIGHLIGHTED.has(index) && visible ? "demo-highlight" : ""}`}
                >
                  {word}
                  {index < AFTER_WORDS.length - 1 ? " " : ""}
                  {!afterVisible &&
                  phase === "writing" &&
                  index === visibleWords - 1 ? (
                    <span className="demo-caret" aria-hidden="true" />
                  ) : null}
                </span>
              );
            })}
          </p>
        </div>
      </div>

      <p className="border-t border-[var(--border)] px-4 py-2.5 text-[9px] leading-relaxed text-[#8b968e] sm:px-5">
        {en
          ? "Fixed example for demonstration only — not a user result or a live AI response."
          : "固定示例，仅用于展示交互效果；不是用户数据，也不是实时 AI 生成结果。"}
      </p>
    </div>
  );
}