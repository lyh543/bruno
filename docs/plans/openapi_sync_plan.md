# OpenAPI 自动定时同步与差异变更通知 — 设计文档

## 1. System Architecture & Data Flow

### 1.1 模块拓扑图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Renderer Process (React/Redux)                     │
│                                                                           │
│  ┌──────────────────┐   ┌──────────────────────┐   ┌────────────────┐   │
│  │  OpenAPISyncTab   │   │  useOpenAPISyncPolling│   │  Notifications │   │
│  │  (Settings UI)    │   │  (Timer Hook)         │   │  (Toast/Badge) │   │
│  └────────┬─────────┘   └──────────┬───────────┘   └───────▲────────┘   │
│           │                         │                        │            │
│           ▼                         ▼                        │            │
│  ┌───────────────────────────────────────────────────────────┤            │
│  │              Redux Store (openapiSync slice)               │            │
│  │  - collectionUpdates{}   - pollingEnabled                 │            │
│  │  - syncStatus{}          - lastCheckTimestamps{}          │            │
│  └───────────────────────────────────────────┬───────────────┘            │
│                                              │                            │
│                                   ipcRenderer.invoke()                    │
└──────────────────────────────────────────────┼────────────────────────────┘
                                               │
                              ─────── IPC Bridge ───────
                                               │
┌──────────────────────────────────────────────┼────────────────────────────┐
│                        Main Process (Electron)                             │
│                                              │                            │
│  ┌───────────────────────────────────────────▼───────────────────────┐   │
│  │               openapi-sync.js (IPC Handlers)                       │   │
│  │  - renderer:check-openapi-updates                                  │   │
│  │  - renderer:compare-openapi-specs                                  │   │
│  │  - renderer:apply-openapi-sync                                     │   │
│  │  - renderer:update-openapi-sync-config                             │   │
│  │  - renderer:fetch-openapi-spec                                     │   │
│  │  - renderer:get-collection-drift                                   │   │
│  └──────────┬────────────────────┬─────────────────────┬─────────────┘   │
│             │                    │                      │                  │
│             ▼                    ▼                      ▼                  │
│  ┌──────────────────┐  ┌─────────────────┐  ┌──────────────────────┐    │
│  │  Spec Fetcher    │  │  Diff Engine     │  │  File I/O            │    │
│  │  (Axios + Auth)  │  │  (compareSpecs)  │  │  (BRU/YML R/W)      │    │
│  └──────────────────┘  └─────────────────┘  └──────────────────────┘    │
│                                                                           │
│  Storage:                                                                 │
│  ├── %AppData%/bruno/specs/          ← Cached spec files (UUID.json)     │
│  ├── %AppData%/bruno/specs/metadata.json  ← Spec → collection mapping   │
│  └── <collection>/bruno.json         ← openapi[] config (persisted)      │
│      <collection>/opencollection.yml  ← (YML format alternative)         │
└───────────────────────────────────────────────────────────────────────────┘
```

### 1.2 数据流：从定时器触发到 UI 通知

```
1. [Renderer] useOpenAPISyncPolling 每5分钟触发一次
       │
       ▼
2. [Renderer] dispatch(checkActiveWorkspaceCollectionsForUpdates())
       │  - 遍历当前 Workspace 下所有 Collection
       │  - 过滤出 openapi[0].autoCheck !== false 且已过 autoCheckInterval 的
       │
       ▼
3. [IPC] ipcRenderer.invoke('renderer:check-openapi-updates', {
       collectionUid, collectionPath, sourceUrl, storedSpecHash, environmentContext
   })
       │
       ▼
4. [Main] fetchSpecFromSource() → 从 URL/File 获取最新 Spec
       │  - 支持 HTTP(S) URL + Proxy/Cert
       │  - 支持本地文件路径 (相对/绝对)
       │  - 自定义 Auth Headers (通过 environmentContext 注入)
       │
       ▼
5. [Main] generateSpecHash(remoteSpec) !== storedSpecHash → hasUpdates: true
       │
       ▼
