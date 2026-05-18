# Git 功能完整设计文档

## 概述

为 Bruno 实现完整的 Git 工作流：Initialize Git、Git Status、Git Diff、Commit、Push、Pull。

当前状态：后端 `packages/bruno-electron/src/utils/git.js` 已实现大部分工具函数（initGit、commitChanges、pushGitChanges、pullGitChanges、getChangedFilesInCollectionGit 等），但只有 `clone-git-repository` 一个 IPC handler 注册。前端没有独立的 Git 面板。

---

## 1. 架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                       │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Git Panel   │  │ Diff Viewer  │  │ Branch Picker │  │
│  │ (Status/    │  │ (已有 Visual │  │               │  │
│  │  Commit)    │  │  DiffViewer) │  │               │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                │                   │          │
│  ┌──────┴────────────────┴───────────────────┴───────┐  │
│  │          Redux Slice: slices/git.js                │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │ ipcRenderer.invoke()           │
├─────────────────────────┼───────────────────────────────┤
│                         │ IPC Bridge                     │
├─────────────────────────┼───────────────────────────────┤
│                    Electron Main                         │
│  ┌──────────────────────┴────────────────────────────┐  │
│  │         ipc/git.js (registerGitIpc)               │  │
│  └──────────────────────┬────────────────────────────┘  │
│  ┌──────────────────────┴────────────────────────────┐  │
│  │              utils/git.js (已有)                    │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 2. IPC 接口设计

### 2.1 新增 IPC Handlers

在 `packages/bruno-electron/src/ipc/git.js` 中注册：

| IPC Channel | 参数 | 返回值 | 调用的 utils 函数 |
|---|---|---|---|
| `renderer:git-init` | `{ collectionPath }` | `void` | `initGit(collectionPath)` |
| `renderer:git-status` | `{ gitRootPath, collectionPath }` | `{ staged, unstaged, conflicted, totalFiles }` | `getChangedFilesInCollectionGit()` |
| `renderer:git-diff-file` | `{ gitRootPath, filePath, type: 'staged'\|'unstaged' }` | `string (diff)` | `getStagedFileDiff()` / `getUnstagedFileDiff()` |
| `renderer:git-stage` | `{ gitRootPath, files: string[] }` | `void` | `stageChanges()` |
| `renderer:git-unstage` | `{ gitRootPath, files: string[] }` | `void` | `unstageChanges()` |
| `renderer:git-discard` | `{ gitRootPath, files: string[] }` | `{ trackedFilesDiscarded, untrackedFilesDeleted }` | `discardChanges()` |
| `renderer:git-commit` | `{ gitRootPath, message }` | `CommitResult` | `commitChanges()` |
| `renderer:git-push` | `{ gitRootPath, remote, remoteBranch, processUid }` | `void` | `pushGitChanges()` |
| `renderer:git-pull` | `{ gitRootPath, remote, remoteBranch, strategy, processUid }` | `PullResult` | `pullGitChanges()` |
| `renderer:git-branches` | `{ gitRootPath }` | `{ branches, current }` | `getCollectionGitBranches()` + `getCurrentGitBranch()` |
| `renderer:git-checkout-branch` | `{ gitRootPath, branchName, shouldCreate, processUid }` | `void` | `checkoutGitBranch()` |
| `renderer:git-logs` | `{ gitRootPath }` | `CommitLog[]` | `getCollectionGitLogs()` |
| `renderer:git-remotes` | `{ gitRootPath }` | `Remote[]` | `fetchRemotes()` |
| `renderer:git-add-remote` | `{ gitRootPath, remoteName, remoteUrl }` | `Remote[]` | `addRemote()` |
| `renderer:git-fetch` | `{ gitRootPath, remote }` | `void` | `fetchChanges()` |
| `renderer:git-ahead-behind` | `{ gitRootPath }` | `{ ahead, behind, aheadCommits, behindCommits }` | `getAheadBehindCount()` |
| `renderer:git-stash-create` | `{ gitRootPath, message }` | `void` | `createStash()` |
| `renderer:git-stash-list` | `{ gitRootPath }` | `Stash[]` | `listStashes()` |
| `renderer:git-stash-apply` | `{ gitRootPath, stashIndex }` | `void` | `applyStash()` |
| `renderer:git-stash-drop` | `{ gitRootPath, stashIndex }` | `void` | `dropStash()` |

