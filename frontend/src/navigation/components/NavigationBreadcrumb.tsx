import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { protectedRoutes } from '../Protected.Route';

interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: React.ReactNode;
}

export const NavigationBreadcrumb: React.FC = () => {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  // Generate breadcrumb items based on current path
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const breadcrumbs: BreadcrumbItem[] = [
      { label: 'Inicio', path: '/', icon: <Home className="w-4 h-4" /> }
    ];

    let currentPath = '';
    
    for (let i = 0; i < pathSegments.length; i++) {
      currentPath += `/${pathSegments[i]}`;
      
      // Find matching route
      const route = protectedRoutes.find(r => {
        // Handle parameterized routes
        const routePattern = r.path.replace(/:[\w]+/g, '[^/]+');
        const regex = new RegExp(`^${routePattern}$`);
        return regex.test(currentPath);
      });

      if (route) {
        const isLast = i === pathSegments.length - 1;
        breadcrumbs.push({
          label: route.name,
          path: isLast ? undefined : currentPath, // Don't make last item clickable
          icon: route.icon ? React.createElement(route.icon, { className: 'w-4 h-4' }) : undefined
        });
      } else {
        // For segments without matching routes, use segment name
        const segmentName = pathSegments[i]
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        breadcrumbs.push({
          label: segmentName,
          path: i === pathSegments.length - 1 ? undefined : currentPath
        });
      }
    }

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  // Don't show breadcrumbs for home page or very simple paths
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
      {breadcrumbs.map((crumb, index) => (
        <div key={index} className="flex items-center">
          {index > 0 && (
            <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
          )}
          
          <div className="flex items-center space-x-1">
            {crumb.icon}
            
            {crumb.path ? (
              <Link
                to={crumb.path}
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {crumb.label}
              </span>
            )}
          </div>
        </div>
      ))}
    </nav>
  );
};

export default NavigationBreadcrumb;