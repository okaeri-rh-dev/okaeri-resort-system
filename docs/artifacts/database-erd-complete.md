# Entity Relationship Diagram

## Okaeri Resort Booking System Database

## 1. High-Level Entity Relationship Diagram

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                        OKAERI RESORT BOOKING SYSTEM                           ║
║                          Entity Relationship Model                            ║
╚═══════════════════════════════════════════════════════════════════════════════╝

                             ┌─────────────────┐
                             │     UNITS       │
                             ├─────────────────┤
                             │ PK: unit_id     │
                             │ UK: unit_code   │
                             │ UK: unit_name   │
                             └────────┬────────┘
                                      │
                                      │ 1
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    │ ∞               │ ∞               │
           ┌────────▼────────┐ ┌─────▼──────┐ ┌────────────────┐
           │    BOOKINGS     │ │MAINTENANCE │ │   FINANCIAL    │
           ├─────────────────┤ ├────────────┤ │   ANALYTICS    │
           │ PK: booking_id  │ │PK: task_id │ ├────────────────┤
           │ FK: unit_id     │ │FK: unit_id │ │ PK: period_id  │
           │ FK: guest_id    │ └────────────┘ └────────────────┘
           └────────┬────────┘                         ▲
                    │                                   │
                    │ ∞                          (Aggregation)
                    │                                   │
                    │ 1                                 │
           ┌────────▼────────┐                         │
           │     GUESTS      │─────────────────────────┘
           ├─────────────────┤
           │ PK: guest_id    │
           │ UK: email       │
           └─────────────────┘

Legend:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PK = Primary Key
FK = Foreign Key
UK = Unique Key
1  = One (parent)
∞  = Many (children)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 2. Detailed Entity Specifications

### 2.1 UNITS Entity

```
┌───────────────────────────────────────────────┐
│                    UNITS                      │
├───────────────────────────────────────────────┤
│ PK  unit_id            : UUID                 │
│ UK  unit_code          : VARCHAR(10)          │
│ UK  unit_name          : VARCHAR(100)         │
│     unit_type          : ENUM                 │
│     max_occupancy      : INTEGER              │
│     floor_area_sqm     : DECIMAL(6,2)         │
│     base_rate          : DECIMAL(10,2)        │
│     weekend_rate       : DECIMAL(10,2)        │
│     peak_season_rate   : DECIMAL(10,2)        │
│     holiday_rate       : DECIMAL(10,2)        │
│     cleaning_fee       : DECIMAL(10,2)        │
│     description        : TEXT                 │
│     amenities          : JSON                 │
│     photos             : JSON                 │
│     unit_status        : ENUM                 │
│     created_at         : TIMESTAMP            │
│     updated_at         : TIMESTAMP            │
├───────────────────────────────────────────────┤
│ Relationships:                                │
│ → BOOKINGS (1:N) via unit_id                 │
│ → MAINTENANCE (1:N) via unit_id              │
└───────────────────────────────────────────────┘
```

### 2.2 BOOKINGS Entity

```
┌───────────────────────────────────────────────┐
│                   BOOKINGS                    │
├───────────────────────────────────────────────┤
│ PK  booking_id         : UUID                 │
│ UK  booking_reference  : VARCHAR(20)          │
│ FK  unit_id            : UUID → UNITS         │
│ FK  guest_id           : UUID → GUESTS        │
│     guest_name         : VARCHAR(100)         │
│     contact_number     : VARCHAR(20)          │
│     email              : VARCHAR(100)         │
│     num_guests         : INTEGER              │
│     check_in           : DATE                 │
│     check_out          : DATE                 │
│     booking_status     : ENUM                 │
│     total_amount       : DECIMAL(10,2)        │
│     payment_method     : ENUM                 │
│     payment_date       : DATE                 │
│     payment_proof      : JSON                 │
│     booking_source     : ENUM                 │
│     special_requests   : TEXT                 │
│     internal_notes     : TEXT                 │
│     price_override     : BOOLEAN              │
│     created_at         : TIMESTAMP            │
│     created_by         : VARCHAR(100)         │
│     updated_at         : TIMESTAMP            │
├───────────────────────────────────────────────┤
│ Relationships:                                │
│ ← UNITS (N:1) via unit_id                    │
│ ← GUESTS (N:1) via guest_id                  │
└───────────────────────────────────────────────┘
```

### 2.3 GUESTS Entity

