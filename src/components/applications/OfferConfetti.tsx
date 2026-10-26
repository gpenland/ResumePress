"use client";

import { useEffect, useMemo, useState } from "react";

const COLORS = ["#81A1C1", "#A3BE8C", "#EBCB8B", "#B48EAD", "#88C0D0", "#D08770"];
const PIECE_COUNT = 28;
const DURATION_MS = 1400;

type Piece = {
  left: number;
  color: string;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  rotate: number;
};

// A one-time celebratory flourish for the one status in this app worth
// celebrating. Purely decorative: fixed-position, pointer-events-none,
// aria-hidden, and self-removing after DURATION_MS — it can never block a
// click, steal focus, or outlive its welcome. Mount with `active` true once
// per trigger; call `onDone` to let the parent reset `active` to false.
export default function OfferConfetti({ active, onDone }: { active: boolean; onDone: () => void }) {
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    if (!active) return;
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onDone();
    }, DURATION_MS);
    return () => clearTimeout(timer);
  }, [active, onDone]);

  const pieces = useMemo<Piece[]>(() => {
    if (!visible) return [];
    return Array.from({ length: PIECE_COUNT }, () => ({
      left: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 5 + Math.random() * 5,
      delay: Math.random() * 150,
      duration: DURATION_MS - 300 + Math.random() * 300,
      drift: (Math.random() - 0.5) * 120,
      rotate: Math.random() * 360,
    }));
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 top-14 z-50 h-0 overflow-visible pointer-events-none" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: 0,
            width: p.size,
            height: p.size * 0.4,
            backgroundColor: p.color,
            borderRadius: 1,
            opacity: 0.9,
            transform: `rotate(${p.rotate}deg)`,
            animation: `offer-confetti-fall ${p.duration}ms ease-in ${p.delay}ms forwards`,
            // Custom property read by the keyframes below for per-piece horizontal drift.
            ["--drift" as string]: `${p.drift}px`,
          }}
        />
      ))}
      <style>{`
        @keyframes offer-confetti-fall {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 0.9; }
          100% { transform: translate(var(--drift), 160px) rotate(540deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
