"use client";

import { useEffect, useState } from "react";

export function ScrollIndicator() {
  const [dim, setDim] = useState(false);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setDim(window.scrollY > 60);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      className="scroll-indicator"
      data-dim={dim ? "true" : "false"}
      aria-hidden="true"
    >
      <span className="scroll-arrows left">
        <span />
        <span />
      </span>
      <span className="scroll-mouse" />
      <span className="scroll-word">SCROLL</span>
      <span className="scroll-arrows right">
        <span />
        <span />
      </span>
    </div>
  );
}