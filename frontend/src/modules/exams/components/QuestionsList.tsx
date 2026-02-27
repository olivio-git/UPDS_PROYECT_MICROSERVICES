// import React, { useState } from 'react';
// import { 
//   Plus, 
//   Search, 
//   Filter, 
//   Upload,
//   Edit,
//   Trash2,
//   Volume2,
//   Image as ImageIcon,
//   FileText,
//   ChevronLeft,
//   ChevronRight
// } from 'lucide-react';
// import { useQuestions } from '../hooks/useQuestions';
// import type { Question, QuestionType, Competency, Level } from '../types';
// import ImportModal from './ImportModal';
// import QuestionDetailModal from './QuestionDetailModal';

// const QuestionsList: React.FC = () => {
//   const {
//     questions,
//     loading,
//     error,
//     totalPages,
//     totalItems,
//     currentPage,
//     // filters,
//     changePage,
//     // changeLimit,
//     applyFilters,
//     clearFilters,
//     deleteQuestion,
//     loadQuestions
//   } = useQuestions();

//   const [showCreateModal, setShowCreateModal] = useState(false);
//   const [showImportModal, setShowImportModal] = useState(false);
//   const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
//   const [searchTerm, setSearchTerm] = useState('');
//   const [showFilters, setShowFilters] = useState(false);

//   // Filtros locales
//   const [localFilters, setLocalFilters] = useState({
//     type: '',
//     competency: '',
//     level: '',
//     difficulty: 0,
//     isActive: true
//   });

//   const handleEdit = (question: Question) => {
//     setSelectedQuestion(question);
//     setShowCreateModal(true);
//   };

//   const handleDelete = async (id: string) => {
//     if (window.confirm('¿Estás seguro de eliminar esta pregunta?')) {
//       await deleteQuestion(id);
//     }
//   };

//   const handleApplyFilters = () => {
//     const activeFilters: any = {};
//     if (localFilters.type) activeFilters.type = localFilters.type;
//     if (localFilters.competency) activeFilters.competency = localFilters.competency;
//     if (localFilters.level) activeFilters.level = localFilters.level;
//     if (localFilters.difficulty > 0) activeFilters.difficulty = localFilters.difficulty;
//     activeFilters.isActive = localFilters.isActive;
    
//     applyFilters(activeFilters);
//     setShowFilters(false);
//   };

//   const handleClearFilters = () => {
//     setLocalFilters({
//       type: '',
//       competency: '',
//       level: '',
//       difficulty: 0,
//       isActive: true
//     });
//     clearFilters();
//     setShowFilters(false);
//   };

//   const getQuestionTypeIcon = (type: QuestionType) => {
//     switch (type) {
//       case 'listening':
//         return <Volume2 className="w-4 h-4" />;
//       case 'reading':
//         return <FileText className="w-4 h-4" />;
//       default:
//         return <FileText className="w-4 h-4" />;
//     }
//   };

//   const getQuestionTypeLabel = (type: QuestionType) => {
//     const labels: Record<QuestionType, string> = {
//       multiple_choice: 'Opción Múltiple',
//       true_false: 'Verdadero/Falso',
//       open_text: 'Texto Abierto',
//       listening: 'Comprensión Auditiva',
//       speaking: 'Expresión Oral',
//       reading: 'Comprensión Lectora',
//       writing: 'Expresión Escrita'
//     };
//     return labels[type] || type;
//   };

//   const getDifficultyColor = (difficulty: number) => {
//     if (difficulty <= 2) return 'text-green-600 bg-green-100';
//     if (difficulty <= 3) return 'text-yellow-600 bg-yellow-100';
//     if (difficulty <= 4) return 'text-orange-600 bg-orange-100';
//     return 'text-red-600 bg-red-100';
//   };

//   const getDifficultyLabel = (difficulty: number) => {
//     const labels = ['', 'Muy Fácil', 'Fácil', 'Medio', 'Difícil', 'Muy Difícil'];
//     return labels[difficulty] || '';
//   };

//   return (
//     <div className="p-6 space-y-6">
//       {/* Header */}
//       <div className="flex justify-between items-center">
//         <div>
//           <h1 className="text-2xl font-bold text-gray-900">Banco de Preguntas</h1>
//           <p className="text-gray-500 mt-1">Gestiona las preguntas del sistema de evaluación</p>
//         </div>
//         <div className="flex gap-3">
//           <button
//             onClick={() => setShowImportModal(true)}
//             className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
//           >
//             <Upload className="w-4 h-4" />
//             Importar
//           </button>
//           <button
//             onClick={() => {
//               setSelectedQuestion(null);
//               setShowCreateModal(true);
//             }}
//             className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
//           >
//             <Plus className="w-4 h-4" />
//             Nueva Pregunta
//           </button>
//         </div>
//       </div>

