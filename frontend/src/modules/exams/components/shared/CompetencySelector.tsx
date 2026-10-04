import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/keel/select";
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
      value={value ?? null}
      onValueChange={(v) => v && onValueChange(v)}
      items={COMPETENCY_LABELS}
      disabled={disabled}
    >
      <SelectTrigger className={`w-full ${className}`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {COMPETENCIES.map((competency) => (
          <SelectItem
            key={competency}
            value={competency}
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