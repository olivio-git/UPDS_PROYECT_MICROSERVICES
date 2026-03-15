import { toast } from "sonner";

// Función para mostrar el toast personalizado
export const showCustomToast = () => {
  toast.custom((t) => (
    <div 
      role="alertdialog" 
      className="fixed bottom-2 right-2 after:w-full after:aspect-square after:block after:absolute after:left-full after:top-full after:bg-white after:rounded-full after:blur-2xl after:-z-10 bg-gradient-to-tr from-gray-900 to-gray-800 group z-50"
    >
      <button 
        onClick={() => toast.dismiss(t)}
        className="absolute top-2 right-2 p-2 rounded-lg bg-white/10 hover:bg-white/20 z-20"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="h-2 w-auto">
          <path d="M16.5 1.5L1.5 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M1.5 1.5L16.5 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      
      <a 
        href="https://tu-enlace.com"
        className="p-4 rounded-xl bg-gradient-to-tr from-blue-900 to-blue-700 border border-white/10 max-w-[320px] w-full block group-hover:border-blue-500 transition"
        target="_blank" 
        rel="noopener noreferrer"
      >
        <header className="flex items-center gap-2">
          <img 
            src="/tu-logo.jpg" 
            className="h-12 w-12 rounded-2xl" 
            alt="Tu Logo" 
            width="100" 
            height="100"
          />
          <div className="flex flex-col">
            <h4 className="text-lg text-balance uppercase font-extrabold block text-white">
              Tu.<span className="text-blue-400">Evento</span>
            </h4>
            <p className="text-[10px] text-gray-300 px-1 py-0.5 bg-gray-700 rounded border border-white/10 inline-flex">
              Oct. 15 10:00h GMT-4
            </p>
          </div>
        </header>
        <p className="text-balance mt-2 text-sm text-gray-200">
          ¡No te pierdas nuestro evento especial!
        </p>
      </a>
    </div>
  ), {
    duration: Infinity, // No se cierra automáticamente
    position: 'bottom-right'
  });
};