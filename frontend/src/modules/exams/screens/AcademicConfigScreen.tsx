import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/keel/item";
import { MainLayout, Page, PageHeader } from "@/components/layout";
import { Award, BarChart3, BookOpen, ChevronRight, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";

const configOptions = [
  {
    title: "Niveles MCER",
    description: "Gestionar niveles del Marco Común Europeo de Referencia para lenguas",
    icon: BarChart3,
    path: "/levels",
  },
  {
    title: "Rúbricas de Evaluación",
    description: "Crear y gestionar rúbricas de calificación por competencia lingüística",
    icon: Award,
    path: "/rubrics",
  },
  {
    title: "Banco de Preguntas",
    description: "Administrar preguntas multimodal: audio, texto, imagen y más",
    icon: HelpCircle,
    path: "/questions",
  },
  {
    title: "Gestión de Exámenes",
    description: "Configurar exámenes, sesiones y asignación de candidatos",
    icon: BookOpen,
    path: "/exams",
  },
];

const AcademicConfigScreen = () => {
  return (
    <MainLayout>
      <Page>
        <PageHeader title="Configuración Académica" description="Niveles · Rúbricas · Preguntas · Exámenes" />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {configOptions.map(({ path, title, description, icon: Icon }) => (
            <Item key={path} variant="outline" className="bg-card hover:bg-muted/50" render={<Link to={path} />}>
              <ItemMedia variant="icon">
                <Icon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{title}</ItemTitle>
                <ItemDescription>{description}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <ChevronRight className="size-4 text-muted-foreground" />
              </ItemActions>
            </Item>
          ))}
        </div>
      </Page>
    </MainLayout>
  );
};

export default AcademicConfigScreen;