6. [Renderer] Redux: setCollectionUpdate(collectionUid, { hasUpdates: true })
       │
       ▼
7. [Renderer] UI 展示通知 Badge + Toast:
       - Sidebar 对应 Collection 显示蓝色圆点
       - 右下角 Toast "Collection X has OpenAPI updates available"
       │
       ▼
8. [User] 点击进入 OpenAPI Sync Tab → 查看差异详情
       │
       ▼
9. [IPC] ipcRenderer.invoke('renderer:compare-openapi-specs', {...})
       │
       ▼
10. [Main] compareSpecs(storedSpec, newSpec) → { added[], removed[], modified[] }
       │
       ▼
11. [Renderer] 展示 Diff Viewer（新增/删除/修改的 Endpoint 列表）
       │
       ▼
12. [User] 逐项确认（接受/拒绝），点击 "Apply"
       │
       ▼
13. [IPC] ipcRenderer.invoke('renderer:apply-openapi-sync', {
       collectionPath, addNewRequests, removeDeletedRequests,
       diff, endpointDecisions, mode
   })
       │
       ▼
14. [Main] 执行变更：创建/更新/删除 .bru/.yml 文件
       - 保存新 Spec 文件到 AppData
       - 更新 brunoConfig.openapi[0].lastSyncDate / specHash
       │
       ▼
15. [Renderer] FileWatcher 检测文件变更 → 自动重新加载 Collection 到 Redux
```

---

## 2. Database & File Schema

### 2.1 Collection 配置文件 (`bruno.json` / `opencollection.yml`)

现有的 `openapi` 配置结构已支持基础同步元数据，本设计在此基础上扩展自定义 Auth Header：

```jsonc
// bruno.json
{
  "name": "My API Collection",
  "version": "1",
  "type": "collection",
  "openapi": [
    {
      // === 现有字段 ===
      "sourceUrl": "https://api.example.com/openapi.json",  // URL 或相对文件路径
      "groupBy": "tags",            // "tags" | "path"
      "lastSyncDate": "2025-05-18T10:30:00.000Z",
      "specHash": "a3f2e8d1c4b5...", // MD5 of parsed spec JSON
      "autoCheck": true,             // 是否启用自动检查
      "autoCheckInterval": 5,        // 检查间隔（分钟）

      // === 新增字段 ===
      "auth": {
        "mode": "none",  // "none" | "basic" | "bearer" | "apikey" | "custom-headers"
        "basic": {
          "username": "{{OPENAPI_USER}}",
          "password": "{{OPENAPI_PASS}}"
        },
        "bearer": {
          "token": "{{OPENAPI_TOKEN}}"
        },
        "apikey": {
          "key": "X-API-Key",
          "value": "{{API_KEY}}",
          "placement": "header"  // "header" | "query"
        },
        "customHeaders": [
          { "name": "Authorization", "value": "{{AUTH_HEADER}}", "enabled": true },
          { "name": "Cookie", "value": "session={{SESSION_ID}}", "enabled": true }
        ]
      }
    }
  ]
}
```

### 2.2 YML 格式 (`opencollection.yml`) 中的等价表示

```yaml
extensions:
  bruno:
    openapi:
      - sourceUrl: "https://api.example.com/openapi.json"
        groupBy: tags
        lastSyncDate: "2025-05-18T10:30:00.000Z"
        specHash: "a3f2e8d1c4b5..."
        autoCheck: true
        autoCheckInterval: 5
        auth:
          mode: bearer
          bearer:
            token: "{{OPENAPI_TOKEN}}"
```

### 2.3 Spec 缓存元数据 (`%AppData%/bruno/specs/metadata.json`)

```jsonc
{
  "/path/to/collection": [
    {
      "filename": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.json",
      "sourceUrl": "https://api.example.com/openapi.json"
    }
  ]
}
```

### 2.4 数据源 (DataSource) 抽象模型

```typescript
interface OpenAPIDataSource {
  // 标识
  sourceUrl: string;           // 唯一标识，URL 或相对文件路径
  
