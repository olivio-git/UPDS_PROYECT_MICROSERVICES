import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { Progress } from '@/components/atoms/progress';
import { Badge } from '@/components/atoms/badge';

interface EducationalStatsProps {
  totalStudents?: number;
  activeExams?: number;
  completedEvaluations?: number;
  averageScore?: number;
  className?: string;
}

export function EducationalStats({ 
  totalStudents = 0,
  activeExams = 0,
  completedEvaluations = 0,
  averageScore = 0,
  className = ''
}: EducationalStatsProps) {
  
  const statsData = [
    {
      title: 'Estudiantes Registrados',
      value: totalStudents,
      icon: '👥',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    {
      title: 'Exámenes Activos',
      value: activeExams,
      icon: '📝',
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    },
    {
      title: 'Evaluaciones Completadas',
      value: completedEvaluations,
      icon: '✅',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20'
    },
    {
      title: 'Promedio General',
      value: `${averageScore}%`,
      icon: '📊',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20'
    }
  ];

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {statsData.map((stat, index) => (
        <Card key={index} className="border-border/50 hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </p>
                <p className={`text-2xl font-bold ${stat.color}`}>
                  {stat.value}
                </p>
              </div>
              <div className={`
                w-12 h-12 rounded-full ${stat.bgColor} 
                flex items-center justify-center text-xl
              `}>
                {stat.icon}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface LevelDistributionProps {
  data: {
    level: string;
    count: number;
    percentage: number;
  }[];
  className?: string;
}

export function LevelDistribution({ data, className = '' }: LevelDistributionProps) {
  const levelColors = {
    'A1': 'bg-level-a1',
    'A2': 'bg-level-a2', 
    'B1': 'bg-level-b1',
    'B2': 'bg-level-b2',
    'C1': 'bg-level-c1',
    'C2': 'bg-level-c2'
  };

  return (
    <Card className={`border-border/50 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📈 Distribución por Niveles MCER
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.map((item) => (
          <div key={item.level} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge 
                  className={`
                    ${levelColors[item.level as keyof typeof levelColors]} 
                    text-slate-800 border-0
                  `}
                >
                  {item.level}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {item.count} estudiantes
                </span>
              </div>
              <span className="text-sm font-medium">
                {item.percentage}%
              </span>
            </div>
            <Progress 
              value={item.percentage} 
              className="h-2"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

interface RecentActivityProps {
  activities: {
    id: string;
    type: 'exam' | 'registration' | 'completion';
    description: string;
    timestamp: string;
    user?: string;
  }[];
  className?: string;
}

export function RecentActivity({ activities, className = '' }: RecentActivityProps) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'exam': return '📝';
      case 'registration': return '👤';
      case 'completion': return '✅';
      default: return '📌';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'exam': return 'text-blue-600';
      case 'registration': return 'text-green-600';
      case 'completion': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Card className={`border-border/50 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🕒 Actividad Reciente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
              <div className={`
                w-8 h-8 rounded-full bg-background border-2 border-border
                flex items-center justify-center text-sm
                ${getActivityColor(activity.type)}
              `}>
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">
                  {activity.description}
                </p>
                {activity.user && (
                  <p className="text-xs text-muted-foreground">
                    Por: {activity.user}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {activity.timestamp}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
