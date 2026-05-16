# TVShowTracker Design Language

Use this file as the design reference whenever adding or changing UI in this project. The goal is consistency with the existing app: a practical, compact, media-focused tracker for personal TV and movie habits.

## Product Feel

TVShowTracker should feel like a quiet personal tool, not a marketing site. Prioritize clarity, speed, and repeat use over decoration.

- Build the actual working feature as the main screen. Avoid landing-page composition, oversized hero sections, ornamental backgrounds, and explanatory marketing blocks.
- Keep screens calm and utilitarian: neutral surfaces, blue primary actions, compact controls, readable cards, and obvious navigation.
- Treat TV shows and movies as sibling experiences. New patterns should work for both domains unless the feature is explicitly domain-specific.
- Favor scannable information density. Users are comparing titles, ratings, years, progress, dates, and list state.
- Use plain product language: "My TV Shows", "My Movies", "Search", "Filter by Year", "Sort by", "Rating", "Grade", "Watched".

## Foundations

The app uses React, Vite, TypeScript, Tailwind CSS, and shadcn/ui-style components.

- Use existing primitives from `client/src/components/ui` before creating custom controls.
- The shadcn style is `new-york`, with Tailwind CSS variables enabled and neutral base colors.
- Global tokens live in `client/src/index.css`; Tailwind maps them in `tailwind.config.ts`.
- The base radius is `--radius: 0.5rem`. Use `rounded-md` or `rounded-lg` for most UI. Use `rounded-full` only for pills, avatars, and segmented switches.
- The primary brand/action color is blue: `--primary: 207 90% 54%`.
- Prefer semantic tokens:
  - `bg-background`
  - `text-foreground`
  - `text-muted-foreground`
  - `bg-card`
  - `text-card-foreground`
  - `border`
  - `border-input`
  - `bg-muted`
  - `bg-muted/20`
  - `text-primary`
  - `bg-primary`
  - `text-primary-foreground`
- For new UI, avoid undefined legacy utility names such as `primary-light`, `primary-dark`, `text-text`, `border-error`, and `text-error`. Use semantic tokens or explicit Tailwind colors instead.
- Keep status colors small and purposeful:
  - Ratings: amber/yellow accents.
  - Watched/success state: restrained green badges.
  - Destructive actions: red buttons or destructive alerts.
  - Errors: shadcn `Alert` with `variant="destructive"` when possible.

## Layout

The app is centered, responsive, and content-first.

