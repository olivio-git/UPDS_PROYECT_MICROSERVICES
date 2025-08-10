import { createRoot } from "react-dom/client";
import "./index.css";
import { Toaster } from "@/components/atoms/sonner";
import { ThemeProvider } from "@/context/ThemeContext";
import Navigation from "./navigation/Navigation";
import { BrowserRouter } from "react-router";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <ThemeProvider>
      <Navigation />
      <Toaster position="top-right" />
    </ThemeProvider>
  </BrowserRouter>
);
