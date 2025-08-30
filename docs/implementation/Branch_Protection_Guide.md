# Branch Protection Guide

## GitHub Security Configuration for Okaeri Resort System

> **Last Updated**: August 2025  
> **Owner**: security-compliance-auditor agent  
> **Priority**: CRITICAL - Must be configured before any code merges

---

## Overview

This guide provides step-by-step instructions for configuring GitHub branch
protection rules to ensure code quality, security, and prevent unauthorized
changes to the Okaeri Resort Management System.

---

## Protected Branches

### Main Branch (`main`)

**Protection Level**: MAXIMUM

The `main` branch contains production-ready code and requires the strictest
protection:

#### Required Settings

```yaml
Branch name pattern: main

Protection Rules:
  ✅ Require pull request reviews before merging
    - Required approving reviews: 2
    - Dismiss stale pull request approvals when new commits are pushed: YES
    - Require review from CODEOWNERS: YES
    - Restrict who can dismiss pull request reviews: Admin only

  ✅ Require status checks to pass before merging
    - Require branches to be up to date before merging: YES
    - Required status checks:
      • quality-gates
      • deterministic-tests
      • security-scan
      • build-and-analyze
      • coverage-check (90% minimum)
      • lighthouse-performance
      • bundle-size-check

  ✅ Require conversation resolution before merging

  ✅ Require signed commits

  ✅ Require linear history

  ✅ Include administrators

  ✅ Restrict who can push to matching branches
    - Users/teams with push access: [Team leads only]

  ❌ Allow force pushes: NEVER
  ❌ Allow deletions: NEVER
```

### Development Branch (`develop`)

**Protection Level**: HIGH

The `develop` branch is for integration testing and requires protection:

```yaml
Branch name pattern: develop

Protection Rules:
  ✅ Require pull request reviews before merging
    - Required approving reviews: 1
    - Dismiss stale reviews: YES

  ✅ Require status checks to pass
    - Required checks:
      • quality-gates
      • deterministic-tests
      • build-and-analyze

  ✅ Require up-to-date branches

  ❌ Allow force pushes: NO
  ❌ Allow deletions: NO
```

### Release Branches (`release/*`)

**Protection Level**: HIGH

Release branches require careful management:

```yaml
Branch name pattern: release/*

Protection Rules:
  ✅ Require pull request reviews: 2 reviewers
  ✅ Require status checks
  ✅ Restrict push access to release managers
  ❌ Allow force pushes: NO
  ❌ Allow deletions: NO (until after merge)
```

---

## Required Status Checks

### Critical Checks (Block Merge)

These checks MUST pass before any merge to protected branches:

| Check Name            | Purpose                        | Failure Action |
| --------------------- | ------------------------------ | -------------- |
| `quality-gates`       | Ensures code quality standards | Block merge    |
| `deterministic-tests` | Runs all test suites           | Block merge    |
| `security-scan`       | Scans for vulnerabilities      | Block merge    |
| `coverage-check`      | Verifies 90% test coverage     | Block merge    |
| `build-and-analyze`   | Builds and analyzes code       | Block merge    |

### Warning Checks (Non-Blocking)

These checks provide information but don't block merges:

| Check Name               | Purpose                | Failure Action |
| ------------------------ | ---------------------- | -------------- |
| `lighthouse-performance` | Performance metrics    | Warning only   |
| `bundle-size-check`      | Bundle size monitoring | Warning only   |
| `e2e-tests`              | End-to-end tests       | Warning only   |

---

## GitHub Configuration Steps

### Step 1: Navigate to Settings

1. Go to repository: `okaeri-dev/okaeri-resort-system`
2. Click **Settings** tab
3. Navigate to **Branches** in left sidebar

### Step 2: Add Branch Protection Rule

1. Click **Add rule** button
2. Enter branch name pattern (e.g., `main`)
3. Configure protection settings as specified above

### Step 3: Configure Required Status Checks

1. In "Require status checks" section:
   - Search and add each required check
   - Enable "Require branches to be up to date"
   - Set strict mode for critical checks

### Step 4: Configure Pull Request Reviews

1. Enable "Require pull request reviews"
2. Set number of required reviewers
3. Enable "Dismiss stale reviews"
4. Configure CODEOWNERS requirement

### Step 5: Additional Security

1. Enable "Require signed commits"
2. Enable "Require linear history"
3. Enable "Include administrators"
4. Configure push restrictions

### Step 6: Save Changes

1. Review all settings
2. Click "Create" or "Save changes"
3. Test with a sample PR

---

## CODEOWNERS Configuration

Create `.github/CODEOWNERS` file:

