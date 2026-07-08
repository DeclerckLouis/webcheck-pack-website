# Redesign Skill

Upgrades existing websites and apps to premium quality by auditing current design, identifying generic AI patterns, and applying high-end design standards without breaking functionality.

## Core Process

**Scan** the codebase to identify framework and styling methods → **Diagnose** using a comprehensive audit to list weak points → **Fix** by applying targeted upgrades to the existing stack.

## Design Audit Categories

### Typography Issues
- Browser default fonts or Inter everywhere
- Headlines lack presence
- Fix: distinctive typefaces, adjusted sizing/spacing, max ~65ch paragraphs, multiple font weights for hierarchy
- Numbered data in proportional fonts (use tabular-nums)
- Excessive all-caps

### Color and Surfaces
- Pure `#000000` background → use off-black
- Oversaturated accent colors
- Mixing warm and cool grays
- Purple/blue "AI gradient" aesthetic (most common AI fingerprint)
- Generic box-shadows
- Flat design lacking texture
- Sudden dark sections breaking light-mode pages

### Layout Patterns
- Centered-symmetrical everything
- Three equal card columns as feature row (most generic AI layout)
- Forced equal-height cards
- Fix: max-width constraints, varied border-radius, visual depth through overlap, aligned shared elements

### Interactivity and States
- Missing hover states
- Absent active feedback
- Instant transitions (no duration)
- No loading or empty states
- Missing visible focus indicators (accessibility)
- No smooth scroll behavior

### Content Quality
- Generic names, fake round numbers, placeholder company names
- Clichéd copywriting ("Elevate", "Seamless", "Revolutionize")
- Fix: diverse realistic names, organic messy data, active voice

### Component Patterns
- Generic card: border + shadow + white background
- Predictable button pairings
- Pill-shaped badges
- Accordion FAQs
- Three-card testimonial carousels

### Iconography
- Lucide or Feather icons exclusively (default AI choice) → prefer Phosphor or Heroicons
- Clichéd icon metaphors
- Inconsistent stroke widths

### Code Quality
- Div soup
- Inline styles
- Hardcoded pixel widths
- Missing alt text
- Arbitrary z-index values
- Commented-out dead code

## Strategic Omissions (commonly forgotten)
- Legal links
- Back navigation
- Custom 404 pages
- Form validation
- Skip-links for keyboard users
- Cookie consent banners

## Upgrade Techniques (high-impact)
- Variable font animation
- Text mask reveals
- Broken grids and asymmetry
- Parallax card stacks
- Staggered entry animations
- Scroll-driven reveals
- True glassmorphism
- Spotlight borders
- Colored shadow overlays

## Implementation Priority
1. Font swap
2. Color palette cleanup
3. Hover and active states
4. Layout and spacing
5. Generic component replacement
6. Loading/empty/error states
7. Typography polish

## Core Rules
- Work with existing tech stack — no migrations
- Maintain functionality throughout
- Verify dependencies before imports
- Keep modifications reviewable and focused (no comprehensive rewrites)
