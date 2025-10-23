# Chunk Implementation Prompt Template

## Purpose

Use this prompt template to generate implementation chunks for the multi-unit guest booking system. This prompt instructs Claude Code to create the 4 files (README, instructions, checkpoint, troubleshooting) following the household-hub pattern.

---

## 📋 Prompt Template

Copy and customize this template when you're ready to create a specific chunk:

```
I need you to create implementation chunk [NUMBER]-[NAME] for the multi-unit guest booking system.

**Reference Documentation:**
- MUST READ: docs/implementation/guest-booking-multi-unit/CHUNKING-STRATEGY.md
- Source docs: docs/implementation/guest-booking-multi-unit/[relevant-files].md
- Codebase patterns: CLAUDE.md

**Chunk Specification:**
- **Number**: [e.g., 001]
- **Name**: [e.g., database-schema-setup]
- **Phase**: [e.g., Phase 1: Database & Backend Core]
- **Estimated Time**: [e.g., 90 minutes]
- **Source Documentation**: [e.g., 01-database-schema.md lines 1-300]
- **Dependencies**: [e.g., None (first chunk) OR 001, 002]

**Current Context:**
- Completed chunks: [list completed chunk numbers or "None"]
- System state: [brief description, e.g., "Clean okaeri-resort-system with existing single-unit booking"]
- Prerequisites verified: [Yes/No with details]

**Requirements:**

1. **Create 4 files** in `docs/implementation/guest-booking-multi-unit/chunks/[NUMBER]-[NAME]/`:
   - `README.md` - Overview following household-hub pattern
   - `instructions.md` - Step-by-step implementation guide
   - `checkpoint.md` - Verification procedures
   - `troubleshooting.md` - Common issues and solutions

2. **README.md must include:**
   - "At a Glance" section (time, milestone, prerequisites, can skip?)
   - "What You're Building" section (clear scope)
   - "Why This Matters" section (business/technical value)
   - "Before You Start" section (prerequisites checklist)
   - "What Happens Next" section (outcomes after completion)
   - "Key Files Created/Modified" section (file tree)
   - "Related Documentation" section (links to source docs)

3. **instructions.md must include:**
   - Numbered steps with time estimates
   - Copy-pasteable commands with explanations
   - Code examples with inline comments
   - Verification steps after major actions
   - "Done!" section with next steps

4. **checkpoint.md must include:**
   - "Automated Checks" section (commands to run)
   - "Manual Checks" section (visual/behavioral verification)
   - "Success Criteria" checklist
   - "If Any Check Fails" troubleshooting guide
   - "When All Checks Pass" next steps (commit message, next chunk)
   - Status tracking fields (Pass/Fail/In Progress, Time Taken, Issues, Notes)

5. **troubleshooting.md must include:**
   - Common issues specific to this chunk
   - Symptom → Solution format
   - Code examples for fixes
   - Debugging commands
   - "Still Stuck?" section with escalation path

6. **Follow architectural principles from CHUNKING-STRATEGY.md:**
   - Array-based model (NO quantity column)
   - Server-side pricing authority (PostgreSQL function only)
   - All-or-nothing unit assignment
   - Security-first (Turnstile, DOMPurify, RLS, JWT)
   - Centralized config (pricing_config table)

7. **Cross-reference source documentation:**
   - Include specific line numbers from source docs
   - Quote key decisions from 09-implementation-decisions.md
   - Reference architectural patterns from CLAUDE.md

8. **Make it actionable:**
   - Commands must be copy-pasteable
   - File paths must be absolute where appropriate
   - Code examples must be complete (not truncated)
   - Verification steps must be specific (not vague)

**Output Structure:**

Create the chunk directory and all 4 files. Show me the complete content of each file, properly formatted in markdown.

After creating the files, provide a brief summary of:
- What this chunk accomplishes
- Key architectural decisions made
- Dependencies for next chunk
- Estimated time to complete
```

---

## 🎯 Quick Start Examples

### Example 1: First Chunk (Database Schema)

