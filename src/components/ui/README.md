# 🎨 UI Components Library

## Overview

The Okaeri Resort System uses a comprehensive UI component library built on **shadcn/ui** with **Radix UI** primitives, styled with **Tailwind CSS v4**. This library provides 50+ reusable, accessible, and customizable components following enterprise design principles.

## 🏗️ Component Architecture

```
ui/
├── Core Components      # Fundamental building blocks
├── Form Components      # Input and form controls
├── Layout Components    # Page structure elements
├── Display Components   # Data presentation
├── Feedback Components  # User feedback and notifications
└── Utility Components   # Helper and utility components
```

## 📦 Component Catalog

### Core Components

#### Button

Versatile button component with multiple variants and sizes.

```tsx
import { Button } from '@/components/ui/button'

// Variants
<Button variant="default">Default</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><IconName /></Button>

// States
<Button disabled>Disabled</Button>
<Button loading>Loading...</Button>
<Button asChild>
  <Link to="/path">As Link</Link>
</Button>
```

**Props Interface**:
```typescript
interface ButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  asChild?: boolean
  loading?: boolean
  disabled?: boolean
  className?: string
  onClick?: () => void
}
```

#### Badge

Status indicators and labels.

```tsx
import { Badge } from '@/components/ui/badge'

<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Outline</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>

// Custom colors
<Badge className="bg-blue-500 text-white">Custom</Badge>
```

#### Card

Container component for grouping related content.

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description goes here</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter className="flex justify-between">
    <Button variant="outline">Cancel</Button>
    <Button>Save</Button>
  </CardFooter>
</Card>
```

### Form Components

#### Input

Text input field with various types and states.

```tsx
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Basic usage
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    placeholder="Enter your email"
    required
  />
</div>

// With icon
<div className="relative">
  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
  <Input className="pl-8" placeholder="Search..." />
</div>

// Error state
<Input className="border-red-500" aria-invalid="true" />
<p className="text-sm text-red-500">Email is required</p>
```

#### Select

Dropdown selection component.

```tsx
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

<Select defaultValue="option1">
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Select an option" />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>Options</SelectLabel>
      <SelectItem value="option1">Option 1</SelectItem>
      <SelectItem value="option2">Option 2</SelectItem>
      <SelectItem value="option3">Option 3</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>
```

#### Checkbox

Checkbox input with label.

```tsx
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

<div className="flex items-center space-x-2">
  <Checkbox id="terms" />
  <Label
    htmlFor="terms"
    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
  >
    Accept terms and conditions
  </Label>
</div>

// Controlled
const [checked, setChecked] = useState(false)

<Checkbox
  checked={checked}
  onCheckedChange={setChecked}
/>
```

#### DatePicker (Calendar)

Date selection component with calendar view.

```tsx
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"

function DatePicker() {
  const [date, setDate] = useState<Date>()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
```

### Layout Components

#### Dialog (Modal)

Modal dialog for important interactions.

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent className="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>Edit Profile</DialogTitle>
      <DialogDescription>
        Make changes to your profile here.
      </DialogDescription>
    </DialogHeader>
    <div className="grid gap-4 py-4">
      {/* Form content */}
    </div>
    <DialogFooter>
      <Button type="submit">Save changes</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

#### Sheet (Drawer)

Sliding panel for secondary content.

```tsx
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

<Sheet>
  <SheetTrigger asChild>
    <Button variant="outline">Open Sheet</Button>
  </SheetTrigger>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>Settings</SheetTitle>
      <SheetDescription>
        Configure your preferences
      </SheetDescription>
    </SheetHeader>
    {/* Content */}
  </SheetContent>
</Sheet>
```

#### Tabs

Tabbed interface for organizing content.

```tsx
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

<Tabs defaultValue="overview" className="w-full">
  <TabsList className="grid w-full grid-cols-3">
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="analytics">Analytics</TabsTrigger>
    <TabsTrigger value="reports">Reports</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">
    <Card>
      <CardHeader>
        <CardTitle>Overview</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Overview content */}
      </CardContent>
    </Card>
  </TabsContent>
  {/* More tab contents */}