//       {/* Search and Filters */}
//       <div className="bg-white rounded-lg shadow-sm border p-4">
//         <div className="flex gap-4">
//           <div className="flex-1 relative">
//             <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
//             <input
//               type="text"
//               placeholder="Buscar preguntas..."
//               className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//               value={searchTerm}
//               onChange={(e) => setSearchTerm(e.target.value)}
//             />
//           </div>
//           <button
//             onClick={() => setShowFilters(!showFilters)}
//             className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
//           >
//             <Filter className="w-4 h-4" />
//             Filtros
//           </button>
//         </div>

//         {/* Expanded Filters */}
//         {showFilters && (
//           <div className="mt-4 pt-4 border-t grid grid-cols-5 gap-4">
//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
//               <select
//                 className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 value={localFilters.type}
//                 onChange={(e) => setLocalFilters({...localFilters, type: e.target.value})}
//               >
//                 <option value="">Todos</option>
//                 <option value="multiple_choice">Opción Múltiple</option>
//                 <option value="true_false">Verdadero/Falso</option>
//                 <option value="open_text">Texto Abierto</option>
//                 <option value="listening">Comprensión Auditiva</option>
//                 <option value="speaking">Expresión Oral</option>
//                 <option value="reading">Comprensión Lectora</option>
//                 <option value="writing">Expresión Escrita</option>
//               </select>
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-1">Competencia</label>
//               <select
//                 className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 value={localFilters.competency}
//                 onChange={(e) => setLocalFilters({...localFilters, competency: e.target.value})}
//               >
//                 <option value="">Todas</option>
//                 <option value="reading">Lectura</option>
//                 <option value="writing">Escritura</option>
//                 <option value="listening">Escucha</option>
//                 <option value="speaking">Habla</option>
//                 <option value="grammar">Gramática</option>
//                 <option value="vocabulary">Vocabulario</option>
//               </select>
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-1">Nivel</label>
//               <select
//                 className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 value={localFilters.level}
//                 onChange={(e) => setLocalFilters({...localFilters, level: e.target.value})}
//               >
//                 <option value="">Todos</option>
//                 <option value="A1">A1</option>
//                 <option value="A2">A2</option>
//                 <option value="B1">B1</option>
//                 <option value="B2">B2</option>
//                 <option value="C1">C1</option>
//                 <option value="C2">C2</option>
//               </select>
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-1">Dificultad</label>
//               <select
//                 className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 value={localFilters.difficulty}
//                 onChange={(e) => setLocalFilters({...localFilters, difficulty: Number(e.target.value)})}
//               >
//                 <option value="0">Todas</option>
//                 <option value="1">Muy Fácil</option>
//                 <option value="2">Fácil</option>
//                 <option value="3">Medio</option>
//                 <option value="4">Difícil</option>
//                 <option value="5">Muy Difícil</option>
//               </select>
//             </div>
//             <div className="flex items-end gap-2">
//               <button
//                 onClick={handleApplyFilters}
//                 className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
//               >
//                 Aplicar
//               </button>
//               <button
//                 onClick={handleClearFilters}
//                 className="px-4 py-2 border rounded-lg hover:bg-gray-50"
//               >
//                 Limpiar
//               </button>
//             </div>
//           </div>
//         )}
//       </div>