```
I need you to create implementation chunk 001-database-schema-setup for the multi-unit guest booking system.

**Reference Documentation:**
- MUST READ: docs/implementation/guest-booking-multi-unit/CHUNKING-STRATEGY.md
- Source docs: docs/implementation/guest-booking-multi-unit/01-database-schema.md (lines 1-300)
- Codebase patterns: CLAUDE.md

**Chunk Specification:**
- **Number**: 001
- **Name**: database-schema-setup
- **Phase**: Phase 1: Database & Backend Core
- **Estimated Time**: 90 minutes
- **Source Documentation**: 01-database-schema.md lines 1-300
- **Dependencies**: None (first chunk)

**Current Context:**
- Completed chunks: None (first chunk)
- System state: Clean okaeri-resort-system with existing single-unit booking functionality. Database has bookings, units, guests, payments tables.
- Prerequisites verified: Yes - Supabase configured, VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, database accessible

[Include full requirements section from template above]
```

---

### Example 2: Mid-Phase Chunk (Payment Summary)

```
I need you to create implementation chunk 007-payment-summary-preview for the multi-unit guest booking system.

**Reference Documentation:**
- MUST READ: docs/implementation/guest-booking-multi-unit/CHUNKING-STRATEGY.md
- Source docs: docs/implementation/guest-booking-multi-unit/03-frontend-components.md (lines 201-350)
- Codebase patterns: CLAUDE.md

**Chunk Specification:**
- **Number**: 007
- **Name**: payment-summary-preview
- **Phase**: Phase 2: Guest Booking Flow
- **Estimated Time**: 75 minutes
- **Source Documentation**: 03-frontend-components.md lines 201-350
- **Dependencies**: 004 (core API endpoints), 006 (date and unit selection UI)

**Current Context:**
- Completed chunks: 001, 002, 003, 004, 005, 006
- System state: Database schema complete, pricing function working, API endpoints live, guest booking form has date picker and unit selection cards
- Prerequisites verified: Yes - POST /api/guest-booking/preview-pricing endpoint tested and working, unit selection form captures unit_requests array

[Include full requirements section from template above]
```

---

### Example 3: Admin Chunk (Queue Interface)

```
I need you to create implementation chunk 011-admin-queue-urgency for the multi-unit guest booking system.

**Reference Documentation:**
- MUST READ: docs/implementation/guest-booking-multi-unit/CHUNKING-STRATEGY.md
- Source docs: docs/implementation/guest-booking-multi-unit/04-admin-interface.md (lines 1-200)
- Codebase patterns: CLAUDE.md

**Chunk Specification:**
- **Number**: 011
- **Name**: admin-queue-urgency
- **Phase**: Phase 3: Admin Interface
- **Estimated Time**: 90 minutes
- **Source Documentation**: 04-admin-interface.md lines 1-200
- **Dependencies**: 001-010 (all guest flow chunks)

**Current Context:**
- Completed chunks: 001-010 (all database, API, and guest booking flow chunks)
- System state: Guest booking flow complete and tested. Multi-unit bookings being created successfully. Need admin interface to manage pending bookings.
- Prerequisites verified: Yes - Have test multi-unit bookings in database with unit_assignment_status='pending', existing admin routes at /admin/*

[Include full requirements section from template above]
```

---

## 🔄 Workflow Integration

### Step 1: Determine Next Chunk

Review `CHUNKING-STRATEGY.md` and identify the next chunk to implement based on completed chunks and dependencies.

### Step 2: Gather Context

- List completed chunks
- Verify prerequisites (run checkpoints if needed)
- Note current system state
- Identify relevant source documentation

### Step 3: Customize Prompt

- Copy the template above
- Fill in all bracketed `[placeholders]`
- Include specific context about your system state
- Reference completed chunks

### Step 4: Submit to Claude Code

- Paste the customized prompt
- Review the generated 4 files
- Ask for clarifications if needed
- Save files to the chunk directory

### Step 5: Implement

- Follow the generated `instructions.md` step-by-step
- Test at each verification point
- Use `troubleshooting.md` if issues arise

### Step 6: Verify

- Run all checks in `checkpoint.md`
- Complete manual verification
- Confirm all success criteria met

### Step 7: Commit and Progress

- Commit: `feat: complete chunk [NUMBER]-[NAME]`
- Update progress tracker
- Move to next chunk

---

## 📊 Chunk Selection Reference

### Phase 1 Chunks (Backend Foundation)

- **001**: database-schema-setup - Tables, indexes, default data
- **002**: postgresql-pricing-engine - Pricing function, discount logic
- **003**: security-rls-constraints - Constraints, RLS policies, concurrency
- **004**: core-api-endpoints - Guest booking API, rates, preview
- **005**: idempotency-rate-limiting - UUID keys, Turnstile, cron jobs

### Phase 2 Chunks (Guest Interface)

