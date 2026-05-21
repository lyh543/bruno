import { createSlice } from '@reduxjs/toolkit';
import React from 'react';
import toast from 'react-hot-toast';
import { normalizePath } from 'utils/common/path';
import { addTab } from './tabs';

const initialState = {
  // Map of collectionUid -> { hasUpdates, lastChecked, error }
  // Lightweight indicator state for the toolbar status badge — fed by
  // background polling. Full drift data lives in `drift` (this slice).
  collectionUpdates: {},
  // Whether App level OpenAPI polling is enabled
  pollingEnabled: true,
  // Last poll timestamp
  lastPollTime: null,
  // Map of collectionUid -> { activeTab, expandedSections, expandedRows }
  tabUiState: {},
  // Map of collectionUid -> { title, version, endpointCount }
  storedSpecMeta: {},
  // Map of collectionUid -> full parsed OpenAPI spec object
  storedSpec: {},
  // Map of collectionUid -> { specDrift, collectionDrift, remoteDrift, fetching, lastChecked }
  drift: {}
};

export const openapiSyncSlice = createSlice({
  name: 'openapiSync',
  initialState,
  reducers: {
    setCollectionUpdate: (state, action) => {
      const { collectionUid, hasUpdates, error } = action.payload;
      state.collectionUpdates[collectionUid] = {
        hasUpdates,
        error,
        lastChecked: Date.now()
      };
    },
    clearCollectionUpdate: (state, action) => {
      const { collectionUid } = action.payload;
      delete state.collectionUpdates[collectionUid];
    },
    clearCollectionState: (state, action) => {
      const { collectionUid } = action.payload;
      delete state.collectionUpdates[collectionUid];
      delete state.tabUiState[collectionUid];
      delete state.storedSpecMeta[collectionUid];
      delete state.storedSpec[collectionUid];
      delete state.drift[collectionUid];
    },
    setDrift: (state, action) => {
      const { collectionUid, patch } = action.payload;
      state.drift[collectionUid] = { ...state.drift[collectionUid], ...patch };
    },
    clearDrift: (state, action) => {
      const { collectionUid } = action.payload;
      delete state.drift[collectionUid];
    },
    clearOpenApiSyncTabState: (state, action) => {
      const { collectionUid } = action.payload;
      delete state.drift[collectionUid];
      delete state.storedSpec[collectionUid];
      delete state.tabUiState[collectionUid];
    },
    setStoredSpec: (state, action) => {
      const { collectionUid, spec } = action.payload;
      if (spec === null || spec === undefined) {
        delete state.storedSpec[collectionUid];
      } else {
        state.storedSpec[collectionUid] = spec;
      }
    },
    setStoredSpecMeta: (state, action) => {
      const { collectionUid, title, version, endpointCount } = action.payload;
      state.storedSpecMeta[collectionUid] = { title, version, endpointCount };
    },
    setPollingEnabled: (state, action) => {
      state.pollingEnabled = action.payload;
    },
    setLastPollTime: (state, action) => {
      state.lastPollTime = action.payload;
    },
    // UI state reducers
    setTabUiState: (state, action) => {
      const { collectionUid, ...uiState } = action.payload;
      if (!state.tabUiState[collectionUid]) {
        state.tabUiState[collectionUid] = {};
      }
      Object.assign(state.tabUiState[collectionUid], uiState);
    },
    toggleSectionExpanded: (state, action) => {
      const { collectionUid, sectionKey } = action.payload;
      if (!state.tabUiState[collectionUid]) {
        state.tabUiState[collectionUid] = {};
      }
      if (!state.tabUiState[collectionUid].expandedSections) {
        state.tabUiState[collectionUid].expandedSections = {};
      }
      const current = state.tabUiState[collectionUid].expandedSections[sectionKey];
      state.tabUiState[collectionUid].expandedSections[sectionKey] = !current;
    },
    setSectionExpanded: (state, action) => {
      const { collectionUid, sectionKey, expanded } = action.payload;
      if (!state.tabUiState[collectionUid]) {
        state.tabUiState[collectionUid] = {};
      }
      if (!state.tabUiState[collectionUid].expandedSections) {
        state.tabUiState[collectionUid].expandedSections = {};
      }
      state.tabUiState[collectionUid].expandedSections[sectionKey] = expanded;
    },
    toggleRowExpanded: (state, action) => {
      const { collectionUid, rowKey } = action.payload;
      if (!state.tabUiState[collectionUid]) {
        state.tabUiState[collectionUid] = {};
      }
      if (!state.tabUiState[collectionUid].expandedRows) {
        state.tabUiState[collectionUid].expandedRows = {};
      }
      const current = state.tabUiState[collectionUid].expandedRows[rowKey];
      state.tabUiState[collectionUid].expandedRows[rowKey] = !current;
    },
    setReviewDecision: (state, action) => {
      const { collectionUid, endpointId, decision } = action.payload;
      if (!state.tabUiState[collectionUid]) {
        state.tabUiState[collectionUid] = {};
      }
      if (!state.tabUiState[collectionUid].reviewDecisions) {
        state.tabUiState[collectionUid].reviewDecisions = {};
      }
      state.tabUiState[collectionUid].reviewDecisions[endpointId] = decision;
    },
    setReviewDecisions: (state, action) => {
      const { collectionUid, decisions } = action.payload;
      if (!state.tabUiState[collectionUid]) {
        state.tabUiState[collectionUid] = {};
      }
      // Merge into existing decisions instead of replacing, so decisions
      // for other change types (e.g., specChanges) are preserved
      state.tabUiState[collectionUid].reviewDecisions = {
        ...state.tabUiState[collectionUid].reviewDecisions,
        ...decisions
      };
    }
  }
});

