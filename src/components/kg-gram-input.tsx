import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  kg: string;
  g: string;
  onChange: (kg: string, g: string) => void;
  label?: string;
  required?: boolean;
}

/** Two side-by-side inputs for Kg + Gram. Values are strings for controlled inputs. */
export function KgGramInput({ kg, g, onChange, label = "Quantity", required }: Props) {
  return (
    <div className="space-y-1.5">
      {label && <Label>{label}{required && " *"}</Label>}
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={kg}
          onChange={(e) => onChange(e.target.value, "0")}
          required={required}
          className="min-w-0 tabular-nums"
          placeholder="0"
        />
        <span className="shrink-0 text-xs text-muted-foreground">kg</span>
      </div>
    </div>
  );
}
