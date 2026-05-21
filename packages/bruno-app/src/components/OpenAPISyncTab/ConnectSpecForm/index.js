import { useState, useRef } from 'react';
import { IconCheck } from '@tabler/icons';
import Button from 'ui/Button';
import { isHttpUrl } from 'utils/url/index';
import { isOpenApiSpec } from 'utils/importers/openapi-collection';
import { parseFileAsJsonOrYaml } from 'utils/importers/file-reader';
import AuthSettingsFields, { normalizeOpenApiAuth } from '../AuthSettingsFields';
import SourceModeToggle from '../SourceModeToggle';

const FEATURES = [
  'Detect new, modified, and removed endpoints',
  'Track local changes against the spec',
  'Sync collection with a single click',
  'Your tests, assertions, and scripts are preserved during sync'
];

const ConnectSpecForm = ({ sourceUrl, setSourceUrl, isLoading, error, setError, onConnect }) => {
  const [mode, setMode] = useState('url');
  const [auth, setAuth] = useState(() => normalizeOpenApiAuth());
  const fileInputRef = useRef(null);

  return (
    <div className="setup-section">
      <div className="setup-header">
        <h2 className="setup-title">Connect to OpenAPI Spec</h2>
        <p className="setup-description">
          Keep your collection synchronized with an OpenAPI specification. Changes in the spec will be detected automatically.
        </p>
      </div>

      <form
        className="setup-form"
        onSubmit={(e) => {
          e.preventDefault(); onConnect({ sourceUrl: sourceUrl.trim(), auth });
        }}
      >
        <label className="url-label">OpenAPI Specification</label>
        <div className="url-row">
          <SourceModeToggle
            value={mode}
            onChange={(nextMode) => {
              setMode(nextMode);
              setSourceUrl('');
            }}
          />

          {mode === 'url' ? (
            <input
              type="text"
              className="url-input"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://api.example.com/openapi.json"
            />
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.yaml,.yml"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setError(null);
                  setSourceUrl('');
                  try {
                    const data = await parseFileAsJsonOrYaml(file);
                    if (!isOpenApiSpec(data)) {
                      setError('The selected file is not a valid OpenAPI 3.x specification');
                      return;
                    }
                    if (data.swagger && String(data.swagger).startsWith('2')) {
                      setError('Swagger 2.0 is not supported. Please convert your spec to OpenAPI 3.x.');
                      return;
                    }
                    const filePath = window.ipcRenderer.getFilePath(file);
                    if (filePath) setSourceUrl(filePath);
                  } catch (err) {
                    setError(err.message || 'Failed to read the selected file');
                  }
                }}
              />
              <button
                type="button"
                className="url-input file-pick-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                {sourceUrl ? sourceUrl.split(/[\\/]/).pop() : 'Select File'}
              </button>
            </>
          )}

          <Button
            type="submit"
            size="sm"
            disabled={mode === 'url' ? !isHttpUrl(sourceUrl.trim()) : !sourceUrl.trim()}
            loading={isLoading}
          >
            Connect
          </Button>
        </div>
        <p className="setup-hint">
          {mode === 'url'
            ? 'Supports OpenAPI 3.x specifications in JSON or YAML format'
            : 'Select a local OpenAPI/Swagger JSON or YAML file'}
        </p>
        {error && (
          <p className="setup-error">{error}</p>
        )}

        {mode === 'url' && (
          <div className="settings-modal auth-inline-panel">
            <AuthSettingsFields value={auth} onChange={setAuth} label="Optional Authentication" />
          </div>
        )}
      </form>

      <div className="setup-features">
        {FEATURES.map((text) => (
          <div className="setup-feature" key={text}>
            <IconCheck size={16} />
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConnectSpecForm;
