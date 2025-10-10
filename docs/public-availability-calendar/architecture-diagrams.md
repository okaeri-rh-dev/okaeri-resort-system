# Architecture Diagrams

> **Visual system architecture for public availability calendar**

This document provides comprehensive visual diagrams of the public availability calendar system architecture, data flows, component hierarchy, and caching strategy.

---

## System Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        A[Guest Browser<br/>Desktop/Laptop]
        B[Mobile Browser<br/>iOS/Android - Responsive Web]
    end

    subgraph "CDN Layer - Cloudflare"
        C[CDN Edge Cache<br/>5-min TTL]
        D[Rate Limiter<br/>100 req/min]
        E[DDoS Protection]
    end

    subgraph "Application Layer - Cloudflare Pages"
        F[React App<br/>/calendar<br/>VIEW-ONLY: No Pricing]
        G[TanStack Query<br/>Client Cache]
    end

    subgraph "API Layer - Cloudflare Workers"
        H[API Endpoint<br/>/api/public/v1/availability]
        I[Input Validation]
        J[Response Transform]
    end

    subgraph "Database Layer - Supabase"
        K[(PostgreSQL<br/>Neon Serverless)]
        L[RPC Function<br/>get_public_availability]
        M[Bookings Table]
    end

    A --> C
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H --> I
    I --> L
    L --> M
    M --> L
    L --> J
    J --> H
    H --> G
    G --> F
    F --> C
    C --> A
    C --> B

    style C fill:#f9f,stroke:#333,stroke-width:2px
    style L fill:#bbf,stroke:#333,stroke-width:2px
    style F fill:#bfb,stroke:#333,stroke-width:2px
```

---

## Data Flow Diagram

### Request Flow (Happy Path)

```mermaid
sequenceDiagram
    participant Guest
    participant CDN as Cloudflare CDN
    participant React as React App
    participant TQ as TanStack Query
    participant API as API Endpoint
    participant DB as PostgreSQL
    participant Cache as CDN Cache

    Guest->>CDN: GET /calendar
    CDN->>Cache: Check cache

    alt Cache Miss
        Cache-->>CDN: Not found
        CDN->>React: Forward request
        React->>TQ: useQuery('publicAvailability')
        TQ->>API: GET /api/public/v1/availability?start=...&end=...
        API->>DB: CALL get_public_aggregate_availability(start, end)
        DB->>DB: Query bookings table
        DB-->>API: Return {date, available_count}[]
        API->>API: Transform to API format
        API-->>TQ: Return AvailabilityResponse
        TQ->>TQ: Cache in memory (5 min)
        TQ-->>React: Render calendar
        React-->>CDN: HTML response
        CDN->>Cache: Store in cache (5 min)
        CDN-->>Guest: Display calendar
    else Cache Hit
        Cache-->>CDN: Return cached HTML
        CDN-->>Guest: Display calendar (< 100ms)
    end
```

### Stale-While-Revalidate Flow

```mermaid
sequenceDiagram
    participant Guest
    participant CDN
    participant Cache
    participant API
    participant DB

    Guest->>CDN: GET /calendar
    CDN->>Cache: Check cache
    Cache-->>CDN: Stale data (6 min old)
    CDN-->>Guest: Return stale data immediately

    par Background Revalidation
        CDN->>API: Fetch fresh data
        API->>DB: Query bookings
        DB-->>API: Return data
        API-->>CDN: Fresh response
        CDN->>Cache: Update cache
    end

    Note over Guest,Cache: Guest gets instant response<br/>Cache updates in background
