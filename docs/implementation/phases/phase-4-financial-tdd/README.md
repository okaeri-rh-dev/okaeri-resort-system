# Phase 4: Financial Features TDD - Philippine Resort Financial Management System

> **📊 Status**: ⏳ Pending | **Tests**: 0/300 | **Coverage**: 0%  
> **📍 Source of Truth**: [Master Verification Index](../MASTER_VERIFICATION_INDEX.md#phase-4-financial-features)

## Overview

Phase 4 implements comprehensive financial features tailored for small to medium resort operations in the Philippines. This system handles expense tracking, income management, tax compliance, and financial reporting while adhering to Philippine regulatory requirements.

## Agent Responsibility

**Lead Agent**: Financial Systems Architect
- Primary responsibility for all financial features
- Ensures BIR compliance and tax accuracy
- Designs multi-currency support with PHP as primary
- Implements audit trails and security measures

## Pre-Implementation Setup

Before starting Phase 4 implementation, run the scaffold script to create the necessary directory structure:

> 📚 **See Also**: [Scaffold Scripts Reference](../../SCAFFOLD_SCRIPTS_REFERENCE.md) | [Composite Scripts Guide](../../COMPOSITE_SCRIPTS_GUIDE.md) | [Currency Type Standard](../../Currency_Type_Standard.md)

```bash
# Run the scaffold script for Phase 4
npm run scaffold:phase4

# This will:
# 1. Display the path to this documentation
# 2. Create all necessary directories:
#    - src/features/financial/components/
#    - src/features/financial/hooks/
#    - src/features/financial/stores/
#    - src/features/financial/types/
#    - src/features/financial/__tests__/
# 3. Add .gitkeep files to preserve empty directories
```

## NPM Scripts

### Phase 4 Specific Commands

```json
{
  "scripts": {
    // Scaffolding - Get financial system test specifications
    "scaffold:phase4": "echo 'Phase 4: Financial - See docs/implementation/phases/phase-4-financial-tdd/README.md' && npm run scaffold:phase4:dirs",
    "scaffold:phase4:dirs": "mkdir -p src/features/financial/{components,hooks,stores,types,__tests__} && touch src/features/financial/__tests__/.gitkeep",
    
    // Testing - Run Phase 4 financial tests
    "test:phase4": "vitest run src/features/financial/**/__tests__/*.test.{ts,tsx}",
    "test:phase4:coverage": "vitest run --coverage src/features/financial/**/__tests__/*.test.{ts,tsx}",
    "test:phase4:watch": "vitest watch src/features/financial/**/__tests__/*.test.{ts,tsx}"
  }
}
```

### TDD Workflow Commands

```bash
# RED Phase - Write failing tests
npm run scaffold:phase4           # Get financial test specifications
npm run test:phase4               # Run tests (should fail initially)

# GREEN Phase - Implement until tests pass
npm run test:phase4:watch         # Watch mode for rapid development
npm run test:phase4               # Verify all tests pass

# REFACTOR Phase - Optimize calculations
npm run test:phase4:coverage      # Check coverage meets 95% requirement

# Financial calculation testing
npm run test:tax:calculations     # Test VAT, withholding, discounts
npm run test:reporting:accuracy   # Test report generation accuracy

# Integration with booking system
npm run test:phase3 && npm run test:phase4  # Ensure booking data flows to financial
```

### Coverage Requirements

- **Minimum Coverage**: 95% (financial calculations are critical)
- **Tax Calculations**: 100% coverage required (regulatory compliance)
- **Expense Management**: 95% coverage required
- **Income Tracking**: 95% coverage required
- **Report Generation**: 90% coverage required
- **Receipt Processing**: 90% coverage required

### Common Phase 4 Testing Issues

| Issue | Solution |
|-------|---------|
| Tests not found | Ensure tests are in `src/features/financial/**/__tests__/` |
| Coverage below 95% | Add tests for all tax scenarios and edge cases |
| Calculation precision | Use decimal.js for financial calculations |
| VAT calculation errors | Test both VAT-inclusive and VAT-exclusive amounts |
| Senior discount failing | Test VAT exemption on discounted amounts |
| Report totals mismatch | Verify rounding at transaction level, not totals |
| Currency conversion | Mock exchange rates with fixed values |

### Financial Accuracy Testing

```bash
# Run precision tests for financial calculations
npm run test:financial:precision   # Test decimal precision
npm run test:tax:compliance       # Test BIR compliance rules
npm run test:discount:scenarios   # Test all discount combinations

# Expected precision requirements
# - Money values: 2 decimal places
# - Tax rates: 4 decimal places
# - Exchange rates: 6 decimal places
# - No floating point errors in calculations
```

## Core Financial Components

### 1. Expense Management
- **Expense Categories**: Utilities, Supplies, Maintenance, Marketing, Payroll, Equipment
- **Receipt Management**: Digital storage with OCR capability
- **Vendor Tracking**: Supplier database with payment history
- **Petty Cash Handling**: Daily reconciliation and float management

### 2. Income Tracking
- **Revenue Streams**:
  - Room bookings (Airbnb, direct, OTA)
  - F&B sales
  - Activity/tour packages
  - Equipment rentals
  - Service charges
- **Payment Methods**: Cash, Bank Transfer, GCash, PayMaya, Credit/Debit Cards
- **Deposit Handling**: Partial payments and balance tracking

### 3. Tax Compliance (Philippine BIR)
- **VAT Calculation**: 12% for VAT-registered businesses
- **Percentage Tax**: 3% for non-VAT businesses
- **Withholding Tax**: Expanded (EWT) and Final (FWT)
- **Senior/PWD Discounts**: 20% discount + VAT exemption
- **Documentary Requirements**: OR/SI generation with BIR-compliant format

### 4. Financial Reporting
- **Daily Reports**: Cash position, occupancy, revenue
- **Monthly Reports**: P&L, cash flow, variance analysis
- **Annual Reports**: Financial statements for ITR filing
- **Custom Reports**: Investor presentations, budget analysis

## Philippine Regulatory Requirements

### BIR Compliance
```
Required Information on Official Receipts (OR):
- Business name and TIN
- BIR Permit to Print number
- Sequential OR number
- Date of transaction
- Customer name (if applicable)
- Description of sale/service
- Amount (with VAT breakdown if applicable)
```

### Tax Computation Formulas

#### VAT Calculation
```
VATable Sales = Total Amount / 1.12
VAT Amount = VATable Sales × 0.12
Total Amount = VATable Sales + VAT Amount
```

#### Senior/PWD Discount
```
Regular Price = 1,000.00
Less: 20% Discount = 200.00
Discounted Price = 800.00
VAT Exempt (no VAT on discounted amount)
```

#### Withholding Tax (Professional Services)
```
Professional Fee = 10,000.00
EWT Rate = 10% (for individuals) or 15% (for non-individuals)
Withholding Tax = Professional Fee × EWT Rate
Net Payment = Professional Fee - Withholding Tax
```

## Financial KPIs for Resort Operations

### Occupancy Metrics
```
Occupancy Rate = (Occupied Rooms / Available Rooms) × 100
ADR (Average Daily Rate) = Total Room Revenue / Rooms Sold
RevPAR = ADR × Occupancy Rate
```

### Profitability Metrics
```
Gross Profit Margin = (Revenue - COGS) / Revenue × 100
Operating Profit Margin = Operating Income / Revenue × 100
Net Profit Margin = Net Income / Revenue × 100
```

### Cash Flow Metrics
```
Operating Cash Flow = Net Income + Depreciation - Working Capital Changes
Free Cash Flow = Operating Cash Flow - Capital Expenditures
Cash Conversion Cycle = DSO + DIO - DPO
```

## Implementation Phases

### Phase 4.1: Test Expense Tracking (RED)
- Design expense CRUD tests
- Receipt handling test scenarios
- Vendor management tests
- Petty cash reconciliation tests

### Phase 4.2: Test Income Management (RED)
- Income recording tests
- Payment processing tests
- Multi-currency conversion tests
- Deposit and balance tracking tests

### Phase 4.3: Implement Financial System (GREEN)
- Build expense tracking module
- Implement income management
- Create payment processing
- Develop basic reporting

### Phase 4.4: Reporting & Compliance (REFACTOR)
- Advanced report generation
- Tax compliance features
- Audit trail implementation
- Performance optimization

### Phase 4.5: Verification & Handoff
- System integration testing
- Compliance verification
- Documentation completion
- Production deployment

## Security Requirements

### Data Protection
- **Encryption**: AES-256 for financial data at rest
- **Access Control**: Role-based permissions (Owner, Manager, Accountant, Staff)
- **Audit Trail**: Complete transaction history with user tracking
- **Backup**: Daily automated backups with 30-day retention

### PCI Compliance (for card processing)
- No storage of card numbers
- Tokenization for recurring payments
- SSL/TLS for data transmission
- Regular security audits

## Integration Requirements

### External Systems
- **Payment Gateways**: PayMongo, DragonPay, GCash API
- **Accounting Software**: QuickBooks, SAP Business One export
- **Banking**: BPI, BDO API for transaction reconciliation
- **Government**: eFPS for tax filing, eBIRForms integration

### Data Export Formats
- **Excel**: Financial reports with formulas
- **PDF**: Official receipts and statements
- **CSV**: Transaction data for analysis
- **XML**: eBIRForms compatible format

## Development Standards

### Financial Calculation Standards

**IMPORTANT**: All financial calculations must follow the [Currency Type Standard](../../Currency_Type_Standard.md) for consistent money handling:
- Domain operations use numbers (via decimal.js for precision)
- Display operations use formatted strings
- VAT: 12%, Service Charge: 10%, Senior/PWD Discount: 20%
- See the standard document for complete implementation patterns

### Code Organization
```typescript
src/
├── features/
│   ├── expenses/
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── tests/
│   ├── income/
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── tests/
│   ├── reporting/
│   │   ├── templates/
│   │   ├── generators/
│   │   └── tests/
│   └── compliance/
│       ├── tax-calculator/
│       ├── validators/
│       └── tests/
```

### Testing Requirements
- **Unit Tests**: 90% coverage for financial calculations
- **Integration Tests**: Payment processing flows
- **E2E Tests**: Complete financial workflows
- **Compliance Tests**: Tax calculation accuracy

## Success Metrics

### Technical Metrics
- Zero financial calculation errors
- < 2s report generation time
- 99.9% uptime for payment processing
- 100% audit trail completeness

### Business Metrics
- 50% reduction in manual bookkeeping time
- 100% BIR compliance rate
- 30% improvement in cash flow visibility
- Real-time financial position awareness

## Risk Mitigation

### Financial Risks
- **Double Entry**: Prevent duplicate transactions
- **Reconciliation**: Daily cash and bank matching
- **Authorization**: Multi-level approval for large expenses
- **Validation**: Amount limits and suspicious transaction detection

### Compliance Risks
- **Tax Updates**: Regular BIR circular monitoring
- **Documentation**: Complete record keeping
- **Deadlines**: Automated tax filing reminders
- **Penalties**: Compliance dashboard with alerts

## Timeline

- **Week 1-2**: Test specifications (Phase 4.1-4.2)
- **Week 3-4**: Core implementation (Phase 4.3)
- **Week 5**: Reporting and compliance (Phase 4.4)
- **Week 6**: Verification and deployment (Phase 4.5)

## Dependencies

### Technical Dependencies
- Database: PostgreSQL with financial precision
- Payment APIs: PayMongo, GCash, PayMaya SDKs
- Report Engine: JSReports or similar
- File Storage: AWS S3 or local with encryption

### Business Dependencies
- BIR registration and permit numbers
- Bank account API access
- Payment gateway merchant accounts
- Accounting system integration credentials

## Support and Maintenance

### Regular Updates
- Monthly tax table updates
- Quarterly BIR compliance review
- Annual feature enhancement based on user feedback
- Continuous security patching

### Training Requirements
- Financial module overview (2 hours)
- Tax compliance training (4 hours)
- Report generation workshop (2 hours)
- Troubleshooting guide (1 hour)

---

**Phase Lead**: Financial Systems Architect
**Start Date**: [TBD]
**Target Completion**: 6 weeks
**Status**: Planning