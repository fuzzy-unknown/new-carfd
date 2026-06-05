# ARTIVUS Design System - UI2 Components

A sophisticated, modern design system inspired by creative studios and contemporary art galleries. The ARTIVUS design system features elegant gradients, smooth animations, and a refined dark/light theme palette.

## Design Philosophy

- **Modern & Elegant**: Clean interfaces with subtle gradients and refined typography
- **Smooth Animations**: Fluid transitions (0.3s-0.6s) with cubic-bezier easing
- **Dual Theme Support**: Seamless dark/light theme switching
- **Gradient Accents**: Purple-to-pink gradient highlights (#667eea → #764ba2 → #f5576c)
- **Refined Typography**: Playfair Display for headings, Inter for UI elements
- **Interactive Elements**: Hover states with gradient fills and glow effects

## Color Palette

### Dark Theme (Default)
| Color | CSS Variable | Hex/RGBA | Usage |
|-------|-------------|-----------|-------|
| Background Primary | `--artivus-bg-primary` | `#0a0a0a` | Main background |
| Background Panel | `--artivus-bg-panel` | `#0f0f0f` | Card/panel backgrounds |
| Text Primary | `--artivus-text-primary` | `rgba(255,255,255,0.9)` | Main text |
| Text Secondary | `--artivus-text-secondary` | `rgba(255,255,255,0.35)` | Secondary text |
| Text Muted | `--artivus-text-muted` | `rgba(255,255,255,0.15)` | Labels, placeholders |
| Text Label | `--artivus-text-label` | `rgba(255,255,255,0.35)` | Form labels |
| Border Subtle | `--artivus-border-subtle` | `rgba(255,255,255,0.06)` | Subtle borders |
| Border Input | `--artivus-border-input` | `rgba(255,255,255,0.08)` | Input borders |
| Border Hover | `--artivus-border-hover` | `rgba(255,255,255,0.12)` | Hover states |
| Accent Purple | `--artivus-accent-purple` | `rgba(139,92,246,0.6)` | Primary accent |
| Accent Pink | `--artivus-accent-pink` | `rgba(244,63,94,0.6)` | Secondary accent |
| Gradient | `--artivus-gradient` | Custom | Main gradient |
| Success | `--artivus-success` | `rgba(74,222,128,0.4)` | Success states |

### Light Theme
| Color | CSS Variable | Hex/RGBA | Usage |
|-------|-------------|-----------|-------|
| Background Primary | `--artivus-bg-primary` | `#f5f0eb` | Main background |
| Background Panel | `--artivus-bg-panel` | `#faf8f5` | Card/panel backgrounds |
| Text Primary | `--artivus-text-primary` | `rgba(30,30,30,0.9)` | Main text |
| Text Secondary | `--artivus-text-secondary` | `rgba(30,30,30,0.45)` | Secondary text |

## Typography

### Font Families
- **Display**: `Playfair Display`, `Noto Serif SC` - Headings, artistic text
- **UI**: `Inter`, system-ui - Interface elements, forms

### Type Scale
- **Display (XL)**: 32px, letter-spacing: 0.1em, italic
- **Heading (LG)**: 24px, letter-spacing: 0.1em
- **Body**: 15px, letter-spacing: 1px
- **Small**: 12px, letter-spacing: 3px, UPPERCASE
- **Label**: 10px, letter-spacing: 3px, UPPERCASE

## Components

### Installation

1. Import the ARTIVUS styles in your `index.css`:
```css
@import "../components/ui2/styles.css";
```

2. Import components from `ui2`:
```tsx
import { Button, Card, Input } from "@/components/ui2";
```

### Button

Buttons with gradient fill animations and glow effects.

```tsx
import { Button } from "@/components/ui2";

// Primary button with gradient fill
<Button variant="default">Enter Space</Button>

// Outlined button
<Button variant="outline">Learn More</Button>

// Ghost button
<Button variant="ghost">Skip</Button>

// Link button
<Button variant="link">Documentation</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>

// Icon button
<Button size="icon">
  <Search />
</Button>
```

**Hover Effect:** Gradient fill animation with purple-to-pink gradient and glow shadow.

### Card

Cards with subtle gradient border accent on hover.

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui2";

<Card>
  <CardHeader>
    <CardTitle>Creative Project</CardTitle>
    <CardDescription>A brief description of your creative work</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Your main content goes here...</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

**Hover Effect:** Subtle purple/pink gradient line on left edge with soft glow.

### Input

Elegant inputs with animated gradient bottom border.

```tsx
import { Input, Label } from "@/components/ui2";

<div className="space-y-6">
  <div>
    <Label>Email Address</Label>
    <Input type="email" placeholder="your@email.com" />
  </div>
  
  <div>
    <Label>Password</Label>
    <Input type="password" placeholder="Enter your password" />
  </div>
</div>
```

**Focus Effect:** Purple gradient line expands from left to right.

### Textarea

Multi-line text input with consistent styling.

```tsx
import { Textarea, Label } from "@/components/ui2";

<div>
  <Label>Message</Label>
  <Textarea 
    placeholder="Write your message..." 
    rows={6}
  />
</div>
```

### Label

Form labels with refined uppercase typography.

```tsx
import { Label } from "@/components/ui2";

<Label>Email Address</Label>
<Label size="sm">Small Label</Label>
<Label size="lg">Large Label</Label>
```

### Badge

Subtle badges with multiple variants.

```tsx
import { Badge } from "@/components/ui2";

<Badge>Default</Badge>
<Badge variant="accent">Featured</Badge>
<Badge variant="success">Published</Badge>
<Badge variant="warning">Draft</Badge>
<Badge variant="error">Error</Badge>

// Sizes
<Badge size="sm">Small</Badge>
<Badge size="default">Default</Badge>
<Badge size="lg">Large</Badge>
```

### Switch

Minimal toggle switch with gradient thumb on active.

```tsx
import { Switch } from "@/components/ui2";

<Switch />
<Switch defaultChecked />
<Switch disabled />
```

**Active State:** Purple gradient thumb with subtle border and glow.

### Select

Elegant dropdown with custom styling.

```tsx
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui2";

<Select>
  <SelectTrigger>
    <SelectValue placeholder="Choose option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
    <SelectItem value="option3">Option 3</SelectItem>
  </SelectContent>
</Select>
```

### Checkbox

Minimal checkbox with gradient check mark.

```tsx
import { Checkbox } from "@/components/ui2";

<Checkbox />
<Checkbox defaultChecked />
<Checkbox disabled />
```

**Checked State:** Purple gradient fill with border accent.

## Animation Patterns

### Fade In Up
```tsx
<div className="artivus-fade-in">
  Content fades in from below
</div>
```

### Button Gradient Fill
Buttons feature a gradient background that fades in on hover using `::before` pseudo-element.

### Input Focus Line
Input fields display a gradient line (purple to blue) that expands from left to right on focus.

## Theme Switching

The ARTIVUS design system supports both dark and light themes:

```tsx
// Enable light theme
document.documentElement.setAttribute('data-theme', 'light');

// Enable dark theme (default)
document.documentElement.removeAttribute('data-theme');

// Toggle theme
const current = document.documentElement.getAttribute('data-theme');
const next = current === 'light' ? 'dark' : 'light';
if (next === 'dark') {
  document.documentElement.removeAttribute('data-theme');
} else {
  document.documentElement.setAttribute('data-theme', 'light');
}
```

## CSS Custom Properties

The ARTIVUS design system uses CSS custom properties that can be customized:

```css
:root {
  --artivus-bg-primary: #0a0a0a;
  --artivus-bg-panel: #0f0f0f;
  --artivus-text-primary: rgba(255, 255, 255, 0.9);
  --artivus-text-secondary: rgba(255, 255, 255, 0.35);
  --artivus-text-muted: rgba(255, 255, 255, 0.15);
  --artivus-accent-purple: rgba(139, 92, 246, 0.6);
  --artivus-accent-pink: rgba(244, 63, 94, 0.6);
  --artivus-gradient: linear-gradient(135deg, #667eea, #764ba2, #f5576c);
  --artivus-gradient-subtle: linear-gradient(to right, #667eea, #764ba2);
}
```

## Usage Examples

### Login Form
```tsx
import { Button, Input, Label, Checkbox } from "@/components/ui2";

function LoginForm() {
  return (
    <div className="space-y-6">
      <div>
        <Label>Email Address</Label>
        <Input type="email" placeholder="your@email.com" />
      </div>
      
      <div>
        <Label>Password</Label>
        <Input type="password" placeholder="Enter password" />
      </div>
      
      <div className="flex items-center justify-between">
        <Checkbox />
        <span className="text-sm text-[var(--artivus-text-muted)]">Remember me</span>
      </div>
      
      <Button variant="default" className="w-full">
        <span>Enter Space</span>
      </Button>
    </div>
  );
}
```

### Feature Card
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button } from "@/components/ui2";