```

---

## Component Hierarchy

```mermaid
graph TD
    A[AvailabilityPage<br/>Route: /calendar] --> B[Header<br/>Title + Description]
    A --> C[PublicAvailabilityCalendar]
    A --> D[ViewOnlyInfo<br/>Information Box]
    A --> E[Footer]

    C --> F[CalendarHeader<br/>Month Navigation]
    C --> G[AvailabilityLegend<br/>Color Key]
    C --> H[CalendarGrid]
    C --> I[LoadingState<br/>Spinner]
    C --> J[ErrorState<br/>Alert Message]

    H --> K[DayCell x 42<br/>Color-coded]

    K --> L{Availability Status}
    L -->|3 units| M[Green<br/>bg-green-500]
    L -->|2 units| N[Yellow<br/>bg-yellow-500]
    L -->|1 unit| O[Orange<br/>bg-orange-500]
    L -->|0 units| P[Red<br/>bg-red-500]

    D --> Q[View-Only Message<br/>Return to main site]

    style C fill:#bbf,stroke:#333,stroke-width:2px
    style H fill:#bfb,stroke:#333,stroke-width:2px
    style D fill:#e0f7fa,stroke:#333,stroke-width:2px
```

---

## Database Query Flow

```mermaid
graph LR
    subgraph "API Layer"
        A[API Request<br/>start=2025-01-01<br/>end=2025-01-31]
    end

    subgraph "PostgreSQL Function"
        B[get_public_availability]
        C[Generate Date Series<br/>Jan 1 - Jan 31]
        D[LEFT JOIN bookings]
        E[WHERE status IN<br/>'Confirmed', 'CheckedIn']
        F[GROUP BY date<br/>COUNT DISTINCT unit_id]
        G[Calculate:<br/>3 - occupied_count]
    end

    subgraph "Database Tables"
        H[(bookings table<br/>3 confirmed bookings)]
        I[Index:<br/>idx_bookings_status_dates]
    end

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    D --> H
    H --> I
    I --> D

    G --> J[Return:<br/>{date, available_count}[]]
    J --> A

    style B fill:#bbf,stroke:#333,stroke-width:2px
    style H fill:#fbb,stroke:#333,stroke-width:2px
```

### SQL Query Breakdown

```mermaid
flowchart TD
    A[Start: get_public_availability] --> B{Validate Inputs}
    B -->|Invalid| C[RAISE EXCEPTION]
    B -->|Valid| D[Generate Date Series<br/>Jan 1 - Jan 31]

    D --> E[For Each Date]
    E --> F[LEFT JOIN bookings WHERE<br/>status IN 'Confirmed', 'CheckedIn'<br/>AND date >= check_in<br/>AND date < check_out]

    F --> G[COUNT DISTINCT unit_id]
    G --> H[Calculate:<br/>available = 3 - occupied]

    H --> I{More Dates?}
    I -->|Yes| E
    I -->|No| J[ORDER BY date ASC]
    J --> K[RETURN Results]

    style D fill:#bfb,stroke:#333,stroke-width:2px
    style G fill:#ffb,stroke:#333,stroke-width:2px
```

---

## Caching Strategy Layers

```mermaid
graph TB
    subgraph "Layer 1: CDN Edge Cache"
        A[Cloudflare Edge<br/>5-minute TTL]
        B[80%+ Hit Ratio Expected]
    end

    subgraph "Layer 2: Client Cache"
        C[TanStack Query<br/>5-min stale time]
        D[10-min cache time]
        E[Background Refetch]
    end

    subgraph "Layer 3: Database Query"
        F[PostgreSQL<br/>Connection Pooling]
        G[Query Plan Cache]
        H[Index Scan:<br/>idx_bookings_status_dates]
    end

    A -->|Cache Miss| C
    C -->|Stale Data| E
    E -->|Refetch| F
    F -->|Use Index| H
    H -->|< 100ms| F
    F --> C
    C --> A

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style C fill:#9ff,stroke:#333,stroke-width:2px
    style F fill:#bbf,stroke:#333,stroke-width:2px
