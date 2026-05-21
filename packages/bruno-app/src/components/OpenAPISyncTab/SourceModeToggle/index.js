import React from 'react';

const SOURCE_MODE_OPTIONS = [
  { value: 'url', label: 'URL' },
  { value: 'file', label: 'File' }
];

const SourceModeToggle = ({ value, onChange, className = '' }) => {
  return (
    <div className={`source-mode-buttons ${className}`.trim()}>
      {SOURCE_MODE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? 'active' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default SourceModeToggle;
