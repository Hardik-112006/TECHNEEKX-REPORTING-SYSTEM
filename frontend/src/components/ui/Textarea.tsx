import React, { forwardRef } from 'react';
import './Textarea.css';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label,
  error,
  helperText,
  className = '',
  id,
  required,
  rows = 4,
  ...props
}, ref) => {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`form-field ${className}`}>
      {label && (
        <label htmlFor={textareaId} className="form-label">
          {label} {required && <span className="form-required">*</span>}
        </label>
      )}
      <div className={`textarea-wrapper ${error ? 'textarea-error' : ''}`}>
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className="textarea-control"
          aria-invalid={!!error}
          required={required}
          {...props}
        />
      </div>
      {error && <span className="form-error-msg">{error}</span>}
      {!error && helperText && <span className="form-helper-msg">{helperText}</span>}
    </div>
  );
});

Textarea.displayName = 'Textarea';
