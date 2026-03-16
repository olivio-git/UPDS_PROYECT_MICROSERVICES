import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/atoms/alert-dialog";
import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/atoms/dialog";
import { MainLayout } from "@/components/layout";
import type { SortingState } from "@tanstack/react-table";
import { Upload, Download, FileText } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import UserForm from "../components/UserForm";
import UserTable from "../components/UserTable";
import UserTableHeader from "../components/UserTableHeader";
import { useUsers } from "../hooks/useUsers";
import { userService } from "../services/userService";
import type {
  CreateUserRequest,
  UpdateUserRequest,
  User,
  ViewMode,
} from "../types/user.types";

const roleLabels: Record<string, string> = {
  teacher: "Profesor",
  proctor: "Supervisor",
  student: "Estudiante",
};

const ASSIGNABLE_ROLES = [
  { value: "teacher", label: "Profesor" },
  { value: "proctor", label: "Supervisor" },
  { value: "student", label: "Estudiante" },
];

const UsersScreen = () => {
  // Estados de UI
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleteMultipleDialogOpen, setIsDeleteMultipleDialogOpen] =
    useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado modal asignar rol
  const [isAssignRoleOpen, setIsAssignRoleOpen] = useState(false);
  const [userToAssignRole, setUserToAssignRole] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isAssigningRole, setIsAssigningRole] = useState(false);

  // Hook de usuarios
  const {
    users,
    totalUsers,
    pagination,
    isLoading,
    isFetching,
    isError,
    errorMessage,
    filters,
    setFilters,
    selectedUsers,
    selectUser,
    selectAllUsers,
    clearSelection,
    refreshUsers,
    createUser,
    updateUser,
    deleteUser,
    deleteSelectedUsers,
    activateUser,
    deactivateUser,
    generateTemporaryPassword,
    // getUserById,
  } = useUsers();

  // Debug: ver datos de paginación
  console.log('UserScreen pagination data:', {
    pagination,
    totalUsers,
    usersLength: users.length
  });

  // Manejadores de navegación
  const handleCreateUser = () => {
    setSelectedUser(null);
    setViewMode("create");
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setViewMode("edit");
  };

  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    // Por ahora usar el modo edit para ver detalles
    // Se podría crear un modo 'view' específico en el futuro
    setViewMode("edit");
  };

  const handleBackToTable = () => {
    setSelectedUser(null);
    setViewMode("table");
    clearSelection();
  };

  // Manejadores CRUD
  const handleSaveUser = async (
    userData: CreateUserRequest | UpdateUserRequest
  ) => {
    setIsFormLoading(true);
    try {
      let success = false;

      if (viewMode === "create") {
        success = await createUser(userData as CreateUserRequest);
        if (success) {
          toast.success("Usuario creado exitosamente");
          handleBackToTable();
        }
      } else if (viewMode === "edit" && selectedUser) {
        success = await updateUser(
          selectedUser._id,
          userData as UpdateUserRequest
        );
        if (success) {
          toast.success("Usuario actualizado exitosamente");
          refreshUsers();
          handleBackToTable();
        }
      }
    } catch (error) {
      console.error("Error saving user:", error);
    } finally {
      setIsFormLoading(false);
    }
  };

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    const success = await deleteUser(userToDelete._id);
    if (success) {
      toast.success(
        `Usuario ${userToDelete.firstName} ${userToDelete.lastName} eliminado`
      );
    }

    setIsDeleteDialogOpen(false);
    setUserToDelete(null);
  };

  const handleDeleteSelectedUsers = () => {
    if (selectedUsers.length === 0) {
      toast.warning("No hay usuarios seleccionados");
      return;
    }
    setIsDeleteMultipleDialogOpen(true);
  };

  const confirmDeleteSelectedUsers = async () => {
    await deleteSelectedUsers();
    setIsDeleteMultipleDialogOpen(false);
  };

  // Manejadores de acciones específicas
  const handleActivateUser = async (user: User) => {
    const success = await activateUser(user._id);
    if (success) {
      toast.success(`Usuario ${user.firstName} ${user.lastName} activado`);
    }
  };

  const handleDeactivateUser = async (user: User) => {
    const success = await deactivateUser(user._id);
    if (success) {
      toast.success(`Usuario ${user.firstName} ${user.lastName} desactivado`);
    }
  };

  const handleGeneratePassword = async (user: User) => {
    const success = await generateTemporaryPassword(user._id, true);
    if (success) {
      toast.success(`Contraseña temporal enviada a ${user.email}`);
    }
  };

  const handleAssignRole = (user: User) => {
    setUserToAssignRole(user);
    setSelectedRole(user.role);
    setIsAssignRoleOpen(true);
  };

  const confirmAssignRole = async () => {
    if (!userToAssignRole || !selectedRole) return;
    setIsAssigningRole(true);
    const result = await userService.updateUser(userToAssignRole._id, { role: selectedRole as any });
    setIsAssigningRole(false);
    if (result.success) {
      toast.success(`Rol actualizado a ${roleLabels[selectedRole] ?? selectedRole}`);
      setIsAssignRoleOpen(false);
      refreshUsers();
    }
  };

  // Manejadores de exportación/importación
  const handleExportUsers = async () => {
    try {
      toast.loading('Exportando usuarios...', { id: 'export-users' });

      // Exportar con los filtros actuales aplicados
      const result = await userService.exportUsers(filters);

      if (result.success) {
        toast.success('Usuarios exportados exitosamente', { id: 'export-users' });
      } else {
        toast.error(result.message || 'Error exportando usuarios', { id: 'export-users' });
      }
    } catch (error) {
      console.error('Error exporting users:', error);
      toast.error('Error inesperado al exportar usuarios', { id: 'export-users' });
    }
  };

  const handleImportUsers = () => {
    setSelectedFile(null);
    setIsImportDialogOpen(true);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      toast.loading('Descargando plantilla...', { id: 'download-template' });

      const result = await userService.downloadTemplate();

      if (result.success) {
        toast.success('Plantilla descargada exitosamente', { id: 'download-template' });
      } else {
        toast.error(result.message || 'Error descargando plantilla', { id: 'download-template' });
      }
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Error inesperado al descargar plantilla', { id: 'download-template' });
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) {
      toast.error('Por favor selecciona un archivo');
      return;
    }

    try {
      setIsImporting(true);
      toast.loading('Importando usuarios...', { id: 'import-users' });

      const result = await userService.importUsers(selectedFile);

      if (result.success) {
        toast.success(result.message || 'Usuarios importados exitosamente', { id: 'import-users' });
        setIsImportDialogOpen(false);
        setSelectedFile(null);

        // Refrescar la lista de usuarios
        refreshUsers();
      } else {
        toast.error(result.message || 'Error importando usuarios', { id: 'import-users' });
      }
    } catch (error) {
      console.error('Error importing users:', error);
      toast.error('Error inesperado al importar usuarios', { id: 'import-users' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancelImport = () => {
    setIsImportDialogOpen(false);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Manejadores de filtros y paginación
  const handleFiltersChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
    clearSelection(); // Limpiar selección al cambiar filtros
  };

  const handlePageChange = (page: number) => {
    setFilters({ ...filters, page });
  };

  const handleItemsPerPageChange = (limit: number) => {
    setFilters({ ...filters, limit, page: 1 });
  };

  // Manejador de sorting
  const handleSortingChange = (newSorting: SortingState) => {
    setSorting(newSorting);
    if (newSorting.length > 0) {
      const sort = newSorting[0];
      setFilters({
        ...filters,
        sortBy: sort.id as any,
        sortOrder: sort.desc ? "desc" : "asc",
        page: 1,
      });
    }
  };

  // Renderizar contenido según el modo de vista
  const renderContent = () => {
    if (viewMode === "create") {
      return (
        <UserForm
          onSave={handleSaveUser}
          onCancel={handleBackToTable}
          isLoading={isFormLoading}
        />
      );
    }

    if (viewMode === "edit" && selectedUser) {
      return (
        <UserForm
          user={selectedUser}
          isEditing={true}
          onSave={handleSaveUser}
          onCancel={handleBackToTable}
          isLoading={isFormLoading}
        />
      );
    }

    // Vista de tabla (por defecto)
    return (
      <div className="flex flex-col gap-3">
        <UserTableHeader
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onCreateUser={handleCreateUser}
          onDeleteSelected={handleDeleteSelectedUsers}
          onExportUsers={handleExportUsers}
          onImportUsers={handleImportUsers}
          selectedCount={selectedUsers.length}
          totalCount={totalUsers}
          isLoading={isLoading}
        />
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <UserTable
            users={users}
            selectedUsers={selectedUsers}
            onSelectUser={selectUser}
            onSelectAllUsers={selectAllUsers}
            onEditUser={handleEditUser}
            onDeleteUser={handleDeleteUser}
            onViewUser={handleViewUser}
            onActivateUser={handleActivateUser}
            onDeactivateUser={handleDeactivateUser}
            onGeneratePassword={handleGeneratePassword}
            onAssignRole={handleAssignRole}
            isLoading={isLoading}
            isFetching={isFetching}
            isError={isError}
            errorMessage={errorMessage}
            sorting={sorting}
            setSorting={handleSortingChange}
            // Props de paginación
            currentPage={pagination?.page}
            totalPages={pagination?.totalPages}
            totalItems={pagination?.total}
            itemsPerPage={pagination?.limit}
            onPageChange={handlePageChange}
          />
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="flex flex-col gap-3 p-4 max-w-5xl mx-auto w-full">
        {renderContent()}
      </div>

      {/* Dialog para eliminar usuario individual */}
      <AlertDialog
        open={isDeleteDialogOpen}
        // isDeleteDialogOpen
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Confirmar eliminación</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              ¿Estás seguro de que deseas eliminar al usuario{" "}
              <strong>
                {userToDelete?.firstName} {userToDelete?.lastName}
              </strong>
              ? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-foreground border border-border focus:outline-none">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para eliminar múltiples usuarios */}
      <AlertDialog
        open={isDeleteMultipleDialogOpen}
        onOpenChange={setIsDeleteMultipleDialogOpen}
      >
        <AlertDialogContent className="bg-card border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Confirmar eliminación múltiple</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              ¿Estás seguro de que deseas eliminar {selectedUsers.length}{" "}
              usuario(s) seleccionado(s)? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-foreground border border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSelectedUsers}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar {selectedUsers.length} usuario(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para importar usuarios */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="bg-card border border-border text-foreground sm:max-w-md">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2.5 text-foreground">
              <div className="p-1.5 rounded-md bg-green-100 dark:bg-green-900/30">
                <Upload className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              Importar Usuarios
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Sube un archivo Excel (.xlsx, .xls) o CSV con la lista de usuarios
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Plantilla banner */}
            <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800/50 dark:bg-blue-950/30 p-3">
              <div className="shrink-0 p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/40">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  ¿Primera vez importando?
                </p>
                <p className="text-xs text-blue-600/80 dark:text-blue-400/70 mt-0.5">
                  Descarga la plantilla con el formato requerido
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="shrink-0 h-8 border-blue-300 bg-white text-blue-700 hover:bg-blue-50 dark:border-blue-700/50 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Plantilla
              </Button>
            </div>

            {/* File picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Seleccionar archivo
              </label>
              <div className="relative">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="bg-muted/50 border-border text-foreground cursor-pointer
                    file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0
                    file:text-xs file:font-medium
                    file:bg-muted file:text-foreground
                    hover:file:bg-muted/80"
                />
              </div>
              {selectedFile ? (
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-md px-3 py-2">
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate font-medium">{selectedFile.name}</span>
                  <span className="shrink-0 text-green-600/70 dark:text-green-500/70">
                    ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Formatos: .xlsx, .xls, .csv — máximo 10 MB</p>
              )}
            </div>

            {/* Column guide */}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">
                Columnas requeridas
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {[
                  ['firstName', 'Nombre'],
                  ['lastName', 'Apellido'],
                  ['email', 'Email único'],
                  ['role', 'admin / teacher / proctor / student'],
                  ['isActive', 'true o false (opcional)'],
                ].map(([col, desc]) => (
                  <div key={col} className="flex items-start gap-1.5">
                    <code className="text-[11px] font-mono text-blue-600 dark:text-blue-400 shrink-0">{col}</code>
                    <span className="text-[11px] text-muted-foreground leading-tight">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              variant="outline"
              onClick={handleCancelImport}
              disabled={isImporting}
              className="border-border text-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={!selectedFile || isImporting}
              className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600"
            >
              {isImporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-1.5" />
                  Importar Usuarios
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal: Asignar Rol */}
      <Dialog open={isAssignRoleOpen} onOpenChange={setIsAssignRoleOpen}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Asignar rol</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {userToAssignRole && (
                <>Cambia el rol de <span className="font-medium text-foreground">{userToAssignRole.firstName} {userToAssignRole.lastName}</span>.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2">
            {ASSIGNABLE_ROLES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setSelectedRole(value)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                  selectedRole === value
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/50"
                    : "border-border bg-muted/30 text-foreground hover:bg-muted"
                }`}
              >
                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selectedRole === value ? "border-blue-500" : "border-muted-foreground"
                }`}>
                  {selectedRole === value && (
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </span>
                {label}
                {userToAssignRole?.role === value && (
                  <span className="ml-auto text-xs text-muted-foreground">Actual</span>
                )}
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignRoleOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmAssignRole}
              disabled={isAssigningRole || selectedRole === userToAssignRole?.role}
            >
              {isAssigningRole ? "Guardando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default UsersScreen;