- **006**: date-unit-selection-ui - Date picker, unit cards, capacity validation
- **007**: payment-summary-preview - Real-time pricing display, discount UI
- **008**: payment-proof-upload - File upload, compression, signed URLs
- **009**: form-validation-submission - Multi-step form, Zod validation, DOMPurify
- **010**: booking-confirmation-flow - Confirmation page, booking reference display

### Phase 3 Chunks (Admin Tools)

- **011**: admin-queue-urgency - Pending bookings queue, urgency scoring
- **012**: payment-verification-ui - Payment proof viewer, verify/reject controls
- **013**: unit-assignment-system - Unit picker, all-or-nothing enforcement
- **014**: admin-endpoints - Admin API routes, JWT auth, role verification

### Phase 4 Chunks (Quality & Launch)

- **015**: unit-integration-tests - Test fixtures, unit tests, API tests
- **016**: e2e-performance-tests - Playwright E2E, concurrency tests, load tests
- **017**: deployment-monitoring - Deploy, monitoring setup, alerts, training

---

## ⚠️ Important Reminders

### Do NOT:

- ❌ Skip chunks or jump ahead (breaks dependencies)
- ❌ Modify the 4-file structure (README, instructions, checkpoint, troubleshooting)
- ❌ Create chunks without referencing CHUNKING-STRATEGY.md
- ❌ Implement without verifying prerequisites
- ❌ Commit without passing checkpoint verification

### Do:

- ✅ Reference CHUNKING-STRATEGY.md in every prompt
- ✅ Verify prerequisites before starting chunk
- ✅ Follow instructions.md step-by-step
- ✅ Run checkpoint.md verification before committing
- ✅ Use troubleshooting.md when stuck
- ✅ Commit with proper message: `feat: complete chunk [NUMBER]-[NAME]`

---

## 🎯 Success Criteria

A chunk is complete when:

1. **All 4 files created** (README, instructions, checkpoint, troubleshooting)
2. **Implementation finished** (followed instructions.md)
3. **All checkpoints pass** (automated and manual)
4. **Code committed** (with proper message)
5. **Documentation updated** (if applicable)
6. **Ready for next chunk** (dependencies satisfied)

---

## 📚 Additional Resources

- **Chunking Strategy**: `docs/implementation/guest-booking-multi-unit/CHUNKING-STRATEGY.md`
- **Source Documentation**: `docs/implementation/guest-booking-multi-unit/*.md`
- **Codebase Patterns**: `CLAUDE.md`
- **Household Hub Example**: `/Users/jasonacido/repos/personal/household-hub/docs/implementation/chunks/`
- **Architecture Decisions**: `docs/implementation/guest-booking-multi-unit/09-implementation-decisions.md`

---

## 💡 Tips for Effective Prompts

1. **Be specific about context**: Include completed chunks, current system state, verified prerequisites
2. **Reference line numbers**: Helps Claude Code find exact source information
3. **Mention dependencies**: Clarifies what should already be working
4. **Include system state**: Helps generate accurate verification steps
5. **Note any deviations**: If you've customized something, mention it
6. **Ask for clarifications**: If generated chunk seems off, ask before implementing

---

**Version**: 1.0
**Last Updated**: 2025-10-24
**Status**: Ready for Use

---

## Example Complete Prompt (Ready to Copy)

