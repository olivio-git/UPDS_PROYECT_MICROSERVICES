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
import GradientWrapper from "@/components/background/GrandWrapperSection";
import { MainLayout } from "@/components/layout";
import type { SortingState } from "@tanstack/react-table";
import { Upload, Download, FileText, Users2 } from "lucide-react";
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

  const handleAssignRole = () => {
    // Por implementar: Modal para asignar rol
    toast.info("Función de asignar rol por implementar");
  };

  const handleSendEmail = () => {
    // Por implementar: Modal para enviar email
    toast.info("Función de enviar email por implementar");
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
      <div className="space-y-6">
        {/* Header con filtros */}
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
        {/* Tabla de usuarios */}
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
          onSendEmail={handleSendEmail}
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
    );
  };

  return (
    <MainLayout gradientVariant="aurora">
      <div className="max-w-7xl mx-auto space-y-8 epilogue-uniquifier">
        <div className="text-center space-y-3 mb-5">
            <div className="flex justify-center">
                <div className="p-2.5 rounded-full bg-gradient-to-br from-blue-500/15 to-purple-600/15 border border-blue-500/20">
                <Users2 className="h-3.5 w-3.5 text-blue-300" />
                </div>
            </div> 
        </div>
        <GradientWrapper
          intensity="low"
          size="xl"
          position="right"
          animate={false}
          variant="cosmic"
        >
          <div className="min-h-screen">{renderContent()}</div>
        </GradientWrapper>
      </div>

      {/* Dialog para eliminar usuario individual */}
      <AlertDialog
        open={isDeleteDialogOpen}
        // isDeleteDialogOpen
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent className="bg-box">
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
            <AlertDialogCancel className="bg-transparent text-foreground border border-line focus:outline-none">Cancelar</AlertDialogCancel>
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
        <AlertDialogContent className="bg-red-50 border border-red-200 text-red-800">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar eliminación múltiple</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar {selectedUsers.length}{" "}
              usuario(s) seleccionado(s)? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSelectedUsers}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar {selectedUsers.length} usuario(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para importar usuarios */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="bg-card border border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Importar Usuarios
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Importa usuarios desde un archivo Excel (.xlsx, .xls) o CSV
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Botón para descargar plantilla */}
            <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-400" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-blue-300">
                    ¿Primera vez importando?
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Descarga la plantilla de Excel para ver el formato correcto
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  className="border-blue-600 text-blue-300 hover:bg-blue-900/30"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Plantilla
                </Button>
              </div>
            </div>

            {/* Selector de archivo */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Seleccionar archivo
              </label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="bg-muted border-border text-foreground file:bg-muted file:text-foreground file:border-0 file:mr-4 file:py-2 file:px-4 file:rounded-md file:text-sm"
              />
              {selectedFile && (
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <FileText className="w-4 h-4" />
                  {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>

            {/* Información sobre el formato */}
            <div className="bg-muted/50 border border-border rounded-lg p-3">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Formato requerido:
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• firstName: Nombre del usuario</li>
                <li>• lastName: Apellido del usuario</li>
                <li>• email: Email único del usuario</li>
                <li>• role: admin, teacher, proctor, o student</li>
                <li>• isActive: true o false (opcional, por defecto true)</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelImport}
              disabled={isImporting}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={!selectedFile || isImporting}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isImporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Importar Usuarios
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default UsersScreen;
