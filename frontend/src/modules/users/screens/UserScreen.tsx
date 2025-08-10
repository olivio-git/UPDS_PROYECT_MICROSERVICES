import { useState } from "react";
import { toast } from "sonner";
import type { SortingState } from "@tanstack/react-table"; 
import { MainLayout } from "@/components/layout";
import UserTableHeader from "../components/UserTableHeader";
import UserTable from "../components/UserTable";
import UserForm from "../components/UserForm";
import Pagination from "../components/Pagination";
import { useUsers } from "../hooks/useUsers";
import type {
  ViewMode,
  User,
  CreateUserRequest,
  UpdateUserRequest,
} from "../types/user.types";
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
import GradientWrapper from "@/components/background/GrandWrapperSection";
import { Users2 } from "lucide-react";

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
    // refreshUsers,
    createUser,
    updateUser,
    deleteUser,
    deleteSelectedUsers,
    activateUser,
    deactivateUser,
    generateTemporaryPassword,
    // getUserById,
  } = useUsers();

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
  const handleExportUsers = () => {
    // Por implementar: Exportar usuarios
    toast.info("Función de exportar usuarios por implementar");
  };

  const handleImportUsers = () => {
    // Por implementar: Importar usuarios
    toast.info("Función de importar usuarios por implementar");
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
        />

        {/* Paginación */}
        {pagination && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
            isLoading={isLoading || isFetching}
          />
        )}
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
          size="lg"
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
            <AlertDialogTitle className="text-gray-200">Confirmar eliminación</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              ¿Estás seguro de que deseas eliminar al usuario{" "}
              <strong>
                {userToDelete?.firstName} {userToDelete?.lastName}
              </strong>
              ? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-white border border-line focus:outline-none">Cancelar</AlertDialogCancel>
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
    </MainLayout>
  );
};

export default UsersScreen;
