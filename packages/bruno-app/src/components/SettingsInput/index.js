import React from 'react';
import { useTheme } from 'providers/Theme';
import StyledWrapper from './StyledWrapper';

const joinClassNames = (...classNames) => classNames.filter(Boolean).join(' ');

const SettingsInput = ({
  id,
  label,
  value,
  onChange,
  className = '',
  description = '',
  onKeyDown,
  variant = 'inline',
  type = 'text',
  placeholder = '',
  readOnly = false,
  disabled = false,
  wrapperClassName = '',
  labelClassName = '',
  inputClassName = '',
  compact = false,
  autoFocus = false
}) => {
  const { theme } = useTheme();
  const isModalVariant = variant === 'modal';

  if (isModalVariant) {
    return (
      <StyledWrapper>
        <div className={joinClassNames('settings-input-wrapper', 'modal', wrapperClassName)}>
          {label ? (
            <label className={joinClassNames('settings-input-label', 'modal', labelClassName)} htmlFor={id}>
              {label}
            </label>
          ) : null}
          {description ? (
            <p className="settings-input-description modal">{description}</p>
          ) : null}
          <input
            id={id}
            type={type}
            className={joinClassNames('settings-input-control', 'modal', compact && 'compact', className, inputClassName)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            readOnly={readOnly}
            disabled={disabled}
            autoFocus={autoFocus}
          />
        </div>
      </StyledWrapper>
    );
  }

  return (
    <StyledWrapper>
      <div className={joinClassNames('flex items-center justify-between', wrapperClassName)}>
        <div className="flex flex-col">
          <label className={joinClassNames('text-xs font-medium text-gray-900 dark:text-gray-100', labelClassName)} htmlFor={id}>
            {label}
          </label>
          {description && (
            <p className="text-xs text-gray-700 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
        <input
          id={id}
          type={type}
          className={joinClassNames('block px-2 py-1 rounded-sm outline-none transition-colors duration-100 w-24 h-8', className, inputClassName)}
          style={{
            backgroundColor: theme.input.bg,
            border: `1px solid ${theme.input.border}`
          }}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          readOnly={readOnly}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      </div>
    </StyledWrapper>
  );
};

export default SettingsInput;