```

---

## State Management Flow

```mermaid
stateDiagram-v2
    [*] --> Loading: Page Load
    Loading --> Success: Data Fetched
    Loading --> Error: API Error

    Success --> Refetching: Window Focus
    Success --> Refetching: Manual Refresh
    Success --> Refetching: Stale (> 5 min)

    Refetching --> Success: Fresh Data
    Refetching --> Error: API Error

    Error --> Refetching: User Retry

    Success --> [*]: User Leaves Page

    note right of Success
        Calendar displays with
        color-coded availability
    end note

    note right of Refetching
        Shows spinner in header
        Stale data still visible
    end note

    note right of Error
        Shows error alert
        Retry button available
    end note
```

---

## Security Model

```mermaid
graph TB
    subgraph "Public Access - No Auth Required"
        A[Anonymous User]
    end

    subgraph "Protection Layers"
        B[Cloudflare DDoS Protection]
        C[Rate Limiter<br/>100 req/min per IP]
        D[Input Validation<br/>Date format, range limits]
    end

    subgraph "Data Security"
        E[SECURITY DEFINER Function<br/>Runs with owner privileges]
        F[RLS Bypass<br/>Safe aggregation only]
        G[No Guest Data Exposed<br/>Only counts returned]
    end

    subgraph "Database - RLS Enforced"
        H[(bookings table<br/>RLS policies active)]
        I[Anonymous role:<br/>Cannot SELECT bookings]
    end

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G -.->|Aggregated data only| A

    E --> H
    I --> H

    style E fill:#f99,stroke:#333,stroke-width:2px
    style G fill:#9f9,stroke:#333,stroke-width:2px
    style I fill:#fbb,stroke:#333,stroke-width:2px
```

### Data Privacy Flow

```mermaid
flowchart LR
    A[Raw Booking Data<br/>Guest Name: John Doe<br/>Phone: +63912345<br/>Email: john@example.com] --> B{SECURITY DEFINER<br/>Function}

    B --> C[Aggregation Logic<br/>COUNT DISTINCT unit_id]
    C --> D[Safe Output<br/>date: 2025-01-15<br/>available_count: 2]

    D --> E[API Response<br/>No PII]
    E --> F[Public Calendar<br/>Shows: 2 units available]

    style A fill:#fbb,stroke:#333,stroke-width:2px
    style D fill:#bfb,stroke:#333,stroke-width:2px
    style F fill:#bbf,stroke:#333,stroke-width:2px
```

---

## Performance Optimization Flow

```mermaid
graph TD
    A[Initial Request] --> B{CDN Cache Status?}

    B -->|HIT| C[Return Cached Response<br/>< 100ms]
    B -->|MISS| D[Forward to Origin]

    D --> E{TanStack Query Cache?}
    E -->|Fresh| F[Return from Memory<br/>< 50ms]
    E -->|Stale| G[Background Refetch]
    E -->|Empty| H[API Request]

    H --> I[Cloudflare Worker<br/>Input Validation]
    I --> J[Supabase RPC Call]

    J --> K{Connection Pool?}
    K -->|Available| L[Execute Query<br/>< 100ms]
    K -->|Busy| M[Wait for Connection<br/>< 200ms]

    M --> L
    L --> N[Use Index Scan<br/>idx_bookings_status_dates]
    N --> O[Return Results]

    O --> P[Transform & Cache]
    P --> Q[Update CDN Cache]
    Q --> C

    G --> H
    F --> C

    style C fill:#9f9,stroke:#333,stroke-width:3px
    style F fill:#9f9,stroke:#333,stroke-width:3px
    style N fill:#bbf,stroke:#333,stroke-width:2px
