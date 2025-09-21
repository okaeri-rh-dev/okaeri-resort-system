# Okaeri Resort Database Schema Documentation

## Version 3.0 - Complete Technical Specification

## 1. Database Overview

### System Architecture

- **Database Type**: Relational Database Management System (RDBMS)
- **Total Tables**: 5
- **Primary Entities**: Units, Bookings, Guests, Maintenance,
  Financial_Analytics
- **Total Fields**: ~150
- **Relationships**: 4 primary foreign key relationships

### Design Principles

- Units-centric architecture where property units are the core entity
- Normalized structure to prevent data redundancy
- Computed fields for real-time metrics
- Referential integrity enforced through foreign key constraints

---

## 2. Table Specifications

### 2.1 UNITS Table

**Purpose**: Central repository for all property unit information  
**Primary Key**: unit_id (UUID)  
**Record Count**: 3 (expandable)

| Field Name       | Data Type     | Constraints             | Description                                                           |
| ---------------- | ------------- | ----------------------- | --------------------------------------------------------------------- |
| unit_id          | UUID          | PRIMARY KEY, NOT NULL   | Unique identifier for each unit                                       |
| unit_name        | VARCHAR(100)  | NOT NULL, UNIQUE        | Display name (e.g., "Unit 1 - Ocean View")                            |
| unit_code        | VARCHAR(10)   | NOT NULL, UNIQUE        | Short code (U1, U2, U3)                                               |
| unit_type        | ENUM          | NOT NULL                | Values: 'Studio', 'One Bedroom', 'Two Bedroom', 'Villa'               |
| max_occupancy    | INTEGER       | NOT NULL, CHECK(>0)     | Maximum number of guests                                              |
| floor_area_sqm   | DECIMAL(6,2)  | NULL                    | Floor area in square meters                                           |
| base_rate        | DECIMAL(10,2) | NOT NULL, CHECK(>=0)    | Standard weekday rate                                                 |
| weekend_rate     | DECIMAL(10,2) | NOT NULL, CHECK(>=0)    | Friday-Sunday rate                                                    |
| peak_season_rate | DECIMAL(10,2) | NOT NULL, CHECK(>=0)    | High season rate                                                      |
| holiday_rate     | DECIMAL(10,2) | NOT NULL, CHECK(>=0)    | Special holiday rate                                                  |
| cleaning_fee     | DECIMAL(10,2) | DEFAULT 500             | Standard cleaning fee                                                 |
| description      | TEXT          | NULL                    | Marketing description                                                 |
| amenities        | JSON          | NULL                    | Array of amenity features                                             |
| photos           | JSON          | NULL                    | Array of photo URLs                                                   |
| unit_status      | ENUM          | NOT NULL                | Values: 'Available', 'Occupied', 'Maintenance', 'Offline', 'Reserved' |
| created_at       | TIMESTAMP     | NOT NULL, DEFAULT NOW() | Record creation timestamp                                             |
| updated_at       | TIMESTAMP     | NOT NULL, DEFAULT NOW() | Last update timestamp                                                 |

**Computed Fields** (Virtual/Generated Columns): | Field Name | Formula | Return
Type | Description | |------------|---------|-------------|-------------| |
total_revenue | SUM(bookings.total_amount) WHERE status='Confirmed' | DECIMAL |
Total revenue from all bookings | | current_month_revenue |
SUM(bookings.total_amount) WHERE MONTH(check_in)=CURRENT_MONTH | DECIMAL |
Revenue for current month | | total_bookings | COUNT(bookings.booking_id) |
INTEGER | Total number of bookings | | avg_booking_value |
AVG(bookings.total_amount) | DECIMAL | Average booking amount | | occupancy_rate
| (nights_booked / days_in_month) \* 100 | DECIMAL | Current month occupancy
percentage | | next_checkin | MIN(bookings.check_in) WHERE check_in > NOW() |
DATE | Next scheduled check-in | | current_guest | bookings.guest_name WHERE
NOW() BETWEEN check_in AND check_out | VARCHAR | Currently occupying guest | |
days_since_maintenance | DATEDIFF(NOW(), last_maintenance_date) | INTEGER | Days
since last maintenance | | performance_score | Weighted calculation of multiple
metrics | DECIMAL | 0-100 performance rating |

