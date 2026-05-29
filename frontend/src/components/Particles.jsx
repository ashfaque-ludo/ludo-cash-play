import React from "react";

export default function Particles({ count = 18 }) {
  const arr = Array.from({ length: count });
  return (
    <div className="particles" aria-hidden="true">
      {arr.map((_, i) => {
        const left = Math.random() * 100;
        const top = 50 + Math.random() * 60;
        const dur = 10 + Math.random() * 12;
        const delay = -Math.random() * 12;
        const size = 3 + Math.random() * 5;
        return (
          <span
            key={i}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${size}px`,
              height: `${size}px`,
              animationDuration: `${dur}s`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}