```

---

## Error Handling Flow

```mermaid
flowchart TD
    A[User Request] --> B{API Available?}

    B -->|No| C[Network Error<br/>Show: Cannot connect]
    B -->|Yes| D{Response Status}

    D -->|200 OK| E[Parse JSON]
    D -->|400 Bad Request| F[Show: Invalid dates]
    D -->|429 Too Many Requests| G[Show: Please wait<br/>Retry after X seconds]
    D -->|500 Server Error| H[Show: Please try again<br/>Log to Sentry]

    E --> I{Valid Data?}
    I -->|Yes| J[Render Calendar]
    I -->|No| K[Show: Data error<br/>Log to Sentry]

    C --> L[Retry Button]
    F --> L
    G --> M[Auto-retry after delay]
    H --> L
    K --> L

    L --> A
    M --> A

    style J fill:#9f9,stroke:#333,stroke-width:2px
    style C fill:#fbb,stroke:#333,stroke-width:2px
    style H fill:#fbb,stroke:#333,stroke-width:2px
```

---

## Mobile User Flow

> **📌 Note**: Calendar is VIEW-ONLY. Guests return to main website to contact resort for booking.

```mermaid
journey
    title Mobile Guest Journey - Availability Calendar
    section Discovery
      Google Search: 5: Guest
      Click Result: 5: Guest
      Land on /calendar: 5: Guest
    section Calendar Interaction
      View Current Month: 4: Guest
      Swipe to Next Month: 5: Guest
      See Green Dates: 5: Guest
      Tap Date Cell: 4: Guest
      See "2 available": 5: Guest
      Check Multiple Dates: 4: Guest
    section Decision
      Decide on Preferred Dates: 4: Guest
      Read View-Only Message: 4: Guest
      Return to Main Site: 5: Guest
    section External Booking
      Navigate to Contact Page: 5: Guest
      Contact via WhatsApp/Phone: 5: Guest, Manager
      Discuss Availability: 5: Guest, Manager
      Confirm Dates & Pricing: 5: Guest, Manager
    section Post-Booking
      Create Booking in System: 3: Manager
      Send Confirmation: 5: Manager, Guest
      Receive Booking Details: 5: Guest
```

---

## Deployment Pipeline

```mermaid
flowchart LR
    subgraph "Development"
        A[Local Development<br/>npm run dev]
        B[Git Commit]
        C[Push to GitHub]
    end

    subgraph "CI/CD - GitHub Actions"
        D[Run Tests<br/>Vitest + Playwright]
        E[Type Check<br/>TypeScript]
        F[Lint<br/>ESLint + Prettier]
        G[Build<br/>npm run build]
        H[Lighthouse CI<br/>Performance Audit]
    end

    subgraph "Deployment"
        I{All Checks Pass?}
        J[Deploy to Cloudflare Pages]
        K[Deploy Workers to Cloudflare]
        L[Update Database Function<br/>If needed]
    end

    subgraph "Production"
        M[Cloudflare Pages]
        N[Cloudflare CDN]
        O[Supabase Production DB]
    end

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H --> I

    I -->|Yes| J
    I -->|Yes| K
    I -->|If Changed| L
    I -->|No| P[❌ Deployment Blocked]

    J --> M
    K --> N
    L --> O

    style I fill:#ff9,stroke:#333,stroke-width:2px
    style M fill:#9f9,stroke:#333,stroke-width:2px
    style N fill:#9f9,stroke:#333,stroke-width:2px
    style O fill:#9f9,stroke:#333,stroke-width:2px
```

---

## Monitoring & Alerting

```mermaid
graph TB
    subgraph "Data Sources"
        A[Cloudflare Analytics<br/>API metrics]
        B[Cloudflare Web Analytics<br/>Page performance]
        C[Sentry (Recommended)<br/>Error tracking]
        D[TanStack Query DevTools<br/>Cache inspection]
    end

    subgraph "Metrics Collection"
        E[Request Count<br/>50-100 req/hour]
        F[Error Rate<br/>Target: < 1%]
        G[Response Time<br/>P95: < 500ms]
        H[Cache Hit Ratio<br/>Target: > 80%]
        I[Page Load Time<br/>P95: < 2s]
        J[Date Interaction Rate<br/>Target: > 15%]
    end

    subgraph "Alerting"
        K{Threshold Exceeded?}
        L[Slack Alert]
        M[Email Alert]
        N[SMS Alert<br/>Critical only]
    end

    A --> E
    A --> F
    A --> G
    A --> H
    B --> I
    B --> J
    C --> F

    E --> K
    F --> K
    G --> K
    H --> K
    I --> K

    K -->|Warning| L
    K -->|Critical| M
    K -->|Emergency| N

    style K fill:#ff9,stroke:#333,stroke-width:2px
    style N fill:#f99,stroke:#333,stroke-width:2px