**Indexes**:

- PRIMARY KEY (unit_id)
- UNIQUE INDEX (unit_name)
- UNIQUE INDEX (unit_code)
- INDEX (unit_status)

---

### 2.2 BOOKINGS Table

**Purpose**: Records all reservation transactions  
**Primary Key**: booking_id (UUID)  
**Foreign Keys**: unit_id (UNITS), guest_id (GUESTS)

| Field Name        | Data Type     | Constraints                | Description                                                                                |
| ----------------- | ------------- | -------------------------- | ------------------------------------------------------------------------------------------ |
| booking_id        | UUID          | PRIMARY KEY, NOT NULL      | Unique booking identifier                                                                  |
| booking_reference | VARCHAR(20)   | UNIQUE, NOT NULL           | Human-readable booking code (BK-YYYYMMDD-XXXX)                                             |
| guest_name        | VARCHAR(100)  | NOT NULL                   | Primary guest full name                                                                    |
| contact_number    | VARCHAR(20)   | NOT NULL                   | Primary contact phone                                                                      |
| email             | VARCHAR(100)  | NOT NULL                   | Guest email address                                                                        |
| num_guests        | INTEGER       | NOT NULL, CHECK(>0)        | Number of guests in party                                                                  |
| unit_id           | UUID          | FOREIGN KEY, NOT NULL      | Reference to UNITS table                                                                   |
| check_in          | DATE          | NOT NULL                   | Check-in date                                                                              |
| check_out         | DATE          | NOT NULL, CHECK(>check_in) | Check-out date                                                                             |
| booking_status    | ENUM          | NOT NULL                   | Values: 'Inquiry', 'Pending Payment', 'Confirmed', 'In Progress', 'Completed', 'Cancelled' |
| total_amount      | DECIMAL(10,2) | NOT NULL, CHECK(>=0)       | Total booking amount                                                                       |
| payment_method    | ENUM          | NULL                       | Values: 'GCash', 'Bank Transfer', 'Cash'                                                   |
| payment_date      | DATE          | NULL                       | Date payment received                                                                      |
| payment_proof     | JSON          | NULL                       | Array of payment screenshot URLs                                                           |
| booking_source    | ENUM          | NOT NULL                   | Values: 'Facebook', 'Airbnb', 'Direct', 'Phone'                                            |
| special_requests  | TEXT          | NULL                       | Guest special requests                                                                     |
| internal_notes    | TEXT          | NULL                       | Staff notes (not visible to guest)                                                         |
| guest_id          | UUID          | FOREIGN KEY, NULL          | Reference to GUESTS table                                                                  |
| price_override    | BOOLEAN       | DEFAULT FALSE              | Manual price override flag                                                                 |
| created_at        | TIMESTAMP     | NOT NULL, DEFAULT NOW()    | Booking creation timestamp                                                                 |
| created_by        | VARCHAR(100)  | NULL                       | User who created booking                                                                   |
| updated_at        | TIMESTAMP     | NOT NULL, DEFAULT NOW()    | Last update timestamp                                                                      |

**Computed Fields**: | Field Name | Formula | Return Type | Description |
|------------|---------|-------------|-------------| | num_nights |
DATEDIFF(check_out, check_in) | INTEGER | Number of nights | | revenue_per_night
| total_amount / num_nights | DECIMAL | Average nightly rate | |
occupancy_validation | IF(num_guests > unit.max_occupancy, 'Invalid', 'Valid') |
VARCHAR | Occupancy check | | applicable_rate_type | Date-based rate
determination | VARCHAR | 'Regular', 'Weekend', 'Peak', 'Holiday' | |
calculated_daily_rate | Rate based on date and unit | DECIMAL | Applicable daily
rate | | suggested_total | calculated_daily_rate \* num_nights | DECIMAL |
System-calculated total | | price_variance | total_amount - suggested_total |
DECIMAL | Difference from standard pricing | | days_until_checkin |
DATEDIFF(check_in, NOW()) | INTEGER | Days until arrival | | urgency_flag |
Conditional urgency indicator | VARCHAR | Payment/follow-up urgency |