</Tabs>
```

### Display Components

#### Table

Data table with sorting and filtering capabilities.

```tsx
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

<Table>
  <TableCaption>Recent bookings</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead>Booking ID</TableHead>
      <TableHead>Guest</TableHead>
      <TableHead>Check-in</TableHead>
      <TableHead className="text-right">Amount</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {bookings.map((booking) => (
      <TableRow key={booking.id}>
        <TableCell className="font-mono">{booking.id}</TableCell>
        <TableCell>{booking.guest}</TableCell>
        <TableCell>{booking.checkIn}</TableCell>
        <TableCell className="text-right">₱{booking.amount}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

#### Avatar

User avatar with fallback.

```tsx
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"

<Avatar>
  <AvatarImage src="/avatars/user.jpg" alt="User" />
  <AvatarFallback>JD</AvatarFallback>
</Avatar>

// Different sizes
<Avatar className="h-8 w-8">
  <AvatarFallback className="text-xs">SM</AvatarFallback>
</Avatar>

<Avatar className="h-16 w-16">
  <AvatarFallback className="text-2xl">LG</AvatarFallback>
</Avatar>
```

#### Progress

Progress indicators for loading states.

```tsx
import { Progress } from "@/components/ui/progress"

// Basic progress
<Progress value={33} className="w-60" />

// With label
<div className="space-y-2">
  <div className="flex justify-between text-sm">
    <span>Uploading...</span>
    <span>66%</span>
  </div>
  <Progress value={66} />
</div>

// Dynamic progress
const [progress, setProgress] = useState(0)

useEffect(() => {
  const timer = setInterval(() => {
    setProgress((prev) => (prev >= 100 ? 0 : prev + 10))
  }, 500)
  return () => clearInterval(timer)
}, [])

<Progress value={progress} />
```

### Feedback Components

#### Alert

Alert messages for important information.

```tsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

<Alert>
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Heads up!</AlertTitle>
  <AlertDescription>
    You have unpaid bookings that require attention.
  </AlertDescription>
</Alert>

// Variants
<Alert variant="destructive">
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>
    Your session has expired.
  </AlertDescription>
</Alert>
```

#### Toast (Sonner)

Toast notifications for user feedback.

```tsx
import { toast } from "sonner"

// Success toast
toast.success("Booking created successfully")

// Error toast
toast.error("Failed to save changes")

// Custom toast
toast.custom((t) => (
  <div className="flex items-center gap-2">
    <Loader2 className="h-4 w-4 animate-spin" />
    <span>Processing payment...</span>
  </div>
))

// Promise toast
toast.promise(saveBooking(), {
  loading: 'Saving booking...',
  success: 'Booking saved!',
  error: 'Failed to save booking',
})
```

#### Skeleton

Loading placeholders for content.

```tsx
import { Skeleton } from "@/components/ui/skeleton"

// Text skeleton
<div className="space-y-2">
  <Skeleton className="h-4 w-[250px]" />
  <Skeleton className="h-4 w-[200px]" />
</div>

// Card skeleton
<Card>
  <CardHeader>
    <Skeleton className="h-6 w-[150px]" />
    <Skeleton className="h-4 w-[200px]" />
  </CardHeader>
  <CardContent>
    <Skeleton className="h-[200px] w-full" />
  </CardContent>
</Card>

// Table skeleton
<Table>
  <TableBody>
    {Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
        <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
        <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### Utility Components

#### Tooltip

Contextual information on hover.

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon">
        <Info className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Additional information</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

#### Separator

Visual divider between content sections.

```tsx
import { Separator } from "@/components/ui/separator"

<div>
  <div className="space-y-1">
    <h4 className="text-sm font-medium">Profile</h4>
    <p className="text-sm text-muted-foreground">
      Manage your account settings
    </p>
  </div>
  <Separator className="my-4" />
  <div className="space-y-1">
    <h4 className="text-sm font-medium">Preferences</h4>
    <p className="text-sm text-muted-foreground">
      Customize your experience
    </p>
  </div>
</div>
```

#### ScrollArea

Scrollable container with custom scrollbar.

```tsx
import { ScrollArea } from "@/components/ui/scroll-area"

<ScrollArea className="h-[200px] w-[350px] rounded-md border p-4">
  {Array.from({ length: 50 }).map((_, i) => (
    <div key={i} className="text-sm">
      Item {i + 1}
    </div>
  ))}
</ScrollArea>
```

## 🎨 Styling System

### Color Palette

```css
/* CSS Variables (Tailwind v4) */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
  --radius: 0.5rem;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... dark mode colors */
}
```

### Typography

```tsx
// Heading styles
<h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
  Main Heading
</h1>

<h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight">
  Section Heading
</h2>

<h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
  Subsection
</h3>

// Body text
<p className="leading-7 [&:not(:first-child)]:mt-6">
  Body paragraph with proper spacing
</p>

// Muted text
<p className="text-sm text-muted-foreground">
  Secondary information
</p>

// Monospace
<code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">
  inline-code
</code>
```

### Responsive Design

```tsx
// Responsive grid
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {/* Cards */}
</div>

// Responsive spacing
<div className="space-y-4 md:space-y-6 lg:space-y-8">
  {/* Content */}
</div>

// Responsive text
<h1 className="text-2xl md:text-3xl lg:text-4xl">
  Responsive Heading
</h1>

// Hide/Show on breakpoints
<div className="hidden md:block">Desktop only</div>
<div className="block md:hidden">Mobile only</div>
```

## 🔧 Component Patterns

### Form Pattern

```tsx
function BookingForm() {
  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      guestName: "",
      checkIn: undefined,
      checkOut: undefined,
    },
  })

  const onSubmit = async (data: BookingFormData) => {
    try {
      await createBooking(data)
      toast.success("Booking created")
    } catch (error) {
      toast.error("Failed to create booking")
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="guestName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Guest Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
              </FormControl>
              <FormDescription>
                Enter the primary guest's full name
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Submit
        </Button>
      </form>
    </Form>
  )
}
```

### Loading Pattern

```tsx
function DataComponent() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['data'],
    queryFn: fetchData,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-[200px]" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    )
  }

  return <DataDisplay data={data} />
}
```

## ♿ Accessibility

All components follow WCAG 2.1 Level AA standards:

- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: Proper ARIA labels and descriptions
- **Focus Management**: Clear focus indicators
- **Color Contrast**: Meets minimum contrast ratios
- **Semantic HTML**: Proper element usage

```tsx
// Accessibility examples
<Button aria-label="Delete booking">
  <Trash className="h-4 w-4" />
</Button>

<Input
  aria-invalid={!!errors.email}
  aria-describedby="email-error"
/>

<Dialog aria-labelledby="dialog-title">
  <DialogTitle id="dialog-title">Confirm Action</DialogTitle>
</Dialog>
```

## 🚀 Performance Tips

1. **Lazy Load Heavy Components**:
```tsx
const HeavyComponent = lazy(() => import('./HeavyComponent'))
```

2. **Memoize Expensive Computations**:
```tsx
const expensiveValue = useMemo(() => computeExpensive(data), [data])
```

3. **Use Virtual Scrolling for Long Lists**:
```tsx
import { VirtualList } from '@tanstack/react-virtual'
```

4. **Optimize Bundle Size**:
```tsx
// Import only what you need
import { Button } from '@/components/ui/button'
// Not: import * as UI from '@/components/ui'
```

## 📚 Additional Resources

- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Radix UI Documentation](https://www.radix-ui.com)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [Component Best Practices](./COMPONENT_GUIDELINES.md)
- [Accessibility Guide](./ACCESSIBILITY.md)