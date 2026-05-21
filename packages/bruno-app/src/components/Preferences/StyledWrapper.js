import styled from 'styled-components';

const StyledWrapper = styled.div`
  div.tabs {
    padding: 12px;
    min-width: 180px;

    div.tab {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 6px 10px;
      border: none;
      border-radius: ${(props) => props.theme.border.radius.sm};
      color: ${(props) => props.theme.colors.text.muted};
      cursor: pointer;
      transition: background-color 0.15s ease;

      &:focus,
      &:active,
      &:focus-within,
      &:focus-visible,
      &:target {
        outline: none !important;
        box-shadow: none !important;
      }

      &.active {
        color: ${(props) => props.theme.text} !important;
        background: ${(props) => props.theme.tabs.secondary.active.bg};

        &:hover {
          background: ${(props) => props.theme.tabs.secondary.active.bg} !important;
        }
      }
    }
  }

  section.tab-panel {
    max-height: calc(100% - 55px);
    overflow-y: auto;
    flex-grow: 1;
    padding: 12px;
  }

  input[type="checkbox"],
  input[type="radio"] {
    accent-color: ${(props) => props.theme.workspace.accent};
    cursor: pointer;
  }

  .textbox {
    line-height: 1.5;
    padding: 0.45rem;
    border-radius: ${(props) => props.theme.border.radius.sm};
    background-color: ${(props) => props.theme.input.bg};
    border: 1px solid ${(props) => props.theme.input.border};
    color: ${(props) => props.theme.text};

    &:focus {
      border: solid 1px ${(props) => props.theme.input.focusBorder} !important;
      outline: none !important;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
  .section-header {
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};
    font-weight: 500;
    margin: 6px 0 8px 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .preferences-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .preference-card {
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.base};
    background: ${(props) => props.theme.background.default};
    padding: 12px;
    margin-bottom: 12px;
  }

  .preference-card-title {
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.text};
    font-weight: 600;
    margin-bottom: 4px;
  }

  .preference-card-copy {
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.muted};
    line-height: 1.5;
  }

  .preference-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 12px;

    &.compact {
      margin-bottom: 0;
    }
  }

  .preference-toggle {
    width: 38px;
    height: 22px;
    border-radius: 999px;
    border: none;
    cursor: pointer;
    background: ${(props) => props.theme.colors.text.muted};
    position: relative;

    &.active {
      background: ${(props) => props.theme.colors.text.green};
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .toggle-knob {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #fff;
      transition: left 0.15s ease;
    }

    &.active .toggle-knob {
      left: 19px;
    }
  }

  .preferences-link-button {
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    color: ${(props) => props.theme.textLink};
    font-size: ${(props) => props.theme.font.size.xs};

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .preference-actions-row {
    margin-top: 12px;
  }

  .settings-modal {
    font-family: inherit;

    button,
    input,
    select,
    option,
    textarea {
      font-family: inherit;
    }

    .settings-field {
      margin-bottom: 16px;

      &:last-child {
        margin-bottom: 0;
      }
    }

    .settings-label {
      font-size: 11px;
      font-weight: 600;
      color: ${(props) => props.theme.text};
      display: block;
      margin-bottom: 5px;
    }

    .settings-input {
      width: 100%;
      padding: 7px 10px;
      font-size: 12px;
      color: ${(props) => props.theme.text};
      border: 1px solid ${(props) => props.theme.border.border1};
      border-radius: 5px;
      background: ${(props) => props.theme.input.bg};
      outline: none;
      box-sizing: border-box;
      text-align: left;

      &:focus {
        border-color: ${(props) => props.theme.input.focusBorder};
      }

      &.file-pick-btn {
        cursor: pointer;
        color: ${(props) => props.theme.colors.text.muted};
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .settings-text-input {
      margin-top: 8px;
      max-width: 320px;
    }

    .settings-dropdown {
      width: fit-content;
      max-width: 100%;

      .dropdown {
        width: fit-content;
        max-width: 100%;
      }

      .settings-dropdown-trigger {
        display: inline-flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        cursor: pointer;
        width: fit-content;
        max-width: 100%;

        &:hover {
          border-color: ${(props) => props.theme.input.focusBorder};
        }
      }

      .settings-dropdown-value {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .settings-dropdown-caret {
        color: ${(props) => props.theme.colors.text.muted};
        fill: ${(props) => props.theme.colors.text.muted};
        flex-shrink: 0;
      }
    }

    .settings-toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .toggle-info {
      flex: 1;
      min-width: 0;
    }

    .toggle-description {
      font-size: 11px;
      color: ${(props) => props.theme.text};
      margin-top: 2px;
    }

    .toggle-switch {
      width: 34px;
      height: 20px;
      border-radius: 10px;
      border: none;
      font: inherit;
      cursor: pointer;
      padding: 0;
      flex-shrink: 0;
      position: relative;
      transition: background 0.2s;
      background: ${(props) => props.theme.colors.text.muted};

      &.active {
        background: ${(props) => props.theme.colors.text.green};
      }

      .toggle-knob {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #fff;
        position: absolute;
        top: 3px;
        left: 3px;
        transition: left 0.2s;
        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
      }

      &.active .toggle-knob {
        left: 17px;
      }
    }

    .interval-buttons {
      display: flex;
      gap: 6px;
      margin-top: 8px;

      button {
        padding: 5px 12px;
        font-family: inherit;
        font-size: 12px;
        border-radius: 5px;
        cursor: pointer;
        font-weight: 500;
        border: 1px solid ${(props) => props.theme.border.border1};
        background: ${(props) => props.theme.background.default};
        color: ${(props) => props.theme.colors.text.subtext0};
        transition: all 0.15s;

        &.active {
          border-color: ${(props) => props.theme.button2.color.primary.border};
          background: ${(props) => props.theme.button2.color.primary.bg};
          color: ${(props) => props.theme.button2.color.primary.text};
        }
      }
    }

    .source-mode-buttons {
      display: flex;
      gap: 6px;
      margin-bottom: 8px;

      button {
        padding: 5px 12px;
        font-family: inherit;
        font-size: 12px;
        border-radius: 5px;
        cursor: pointer;
        font-weight: 500;
        border: 1px solid ${(props) => props.theme.border.border1};
        background: ${(props) => props.theme.background.default};
        color: ${(props) => props.theme.colors.text.subtext0};
        transition: all 0.15s;

        &.active {
          border-color: ${(props) => props.theme.button2.color.primary.border};
          background: ${(props) => props.theme.button2.color.primary.bg};
          color: ${(props) => props.theme.button2.color.primary.text};
        }
      }
    }

    .settings-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 14px;
    }

    .settings-actions {
      display: flex;
      gap: 8px;
    }

    .auth-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
      margin-top: 8px;
    }

    .auth-grid-three {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .auth-helper-text {
      margin-top: 8px;
      font-size: ${(props) => props.theme.font.size.xs};
      color: ${(props) => props.theme.colors.text.muted};
    }

    .auth-custom-headers {
      margin-top: 10px;
    }

    .auth-custom-header-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }

    .auth-custom-header-row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) minmax(0, 1.2fr) auto;
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;
    }

    .auth-link-button {
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      font-size: ${(props) => props.theme.font.size.xs};
      color: ${(props) => props.theme.textLink};

      &.danger {
        color: ${(props) => props.theme.colors.text.danger};
      }
    }

    .auth-empty-state {
      font-size: ${(props) => props.theme.font.size.xs};
      color: ${(props) => props.theme.colors.text.muted};
      padding: 8px 0;
    }
  }

  .openapi-source-list {
    padding: 0;
  }

  .openapi-source-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 12px;
    min-height: 92px;
    border-bottom: 1px solid ${(props) => props.theme.border.border1};

    &:last-child {
      border-bottom: none;
    }
  }

  .openapi-source-main {
    min-width: 0;
    flex: 1;
  }

  .openapi-source-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 20px;
    margin-bottom: 4px;
  }

  .openapi-source-title {
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.text};
    font-weight: 600;
  }

  .openapi-source-url {
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.muted};
    word-break: break-all;
    min-height: 18px;
    margin-bottom: 6px;
  }

  .openapi-source-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    min-height: 18px;
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.muted};
  }

  .openapi-source-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    flex-shrink: 0;
  }

  .status-pill {
    padding: 2px 8px;
    min-width: 96px;
    border-radius: 999px;
    font-size: ${(props) => props.theme.font.size.xs};
    font-weight: 600;
    background: ${(props) => props.theme.tabs.secondary.active.bg};
    color: ${(props) => props.theme.text};

    &.updates-available {
      color: ${(props) => props.theme.status.info.text};
    }

    &.error {
      color: ${(props) => props.theme.colors.text.danger};
    }

    &.in-sync {
      color: ${(props) => props.theme.colors.text.green};
    }
  }
`;

export default StyledWrapper;
