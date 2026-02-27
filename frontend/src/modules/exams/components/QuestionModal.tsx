// import React, { useState, useEffect } from 'react';
// import { X, Trash2, Plus, Volume2, Image as ImageIcon } from 'lucide-react';
// import type { Question, QuestionType, Competency, Level, QuestionOption } from '../types';
// import { useQuestions } from '../hooks/useQuestions';

// interface QuestionModalProps {
//   question: Question | null;
//   onClose: () => void;
//   onSave: () => void;
// }

// const QuestionModal: React.FC<QuestionModalProps> = ({ question, onClose, onSave }) => {
//   const { createQuestion, updateQuestion, uploadAudio, uploadImage } = useQuestions();
  
//   const [formData, setFormData] = useState<Partial<Question>>({
//     type: 'multiple_choice',
//     competency: 'reading',
//     level: 'A1',
//     difficulty: 3,
//     content: {
//       question: '',
//       instructions: '',
//       options: [],
//       correctAnswer: ''
//     },
//     points: 1,
//     tags: [],
//     isActive: true
//   });

//   const [audioFile, setAudioFile] = useState<File | null>(null);
//   const [imageFile, setImageFile] = useState<File | null>(null);
//   const [newOption, setNewOption] = useState('');
//   const [tagInput, setTagInput] = useState('');

//   useEffect(() => {
//     if (question) {
//       setFormData(question);
//     }
//   }, [question]);

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
    
//     try {
//       let savedQuestion;
      
//       if (question?._id) {
//         savedQuestion = await updateQuestion(question._id, formData);
//       } else {
//         savedQuestion = await createQuestion(formData);
//       }

//       // Subir archivos multimedia si existen
//       if (savedQuestion?._id) {
//         if (audioFile) {
//           await uploadAudio(savedQuestion._id, audioFile);
//         }
//         if (imageFile) {
//           await uploadImage(savedQuestion._id, imageFile);
//         }
//       }

//       onSave();
//     } catch (error) {
//       console.error('Error saving question:', error);
//     }
//   };

//   const addOption = () => {
//     if (!newOption.trim()) return;
    
//     const option: QuestionOption = {
//       id: Date.now().toString(),
//       text: newOption,
//       isCorrect: false
//     };

//     setFormData(prev => ({
//       ...prev,
//       content: {
//         ...prev.content!,
//         options: [...(prev.content?.options || []), option]
//       }
//     }));
//     setNewOption('');
//   };

//   const removeOption = (id: string) => {
//     setFormData(prev => ({
//       ...prev,
//       content: {
//         ...prev.content!,
//         options: prev.content?.options?.filter(opt => opt.id !== id) || []
//       }
//     }));
//   };

//   const setCorrectOption = (id: string) => {
//     setFormData(prev => ({
//       ...prev,
//       content: {
//         ...prev.content!,
//         options: prev.content?.options?.map(opt => ({
//           ...opt,
//           isCorrect: opt.id === id
//         })) || [],
//         correctAnswer: id
//       }
//     }));
//   };

//   const addTag = () => {
//     if (!tagInput.trim()) return;
    
//     setFormData(prev => ({
//       ...prev,
//       tags: [...(prev.tags || []), tagInput.trim()]
//     }));
//     setTagInput('');
//   };

//   const removeTag = (index: number) => {
//     setFormData(prev => ({
//       ...prev,
//       tags: prev.tags?.filter((_, i) => i !== index) || []
//     }));
//   };

//   const needsOptions = ['multiple_choice', 'true_false'].includes(formData.type as string);
//   const needsMedia = ['listening', 'speaking'].includes(formData.type as string);

//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
//       <div className="bg-box rounded-lg w-full max-w-4xl max-h-[80vh] overflow-y-auto">
//         {/* Header */}
//         <div className="flex items-center justify-between p-4 border-b">
//           <h2 className="text-xl font-semibold">
//             {question ? 'Editar Pregunta' : 'Nueva Pregunta'}
//           </h2>
//           <button
//             onClick={onClose}
//             className="p-2 hover:bg-gray-100 rounded-lg"
//           >
//             <X className="w-5 h-5" />
//           </button>
//         </div>