export const {
  setCollectionUpdate,
  clearCollectionUpdate,
  clearCollectionState,
  setPollingEnabled,
  setTabUiState,
  toggleSectionExpanded,
  setSectionExpanded,
  toggleRowExpanded,
  setLastPollTime,
  setReviewDecision,
  setReviewDecisions,
  setStoredSpec,
  setStoredSpecMeta,
  setDrift,
  clearDrift,
  clearOpenApiSyncTabState
} = openapiSyncSlice.actions;

const getPrimaryOpenApiSource = (collection) => {
  const entries = Array.isArray(collection?.brunoConfig?.openapi) ? collection.brunoConfig.openapi : [];
  return entries.find((entry) => entry?.sourceUrl) || entries[0] || null;
};

const OpenApiUpdateToast = ({ collectionName, onOpen }) => {
  return (
    <div className="bruno-toast-card">
      <div className="bruno-toast-title">OpenAPI updates available</div>
      <div className="bruno-toast-copy">{collectionName} has remote spec changes waiting for review.</div>
      <button type="button" className="bruno-toast-link" onClick={onOpen}>Open Sync Tab</button>
    </div>
  );
};

// Lightweight thunk for polling — only checks hash, no deep comparison
export const checkCollectionForUpdates = (collection) => async (dispatch, getState) => {
  const syncConfig = getPrimaryOpenApiSource(collection);
  if (!syncConfig?.sourceUrl) {
    return null;
  }

  try {
    const { ipcRenderer } = window;
    const previousUpdate = getState().openapiSync?.collectionUpdates?.[collection.uid];
    const result = await ipcRenderer.invoke('renderer:check-openapi-updates', {
      collectionUid: collection.uid,
      collectionPath: collection.pathname,
      sourceUrl: syncConfig.sourceUrl,
      storedSpecHash: syncConfig.specHash || null,
      auth: syncConfig.auth,
      environmentContext: {
        activeEnvironmentUid: collection.activeEnvironmentUid,
        environments: collection.environments,
        runtimeVariables: collection.runtimeVariables,
        globalEnvironmentVariables: collection.globalEnvironmentVariables
      }
    });

    dispatch(setCollectionUpdate({
      collectionUid: collection.uid,
      hasUpdates: result.hasUpdates || false,
      error: result.error || null
    }));

    if (result.hasUpdates && !previousUpdate?.hasUpdates) {
      toast.custom(
        <OpenApiUpdateToast
          collectionName={collection.name}
          onOpen={() => dispatch(addTab({
            uid: `${collection.uid}-openapi-sync`,
            collectionUid: collection.uid,
            type: 'openapi-sync'
          }))}
        />,
        { duration: 6000 }
      );
    }

    return result;
  } catch (error) {
    console.error('[OpenAPI Sync] Error checking for updates:', error);
    dispatch(setCollectionUpdate({
      collectionUid: collection.uid,
      hasUpdates: false,
      error: error.message
    }));
    return null;
  }
};

// Thunk to check active workspace collections for updates (respects per-collection autoCheck and autoCheckInterval)
export const checkActiveWorkspaceCollectionsForUpdates = () => async (dispatch, getState) => {
  const state = getState();
  const collections = state.collections?.collections || [];
  const { workspaces, activeWorkspaceUid } = state.workspaces;
  const activeWorkspace = workspaces.find((w) => w.uid === activeWorkspaceUid);
  const now = Date.now();
  const defaultInterval = state.app?.preferences?.openapi?.defaultInterval || 5;

  // Filter to active workspace collections that have OpenAPI sync configured and auto-check enabled
  const syncableCollections = collections.filter((c) => {
    if (!activeWorkspace?.collections?.some((wc) => normalizePath(wc.path) === normalizePath(c.pathname))) {
      return false;
    }
    const syncConfig = getPrimaryOpenApiSource(c);
    if (!syncConfig?.sourceUrl) return false;
    if (syncConfig.autoCheck === false) return false;
    return true;
  });

  for (const collection of syncableCollections) {
    const syncConfig = getPrimaryOpenApiSource(collection);
    const intervalMs = (syncConfig.autoCheckInterval || defaultInterval) * 60 * 1000;
    const lastChecked = state.openapiSync?.collectionUpdates?.[collection.uid]?.lastChecked || 0;

    // Only check if enough time has elapsed since last check for this collection
    if (now - lastChecked >= intervalMs) {
      await dispatch(checkCollectionForUpdates(collection));
    }
  }

  dispatch(setLastPollTime(Date.now()));
};

export default openapiSyncSlice.reducer;
