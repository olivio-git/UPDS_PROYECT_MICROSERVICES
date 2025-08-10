import Header from '@/modules/dashboard/components/Header'; 
import GradientBackground from '@/modules/home/screens/GradientBackground';

interface MainLayoutProps {
  children: any;
  showGradient?: boolean;
  gradientVariant?: any;
  // gradientVariant?: GradientVariant; 
  className?: string;
}

const MainLayout = ({ 
  children, 
  showGradient = true, 
  // gradientVariant = 'primary',
  className = '' 
}: MainLayoutProps) => {
  return (
    <div className="min-h-screen relative"> 
      {showGradient && (
        <GradientBackground 
          grid={false}
          lights={true}
          size='sm'
        />
      )}
      
      {/* Header */}
      <Header />
      
      {/* Main Content */}
      <main className={`pt-20 px-4 ${className}`}>
        {children}
      </main>
    </div>
  );
};

export default MainLayout;