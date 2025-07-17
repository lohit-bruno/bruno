import styled from 'styled-components';

const StyledWrapper = styled.div`
  .settings-label {
    width: 120px;
  }

  .textbox {
    border: 1px solid #ccc;
    padding: 0.5rem 0.75rem !important;
    box-shadow: none;
    outline: none;
    transition: all ease-in-out 0.15s;
    border-radius: 6px;
    background-color: ${(props) => props.theme.modal.input.bg};
    border: 1px solid ${(props) => props.theme.modal.input.border};
    font-size: 0.875rem;

    &:focus {
      border: solid 1px ${(props) => props.theme.modal.input.focusBorder} !important;
      outline: none !important;
      box-shadow: 0 0 0 3px ${(props) => props.theme.modal.input.focusBorder}33;
    }

    &:hover {
      border-color: ${(props) => props.theme.modal.input.focusBorder};
    }

    &::placeholder {
      color: ${(props) => props.theme.input.placeholder.color};
      opacity: ${(props) => props.theme.input.placeholder.opacity};
    }
  }

  .proxy-config-section {
    transition: all 0.2s ease-in-out;

    &:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
  }

  .system-proxy-settings {
    label {
      color: ${(props) => props.theme.colors.text.yellow};
    }
  }

  /* Enhanced toggle switch styling */
  .toggle-switch {
    transition: all 0.2s ease-in-out;
  }

  /* Password visibility toggle button */
  .password-toggle {
    transition: color 0.15s ease-in-out;
    
    &:hover {
      transform: scale(1.05);
    }
  }

  /* Status badge styling */
  .status-badge {
    font-weight: 500;
    letter-spacing: 0.025em;
  }

  /* Custom scrollbar for long content */
  .proxy-content {
    scrollbar-width: thin;
    scrollbar-color: ${(props) => props.theme.modal.input.border} transparent;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background-color: ${(props) => props.theme.modal.input.border};
      border-radius: 3px;
    }
  }

  /* Error state styling */
  .error-border {
    border-color: #ef4444 !important;
    
    &:focus {
      border-color: #ef4444 !important;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }
  }

  /* Section dividers */
  .section-divider {
    background: linear-gradient(
      90deg,
      transparent,
      ${(props) => props.theme.modal.input.border},
      transparent
    );
    height: 1px;
    margin: 1.5rem 0;
  }

  /* Icon containers */
  .icon-container {
    transition: all 0.2s ease-in-out;
    
    &.active {
      transform: scale(1.1);
    }
  }

  /* Form section styling */
  .form-section {
    border-radius: 8px;
    transition: all 0.2s ease-in-out;
    
    &:hover {
      background-color: ${(props) => props.theme.modal.input.bg}22;
    }
  }

  /* Responsive design */
  @media (max-width: 640px) {
    .textbox {
      font-size: 0.8rem;
      padding: 0.4rem 0.6rem !important;
    }

    .settings-label {
      width: 100px;
      font-size: 0.8rem;
    }
  }
`;

export default StyledWrapper;