function FeatureCard() {
  return (
    <Card className="artivus-fade-in">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle>Creative Tools</CardTitle>
          <Badge variant="accent">New</Badge>
        </div>
        <CardDescription>
          Professional-grade tools for creative workflows
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-[var(--artivus-text-secondary)]">
          Explore our comprehensive suite of design tools...
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm">Learn More</Button>
      </CardFooter>
    </Card>
  );
}
```

## Design Guidelines

### Spacing
- Use generous whitespace between elements
- Maintain consistent padding: 14px (inputs), 16px (cards), 24px (sections)
- Vertical rhythm: 6px base unit

### Borders
- Default border opacity: 6-8%
- Hover border opacity: 12%
- Focus border: Purple accent (rgba(139, 92, 246, 0.6))

### Transitions
- Default duration: 0.4-0.5s
- Fast transitions: 0.3s
- Button animations: 0.5s
- Easing: `cubic-bezier(0.23, 1, 0.32, 1)` for smooth effects

### Typography
- Labels: UPPERCASE, 10px, 3px letter-spacing
- Body text: 15px, 1px letter-spacing
- Display text: 32px, 0.1em letter-spacing, italic for emphasis
- Placeholder text: Italic style

### Gradients
- Main gradient: `#667eea → #764ba2 → #f5576c` (135deg)
- Subtle gradient: `#667eea → #764ba2` (horizontal)
- Use for: Button fills, input focus lines, checkbox fills

## Accessibility

All components follow WCAG 2.1 AA guidelines:
- Sufficient color contrast (4.5:1 for text)
- Focus states for keyboard navigation
- Semantic HTML elements
- ARIA labels where appropriate
- Smooth animations respect `prefers-reduced-motion`

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions  
- Safari: Latest 2 versions
- Mobile browsers: iOS Safari 14+, Chrome Android

## Credits

Design inspired by the ARTIVUS creative space concept, featuring:
- **Fonts**: Playfair Display, Inter, Noto Serif SC
- **Icons**: Lucide React
- **Primitives**: Radix UI
- **Styling**: Tailwind CSS v4
- **Animations**: CSS cubic-bezier easing
