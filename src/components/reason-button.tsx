import { useState } from "react";
import { Ban } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Compact reason-capture popover used for declining proposals or cancelling
 * accepted items. Keeps the destructive action one click away while still
 * letting the partner add context that surfaces in their notifications.
 */
export function ReasonButton({ label, placeholder, onSubmit, icon, compact }: {
  label: string;
  placeholder: string;
  onSubmit: (reason: string) => void;
  icon?: React.ReactNode;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setReason(""); }}>
      <PopoverTrigger asChild>
        {compact ? (
          <button aria-label={label} title={label} className="text-muted-foreground hover:text-destructive">
            {icon ?? <Ban className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <button className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-destructive">
            {label}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2">
        <p className="text-sm font-medium">{label}</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholder}
          maxLength={300}
          rows={3}
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none"
        />
        <div className="flex justify-end gap-2">
          <button onClick={() => setOpen(false)} className="rounded-full border border-border bg-background px-3 py-1 text-xs">Back</button>
          <button
            onClick={() => { onSubmit(reason.trim()); setOpen(false); setReason(""); }}
            className="rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground"
          >
            Confirm {label.toLowerCase()}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
