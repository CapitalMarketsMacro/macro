# Workspace Platform Override Methods Reference

This document lists all available methods that can be overridden in the `createOverrideCallback` function for customizing OpenFin Workspace Platform behavior.

## Currently Implemented

The following methods are already implemented in `WorkspaceOverrideService`:

### Workspace Management
- ✅ `getSavedWorkspaces(query?: string): Promise<Workspace[]>`
- ✅ `getSavedWorkspacesMetadata(query?: string): Promise<Pick<Workspace, 'workspaceId' | 'title'>[]>`
- ✅ `getSavedWorkspace(id: string): Promise<Workspace | undefined>`
- ✅ `createSavedWorkspace(req: CreateSavedWorkspaceRequest): Promise<void>`
- ✅ `updateSavedWorkspace(req: UpdateSavedWorkspaceRequest): Promise<void>`
- ✅ `deleteSavedWorkspace(id: string): Promise<void>`
- ✅ `applyWorkspace(payload: ApplyWorkspacePayload): Promise<boolean>`

### Analytics
- ✅ `handleAnalytics(req: AnalyticsEvent[]): Promise<void>`

## Available for Override (Not Yet Implemented)

### Page Management

#### `getSavedPages(query?: string): Promise<Page[]>`
Get all saved pages from persistent storage with optional filtering.

**Use Case:** Customize page storage location (e.g., remote API, database)

#### `getSavedPage(id: string): Promise<Page | undefined>`
Get a single saved page by ID.

**Use Case:** Fetch pages from custom storage backend

#### `createSavedPage(req: CreateSavedPageRequest): Promise<void>`
Create a new saved page in persistent storage.

**Use Case:** Save pages to remote API or database

#### `updateSavedPage(req: UpdateSavedPageRequest): Promise<void>`
Update an existing saved page in persistent storage.

**Use Case:** Sync page updates to backend

#### `deleteSavedPage(id: string): Promise<void>`
Delete a saved page from persistent storage.

**Use Case:** Remove pages from custom storage

#### `handlePageChanges(payload: HandlePageChangesPayload): Promise<ModifiedPageState>`
Detect if page changes qualify as unsaved state.

**Use Case:** Custom logic for determining when a page is "dirty"

#### `copyPage(payload: CopyPagePayload): Promise<Page>`
Create a copy of a page (used for Save As or Duplicate).

**Use Case:** Customize page duplication behavior

#### `setActivePage(payload: SetActivePageForWindowPayload): Promise<void>`
Set the active page in a browser window.

**Use Case:** Track active page changes, update UI state

#### `addDefaultPage(payload: AddDefaultPagePayload): Promise<void>`
Add a custom default page.

**Use Case:** Provide custom default pages for new windows

### Context Menus

#### `openGlobalContextMenu(req: OpenGlobalContextMenuPayload, callerIdentity: OpenFin.Identity): Promise<void>`
Show a global context menu with custom menu items.

**Use Case:** Add custom actions to the global context menu

#### `openViewTabContextMenu(req: OpenViewTabContextMenuPayload, callerIdentity: OpenFin.Identity): Promise<void>`
Show a context menu for view tabs.

**Use Case:** Add custom actions when right-clicking view tabs

#### `openPageTabContextMenu(req: OpenPageTabContextMenuPayload, callerIdentity: OpenFin.Identity): Promise<void>`
Show a context menu for page tabs.

**Use Case:** Add custom actions when right-clicking page tabs

#### `openSaveButtonContextMenu(req: OpenSaveButtonContextMenuPayload, callerIdentity: OpenFin.Identity): Promise<void>`
Show a context menu for the save button.

**Use Case:** Add custom save options (Save As, Save to Cloud, etc.)

### Theme Management

#### `getSelectedScheme(): ColorSchemeOptionType | null | undefined`
Get the currently selected theme scheme (dark/light).

**Use Case:** Sync theme with user preferences or backend

#### `setSelectedScheme(schemeType: ColorSchemeOptionType): Promise<void>`
Set the selected theme scheme.

**Use Case:** Persist theme preference to backend or custom storage

### View Management

#### `createView(payload: BrowserCreateViewPayload, callerIdentity: OpenFin.Identity): Promise<OpenFin.View>`
Customize view creation behavior.

**Use Case:** 
- Add custom properties to views
- Modify view options before creation
- Track view creation events
- Apply custom styling or configuration

### Close/Unload Handling

#### `shouldPageClose(payload: ShouldPageClosePayload): Promise<ShouldPageCloseResult>`
Determine if a page should close (called when user tries to close a page).

**Use Case:** 
- Show custom confirmation dialogs
- Check for unsaved changes
- Prevent closing under certain conditions

#### `handlePagesAndWindowClose(payload: HandlePagesAndWindowClosePayload): Promise<HandlePagesAndWindowCloseResult>`
Handle window close when multiple pages are involved.

**Use Case:** 
- Custom logic for handling multiple pages preventing close
- Show consolidated confirmation dialog

#### `getUserDecisionForBeforeUnload(payload: ViewsPreventingUnloadPayload): Promise<OpenFin.BeforeUnloadUserDecision>`
Handle user decision when views are preventing unload.

**Use Case:** 
- Show custom dialog for beforeunload events
- Allow user to choose which views to close

#### `handleSaveModalOnPageClose(payload: HandleSaveModalOnPageClosePayload): Promise<SaveModalOnPageCloseResult>`
Control whether to show save modal when closing a page with unsaved changes.

**Use Case:** 
- Customize save modal behavior
- Integrate with custom save workflows

### Dock Provider

#### `getDockProviderConfig(id: string): Promise<DockProviderConfigWithIdentity | undefined>`
Get dock provider configuration from persistent storage.

**Use Case:** Store dock configurations in custom backend

#### `saveDockProviderConfig(config: DockProviderConfigWithIdentity): Promise<void>`
Save dock provider configuration to persistent storage.

**Use Case:** Persist dock configurations to custom storage

### Localization

#### `getLanguage(): Promise<Locale>`
Get the current selected language.

**Use Case:** Sync language with user preferences

#### `setLanguage(locale: Locale): Promise<void>`
Set the application language.

**Use Case:** Persist language preference to backend

## Example: Adding a Custom Override

To add a custom override method, add it to the `CustomWorkspacePlatformProvider` class in `workspace-override.service.ts`:

```typescript
async createSavedPage(req: CreateSavedPageRequest): Promise<void> {
  logger.info('Creating saved page', { pageId: req.page.pageId });
  
  // Custom implementation - e.g., save to API
  await fetch('/api/pages', {
    method: 'POST',
    body: JSON.stringify(req.page),
    headers: { 'Content-Type': 'application/json' }
  });
  
  // Call parent if you want default behavior too
  return super.createSavedPage(req);
}
```

## Best Practices

1. **Always call `super.method()`** if you want to preserve default behavior
2. **Log important operations** for debugging
3. **Handle errors gracefully** - wrap in try/catch if needed
4. **Use async/await** for all override methods
5. **Return the expected types** - check TypeScript types for return values

## Type Imports

All types are available from `@openfin/workspace-platform`:

```typescript
import type {
  Page,
  CreateSavedPageRequest,
  UpdateSavedPageRequest,
  // ... other types
} from '@openfin/workspace-platform';
```

