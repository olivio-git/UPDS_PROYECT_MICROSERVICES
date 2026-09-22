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
        <Toaster position="top-right" />
      </ThemeProvider>
    </BrowserRouter>
  </QueryClientProvider>
);
