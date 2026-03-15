import { Toaster } from "@/components/atoms/sonner";
import { ThemeProvider } from "@/context/ThemeContext";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import Navigation from "./navigation/Navigation";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <ThemeProvider>
      <Navigation />
      <Toaster position="top-right" />
    </ThemeProvider>
  </BrowserRouter>
);
