import { useState } from 'react';
import { MainLayout } from '@/components/layout';
import {
  GradientBackground,
  HeroGradientSection,
  ContentGradientSection,
  CardGradientWrapper,
  type GradientVariant,
  type GradientPosition
} from '@/components/background';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/card';
import { Button } from '@/components/atoms/button';
import { Badge } from '@/components/atoms/badge';
import { Palette, Sparkles, Settings, Eye, Layers, Move3D, Zap } from 'lucide-react';

const GradientShowcaseScreen = () => {
  const [selectedVariant, setSelectedVariant] = useState<GradientVariant>('primary');
  const [selectedPosition, setSelectedPosition] = useState<GradientPosition>('center');
  const [selectedIntensity, setSelectedIntensity] = useState<'low' | 'medium' | 'high'>('medium');

  const variants: GradientVariant[] = ['primary', 'secondary', 'accent', 'warm', 'cool', 'aurora', 'sunset'];
  const positions: GradientPosition[] = [
    'top-left', 'top-center', 'top-right',
    'center-left', 'center', 'center-right',
    'bottom-left', 'bottom-center', 'bottom-right'
  ];
  const intensities: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];

  const getVariantDescription = (variant: GradientVariant) => {
    const descriptions = {
      primary: 'Violetas y azules vibrantes - Ideal para secciones principales',
      secondary: 'Verdes y turquesas frescos - Perfecto para contenido secundario',
      accent: 'Rosas y púrpuras intensos - Excelente para elementos destacados',
      warm: 'Naranjas y rojos cálidos - Genial para llamadas a la acción',
      cool: 'Azules y cianes fríos - Ideal para secciones técnicas',
      aurora: 'Mezcla de verdes, azules y púrpuras - Efecto aurora boreal',
      sunset: 'Gradientes cálidos tipo atardecer - Perfecto para headers'
    };
    return descriptions[variant];
  };

  const getVariantColors = (variant: GradientVariant) => {
    const colors = {
      primary: ['bg-violet-500', 'bg-purple-500', 'bg-blue-500'],
      secondary: ['bg-emerald-500', 'bg-teal-500', 'bg-green-500'],
      accent: ['bg-pink-500', 'bg-purple-500', 'bg-rose-500'],
      warm: ['bg-orange-500', 'bg-red-500', 'bg-yellow-500'],
      cool: ['bg-blue-500', 'bg-cyan-500', 'bg-indigo-500'],
      aurora: ['bg-green-400', 'bg-blue-500', 'bg-purple-500'],
      sunset: ['bg-orange-400', 'bg-pink-500', 'bg-purple-500']
    };
    return colors[variant];
  };

  return (
    <MainLayout gradientVariant={selectedVariant} showGradient={true}>
      <div className="max-w-7xl mx-auto space-y-8">
        <HeroGradientSection variant="primary" className="min-h-[60vh] mb-8" decorativeObjects={true}>
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="p-4 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-600/20 border border-purple-500/30">
                <Palette className="h-10 w-10 text-purple-400" />
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              Gradient Showcase
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Explora todas las variantes de fondos con gradientes disponibles en el sistema CBA
            </p>
            <div className="flex items-center justify-center gap-2">
              <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30">
                <Sparkles className="h-3 w-3 mr-1" />
                7 Variantes
              </Badge>
              <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">
                <Move3D className="h-3 w-3 mr-1" />
                9 Posiciones
              </Badge>
              <Badge className="bg-green-500/20 text-green-300 border border-green-500/30">
                <Zap className="h-3 w-3 mr-1" />
                3 Intensidades
              </Badge>
            </div>
          </div>
        </HeroGradientSection>

        <ContentGradientSection variant="secondary" position="top-right">
          <CardGradientWrapper variant="cool" intensity="medium">
            <Card className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Settings className="h-5 w-5 text-blue-400" />
                  Controles de Gradiente
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Experimenta con diferentes configuraciones de gradientes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-300">Variante Activa: {selectedVariant}</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {variants.map((variant) => (
                      <Button
                        key={variant}
                        variant={selectedVariant === variant ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedVariant(variant)}
                        className={`h-auto p-3 flex-col gap-2 ${
                          selectedVariant === variant 
                            ? 'bg-blue-500/20 border-blue-400 text-blue-300' 
                            : 'bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex gap-1">
                          {getVariantColors(variant).map((color, i) => (
                            <div key={i} className={`w-3 h-3 rounded-full ${color}`}></div>
                          ))}
                        </div>
                        <span className="text-xs font-medium capitalize">{variant}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-300">Posición: {selectedPosition}</h3>
                  <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                    {positions.map((position) => {
                      const [y, x] = position.split('-');
                      return (
                        <Button
                          key={position}
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPosition(position)}
                          className={`h-8 text-xs ${
                            selectedPosition === position 
                              ? 'bg-green-500/20 border-green-400 text-green-300' 
                              : 'bg-gray-800/50 border-gray-600 text-gray-400 hover:bg-gray-700/50'
                          }`}
                        >
                          {y[0]?.toUpperCase()}{x ? `-${x[0]?.toUpperCase()}` : ''}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-300">Intensidad: {selectedIntensity}</h3>
                  <div className="flex gap-2">
                    {intensities.map((intensity) => (
                      <Button
                        key={intensity}
                        variant={selectedIntensity === intensity ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedIntensity(intensity)}
                        className={`flex-1 ${
                          selectedIntensity === intensity 
                            ? 'bg-orange-500/20 border-orange-400 text-orange-300' 
                            : 'bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700/50'
                        }`}
                      >
                        {intensity}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </CardGradientWrapper>
        </ContentGradientSection>
      </div>
    </MainLayout>
  );
};

export default GradientShowcaseScreen;
