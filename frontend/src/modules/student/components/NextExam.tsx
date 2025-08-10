import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/atoms/card";
import GradientWrapper from "@/components/background/GrandWrapperSection";
import { Calendar, Clock, Play } from "lucide-react";
import { Badge } from "@/components/atoms/badge";

import { Button } from "@/components/atoms/button";

interface PropsNextExam {
  studentData: {
    nextExam: {
      id: number;
      name: string;
      date: string;
      time: string;
      duration: string;
      level: string;
    };
  };
  formatDate: (date: string) => string;
  handleStartExam: (examId: number) => void;
}
const NextExam = ({
  studentData,
  formatDate,
  handleStartExam,
}: PropsNextExam) => {
  return (
    <GradientWrapper
      intensity="low"
      size="lg"
      position="bottom-left"
      animate={false}
      variant="cosmic"
    >
      <Card className="bg-box backdrop-blur-sm border border-line">
        <CardHeader className="space-y-2 border-b border-line pb-4">
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="h-6 w-6 text-brand-gray bg-gray-800 rounded-full p-1" />
            Próximo Examen
          </CardTitle>
          <CardDescription className="text-brand-gray text-xs">
            Tu siguiente evaluación programada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 transition-all py-6">
          <div className="border border-line rounded-lg p-4  transition-colors thin-border">
            <h3 className="text-md font-semibold text-white mb-2">
              {studentData.nextExam.name}
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-300 mb-4">
              <div className="flex items-center gap-2 font-extralight">
                <Calendar className="h-4 w-4" />
                {formatDate(studentData.nextExam.date)}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-6 w-6 text-brand-gray bg-gray-800 rounded-full p-1" />
                <p className="font-extralight">{studentData.nextExam.time}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <Badge
                variant="secondary"
                className="bg-blue-500/10 text-blue-300"
              >
                Nivel {studentData.nextExam.level}
              </Badge>
              <Badge
                variant="secondary"
                className="bg-gray-500/20 text-gray-300"
              >
                {studentData.nextExam.duration}
              </Badge>
            </div>
            {/* Teacher ficticio */}
            <div className="flex items-center gap-2 mb-4">
              <img
                src="https://randomuser.me/api/portraits/men/32.jpg"
                alt="Teacher"
                className="w-8 h-8 rounded-full border border-gray-700"
              />
              <span className="text-sm text-gray-300">
                Profesor:{" "}
                <span className="font-semibold text-white">Juan Pérez</span>
              </span>
            </div>
            <Button
              onClick={() => {
                document.getElementById("start-exam-button")?.scrollIntoView({
                  behavior: "smooth",
                });
                setTimeout(() => {
                  handleStartExam(studentData.nextExam.id);
                }, 2000);
              }}
              id="start-exam-button"
              className="text-white hover:bg-blue-600 bg-blue-500 cursor-pointer"
            >
              <Play className="h-4 w-4 mr-2" />
              Iniciar Examen
            </Button>
          </div>
        </CardContent>
      </Card>
    </GradientWrapper>
  );
};

export default NextExam;
