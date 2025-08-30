# Contributing to Okaeri Resort Management System

Thank you for your interest in contributing to the Okaeri Resort Management
System! This document provides guidelines and instructions for contributing to
the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Coding Standards](#coding-standards)
- [TDD Requirements](#tdd-requirements)
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

### TDD Workflow

We follow Test-Driven Development (TDD) practices. **All new features must be
implemented using TDD**.

1. **Create a New Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Follow TDD Red-Green-Refactor Cycle**
   - **Red**: Write a failing test first
   - **Green**: Write minimal code to make the test pass
   - **Refactor**: Improve code structure while keeping tests green
3. **Implementation Guidelines**
   - Start with failing tests before any implementation
   - Write only enough code to make tests pass
   - Refactor with confidence knowing tests will catch regressions
   - Follow the coding standards
   - Update documentation as needed

4. **Test Your Changes**

   ```bash
   npm run test
   npm run type-check
   npm run lint
   ```

5. **Commit Your Changes**

   ```bash
   git add .
   git commit -m "feat: add new booking feature"
   ```

6. **Push to Your Fork**

   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request**
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

## TDD Requirements

### Mandatory TDD for All New Features

**Every new feature, component, or significant change must follow Test-Driven
Development practices.** This means:

- Tests must be written **before** implementation
- No code should be committed without corresponding tests
- All tests must pass before creating a pull request
- Minimum 80% code coverage must be maintained

### TDD Workflow Process

#### 1. Red Phase - Write Failing Tests

```typescript
// Example: Testing a booking calculation feature
describe("BookingCalculator", () => {
  it("should calculate total with tax and fees", () => {
    // This test will fail initially - that's expected!
    const booking = { basePrice: 100, nights: 2 };
    const calculator = new BookingCalculator();

    const result = calculator.calculateTotal(booking);

    expect(result.subtotal).toBe(200);
    expect(result.tax).toBe(24); // 12% tax
    expect(result.total).toBe(224);
  });
});
```

#### 2. Green Phase - Make Tests Pass

```typescript
// Write minimal implementation to make the test pass
export class BookingCalculator {
  calculateTotal(booking: { basePrice: number; nights: number }) {
    const subtotal = booking.basePrice * booking.nights;
    const tax = subtotal * 0.12;
    const total = subtotal + tax;

    return { subtotal, tax, total };
  }
}
```

#### 3. Refactor Phase - Improve Code Structure

```typescript
// Refactor for better structure while keeping tests green
export class BookingCalculator {
  private readonly TAX_RATE = 0.12;

  calculateTotal(booking: BookingRequest): BookingTotal {
    const subtotal = this.calculateSubtotal(booking);
    const tax = this.calculateTax(subtotal);
    const total = subtotal + tax;

    return { subtotal, tax, total };
  }

  private calculateSubtotal({ basePrice, nights }: BookingRequest): number {
    return basePrice * nights;
  }

  private calculateTax(amount: number): number {
    return amount * this.TAX_RATE;
  }
}
```

### Coverage Requirements

- **Minimum 80% overall code coverage** must be maintained
- **90% coverage for business-critical modules** (bookings, payments, user
  management)
- **100% coverage for utility functions** and pure functions
- Coverage reports are generated automatically in CI/CD

### Test-First Development Examples

#### React Component Example

```tsx
// 1. Write test first (Red phase)
describe("BookingForm", () => {
  it("should validate required fields before submission", async () => {
    const mockOnSubmit = vi.fn();
    render(<BookingForm onSubmit={mockOnSubmit} />);

    const submitButton = screen.getByRole("button", { name: /submit/i });
    fireEvent.click(submitButton);

    expect(screen.getByText("Guest name is required")).toBeInTheDocument();
    expect(screen.getByText("Check-in date is required")).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});

// 2. Implement component (Green phase)
export function BookingForm({ onSubmit }: BookingFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!guestName) newErrors.guestName = "Guest name is required";
    if (!checkInDate) newErrors.checkInDate = "Check-in date is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>{/* Form fields with error display */}</form>
  );
}
```

#### API Endpoint Example

```typescript
// 1. Write test first (Red phase)
describe("POST /api/bookings", () => {
  it("should create booking with valid data", async () => {
    const bookingData = {
      guestName: "John Doe",
      checkIn: "2024-03-15",
      checkOut: "2024-03-17",
      roomType: "deluxe",
    };

    const response = await request(app)
      .post("/api/bookings")
      .send(bookingData)
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.status).toBe("confirmed");
    expect(response.body.guestName).toBe("John Doe");
  });
});

// 2. Implement endpoint (Green phase)
app.post("/api/bookings", async (req, res) => {
  const booking = await bookingService.create(req.body);
  res.status(201).json(booking);
});
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

### Test Writing Standards

#### Test Naming Conventions

```typescript
// Use descriptive names that explain behavior
describe("UserAuthService", () => {
  describe("login", () => {
    it("should return user token for valid credentials", () => {});
    it("should throw AuthError for invalid password", () => {});
    it("should lock account after 5 failed attempts", () => {});
  });
});
```

#### AAA Pattern (Arrange-Act-Assert)

```typescript
it("should calculate booking total with discount", () => {
  // Arrange
  const booking = { basePrice: 100, nights: 3 };
  const discount = { type: "percentage", value: 10 };
  const calculator = new BookingCalculator();

  // Act
  const result = calculator.calculateWithDiscount(booking, discount);

  // Assert
  expect(result.total).toBe(270); // 300 - 10% discount
  expect(result.discountApplied).toBe(30);
});
```

#### Test Isolation Requirements

```typescript
// Each test should be independent
describe("BookingRepository", () => {
  beforeEach(() => {
    // Clean state before each test
    database.clear();
    vi.resetAllMocks();
  });

  it("should save booking to database", () => {
    // Test doesn't depend on other tests
  });
});
```

#### Mock Usage Guidelines

```typescript
// Mock external dependencies, not internal logic
describe("PaymentService", () => {
  it("should process payment through gateway", async () => {
    // Mock external payment gateway
    const mockGateway = {
      charge: vi.fn().mockResolvedValue({ id: "txn_123", status: "success" }),
    };

    const service = new PaymentService(mockGateway);
    const result = await service.processPayment({ amount: 100 });

    expect(mockGateway.charge).toHaveBeenCalledWith({ amount: 100 });
    expect(result.transactionId).toBe("txn_123");
  });
});
```

#### Testing Business Logic Examples

**Booking Logic Testing:**

```typescript
describe("BookingBusinessLogic", () => {
  describe("room availability", () => {
    it("should return false when room is already booked for dates", () => {
      // Arrange
      const existingBookings = [
        { roomId: "room-1", checkIn: "2024-03-10", checkOut: "2024-03-15" },
      ];
      const newBooking = {
        roomId: "room-1",
        checkIn: "2024-03-12",
        checkOut: "2024-03-14",
      };

      // Act
      const isAvailable = checkRoomAvailability(existingBookings, newBooking);

      // Assert
      expect(isAvailable).toBe(false);
    });
  });
});
```

**Payment Logic Testing:**

```typescript
describe("PaymentCalculator", () => {
  it("should apply correct tax based on location", () => {
    // Arrange
    const booking = { amount: 1000, location: "philippines" };

    // Act
    const total = calculatePaymentTotal(booking);

    // Assert
    expect(total.tax).toBe(120); // 12% VAT in Philippines
    expect(total.total).toBe(1120);
  });
});
```

### Testing Requirements

- **All new features must follow TDD workflow**
- **Tests must be written before implementation**
- Maintain test coverage above 80%
- Test edge cases and error scenarios
- Mock external dependencies appropriately
- Use descriptive test names that explain behavior
- Follow AAA pattern for test structure
- Ensure test isolation and independence

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

### Enhanced Pull Request Checklist

Before submitting a pull request, ensure all TDD requirements are met:

#### TDD Compliance Checklist

- [ ] **Tests written before implementation** (Red phase completed)
- [ ] **All tests passing** (Green phase completed)
- [ ] **Code refactored for quality** (Refactor phase completed)
- [ ] **Test coverage maintained or improved** (minimum 80%)
- [ ] **Test descriptions are clear and descriptive**
- [ ] **Edge cases and error scenarios tested**
- [ ] **Mocks used appropriately** (external dependencies only)
- [ ] **Tests follow AAA pattern** (Arrange-Act-Assert)

### PR Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## TDD Compliance

- [ ] Tests written before implementation (TDD Red phase)
- [ ] Minimal code written to pass tests (TDD Green phase)
- [ ] Code refactored for quality (TDD Refactor phase)
- [ ] Test coverage maintained/improved (≥80%)
- [ ] Test descriptions are clear and meaningful
- [ ] AAA pattern followed in test structure
- [ ] External dependencies properly mocked
- [ ] Edge cases and error scenarios covered

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Coverage report reviewed

### Test Coverage Report
```

Current Coverage: XX% Previous Coverage: XX% Change: +/-XX%

````

## Examples of TDD Implementation

### Tests Written First (Red Phase)
```typescript
// Show the failing tests that drove implementation
````

### Implementation (Green Phase)

```typescript
// Show minimal code that made tests pass
```

### Refactored Code (Refactor Phase)

```typescript
// Show improved code structure
```

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] TDD workflow followed completely
- [ ] Reference to TDD Implementation Guide (if applicable)

## Screenshots (if applicable)

Add screenshots for UI changes

## Related Issues

Closes #(issue number)

````

### Review Process

1. **TDD Compliance Verification**
   - Tests written before implementation confirmed
   - Red-Green-Refactor cycle evidence provided
   - Test quality and coverage reviewed

2. At least one maintainer approval required
3. All CI checks must pass
4. No merge conflicts
5. **Code coverage maintained or improved** (≥80%)
6. Documentation updated
7. **TDD Implementation Guide referenced** where applicable

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
````

### Documentation Requirements

- All public APIs must be documented
- Complex algorithms need inline comments
- Update README for new features
- Maintain changelog for releases
- Document breaking changes
- **Reference TDD Implementation Guide** for complex features
- **Include test examples** in API documentation
- **Document test patterns** for domain-specific logic

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
