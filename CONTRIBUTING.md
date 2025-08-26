# Contributing to Okaeri Resort Management System

Thank you for your interest in contributing to the Okaeri Resort Management
System! This document provides guidelines and instructions for contributing to
the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Architecture Decisions](#architecture-decisions)
- [Documentation](#documentation)
- [Community](#community)

## Code of Conduct

### Our Pledge

We are committed to providing a friendly, safe, and welcoming environment for
all contributors, regardless of experience level, gender identity and
expression, sexual orientation, disability, personal appearance, body size,
race, ethnicity, age, religion, nationality, or other similar characteristics.

### Our Standards

Examples of behavior that contributes to a positive environment:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

Examples of unacceptable behavior:

- Use of sexualized language or imagery
- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- Node.js 20.x or higher installed
- npm 10.x or higher
- Git configured with your GitHub account
- A code editor with TypeScript support (VS Code recommended)
- Familiarity with React, TypeScript, and modern web development

### Setting Up Your Development Environment

1. **Fork the Repository**

   ```bash
   # Fork via GitHub UI, then clone your fork
   git clone https://github.com/YOUR_USERNAME/okaeri-resort-system.git
   cd okaeri-resort-system
   ```

2. **Add Upstream Remote**

   ```bash
   git remote add upstream https://github.com/okaeri-dev/okaeri-resort-system.git
   ```

3. **Install Dependencies**

   ```bash
   npm install
   ```

4. **Set Up Environment Variables**

   ```bash
   cp .env.example .env.local
   # Configure your local environment variables
   ```

5. **Run Development Server**

   ```bash
   npm run dev
   ```

6. **Run Tests**
   ```bash
   npm run test
   ```

## Development Process

### Branch Naming Convention

- `feature/[feature-name]`: New features
- `fix/[bug-description]`: Bug fixes
- `docs/[doc-update]`: Documentation updates
- `refactor/[component-name]`: Code refactoring
- `test/[test-description]`: Test additions or updates
- `perf/[optimization-description]`: Performance improvements

### Workflow Steps

1. **Create a New Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Write clean, maintainable code
   - Follow the coding standards
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Your Changes**

   ```bash
   npm run test
   npm run type-check
   npm run lint
   ```

4. **Commit Your Changes**

   ```bash
   git add .
   git commit -m "feat: add new booking feature"
   ```

5. **Push to Your Fork**

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**
   - Use the PR template
   - Link related issues
   - Provide clear description

## Coding Standards

### TypeScript Guidelines

```typescript
// Use explicit types for function parameters and return values
function calculateTotal(items: BookingItem[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// Use interfaces for object shapes
interface User {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "staff";
}

// Use enums for constants
enum BookingStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  CANCELLED = "cancelled",
}
```

### React Component Guidelines

```tsx
// Use functional components with TypeScript
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
}: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded px-4 py-2",
        variant === "primary" && "bg-blue-500 text-white",
        variant === "secondary" && "bg-gray-200 text-gray-800",
        disabled && "cursor-not-allowed opacity-50"
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
```

### File Organization

```
src/
├── app/                    # Application modules
│   └── bookings/
│       ├── components/    # Module-specific components
│       ├── hooks/         # Module-specific hooks
│       ├── services/      # API services
│       ├── stores/        # Zustand stores
│       ├── types/         # TypeScript types
│       └── utils/         # Utility functions
├── components/            # Shared components
│   ├── ui/               # Base UI components
│   └── features/         # Feature components
├── hooks/                # Shared hooks
├── lib/                  # Third-party library configs
├── services/             # Shared API services
├── stores/               # Global stores
├── types/                # Global types
└── utils/                # Shared utilities
```

### Style Guidelines

- Use Tailwind CSS for styling
- Follow mobile-first responsive design
- Use CSS variables for theme values
- Avoid inline styles except for dynamic values
- Use `cn()` utility for conditional classes

```tsx
// Good
<div className={cn(
  "p-4 rounded-lg",
  isActive && "bg-blue-100",
  isDisabled && "opacity-50"
)}>

// Avoid
<div style={{ padding: '16px', borderRadius: '8px' }}>
```

## Testing Guidelines

### Test File Naming

- Unit tests: `[component].test.tsx`
- Integration tests: `[feature].integration.test.ts`
- E2E tests: `[flow].e2e.test.ts`

### Testing Patterns

```tsx
// Component Testing
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("should render children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("should call onClick when clicked", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText("Click me"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Testing Requirements

- All new features must have tests
- Maintain test coverage above 80%
- Test edge cases and error scenarios
- Mock external dependencies
- Use meaningful test descriptions

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/)
specification.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions or changes
- `build`: Build system changes
- `ci`: CI configuration changes
- `chore`: Other changes (tooling, dependencies, etc.)

### Examples

```bash
# Feature
feat(bookings): add CSV import functionality

# Bug fix
fix(auth): resolve token refresh issue

# Documentation
docs(api): update API endpoint documentation

# Performance
perf(dashboard): optimize chart rendering
```

### Commit Message Guidelines

- Use present tense ("add feature" not "added feature")
- Use imperative mood ("move cursor to..." not "moves cursor to...")
- Limit first line to 72 characters
- Reference issues and pull requests in the body

## Pull Request Process

### Before Creating a PR

1. **Update from upstream**

   ```bash
   git fetch upstream
   git rebase upstream/develop
   ```

2. **Run all checks**

   ```bash
   npm run lint:fix
   npm run format
   npm run test
   npm run type-check
   npm run build
   ```

3. **Update documentation**
   - Update README if needed
   - Add/update JSDoc comments
   - Update API documentation

### PR Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added/updated
- [ ] All tests passing

## Screenshots (if applicable)

Add screenshots for UI changes

## Related Issues

Closes #(issue number)
```

### Review Process

1. At least one maintainer approval required
2. All CI checks must pass
3. No merge conflicts
4. Code coverage maintained or improved
5. Documentation updated

## Architecture Decisions

### Key Principles

1. **Cost Optimization**: Target $1-3/month operational costs
2. **Performance**: Sub-3 second page loads, 60fps interactions
3. **Security**: Zero-trust architecture, data isolation
4. **Scalability**: Support 3-5 projects per account
5. **Maintainability**: Simple, readable, documented code

### Technology Choices

When proposing new dependencies or architectural changes:

- Justify the need and benefits
- Consider bundle size impact
- Evaluate long-term maintenance
- Assess cost implications
- Provide migration path if replacing existing solution

### Performance Considerations

- Lazy load routes and heavy components
- Optimize images and assets
- Minimize API calls
- Implement proper caching strategies
- Monitor Core Web Vitals

## Documentation

### Code Documentation

```typescript
/**
 * Calculates the total price for a booking including taxes and fees
 * @param booking - The booking object containing price information
 * @param taxRate - The applicable tax rate (default: 0.12 for Philippines)
 * @returns The total price including all charges
 * @example
 * const total = calculateBookingTotal(booking, 0.12);
 */
export function calculateBookingTotal(
  booking: Booking,
  taxRate: number = 0.12
): number {
  // Implementation
}
```

### Documentation Requirements

- All public APIs must be documented
- Complex algorithms need inline comments
- Update README for new features
- Maintain changelog for releases
- Document breaking changes

## Community

### Getting Help

- Check existing issues and discussions
- Join our Discord server (coming soon)
- Email: dev@okaeri-resort.com
- Read the documentation thoroughly

### Reporting Issues

When reporting issues, include:

- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, browser, Node version)
- Screenshots or error messages
- Relevant code snippets

### Feature Requests

For feature requests:

- Check if already requested
- Provide use case and benefits
- Consider implementation complexity
- Align with project goals
- Be open to discussion

## Recognition

Contributors will be recognized in:

- Project README
- Release notes
- Annual contributor report
- Special badges for consistent contributors

## Questions?

If you have questions about contributing:

1. Check this guide thoroughly
2. Look for similar issues/discussions
3. Ask in a new discussion
4. Contact the maintainers

Thank you for contributing to the Okaeri Resort Management System! Your efforts
help make resort management accessible and affordable for family businesses in
the Philippines and beyond.
