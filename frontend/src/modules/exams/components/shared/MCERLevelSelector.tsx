import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/atoms/select";
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
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger className={`bg-input border-line text-foreground ${className}`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-box border-line">
        {MCER_LEVELS.map((level) => (
          <SelectItem
            key={level}
            value={level}
            className="text-foreground hover:bg-line/50 focus:bg-line/50"
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