  // 同步配置
  groupBy: 'tags' | 'path';
  autoCheck: boolean;
  autoCheckInterval: number;   // 分钟
  
  // 同步状态（自动维护）
  lastSyncDate: string | null; // ISO 8601
  specHash: string | null;     // MD5 hash
  
  // 认证配置
  auth: DataSourceAuth;
}

interface DataSourceAuth {
  mode: 'none' | 'basic' | 'bearer' | 'apikey' | 'custom-headers';
  basic?: { username: string; password: string };
  bearer?: { token: string };
  apikey?: { key: string; value: string; placement: 'header' | 'query' };
  customHeaders?: Array<{ name: string; value: string; enabled: boolean }>;
}
```

> **关系**：每个 Collection 的 `brunoConfig.openapi[]` 数组当前仅支持单元素（1:1 关系）。未来可扩展为多数据源（N:1）。

---

## 3. IPC & API Design

### 3.1 现有 IPC 通道（已实现）

| Channel | Direction | Payload | Response |
|---------|-----------|---------|----------|
| `renderer:check-openapi-updates` | Renderer → Main | `{ collectionUid, collectionPath, sourceUrl, storedSpecHash, environmentContext }` | `{ hasUpdates, remoteSpecHash, error? }` |
| `renderer:compare-openapi-specs` | Renderer → Main | `{ collectionUid, collectionPath, sourceUrl, environmentContext }` | `{ isValid, added[], removed[], modified[], unchanged[], unifiedDiff, newSpec, newSpecContent, ... }` |
| `renderer:apply-openapi-sync` | Renderer → Main | `{ collectionPath, addNewRequests, removeDeletedRequests, diff, localOnlyToRemove[], driftedToReset[], mode, endpointDecisions }` | `{ success, mode? }` |
| `renderer:update-openapi-sync-config` | Renderer → Main | `{ collectionPath, config }` | `{ success }` |
| `renderer:get-collection-drift` | Renderer → Main | `{ collectionPath, compareSpec? }` | `{ inSync[], modified[], localOnly[], missing[], specEndpointCount, collectionEndpointCount }` |
| `renderer:get-endpoint-diff-data` | Renderer → Main | `{ collectionPath, endpointId, newSpec? }` | `{ oldData, newData, error? }` |
| `renderer:fetch-openapi-spec` | Renderer → Main | `{ collectionUid, collectionPath, sourceUrl, environmentContext }` | `{ content?, error? }` |
| `renderer:read-openapi-spec` | Renderer → Main | `{ collectionPath }` | `{ content?, error? }` |
| `renderer:save-openapi-spec` | Renderer → Main | `{ collectionPath, specContent }` | `{ success }` |
| `renderer:remove-openapi-sync-config` | Renderer → Main | `{ collectionPath, deleteSpecFile? }` | `{ success }` |
| `renderer:add-missing-endpoints` | Renderer → Main | `{ collectionPath, endpoints[] }` | `{ success, addedCount }` |
| `renderer:reset-endpoints-to-spec` | Renderer → Main | `{ collectionPath, endpoints[] }` | `{ success, resetCount }` |
| `renderer:delete-endpoints` | Renderer → Main | `{ collectionPath, endpoints[] }` | `{ success, deletedCount }` |

### 3.2 新增 IPC 通道（Auth Headers 支持）

| Channel | Direction | Payload | Response |
|---------|-----------|---------|----------|
| `renderer:update-openapi-sync-config` | Renderer → Main | 新增 `config.auth` 字段 | `{ success }` |

**扩展 `config` 的 allowedKeys**：

```javascript
// openapi-sync.js - update-openapi-sync-config handler
const allowedKeys = [
  'sourceUrl', 'groupBy', 'lastSyncDate', 'specHash',
  'autoCheck', 'autoCheckInterval',
  'auth'  // ← 新增
];
```

**扩展 `fetchSpecFromSource` 支持 Auth Headers**：

```javascript
// 新签名
const fetchSpecFromSource = async ({
  collectionUid, collectionPath, sourceUrl,
  environmentContext = {},
  auth = {}  // ← 新增：DataSourceAuth 对象
}) => { ... };
```

### 3.3 Fetch 时 Auth Header 注入逻辑

```javascript
// 根据 auth.mode 构造请求 Headers
const buildAuthHeaders = (auth, interpolate) => {
  const headers = {};
  
  switch (auth?.mode) {
    case 'basic': {
      const username = interpolate(auth.basic?.username || '');
      const password = interpolate(auth.basic?.password || '');
      headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
      break;
    }
    case 'bearer': {
      const token = interpolate(auth.bearer?.token || '');
      headers['Authorization'] = `Bearer ${token}`;
      break;
    }
    case 'apikey': {
      if (auth.apikey?.placement === 'header') {
        headers[auth.apikey.key] = interpolate(auth.apikey.value || '');
      }
      // query placement 在 URL 参数中注入
      break;
    }
    case 'custom-headers': {
      for (const h of auth.customHeaders || []) {
        if (h.enabled) {
          headers[h.name] = interpolate(h.value || '');
        }
      }
      break;
    }
  }
  
  return headers;
};
```

---

## 4. Backend/Main Process Implementation

### 4.1 定时任务调度器

**当前实现方式**：Renderer 侧的 `useOpenAPISyncPolling` Hook 使用 `setInterval` 每5分钟触发一次检查。

**架构选择理由**：
- Bruno 为 Electron 桌面应用，无需 Node.js cron 库
- 轮询由 Renderer 侧驱动，Main 侧仅响应 IPC 请求
- 好处：UI 可控制暂停/恢复，且 Redux 自然管理状态

**增强设计：per-collection interval**

```javascript
// useOpenAPISyncPolling.js - 已有实现
// 每5分钟全局轮询一次，实际检查在 thunk 中按 per-collection interval 过滤