```
I need you to create implementation chunk 001-database-schema-setup for the multi-unit guest booking system.

**Reference Documentation:**
- MUST READ: docs/implementation/guest-booking-multi-unit/CHUNKING-STRATEGY.md
- Source docs: docs/implementation/guest-booking-multi-unit/01-database-schema.md (lines 1-300)
- Codebase patterns: CLAUDE.md

**Chunk Specification:**
- **Number**: 001
- **Name**: database-schema-setup
- **Phase**: Phase 1: Database & Backend Core
- **Estimated Time**: 90 minutes
- **Source Documentation**: 01-database-schema.md lines 1-300
- **Dependencies**: None (first chunk)

**Current Context:**
- Completed chunks: None (first chunk)
- System state: Clean okaeri-resort-system with existing single-unit booking functionality. Database has bookings, units, guests, payments tables. Running on Supabase PostgreSQL.
- Prerequisites verified: Yes - Supabase configured at supabase.com, VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, database accessible via src/lib/supabase.ts, can query existing tables

**Requirements:**

1. **Create 4 files** in `docs/implementation/guest-booking-multi-unit/chunks/001-database-schema-setup/`:
   - `README.md` - Overview following household-hub pattern
   - `instructions.md` - Step-by-step implementation guide
   - `checkpoint.md` - Verification procedures
   - `troubleshooting.md` - Common issues and solutions

2. **README.md must include:**
   - "At a Glance" section (time: 90 min, milestone: Phase 1 Database Foundation, prerequisites: Supabase access, can skip: No - required for all other chunks)
   - "What You're Building" section (pricing_config, guest_booking_unit_requests, discount_rules, idempotency_keys tables)
   - "Why This Matters" section (establishes array-based model, centralized pricing config, flexible discounts)
   - "Before You Start" section (Supabase dashboard access, database connection working, backup existing database)
   - "What Happens Next" section (ready to implement pricing function in chunk 002)
   - "Key Files Created/Modified" section (SQL migration files, verification queries)
   - "Related Documentation" section (links to 01-database-schema.md, 00-IMPORTANT-CLARIFICATION.md)

3. **instructions.md must include:**
   - Step 1: Backup existing database (with pg_dump command or Supabase dashboard steps)
   - Step 2: Create pricing_config table with singleton constraint
   - Step 3: Insert default pricing_config row
   - Step 4: Create guest_booking_unit_requests table (array-based, NO quantity column)
   - Step 5: Create discount_rules table with JSONB conditions
   - Step 6: Insert default discount rules (4 duration-based discounts)
   - Step 7: Create idempotency_keys table
   - Step 8: Extend bookings table with multi-unit columns
   - Step 9: Create indexes for performance
   - Step 10: Verify all tables created (with SELECT queries)
   - Each step with estimated time and verification command

4. **checkpoint.md must include:**
   - Automated Checks: SQL queries to verify tables exist, row counts, index existence
   - Manual Checks: Supabase dashboard verification, can query tables, default data present
   - Success Criteria: 4 new tables created, bookings table extended, 1 pricing_config row, 4 discount_rules rows, indexes created
   - If Any Check Fails: Rollback script, check Supabase logs, verify connection
   - When All Checks Pass: Commit message "feat: complete chunk 001-database-schema-setup", ready for chunk 002

5. **troubleshooting.md must include:**
   - Issue: "Table already exists" error → Solution: Drop table or use IF NOT EXISTS
   - Issue: "CHECK constraint violation" on pricing_config → Solution: Verify singleton pattern
   - Issue: "Foreign key constraint fails" → Solution: Check bookings table exists
   - Issue: "Cannot connect to database" → Solution: Verify .env.local, check Supabase status
   - Issue: "Migration fails midway" → Solution: Rollback script provided
   - "Still Stuck?" section with escalation to Supabase support

6. **Follow architectural principles:**
   - Array-based model: Each guest_booking_unit_requests row = 1 unit (NO quantity column)
   - Centralized config: pricing_config is singleton table (CHECK constraint id = 'default')
   - Flexible discounts: JSONB conditions support duration, date-range, advance-booking, unit-count
   - All-or-nothing: Prepare for constraint in chunk 003
   - Security: Prepare for RLS policies in chunk 003

7. **Cross-reference source documentation:**
   - 01-database-schema.md lines 1-100: pricing_config table definition
   - 01-database-schema.md lines 86-98: guest_booking_unit_requests table (array-based)
   - 01-database-schema.md lines 125-173: discount_rules with JSONB conditions
   - 01-database-schema.md lines 177-189: idempotency_keys table
   - 00-IMPORTANT-CLARIFICATION.md lines 55-73: Array-based model explanation

8. **Make it actionable:**
   - Provide complete SQL migration file (can copy-paste entire file)
   - Include verification queries after each major step
   - Show expected output for each query
   - Include rollback script in troubleshooting.md

**Output Structure:**

Create the chunk directory `docs/implementation/guest-booking-multi-unit/chunks/001-database-schema-setup/` and all 4 files. Show me the complete content of each file, properly formatted in markdown.

After creating the files, provide a brief summary of:
- What this chunk accomplishes (database foundation for multi-unit bookings)
- Key architectural decisions made (array-based model, centralized pricing config)
- Dependencies for next chunk (chunk 002 requires these tables to implement pricing function)
- Estimated time to complete (90 minutes including verification)
```

**This prompt is ready to use as-is for chunk 001. Customize it for other chunks by changing the number, name, phase, source docs, and context.**