```
┌───────────────────────────────────────────────┐
│                    GUESTS                     │
├───────────────────────────────────────────────┤
│ PK  guest_id           : UUID                 │
│ UK  email              : VARCHAR(100)         │
│     guest_name         : VARCHAR(100)         │
│     phone_number       : VARCHAR(20)          │
│     alternate_phone    : VARCHAR(20)          │
│     address            : TEXT                 │
│     birthday           : DATE                 │
│     id_type            : ENUM                 │
│     id_number          : VARCHAR(50)          │
│     nationality        : VARCHAR(50)          │
│     preferences        : JSON                 │
│     created_at         : TIMESTAMP            │
│     updated_at         : TIMESTAMP            │
├───────────────────────────────────────────────┤
│ Relationships:                                │
│ → BOOKINGS (1:N) via guest_id                │
└───────────────────────────────────────────────┘
```

### 2.4 MAINTENANCE Entity

```
┌───────────────────────────────────────────────┐
│                  MAINTENANCE                  │
├───────────────────────────────────────────────┤
│ PK  task_id            : UUID                 │
│ FK  unit_id            : UUID → UNITS         │
│     task_description   : VARCHAR(200)         │
│     task_type          : ENUM                 │
│     priority           : ENUM                 │
│     task_status        : ENUM                 │
│     scheduled_date     : DATETIME             │
│     completed_date     : DATETIME             │
│     duration_hours     : DECIMAL(5,2)         │
│     cost               : DECIMAL(10,2)        │
│     vendor_staff       : VARCHAR(100)         │
│     materials_used     : TEXT                 │
│     notes              : TEXT                 │
│     before_photos      : JSON                 │
│     after_photos       : JSON                 │
│     invoice_url        : VARCHAR(500)         │
│     created_at         : TIMESTAMP            │
│     created_by         : VARCHAR(100)         │
├───────────────────────────────────────────────┤
│ Relationships:                                │
│ ← UNITS (N:1) via unit_id                    │
└───────────────────────────────────────────────┘
```

### 2.5 FINANCIAL_ANALYTICS Entity

```
┌───────────────────────────────────────────────┐
│              FINANCIAL_ANALYTICS              │
├───────────────────────────────────────────────┤
│ PK  period_id          : UUID                 │
│ UK  period_month       : DATE                 │
│     period_year        : INTEGER              │
│     period_month_num   : INTEGER              │
│     total_bookings     : INTEGER              │
│     gross_revenue      : DECIMAL(12,2)        │
│     net_revenue        : DECIMAL(12,2)        │
│     total_nights_booked: INTEGER              │
│     commission_paid    : DECIMAL(10,2)        │
│     maintenance_cost   : DECIMAL(10,2)        │
│     gcash_revenue      : DECIMAL(10,2)        │
│     bank_transfer_revenue: DECIMAL(10,2)      │
│     cash_revenue       : DECIMAL(10,2)        │
│     cancellation_count : INTEGER              │
│     unit1_revenue      : DECIMAL(10,2)        │
│     unit2_revenue      : DECIMAL(10,2)        │
│     unit3_revenue      : DECIMAL(10,2)        │
│     unit1_nights       : INTEGER              │
│     unit2_nights       : INTEGER              │
│     unit3_nights       : INTEGER              │
│     created_at         : TIMESTAMP            │
│     updated_at         : TIMESTAMP            │
├───────────────────────────────────────────────┤
│ Relationships:                                │
│ ← Aggregates data from BOOKINGS              │
│ ← Aggregates data from MAINTENANCE           │
└───────────────────────────────────────────────┘
```

## 3. Relationship Cardinality Details

```
╔════════════════════════════════════════════════════════════════╗
║                    RELATIONSHIP MATRIX                         ║
╠═════════════════╦═══════════════╦════════════╦════════════════╣
║ Parent Entity   ║ Child Entity  ║ Cardinality║ Participation  ║
╠═════════════════╬═══════════════╬════════════╬════════════════╣
║ UNITS           ║ BOOKINGS      ║ 1:N        ║ Optional:Total ║
║ UNITS           ║ MAINTENANCE   ║ 1:N        ║ Optional:Total ║
║ GUESTS          ║ BOOKINGS      ║ 1:N        ║ Optional:Partial║
╚═════════════════╩═══════════════╩════════════╩════════════════╝

Notation:
• 1:N = One-to-Many relationship
• Optional = Parent can exist without children
• Total = Child must have parent
• Partial = Child may exist without parent (NULL allowed)
```