// openapi-sync.js (Redux slice) - checkActiveWorkspaceCollectionsForUpdates
export const checkActiveWorkspaceCollectionsForUpdates = () => async (dispatch, getState) => {
  const state = getState();
  const collections = state.collections.collections;
  const lastChecks = state.openapiSync.lastCheckTimestamps;

  for (const collection of collectionsToCheck) {
    const syncConfig = collection.brunoConfig?.openapi?.[0];
    if (!syncConfig?.sourceUrl || syncConfig.autoCheck === false) continue;

    // Per-collection interval check
    const intervalMs = (syncConfig.autoCheckInterval || 5) * 60 * 1000;
    const lastCheck = lastChecks[collection.uid] || 0;
    if (Date.now() - lastCheck < intervalMs) continue;

    // Perform lightweight hash check
    const result = await ipcRenderer.invoke('renderer:check-openapi-updates', {
      collectionUid: collection.uid,
      collectionPath: collection.pathname,
      sourceUrl: syncConfig.sourceUrl,
      storedSpecHash: syncConfig.specHash,
      environmentContext: buildEnvironmentContext(state, collection)
    });

    dispatch(setLastCheckTimestamp({ collectionUid: collection.uid, timestamp: Date.now() }));

    if (result.hasUpdates) {
      dispatch(setCollectionUpdate({ collectionUid: collection.uid, hasUpdates: true }));
      // Toast notification
      dispatch(addNotification({
        type: 'info',
        text: `"${collection.name}" has OpenAPI spec updates available`
      }));
    }
  }
};
```

### 4.2 带 Auth Header 的网络请求器

扩展 `fetchSpecFromSource`，从 `brunoConfig.openapi[0].auth` 读取认证配置：

```javascript
const fetchSpecFromSource = async ({
  collectionUid, collectionPath, sourceUrl, environmentContext = {}
}) => {
  // ... 现有逻辑 (URL/文件路径判断) ...

  if (isValidHttpUrl(sourceUrl)) {
    // 1. 构建 Axios 实例（Proxy/Cert）
    const axiosInstance = makeAxiosInstance({ proxyMode, proxyConfig, httpsAgentRequestFields });

    // 2. 读取 auth 配置
    const { brunoConfig } = loadBrunoConfig(collectionPath);
    const auth = brunoConfig?.openapi?.[0]?.auth;

    // 3. 构建 interpolation 函数（支持 {{ENV_VAR}} 模板变量）
    const interpolate = (str) => Mustache.render(str, {
      ...envVars, ...processEnvVars, ...runtimeVariables, ...globalEnvironmentVariables
    });

    // 4. 生成 Auth Headers
    const authHeaders = buildAuthHeaders(auth, interpolate);

    // 5. 处理 API Key in query params
    let fetchUrl = cacheBustUrl;
    if (auth?.mode === 'apikey' && auth.apikey?.placement === 'query') {
      const separator = fetchUrl.includes('?') ? '&' : '?';
      fetchUrl += `${separator}${auth.apikey.key}=${encodeURIComponent(interpolate(auth.apikey.value))}`;
    }

    // 6. 发起请求
    const response = await axiosInstance.get(fetchUrl, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        ...authHeaders  // ← Auth headers 注入
      },
      timeout: 30000,
      transformResponse: [(data) => data]
    });
    content = response.data;
  }
  // ...
};
```

### 4.3 OpenAPI 差异对比算法 (Diff Engine)

**已实现的 Diff 策略**（`compareSpecs` 函数）：

```
输入：storedSpec (旧) + newSpec (新) + groupBy
       │
       ▼
