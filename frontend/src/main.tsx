import { Toaster } from "@/components/atoms/sonner";
import { ThemeProvider } from "@/context/ThemeContext";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import Navigation from "./navigation/Navigation";

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <ThemeProvider>
        <Navigation />
        {/* Los avisos se apilaban de a tres o cuatro y tapaban la barra
            superior: se muestran como máximo dos, duran menos y arrancan
            por debajo del encabezado (h-14). */}
        <Toaster position="top-right" duration={3000} visibleToasts={2} offset="72px" closeButton />
      </ThemeProvider>
    </BrowserRouter>
  </QueryClientProvider>
);