## 4. Chen Notation ERD

```
                    ┌─────────┐
                    │  UNITS  │
                    └────┬────┘
                         │
                    ◇────┴────◇
                    │ has many │
                    ◇────┬────◇
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    ┌─────────┐    ┌──────────┐    [Aggregated]
    │BOOKINGS │    │MAINTENANCE│    [Analytics ]
    └────┬────┘    └──────────┘
         │
    ◇────┴────◇
    │ made by │
    ◇────┬────◇
         │
         ▼
    ┌─────────┐
    │ GUESTS  │
    └─────────┘
```

## 5. Crow's Foot Notation ERD

```
    UNITS ||--o{ BOOKINGS : "has"
    UNITS ||--o{ MAINTENANCE : "requires"
    GUESTS ||--o{ BOOKINGS : "makes"

    Legend:
    ││ = One (mandatory)
    |o = One (optional)
    }{ = Many (mandatory)
    o{ = Many (optional)
```

## 6. Physical Data Flow

### 6.1 Booking Creation Flow

```
┌──────────────────────────────────────────────────┐
│           BOOKING CREATION DATA FLOW             │
└──────────────────────────────────────────────────┘

    [Input Data]
         │
         ▼
    ┌─────────┐     Check        ┌─────────┐
    │ Select  │─────capacity────▶│  UNITS  │
    │  Unit   │◀────rates────────│   Table │
    └─────────┘                  └─────────┘
         │
         ▼
    ┌─────────┐     Validate     ┌─────────┐
    │ Check   │─────overlap──────▶│BOOKINGS │
    │  Dates  │◀────available────│  Table  │
    └─────────┘                  └─────────┘
         │
         ▼
    ┌─────────┐     Match        ┌─────────┐
    │  Guest  │─────email────────▶│ GUESTS  │
    │  Info   │◀────existing─────│  Table  │
    └─────────┘                  └─────────┘
         │
         ▼
    [Create Booking Record]
         │
         ▼
    [Update Aggregates]
```

### 6.2 Availability Check Query Path

```
┌──────────────────────────────────────────────────┐
│          AVAILABILITY CHECK QUERY PATH           │
└──────────────────────────────────────────────────┘

    [Date Range Input]
           │
           ▼
    ┌──────────────┐
    │   BOOKINGS   │
    │              │
    │ WHERE:       │
    │ • unit_id =  │──────────┐
    │ • status !=  │          │
    │   'Cancelled'│          ▼
    │ • dates      │    ┌──────────┐
    │   overlap    │    │  UNITS   │
    └──────────────┘    │          │
           │            │ Filter:  │
           ▼            │ • Status │
    [Occupied Dates]    │ • Max    │
           │            │   Guests │
           ▼            └──────────┘
    [Available Units]         │
           │                  ▼
           └────────▶ [Final Result]
```

### 6.3 Revenue Calculation Path

```
┌──────────────────────────────────────────────────┐
│           REVENUE AGGREGATION PATH               │
└──────────────────────────────────────────────────┘

    ┌──────────┐
    │ BOOKINGS │
    └────┬─────┘
         │
         ▼
    GROUP BY:
    • unit_id
    • MONTH(check_in)
         │
         ▼
    AGGREGATE:
    • SUM(total_amount)
    • COUNT(booking_id)
    • SUM(num_nights)
         │
         ▼
    ┌───────────────────┐
    │FINANCIAL_ANALYTICS│
    └───────────────────┘
```

## 7. Referential Integrity Rules

```
┌────────────────────────────────────────────────────────┐
│              FOREIGN KEY CONSTRAINTS                   │
├────────────────────────────────────────────────────────┤
│                                                        │
│ BOOKINGS.unit_id → UNITS.unit_id                      │
│   • ON DELETE: RESTRICT                               │
│   • ON UPDATE: CASCADE                                │
│   • NULL: NOT ALLOWED                                 │
│                                                        │
│ BOOKINGS.guest_id → GUESTS.guest_id                   │
│   • ON DELETE: SET NULL                               │
│   • ON UPDATE: CASCADE                                │
│   • NULL: ALLOWED                                     │
│                                                        │
│ MAINTENANCE.unit_id → UNITS.unit_id                   │
│   • ON DELETE: RESTRICT                               │
│   • ON UPDATE: CASCADE                                │
│   • NULL: NOT ALLOWED                                 │
│                                                        │
└────────────────────────────────────────────────────────┘
```

