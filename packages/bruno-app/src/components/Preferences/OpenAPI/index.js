import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import Button from 'ui/Button';
import { savePreferences } from 'providers/ReduxStore/slices/app';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import { checkCollectionForUpdates, setPollingEnabled } from 'providers/ReduxStore/slices/openapi-sync';
import { mountCollection } from 'providers/ReduxStore/slices/collections/actions';
import { normalizePath } from 'utils/common/path';
import { flattenItems } from 'utils/collections';
import AddDataSourceModal from './AddDataSourceModal';

const DEFAULT_INTERVAL_OPTIONS = [5, 15, 30, 60];

const OpenAPI = () => {
  const dispatch = useDispatch();
  const preferences = useSelector((state) => state.app.preferences);
  const collections = useSelector((state) => state.collections?.collections || []);
  const collectionUpdates = useSelector((state) => state.openapiSync?.collectionUpdates || {});
  const storedSpecMeta = useSelector((state) => state.openapiSync?.storedSpecMeta || {});
  const workspaces = useSelector((state) => state.workspaces?.workspaces || []);
  const activeWorkspaceUid = useSelector((state) => state.workspaces?.activeWorkspaceUid);
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);

  const activeWorkspace = workspaces.find((workspace) => workspace.uid === activeWorkspaceUid);
  const openApiPreferences = preferences?.openapi || {};
  const pollingEnabled = openApiPreferences.pollingEnabled ?? true;
  const defaultInterval = openApiPreferences.defaultInterval || 5;

  const activeWorkspaceCollections = useMemo(() => {
    if (!activeWorkspace) {
      return [];
    }

    return collections.filter((collection) => activeWorkspace.collections?.some(
      (workspaceCollection) => normalizePath(workspaceCollection.path) === normalizePath(collection.pathname)
    ));
  }, [activeWorkspace, collections]);

  const dataSources = useMemo(() => activeWorkspaceCollections.flatMap((collection) => {
    const entries = Array.isArray(collection?.brunoConfig?.openapi) ? collection.brunoConfig.openapi : [];
    return entries.map((entry, index) => {
      const requestCount = flattenItems(collection.items || []).filter((item) => item.type === 'http-request').length;
      const updateState = collectionUpdates[collection.uid] || {};
      const meta = storedSpecMeta[collection.uid] || {};

      let status = 'Not checked';
      if (updateState.error) {
        status = 'Error';
      } else if (updateState.hasUpdates) {
        status = 'Updates available';
      } else if (entry.specHash) {
        status = 'In sync';
      }

      if (entry.autoCheck === false) {
        status = 'Auto-check paused';
      }

      return {
        id: `${collection.uid}:${index}`,
        collection,
        entry,
        index,
        requestCount,
        specEndpointCount: meta.endpointCount,
        status,
        isPrimary: index === 0
      };
    });
  }), [activeWorkspaceCollections, collectionUpdates, storedSpecMeta]);

  const persistPreferences = (patch) => {
    const nextPreferences = {
      ...preferences,
      openapi: {
        pollingEnabled,
        defaultInterval,
        ...openApiPreferences,
        ...patch
      }
    };

    if (Object.prototype.hasOwnProperty.call(patch, 'pollingEnabled')) {
      dispatch(setPollingEnabled(patch.pollingEnabled));
    }

    dispatch(savePreferences(nextPreferences)).catch(() => {
      toast.error('Failed to save OpenAPI preferences');
    });
  };

  const handleAddSource = async ({ collection, sourceUrl, autoCheck, autoCheckInterval, auth }) => {
    const { ipcRenderer } = window;
    const validationResult = await ipcRenderer.invoke('renderer:compare-openapi-specs', {
      collectionUid: collection.uid,
      collectionPath: collection.pathname,
      sourceUrl,
      auth,
      environmentContext: {
        activeEnvironmentUid: collection.activeEnvironmentUid,
        environments: collection.environments,
        runtimeVariables: collection.runtimeVariables,
        globalEnvironmentVariables: collection.globalEnvironmentVariables
      }
    });

    if (validationResult.isValid === false) {
      toast.error(validationResult.error || 'Invalid OpenAPI specification');
      throw new Error(validationResult.error || 'Invalid OpenAPI specification');
    }

    await ipcRenderer.invoke('renderer:update-openapi-sync-config', {
      collectionPath: collection.pathname,
      config: {
        sourceUrl,
        autoCheck,
        autoCheckInterval,
        auth
      }
    });

    toast.success(`Added OpenAPI source to ${collection.name}`);
  };

  const openSyncTab = (collection) => {
    dispatch(mountCollection({
      collectionUid: collection.uid,
      collectionPathname: collection.pathname,
      brunoConfig: collection.brunoConfig
    }));
    dispatch(addTab({
      uid: `${collection.uid}-openapi-sync`,
      collectionUid: collection.uid,
      type: 'openapi-sync'
    }));
  };

  const handleCheckNow = async (collection) => {
    const result = await dispatch(checkCollectionForUpdates(collection));
    if (result?.error) {
      toast.error(result.error);
      return;
    }

    if (result?.hasUpdates) {
      toast.success(`OpenAPI updates found for ${collection.name}`);
      return;
    }

    toast.success(`No OpenAPI updates found for ${collection.name}`);
  };

  return (
    <div className="w-full openapi-preferences">
      <div className="preferences-header-row">
        <div className="section-header">OpenAPI Sync</div>
        <Button size="sm" onClick={() => setShowAddSourceModal(true)} disabled={!activeWorkspaceCollections.length}>Add Data Source</Button>
      </div>

      <div className="preference-card">
        <div className="preference-row">
          <div>
            <div className="preference-card-title">Global polling</div>
            <div className="preference-card-copy">Pause or resume automatic OpenAPI change detection for the active workspace.</div>
          </div>
          <button
            type="button"
            className={`preference-toggle ${pollingEnabled ? 'active' : ''}`}
            onClick={() => persistPreferences({ pollingEnabled: !pollingEnabled })}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <div className="preference-row compact">
          <div>
            <div className="preference-card-title">Default interval</div>
            <div className="preference-card-copy">Used for new sources and any source without an explicit interval.</div>
          </div>
          <select
            className="textbox"
            value={defaultInterval}
            onChange={(event) => persistPreferences({ defaultInterval: Number(event.target.value) })}
          >
            {DEFAULT_INTERVAL_OPTIONS.map((interval) => (
              <option key={interval} value={interval}>{interval} minutes</option>
            ))}
          </select>
        </div>
      </div>

      <div className="section-header">Data Sources</div>
      {dataSources.length === 0 ? (
        <div className="preference-card">
          <div className="preference-card-copy">No OpenAPI data sources are configured in the active workspace yet.</div>
          <div className="preference-actions-row">
            <Button size="sm" onClick={() => setShowAddSourceModal(true)} disabled={!activeWorkspaceCollections.length}>Add Data Source</Button>
          </div>
        </div>
      ) : (
        <div className="preference-card openapi-source-list">
          {dataSources.map(({ id, collection, entry, index, requestCount, specEndpointCount, status, isPrimary }) => (
            <div key={id} className="openapi-source-row">
              <div className="openapi-source-main">
                <div className="openapi-source-title-row">
                  <div className="openapi-source-title">{collection.name}</div>
                  <span className={`status-pill ${status.toLowerCase().replace(/\s+/g, '-')}`}>{status}</span>
                </div>
                <div className="openapi-source-url">{entry.sourceUrl}</div>
                <div className="openapi-source-meta">
                  <span>{isPrimary ? 'Primary source' : `Source #${index + 1}`}</span>
                  <span>{entry.autoCheck === false ? 'Manual checks only' : `Every ${entry.autoCheckInterval || defaultInterval} min`}</span>
                  <span>{entry.lastSyncDate ? `Last sync ${new Date(entry.lastSyncDate).toLocaleString()}` : 'Never synced'}</span>
                  <span>Spec endpoints {specEndpointCount ?? '-'}</span>
                  <span>Collection requests {requestCount}</span>
                </div>
              </div>
              <div className="openapi-source-actions">
                <button type="button" className="preferences-link-button" onClick={() => openSyncTab(collection)}>
                  {isPrimary ? 'Settings' : 'Open'}
                </button>
                <button
                  type="button"
                  className="preferences-link-button"
                  onClick={() => isPrimary ? handleCheckNow(collection) : openSyncTab(collection)}
                >
                  {isPrimary ? 'Sync Now' : 'Review'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddSourceModal && (
        <AddDataSourceModal
          collections={activeWorkspaceCollections}
          defaultInterval={defaultInterval}
          onSave={handleAddSource}
          onClose={() => setShowAddSourceModal(false)}
        />
      )}
    </div>
  );
};

export default OpenAPI;
