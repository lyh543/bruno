import React, { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Button from 'ui/Button';
import Modal from 'components/Modal';
import SettingsInput from 'components/SettingsInput';
import { isHttpUrl } from 'utils/url';
import { parseFileAsJsonOrYaml } from 'utils/importers/file-reader';
import { isOpenApiSpec } from 'utils/importers/openapi-collection';
import AuthSettingsFields, { normalizeOpenApiAuth } from 'components/OpenAPISyncTab/AuthSettingsFields';
import SettingsDropdown from 'components/OpenAPISyncTab/SettingsDropdown';
import SourceModeToggle from 'components/OpenAPISyncTab/SourceModeToggle';

const INTERVALS = [5, 15, 30, 60];
const CREATE_NEW_COLLECTION_VALUE = '__create_new_collection__';

const AddDataSourceModal = ({ collections, defaultInterval = 5, onSave, onClose }) => {
  const [collectionUid, setCollectionUid] = useState(collections[0]?.uid || CREATE_NEW_COLLECTION_VALUE);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [mode, setMode] = useState('url');
  const [url, setUrl] = useState('');
  const [filePath, setFilePath] = useState('');
  const [autoCheck, setAutoCheck] = useState(true);
  const [autoCheckInterval, setAutoCheckInterval] = useState(defaultInterval);
  const [auth, setAuth] = useState(() => normalizeOpenApiAuth());
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.uid === collectionUid) || null,
    [collections, collectionUid]
  );
  const isCreatingNewCollection = collectionUid === CREATE_NEW_COLLECTION_VALUE;

  const sourceUrl = mode === 'url' ? url.trim() : filePath;
  const canSave = (isCreatingNewCollection ? !!newCollectionName.trim() : !!selectedCollection)
    && (mode === 'url' ? isHttpUrl(sourceUrl) : !!sourceUrl);
  const collectionOptions = useMemo(() => ([
    ...collections.map((collection) => ({
      value: collection.uid,
      label: collection.name
    })),
    {
      value: CREATE_NEW_COLLECTION_VALUE,
      label: 'Create New Collection...'
    }
  ]), [collections]);

  const handleSubmit = async () => {
    if ((!selectedCollection && !isCreatingNewCollection) || !sourceUrl) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        collection: selectedCollection,
        newCollectionName: newCollectionName.trim(),
        sourceUrl,
        autoCheck,
        autoCheckInterval,
        auth
      });
      onClose();
    } catch (_) {
      // caller handles toast
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal size="md" title="Add OpenAPI Data Source" hideFooter={true} handleCancel={onClose}>
      <div className="settings-modal openapi-preferences-modal">
        <div className="settings-body">
          <div className="settings-field">
            <label className="settings-label">Collection</label>
            <SettingsDropdown
              options={collectionOptions}
              value={collectionUid}
              onChange={setCollectionUid}
              placeholder="Select a collection"
            />
            {isCreatingNewCollection && (
              <SettingsInput
                id="new-openapi-collection-name"
                variant="modal"
                wrapperClassName="mt-2"
                compact
                value={newCollectionName}
                onChange={(event) => setNewCollectionName(event.target.value)}
                placeholder="New collection name"
              />
            )}
          </div>

          <div className="settings-field">
            <SourceModeToggle value={mode} onChange={setMode} className="mb-2" />

            {mode === 'url' ? (
              <SettingsInput
                id="openapi-spec-source"
                label="Spec Source"
                variant="modal"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://api.example.com/openapi.json"
              />
            ) : (
              <>
                <label className="settings-label">Spec Source</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.yaml,.yml"
                  style={{ display: 'none' }}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }

                    try {
                      const data = await parseFileAsJsonOrYaml(file);
                      if (!isOpenApiSpec(data)) {
                        toast.error('The selected file is not a valid OpenAPI 3.x specification');
                        return;
                      }
                      const absolutePath = window.ipcRenderer.getFilePath(file);
                      if (absolutePath) {
                        setFilePath(absolutePath);
                      }
                    } catch (error) {
                      toast.error(error.message || 'Failed to read the selected file');
                    }
                  }}
                />
                <button type="button" className="settings-input file-pick-btn" onClick={() => fileInputRef.current?.click()}>
                  {filePath || 'Select File'}
                </button>
              </>
            )}
          </div>

          <div className="settings-field">
            <label className="settings-label">Auto-check for updates</label>
            <div className="settings-toggle-row">
              <div className="toggle-info">
                <div className="toggle-description">Automatically check for remote spec changes at a regular interval</div>
              </div>
              <button className={`toggle-switch ${autoCheck ? 'active' : ''}`} type="button" onClick={() => setAutoCheck(!autoCheck)}>
                <span className="toggle-knob" />
              </button>
            </div>
          </div>

          {autoCheck && (
            <div className="settings-field">
              <label className="settings-label">Check interval</label>
              <div className="interval-buttons">
                {INTERVALS.map((interval) => (
                  <button key={interval} type="button" className={autoCheckInterval === interval ? 'active' : ''} onClick={() => setAutoCheckInterval(interval)}>
                    {interval} min
                  </button>
                ))}
              </div>
            </div>
          )}

          <AuthSettingsFields value={auth} onChange={setAuth} />
        </div>

        <div className="settings-footer">
          <div />
          <div className="settings-actions">
            <Button variant="ghost" color="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} loading={isSaving} disabled={!canSave || isSaving}>Add Source</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AddDataSourceModal;