Step 1: 两边都通过 openApiToBruno() 转换为 Bruno Collection 格式
       │
       ▼
Step 2: buildSpecItemsMap() 将 items[] 树结构展平为 Map<"METHOD:path", item>
       │
       ▼
Step 3: 双向遍历对比
       ├── newItems 有，oldItems 无 → added[]
       ├── oldItems 有，newItems 无 → removed[]
       └── 两者都有 → compareRequestFields() 进行字段级对比
                        ├── params (name:type 对)
                        ├── headers (name 集合)
                        ├── body mode + form fields / JSON schema keys
                        ├── auth mode + config
                        └── hasDiff ? modified[] : unchanged[]
       │
       ▼
Step 4: 元数据对比 (title, version, description)
       │
       ▼
Step 5: 生成 unifiedDiff (text diff via 'diff' library)
```

**Collection Drift 检测**（`get-collection-drift`）：

```
storedSpec (AppData中缓存) → openApiToBruno → specItemsMap
                                                    ↕ 对比
collection 目录递归扫描 .bru/.yml → parseRequest → collectionEndpoints
                                                    │
                                                    ▼
结果分类：inSync[] / modified[] / localOnly[] / missing[]
```

---

## 5. Frontend & Component Design

### 5.1 设置页面组件层级

```
<Preferences>                           // 系统设置弹窗
  ├── <Tab label="General" />
  ├── <Tab label="Themes" />
  ├── <Tab label="Display" />
  ├── <Tab label="Keybindings" />
  ├── <Tab label="Beta">                // Beta 标签中的 Feature Flag
  │     └── <BetaFeatureToggle>
  │           └── "OpenAPI Sync" toggle  ← 控制整个功能开关
  ├── ...
  └── <Tab label="OpenAPI" />           // ★ 新增全局标签页
        └── <OpenAPIGlobalSettings>
              ├── <GlobalPollingToggle />    // 全局轮询开关
              ├── <DefaultIntervalPicker />  // 默认检查间隔
              └── <DataSourceList />         // 所有 Collection 的数据源列表
                    └── <DataSourceRow>      // 每行：名称、URL、状态...
                          ├── 名称 (Collection Name)
                          ├── Source URL/Path
                          ├── Sync Interval
                          ├── Last Sync Time
                          ├── Total Endpoints (spec)
                          ├── Synced Endpoints (collection)
                          ├── Status Badge (In Sync / Updates Available / Error)
                          └── Actions: [Sync Now] [Settings] [Disconnect]
