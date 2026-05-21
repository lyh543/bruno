import React, { useMemo } from 'react';
import { IconCaretDown } from '@tabler/icons';
import MenuDropdown from 'ui/MenuDropdown';

const SettingsDropdown = ({
  options = [],
  value,
  onChange,
  placeholder,
  className = '',
  placement = 'bottom-start'
}) => {
  const items = useMemo(() => options.map((option) => ({
    id: option.value,
    label: option.label,
    onClick: () => onChange(option.value)
  })), [options, onChange]);

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className={`settings-dropdown ${className}`.trim()}>
      <MenuDropdown
        items={items}
        placement={placement}
        selectedItemId={value}
        showTickMark={true}
      >
        <div className="settings-dropdown-trigger settings-input select-none">
          <span className="settings-dropdown-value">{selectedOption?.label || placeholder}</span>
          <IconCaretDown className="settings-dropdown-caret" size={14} strokeWidth={2} />
        </div>
      </MenuDropdown>
    </div>
  );
};

export default SettingsDropdown;
