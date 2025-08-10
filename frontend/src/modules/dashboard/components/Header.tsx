import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/atoms/button";
import { Settings, Menu, X, LogOut, User, Bell, Search, Check, Trash2 } from "lucide-react";
import { protectedRoutes } from "@/navigation/Protected.Route";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/modules/auth/services/authStore";
import CommandPalette from "./CommandPalette";
import ImageLogo from "@/assets/images/logo.webp";

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'exam';
}

const Header = () => {
    const { user, logout, isAuthenticated } = useAuthStore();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [userForceUpdate, setUserForceUpdate] = useState(0);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([
        {
            id: "1",
            title: "Nuevo Examen Disponible",
            message: "El examen de Cambridge B2 está disponible para tomar",
            time: "Hace 5 min",
            read: false,
            type: "exam"
        },
        {
            id: "2", 
            title: "Resultado Publicado",
            message: "Tu resultado del examen IELTS Academic ya está disponible",
            time: "Hace 1h",
            read: false,
            type: "success"
        },
        {
            id: "3",
            title: "Recordatorio",
            message: "Tu próximo examen es mañana a las 10:00 AM",
            time: "Hace 2h",
            read: true,
            type: "warning"
        }
    ]);

    const navigate = useNavigate();
    const location = useLocation();
    const notificationRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);

    // Forzar re-render cuando cambie el estado de autenticación
    useEffect(() => {
        if (isAuthenticated && user) {
            console.log('🔄 [Header] Usuario autenticado detectado, forzando update...');
            setUserForceUpdate(prev => prev + 1);
        }
    }, [isAuthenticated, user?.role, user?.firstName]);
    
    // Escuchar eventos personalizados de cambio de auth
    useEffect(() => {
        const handleAuthChange = () => {
            console.log('🔄 [Header] Evento auth-state-changed recibido');
            setUserForceUpdate(prev => prev + 1);
        };
        
        window.addEventListener('auth-state-changed', handleAuthChange);
        return () => window.removeEventListener('auth-state-changed', handleAuthChange);
    }, []);

    // Cerrar dropdowns al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setIsNotificationsOpen(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Detectar Ctrl+K / Cmd+K
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                setIsCommandPaletteOpen(prev => !prev);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    const userRole = user?.role;
    const filteredRoutes = protectedRoutes.filter(
        (route) => route.role?.includes("all") || route.role?.includes(userRole) && route.hidden !== true
    );
    
    // Debug para ver el estado en Header
    console.log('📊 [Header] Estado completo:', {
        hasUser: !!user,
        userRole,
        firstName: user?.firstName,
        lastName: user?.lastName,
        email: user?.email,
        fullUser: user,
        isAuthenticated,
        routesLength: filteredRoutes.length,
        allRoutes: protectedRoutes.length
    });

    const unreadCount = notifications.filter(n => !n.read).length;

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    const handleNavigation = (path: string) => {
        navigate(path);
        setIsMobileMenuOpen(false);
    };

    const handleLogout = async () => {
        await logout();
    };

    const openCommandPalette = () => {
        setIsCommandPaletteOpen(true);
    };

    const closeCommandPalette = () => {
        setIsCommandPaletteOpen(false);
    };

    const markAsRead = (id: string) => {
        setNotifications(prev => prev.map(n => 
            n.id === id ? { ...n, read: true } : n
        ));
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const deleteNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'success': return '✅';
            case 'warning': return '⚠️';
            case 'exam': return '📝';
            default: return 'ℹ️';
        }
    };

    return (
        <>
            {/* Header Principal */}
            <header className="fixed top-0 z-50 w-full">
                <div className="flex items-center justify-between w-full mx-auto mt-2 px-4">
                    {/* Logo/Brand - Solo visible en desktop */}
                    <div className="hidden md:flex items-center">
                        <img className="h-8" src={ImageLogo} alt="Logo" />
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex px-6 py-1 text-xs font-medium rounded-full bg-background/80 backdrop-blur-xl border border-gray-900/10 text-gray-200 justify-center items-center gap-4">
                        {filteredRoutes.map((route) => {
                            const IconComponent = route.icon;
                            const isActive = location.pathname === route.path;

                            return (
                                <button
                                    key={route.path}
                                    onClick={() => handleNavigation(route.path)}
                                    className={`
                                        flex gap-2 items-center font-medium border border-transparent relative px-3 py-2 rounded-md transition-all duration-300
                                        ${isActive
                                            ? "text-blue-400 bg-blue-500/10"
                                            : "hover:text-blue-400 hover:bg-blue-500/5 hover:border-blue-500/20"
                                        }
                                    `} 
                                    aria-label={route.name}
                                >
                                    {IconComponent && <IconComponent className="h-4 w-4" />}
                                    <span className="hidden lg:block">{route.name}</span>
                                </button>
                            );
                        })}
                    </nav>

                    {/* Actions: Search + Notifications + User Menu + Mobile Menu Button */}
                    <div className="flex items-center gap-2">
                        {/* Command Palette Button - Desktop */}
                        <div className="hidden md:block">
                            <button
                                onClick={openCommandPalette}
                                className="flex items-center px-2 py-1 text-sm text-gray-400 bg-gray-900 backdrop-blur-sm rounded-lg hover:border-gray-600 hover:bg-gray-800 hover:text-gray-200 transition-all duration-300"
                            >
                                <Search className="h-4 w-4" /> 
                                <kbd className="pointer-events-none hidden lg:inline-flex h-5 select-none items-center gap-1 rounded px-1.5 font-mono text-xs font-medium text-gray-400 opacity-100">
                                    Ctrl+K
                                </kbd>
                            </button>
                        </div>

                        {/* Notifications - Desktop */}
                        <div className="hidden md:block relative" ref={notificationRef}>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                                className="relative border border-gray-900/20 bg-background/80 backdrop-blur-sm hover:border-gray-600 hover:bg-gray-900 transition-all duration-300"
                            >
                                <Bell className="h-4 w-4 text-white" />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium animate-pulse">
                                        {unreadCount}
                                    </span>
                                )}
                            </Button>

                            {/* Notifications Dropdown con Gradiente Plateado */}
                            {isNotificationsOpen && (
                                <div className="absolute right-0 mt-2 w-80 bg-gray-900/95 backdrop-blur-sm border border-line rounded-xl shadow-2xl overflow-hidden">
                                    {/* Gradiente plateado para el modal de notificaciones */}
                                    <div className="absolute inset-0 pointer-events-none">
                                        {/* Gradiente central que se expande hacia los lados */}
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-full bg-gradient-to-l from-transparent via-slate-500/28 to-transparent blur-2xl"></div>
                                        {/* <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-full bg-gradient-to-r from-transparent via-slate-300/1 to-transparent blur-xs"></div> */}
                                        {/* Gradiente horizontal desde el centro */}
                                        {/* <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-24 bg-gradient-to-r from-transparent via-slate-400/6 to-transparent"></div> */}
                                    </div>

                                    {/* Header */}
                                    <div className="relative flex items-center justify-between p-4 border-b border-gray-700/60">
                                        <h3 className="text-sm font-semibold text-gray-200">Notificaciones</h3>
                                        {unreadCount > 0 && (
                                            <button
                                                onClick={markAllAsRead}
                                                className="text-xs text-blue-500 hover:text-blue-300 transition-colors"
                                            >
                                                Marcar todas como leídas
                                            </button>
                                        )}
                                    </div>

                                    {/* Notifications List */}
                                    <div className="relative max-h-80 overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="p-6 text-center text-gray-400">
                                                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                <p className="text-sm">No tienes notificaciones</p>
                                            </div>
                                        ) : (
                                            notifications.map((notification) => (
                                                <div
                                                    key={notification.id}
                                                    className={`p-4 border-b hover:cursor-pointer border-gray-800/50 hover:bg-gray-800/30 transition-colors group ${
                                                        !notification.read ? 'bg-blue-500/5' : ''
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <span className="text-sm flex-shrink-0 mt-0.5">
                                                            {getNotificationIcon(notification.type)}
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between">
                                                                <h4 className={`text-sm font-medium ${
                                                                    !notification.read ? 'text-white' : 'text-gray-300'
                                                                }`}>
                                                                    {notification.title}
                                                                </h4>
                                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    {!notification.read && (
                                                                        <button
                                                                            onClick={() => markAsRead(notification.id)}
                                                                            className="p-1 hover:bg-gray-700 rounded"
                                                                            title="Marcar como leída"
                                                                        >
                                                                            <Check className="h-3 w-3 text-green-400" />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => deleteNotification(notification.id)}
                                                                        className="p-1 hover:bg-gray-700 rounded"
                                                                        title="Eliminar"
                                                                    >
                                                                        <Trash2 className="h-3 w-3 text-red-400" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                                                                {notification.message}
                                                            </p>
                                                            <span className="text-xs text-gray-500 mt-1 block">
                                                                {notification.time}
                                                            </span>
                                                        </div>
                                                        {!notification.read && (
                                                            <div className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0 mt-2"></div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Footer */}
                                    <div className="relative p-3 border-t border-gray-700/60">
                                        <button className="w-full text-xs text-center text-blue-400 hover:text-blue-300 transition-colors">
                                            Ver todas las notificaciones
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* User Menu Desktop */}
                        <div className="hidden md:block relative" ref={userMenuRef}>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                className="border border-gray-900/20 bg-background/80 backdrop-blur-sm hover:border-gray-600 hover:bg-gray-900 transition-all duration-300"
                            >
                                <User className="h-4 w-4 text-white" />
                            </Button>

                            {/* User Dropdown */}
                            {isUserMenuOpen && (
                                <div className="absolute right-0 mt-2 w-56 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                                    {/* User Info */}
                                    <div className="p-4 border-b border-gray-700">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                                                <span className="text-white font-semibold text-sm">
                                                    {user?.firstName?.charAt(0) || user?.name?.charAt(0) || 'U'}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-white">
                                                    {user?.firstName && user?.lastName 
                                                        ? `${user.firstName} ${user.lastName}`
                                                        : user?.name || 'Usuario'
                                                    }
                                                </p>
                                                {/* <p className="text-xs text-gray-400">
                                                    {user?.email || 'usuario@ejemplo.com'}
                                                </p> */}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Menu Items */}
                                    <div className="py-2">
                                        <button
                                            className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-200 hover:bg-gray-800/50 transition-colors"
                                            onClick={() => {
                                                setIsUserMenuOpen(false);
                                                navigate('/profile');
                                            }}
                                        >
                                            <User className="h-4 w-4" />
                                            Mi Perfil
                                        </button>
                                        <button
                                            className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-200 hover:bg-gray-800/50 transition-colors"
                                            onClick={() => {
                                                setIsUserMenuOpen(false);
                                                navigate('/settings');
                                            }}
                                        >
                                            <Settings className="h-4 w-4" />
                                            Configuración
                                        </button>
                                        <hr className="my-2 border-gray-700" />
                                        <button
                                            className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                            onClick={handleLogout}
                                        >
                                            <LogOut className="h-4 w-4" />
                                            Cerrar Sesión
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Mobile Menu Button */}
                        {!isMobileMenuOpen && (
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={toggleMobileMenu}
                                className="md:hidden border border-gray-900/20 bg-background/80 backdrop-blur-sm hover:border-gray-600 hover:bg-gray-900 transition-all duration-300"
                            >
                                <Menu className="h-4 w-4 text-white" />
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-40 md:hidden">
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={toggleMobileMenu}
                    />

                    {/* Mobile Menu Panel */}
                    <div className="fixed top-0 left-0 h-full w-64 bg-gray-900/95 backdrop-blur-sm border-r border-gray-700 shadow-xl transform transition-transform duration-300">
                        <div className="flex flex-col h-full">
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-gray-700">
                                <h2 className="text-lg font-bold text-gray-200">
                                    CBA Platform
                                </h2>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={toggleMobileMenu}
                                    className="text-gray-400 hover:text-gray-200"
                                >
                                    <X className="h-4 w-4 text-white" />
                                </Button>
                            </div>

                            {/* Search Button Mobile */}
                            <div className="p-4 border-b border-gray-700 flex gap-2">
                                <button
                                    onClick={() => {
                                        setIsMobileMenuOpen(false);
                                        openCommandPalette();
                                    }}
                                    className="flex items-center gap-3 flex-1 p-2 text-gray-300 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-all duration-200"
                                >
                                    <Search className="h-5 w-5" />
                                    <span className="text-xs">Buscar rutas...</span>
                                    <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded px-1.5 font-mono text-[10px] font-medium text-gray-400">
                                        Ctrl+K
                                    </kbd>
                                </button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="border border-gray-900/20 bg-background/80 backdrop-blur-sm hover:border-gray-600 hover:bg-gray-900 transition-all duration-300 relative"
                                >
                                    <Bell className="h-4 w-4 text-white" />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                                            {unreadCount}
                                        </span>
                                    )}
                                </Button>
                            </div>

                            {/* Navigation Links */}
                            <nav className="flex-1 p-4">
                                <div className="space-y-2">
                                    {filteredRoutes.map((route) => {
                                        const IconComponent = route.icon;
                                        const isActive = location.pathname === route.path;

                                        return (
                                            <button
                                                key={route.path}
                                                onClick={() => handleNavigation(route.path)}
                                                className={`
                                                    flex items-center gap-3 w-full p-3 rounded-lg text-left transition-all duration-200
                                                    ${isActive
                                                        ? "bg-blue-500/20 text-blue-400"
                                                        : "text-gray-300 hover:bg-gray-800 hover:text-blue-400"
                                                    }
                                                `}
                                            >
                                                {IconComponent && <IconComponent className="h-5 w-5" />}
                                                <span className="font-medium">{route.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </nav>

                            {/* User Actions */}
                            <div className="p-4 border-t border-gray-700">
                                <div className="space-y-2">
                                    <button
                                        className="flex items-center gap-3 w-full p-3 text-gray-300 hover:bg-gray-800 hover:text-blue-400 rounded-lg transition-all duration-200"
                                        onClick={() => {
                                            setIsMobileMenuOpen(false);
                                            navigate('/settings');
                                        }}
                                    >
                                        <Settings className="h-5 w-5" />
                                        <span className="font-medium">Configuración</span>
                                    </button>
                                    <button
                                        className="flex items-center gap-3 w-full p-3 text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200"
                                        onClick={handleLogout}
                                    >
                                        <LogOut className="h-5 w-5" />
                                        <span className="font-medium">Cerrar Sesión</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Command Palette */}
            <CommandPalette
                isOpen={isCommandPaletteOpen} 
                onClose={closeCommandPalette} 
            />
        </>
    );
};

export default Header;