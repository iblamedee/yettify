# Spotify Encore Design System Specification

This specification documents the visual, structural, and behavioral tokens of the Spotify Encore design system as observed on Spotify Web and documented in Spotify's official design releases.

---

## 1. Color Palette Tokens

Spotify uses a "content-first dark UI" philosophy where deep charcoal layers let vivid album art and brand green draw attention.

| Token Name | Hex Code | RGB | Role / Usage |
| :--- | :--- | :--- | :--- |
| `--spice-accent` (Brand Green) | `#1ed760` | `rgb(30, 215, 96)` | Primary action buttons, active slider fill, play hover icon, current playing title highlight, active shuffle/repeat dots |
| `--spice-accent-hover` | `#1fdf64` | `rgb(31, 223, 100)` | Primary button hover state (scale 1.04) |
| `--spice-accent-press` | `#169b45` | `rgb(22, 155, 69)` | Primary button active/pressed state |
| `--spice-main` (Canvas Base) | `#000000` | `rgb(0, 0, 0)` | Viewport background behind panels, top bar base |
| `--spice-surface` (Panel Base) | `#121212` | `rgb(18, 18, 18)` | Main content card container, sidebar panel surface, player bar base |
| `--spice-card` (Elevated Card) | `#181818` | `rgb(24, 24, 24)` | Music item card background, dropdown menu background, modal dialogs |
| `--spice-card-hover` | `#282828` | `rgb(40, 40, 40)` | Card hover highlight, active tab pill background, search input fill |
| `--spice-subsurface` | `#1f1f1f` | `rgb(31, 31, 31)` | Table header row, secondary button hover, divider borders |
| `--spice-text` (Primary Text) | `#ffffff` | `rgb(255, 255, 255)` | Track titles, hero titles, active menu items, high-contrast labels |
| `--spice-subtext` (Secondary) | `#b3b3b3` | `rgb(179, 179, 179)` | Artist names, album names, durations, inactive navigation links, table column headers |
| `--spice-muted` | `#6a6a6a` | `rgb(106, 106, 106)` | Disabled controls, slider track background, placeholder text |
| `--spice-error` (Negative) | `#f3727f` | `rgb(243, 114, 127)` | Error messages, destructive actions (Delete playlist) |
| `--spice-warning` | `#ffa42b` | `rgb(255, 164, 43)` | Warning alerts, explicit content tags |
| `--spice-info` | `#539df5` | `rgb(83, 157, 245)` | Info callouts, announcements |

---

## 2. Layout Geometry & Dimensions

| Layout Region | Dimensions / Constraints | CSS Behavior |
| :--- | :--- | :--- |
| **Top Navigation Bar** | Height: `64px` | Sticky / Fixed top (`z-index: 40`), dynamic background opacity on scroll |
| **Left Sidebar (Navigation & Library)** | Width: `240px` to `420px` (Resizable) | Fixed left column with draggable right border resize handle |
| **Main Content Viewport** | Width: `calc(100% - sidebar - rightPanel)` | Scrollable container (`overflow-y: overlay`), custom 8px dark scrollbar |
| **Bottom Persistent Player Bar** | Height: `90px` (Desktop) / `64px` (Mobile) | Fixed bottom (`z-index: 50`), 3-column flex layout (`left: 30%`, `center: 40%`, `right: 30%`) |
| **Right Side Panel (Queue / Now Playing)** | Width: `280px` to `360px` (Collapsible) | Conditional drawer or dockable side column |
| **App Shell Padding** | Outer margin: `8px` gap between panels | Spotify Web uses floating rounded cards for panels with `8px` gaps |

---

## 3. Typography System

The typeface is modeled after Spotify's `CircularSp` / `SpotifyMixUI` family using `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`.

