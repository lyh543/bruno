# Components Catalog

This directory contains reusable UI building blocks for Bruno.

## Reuse First

Before adding new UI markup or styles:

1. Check this directory for an existing component that already matches the interaction.
2. Prefer extending an existing component with props over introducing a near-duplicate.
3. Only add new low-level UI components when the current catalog cannot express the required behavior.

## Frequently Reused Components

- `Modal`: Shared application modal shell, including footer actions and sizing.
- `SettingsInput`: Shared text input for settings-style UIs. Use `variant="modal"` for stacked modal fields such as OpenAPI and workspace initialization dialogs.
- `SettingsDropdown`: Shared dropdown trigger used by OpenAPI sync settings.
- `ToggleSwitch`: Shared boolean toggle control.
- `ActionIcon`: Shared icon button for toolbar/titlebar actions.
- `MenuDropdown`: Shared anchored dropdown menu.
- `PathDisplay`: Shared read-only path presentation when a non-editable path display is preferred over a text field.
- `SearchInput`: Shared search field.
- `Checkbox`: Shared checkbox control.
- `RadioButton`: Shared radio control.
- `Spinner`: Shared loading indicator.

## Input Guidance

- For modal text fields that should match OpenAPI settings styling, prefer `SettingsInput` with `variant="modal"`.
- For inline request-setting rows, keep using the default `SettingsInput` layout.
- If a field is read-only but should remain copyable, prefer a read-only text input over disabled styling.

## Notes

- This file is intentionally a lightweight index, not a complete API reference.
- When adding a new reusable component, update this catalog so future UI changes start from an existing component search.