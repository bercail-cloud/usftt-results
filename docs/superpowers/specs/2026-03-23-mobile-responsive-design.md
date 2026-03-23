# Mobile Responsive Design

Target device: iPhone 16 Pro (393px). Strategy: reduced tables with hidden/merged columns on mobile, cards with wrapping badges for match grids.

## Approach

- Desktop layout unchanged (no regressions)
- Mobile breakpoint: `md:` (768px) as the toggle — below md = mobile layout
- Tailwind responsive classes only (hidden md:table-cell, grid-cols-1 md:grid-cols-2, etc.)
- No new components or libraries

## Page-by-page adaptations

### 1. Progression (player listing)

**Desktop (8 cols):** Cat | Nom | Mensuel | Officiel | Debut | Mois | Saison | Matchs

**Mobile (5 cols):** Joueur | Mens. | Mois | Saison | Matchs

- Column "Joueur" merges: nom (bold, line 1) + "S | 2324 pts" (cat + officiel, line 2, muted)
- Cat and Officiel columns: `hidden md:table-cell` on mobile, still rendered for desktop
- Debut saison column: `hidden md:table-cell`
- Gender accent bar (left border) preserved
- Filter pills: already flex-wrap, works on mobile
- Rows remain clickable (link to detail)

### 2. Equipes Overview (team standings + match grid)

**Desktop:** Table with team name, classement, points, and 7-column match grid (colored score badges)

**Mobile:** Cards with wrapping badges

- Each equipe becomes a card with: team name, division badge, classement info
- Match scores displayed as colored badges (green/red/amber) using `flex flex-wrap gap-1`
- Badges wrap naturally to fill available width
- Upcoming matches shown as dashed-border placeholder badges
- Home/Away SVG icons preserved on badges
- Groups (Phase, niveau) unchanged — just stack vertically
- Division accent bar preserved

### 3. Equipe Detail

**Pool standings table:**
- Column N (nuls): `hidden md:table-cell`
- Remaining columns (#, Equipe, J, V, D, Pts) fit on 393px
- FONTENAY row highlight preserved

**Match details (per journee):**
- Same layout, reduced padding
- Score badges and team names already flex — works on mobile
- Player detail tables in expanded match: compact padding, `text-xs` on mobile

### 4. Criterium Overview

**Summary cards grid:**
- `grid grid-cols-3` becomes `grid grid-cols-1 md:grid-cols-3`
- Each player card stacks vertically on mobile
- Niveau grouping (accent bars) preserved
- Medal circles, V/D stats, tour info all fit within card width

### 5. Criterium Detail

**Division standings table:**
- Club column: `hidden md:table-cell`
- Remaining: Rang, Joueur, Clt, Points — fits on mobile

**Pool matches and elimination tables:**
- Same columns, compact padding
- Phase column in elimination: abbreviate on mobile if needed

### 6. ProgressionDetail (player detail)

**Statistics grid:**
- `grid grid-cols-1 md:grid-cols-2` (already partially implemented)
- All 4 stat blocks stack vertically on mobile

**Chart:**
- ResponsiveContainer already 100% width — works on mobile
- Reduce height: `h-[200px] md:h-[260px]`

**Equipes participation block:**
- Already a list — no changes needed

**Parties list:**
- Already flex layout with badges — works on mobile
- Reduce padding slightly for tighter fit

## Global changes

### Spacing
- Page containers: `px-3 md:px-4` on mobile (12px vs 16px)
- Section spacing: `space-y-6 md:space-y-8`

### Typography
- Page titles: `text-xl md:text-2xl`
- No other font-size changes needed — current sizes work at 393px

### NavBar
- Already mobile-ready (hamburger menu at `sm:` breakpoint)
- No changes needed

## Files to modify

1. `packages/web/src/pages/Progression.tsx` — table column visibility, mobile row layout
2. `packages/web/src/pages/EquipesOverview.tsx` — match grid to cards layout on mobile
3. `packages/web/src/pages/EquipeDetail.tsx` — hide N column, compact padding
4. `packages/web/src/pages/CriteriumOverview.tsx` — grid-cols-1 on mobile
5. `packages/web/src/pages/CriteriumDetail.tsx` — hide Club column, compact padding
6. `packages/web/src/pages/ProgressionDetail.tsx` — stats grid, chart height

## Testing

- Manual testing on iPhone 16 Pro (393px) via Chrome DevTools device emulation
- Verify desktop layout unchanged (no regressions)
- Check all pages at 393px, 768px, and 1280px widths