| Style Token | Font Size | Font Weight | Line Height | Letter Spacing | Common Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Title / Display** | `48px` to `96px` | 900 (Black / Extra Bold) | 1.05 | `-0.04em` | Album header title, Artist name banner |
| **Page Header / Section** | `24px` to `32px` | 700 (Bold) | 1.25 | `-0.02em` | Section titles ("Trending songs", "Popular albums") |
| **Card Title / Subheading** | `16px` | 700 (Bold) | 1.35 | `normal` | Card titles, modal headers, track titles |
| **Body Bold** | `14px` | 600 (Semibold) | 1.4 | `normal` | Track list active title, sidebar nav items |
| **Body Regular** | `14px` | 400 (Regular) | 1.4 | `normal` | Track artists, album descriptions, settings body |
| **Caption / Metadata** | `12px` | 400 (Regular) | 1.35 | `normal` | Track duration, album release year, stream count |
| **Button Pill Uppercase** | `14px` | 700 (Bold) | 1.0 | `+0.1em` | Uppercase buttons ("SHUFFLE PLAY", "EXPLORE PREMIUM") |
| **Badge / Mini Tag** | `10px` | 700 (Bold) | 1.0 | `+0.05em` | Explicit badge (`E`), Verified badge |

---

## 4. Component Geometry & Interactive States

### Buttons
- **Primary Play Button (Hero / Floating)**:
  - Circle: `48px x 48px` or `56px x 56px`.
  - Background: `#1ed760`.
  - Icon: Black filled triangle (`#000000`).
  - Hover: Background `#1fdf64`, scale: `1.04`, shadow: `0 8px 16px rgba(0,0,0,0.4)`.
  - Active: Scale `0.98`.
- **Primary Pill Button**:
  - Border radius: `9999px` (Full pill).
  - Padding: `12px 32px`.
  - Font weight: 700.
- **Secondary Outlined Pill Button**:
  - Border: `1px solid #727272`.
  - Hover: Border `#ffffff`, scale `1.03`.
- **Text Action Links / Icons**:
  - Color: `#b3b3b3`.
  - Hover: Color `#ffffff`, scale `1.06`.

### Cards (Album / Artist / Playlist)
- Border radius: `8px`.
- Padding: `16px`.
- Background: `#181818`.
- Hover transition: Background `#282828`, duration `200ms ease-out`.
- Image thumbnail:
  - Album / Playlist: Square (`aspect-square`), `rounded-md`, shadow `0 8px 24px rgba(0,0,0,0.5)`.
  - Artist: Circle (`rounded-full`), shadow `0 8px 24px rgba(0,0,0,0.5)`.
- Hover Play Overlay: Green circle play button appears at bottom-right corner of card thumbnail with slide-up fade animation (`opacity: 1`, `translateY(0)`).

### Track Table Row
- Row height: `56px`.
- Columns:
  1. Rank / Play Icon (`40px`, center).
  2. Title + Artist + Thumbnail (`1fr`).
  3. Album Name (`0.8fr`, hidden on small screens).
  4. Date Added (`0.6fr`, hidden on tablet/mobile).
  5. Like Heart Button (`40px`, center).
  6. Duration (`60px`, right).
  7. Context Menu `...` (`40px`, center).
- Hover: Background `rgba(255, 255, 255, 0.1)`. Track number replaced by white Play icon.
- Playing state: Track title text turns Spotify Green (`#1ed760`), animated equalizer soundwave gif/bars icon.

### Sliders (Seek Bar & Volume Slider)
- Track height: `4px`.
- Border radius: `2px`.
- Track background: `#4d4d4d`.
- Progress fill: `#ffffff` (default); changes to `#1ed760` on hover.
- Thumb knob: `12px` circle, white (`#ffffff`). Opacity `0` when inactive; opacity `1` and scaled on slider container hover.

### Modals & Dialogs
- Overlay backdrop: `rgba(0, 0, 0, 0.7)` with `backdrop-filter: blur(4px)`.
- Dialog card: Background `#282828`, border radius `12px`, padding `24px`, shadow `0 20px 40px rgba(0,0,0,0.8)`.

---

## 5. Responsive Breakpoints

| Breakpoint Name | Min-Width | Layout Adaptations |
| :--- | :--- | :--- |
| `sm` | `640px` | Show simplified 2-column track table (Title + Duration) |
| `md` | `768px` | Sidebar expands from collapsed mobile menu to desktop sidebar |
| `lg` | `1024px` | Add "Album" column to track table; show top bar profile name |
| `xl` | `1280px` | Add "Date Added" column; grid cards expand to 5-6 columns |
| `2xl` | `1536px` | Grid cards expand to 7-8 columns; full metadata density |
