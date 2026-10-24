# TechNeekX Community Reporting System
## Premium Responsive Frontend Foundation (Phase 5)

### 1. Technology Stack
- **Framework:** React 19 with TypeScript and Vite
- **Styling System:** Vanilla CSS Design Tokens (Custom properties defined in `src/styles/tokens.css` and `src/index.css`)
- **Iconography:** Lucide Icons (`lucide-react`)
- **Typography:** Inter (Google Fonts)

---

### 2. Design Tokens Palette

| Token Name | Hex / Value | Semantic Role |
| :--- | :--- | :--- |
| `--color-primary` | `#635BFF` | Brand violet for primary CTAs, active indicators, and focus rings |
| `--color-primary-hover` | `#5145E5` | Interactive hover state for primary elements |
| `--color-secondary` | `#818CF8` | Secondary indigo accent |
| `--color-accent` | `#22D3EE` | Bright cyan highlight |
| `--color-bg-app` | `#F6F7FB` | Main application backdrop |
| `--color-surface` | `#FFFFFF` | Cards, tables, modals, and input containers |
| `--color-sidebar-bg` | `#111827` | Dark premium sidebar surface |
| `--color-text-main` | `#111827` | High-contrast body and heading text |
| `--color-text-secondary`| `#6B7280` | Subtitles, labels, and metadata |
| `--color-border` | `#E5E7EB` | Dividers and input borders |
| `--color-success` | `#16A34A` | Approved status, success alerts |
| `--color-warning` | `#F59E0B` | In Progress / Pending status, warnings |
| `--color-danger` | `#EF4444` | Changes Requested status, error alerts |
| `--color-info` | `#3B82F6` | Assigned status, informational notices |

---

### 3. Reusable UI Components Catalog (`src/components/ui/`)

1. **`Button`:**
   - Variants: `primary`, `secondary`, `outline`, `ghost`, `danger`.
   - Sizes: `sm` (32px), `md` (40px), `lg` (46px).
   - States: `isLoading` (with animated spinner), `disabled`, icon prefixes/suffixes.
2. **`Input`:**
   - Features: Floating label, left/right icon slots, error message, helper text, accessible ARIA attributes (`aria-invalid`, `aria-describedby`).
3. **`Select`:**
   - Custom styled native select with custom Chevron dropdown indicator and options mapping.
4. **`Textarea`:**
   - Multi-line input with label, error states, and resize constraint.
5. **`Badge`:**
   - Status mapping for `Assigned`, `In Progress`, `Submitted`, `Approved`, `Changes Requested`, `Active`, `Pending`. Includes optional animated dot indicator.
6. **`Card` Suite:**
   - Subcomponents: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`. Supports `hoverable` elevation.
7. **`Table` Suite:**
   - Responsive scroll container with `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`.
8. **`Modal` Dialog:**
   - Accessible popup dialog with backdrop blur, keyboard `Escape` closing, focus lock, header, body, and footer slots.
9. **`Breadcrumbs`:**
   - Hierarchical pathway with Home icon and chevron separators.
10. **`Pagination`:**
    - Page info counter, previous/next controls, and active page pill.
11. **`Alert`:**
    - Variants: `info`, `success`, `warning`, `danger` with semantic SVG icons and optional dismiss button.
12. **`Skeleton`:**
    - Shimmer animated placeholder for tables, cards, and avatars during asynchronous loading.
13. **`EmptyState`:**
    - Centered icon illustration, heading, description, and call-to-action slot.

---

### 4. Layout & App Shell (`src/components/layout/`)

- **`Sidebar`:** Collapsible on mobile, fixed on desktop. Brand logo with gradient accent, 7 primary navigation links with active highlighting and notification badges, and authenticated user profile card with role badge and sign-out trigger.
- **`TopBar`:** Sticky top header with hamburger toggle button for mobile screens, dynamic page title & subtitle, search bar, notifications bell with unread dot, and role badge.
- **`AppShell`:** Responsive wrapper coordinating sidebar state, top bar, and content viewport.

---

### 5. Frontend Run & Build Instructions

```powershell
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies (if not already installed)
npm install

# 3. Start local Vite development server
npm run dev

# The app will be accessible at:
# http://localhost:5173/ or http://127.0.0.1:5173/

# 4. Run TypeScript typecheck & production build
npm run build
```
