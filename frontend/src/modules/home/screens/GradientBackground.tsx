import { useTheme } from "@/context/ThemeContext";

const GradientBackground = () => {
  const { theme } = useTheme();

  return (
    <div className="fixed top-0 -z-10 min-h-screen w-screen overflow-hidden bg-[#0b0e14] bg-grid-pattern">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900"></div>

      <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-gradient-radial from-violet-600/30 via-purple-600/20 to-transparent rounded-full blur-[150px] animate-pulse-slow"></div>
      <div
        className="absolute bottom-0 right-1/4 w-[700px] h-[700px] bg-gradient-radial from-blue-500/25 via-indigo-600/15 to-transparent rounded-full blur-[140px] animate-pulse-slow"
        style={{ animationDelay: "1s" }}
      ></div>
      <div
        className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-gradient-radial from-cyan-400/20 via-blue-500/10 to-transparent rounded-full blur-[100px] animate-pulse-slow"
        style={{ animationDelay: "2s" }}
      ></div>

      <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-gradient-radial from-emerald-400/15 via-teal-500/8 to-transparent rounded-full blur-[80px] animate-float"></div>
      <div
        className="absolute bottom-1/4 left-1/2 w-[600px] h-[600px] bg-gradient-radial from-pink-500/20 via-purple-500/10 to-transparent rounded-full blur-[120px] animate-float"
        style={{ animationDelay: "3s" }}
      ></div>

      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-transparent to-slate-900/30"></div>

      <div
        className={`
          absolute inset-0 transition-opacity duration-1000
          ${theme === "dark" ? "opacity-[0.05]" : "opacity-[0.1]"}
        `}
        style={{
          backgroundImage: `radial-gradient(circle at 50px 50px, rgba(255,255,255,0.3) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
        }}
      />

      <div className="absolute top-1/8 left-1/8 w-32 h-32 border border-purple-400/20 rotate-45 animate-spin-slow opacity-30"></div>
      <div className="absolute bottom-1/4 right-1/4 w-24 h-24 border-2 border-cyan-400/15 rounded-full animate-pulse opacity-25"></div>
      <div className="absolute top-1/8 right-1/8 w-20 h-20 bg-gradient-to-br from-violet-500/10 to-transparent rotate-12 opacity-40"></div>

      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-purple-400/30 to-transparent"></div>
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-400/20 to-transparent"></div>
      <div className="absolute left-0 top-0 w-px h-full bg-gradient-to-b from-transparent via-indigo-400/20 to-transparent"></div>
      <div className="absolute right-0 top-0 w-px h-full bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent"></div>
    </div>
  );
};

export default GradientBackground;