**Indexes**:

- PRIMARY KEY (booking_id)
- UNIQUE INDEX (booking_reference)
- FOREIGN KEY INDEX (unit_id)
- FOREIGN KEY INDEX (guest_id)
- INDEX (check_in)
- INDEX (check_out)
- INDEX (booking_status)
- COMPOSITE INDEX (unit_id, check_in, check_out)

---

### 2.3 GUESTS Table

**Purpose**: Customer relationship management (CRM) database  
**Primary Key**: guest_id (UUID)  
**Unique Constraint**: email

| Field Name      | Data Type    | Constraints             | Description                                         |
| --------------- | ------------ | ----------------------- | --------------------------------------------------- |
| guest_id        | UUID         | PRIMARY KEY, NOT NULL   | Unique guest identifier                             |
| guest_name      | VARCHAR(100) | NOT NULL                | Guest full name                                     |
| email           | VARCHAR(100) | UNIQUE, NOT NULL        | Guest email (primary key for matching)              |
| phone_number    | VARCHAR(20)  | NOT NULL                | Primary phone number                                |
| alternate_phone | VARCHAR(20)  | NULL                    | Secondary contact number                            |
| address         | TEXT         | NULL                    | Mailing address                                     |
| birthday        | DATE         | NULL                    | Guest birthday for special occasions                |
| id_type         | ENUM         | NULL                    | Values: 'Passport', 'Driver License', 'National ID' |
| id_number       | VARCHAR(50)  | NULL                    | Identification number                               |
| nationality     | VARCHAR(50)  | NULL                    | Guest nationality                                   |
| preferences     | JSON         | NULL                    | Guest preferences and notes                         |
| created_at      | TIMESTAMP    | NOT NULL, DEFAULT NOW() | First booking date                                  |
| updated_at      | TIMESTAMP    | NOT NULL, DEFAULT NOW() | Last update timestamp                               |

**Computed Fields**: | Field Name | Formula | Return Type | Description |
|------------|---------|-------------|-------------| | total_bookings |
COUNT(bookings) | INTEGER | Number of bookings | | total_revenue |
SUM(bookings.total_amount) | DECIMAL | Lifetime revenue | | avg_booking_value |
AVG(bookings.total_amount) | DECIMAL | Average spend per booking | |
last_checkin | MAX(bookings.check_in) | DATE | Most recent visit | |
days_since_visit | DATEDIFF(NOW(), last_checkin) | INTEGER | Days since last
stay | | guest_category | Classification based on bookings | VARCHAR | 'VIP',
'Regular', 'Returning', 'New' | | preferred_unit | MODE(bookings.unit_id) |
VARCHAR | Most frequently booked unit | | lifetime_nights |
SUM(bookings.num_nights) | INTEGER | Total nights stayed |

**Indexes**:

- PRIMARY KEY (guest_id)
- UNIQUE INDEX (email)
- INDEX (phone_number)
- INDEX (guest_name)

---

### 2.4 MAINTENANCE Table

**Purpose**: Maintenance and task tracking for units  
**Primary Key**: task_id (UUID)  
**Foreign Key**: unit_id (UNITS)

