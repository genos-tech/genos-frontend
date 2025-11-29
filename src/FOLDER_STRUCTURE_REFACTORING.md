# Folder Structure Refactoring Summary

## Overview
This document outlines the refactoring of the `src/` folder structure to improve organization, maintainability, and developer experience.

## Changes Made

### 1. Consolidated Utilities
**Before:**
- `utils.tsx` (sidebar utilities at root level)
- `utils/` (various utility functions)
- `useScript.ts` (React hook at root level)

**After:**
- `utils/sidebarUtils.ts` (moved from `utils.tsx`)
- `utils/` (consolidated all utilities)
- `hooks/common/useScript.ts` (moved from root to proper hooks folder)

### 2. Reorganized Components
**Before:**
```
components/
├── blockNote/          # Editor components
├── common/             # Avatar components
├── emojiInput/         # Emoji pickers and reactions
├── utils/              # Utility components
├── layout/             # Layout components
└── App/                # App wrapper
```

**After:**
```
components/
├── ui/
│   ├── avatars/        # Avatar components (from common/)
│   ├── emoji/          # Emoji pickers and reactions (from emojiInput/)
│   └── misc/           # Utility components (from utils/)
├── editors/            # BlockNote editor components (from blockNote/)
├── layout/             # Layout components (unchanged)
└── App/                # App wrapper (unchanged)
```

### 3. Moved Workers to Database Module
**Before:**
```
src/
├── workers/            # 34 worker files at root level
└── db/                 # Database related code
```

**After:**
```
src/
└── db/
    ├── workers/        # All worker files moved here
    ├── repositories/
    ├── services/
    └── ...
```

### 4. Assets Organization
**Current Structure:**
```
assets/
├── GithubIcon.tsx
└── GoogleIcon.tsx
```
*(Note: Only 2 icon files, kept at root level for simplicity)*

## Detailed File Movements

### Components
| Old Path | New Path |
|----------|----------|
| `components/common/avatarWithStatus.tsx` | `components/ui/avatars/avatarWithStatus.tsx` |
| `components/common/GMAvatar.tsx` | `components/ui/avatars/GMAvatar.tsx` |
| `components/common/ProjectAvatar.tsx` | `components/ui/avatars/ProjectAvatar.tsx` |
| `components/emojiInput/EmojiPicker.tsx` | `components/ui/emoji/EmojiPicker.tsx` |
| `components/emojiInput/EmojiReaction.tsx` | `components/ui/emoji/EmojiReaction.tsx` |
| `components/emojiInput/ReactionTaskCommentEmojiDisplay.tsx` | `components/ui/emoji/ReactionTaskCommentEmojiDisplay.tsx` |
| `components/emojiInput/ShowEmojiReaction.tsx` | `components/ui/emoji/ShowEmojiReaction.tsx` |
| `components/utils/circleIconWithNumber.tsx` | `components/ui/misc/circleIconWithNumber.tsx` |
| `components/utils/InitialLoad.tsx` | `components/ui/misc/InitialLoad.tsx` |
| `components/utils/PulseDot.tsx` | `components/ui/misc/PulseDot.tsx` |
| `components/blockNote/*` | `components/editors/*` |

### Utilities and Hooks
| Old Path | New Path |
|----------|----------|
| `utils.tsx` | `utils/sidebarUtils.ts` |
| `useScript.ts` | `hooks/common/useScript.ts` |

### Workers (34 files)
All files from `workers/` → `db/workers/`

Example mappings:
- `workers/addChatWorker.ts` → `db/workers/addChatWorker.ts`
- `workers/loadDMHistoryWorker.ts` → `db/workers/loadDMHistoryWorker.ts`
- `workers/popSpecificMessagesWorker.ts` → `db/workers/popSpecificMessagesWorker.ts`
- *(and 31 more workers)*

## Import Path Updates

All import statements throughout the codebase have been automatically updated to reflect the new structure:

