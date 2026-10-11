import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/keel/select";
import { MCER_LEVELS, MCER_LEVEL_DESCRIPTIONS, type MCERLevel } from "../../constants/academic.constants";

interface MCERLevelSelectorProps {
  value?: MCERLevel;
  onValueChange: (value: MCERLevel) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showDescriptions?: boolean;
}

const MCERLevelSelector = ({
  value,
  onValueChange,
  placeholder = "Seleccionar nivel MCER",
  disabled = false,
  className = "",
  showDescriptions = true
}: MCERLevelSelectorProps) => {
  return (
    <Select
      value={value ?? null}
      onValueChange={(v) => v && onValueChange(v)}
      disabled={disabled}
    >
      <SelectTrigger className={`w-full ${className}`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {MCER_LEVELS.map((level) => (
          <SelectItem
            key={level}
            value={level}
          >
            <div className="flex flex-col">
              <span className="font-medium">{level}</span>
              {showDescriptions && (
                <span className="text-xs text-muted-foreground">
                  {MCER_LEVEL_DESCRIPTIONS[level]}
                </span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default MCERLevelSelector;