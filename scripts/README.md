# Production Deployment Scripts

This directory contains automated scripts for Phase 5.5 Go-Live operations of the Okaeri Resort System.

## Scripts Overview

### 1. `deploy-production.sh`
**Primary deployment automation script**

**Purpose**: Handles complete production deployment from pre-validation to go-live
- Pre-deployment testing (unit, integration, security)
- Production build generation
- Vercel deployment execution
- Post-deployment verification
- Deployment record creation

**Usage**:
```bash
./scripts/deploy-production.sh
```

**Prerequisites**:
- Vercel CLI installed and authenticated
- Node.js 20.x
- All environment variables configured
- Clean git working directory recommended

**Process**:
1. Dependency validation
2. Pre-deployment test suite (type-check, lint, tests, security)
3. Production build with optimization
4. Vercel deployment to production
5. Health check and endpoint verification
6. Performance validation
7. Deployment record generation

### 2. `rollback-production.sh`
**Emergency rollback automation**

**Purpose**: Immediate rollback capability for production issues
- Interactive or automated rollback selection
- Health verification of rollback target
- Incident documentation
- Team notification

**Usage**:
```bash
# Interactive rollback
./scripts/rollback-production.sh

# Automated rollback
./scripts/rollback-production.sh --force --reason "Critical security issue"

# Rollback to specific deployment
./scripts/rollback-production.sh --target https://old-deployment.vercel.app
```

**Options**:
- `-f, --force`: Skip confirmation prompts
- `-r, --reason TEXT`: Specify rollback reason
- `-t, --target URL`: Target specific deployment URL
- `-h, --help`: Show usage information

**Process**:
1. Retrieve deployment history
2. Select rollback target (interactive or specified)
3. Confirmation (unless force flag used)
4. Execute Vercel promotion
5. Verify rollback health
6. Generate incident report
7. Team notification

### 3. `validate-deployment.sh`
**Post-deployment validation suite**

**Purpose**: Comprehensive validation of deployed application
- Endpoint testing and connectivity verification
- Security header validation
- Performance metrics collection
- Load testing simulation
- Database connectivity verification

**Usage**:
```bash
# Full validation
./scripts/validate-deployment.sh https://okaeri-resort.vercel.app

# Skip load testing (faster)
./scripts/validate-deployment.sh --skip-load-test https://deployment-url.vercel.app

# Security validation only
./scripts/validate-deployment.sh --security-only https://deployment-url.vercel.app

# Performance validation only
./scripts/validate-deployment.sh --performance-only https://deployment-url.vercel.app
```

**Options**:
- `--skip-load-test`: Skip load testing for faster validation
- `--security-only`: Run only security-related validations
- `--performance-only`: Run only performance-related validations
- `-h, --help`: Show usage information

**Validation Tests**:
- Basic connectivity (main page load)
- Health check endpoint functionality
- Authentication endpoint responses
- Security headers presence and configuration
- API endpoint availability and CORS
- Performance metrics (load times, response times)
- Load simulation (concurrent requests)
- Database connectivity via health checks

## Integration with Phase 5.5

These scripts are designed to work together as part of the Phase 5.5 Go-Live Checklist:

1. **Pre-Deployment**: Run `deploy-production.sh` for full automated deployment
2. **Validation**: Use `validate-deployment.sh` to verify deployment health
3. **Emergency Response**: Use `rollback-production.sh` if issues are discovered

## Error Handling and Logging

All scripts include:
- Comprehensive error handling with clear exit codes
- Detailed logging to timestamped log files
- Color-coded console output for better visibility
- Automatic cleanup on script failure
- Context preservation for debugging

**Log Files**:
- `deployment.log` - Complete deployment process log
- `rollback.log` - Rollback operations and decisions
- `validation.log` - Validation test results and timing

## Security Considerations

- Scripts validate authentication before execution
- No secrets are hardcoded (uses Vercel CLI authentication)
- All operations are logged for audit trails
- Rollback capability ensures quick recovery
- Validation includes security header verification

## Performance Optimization

- Scripts run tests in parallel where possible
- Timeouts prevent hanging operations
- Load testing validates system under stress
- Performance budgets enforced (2s page load, 1s API response)
- Connection pooling awareness for serverless functions

## Troubleshooting

### Common Issues

1. **Vercel CLI not authenticated**
   ```bash
   vercel login
   ```

2. **Node.js version mismatch**
   ```bash
   nvm use 20
   # or update Node.js to 20.x
   ```

3. **Missing dependencies**
   ```bash
   npm ci --prefer-offline --no-audit
   ```

4. **Deployment validation failures**
   - Check deployment logs in Vercel dashboard
   - Verify environment variables are configured
   - Ensure database connections are healthy
   - Review security headers configuration

### Emergency Procedures

If automated rollback fails:
1. Access Vercel dashboard directly
2. Manually promote a previous deployment
3. Verify health using validation script
4. Create manual incident report

## Phase 5.5 Checklist Integration

These scripts support the following Phase 5.5 deliverables:

- ✅ **Automated deployment validation** (`deploy-production.sh`)
- ✅ **Security verification** (all scripts include security checks)
- ✅ **Performance validation** (`validate-deployment.sh`)
- ✅ **Emergency rollback procedures** (`rollback-production.sh`)
- ✅ **Deployment documentation** (this README)
- ✅ **Incident response automation** (rollback incident reporting)

## Next Steps After Deployment

1. Configure external monitoring (Uptime Robot)
2. Set up alerting for health check failures
3. Document any environment-specific configurations
4. Train team on rollback procedures
5. Schedule regular validation runs

## Support

For issues with these scripts:
1. Check the relevant log file for detailed error information
2. Verify all prerequisites are met
3. Ensure Vercel CLI is properly authenticated
4. Review the troubleshooting section above
5. Contact the system administrator if manual intervention is required