### Component Imports
```typescript
// Before
import { AvatarWithStatus } from "../../components/common/avatarWithStatus";
import { EmojiPicker } from "../../components/emojiInput/EmojiPicker";
import { BnChatEditor } from "../../components/blockNote/bnChatEditor";

// After
import { AvatarWithStatus } from "../../components/ui/avatars/avatarWithStatus";
import { EmojiPicker } from "../../components/ui/emoji/EmojiPicker";
import { BnChatEditor } from "../../components/editors/bnChatEditor";
```

### Worker Imports
```typescript
// Before
import AddChatWorker from "../../db/workers/addChatWorker.ts?worker";

// After
import AddChatWorker from "../../db/workers/addChatWorker.ts?worker";
```

### Utility Imports
```typescript
// Before
import { toggleMessagesPane } from "../../utils";

// After
import { toggleMessagesPane } from "../../utils/sidebarUtils";
```

## Benefits of New Structure

1. **Better Organization**: Related components are grouped together (all UI components under `ui/`, all editors under `editors/`)
2. **Clearer Separation of Concerns**: Workers are now clearly part of the database module
3. **No Duplication**: Eliminated duplicate `utils` files at root level
4. **Consistent Hook Organization**: All hooks are properly organized in the `hooks/` folder
5. **Easier Navigation**: Developers can quickly find components by type
6. **Scalability**: New components can be easily added to the appropriate category

## Current Folder Structure

```
src/
├── assets/                     # Icons and static assets
│   ├── GithubIcon.tsx
│   └── GoogleIcon.tsx
├── components/                 # Reusable UI components
│   ├── ui/
│   │   ├── avatars/           # Avatar components
│   │   ├── emoji/             # Emoji pickers and reactions
│   │   └── misc/              # Miscellaneous UI components
│   ├── editors/               # Rich text editor components
│   ├── layout/                # Layout components
│   └── App/                   # App wrapper
├── context/                   # React contexts
│   ├── AuthContext.tsx
│   └── socketContext.tsx
├── db/                        # Database layer
│   ├── config/
│   ├── repositories/
│   ├── services/
│   ├── types/
│   ├── utils/
│   └── workers/              # Web workers for database operations
├── features/                  # Feature modules
│   ├── admin/
│   ├── chat/
│   ├── inbox/
│   ├── notes/
│   └── tasks/
├── hooks/                     # Custom React hooks
│   ├── common/
│   ├── chats/
│   ├── inbox/
│   ├── notes/
│   └── tasks/
├── lib/                       # Third-party library configurations
├── services/                  # Global services
│   ├── api.ts
│   ├── loadInitialData.ts
│   └── loadProjectProfile.ts
├── types/                     # TypeScript type definitions
│   ├── admin.ts
│   ├── chat.ts
│   ├── common.ts
│   ├── notes.ts
│   └── tasks.ts
├── utils/                     # Utility functions
│   ├── dateUtils.ts
│   ├── defaultProps.ts
│   ├── downloadUtils.ts
│   ├── note.ts
│   ├── objectHandler.ts
│   ├── sidebarUtils.ts
│   ├── sleep.ts
│   ├── stringHelper.ts
│   └── urlHandler.ts
├── App.css
├── App.tsx
├── index.css
├── main.tsx
└── vite-env.d.ts
```

## Verification

- ✅ All imports updated successfully
- ✅ No linter errors
- ✅ Folder structure follows modern React best practices
- ✅ Clear separation between UI components, editors, and business logic

## Migration Notes for Developers

If you're working on a feature branch and need to merge this refactoring:

1. **Update your imports**: Use find and replace in your IDE:
   - `components/common/` → `components/ui/avatars/`
   - `components/emojiInput/` → `components/ui/emoji/`
   - `components/blockNote/` → `components/editors/`
   - `components/utils/` → `components/ui/misc/`
   - `workers/` → `db/workers/`
   - `from "../utils"` → `from "../utils/sidebarUtils"` (where applicable)

2. **New component locations**: When importing components, use the new paths as shown in the table above.

3. **Worker imports**: All worker imports now use the `db/workers/` prefix.

---

**Refactoring Date:** November 29, 2025
**Status:** ✅ Completed