//         {/* Form */}
//         <form onSubmit={handleSubmit} className="p-6 space-y-6">
//           {/* Basic Info */}
//           <div className="grid grid-cols-3 gap-2">
//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-1">
//                 Tipo de Pregunta
//               </label>
//               <select
//                 value={formData.type}
//                 onChange={(e) => setFormData({...formData, type: e.target.value as QuestionType})}
//                 className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 required
//               >
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
//               <label className="block text-sm font-medium text-gray-700 mb-1">
//                 Competencia
//               </label>
//               <select
//                 value={formData.competency}
//                 onChange={(e) => setFormData({...formData, competency: e.target.value as Competency})}
//                 className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 required
//               >
//                 <option value="reading">Lectura</option>
//                 <option value="writing">Escritura</option>
//                 <option value="listening">Escucha</option>
//                 <option value="speaking">Habla</option>
//                 <option value="grammar">Gramática</option>
//                 <option value="vocabulary">Vocabulario</option>
//               </select>
//             </div>

//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-1">
//                 Nivel MCER
//               </label>
//               <select
//                 value={formData.level}
//                 onChange={(e) => setFormData({...formData, level: e.target.value as Level})}
//                 className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 required
//               >
//                 <option value="A1">A1 - Principiante</option>
//                 <option value="A2">A2 - Elemental</option>
//                 <option value="B1">B1 - Intermedio</option>
//                 <option value="B2">B2 - Intermedio Alto</option>
//                 <option value="C1">C1 - Avanzado</option>
//                 <option value="C2">C2 - Maestría</option>
//               </select>
//             </div>
//           </div>

//           <div className="grid grid-cols-3 gap-4">
//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-1">
//                 Dificultad
//               </label>
//               <select
//                 value={formData.difficulty}
//                 onChange={(e) => setFormData({...formData, difficulty: Number(e.target.value)})}
//                 className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 required
//               >
//                 <option value={1}>Muy Fácil</option>
//                 <option value={2}>Fácil</option>
//                 <option value={3}>Medio</option>
//                 <option value={4}>Difícil</option>
//                 <option value={5}>Muy Difícil</option>
//               </select>
//             </div>

//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-1">
//                 Puntos
//               </label>
//               <input
//                 type="number"
//                 min="1"
//                 value={formData.points}
//                 onChange={(e) => setFormData({...formData, points: Number(e.target.value)})}
//                 className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 required
//               />
//             </div>

//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-1">
//                 Estado
//               </label>
//               <select
//                 value={formData.isActive ? 'true' : 'false'}
//                 onChange={(e) => setFormData({...formData, isActive: e.target.value === 'true'})}
//                 className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//               >
//                 <option value="true">Activa</option>
//                 <option value="false">Inactiva</option>
//               </select>
//             </div>
//           </div>

//           {/* Question Content */}
//           <div>
//             <label className="block text-sm font-medium text-gray-700 mb-1">
//               Pregunta *
//             </label>
//             <textarea
//               value={formData.content?.question}
//               onChange={(e) => setFormData({
//                 ...formData,
//                 content: { ...formData.content!, question: e.target.value }
//               })}
//               className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//               rows={3}
//               required
//             />
//           </div>

//           <div>
//             <label className="block text-sm font-medium text-gray-700 mb-1">
//               Instrucciones (opcional)
//             </label>
//             <textarea
//               value={formData.content?.instructions}
//               onChange={(e) => setFormData({
//                 ...formData,
//                 content: { ...formData.content!, instructions: e.target.value }
//               })}
//               className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//               rows={2}
//             />
//           </div>

//           {/* Options for Multiple Choice */}
//           {needsOptions && (
//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-2">
//                 Opciones de Respuesta
//               </label>
              
//               {/* Add Option */}
//               <div className="flex gap-2 mb-3">
//                 <input
//                   type="text"
//                   value={newOption}
//                   onChange={(e) => setNewOption(e.target.value)}
//                   onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
//                   placeholder="Escribe una opción..."
//                   className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 />
//                 <button
//                   type="button"
//                   onClick={addOption}
//                   className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
//                 >
//                   <Plus className="w-4 h-4" />
//                   Agregar
//                 </button>
//               </div>

