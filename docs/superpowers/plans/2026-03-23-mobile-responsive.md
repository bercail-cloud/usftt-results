# Mobile Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all 6 pages of the USFTT results website responsive for iPhone 16 Pro (393px) while keeping desktop layout unchanged.

**Architecture:** Tailwind CSS responsive classes only (`hidden md:table-cell`, `grid-cols-1 md:grid-cols-3`, etc.). No new components or libraries. Desktop is the `md:` breakpoint (768px+), mobile is the default.

**Tech Stack:** React, Tailwind CSS 4, Vite

**Spec:** `docs/superpowers/specs/2026-03-23-mobile-responsive-design.md`

---

### Task 1: Progression — Mobile table layout

**Files:**
- Modify: `packages/web/src/pages/Progression.tsx`

This is the player listing page with 8 columns. On mobile (< md), show 5 columns by hiding Cat, Officiel, and Debut columns, and merging Cat+Officiel info under the player name.

- [ ] **Step 1: Add mobile "Joueur" merged column**

In the table body, the current Nom column just shows `{j.nom} {j.prenom}`. Add a second line visible only on mobile showing category + officiel points:

```tsx
{/* In the Nom cell */}
<td className="...">
  <div>{j.nom} {j.prenom}</div>
  <div className="md:hidden text-[10px] text-muted">
    {j.categorie} | {j.points_officiels} pts
  </div>
</td>
```

- [ ] **Step 2: Hide columns on mobile**

Add `hidden md:table-cell` to these columns (both `<th>` and `<td>`):
- Cat column
- Officiel column
- Debut saison column

The header for the Nom column on mobile becomes "Joueur": `<th className="..."><span className="hidden md:inline">Nom Prenom</span><span className="md:hidden">Joueur</span></th>`

- [ ] **Step 3: Adjust page container spacing**

Change the page wrapper from `px-4 py-8` to `px-3 md:px-4 py-6 md:py-8`.
Change the page title from `text-2xl` to `text-xl md:text-2xl`.

- [ ] **Step 4: Verify desktop unchanged**

Run: `cd packages/web && npx vitest run`
Open Chrome DevTools at 1280px — verify 8 columns visible, same as before.

- [ ] **Step 5: Verify mobile layout**

Open Chrome DevTools at 393px (iPhone 16 Pro).
Verify: 5 columns (Joueur, Mens., Mois, Saison, Matchs), Cat+Officiel info under name, accent bar preserved.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/pages/Progression.tsx
git commit -m "feat: make Progression page responsive for mobile"
```

---

### Task 2: Equipes Overview — Cards with wrapping badges on mobile

**Files:**
- Modify: `packages/web/src/pages/EquipesOverview.tsx`

The current desktop layout uses a table with a 7-column match grid (hardcoded `minWidth: 350px`). On mobile, replace the table row with a card layout where match scores are flex-wrap badges.

- [ ] **Step 1: Add mobile card layout**

For each equipe, add a mobile-only card view (`md:hidden`) and hide the desktop table row on mobile (`hidden md:table-row`).

The mobile card contains:
- Team name + division badge (same as desktop)
- Classement position + points
- Match scores as colored badges in a `flex flex-wrap gap-1` container
- Home/Away SVG icons on badges preserved

- [ ] **Step 2: Hide desktop table on mobile**

Wrap the existing `<table>` with `hidden md:block` (or `hidden md:table`) and the new mobile cards with `md:hidden`.

- [ ] **Step 3: Adjust page container spacing**

Same as Task 1: `px-3 md:px-4 py-6 md:py-8`, title `text-xl md:text-2xl`.

- [ ] **Step 4: Verify desktop unchanged**

Open Chrome DevTools at 1280px — verify table with match grid displays exactly as before.

- [ ] **Step 5: Verify mobile layout**

Open at 393px. Verify: cards with team name, badges wrapping, accent bars, icons visible.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/pages/EquipesOverview.tsx
git commit -m "feat: make EquipesOverview responsive with card layout on mobile"
```

---

### Task 3: Equipe Detail — Hide N column, compact padding

**Files:**
- Modify: `packages/web/src/pages/EquipeDetail.tsx`