```

### 5.2 Per-Collection OpenAPI Sync Tab（已实现）

```
<OpenAPISyncTab>                          // Collection 级别的同步标签页
  ├── <OverviewSection>                   // 概览信息
  │     ├── Source URL
  │     ├── Last Sync Date
  │     ├── Auto Check: Every X min
  │     ├── Spec Endpoints / Collection Endpoints
  │     └── [Check for Updates] [Settings]
  │
  ├── <ConnectionSettingsModal>           // 连接设置弹窗
  │     ├── Source URL input
  │     ├── Group By (tags/path) select
  │     ├── Auto Check toggle + Interval input
  │     └── <AuthSettings>               // ★ 新增 Auth 配置区域
  │           ├── Auth Mode dropdown (None/Basic/Bearer/API Key/Custom Headers)
  │           ├── <BasicAuthForm>         // username + password inputs
  │           ├── <BearerTokenForm>       // token input
  │           ├── <ApiKeyForm>            // key + value + placement
  │           └── <CustomHeadersTable>    // Editable table of headers
  │
  ├── <SpecDriftSection>                  // Remote Spec 变更
  │     ├── <SpecDiffSummary>             // +N added, -N removed, ~N modified
  │     ├── <EndpointList>                // 变更列表，可展开查看详情
  │     │     └── <EndpointDiffRow>
  │     │           ├── Method Badge (GET/POST/...)
  │     │           ├── Path
  │     │           ├── Change Type (Added/Removed/Modified)
  │     │           ├── Change Detail ("+2 params, body: json")
  │     │           └── [View Diff] [Accept] [Reject]
  │     └── Actions: [Accept All] [Reject All] [Apply Selected]
  │
  └── <CollectionDriftSection>            // Collection 本地漂移
        ├── <DriftSummary>                // In Sync / Modified / Local Only / Missing
        └── <DriftEndpointList>
              └── <DriftEndpointRow>
                    ├── Status (Modified / Local Only / Missing)
                    ├── Method + Path
                    └── [View Diff] [Reset to Spec] [Keep Mine]
