# Multi-Unit Guest Booking: Implementation Chunks

This directory contains 17 implementation chunks that break down the multi-unit guest booking system into manageable, verifiable units of work.

## 📚 Documentation Structure

```
docs/implementation/guest-booking-multi-unit/
├── CHUNKING-STRATEGY.md           # High-level chunking plan (READ THIS FIRST)
├── CHUNK-IMPLEMENTATION-PROMPT.md # Prompt template to generate chunks
└── chunks/
    ├── README.md                  # This file - overview and quick start
    ├── 001-database-schema-setup/
    │   ├── README.md
    │   ├── instructions.md
    │   ├── checkpoint.md
    │   └── troubleshooting.md
    ├── 002-postgresql-pricing-engine/
    ├── 003-security-rls-constraints/
    └── ... (17 total chunks)
```

## 🚀 Quick Start

### Step 1: Read the Strategy
```bash
# Open the chunking strategy document
open docs/implementation/guest-booking-multi-unit/CHUNKING-STRATEGY.md
```

This document contains:
- Complete chunk breakdown (all 17 chunks)
- Architectural principles
- Dependencies graph
- Time estimates
- Success criteria

### Step 2: Prepare Your Prompt
```bash
# Open the prompt template
open docs/implementation/guest-booking-multi-unit/CHUNK-IMPLEMENTATION-PROMPT.md
```

This document contains:
- Prompt template to generate chunks
- Examples for different phases
- Customization guide
- Best practices

### Step 3: Generate First Chunk
Copy the example prompt from `CHUNK-IMPLEMENTATION-PROMPT.md` (bottom of file) and submit to Claude Code. This will create:

```
chunks/001-database-schema-setup/
├── README.md           # Overview and context
├── instructions.md     # Step-by-step guide
├── checkpoint.md       # Verification steps
└── troubleshooting.md  # Common issues
```

### Step 4: Implement
Follow the generated `instructions.md` step-by-step.

### Step 5: Verify
Run all checks in `checkpoint.md` to ensure success.

### Step 6: Commit & Repeat
```bash
git add .
git commit -m "feat: complete chunk 001-database-schema-setup"
```

Then move to chunk 002.

---

## 📊 Chunk Overview

### Phase 1: Database & Backend Core (Week 1)

| Chunk | Name | Duration | Status |
|-------|------|----------|--------|
| 001 | database-schema-setup | 90 min | ⬜ Not started |
| 002 | postgresql-pricing-engine | 120 min | ⬜ Not started |
| 003 | security-rls-constraints | 90 min | ⬜ Not started |
| 004 | core-api-endpoints | 120 min | ⬜ Not started |
| 005 | idempotency-rate-limiting | 90 min | ⬜ Not started |

**Phase 1 Total**: ~8.5 hours

### Phase 2: Guest Booking Flow (Week 2)

| Chunk | Name | Duration | Status |
|-------|------|----------|--------|
| 006 | date-unit-selection-ui | 90 min | ⬜ Not started |
| 007 | payment-summary-preview | 75 min | ⬜ Not started |
| 008 | payment-proof-upload | 90 min | ⬜ Not started |
| 009 | form-validation-submission | 120 min | ⬜ Not started |
| 010 | booking-confirmation-flow | 60 min | ⬜ Not started |

**Phase 2 Total**: ~7.5 hours

### Phase 3: Admin Interface (Week 3)

| Chunk | Name | Duration | Status |
|-------|------|----------|--------|
| 011 | admin-queue-urgency | 90 min | ⬜ Not started |
| 012 | payment-verification-ui | 75 min | ⬜ Not started |
| 013 | unit-assignment-system | 120 min | ⬜ Not started |
| 014 | admin-endpoints | 90 min | ⬜ Not started |

**Phase 3 Total**: ~6.5 hours

### Phase 4: Testing & Launch (Week 4)

| Chunk | Name | Duration | Status |
|-------|------|----------|--------|
| 015 | unit-integration-tests | 120 min | ⬜ Not started |
| 016 | e2e-performance-tests | 120 min | ⬜ Not started |
| 017 | deployment-monitoring | 90 min | ⬜ Not started |

**Phase 4 Total**: ~5.5 hours

**Grand Total**: 17 chunks, ~28 hours

---

## 🎯 How to Use This System

### For Each Chunk:

1. **Generate** the chunk files using `CHUNK-IMPLEMENTATION-PROMPT.md`
2. **Read** the chunk's README.md to understand scope
3. **Follow** the chunk's instructions.md step-by-step
4. **Verify** using the chunk's checkpoint.md
5. **Troubleshoot** if needed using troubleshooting.md
6. **Commit** with message: `feat: complete chunk [NUMBER]-[NAME]`
7. **Update** the status table above

### Status Indicators:

- ⬜ Not started
- 🟡 In progress
- ✅ Completed
- ❌ Failed (needs retry)

---

## 🔗 Dependencies

Each chunk has clear dependencies. You **cannot skip chunks** without breaking the dependency chain.

```
Phase 1 Foundation:
001 → 002 → 003 → 004 → 005

Phase 2 builds on Phase 1:
001-005 → 006 → 007 → 008 → 009 → 010

Phase 3 builds on Phases 1-2:
001-010 → 011 → 012 → 013 → 014

Phase 4 requires everything:
001-014 → 015 → 016 → 017
```

---

## 📖 Key Documents Reference

