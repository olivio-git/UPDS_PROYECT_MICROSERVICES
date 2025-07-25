# 🎨 Guía de Componentes UI - CBA Platform

## 📋 Índice
1. [Sistema de Temas](#sistema-de-temas)
2. [Componentes Educativos](#componentes-educativos)
3. [Gradiente de Fondo](#gradiente-de-fondo)
4. [Estilos CSS Personalizados](#estilos-css-personalizados)
5. [Ejemplos de Uso](#ejemplos-de-uso)

---

## 🌙 Sistema de Temas

### ThemeProvider y ThemeToggle

El sistema incluye soporte completo para modo claro/oscuro:

```tsx
import { ThemeProvider } from '@/context/ThemeContext';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

// En tu main.tsx
<ThemeProvider>
  <App />
</ThemeProvider>

// En cualquier componente
<ThemeToggle size="lg" className="fixed top-4 right-4" />
```

### Usando el hook useTheme

```tsx
import { useTheme } from '@/context/ThemeContext';

function MyComponent() {
  const { theme, toggleTheme, setTheme } = useTheme();
  
  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-black'}>
      <button onClick={toggleTheme}>Cambiar tema</button>
    </div>
  );
}
```

---

## 🎓 Componentes Educativos

### MCERBadge - Niveles del Marco Común Europeo

```tsx
import { MCERBadge } from '@/components/ui/MCERBadge';

// Ejemplos básicos
<MCERBadge level="A1" />
<MCERBadge level="B2" size="lg" />
<MCERBadge level="C1" size="sm" className="mx-2" />
```

**Niveles disponibles:** A1, A2, B1, B2, C1, C2
**Tamaños:** sm, md (default), lg

### CompetencyIndicator - Indicadores de Competencias

```tsx
import { CompetencyIndicator } from '@/components/ui/MCERBadge';

// Ejemplos completos
<CompetencyIndicator 
  competency="listening" 
  score={85} 
  level="B2" 
/>

<CompetencyIndicator 
  competency="writing" 
  score={78} 
/>
```

**Competencias disponibles:**
- `listening` - Comprensión Auditiva (🎧)
- `reading` - Comprensión Lectora (📖)  
- `writing` - Expresión Escrita (✍️)
- `speaking` - Expresión Oral (🗣️)

---

## 📊 Componentes de Estadísticas

### EducationalStats - Panel de Estadísticas

```tsx
import { EducationalStats } from '@/components/ui/EducationalStats';

<EducationalStats 
  totalStudents={125}
  activeExams={8}
  completedEvaluations={342}
  averageScore={78}
/>
```

### LevelDistribution - Distribución por Niveles

```tsx
import { LevelDistribution } from '@/components/ui/EducationalStats';

const data = [
  { level: 'A1', count: 25, percentage: 20 },
  { level: 'B1', count: 30, percentage: 24 },
  // ...más niveles
];

<LevelDistribution data={data} />
```

### RecentActivity - Actividad Reciente

```tsx
import { RecentActivity } from '@/components/ui/EducationalStats';

const activities = [
  {
    id: '1',
    type: 'exam',
    description: 'Nuevo examen B2 programado',
    timestamp: 'Hace 2 horas',
    user: 'Prof. María González'
  },
  // ...más actividades
];

<RecentActivity activities={activities} />
```

**Tipos de actividad:** `exam`, `registration`, `completion`

---

## 🎨 Gradiente de Fondo Mejorado

### GradientBackground

El nuevo componente incluye:
- ✅ Soporte automático para modo claro/oscuro
- ✅ Elementos flotantes educativos (libros, globos, graduación)
- ✅ Iconos específicos de competencias lingüísticas
- ✅ Letras flotantes representando niveles (A, B, C)
- ✅ Orbes de luz adaptativos
- ✅ Partículas animadas
- ✅ Patrones de cuadrícula sutiles

```tsx
import GradientBackground from '@/modules/home/screens/GradientBackground';

// Uso simple - se adapta automáticamente al tema
<GradientBackground />
```

---

## 🎯 Clases CSS Personalizadas

### Colores de Niveles MCER

```css
/* Fondos */
.bg-level-a1 /* Celeste claro - A1 */
.bg-level-a2 /* Celeste medio - A2 */
.bg-level-b1 /* Verde claro - B1 */
.bg-level-b2 /* Verde medio - B2 */
.bg-level-c1 /* Amarillo dorado - C1 */
.bg-level-c2 /* Naranja - C2 */

/* Textos */
.text-level-a1, .text-level-a2, etc.
```

### Colores de Competencias

```css
/* Fondos */
.bg-listening /* Púrpura - Comprensión auditiva */
.bg-reading   /* Azul - Comprensión lectora */
.bg-writing   /* Verde - Expresión escrita */
.bg-speaking  /* Naranja - Expresión oral */

/* Textos */
.text-listening, .text-reading, etc.
```

### Colores de Estado

```css
.bg-success       /* Verde - Aprobado */
.bg-warning       /* Amarillo - En progreso */
.bg-destructive   /* Rojo - Error/Reprobado */
```

### Gradientes Personalizados

```css
.bg-gradient-learning  /* Gradiente educativo */
.bg-gradient-success   /* Gradiente de éxito */
.bg-gradient-primary   /* Gradiente primario */
.cba-gradient         /* Gradiente específico CBA */
```

### Sombras Educativas

```css
.widget-shadow      /* Sombra para widgets */
.education-shadow   /* Sombra educativa */
.card-shadow        /* Sombra para tarjetas */
```

### Patrones de Fondo

```css
.bg-grid-pattern    /* Patrón de cuadrícula */
.bg-dots-pattern    /* Patrón de puntos */
.bg-waves-pattern   /* Patrón de ondas */
```

### Animaciones Mejoradas

```css
.animate-fade-in    /* Aparición suave */
.animate-slide-in   /* Deslizamiento de entrada */
.animate-float      /* Flotación suave */
.animate-glow       /* Efecto de brillo */
```

### Utilidades Específicas

```css
.level-badge        /* Badge para niveles */
.competency-indicator /* Indicador de competencias */
.typing-animation   /* Efecto de escritura */
.progress-bar       /* Barra de progreso colorida */
```

---

## 🚀 Ejemplo Completo de Dashboard

```tsx
import { DashboardExample } from '@/components/examples/DashboardExample';

// Este componente incluye:
// ✅ Estadísticas educativas
// ✅ Distribución por niveles
// ✅ Actividad reciente  
// ✅ Badges MCER
// ✅ Indicadores de competencias
// ✅ Toggle de tema
// ✅ Gradiente de fondo
// ✅ Acciones rápidas

function MyDashboard() {
  return <DashboardExample />;
}
```

---

## 📱 Responsividad

Todos los componentes están diseñados para ser responsivos:

```tsx
// Grid adaptativo
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  
// Texto adaptativo  
<h1 className="text-xl md:text-2xl lg:text-3xl">

// Espaciado responsivo
<div className="p-4 md:p-6 lg:p-8">
```

---

## 🎯 Mejores Prácticas

### 1. Consistencia de Tema
```tsx
// ✅ Bien - Usar variables CSS
className="bg-background text-foreground"

// ❌ Mal - Colores hardcodeados
className="bg-white text-black"
```

### 2. Composición de Componentes
```tsx
// ✅ Bien - Composable
<Card>
  <CardHeader>
    <CardTitle>Mi Título</CardTitle>
  </CardHeader>
  <CardContent>
    <MCERBadge level="B2" />
  </CardContent>
</Card>
```

### 3. Accesibilidad
```tsx
// ✅ Incluir títulos descriptivos
<MCERBadge level="B2" title="Nivel B2 - Intermedio Alto" />

// ✅ Usar semantic HTML
<main>, <section>, <nav>, etc.
```

### 4. Performance
```tsx
// ✅ Lazy loading para componentes grandes
const DashboardExample = lazy(() => import('@/components/examples/DashboardExample'));
```

---

## 🔧 Personalización Avanzada

### Extender Variables CSS

```css
/* En tu index.css personalizado */
:root {
  --custom-cba-blue: 210 100% 50%;
  --custom-cba-gold: 45 100% 50%;
}

.dark {
  --custom-cba-blue: 210 100% 70%;
  --custom-cba-gold: 45 100% 70%;
}
```

### Crear Variantes Personalizadas

```tsx
// Componente personalizado basado en MCERBadge
function CBALevelBadge({ level, student }: { level: MCERLevel, student: string }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10">
      <MCERBadge level={level} />
      <span className="text-sm font-medium">{student}</span>
    </div>
  );
}
```

---

## 🐛 Troubleshooting

### Problema: Los temas no cambian
```tsx
// Verificar que ThemeProvider esté en el nivel superior
<ThemeProvider>
  <App /> {/* Debe estar dentro del provider */}
</ThemeProvider>
```

### Problema: Componentes no se ven bien
```css
/* Verificar que las variables CSS estén cargadas */
@import "tailwindcss";
/* Debe estar al inicio del index.css */
```

### Problema: Animaciones no funcionan
```tsx
// Verificar que las clases de animación estén aplicadas
className="animate-float" // No animate-float-custom
```

---

## 📚 Recursos Adicionales

- **Iconos**: Lucide React (ya incluido)
- **Colores**: Basados en el sistema de diseño de shadcn/ui
- **Tipografía**: Sistem fonts con fallbacks
- **Documentación MCER**: [Marco Común Europeo](https://www.coe.int/en/web/common-european-framework-reference-languages)

---

## 🆕 Próximas Funcionalidades

- [ ] Componente de cronómetro para exámenes
- [ ] Grabador de audio integrado  
- [ ] Editor de texto con corrección automática
- [ ] Calendario de evaluaciones
- [ ] Chat en tiempo real para soporte
- [ ] Modo de alta contraste para accesibilidad

---

**¡Desarrollado para el Centro Boliviano Americano (CBA) - Tarija!** 🇧🇴📚
