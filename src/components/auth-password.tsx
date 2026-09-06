"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { authInputClass } from "@/components/auth-shell";

export function AuthPassword({ value, onChange, newPassword = false }: { value: string; onChange: (value: string) => void; newPassword?: boolean }) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">Password</label>
      <div className="relative">
        <input id={id} name="password" type={visible ? "text" : "password"} required minLength={newPassword ? 8 : undefined} autoComplete={newPassword ? "new-password" : "current-password"} value={value} onChange={(event) => onChange(event.target.value)} className={`${authInputClass} pr-12`} placeholder={newPassword ? "At least 8 characters" : "Enter your password"} />
        <button type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted-foreground hover:text-foreground focus-visible:outline-ring">{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
      </div>
    </div>
  );
}
