import styled from 'styled-components';

const StyledWrapper = styled.div`
  .settings-input-wrapper.modal {
    display: block;

    &.mt-2 {
      margin-top: 8px;
    }

    &.mt-3 {
      margin-top: 12px;
    }
  }

  .settings-input-label.modal {
    font-size: 11px;
    font-weight: 600;
    color: ${(props) => props.theme.text};
    display: block;
    margin-bottom: 5px;
  }

  .settings-input-description.modal {
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.muted};
    margin: 0 0 5px;
  }

  .settings-input-control.modal {
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
    font-family: inherit;

    &:focus {
      border-color: ${(props) => props.theme.input.focusBorder};
    }

    &::placeholder {
      color: ${(props) => props.theme.colors.text.muted};
    }

    &:disabled {
      color: ${(props) => props.theme.colors.text.muted};
      cursor: not-allowed;
      opacity: 1;

      &::placeholder {
        color: ${(props) => props.theme.colors.text.muted};
      }
    }

    &.compact {
      max-width: 320px;
    }
  }
`;

export default StyledWrapper;
