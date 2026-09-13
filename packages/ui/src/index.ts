/**
 * @locker/ui — presentation-only React component library (FR20, AD-10).
 *
 * shadcn-style primitives carrying the Everest brand layer (DESIGN.md):
 * theme tokens are CSS variables consumed via Tailwind utilities (`bg-brand`,
 * `text-on-brand`, …) defined once in `apps/web`'s stylesheet — this package
 * ships components, never colors-as-JS, never an API client, never business
 * logic. Boundary lint enforces the import bans mechanically.
 */

export { cn } from './lib/cn.js';
export { BrandBadge, BrandDash, Eyebrow, Wordmark } from './components/brand.js';
export { Button, buttonVariants, type ButtonProps } from './components/button.js';
export { RoleCard, type RoleCardProps } from './components/role-card.js';
export { Input } from './components/input.js';
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './components/dialog.js';
export {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from './components/select.js';
export { Skeleton } from './components/skeleton.js';
export { Spinner } from './components/spinner.js';
export { LockerTile, type LockerTileProps } from './components/locker-tile.js';
export { EmptyState, type EmptyStateProps } from './components/empty-state.js';
export { ResultCard, type ResultCardProps } from './components/result-card.js';
export { CodeInput, type CodeInputProps } from './components/code-input.js';
export {
  ChargeSummary,
  type ChargeRow,
  type ChargeSummaryProps,
} from './components/charge-summary.js';
export { Separator } from './components/separator.js';
export { ErrorBanner, type ErrorBannerProps } from './components/error-banner.js';
export { ThemeToggle, type ThemeName } from './components/theme-toggle.js';