### 2.2 IPC 实现示例

```javascript
// packages/bruno-electron/src/ipc/git.js
const { ipcMain } = require('electron');
const {
  initGit, getChangedFilesInCollectionGit, getStagedFileDiff, getUnstagedFileDiff,
  stageChanges, unstageChanges, discardChanges, commitChanges,
  pushGitChanges, pullGitChanges, getCollectionGitBranches, getCurrentGitBranch,
  checkoutGitBranch, getCollectionGitLogs, fetchRemotes, addRemote,
  fetchChanges, getAheadBehindCount, cloneGitRepository,
  createStash, listStashes, applyStash, dropStash
} = require('../utils/git');
const { createDirectory, removeDirectory } = require('../utils/filesystem');

const registerGitIpc = (mainWindow) => {
  // --- Init ---
  ipcMain.handle('renderer:git-init', async (event, { collectionPath }) => {
    return await initGit(collectionPath);
  });

  // --- Status ---
  ipcMain.handle('renderer:git-status', async (event, { gitRootPath, collectionPath }) => {
    return await getChangedFilesInCollectionGit(gitRootPath, collectionPath);
  });

  // --- Diff ---
  ipcMain.handle('renderer:git-diff-file', async (event, { gitRootPath, filePath, type }) => {
    if (type === 'staged') return await getStagedFileDiff(gitRootPath, filePath);
    return await getUnstagedFileDiff(gitRootPath, filePath);
  });

  // --- Stage/Unstage/Discard ---
  ipcMain.handle('renderer:git-stage', async (event, { gitRootPath, files }) => {
    return await stageChanges(gitRootPath, files);
  });

  ipcMain.handle('renderer:git-unstage', async (event, { gitRootPath, files }) => {
    return await unstageChanges(gitRootPath, files);
  });

  ipcMain.handle('renderer:git-discard', async (event, { gitRootPath, files }) => {
    return await discardChanges(gitRootPath, files);
  });

  // --- Commit ---
  ipcMain.handle('renderer:git-commit', async (event, { gitRootPath, message }) => {
    return await commitChanges(gitRootPath, message);
  });

  // --- Push ---
  ipcMain.handle('renderer:git-push', async (event, { gitRootPath, remote, remoteBranch, processUid }) => {
    return await pushGitChanges(mainWindow, { gitRootPath, processUid, remote, remoteBranch });
  });

  // --- Pull ---
  ipcMain.handle('renderer:git-pull', async (event, { gitRootPath, remote, remoteBranch, strategy, processUid }) => {
    return await pullGitChanges(mainWindow, { gitRootPath, processUid, remote, remoteBranch, strategy });
  });

  // --- Clone (已有) ---
  ipcMain.handle('renderer:clone-git-repository', async (event, { url, path, processUid }) => {
    let directoryCreated = false;
    try {
      await createDirectory(path);
      directoryCreated = true;
      await cloneGitRepository(mainWindow, { url, path, processUid });
      return 'Repository cloned successfully';
    } catch (error) {
      if (directoryCreated) await removeDirectory(path);
      return Promise.reject(error);
    }
  });

  // --- Branches ---
  ipcMain.handle('renderer:git-branches', async (event, { gitRootPath }) => {
    const [branches, current] = await Promise.all([
      getCollectionGitBranches(gitRootPath),
      getCurrentGitBranch(gitRootPath)
    ]);
    return { branches, current };
  });

  ipcMain.handle('renderer:git-checkout-branch', async (event, { gitRootPath, branchName, shouldCreate, processUid }) => {
    return await checkoutGitBranch(mainWindow, { gitRootPath, branchName, processUid, shouldCreate });
  });

  // --- Logs ---
  ipcMain.handle('renderer:git-logs', async (event, { gitRootPath }) => {
    return await getCollectionGitLogs(gitRootPath);
  });

  // --- Remotes ---
  ipcMain.handle('renderer:git-remotes', async (event, { gitRootPath }) => {
    return await fetchRemotes(gitRootPath);
  });

  ipcMain.handle('renderer:git-add-remote', async (event, { gitRootPath, remoteName, remoteUrl }) => {
    return await addRemote({ gitRootPath, remoteName, remoteUrl });
  });

  ipcMain.handle('renderer:git-fetch', async (event, { gitRootPath, remote }) => {
    return await fetchChanges(gitRootPath, remote);
  });

  // --- Ahead/Behind ---
  ipcMain.handle('renderer:git-ahead-behind', async (event, { gitRootPath }) => {
    return await getAheadBehindCount(gitRootPath);
  });

  // --- Stash ---
  ipcMain.handle('renderer:git-stash-create', async (event, { gitRootPath, message }) => {
    return await createStash(gitRootPath, message);
  });

  ipcMain.handle('renderer:git-stash-list', async (event, { gitRootPath }) => {
    return await listStashes(gitRootPath);
  });

  ipcMain.handle('renderer:git-stash-apply', async (event, { gitRootPath, stashIndex }) => {
    return await applyStash(gitRootPath, stashIndex);
  });

  ipcMain.handle('renderer:git-stash-drop', async (event, { gitRootPath, stashIndex }) => {
    return await dropStash(gitRootPath, stashIndex);
  });
};

module.exports = registerGitIpc;
```