## 8. Database Views (Virtual Tables)

### 8.1 Current Occupancy View

```sql
CREATE VIEW v_current_occupancy AS
SELECT
    u.unit_id,
    u.unit_name,
    u.unit_status,
    b.guest_name AS current_guest,
    b.check_out AS departure_date
FROM UNITS u
LEFT JOIN BOOKINGS b ON u.unit_id = b.unit_id
    AND b.booking_status = 'In Progress'
    AND CURRENT_DATE BETWEEN b.check_in AND b.check_out;
```

### 8.2 Unit Performance View

```sql
CREATE VIEW v_unit_performance AS
SELECT
    u.unit_id,
    u.unit_name,
    COUNT(b.booking_id) AS total_bookings,
    SUM(b.total_amount) AS total_revenue,
    AVG(b.total_amount) AS avg_booking_value,
    SUM(b.num_nights) AS total_nights,
    (SUM(b.num_nights) / (DATEDIFF(MAX(b.check_out), MIN(b.check_in)) + 1)) * 100 AS occupancy_rate
FROM UNITS u
LEFT JOIN BOOKINGS b ON u.unit_id = b.unit_id
WHERE b.booking_status IN ('Confirmed', 'Completed')
GROUP BY u.unit_id, u.unit_name;
```

### 8.3 Guest Summary View

```sql
CREATE VIEW v_guest_summary AS
SELECT
    g.guest_id,
    g.guest_name,
    g.email,
    COUNT(b.booking_id) AS booking_count,
    SUM(b.total_amount) AS lifetime_value,
    MAX(b.check_in) AS last_visit,
    CASE
        WHEN COUNT(b.booking_id) >= 5 THEN 'VIP'
        WHEN COUNT(b.booking_id) >= 3 THEN 'Regular'
        WHEN COUNT(b.booking_id) >= 2 THEN 'Returning'
        ELSE 'New'
    END AS guest_category
FROM GUESTS g
LEFT JOIN BOOKINGS b ON g.guest_id = b.guest_id
GROUP BY g.guest_id, g.guest_name, g.email;
```

## 9. Transaction Boundaries

```
┌────────────────────────────────────────────────┐
│           TRANSACTION BOUNDARIES               │
├────────────────────────────────────────────────┤
│                                                │
│ Transaction 1: Create Booking                 │
│   BEGIN TRANSACTION;                          │
│     1. Validate unit availability             │
│     2. Insert BOOKINGS record                 │
│     3. Update/Insert GUESTS record            │
│     4. Update unit aggregates                 │
│   COMMIT;                                     │
│                                                │
│ Transaction 2: Process Payment                │
│   BEGIN TRANSACTION;                          │
│     1. Update booking status                  │
│     2. Set payment fields                     │
│     3. Update financial aggregates            │
│   COMMIT;                                     │
│                                                │
│ Transaction 3: Schedule Maintenance           │
│   BEGIN TRANSACTION;                          │
│     1. Insert MAINTENANCE record              │
│     2. Update unit status                     │
│     3. Check for booking conflicts            │
│   COMMIT;                                     │
│                                                │
└────────────────────────────────────────────────┘
```

## 10. System Context Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM CONTEXT                           │
└─────────────────────────────────────────────────────────────┘

                    External Interfaces
                           │
    ┌──────────┬───────────┼───────────┬──────────┐
    │          │           │           │          │
    ▼          ▼           ▼           ▼          ▼
[Web App] [Mobile] [Booking Forms] [Reports] [Analytics]
    │          │           │           │          │
    └──────────┴───────────┼───────────┴──────────┘
                           │
                    ┌──────▼──────┐
                    │   DATABASE  │
                    │    SYSTEM   │
                    ├─────────────┤
                    │ • UNITS     │
                    │ • BOOKINGS  │
                    │ • GUESTS    │
                    │ • MAINTENANCE│
                    │ • ANALYTICS │
                    └─────────────┘
                           │
                    ┌──────┴──────┐
                    │   Storage   │
                    │ • Files     │
                    │ • Backups   │
                    └─────────────┘
```

---

_Entity Relationship Diagram - Version 3.0_  
_Database Design Pattern: Star Schema with Central Units Entity_  
_Normalization Level: 3NF (Third Normal Form)_
