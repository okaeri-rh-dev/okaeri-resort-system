# 🎨 Styling System

## Overview

The `/src/styles/` directory contains custom CSS stylesheets that complement the Tailwind CSS framework, providing enterprise-specific styling and mobile optimizations for the Okaeri Resort System.

## 📁 Style Files

```
styles/
├── enterprise-tables.css    # Enterprise table styling (5.2KB)
└── mobile-enterprise.css    # Mobile-specific enterprise styles (11KB)
```

## 📦 Style Modules

### `enterprise-tables.css` - Professional Table Styling
**Purpose**: Enterprise-grade table designs with enhanced readability

**Features**:
- Dense information display
- Zebra striping for readability
- Sticky headers
- Responsive column handling
- Professional typography

**Key Classes**:
```css
/* Enterprise table base */
.enterprise-table {
  --table-border: #e5e7eb;
  --row-hover: #f9fafb;
  --header-bg: #f3f4f6;
}

/* Dense layout */
.table-dense {
  font-size: 0.875rem;
  line-height: 1.25rem;
}

/* Sticky header */
.table-sticky-header {
  position: sticky;
  top: 0;
  z-index: 10;
}

/* Monospace numbers */
.table-numeric {
  font-family: 'SF Mono', 'Monaco', monospace;
  font-variant-numeric: tabular-nums;
}
```

### `mobile-enterprise.css` - Mobile Optimizations
**Purpose**: Mobile-specific adjustments for enterprise UI

**Responsive Breakpoints**:
```css
/* Mobile (< 640px) */
@media (max-width: 639px) {
  .mobile-table-stack {
    display: block;
  }

  .mobile-card-view {
    display: grid;
    gap: 1rem;
  }
}

/* Tablet (640px - 1024px) */
@media (min-width: 640px) and (max-width: 1023px) {
  .tablet-two-column {
    grid-template-columns: 1fr 1fr;
  }
}
```

**Mobile-Specific Styles**:
```css
/* Touch-friendly targets */
.mobile-touch-target {
  min-height: 44px;
  min-width: 44px;
}

/* Larger text for mobile */
.mobile-text-large {
  font-size: 16px; /* Prevents zoom on iOS */
}

/* Swipeable cards */
.swipe-container {
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}

/* Bottom sheet modal */
.mobile-bottom-sheet {
  position: fixed;
  bottom: 0;
  border-radius: 1rem 1rem 0 0;
  max-height: 90vh;
}
```

## 🎨 Design Tokens

### Color Variables
```css
:root {
  /* Primary Colors */
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;

  /* Status Colors */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;

  /* Neutral Colors */
  --color-background: #ffffff;
  --color-surface: #f9fafb;
  --color-border: #e5e7eb;
  --color-text: #111827;
  --color-text-muted: #6b7280;
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #111827;
    --color-surface: #1f2937;
    --color-border: #374151;
    --color-text: #f9fafb;
    --color-text-muted: #9ca3af;
  }
}
```

### Typography Scale
```css
/* Type Scale */
.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.875rem; }
.text-base { font-size: 1rem; }
.text-lg { font-size: 1.125rem; }
.text-xl { font-size: 1.25rem; }
.text-2xl { font-size: 1.5rem; }

/* Font Weights */
.font-normal { font-weight: 400; }
.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
```

### Spacing System
```css
/* Consistent spacing */
.spacing-xs { padding: 0.25rem; }
.spacing-sm { padding: 0.5rem; }
.spacing-md { padding: 1rem; }
.spacing-lg { padding: 1.5rem; }
.spacing-xl { padding: 2rem; }
```

## 🏗️ Style Patterns

### Enterprise Component Styling
```css
/* Professional card design */
.enterprise-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

/* Data-dense layouts */
.data-grid {
  display: grid;
  gap: 0.5rem;
  font-size: 0.875rem;
}

/* Executive dashboard style */
.executive-metric {
  font-family: 'Inter', system-ui;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.025em;
}
```

### Mobile-First Utilities
```css
/* Hide on mobile */
@media (max-width: 639px) {
  .mobile-hide { display: none; }
}

/* Show only on mobile */
.mobile-only {
  display: block;
}
@media (min-width: 640px) {
  .mobile-only { display: none; }
}

/* Responsive text */
.responsive-text {
  font-size: clamp(0.875rem, 2vw, 1rem);
}
```

## 🚀 Performance Considerations

### Critical CSS
```css
/* Inline critical styles for faster rendering */
.above-the-fold {
  /* Minimal styles for initial render */
  display: block;
  visibility: visible;
}
```

### Animation Performance
```css
/* Use transform for smooth animations */
.slide-in {
  transform: translateX(-100%);
  transition: transform 0.3s ease-out;
  will-change: transform;
}

.slide-in.active {
  transform: translateX(0);
}

/* Reduce motion for accessibility */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## 📱 Responsive Helpers

```css
/* Container queries (future) */
@container (max-width: 400px) {
  .container-responsive {
    flex-direction: column;
  }
}

/* Aspect ratios */
.aspect-video { aspect-ratio: 16 / 9; }
.aspect-square { aspect-ratio: 1 / 1; }
.aspect-portrait { aspect-ratio: 3 / 4; }
```

## 🔧 Integration with Tailwind

These styles complement Tailwind CSS v4:
```css
/* Extend Tailwind utilities */
@layer utilities {
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
}

/* Custom Tailwind components */
@layer components {
  .btn-enterprise {
    @apply px-4 py-2 rounded-md font-medium
           bg-primary text-white
           hover:bg-primary-hover
           focus:outline-none focus:ring-2;
  }
}
```

## 📚 Usage Guidelines

1. **Import Order**: Import after Tailwind base styles
2. **Specificity**: Keep specificity low, use utility classes
3. **Mobile-First**: Design for mobile, enhance for desktop
4. **Performance**: Minimize custom CSS, prefer Tailwind utilities
5. **Consistency**: Use design tokens for colors and spacing