//       {/* Questions Table */}
//       <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
//         {loading ? (
//           <div className="p-8 text-center">
//             <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
//             <p className="mt-2 text-gray-500">Cargando preguntas...</p>
//           </div>
//         ) : error ? (
//           <div className="p-8 text-center">
//             <p className="text-red-600">{error}</p>
//             <button
//               onClick={loadQuestions}
//               className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
//             >
//               Reintentar
//             </button>
//           </div>
//         ) : questions.length === 0 ? (
//           <div className="p-8 text-center">
//             <p className="text-gray-500">No se encontraron preguntas</p>
//           </div>
//         ) : (
//           <>
//             <table className="w-full">
//               <thead className="bg-gray-50 border-b">
//                 <tr>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Pregunta
//                   </th>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Tipo
//                   </th>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Competencia
//                   </th>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Nivel
//                   </th>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Dificultad
//                   </th>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Media
//                   </th>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Estado
//                   </th>
//                   <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Acciones
//                   </th>
//                 </tr>
//               </thead>
//               <tbody className="bg-white divide-y divide-gray-200">
//                 {questions.map((question) => (
//                   <tr key={question._id} className="hover:bg-gray-50">
//                     <td className="px-6 py-4">
//                       <div className="text-sm text-gray-900 line-clamp-2">
//                         {question.content.question}
//                       </div>
//                     </td>
//                     <td className="px-6 py-4">
//                       <div className="flex items-center gap-2">
//                         {getQuestionTypeIcon(question.type)}
//                         <span className="text-sm text-gray-600">
//                           {getQuestionTypeLabel(question.type)}
//                         </span>
//                       </div>
//                     </td>
//                     <td className="px-6 py-4">
//                       <span className="text-sm text-gray-600 capitalize">
//                         {question.competency}
//                       </span>
//                     </td>
//                     <td className="px-6 py-4">
//                       <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
//                         {question.level}
//                       </span>
//                     </td>
//                     <td className="px-6 py-4">
//                       <span className={`px-2 py-1 text-xs font-medium rounded ${getDifficultyColor(question.difficulty)}`}>
//                         {getDifficultyLabel(question.difficulty)}
//                       </span>
//                     </td>
//                     <td className="px-6 py-4">
//                       <div className="flex items-center gap-2">
//                         {question.content.mediaUrl && question.content.mediaType === 'audio' && (
//                           <Volume2 className="w-4 h-4 text-gray-400" />
//                         )}
//                         {question.content.mediaUrl && question.content.mediaType === 'image' && (
//                           <ImageIcon className="w-4 h-4 text-gray-400" />
//                         )}
//                       </div>
//                     </td>
//                     <td className="px-6 py-4">
//                       <span className={`px-2 py-1 text-xs font-medium rounded ${
//                         question.isActive 
//                           ? 'bg-green-100 text-green-800' 
//                           : 'bg-gray-100 text-gray-800'
//                       }`}>
//                         {question.isActive ? 'Activa' : 'Inactiva'}
//                       </span>
//                     </td>
//                     <td className="px-6 py-4 text-right">
//                       <div className="flex items-center justify-end gap-2">
//                         <button
//                           onClick={() => handleEdit(question)}
//                           className="p-1 hover:bg-gray-100 rounded"
//                           title="Editar"
//                         >
//                           <Edit className="w-4 h-4 text-gray-600" />
//                         </button>
//                         <button
//                           onClick={() => handleDelete(question._id!)}
//                           className="p-1 hover:bg-gray-100 rounded"
//                           title="Eliminar"
//                         >
//                           <Trash2 className="w-4 h-4 text-red-600" />
//                         </button>
//                       </div>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>

//             {/* Pagination */}
//             <div className="px-6 py-4 border-t flex items-center justify-between">
//               <div className="text-sm text-gray-700">
//                 Mostrando {((currentPage - 1) * 10) + 1} a {Math.min(currentPage * 10, totalItems)} de {totalItems} preguntas
//               </div>
//               <div className="flex items-center gap-2">
//                 <button
//                   onClick={() => changePage(currentPage - 1)}
//                   disabled={currentPage === 1}
//                   className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
//                 >
//                   <ChevronLeft className="w-4 h-4" />
//                 </button>
//                 <div className="flex gap-1">
//                   {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
//                     <button
//                       key={page}
//                       onClick={() => changePage(page)}
//                       className={`px-3 py-1 rounded-lg ${
//                         page === currentPage
//                           ? 'bg-blue-600 text-white'
//                           : 'hover:bg-gray-50'
//                       }`}
//                     >
//                       {page}
//                     </button>
//                   ))}
//                 </div>
//                 <button
//                   onClick={() => changePage(currentPage + 1)}
//                   disabled={currentPage === totalPages}
//                   className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
//                 >
//                   <ChevronRight className="w-4 h-4" />
//                 </button>
//               </div>
//             </div>
//           </>
//         )}
//       </div>

//       {/* Modals */}
//       {showCreateModal && (
//         <QuestionDetailModal
//           question={selectedQuestion}
//           onClose={() => {
//             setShowCreateModal(false);
//             setSelectedQuestion(null);
//           }}
//           onSave={() => {
//             setShowCreateModal(false);
//             setSelectedQuestion(null);
//             loadQuestions();
//           }}
//         />
//       )}

//       {showImportModal && (
//         <ImportModal
//           onClose={() => setShowImportModal(false)}
//           onImport={() => {
//             setShowImportModal(false);
//             loadQuestions();
//           }}
//         />
//       )}
//     </div>
//   );
// };

// export default QuestionsList;
