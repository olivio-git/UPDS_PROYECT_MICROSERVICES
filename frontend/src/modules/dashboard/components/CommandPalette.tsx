import React, { useState, useEffect } from "react";
import { Command } from "cmdk";
import { Search, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { protectedRoutes } from "@/navigation/Protected.Route";
import useAuth from "@/hooks/useAuth";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();

  // Filtrar rutas según permisos del usuario
  const userRole = user?.role;
  const filteredRoutes = protectedRoutes.filter(
    (route) => route.role?.includes("all") || route.role?.includes(userRole) && route.hidden !== true
  );

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
    setSearch("");
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
    >
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg">
        <Command className="rounded-lg border border-line bg-gray-900/95 backdrop-blur-sm shadow-2xl">
          <div className="flex items-center border-b border-gray-700 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Buscar rutas... (Ctrl+K)"
              autoFocus
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm text-gray-200 placeholder:text-gray-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-gray-400">
              No se encontraron rutas.
            </Command.Empty>

            <Command.Group
              heading="Rutas disponibles"
              className="text-xs font-medium text-gray-400 mb-2"
            >
              {filteredRoutes.map((route) => {
                const IconComponent = route.icon;
                return (
                  <Command.Item
                    key={route.path}
                    value={`${route.name} ${route.path}`}
                    onSelect={() => handleSelect(route.path)}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 hover:text-blue-400 cursor-pointer transition-colors duration-200 data-[selected=true]:bg-gray-800 data-[selected=true]:text-blue-400"
                  >
                    {IconComponent && (
                      <IconComponent className="h-4 w-4 shrink-0" />
                    )}
                    <div className="flex flex-col">
                      <span className="font-medium">{route.name}</span>
                      <span className="text-xs text-gray-500">
                        {route.path}
                      </span>
                    </div>
                    <ArrowRight className="ml-auto h-3 w-3 text-gray-500" />
                  </Command.Item>
                );
              })}
            </Command.Group>
          </Command.List>

          <div className="border-t border-gray-700 p-2">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Navegar</span>
              <div className="flex gap-1">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-gray-600 bg-gray-800 px-1.5 font-mono text-[10px] font-medium text-gray-400 opacity-100">
                  ↑↓
                </kbd>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-gray-600 bg-gray-800 px-1.5 font-mono text-[10px] font-medium text-gray-400 opacity-100">
                  Enter
                </kbd>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-gray-600 bg-gray-800 px-1.5 font-mono text-[10px] font-medium text-gray-400 opacity-100">
                  Esc
                </kbd>
              </div>
            </div>
          </div>
        </Command>
      </div>
    </div>
  );
};

export default CommandPalette;