```
# Global owners
* @lead-developer @tech-lead

# Documentation
/docs/ @documentation-team @tech-lead

# Security-sensitive files
/src/lib/auth/ @security-team @tech-lead
/src/lib/security/ @security-team @tech-lead
/.github/workflows/ @devops-team @tech-lead

# Database
/migrations/ @database-team @tech-lead
/src/lib/db/ @database-team @tech-lead

# Financial features
/src/features/expenses/ @finance-team @tech-lead
/src/features/income/ @finance-team @tech-lead

# API routes
/api/ @backend-team @tech-lead

# Configuration files
*.config.* @devops-team @tech-lead
.env* @security-team @tech-lead
```

---

## Automated Enforcement

### CI/CD Integration

The CI/CD pipeline automatically enforces:

```yaml
# .github/workflows/enforce-protection.yml
name: Enforce Protection

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  check-protection:
    runs-on: ubuntu-latest
    steps:
      - name: Check branch protection
        uses: actions/github-script@v6
        with:
          script: |
            const protection = await github.rest.repos.getBranchProtection({
              owner: context.repo.owner,
              repo: context.repo.repo,
              branch: 'main'
            });

            // Verify critical settings
            if (!protection.data.required_pull_request_reviews) {
              core.setFailed('Branch protection misconfigured');
            }
```

---

## Bypass Procedures

### Emergency Hotfix Process

For critical production issues:

1. Create hotfix branch from `main`
2. Apply minimal fix
3. Create PR with "HOTFIX" label
4. Requires 1 emergency reviewer (instead of 2)
5. All status checks still required
6. Document in incident report

### Admin Override

**WARNING**: Admin overrides are logged and audited

Legitimate uses:

- Security patches
- Critical infrastructure updates
- Legal compliance changes

Process:

1. Document reason in PR description
2. Get written approval from CTO/Security Lead
3. Use admin override
4. Create audit entry
5. Review in next security meeting

---

## Monitoring and Alerts

### Branch Protection Events

Monitor these events:

- Protection rules disabled/modified
- Admin overrides used
- Force pushes attempted
- Branch deletions attempted

### Alert Configuration

Set up GitHub webhooks to alert on:

```json
{
  "events": ["branch_protection_rule", "repository", "push"],
  "config": {
    "url": "https://your-monitoring-service/github-webhook",
    "content_type": "json",
    "secret": "webhook-secret"
  }
}
```

---

## Rollback Protection

### Preventing Accidental Rollbacks

1. **Tag Protection**: Protect release tags
2. **Deployment Locks**: Require approval for production deployments
3. **Rollback PR Required**: Rollbacks must go through PR process

### Rollback Process

```yaml
Rollback Steps:
1. Create PR reverting problematic commit
2. Title: "ROLLBACK: [description]"
3. Requires expedited review (1 reviewer)
4. All CI checks must still pass
5. Deploy immediately after merge
```

---

## Compliance and Audit

### Audit Requirements

- Log all protection rule changes
- Monthly review of override usage
- Quarterly protection rule audit
- Annual security review

### Compliance Checklist

- [ ] SOC 2 Type II requirements met
- [ ] GDPR data protection enforced
- [ ] Philippine Data Privacy Act compliance
- [ ] PCI DSS for payment processing

---

## Troubleshooting

### Common Issues

| Issue                             | Solution                                |
| --------------------------------- | --------------------------------------- |
| "Required status check not found" | Ensure CI workflow names match exactly  |
| "Reviews dismissed unexpectedly"  | Check "dismiss stale reviews" setting   |
| "Can't merge up-to-date branch"   | Verify all required checks are passing  |
| "Admin can't merge"               | "Include administrators" may be enabled |

### Support Contacts

- **Security Issues**: security-team@okaeri.dev
- **CI/CD Problems**: devops-team@okaeri.dev
- **Permission Issues**: admin-team@okaeri.dev

---

## Best Practices

1. **Never disable protection** for convenience
2. **Document all overrides** with justification
3. **Review permissions quarterly**
4. **Test protection rules** with non-critical branches first
5. **Keep CODEOWNERS updated** as team changes
6. **Monitor for suspicious activity**
7. **Educate team** on protection importance

---

## References

- [GitHub Branch Protection Docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
- [CI/CD Pipeline Guide](./CI_CD_PIPELINE_GUIDE.md)
- [Security Implementation Guide](../archive-2025-08-25-initial/root-docs/SECURITY_IMPLEMENTATION_GUIDE.md)
- [GLOSSARY](./GLOSSARY.md)

---

_This guide is mandatory for all repository administrators and must be followed
exactly._
