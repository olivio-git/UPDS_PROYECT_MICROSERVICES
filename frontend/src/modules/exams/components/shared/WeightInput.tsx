import type { ComponentProps } from "react";
import { useState } from "react";
import { Input } from "@/components/atoms/input";
import { parseWeightInput, weightToInputText } from "../../utils/weights";

type NativeInputProps = Omit<ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange" | "step">;

interface WeightInputProps extends NativeInputProps {
  /** Stored weight; NaN means the field is empty or not a number yet. */
  value: number | null | undefined;
  /** Receives the parsed weight on every keystroke (NaN while empty/invalid). */
  onValueChange: (value: number) => void;
}

/**
 * Percentage weight input shared by the exam section and rubric criterion
 * forms. It keeps the raw text while the teacher types, so clearing the field
 * or typing an intermediate decimal ("12.") is never overwritten with "0";
 * the parent receives NaN for an empty/invalid field and must treat it as
 * invalid. On blur a valid value is normalized (e.g. "05" -> "5").
 */
const WeightInput = ({ value, onValueChange, onBlur, ...props }: WeightInputProps) => {
  const [text, setText] = useState(() => weightToInputText(value));
  const [syncedValue, setSyncedValue] = useState(value);

  // External updates (e.g. "Distribuir equitativamente", loading an existing
  // record) replace the text; our own keystrokes already match it.
  if (!Object.is(value, syncedValue)) {
    setSyncedValue(value);
    if (!Object.is(parseWeightInput(text), value)) {
      setText(weightToInputText(value));
    }
  }

  return (
    <Input
      {...props}
      type="number"
      step="any"
      inputMode="decimal"
      value={text}
      aria-invalid={Number.isFinite(parseWeightInput(text)) ? props["aria-invalid"] : true}
      onChange={(e) => {
        const nextText = e.target.value;
        setText(nextText);
        onValueChange(parseWeightInput(nextText));
      }}
      onBlur={(e) => {
        const parsed = parseWeightInput(text);
        if (Number.isFinite(parsed)) setText(String(parsed));
        onBlur?.(e);
      }}
    />
  );
};

export default WeightInput;