| Field Name       | Data Type     | Constraints             | Description                                                                                                  |
| ---------------- | ------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| task_id          | UUID          | PRIMARY KEY, NOT NULL   | Unique task identifier                                                                                       |
| task_description | VARCHAR(200)  | NOT NULL                | Task title/description                                                                                       |
| unit_id          | UUID          | FOREIGN KEY, NOT NULL   | Reference to UNITS table                                                                                     |
| task_type        | ENUM          | NOT NULL                | Values: 'Routine Cleaning', 'Deep Cleaning', 'Repair', 'Renovation', 'Inspection', 'Preventive', 'Emergency' |
| priority         | ENUM          | NOT NULL                | Values: 'Urgent', 'High', 'Normal', 'Low'                                                                    |
| task_status      | ENUM          | NOT NULL                | Values: 'Scheduled', 'In Progress', 'Completed', 'On Hold', 'Cancelled'                                      |
| scheduled_date   | DATETIME      | NOT NULL                | Scheduled task date/time                                                                                     |
| completed_date   | DATETIME      | NULL                    | Actual completion date/time                                                                                  |
| duration_hours   | DECIMAL(5,2)  | NULL                    | Task duration in hours                                                                                       |
| cost             | DECIMAL(10,2) | DEFAULT 0               | Task cost                                                                                                    |
| vendor_staff     | VARCHAR(100)  | NULL                    | Person/company performing task                                                                               |
| materials_used   | TEXT          | NULL                    | List of materials/supplies                                                                                   |
| notes            | TEXT          | NULL                    | Detailed notes                                                                                               |
| before_photos    | JSON          | NULL                    | Array of before photo URLs                                                                                   |
| after_photos     | JSON          | NULL                    | Array of after photo URLs                                                                                    |
| invoice_url      | VARCHAR(500)  | NULL                    | Invoice document URL                                                                                         |
| created_at       | TIMESTAMP     | NOT NULL, DEFAULT NOW() | Task creation timestamp                                                                                      |
| created_by       | VARCHAR(100)  | NULL                    | User who created task                                                                                        |

**Computed Fields**: | Field Name | Formula | Return Type | Description |
|------------|---------|-------------|-------------| | days_overdue | IF(status
!= 'Completed' AND scheduled_date < NOW(), DATEDIFF(NOW(), scheduled_date), 0) |
INTEGER | Days past scheduled date | | cost_per_hour | cost /
NULLIF(duration_hours, 0) | DECIMAL | Hourly cost rate | | next_due_date |
scheduled_date + interval based on task_type | DATE | Next recurring date |

**Indexes**:

- PRIMARY KEY (task_id)
- FOREIGN KEY INDEX (unit_id)
- INDEX (scheduled_date)
- INDEX (task_status)
- INDEX (priority)

---

### 2.5 FINANCIAL_ANALYTICS Table

**Purpose**: Monthly financial aggregation and reporting  
**Primary Key**: period_id (UUID)

| Field Name            | Data Type     | Constraints             | Description                     |
| --------------------- | ------------- | ----------------------- | ------------------------------- |
| period_id             | UUID          | PRIMARY KEY, NOT NULL   | Unique period identifier        |
| period_month          | DATE          | UNIQUE, NOT NULL        | First day of month (YYYY-MM-01) |
| period_year           | INTEGER       | NOT NULL                | Year (YYYY)                     |
| period_month_num      | INTEGER       | NOT NULL, CHECK(1-12)   | Month number                    |
| total_bookings        | INTEGER       | DEFAULT 0               | Count of bookings in period     |
| gross_revenue         | DECIMAL(12,2) | DEFAULT 0               | Total booking revenue           |
| net_revenue           | DECIMAL(12,2) | DEFAULT 0               | Revenue after commissions       |
| total_nights_booked   | INTEGER       | DEFAULT 0               | Sum of all nights booked        |
| commission_paid       | DECIMAL(10,2) | DEFAULT 0               | Platform commissions            |
| maintenance_cost      | DECIMAL(10,2) | DEFAULT 0               | Total maintenance expenses      |
| gcash_revenue         | DECIMAL(10,2) | DEFAULT 0               | Revenue via GCash               |
| bank_transfer_revenue | DECIMAL(10,2) | DEFAULT 0               | Revenue via bank transfer       |
| cash_revenue          | DECIMAL(10,2) | DEFAULT 0               | Revenue via cash                |
| cancellation_count    | INTEGER       | DEFAULT 0               | Number of cancellations         |
| unit1_revenue         | DECIMAL(10,2) | DEFAULT 0               | Unit 1 specific revenue         |
| unit2_revenue         | DECIMAL(10,2) | DEFAULT 0               | Unit 2 specific revenue         |
| unit3_revenue         | DECIMAL(10,2) | DEFAULT 0               | Unit 3 specific revenue         |
| unit1_nights          | INTEGER       | DEFAULT 0               | Unit 1 nights booked            |
| unit2_nights          | INTEGER       | DEFAULT 0               | Unit 2 nights booked            |
| unit3_nights          | INTEGER       | DEFAULT 0               | Unit 3 nights booked            |
| created_at            | TIMESTAMP     | NOT NULL, DEFAULT NOW() | Record creation timestamp       |
| updated_at            | TIMESTAMP     | NOT NULL, DEFAULT NOW() | Last calculation timestamp      |