---

## 3. Redux State 设计

### 3.1 新增 Slice: `slices/git.js`

```javascript
// packages/bruno-app/src/providers/ReduxStore/slices/git.js

const initialState = {
  // 当前活跃的 collection 的 git 信息
  activeCollectionUid: null,
  gitRootPath: null,
  isGitRepo: false,

  // Status
  status: {
    loading: false,
    staged: [],      // { path, fileIndex, working_dir }
    unstaged: [],    // { path, fileIndex, working_dir }
    conflicted: [],
    totalFiles: 0,
  },

  // Diff
  activeDiff: {
    filePath: null,
    type: null, // 'staged' | 'unstaged'
    content: null,
    loading: false,
  },

  // Branches
  branches: {
    all: [],
    current: null,
    loading: false,
  },

  // Ahead/Behind
  sync: {
    ahead: 0,
    behind: 0,
    aheadCommits: [],
    behindCommits: [],
    loading: false,
  },

  // Commit log
  logs: [],

  // Remotes
  remotes: [],

  // Operation progress (push/pull)
  operationInProgress: null, // 'push' | 'pull' | 'fetch' | null
  operationProgress: '',

  // Stashes
  stashes: [],
};
```

### 3.2 Async Thunks

```javascript
// packages/bruno-app/src/providers/ReduxStore/slices/git/actions.js

export const initializeGitRepo = (collectionPath) => async (dispatch) => {
  await ipcRenderer.invoke('renderer:git-init', { collectionPath });
  dispatch(refreshGitStatus(collectionPath, collectionPath));
};

export const refreshGitStatus = (gitRootPath, collectionPath) => async (dispatch) => {
  dispatch(setStatusLoading(true));
  const status = await ipcRenderer.invoke('renderer:git-status', { gitRootPath, collectionPath });
  dispatch(setStatus(status));
};

export const stageFiles = (gitRootPath, files) => async (dispatch) => {
  await ipcRenderer.invoke('renderer:git-stage', { gitRootPath, files });
  // re-fetch status after staging
};

export const unstageFiles = (gitRootPath, files) => async (dispatch) => {
  await ipcRenderer.invoke('renderer:git-unstage', { gitRootPath, files });
};

export const discardFiles = (gitRootPath, files) => async (dispatch) => {
  await ipcRenderer.invoke('renderer:git-discard', { gitRootPath, files });
};

export const commitChanges = (gitRootPath, message) => async (dispatch) => {
  await ipcRenderer.invoke('renderer:git-commit', { gitRootPath, message });
};

export const pushChanges = (gitRootPath, remote, remoteBranch) => async (dispatch) => {
  const processUid = uuid();
  dispatch(setOperationInProgress('push'));
  await ipcRenderer.invoke('renderer:git-push', { gitRootPath, remote, remoteBranch, processUid });
  dispatch(setOperationInProgress(null));
};

export const pullChanges = (gitRootPath, remote, remoteBranch, strategy) => async (dispatch) => {
  const processUid = uuid();
  dispatch(setOperationInProgress('pull'));
  await ipcRenderer.invoke('renderer:git-pull', { gitRootPath, remote, remoteBranch, strategy, processUid });
  dispatch(setOperationInProgress(null));
};

export const fetchFileDiff = (gitRootPath, filePath, type) => async (dispatch) => {
  dispatch(setDiffLoading(true));
  const diff = await ipcRenderer.invoke('renderer:git-diff-file', { gitRootPath, filePath, type });
  dispatch(setActiveDiff({ filePath, type, content: diff }));
};
```

