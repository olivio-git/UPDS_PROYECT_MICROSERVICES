import {
    flexRender,
    type Table,
} from "@tanstack/react-table"
import {
    Table as AtomTable,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/atoms/table"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { Skeleton } from "../atoms/skeleton";
import ErrorDataComponent from "./errorDataComponent";
import NoDataComponent from "./noDataComponent";
interface Props<T> {
    table: Table<T>
    renderBottomRow?: () => React.ReactNode;
    isLoading: boolean;
    isFetching?: boolean
    isError?: boolean,
    rows?: number
    errorMessage?: string
    noDataMessage?: string
}

const CustomizableTable = <T,>({
    table,
    renderBottomRow,
    isLoading,
    isFetching,
    isError,
    rows,
    errorMessage,
    noDataMessage
}: Props<T>) => {

    return (
        <AtomTable className="w-full table-fixed text-xs">
            <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                            <TableHead
                                key={header.id}
                                className="relative group select-none text-left border-b border-line hover:bg-gray-800 p-2"
                                style={{ width: header.getSize() }}
                            >
                                {header.isPlaceholder ? null : (
                                    <div
                                        className={`flex items-center gap-2 justify-between ${header.column.getCanSort() ? "cursor-pointer select-none" : ""
                                            }`}
                                        onClick={header.column.getToggleSortingHandler()}
                                    >
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                        {header.column.getCanSort() && (
                                            <div className="flex flex-col text-blue-400">
                                                {header.column.getIsSorted() === "asc" ? (
                                                    <ArrowUp className="w-3 h-3" />
                                                ) : header.column.getIsSorted() === "desc" ? (
                                                    <ArrowDown className="w-3 h-3" />
                                                ) : (
                                                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {header.column.getCanResize() && (
                                    <div
                                        onMouseDown={header.getResizeHandler()}
                                        onTouchStart={header.getResizeHandler()}
                                        className="absolute right-0 top-0 h-full bg-gray-900 w-px  cursor-col-resize bg-gray-200 group-hover:bg-blue-400 transition-all duration-300"
                                    />
                                )}
                            </TableHead>
                        ))}
                    </TableRow>
                ))}
            </TableHeader>
            <TableBody className="divide-y divide-gray-800">
                {isLoading || isFetching ? (
                    [...Array(rows || 25)].map((_, rowIndex) => (
                        <TableRow key={`skeleton-row-${rowIndex}`}>
                            {table.getVisibleFlatColumns().map((column, colIndex) => (
                                <TableCell
                                    key={`skeleton-cell-${rowIndex}-${colIndex}`}
                                    style={{ width: column.getSize() }}
                                >
                                    <Skeleton className="h-6 w-full rounded" />
                                </TableCell>
                            ))}
                        </TableRow>
                    ))
                ) : isError ? (
                    <TableRow>
                        <TableCell
                            colSpan={table.getVisibleFlatColumns().length}
                            className="text-center"
                        >
                            <ErrorDataComponent
                                errorMessage={errorMessage}
                            // onRetry={() => { }}
                            />
                        </TableCell>
                    </TableRow>
                ) : table.getRowModel().rows.length === 0 ? (
                    <TableRow>
                        <TableCell
                            colSpan={table.getVisibleFlatColumns().length}
                            className="text-center"
                        >
                            <NoDataComponent
                                message={noDataMessage}
                            />
                        </TableCell>
                    </TableRow>
                ) : (
                    <>
                        {
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="p-1 truncate">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        }
                        {/* Renderizar fila personalizada si se provee */}
                        {renderBottomRow && renderBottomRow()}
                    </>
                )}

            </TableBody>
        </AtomTable>
    )
}
export default CustomizableTable;