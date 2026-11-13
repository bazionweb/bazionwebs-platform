import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

interface FieldPresentationProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

type InputFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & FieldPresentationProps;
type TextareaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & FieldPresentationProps;
type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & FieldPresentationProps;

function describedBy(id: string, hint: ReactNode, error: ReactNode, existing?: string) {
  return [existing, hint ? `${id}-hint` : undefined, error ? `${id}-error` : undefined].filter(Boolean).join(" ") || undefined;
}

function FieldLabel({ id, label, required }: { id: string; label: ReactNode; required?: boolean | undefined }) {
  return (
    <label className="bw-field-label" htmlFor={id}>
      {label}{required && <> <span className="bw-field-required" aria-hidden="true">*</span></>}
    </label>
  );
}

function FieldMessages({ id, hint, error }: { id: string; hint?: ReactNode; error?: ReactNode }) {
  return <>
    {hint && <p className="bw-field-hint" id={`${id}-hint`}>{hint}</p>}
    {error && <p className="bw-field-error" id={`${id}-error`}>{error}</p>}
  </>;
}

export function TextField({ id, label, hint, error, className = "", required, "aria-describedby": existingDescription, "aria-invalid": ariaInvalid, ...props }: InputFieldProps) {
  return (
    <div className="bw-field">
      <FieldLabel id={id} label={label} required={required} />
      <input
        {...props}
        id={id}
        required={required}
        className={`bw-control ${className}`.trim()}
        aria-invalid={error ? true : ariaInvalid}
        aria-describedby={describedBy(id, hint, error, existingDescription)}
      />
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  );
}

export function TextAreaField({ id, label, hint, error, className = "", required, "aria-describedby": existingDescription, "aria-invalid": ariaInvalid, ...props }: TextareaFieldProps) {
  return (
    <div className="bw-field">
      <FieldLabel id={id} label={label} required={required} />
      <textarea
        {...props}
        id={id}
        required={required}
        className={`bw-control ${className}`.trim()}
        aria-invalid={error ? true : ariaInvalid}
        aria-describedby={describedBy(id, hint, error, existingDescription)}
      />
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  );
}

export function SelectField({ id, label, hint, error, className = "", required, children, "aria-describedby": existingDescription, "aria-invalid": ariaInvalid, ...props }: SelectFieldProps) {
  return (
    <div className="bw-field">
      <FieldLabel id={id} label={label} required={required} />
      <select
        {...props}
        id={id}
        required={required}
        className={`bw-control ${className}`.trim()}
        aria-invalid={error ? true : ariaInvalid}
        aria-describedby={describedBy(id, hint, error, existingDescription)}
      >{children}</select>
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  );
}