---

## 4. 页面与组件设计

### 4.1 入口：Collection Header Git 按钮

**位置:** `packages/bruno-app/src/components/RequestTabs/CollectionHeader/index.js`

在 Runner 按钮旁边添加 Git 按钮组：

```
[Runner] [↑ Push (2)] [↓ Pull (1)] [Git ⊞]
```

- 无 Git 仓库时显示 **"Initialize Git"** 按钮
- 有 Git 仓库时显示 Push/Pull 按钮 + Git 面板开关

### 4.2 Git Panel（新增核心组件）

**路径:** `packages/bruno-app/src/components/Git/GitPanel/`

```
packages/bruno-app/src/components/Git/GitPanel/
├── index.js                    # 主面板容器
├── StyledWrapper.js            # 样式
├── GitStatusTab/               # Status + Commit 标签页
│   ├── index.js
│   ├── FileList.js            # 文件变更列表（staged/unstaged 分区）
│   ├── FileItem.js            # 单个文件项（stage/unstage/discard 按钮）
│   └── CommitForm.js          # Commit message 输入 + 提交按钮
├── GitDiffTab/                 # Diff 查看标签页
│   ├── index.js
│   ├── UnifiedDiffView.js     # Unified diff 渲染
│   └── SplitDiffView.js       # Side-by-side diff 渲染
├── GitLogTab/                  # 历史日志标签页
│   ├── index.js
│   └── CommitRow.js           # 单条 commit 显示
├── GitBranchPicker/            # 分支切换下拉框
│   └── index.js
├── GitRemoteManager/           # Remote 管理
│   └── index.js
├── GitStashPanel/              # Stash 管理
│   └── index.js
└── InitializeGitModal/         # 初始化 Git 对话框
    └── index.js
```

### 4.3 各子组件详细设计

#### 4.3.1 GitPanel (主面板)

**展示位置:** 在 Collection 的 Response 面板区域下方，或作为侧边面板（类似 VS Code 的 Source Control）

```
┌─────────────────────────────────────────────────┐
│ [Branch: main ▾] [↑2 Push] [↓1 Pull] [⟳ Fetch] │
├────────┬──────────┬─────────────────────────────┤
│ Status │ History  │ Stash                       │
├────────┴──────────┴─────────────────────────────┤
│                                                 │
│  STAGED CHANGES (3)           [Unstage All]     │
│  ├─ M  src/api/users.bru     [− ≡]             │
│  ├─ A  src/api/posts.bru     [− ≡]             │
│  └─ D  src/api/old.bru       [− ≡]             │
│                                                 │
│  CHANGES (5)                  [Stage All]       │
│  ├─ M  src/api/auth.bru      [+ ✕ ≡]           │
│  ├─ ?  src/api/new.bru       [+ ✕ ≡]           │
│  └─ ...                                        │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ Commit message...                       │    │
│  └─────────────────────────────────────────┘    │
│  [Commit]                                       │
│                                                 │
└─────────────────────────────────────────────────┘
```

**操作说明:**
- `+` = Stage 文件
- `−` = Unstage 文件
- `✕` = Discard 变更（带确认对话框）
- `≡` = 查看 Diff

#### 4.3.2 InitializeGitModal

**触发:** 当 collection 不是 Git 仓库时，在 CollectionHeader 显示 "Initialize Git" 按钮