**Computed Fields**: | Field Name | Formula | Return Type | Description |
|------------|---------|-------------|-------------| | occupancy_rate |
(total_nights_booked / (num_units _ days_in_month)) _ 100 | DECIMAL | Overall
occupancy percentage | | adr | gross_revenue / NULLIF(total_nights_booked, 0) |
DECIMAL | Average Daily Rate | | revpar | gross_revenue / (num_units \*
days_in_month) | DECIMAL | Revenue Per Available Room | | avg_booking_value |
gross_revenue / NULLIF(total_bookings, 0) | DECIMAL | Average booking amount | |
best_performing_unit | Unit with highest revenue | VARCHAR | Top revenue
generating unit |

**Indexes**:

- PRIMARY KEY (period_id)
- UNIQUE INDEX (period_month)
- INDEX (period_year, period_month_num)

---

## 3. Relationships

### 3.1 Primary Relationships

| Parent Table | Child Table | Relationship Type | Constraint         | Description                                      |
| ------------ | ----------- | ----------------- | ------------------ | ------------------------------------------------ |
| UNITS        | BOOKINGS    | One-to-Many       | ON DELETE RESTRICT | Each unit can have multiple bookings             |
| UNITS        | MAINTENANCE | One-to-Many       | ON DELETE RESTRICT | Each unit can have multiple maintenance tasks    |
| GUESTS       | BOOKINGS    | One-to-Many       | ON DELETE SET NULL | Each guest can have multiple bookings (optional) |

### 3.2 Relationship Rules

**UNITS → BOOKINGS**

- Cardinality: 1:N (One unit to many bookings)
- Participation: Unit is mandatory for booking
- Cascade: Restrict deletion of unit with bookings
- Inheritance: Bookings inherit unit capacity, rates, and amenities

**UNITS → MAINTENANCE**

- Cardinality: 1:N (One unit to many tasks)
- Participation: Unit is mandatory for maintenance task
- Cascade: Restrict deletion of unit with maintenance history
- Business Rule: Active maintenance sets unit status to 'Maintenance'

**GUESTS → BOOKINGS**

- Cardinality: 1:N (One guest to many bookings)
- Participation: Guest is optional for booking
- Cascade: Set null on guest deletion
- Business Rule: Email is unique identifier for guest matching

---

## 4. Constraints and Business Rules

### 4.1 Data Integrity Constraints

**Booking Constraints**:

- check_out must be after check_in
- num_guests cannot exceed unit.max_occupancy
- total_amount must be >= 0
- payment_date cannot be before booking creation date

**Unit Constraints**:

- All rate fields must be positive
- max_occupancy must be between 1 and 10
- unit_code must be unique across system

**Temporal Constraints**:

- No overlapping bookings for same unit (excluding cancelled)
- Maintenance tasks cannot overlap for same unit
- Check-in/out times: Check-in 14:00, Check-out 12:00

### 4.2 Business Logic Rules

**Pricing Logic**:

```
IF date is holiday (Dec 25, Jan 1, etc.) THEN holiday_rate
ELSE IF date in peak season (Mar-May, Dec) THEN peak_season_rate
ELSE IF day is Friday, Saturday, Sunday THEN weekend_rate
ELSE base_rate
```

**Status Transitions**:

```
Booking: Inquiry → Pending Payment → Confirmed → In Progress → Completed
                                   ↘ Cancelled (from any state)

Unit: Available ↔ Occupied
      Available ↔ Maintenance
      Available ↔ Reserved
      Any → Offline (manual override)
```

**Performance Scoring**:

```
Performance Score = (Occupancy Rate * 0.4) +
                   (Avg Booking Value Index * 0.3) +
                   (Booking Count Index * 0.3)
Where indices are normalized to 0-100 scale
```

