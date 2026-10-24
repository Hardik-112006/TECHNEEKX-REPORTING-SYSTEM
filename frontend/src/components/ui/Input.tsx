import React, { forwardRef } from 'react';
import './Input.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  className = '',
  id,
  required,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`form-field ${className}`}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label} {required && <span className="form-required">*</span>}
        </label>
      )}
      <div className={`input-wrapper ${error ? 'input-error' : ''}`}>
        {leftIcon && <span className="input-icon-left">{leftIcon}</span>}
        <input
          ref={ref}
          id={inputId}
          className={`input-control ${leftIcon ? 'has-left-icon' : ''} ${rightIcon ? 'has-right-icon' : ''}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          required={required}
          {...props}
        />
        {rightIcon && <span className="input-icon-right">{rightIcon}</span>}
      </div>
      {error && <span id={`${inputId}-error`} className="form-error-msg">{error}</span>}
      {!error && helperText && <span id={`${inputId}-helper`} className="form-helper-msg">{helperText}</span>}
    </div>
  );
});

Input.displayName = 'Input';