| Document | Purpose | When to Read |
|----------|---------|--------------|
| `CHUNKING-STRATEGY.md` | Complete breakdown of all 17 chunks | Before starting |
| `CHUNK-IMPLEMENTATION-PROMPT.md` | Template to generate chunks | When creating each chunk |
| `chunks/[NUMBER]-[NAME]/README.md` | Chunk overview | Before implementing chunk |
| `chunks/[NUMBER]-[NAME]/instructions.md` | Implementation steps | During implementation |
| `chunks/[NUMBER]-[NAME]/checkpoint.md` | Verification | After implementation |
| `chunks/[NUMBER]-[NAME]/troubleshooting.md` | Common issues | When stuck |

---

## ⚡ Quick Commands

### Generate a Chunk
```bash
# Open prompt template and copy example
open docs/implementation/guest-booking-multi-unit/CHUNK-IMPLEMENTATION-PROMPT.md

# Customize the prompt with your chunk number and context
# Submit to Claude Code
```

### Implement a Chunk
```bash
# Navigate to chunk directory
cd docs/implementation/guest-booking-multi-unit/chunks/001-database-schema-setup

# Follow instructions.md
open instructions.md

# After implementation, verify
open checkpoint.md
```

### Update Status
Edit this README.md and change the status emoji for completed chunks:
- ⬜ → 🟡 (when starting)
- 🟡 → ✅ (when checkpoint passes)
- 🟡 → ❌ (if checkpoint fails - troubleshoot and retry)

---

## 🎓 Learning from Household Hub

This chunking system is modeled after the successful household-hub implementation. Key patterns adopted:

1. **4-file structure**: README, instructions, checkpoint, troubleshooting
2. **Time-boxed**: Each chunk 60-120 minutes
3. **Self-contained**: Complete logical unit
4. **Verifiable**: Clear success criteria
5. **Sequential**: Respect dependencies

**Reference Example**: `/Users/jasonacido/repos/personal/household-hub/docs/implementation/chunks/001-project-setup/`

---

## 🏗️ Architectural Principles

These principles are embedded in every chunk:

### 1. Array-Based Model
- Each `guest_booking_unit_requests` row = 1 unit
- NO `quantity` column
- Total units = COUNT(rows)

### 2. Server-Side Pricing Authority
- PostgreSQL `calculate_booking_pricing()` is SOLE calculator
- Client NEVER calculates pricing
- Preview endpoint for real-time display

### 3. All-or-Nothing Assignment
- Admin assigns ALL units or NONE
- Database CHECK constraint enforces
- UI blocks partial assignment

### 4. Security-First
- Turnstile CAPTCHA
- DOMPurify sanitization
- Row Level Security (RLS)
- JWT authentication
- Signed URLs

### 5. Manual Contact Workflow
- NO email automation initially
- Admin contacts via phone/SMS
- Email deferred to post-launch

---

## 📋 Progress Tracker

Update this section as you complete chunks:

### Week 1: Database & Backend
- [ ] Chunk 001: Database Schema Setup
- [ ] Chunk 002: PostgreSQL Pricing Engine
- [ ] Chunk 003: Security, RLS, and Constraints
- [ ] Chunk 004: Core API Endpoints
- [ ] Chunk 005: Idempotency and Rate Limiting

### Week 2: Guest Booking Flow
- [ ] Chunk 006: Date and Unit Selection UI
- [ ] Chunk 007: Payment Summary with Preview
- [ ] Chunk 008: Payment Proof Upload
- [ ] Chunk 009: Form Validation and Submission
- [ ] Chunk 010: Booking Confirmation Flow

### Week 3: Admin Interface
- [ ] Chunk 011: Admin Queue with Urgency Scoring
- [ ] Chunk 012: Payment Verification UI
- [ ] Chunk 013: Unit Assignment System
- [ ] Chunk 014: Admin API Endpoints

### Week 4: Testing & Launch
- [ ] Chunk 015: Unit and Integration Tests
- [ ] Chunk 016: E2E and Performance Tests
- [ ] Chunk 017: Deployment and Monitoring

**Current Chunk**: [Update this as you progress]
**Last Updated**: [Date]
**Total Time Invested**: [Track this]

---

## 🆘 Getting Help

### If you're stuck on a chunk:

1. **Check troubleshooting.md** in that chunk's directory
2. **Review CHUNKING-STRATEGY.md** for architectural context
3. **Verify prerequisites** were completed correctly
4. **Check checkpoint.md** from previous chunk
5. **Ask Claude Code** with specific error details

### Example help request:
```
I'm stuck on chunk [NUMBER]-[NAME] at step [X] in instructions.md.

Error message: [paste full error]
System state: [describe current state]
Completed steps: [list completed steps in this chunk]
Prerequisite chunks verified: [Yes/No]

Please help me troubleshoot this issue.
```

---

## 🎉 Success Criteria

You've successfully completed the multi-unit guest booking implementation when:

- ✅ All 17 chunks completed
- ✅ All checkpoints passing
- ✅ Tests passing (`npm run test:all`)
- ✅ Deployed to production
- ✅ Monitoring active
- ✅ Admin trained
- ✅ Rollback procedure verified

---

**Ready to begin?** Start with chunk 001! Open `CHUNK-IMPLEMENTATION-PROMPT.md` and use the ready-to-copy example at the bottom.

Good luck! 🚀
