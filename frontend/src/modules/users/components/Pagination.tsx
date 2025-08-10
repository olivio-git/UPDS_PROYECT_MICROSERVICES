import React from 'react';
import { Button } from '@/components/atoms/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms/select';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
  isLoading?: boolean;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  isLoading = false
}) => {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const getVisiblePages = () => {
    const delta = 2; // Número de páginas a mostrar a cada lado de la página actual
    const range = [];
    const rangeWithDots = [];

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  const visiblePages = getVisiblePages();

  if (totalItems === 0) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4 bg-box border-t border-line">
      {/* Información de elementos */}
      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-500">
          Mostrando {startItem} - {endItem} de {totalItems} resultados
        </div>
        
        {/* Selector de elementos por página */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-200">Mostrar:</span>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={(value) => onItemsPerPageChange(parseInt(value))}
            disabled={isLoading}
          >
            <SelectTrigger className="w-20 h-8 bg-box text-white border border-line">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-box border-line text-white">
              <SelectItem className="hover:bg-gray-800" value="10">10</SelectItem>
              <SelectItem className="hover:bg-gray-800" value="25">25</SelectItem>
              <SelectItem className="hover:bg-gray-800" value="50">50</SelectItem>
              <SelectItem className="hover:bg-gray-800" value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Controles de navegación */}
      <div className="flex items-center gap-1">
        {/* Primera página */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={!canGoPrevious || isLoading}
          className="h-8 w-8 p-0 bg-box text-white border border-line hover:bg-gray-200/10"
          title="Primera página"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* Página anterior */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrevious || isLoading}
          className="h-8 w-8 p-0 bg-box text-white border border-line hover:bg-gray-200/10"
          title="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Números de página */}
        <div className="flex items-center gap-1">
          {visiblePages.map((page, index) => {
            if (page === '...') {
              return (
                <span
                  key={`dots-${index}`}
                  className="h-8 w-8 flex items-center justify-center text-gray-500"
                >
                  ...
                </span>
              );
            }

            const pageNumber = page as number;
            const isCurrentPage = pageNumber === currentPage;

            return (
              <Button
                key={pageNumber}
                variant={isCurrentPage ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(pageNumber)}
                disabled={isLoading}
                className={`h-8 w-8 p-0 ${
                  isCurrentPage 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'hover:bg-gray-50'
                }`}
              >
                {pageNumber}
              </Button>
            );
          })}
        </div>

        {/* Página siguiente */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext || isLoading}
          className="h-8 w-8 p-0 bg-box text-white border border-line hover:bg-gray-200/10"
          title="Página siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Última página */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={!canGoNext || isLoading}
          className="h-8 w-8 p-0 bg-box text-white border border-line hover:bg-gray-200/10"
          title="Última página"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default Pagination;