---

## 5. Indexes and Performance

### 5.1 Primary Indexes

| Table       | Index Name     | Columns                      | Type      | Purpose                 |
| ----------- | -------------- | ---------------------------- | --------- | ----------------------- |
| UNITS       | PK_units       | unit_id                      | PRIMARY   | Primary key lookup      |
| UNITS       | UK_unit_name   | unit_name                    | UNIQUE    | Prevent duplicate names |
| UNITS       | UK_unit_code   | unit_code                    | UNIQUE    | Quick code lookup       |
| UNITS       | IX_unit_status | unit_status                  | BTREE     | Filter by availability  |
| BOOKINGS    | PK_bookings    | booking_id                   | PRIMARY   | Primary key lookup      |
| BOOKINGS    | UK_booking_ref | booking_reference            | UNIQUE    | Reference lookup        |
| BOOKINGS    | IX_unit_dates  | unit_id, check_in, check_out | COMPOSITE | Availability checking   |
| BOOKINGS    | IX_status      | booking_status               | BTREE     | Status filtering        |
| GUESTS      | PK_guests      | guest_id                     | PRIMARY   | Primary key lookup      |
| GUESTS      | UK_email       | email                        | UNIQUE    | Email lookup/matching   |
| MAINTENANCE | IX_unit_date   | unit_id, scheduled_date      | COMPOSITE | Unit schedule lookup    |

### 5.2 Query Optimization

**Most Common Queries**:

1. Check unit availability for date range - Uses IX_unit_dates
2. Get current unit status - Uses IX_unit_status
3. Calculate monthly revenue - Uses period_month index
4. Find guest by email - Uses UK_email
5. List today's check-ins/outs - Uses check_in/check_out indexes

---

## 6. Data Types Summary

| Type         | Storage   | Range/Format                    | Usage                    |
| ------------ | --------- | ------------------------------- | ------------------------ |
| UUID         | 16 bytes  | 128-bit unique identifier       | Primary keys             |
| VARCHAR(n)   | Variable  | Up to n characters              | Names, codes, text       |
| TEXT         | Variable  | Up to 65,535 characters         | Long descriptions        |
| INTEGER      | 4 bytes   | -2,147,483,648 to 2,147,483,647 | Counts, quantities       |
| DECIMAL(p,s) | Variable  | p digits, s after decimal       | Money, percentages       |
| DATE         | 3 bytes   | YYYY-MM-DD                      | Dates without time       |
| DATETIME     | 8 bytes   | YYYY-MM-DD HH:MM:SS             | Dates with time          |
| TIMESTAMP    | 4 bytes   | 1970-2038 UTC                   | System timestamps        |
| BOOLEAN      | 1 byte    | TRUE/FALSE                      | Flags                    |
| ENUM         | 1-2 bytes | Predefined list                 | Status fields            |
| JSON         | Variable  | JSON object/array               | Flexible structured data |

---

## 7. System Capabilities

### Current Capabilities

- Track 3 units (expandable to unlimited)
- Handle ~50 bookings per month (scalable to 1000+)
- Per-unit performance analytics
- Automatic pricing based on dates
- Occupancy validation
- Maintenance scheduling and tracking
- Guest CRM with history
- Financial reporting by period

### Scalability Considerations

- UUID primary keys prevent collision
- Indexed foreign keys for fast joins
- Computed fields can be materialized if needed
- Monthly aggregation reduces calculation load
- Archival strategy for bookings older than 2 years

---

## 8. Backup and Recovery

### Backup Strategy

- **Frequency**: Daily full backup, hourly incremental
- **Retention**: 90 days rolling, monthly archives for 7 years
- **Critical Tables**: BOOKINGS and GUESTS require point-in-time recovery
- **Test Restores**: Monthly restore testing to staging environment

### Audit Requirements

- All tables include created_at and updated_at timestamps
- Booking modifications logged with created_by field
- Payment records immutable after confirmation
- Soft deletes for cancelled bookings (maintain history)

---

_End of Schema Documentation - Version 3.0_
