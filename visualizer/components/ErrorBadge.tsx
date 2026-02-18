"use client";

import { useState, useRef, useEffect } from "react";

interface ErrorBadgeProps {
  type: "refused" | "error";
  description: string;
  className?: string;
}

/**
 * Badge that shows an error/refused reason on hover (desktop) and tap (mobile).
 * First tap shows the tooltip; a second tap hides it.
 * Wrapping this in an <a> is intentional for navigation; the badge intercepts
 * the first touch so it doesn't navigate immediately.
 */
export function ErrorBadge({ type, description, className = "" }: ErrorBadgeProps) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const isTouchRef = useRef(false);

  // Close on outside interaction
  useEffect(() => {
    if (!show) return;
    function handler(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShow(false);
      }
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [show]);

  const color =
    type === "refused"
      ? "bg-amber-100 text-amber-800"
      : "bg-red-100 text-red-800";

  const label = type === "refused" ? "Refused" : "Error";

  return (
    <span
      ref={ref}
      className={`relative inline-flex items-center rounded-full cursor-pointer select-none px-2 py-0.5 text-xs font-medium ${color} ${className}`}
      onMouseEnter={() => {
        if (!isTouchRef.current) setShow(true);
      }}
      onMouseLeave={() => {
        if (!isTouchRef.current) setShow(false);
      }}
      onTouchStart={() => {
        isTouchRef.current = true;
      }}
      onTouchEnd={(e) => {
        // First tap: show tooltip without navigating; second tap: hide
        e.preventDefault();
        setShow((v) => !v);
        setTimeout(() => {
          isTouchRef.current = false;
        }, 400);
      }}
      onClick={(e) => {
        // Desktop click: toggle tooltip (do not navigate)
        e.preventDefault();
        e.stopPropagation();
        if (!isTouchRef.current) setShow((v) => !v);
      }}
    >
      {label}
      {show && (
        <span className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-56 whitespace-normal rounded bg-gray-900 px-2.5 py-2 text-xs leading-relaxed text-white shadow-lg">
          {description}
          {/* Arrow */}
          <span className="absolute left-3 top-full border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}