//               {/* Options List */}
//               <div className="space-y-2">
//                 {formData.content?.options?.map((option) => (
//                   <div key={option.id} className="flex items-center gap-2 p-2 border rounded-lg">
//                     <input
//                       type="radio"
//                       name="correctOption"
//                       checked={option.isCorrect}
//                       onChange={() => setCorrectOption(option.id)}
//                       className="w-4 h-4 text-blue-600"
//                     />
//                     <span className="flex-1">{option.text}</span>
//                     <button
//                       type="button"
//                       onClick={() => removeOption(option.id)}
//                       className="p-1 hover:bg-gray-100 rounded"
//                     >
//                       <Trash2 className="w-4 h-4 text-red-600" />
//                     </button>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           )}

//           {/* Media Upload */}
//           {needsMedia && (
//             <div className="space-y-4">
//               {/* Audio Upload */}
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                   Archivo de Audio
//                 </label>
//                 <div className="flex items-center gap-4">
//                   <label className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 cursor-pointer">
//                     <Volume2 className="w-4 h-4" />
//                     <span>Seleccionar Audio</span>
//                     <input
//                       type="file"
//                       accept="audio/*"
//                       onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
//                       className="hidden"
//                     />
//                   </label>
//                   {audioFile && (
//                     <span className="text-sm text-gray-600">{audioFile.name}</span>
//                   )}
//                   {formData.content?.mediaUrl && formData.content.mediaType === 'audio' && (
//                     <audio controls className="max-w-xs">
//                       <source src={formData.content.mediaUrl} type="audio/mpeg" />
//                     </audio>
//                   )}
//                 </div>
//               </div>

//               {/* Image Upload */}
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                   Imagen (opcional)
//                 </label>
//                 <div className="flex items-center gap-4">
//                   <label className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 cursor-pointer">
//                     <ImageIcon className="w-4 h-4" />
//                     <span>Seleccionar Imagen</span>
//                     <input
//                       type="file"
//                       accept="image/*"
//                       onChange={(e) => setImageFile(e.target.files?.[0] || null)}
//                       className="hidden"
//                     />
//                   </label>
//                   {imageFile && (
//                     <span className="text-sm text-gray-600">{imageFile.name}</span>
//                   )}
//                   {formData.content?.mediaUrl && formData.content.mediaType === 'image' && (
//                     <img 
//                       src={formData.content.mediaUrl} 
//                       alt="Preview" 
//                       className="h-20 rounded"
//                     />
//                   )}
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* Tags */}
//           <div>
//             <label className="block text-sm font-medium text-gray-700 mb-2">
//               Etiquetas
//             </label>
//             <div className="flex gap-2 mb-2">
//               <input
//                 type="text"
//                 value={tagInput}
//                 onChange={(e) => setTagInput(e.target.value)}
//                 onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
//                 placeholder="Agregar etiqueta..."
//                 className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//               />
//               <button
//                 type="button"
//                 onClick={addTag}
//                 className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
//               >
//                 Agregar
//               </button>
//             </div>
//             <div className="flex flex-wrap gap-2">
//               {formData.tags?.map((tag, index) => (
//                 <span
//                   key={index}
//                   className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm flex items-center gap-1"
//                 >
//                   {tag}
//                   <button
//                     type="button"
//                     onClick={() => removeTag(index)}
//                     className="hover:text-red-600"
//                   >
//                     <X className="w-3 h-3" />
//                   </button>
//                 </span>
//               ))}
//             </div>
//           </div>

//           {/* Actions */}
//           <div className="flex justify-end gap-3 pt-4 border-t">
//             <button
//               type="button"
//               onClick={onClose}
//               className="px-4 py-2 border rounded-lg hover:bg-gray-50"
//             >
//               Cancelar
//             </button>
//             <button
//               type="submit"
//               className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
//             >
//               {question ? 'Guardar Cambios' : 'Crear Pregunta'}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// };

// export default QuestionModal;