```
┌────────────────────────────────────────┐
│  Initialize Git Repository             │
│                                        │
│  This will create a .git folder in:    │
│  /path/to/collection                   │
│                                        │
│  Default branch: main                  │
│                                        │
│  □ Add .gitignore (recommended)        │
│  □ Add remote origin                   │
│    URL: [________________________]     │
│                                        │
│          [Cancel]  [Initialize]        │
└────────────────────────────────────────┘
```

**流程:**
1. 调用 `renderer:git-init` → 创建 `.git`，设 main 分支
2. 如勾选 .gitignore，写入默认 ignore 内容（node_modules, .env 等）
3. 如填写 remote URL，调用 `renderer:git-add-remote`
4. 刷新 Git 状态

#### 4.3.3 GitDiffTab

**触发:** 点击文件列表中的 `≡` 按钮

```
┌─────────────────────────────────────────────────┐
│ src/api/users.bru (Modified, Unstaged)  [Visual]│
├─────────────────────────────────────────────────┤
│  @@ -1,5 +1,7 @@                               │
│   meta {                                        │
│     name: Get Users                             │
│  -  method: GET                                 │
│  +  method: POST                                │
│  +  seq: 2                                      │
│   }                                             │
│                                                 │
└─────────────────────────────────────────────────┘
```

- **[Visual] 按钮:** 切换到已有的 VisualDiffViewer 组件（支持 .bru/.yml 文件的结构化对比）
- 支持 Unified / Split 两种视图模式

#### 4.3.4 GitBranchPicker

```
┌─────────────────────────────┐
│ 🔍 Filter branches...      │
├─────────────────────────────┤
│ ● main                      │
│   feature/auth              │
│   fix/login-bug             │
├─────────────────────────────┤
│ + Create new branch...      │
└─────────────────────────────┘
```

#### 4.3.5 Push/Pull 操作

**Push 按钮行为:**
1. 显示 ahead count badge: `↑2`
2. 点击后执行 push，显示进度条（通过 `main:update-git-operation-progress` 事件）
3. 完成后 toast 通知

**Pull 按钮行为:**
1. 显示 behind count badge: `↓1`
2. 点击后弹出策略选择（首次）:
   - `--ff-only` (Fast-forward only)
   - `--no-rebase` (Merge)
3. 执行 pull，有冲突时进入 conflict resolution 流程

---

## 5. 文件结构变更清单

### 新增文件

```
packages/bruno-app/src/components/Git/GitPanel/
  index.js
  StyledWrapper.js
  GitStatusTab/index.js
  GitStatusTab/FileList.js
  GitStatusTab/FileItem.js
  GitStatusTab/CommitForm.js
  GitDiffTab/index.js
  GitDiffTab/UnifiedDiffView.js
  GitLogTab/index.js
  GitLogTab/CommitRow.js
  GitBranchPicker/index.js
  InitializeGitModal/index.js
  InitializeGitModal/StyledWrapper.js

packages/bruno-app/src/providers/ReduxStore/slices/git.js
packages/bruno-app/src/providers/ReduxStore/slices/git/index.js
packages/bruno-app/src/providers/ReduxStore/slices/git/actions.js
```

### 修改文件

| 文件 | 变更 |
|---|---|
| `packages/bruno-electron/src/ipc/git.js` | 添加所有新 IPC handlers |
| `packages/bruno-app/src/components/RequestTabs/CollectionHeader/index.js` | 添加 Git 按钮组（Init / Push / Pull / Panel Toggle） |
| `packages/bruno-app/src/components/WorkspaceHome/WorkspaceOverview/CollectionsList/index.js` | 添加 Initialize Git 按钮（无 .git 时显示） |
| `packages/bruno-app/src/providers/ReduxStore/index.js` | 注册 git slice |
| `packages/bruno-app/src/providers/App.js` | 监听 `main:update-git-operation-progress` 事件 |

---

## 6. 数据流示例

### 6.1 Initialize Git 流程

