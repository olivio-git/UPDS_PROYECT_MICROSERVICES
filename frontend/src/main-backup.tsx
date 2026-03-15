import { createRoot } from "react-dom/client";
import "./index.css";
import { BrowserRouter } from "react-router-dom"; 
import Navigation from "./navigation/Navigation";
import { Toaster } from "@/components/atoms/sonner";
import { useAuthStore } from "@/modules/auth/services/authStore";
import { ThemeProvider } from "@/context/ThemeContext";
// Initialize auth store
const { initialize } = useAuthStore.getState();
initialize();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <BrowserRouter> 
      <Navigation />
      <Toaster position="top-right" />
    </BrowserRouter>
  </ThemeProvider>
);
