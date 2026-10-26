"use client";

import { useEffect, useRef, useState } from "react";

const PHRASE = "resume";
const IDLE_RESET_MS = 1500;
const FLIGHT_MS = 2200;

// Type "resume" anywhere on the page (outside a text field) and a paper
// airplane flies across the screen once. Pure whimsy: the listener only
// ever reads keystrokes, never calls preventDefault or stopPropagation, so
// it cannot intercept a real shortcut or keep a keystroke from reaching its
// normal target. Guarded against form fields the same way the "i" quick-add
// shortcut in GlobalQuickAdd is, so typing the word "resume" into an actual
// Input/Textarea never triggers it.
export default function ResumeFlourish() {
  const [flying, setFlying] = useState(false);
  const bufferRef = useRef("");
  const lastKeyAtRef = useRef(0);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;
      if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return;

      const now = Date.now();
      if (now - lastKeyAtRef.current > IDLE_RESET_MS) bufferRef.current = "";
      lastKeyAtRef.current = now;

      bufferRef.current = (bufferRef.current + e.key.toLowerCase()).slice(-PHRASE.length);
      if (bufferRef.current === PHRASE) {
        bufferRef.current = "";
        setFlying(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!flying) return;
    const timer = setTimeout(() => setFlying(false), FLIGHT_MS);
    return () => clearTimeout(timer);
  }, [flying]);

  if (!flying) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        className="absolute text-primary"
        style={{ animation: `resume-flourish-fly ${FLIGHT_MS}ms ease-in-out forwards` }}
      >
        <path
          d="M2 12 L22 4 L14 12 L22 20 Z"
          fill="currentColor"
          opacity={0.85}
        />
      </svg>
      <style>{`
        @keyframes resume-flourish-fly {
          0%   { top: 70%; left: -10%; transform: rotate(-6deg); opacity: 0; }
          10%  { opacity: 1; }
          50%  { top: 30%; left: 50%; transform: rotate(4deg); }
          90%  { opacity: 1; }
          100% { top: 8%;  left: 110%; transform: rotate(-6deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
