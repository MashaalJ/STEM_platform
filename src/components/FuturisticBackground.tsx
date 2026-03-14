import React from "react";

const FuturisticBackground: React.FC<{ className?: string; withParticles?: boolean }> = ({
  className = "",
  withParticles = true,
}) => {
  return (
    <div
      className={`fixed inset-0 overflow-hidden pointer-events-none -z-10 ${className}`}
      aria-hidden
    >
      {/* Base gradient - slightly softer so UI reads better */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900/95 to-slate-950" />

      {/* Grid - subtle */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 245, 255, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 245, 255, 0.06) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Gradient orbs - a bit more ambient light */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-25 -top-1/4 -left-1/4"
        style={{ background: "radial-gradient(circle, rgba(0, 245, 255, 0.35) 0%, transparent 70%)" }}
      />
      <div
        className="absolute w-[500px] h-[500px] rounded-full blur-[100px] opacity-20 bottom-0 right-0 translate-y-1/3 translate-x-1/3"
        style={{ background: "radial-gradient(circle, rgba(14, 165, 233, 0.4) 0%, transparent 70%)" }}
      />
      <div
        className="absolute w-[400px] h-[400px] rounded-full blur-[80px] opacity-15 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ background: "radial-gradient(circle, rgba(168, 85, 247, 0.35) 0%, transparent 70%)" }}
      />

      {/* Optional floating particles (CSS-only) */}
      {withParticles && (
        <div className="absolute inset-0">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-cyan-400/60"
              style={{
                left: `${10 + (i * 7) % 80}%`,
                top: `${15 + (i * 11) % 70}%`,
                animation: "float-particle 4s ease-in-out infinite",
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FuturisticBackground;
