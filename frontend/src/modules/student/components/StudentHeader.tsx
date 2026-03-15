import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { Menu, X, LogOut, User, Bell, Calendar, BookOpen, TrendingUp } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import useAuth from "@/hooks/useAuth";
import ImageLogo from "@/assets/images/logo.webp";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

// Rutas específicas para estudiantes
const studentRoutes = [
    {
        path: "/student/dashboard",
        name: "Dashboard",
        icon: TrendingUp
    },
    {
        path: "/student/exams",
        name: "Mis Exámenes",
        icon: BookOpen
    },
    {
        path: "/student/results",
        name: "Resultados",
        icon: TrendingUp
    },
    {
        path: "/student/profile",
        name: "Mi Perfil",
        icon: User
    }
];

const StudentHeader = () => {
    const { user, logout } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

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

    return (
        <>
            {/* Header Principal */}
            <header className="fixed top-0 z-50 w-full">
                <div className="flex items-center justify-between w-full mx-auto mt-2 px-4">
                    {/* Logo/Brand */}
                    <div className="hidden md:flex items-center">
                        <img className="h-8" src={ImageLogo} alt="CBA Logo" />
                    </div>


                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex px-6 py-1 text-xs font-medium rounded-full bg-background/80 backdrop-blur-xl border border-border/40 text-foreground justify-center items-center gap-4">
                        {studentRoutes.map((route) => {
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

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        {/* Notifications */}
                        <div className="hidden md:block">
                            <Button
                                variant="outline"
                                size="icon"
                                className="border border-border/40 bg-background/80 backdrop-blur-sm hover:border-border hover:bg-muted transition-all duration-300"
                            >
                                <Bell className="h-4 w-4 text-foreground" />
                            </Button>
                        </div>

                        {/* User Menu Desktop */}
                        <div className="hidden md:block relative">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                className="border border-border/40 bg-background/80 backdrop-blur-sm hover:border-border hover:bg-muted transition-all duration-300"
                            >
                                <User className="h-4 w-4 text-foreground" />
                            </Button>
                    <ThemeToggle></ThemeToggle>

                            {/* User Dropdown */}
                            {isUserMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-xl">
                                    <div className="py-2">
                                        <div className="px-4 py-2 border-b border-border">
                                            <p className="text-sm text-popover-foreground font-medium">
                                                {user?.firstName} {user?.lastName}
                                            </p>
                                            <p className="text-xs text-muted-foreground">Estudiante</p>
                                        </div>
                                        <button
                                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-popover-foreground hover:bg-muted transition-colors"
                                            onClick={() => {
                                                setIsUserMenuOpen(false);
                                                handleNavigation('/student/profile');
                                            }}
                                        >
                                            <User className="h-4 w-4" />
                                            Mi Perfil
                                        </button>
                                        <hr className="my-1 border-border" />
                                        <button
                                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-500 hover:bg-muted transition-colors"
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
                                className="md:hidden border border-border/40 bg-background/80 backdrop-blur-sm hover:border-border hover:bg-muted transition-all duration-300"
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
                    <div className="fixed top-0 left-0 h-full w-64 bg-popover/95 backdrop-blur-sm border-r border-border shadow-xl transform transition-transform duration-300">
                        <div className="flex flex-col h-full">
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-border">
                                <h2 className="text-lg font-bold text-popover-foreground">
                                    CBA Platform
                                </h2>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={toggleMobileMenu}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-4 w-4 text-foreground" />
                                </Button>
                            </div>

                            {/* User Info */}
                            <div className="p-4 border-b border-border">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-popover-foreground">
                                            {user?.firstName} {user?.lastName}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Estudiante</p>
                                    </div>
                                </div>
                            </div>

                            {/* Navigation Links */}
                            <nav className="flex-1 p-4">
                                <div className="space-y-2">
                                    {studentRoutes.map((route) => {
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
                                                        : "text-foreground/70 hover:bg-muted hover:text-blue-400"
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
                            <div className="p-4 border-t border-border">
                                <button
                                    className="flex items-center gap-3 w-full p-3 text-red-500 hover:bg-red-500/10 rounded-lg transition-all duration-200"
                                    onClick={handleLogout}
                                >
                                    <LogOut className="h-5 w-5" />
                                    <span className="font-medium">Cerrar Sesión</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default StudentHeader;