- Page shell: `max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8`.
- Feature areas and tabbed content: usually `max-w-5xl mx-auto`.
- Forms, settings, and narrower panels: usually `max-w-3xl mx-auto` or `max-w-md`.
- The app-level layout uses a header, flexible main content, and footer. Avoid adding competing page chrome.
- Use vertical spacing in predictable steps: `mb-4`, `mb-6`, `mb-8`, `gap-4`, `gap-6`, `space-y-4`, `space-y-6`.
- Main list grids:
  - Large cards: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`.
  - Medium cards: `grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4`.
- Controls should stack on mobile and align horizontally on desktop: `flex flex-col md:flex-row gap-4`.
- Keep page headings modest. Use `text-2xl font-semibold` for page titles and `text-3xl font-bold` for detail-page media titles.

## Navigation

Navigation should stay predictable and lightweight.

- Preserve the header pattern: white header, subtle shadow, TV icon, "TV & Movies Tracker" brand, account avatar menu.
- Preserve the TV/Movies segmented switch in the header for authenticated app views.
- Use tabs for major view switches inside a domain:
  - TV: `My TV Shows` and `Search`.
  - Movies: `My Movies`, `Search`, and `AI Insights`.
  - Shared list: `TV Shows` and `Movies`.
- Keep tab lists compact: `TabsList` with `grid`, two columns, and `max-w-md`.
- Detail pages should use a clear ghost "Back" button and preserve context back to list or search where possible.
- Links inside cards should use hover color changes sparingly, usually `hover:text-primary transition-colors`.

## Components

Use existing shadcn/ui primitives and match current component behavior.

### Buttons

- Use `Button` from `client/src/components/ui/button`.
- Use `default` for primary actions: add, save, sign in, create account.
- Use `outline` for secondary actions: copy, cancel, export, reset filters.
- Use `ghost` for navigation or low-emphasis inline actions: back, edit, avatar trigger.
- Use explicit red styling only for destructive list removal when not using a destructive variant, for example `bg-red-600 hover:bg-red-700`.
- Include icons for action clarity when a matching icon is already used nearby.

### Cards

- Use cards for repeated media/list items and settings panels.
- Standard media cards use `Card className="overflow-hidden"` and `CardContent className="p-4"`.
- Search result cards can use subtle elevation and motion: `shadow-md hover:shadow-lg transition-all hover:-translate-y-1`.
- Do not nest cards inside cards.
- Keep card text compact:
  - Title: `font-semibold text-lg` or `font-medium text-sm` in dense cards.
  - Metadata: `text-sm text-muted-foreground` or restrained gray.
  - Descriptions: `text-sm line-clamp-2`.

### Forms And Filters

- Use `Label` above form controls and filters.
- Use shadcn `Input`, `Select`, `Checkbox`, `Switch`, and `Tabs` when possible.
- Keep filter controls together near the top of list views.
- Select widths should usually be `w-full sm:w-[180px]`.
- Use helper text sparingly: `text-xs text-muted-foreground mt-1`.
- Search forms use one prominent input with a right-aligned icon submit button.

### Badges And Pills

- Use `Badge variant="outline"` for genres and neutral metadata.
- Use compact rounded pills for watched/not-watched state.
- Pills should be short labels, not long explanatory text.

### Tables

- Use tables for dense list mode.
- Wrap tables in `overflow-hidden rounded-md border`.
- Header: `bg-muted/50`, `text-sm`, `font-medium`.
- Body rows may alternate `bg-white` and `bg-muted/20`.
- Hide less important columns on mobile with responsive utilities when needed.

### Accordions

- Use accordions for expandable season details and progress history.
- Keep accordion triggers short and scannable.
- Put detailed season fields inside compact grids with small text.

### Loading, Empty, And Error States

- Use `Skeleton` for loading cards and detail pages.
- Empty states should be centered, restrained, and useful: `text-center py-10` or `py-12`.
- Use `bg-muted/20 rounded-lg` for simple empty panels.
- Use `Alert variant="destructive"` for errors when using shadcn alerts.
- Empty/error copy should tell users what happened and what to do next in one or two sentences.

## Media

Media is a core part of the app. Posters and thumbnails should be consistent and stable.

- Use fixed media areas so cards do not jump:
  - List/search card image: usually `h-40` or `h-48`.
  - Medium cards: usually `h-36`.
  - Detail posters: `aspect-[2/3]`.
- Use `object-cover` for poster and backdrop images.
- Wrap detail posters in a simple white panel: `bg-white p-4 rounded-lg shadow-md`.
- Always provide an `alt` value using the title.
- Always handle broken or missing images with a neutral fallback state.
- No-image states should be quiet: gray background, centered icon or short "No image available" label.

## Typography And Copy

Keep typography simple and familiar.

- Page titles: `text-2xl font-semibold`.
- Detail titles: `text-3xl font-bold`.
- Section titles: `text-lg font-semibold` or `text-lg font-medium`.
- Card titles: `font-semibold text-lg` for large cards, `font-medium text-sm` for medium cards.
- Body text: `text-sm` or default text size; use `leading-relaxed` for overviews.
- Metadata and helper text: `text-sm text-muted-foreground` or `text-xs text-muted-foreground`.
- Avoid negative letter spacing and viewport-scaled font sizes.
- Copy should be direct:
  - Good: "Failed to load your movies. Please try again later."
  - Good: "No movies are included in this shared list."
  - Avoid: long explanations of how the UI works.

## Icons

The codebase currently mixes lucide icons and older Remix icon classes.

- For new components, prefer `lucide-react` icons when a suitable icon exists.
- When working inside older components that already use Remix icon classes, keep the local pattern unless doing a deliberate cleanup.
- Icon sizes should usually be `h-4 w-4` inside buttons and tabs.
- Pair unfamiliar icons with visible labels unless the surrounding UI makes the action obvious.

## Responsive Behavior

Design mobile first, then expand.

- Stack filters and actions vertically on mobile.
- Use one-column card grids on mobile.
- Use two or three columns for large cards on desktop.
- Use three or four columns for dense medium cards on desktop.
- Keep buttons and controls from overflowing. Long labels should wrap or use shorter copy.
- Public/shared views should remain readable without authenticated app controls.

## Feature Checklist

Before finishing a new UI feature, check:

- It uses existing shadcn/ui primitives where practical.
- It fits the current page shell and max-width conventions.
- It works for mobile and desktop.
- It uses semantic Tailwind tokens instead of undefined legacy classes.
- It includes loading, empty, and error states when data is fetched.
- Repeated media items have stable image dimensions and no-image fallbacks.
- Primary, secondary, destructive, and ghost actions have the right emphasis.
- Copy is concise and consistent with existing TV/movie tracking language.
- New TV patterns have a movie equivalent when the feature applies to both.
- The feature feels like part of a personal tracking tool, not a promotional page.
