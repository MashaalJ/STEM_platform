import React from "react";

const FuturisticBackground: React.FC<{ className?: string; withParticles?: boolean }> = ({
  className = "",
  withParticles = false,
}) => {
  return (
    <div
      className={`fixed inset-0 overflow-hidden pointer-events-none -z-10 ${className}`}
      aria-hidden
    >
      {/* Cosmic Amber structural background */}
      <div className="absolute inset-0 bg-[#f7f9fb]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#ffffff] via-transparent to-[#eceef0]/60" />

      {/* Optional floating particles (disabled by default for a clean look) */}
      {withParticles && (
        <div className="absolute inset-0">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-sky-400/70"
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
