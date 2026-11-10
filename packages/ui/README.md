# `@bazion/ui`

Shared, framework-light React components and CSS primitives for product websites in the Bazion workspace. Church-specific composition stays in adapters such as `ChurchNav`; templates can use the generic components directly.

## Stylesheets

Import these styles once from the consuming app's root layout, in this order:

```ts
import "@bazion/ui/tokens.css";
import "@bazion/ui/primitives.css";
import "@bazion/ui/navigation.css";
```

Church/Ministry storefronts additionally import `@bazion/ui/church.css`, which maps the shared color, typography, radius and shadow roles to the ministry theme. Consumers that define their own theme can override the `--bw-*` CSS custom properties after importing `tokens.css`.

## Site navigation

```tsx
import { SiteNavigation } from "@bazion/ui";

<SiteNavigation
  brandName="Community Centre"
  currentPath="/services"
  links={[
    { label: "Home", href: "/" },
    { label: "Services", href: "/services" },
    { label: "Contact", href: "/contact" },
  ]}
  primaryAction={{ label: "Book a visit", href: "/contact" }}
/>
```

Navigation links and actions accept same-site paths or credential-free HTTPS destinations. The component supplies a skip link, accessible menu button state, keyboard Escape handling with focus return, and active-page state. Set `mainContentId` if the target main element uses an id other than `main-content`.

Use `ChurchNav` when the product needs the ministry name and optional giving action. It adapts those terms to `SiteNavigation` without owning separate navigation behavior.

## Layout and forms

Use `Container`, `Section`, `Grid`, `Stack`, and `Cluster` for responsive page structure. `TextField`, `TextAreaField`, and `SelectField` require a stable `id` and visible `label`; optional `hint` and `error` text are connected to the control with `aria-describedby`.
