import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ExamLobby } from '@/modules/student/screens';

// Hook personalizado para navegación
export const useAppNavigation = () => {
  const navigateToLobby = (sessionId: string) => {
    // Crear URL del lobby
    const lobbyUrl = `/student/exam/${sessionId}/lobby`;
    window.location.href = lobbyUrl;
  };

  const navigateToExam = (sessionId: string) => {
    const examUrl = `/student/exam/${sessionId}/run`;
    window.location.href = examUrl;
  };

  const navigateToPreparation = (sessionId: string) => {
    const prepUrl = `/student/exam/${sessionId}/prepare`;
    window.location.href = prepUrl;
  };

  return {
    navigateToLobby,
    navigateToExam,
    navigateToPreparation
  };
};

// Función helper para abrir el lobby en nueva ventana
export const openLobbyInNewWindow = (sessionId: string) => {
  const lobbyUrl = `/student/exam/${sessionId}/lobby`;
  window.open(lobbyUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
};