```

---

## Rollback Strategy

```mermaid
flowchart TD
    A[Issue Detected] --> B{Severity?}

    B -->|Minor| C[Monitor & Fix in Next Release]
    B -->|Major| D[Execute Rollback]
    B -->|Critical| E[Immediate Rollback + Disable Feature]

    D --> F{Component?}
    E --> F

    F -->|Frontend| G[Cloudflare Pages Rollback<br/>wrangler pages deployment rollback]
    F -->|API| H[Cloudflare Workers Rollback<br/>wrangler rollback]
    F -->|Database| I[Revert Function<br/>DROP + Recreate]

    G --> J[Verify Rollback]
    H --> J
    I --> J

    J --> K{Working?}
    K -->|Yes| L[Monitor 24h]
    K -->|No| M[Escalate to Team]

    L --> N[Post-Mortem<br/>Document lessons learned]
    M --> N

    style E fill:#f99,stroke:#333,stroke-width:3px
    style J fill:#ff9,stroke:#333,stroke-width:2px
    style N fill:#9f9,stroke:#333,stroke-width:2px
```

---

## Future Enhancements Roadmap

```mermaid
gantt
    title Public Availability Calendar - Enhancement Roadmap
    dateFormat YYYY-MM-DD
    section Phase 1: MVP
    Backend (DB + API)           :done, p1a, 2025-01-10, 2d
    Frontend (Calendar UI)       :done, p1b, 2025-01-12, 4d
    Testing & Deployment        :done, p1c, 2025-01-16, 2d
    Launch & Monitoring         :done, p1d, 2025-01-18, 1d

    section Phase 2: Enhancements
    Peak Season Indicators      :p2a, 2025-02-01, 3d
    Analytics Dashboard         :p2b, 2025-02-04, 2d
    Date Interaction Heatmap   :p2c, 2025-02-06, 3d
    Mobile PWA Features        :p2d, 2025-02-09, 4d

    section Phase 3: Advanced
    Unit-Type Filtering        :p3a, 2025-03-01, 4d
    Multi-Language Support     :p3b, 2025-03-05, 5d
    iCal Feed                  :p3c, 2025-03-10, 3d
    Realtime Availability      :p3d, 2025-03-13, 5d
```

---

## Diagram Legend

### Colors

- **Pink (#f9f)**: CDN/Caching layer
- **Light Blue (#bbf)**: Database/Backend
- **Light Green (#bfb)**: Frontend/UI
- **Yellow (#ff9)**: Decision points
- **Red (#f99)**: Errors/Critical paths
- **Light Red (#fbb)**: Security boundaries
- **Cyan (#9ff)**: Cache layers

### Symbols

- **Rectangle**: Process/Component
- **Diamond**: Decision point
- **Cylinder**: Database
- **Circle**: Start/End point
- **Dotted Arrow**: Async/Background operation
- **Solid Arrow**: Synchronous flow

---

## Additional Resources

- [Master Plan](./00-master-plan.md) - Complete strategy
- [Phase 1: Backend](./01-phase-1-backend.md) - Database and API
- [Phase 2: Frontend](./02-phase-2-frontend.md) - React components
- [Phase 3: Deployment](./03-phase-3-deployment.md) - Testing and launch

---

**Document Version**: 1.0
**Last Updated**: 2025-01-10
**Maintained By**: Engineering Team
