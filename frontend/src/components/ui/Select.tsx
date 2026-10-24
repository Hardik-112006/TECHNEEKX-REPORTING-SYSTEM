import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import './Select.css';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  helperText,
  options,
  placeholder,
  className = '',
  id,
  required,
  ...props
}, ref) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`form-field ${className}`}>
      {label && (
        <label htmlFor={selectId} className="form-label">
          {label} {required && <span className="form-required">*</span>}
        </label>
      )}
      <div className={`select-wrapper ${error ? 'select-error' : ''}`}>
        <select
          ref={ref}
          id={selectId}
          className="select-control"
          aria-invalid={!!error}
          required={required}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="select-arrow" size={16} />
      </div>
      {error && <span className="form-error-msg">{error}</span>}
      {!error && helperText && <span className="form-helper-msg">{helperText}</span>}
    </div>
  );
});

Select.displayName = 'Select';