- [ ] **Step 1: Hide N (nuls) column on mobile**

Add `hidden md:table-cell` to the N column header and all N column cells in the pool standings table.

- [ ] **Step 2: Compact padding on mobile**

Reduce table cell padding: `px-2 md:px-4 py-2 md:py-3`.
Reduce match detail section padding similarly.

- [ ] **Step 3: Adjust page container spacing**

`px-3 md:px-4 py-6 md:py-8`, title `text-xl md:text-2xl`.

- [ ] **Step 4: Verify at 393px and 1280px**

Desktop: N column visible, full padding. Mobile: N hidden, compact.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/pages/EquipeDetail.tsx
git commit -m "feat: make EquipeDetail responsive for mobile"
```

---

### Task 4: Criterium Overview — Stack cards on mobile

**Files:**
- Modify: `packages/web/src/pages/CriteriumOverview.tsx`

- [ ] **Step 1: Fix grid columns**

Change `grid grid-cols-3` to `grid grid-cols-1 md:grid-cols-3` for the summary cards container.

- [ ] **Step 2: Adjust page container spacing**

`px-3 md:px-4 py-6 md:py-8`, title `text-xl md:text-2xl`.

- [ ] **Step 3: Verify at 393px and 1280px**

Desktop: 3 columns. Mobile: 1 column stacked.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/pages/CriteriumOverview.tsx
git commit -m "feat: make CriteriumOverview responsive for mobile"
```

---

### Task 5: Criterium Detail — Hide Club column, compact padding

**Files:**
- Modify: `packages/web/src/pages/CriteriumDetail.tsx`

- [ ] **Step 1: Hide Club column on mobile**

Add `hidden md:table-cell` to the Club column header and cells in division standings table.

- [ ] **Step 2: Compact padding**

Reduce table cell padding: `px-2 md:px-4 py-2 md:py-3`.

- [ ] **Step 3: Adjust page container spacing**

`px-3 md:px-4 py-6 md:py-8`, title `text-xl md:text-2xl`.

- [ ] **Step 4: Verify at 393px and 1280px**

Desktop: Club column visible. Mobile: hidden, remaining columns fit.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/pages/CriteriumDetail.tsx
git commit -m "feat: make CriteriumDetail responsive for mobile"
```

---

### Task 6: ProgressionDetail — Stack stats, reduce chart height

**Files:**
- Modify: `packages/web/src/pages/ProgressionDetail.tsx`

- [ ] **Step 1: Fix stats grid**

The stats grid already has `grid-cols-1 md:grid-cols-2`. Verify this is applied consistently to all stat card containers (Bilan, Progression, Par type, Adversaires).

- [ ] **Step 2: Reduce chart height on mobile**

Change the chart container from fixed `h-[260px]` (or similar) to `h-[200px] md:h-[260px]`.

- [ ] **Step 3: Compact parties list padding**

Reduce padding on individual match entries for mobile: `p-2 md:p-3` or similar.

- [ ] **Step 4: Adjust page container spacing**

`px-3 md:px-4 py-6 md:py-8`, title `text-xl md:text-2xl`.

- [ ] **Step 5: Verify at 393px and 1280px**

Desktop: 2-column stats, 260px chart. Mobile: 1-column stats, 200px chart, compact parties.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/pages/ProgressionDetail.tsx
git commit -m "feat: make ProgressionDetail responsive for mobile"
```

---

### Task 7: Final verification and push

- [ ] **Step 1: Run all tests**

```bash
cd packages/web && npx vitest run
```

All 28 tests must pass.

- [ ] **Step 2: Full mobile walkthrough**

Open Chrome DevTools at 393px. Navigate through all pages:
1. /equipes — cards with badges
2. /equipes/:id — compact table, N hidden
3. /criterium — stacked cards
4. /criterium/tours/:id/joueurs/:licence — compact, Club hidden
5. /progression — 5 columns, merged info
6. /progression/:licence — stacked stats, chart 200px

- [ ] **Step 3: Full desktop verification**

Open at 1280px. Navigate all pages — verify zero regressions.

- [ ] **Step 4: Push**

```bash
git push
```