```
用户点击 "Initialize Git"
  → dispatch(initializeGitRepo(collectionPath))
    → ipcRenderer.invoke('renderer:git-init', { collectionPath })
      → initGit(collectionPath) [git init + branch -M main]
    → 返回成功
  → dispatch(refreshGitStatus(collectionPath))
    → ipcRenderer.invoke('renderer:git-status', { gitRootPath, collectionPath })
    → 更新 Redux state
  → UI 切换为 Git 已初始化状态
```

### 6.2 Commit 流程

```
用户在 CommitForm 输入消息，点击 Commit
  → dispatch(commitChanges(gitRootPath, message))
    → ipcRenderer.invoke('renderer:git-commit', { gitRootPath, message })
      → commitChanges(gitRootPath, message)
    → 返回 CommitResult
  → dispatch(refreshGitStatus(...))  // 刷新状态
  → dispatch(refreshAheadBehind(...)) // 更新 push badge
  → toast.success('Changes committed')
```

### 6.3 Push 流程

```
用户点击 Push 按钮
  → dispatch(pushChanges(gitRootPath, 'origin', currentBranch))
    → setOperationInProgress('push')
    → ipcRenderer.invoke('renderer:git-push', {..., processUid})
      → pushGitChanges(mainWindow, {...})
        → 通过 outputHandler 发送进度事件
    → main:update-git-operation-progress → 更新 UI 进度条
    → 完成后 setOperationInProgress(null)
  → dispatch(refreshAheadBehind(...))
  → toast.success('Pushed successfully')
```

### 6.4 Pull 流程

```
用户点击 Pull 按钮
  → 弹出策略选择 (ff-only / merge)
  → dispatch(pullChanges(gitRootPath, 'origin', currentBranch, strategy))
    → setOperationInProgress('pull')
    → ipcRenderer.invoke('renderer:git-pull', {...})
    → 如果有冲突:
      → 返回 conflicted files
      → 进入 conflict resolution UI
    → 完成后刷新所有状态
```

---

## 7. UI 状态机

```
                        ┌──────────────┐
                        │ No Git Repo  │
                        │ (Show Init)  │
                        └──────┬───────┘
                               │ Initialize
                               ▼
                        ┌──────────────┐
                   ┌────│  Clean State │◄────────┐
                   │    │ (No changes) │         │
                   │    └──────────────┘         │
          Changes  │                             │ Commit
          detected │                             │
                   ▼                             │
            ┌──────────────┐    Stage     ┌─────┴────────┐
            │  Has Changes │────────────► │ Has Staged   │
            │  (Unstaged)  │◄──────────── │ (Ready)      │
            └──────────────┘   Unstage    └──────────────┘
                                                 │
                                                 │ Commit
                                                 ▼
                                          ┌──────────────┐
                                          │  Ahead of    │
                                          │  Remote      │
                                          └──────┬───────┘
                                                 │ Push
                                                 ▼
                                          ┌──────────────┐
                                          │  Synced      │
                                          └──────────────┘
```

---

## 8. 安全考虑

1. **路径验证:** IPC handler 中验证 `gitRootPath` 和 `collectionPath` 是否在允许的工作区范围内
2. **命令注入:** 不直接拼接用户输入到 shell 命令（已使用 simple-git 库）
3. **凭证处理:** Push/Pull 的 SSH/HTTPS 凭证由系统 git credential helper 处理，不在应用内存储密码
4. **大文件保护:** status 返回 `tooManyFiles: true` 时前端显示警告而非尝试渲染

---

## 9. 实施阶段

| 阶段 | 内容 | 依赖 |
|---|---|---|
| P1 | IPC handlers 全部注册 | 无（utils 函数已就绪） |
| P2 | Redux git slice + actions | P1 |
| P3 | InitializeGitModal + CollectionHeader Git 按钮 | P2 |
| P4 | GitPanel - Status Tab (文件列表 + Stage/Unstage/Discard) | P2 |
| P5 | GitPanel - CommitForm | P4 |
| P6 | GitPanel - Diff Tab（复用 VisualDiffViewer） | P4 |
| P7 | Push/Pull 按钮 + 进度显示 | P2 |
| P8 | GitBranchPicker | P2 |
| P9 | GitLogTab | P2 |
| P10 | Stash 管理 | P2 |
