import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/atoms/select";
import { COMPETENCIES, COMPETENCY_LABELS } from "../../constants/academic.constants";
import type { Competency } from "../../types";

interface CompetencySelectorProps {
  value?: Competency;
  onValueChange: (value: Competency) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const CompetencySelector = ({
  value,
  onValueChange,
  placeholder = "Seleccionar competencia",
  disabled = false,
  className = ""
}: CompetencySelectorProps) => {
  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger className={`bg-input border-line text-foreground ${className}`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-box border-line">
        {COMPETENCIES.map((competency) => (
          <SelectItem
            key={competency}
            value={competency}
            className="text-foreground hover:bg-line/50 focus:bg-line/50"
          >
            <div className="flex flex-col">
              <span className="font-medium">{COMPETENCY_LABELS[competency]}</span>
              <span className="text-xs text-muted-foreground capitalize">{competency}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default CompetencySelector;