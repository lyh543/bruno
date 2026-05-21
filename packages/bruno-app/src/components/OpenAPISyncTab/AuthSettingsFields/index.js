import React from 'react';

export const createDefaultOpenApiAuth = () => ({
  mode: 'none',
  basic: {
    username: '',
    password: ''
  },
  bearer: {
    token: ''
  },
  apikey: {
    key: '',
    value: '',
    placement: 'header'
  },
  customHeaders: []
});

export const normalizeOpenApiAuth = (auth) => {
  const defaults = createDefaultOpenApiAuth();
  return {
    ...defaults,
    ...auth,
    basic: {
      ...defaults.basic,
      ...(auth?.basic || {})
    },
    bearer: {
      ...defaults.bearer,
      ...(auth?.bearer || {})
    },
    apikey: {
      ...defaults.apikey,
      ...(auth?.apikey || {})
    },
    customHeaders: Array.isArray(auth?.customHeaders)
      ? auth.customHeaders.map((header) => ({
          name: header?.name || '',
          value: header?.value || '',
          enabled: header?.enabled !== false
        }))
      : defaults.customHeaders
  };
};

const AUTH_MODE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'apikey', label: 'API Key' },
  { value: 'custom-headers', label: 'Custom Headers' }
];

const AuthSettingsFields = ({ value, onChange, label = 'Authentication' }) => {
  const auth = normalizeOpenApiAuth(value);

  const updateAuth = (patch) => {
    onChange({
      ...auth,
      ...patch
    });
  };

  const updateSection = (section, patch) => {
    updateAuth({
      [section]: {
        ...auth[section],
        ...patch
      }
    });
  };

  const updateCustomHeader = (index, patch) => {
    const nextHeaders = auth.customHeaders.map((header, headerIndex) => {
      if (headerIndex !== index) {
        return header;
      }

      return {
        ...header,
        ...patch
      };
    });

    updateAuth({ customHeaders: nextHeaders });
  };

  const addCustomHeader = () => {
    updateAuth({
      customHeaders: [
        ...auth.customHeaders,
        {
          name: '',
          value: '',
          enabled: true
        }
      ]
    });
  };

  const removeCustomHeader = (index) => {
    updateAuth({
      customHeaders: auth.customHeaders.filter((_, headerIndex) => headerIndex !== index)
    });
  };

  return (
    <div className="settings-field">
      <label className="settings-label">{label}</label>
      <select
        className="settings-input"
        value={auth.mode}
        onChange={(event) => updateAuth({ mode: event.target.value })}
      >
        {AUTH_MODE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>

      {auth.mode === 'basic' && (
        <div className="auth-grid">
          <input
            className="settings-input"
            type="text"
            value={auth.basic.username}
            onChange={(event) => updateSection('basic', { username: event.target.value })}
            placeholder="Username or {{OPENAPI_USER}}"
          />
          <input
            className="settings-input"
            type="password"
            value={auth.basic.password}
            onChange={(event) => updateSection('basic', { password: event.target.value })}
            placeholder="Password or {{OPENAPI_PASS}}"
          />
        </div>
      )}

      {auth.mode === 'bearer' && (
        <div className="auth-grid">
          <input
            className="settings-input"
            type="text"
            value={auth.bearer.token}
            onChange={(event) => updateSection('bearer', { token: event.target.value })}
            placeholder="Bearer token or {{OPENAPI_TOKEN}}"
          />
        </div>
      )}

      {auth.mode === 'apikey' && (
        <div className="auth-grid auth-grid-three">
          <input
            className="settings-input"
            type="text"
            value={auth.apikey.key}
            onChange={(event) => updateSection('apikey', { key: event.target.value })}
            placeholder="Header/query name"
          />
          <input
            className="settings-input"
            type="text"
            value={auth.apikey.value}
            onChange={(event) => updateSection('apikey', { value: event.target.value })}
            placeholder="Value or {{API_KEY}}"
          />
          <select
            className="settings-input"
            value={auth.apikey.placement}
            onChange={(event) => updateSection('apikey', { placement: event.target.value })}
          >
            <option value="header">Header</option>
            <option value="query">Query</option>
          </select>
        </div>
      )}

      {auth.mode === 'custom-headers' && (
        <div className="auth-custom-headers">
          <div className="auth-custom-header-actions">
            <span className="auth-helper-text">Use Bruno variables like {'{{TOKEN}}'} to avoid storing secrets in config.</span>
            <button type="button" className="auth-link-button" onClick={addCustomHeader}>Add Header</button>
          </div>

          {auth.customHeaders.length === 0 && (
            <div className="auth-empty-state">No custom headers configured.</div>
          )}

          {auth.customHeaders.map((header, index) => (
            <div className="auth-custom-header-row" key={`${header.name}-${index}`}>
              <input
                type="checkbox"
                checked={header.enabled !== false}
                onChange={(event) => updateCustomHeader(index, { enabled: event.target.checked })}
              />
              <input
                className="settings-input"
                type="text"
                value={header.name}
                onChange={(event) => updateCustomHeader(index, { name: event.target.value })}
                placeholder="Header name"
              />
              <input
                className="settings-input"
                type="text"
                value={header.value}
                onChange={(event) => updateCustomHeader(index, { value: event.target.value })}
                placeholder="Header value"
              />
              <button type="button" className="auth-link-button danger" onClick={() => removeCustomHeader(index)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {auth.mode !== 'custom-headers' && auth.mode !== 'none' && (
        <div className="auth-helper-text">Use Bruno environment variables such as {'{{OPENAPI_TOKEN}}'} for secrets.</div>
      )}
    </div>
  );
};

export default AuthSettingsFields;
