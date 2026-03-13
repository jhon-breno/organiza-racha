"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatPhoneInput } from "@/lib/utils";

type PhoneInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

export function PhoneInput({
  defaultValue,
  value,
  onChange,
  ...props
}: PhoneInputProps) {
  const [internalValue, setInternalValue] = React.useState(
    formatPhoneInput(
      typeof defaultValue === "string"
        ? defaultValue
        : typeof value === "string"
          ? value
          : "",
    ),
  );

  React.useEffect(() => {
    if (typeof value === "string") {
      setInternalValue(formatPhoneInput(value));
    }
  }, [value]);

  return (
    <Input
      {...props}
      autoComplete={props.autoComplete ?? "tel"}
      inputMode="numeric"
      maxLength={14}
      onChange={(event) => {
        const formatted = formatPhoneInput(event.target.value);
        setInternalValue(formatted);
        event.target.value = formatted;
        onChange?.(event);
      }}
      placeholder={props.placeholder ?? "99 9 9999-9999"}
      type="tel"
      value={
        typeof value === "string" ? formatPhoneInput(value) : internalValue
      }
    />
  );
}