```

### 5.3 Diff Viewer UI 交互设计

**Endpoint Diff Modal** (`<VisualDiffViewer>`):

```
┌─────────────────────────────────────────────────────────────┐
│  Endpoint Diff: GET /api/users/{id}                    [×]  │
├─────────────────────────────────────────────────────────────┤
│  [Visual Diff]  [Text Diff]                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ URL ────────────────────────────────────────────────┐  │
│  │  - {{baseUrl}}/api/users/{id}                        │  │
│  │  + {{baseUrl}}/api/v2/users/{id}                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ Parameters ─────────────────────────────────────────┐  │
│  │  Name       Type    Value           Status           │  │
│  │  id         path    {{userId}}      unchanged        │  │
│  │  fields     query   *               + added          │  │
│  │  version    query   v1              - removed         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ Headers ────────────────────────────────────────────┐  │
│  │  Accept: application/json           unchanged        │  │
│  │  X-Request-ID: {{reqId}}            + added          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ Body (JSON) ────────────────────────────────────────┐  │
│  │  Schema changes: +2 fields, -1 field                 │  │
│  │  + "email": "string"                                 │  │
│  │  + "phone": "string"                                 │  │
│  │  - "legacy_id": "number"                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│              [Keep Mine]           [Accept Incoming]         │
└─────────────────────────────────────────────────────────────┘
```

**Text Diff View** (unified diff):

```
┌─────────────────────────────────────────────────────────────┐
│  [Visual Diff]  [Text Diff]                                 │
├─────────────────────────────────────────────────────────────┤
│  --- openapi.json (Current Spec)                            │
│  +++ openapi.json (New Spec)                                │
│  @@ -142,7 +142,9 @@                                       │
│     "/api/users/{id}": {                                    │
│       "get": {                                              │
│  -      "summary": "Get user",                              │
│  +      "summary": "Get user by ID",                        │
│         "parameters": [                                     │
│  +        { "name": "fields", "in": "query" },              │
│           { "name": "id", "in": "path" }                    │
│         ]                                                   │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 通知机制

| 触发场景 | 通知方式 | 详情 |
|---------|---------|------|
| 自动检查发现更新 | Toast + Sidebar Badge | `"{Collection}" has OpenAPI spec updates` |
| 同步成功 | Toast (success) | `Sync complete: +3 added, ~2 modified, -1 removed` |
| 同步失败 | Toast (error) | `Failed to sync: {error message}` |
| Spec 获取失败 | Redux state + UI error | Error message in OverviewSection |

---

## 6. Security Considerations

### 6.1 认证凭证存储安全

**方案：环境变量模板 (Template Variables)**

- 所有敏感值（Token、密码、API Key）使用 `{{VARIABLE_NAME}}` 模板语法存储
- 实际值通过 Bruno 的 Environment 或 `.env` 文件注入
- `bruno.json` / `opencollection.yml` 中不存储明文密码
- `.env` 文件已在 `.gitignore` 中排除

```jsonc
// bruno.json - 安全存储示例
{
  "openapi": [{
    "auth": {
      "mode": "bearer",
      "bearer": {
        "token": "{{OPENAPI_TOKEN}}"  // ← 非明文，运行时从环境变量解析
      }
    }
  }]
}
```

```ini
# .env (不入库)
OPENAPI_TOKEN=sk-live-xxxxxxxxxxxx
OPENAPI_USER=admin
OPENAPI_PASS=s3cr3t!
```

### 6.2 传输安全

| 威胁 | 防护措施 |
|------|---------|
| 中间人攻击 | 默认使用 HTTPS；支持自定义 CA 证书（bruno 已有 clientCertificates 机制） |
| URL 注入 | `isValidHttpUrl()` 严格验证仅允许 `http:` / `https:` 协议 |
| 路径遍历 | `isPathInsideCollection()` 验证所有文件操作路径不超出 collection 目录 |
| SSRF | 用户可见且需手动配置 URL，非自动发现；Proxy 设置可用于网络隔离 |

### 6.3 本地存储安全

| 数据 | 存储位置 | 安全措施 |
|------|---------|---------|
| Spec 缓存文件 | `%AppData%/bruno/specs/` | OS 级用户权限保护 |
| metadata.json | `%AppData%/bruno/specs/` | 仅包含文件名映射，无敏感数据 |
| Auth 配置 | `bruno.json` (项目内) | 使用模板变量，实际值在 `.env` |
| Environment 变量 | `.env` 文件 | `.gitignore` 排除 |

### 6.4 IPC 安全

- 所有 IPC handler 使用 `ipcMain.handle` (request-reply 模式)，而非 `ipcMain.on` (fire-and-forget)
- 输入参数经过白名单校验（`allowedKeys`）
- 文件操作前均执行 `isPathInsideCollection()` 路径安全检查
- 远程 URL 请求添加 `timeout: 30000` 防止无限等待

---

## 7. Implementation Roadmap

### Phase 1: Auth Headers 支持（扩展现有）
1. 扩展 `brunoConfig.openapi[].auth` 数据结构
2. 修改 `fetchSpecFromSource` 注入 Auth Headers
3. 更新 `update-openapi-sync-config` 白名单
4. 前端 `<ConnectionSettingsModal>` 新增 Auth 配置表单

### Phase 2: 全局数据源列表页
1. 在 Preferences 中新增 `OpenAPI` 标签页
2. 实现 `<DataSourceList>` 组件，聚合所有 Collection 的同步状态
3. 支持全局暂停/恢复轮询

### Phase 3: 增强通知系统
1. Sidebar Badge（Collection 图标旁显示更新标记）
2. Toast 通知增强（可点击跳转到 Sync Tab）
3. 通知历史记录（可选）

### Phase 4: 多数据源支持（N:1）
1. `openapi[]` 数组支持多元素
2. 每个数据源可映射到 Collection 下不同子目录
3. 冲突解决：多个数据源对同一 Endpoint 的变更合并策略
