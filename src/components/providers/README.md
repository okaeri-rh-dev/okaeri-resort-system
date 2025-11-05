# ⚙️ Providers Module Documentation

## Overview

The **Providers Module** delivers a centralized loading state management system that coordinates loading indicators, navigation transitions, and performance monitoring across the entire application. This infrastructure module provides React Context-based state management, custom hooks for loading control, and adaptive strategies that respond to network conditions.

This module serves as the foundation for delivering smooth, professional user experiences during asynchronous operations, route navigation, and data fetching. It integrates seamlessly with TanStack Router for navigation state and TanStack Query for data fetching state, while providing escape hatches for manual loading state management when needed.

The system is designed with **Philippine internet infrastructure** in mind, implementing adaptive loading strategies that optimize for slower 2G/3G connections common in the region, while still providing premium experiences on faster 4G/5G networks.

## Module Architecture

```
src/components/providers/
└── LoadingProvider.tsx              (259 lines, 7.4 KB)   # Complete loading infrastructure

Module Components:
├── LoadingContext                   # React Context for loading state
├── LoadingProvider                  # Main provider component
├── useLoading                       # Core loading state hook
├── useQueryLoading                  # TanStack Query integration hook
├── LoadingLink                      # Enhanced Link with loading state
├── usePerformanceMonitoring         # Navigation performance tracking
└── useAdaptiveLoading              # Network-aware loading strategies

Total: 259 lines in single comprehensive module
```

## Component Documentation

### LoadingContext & LoadingProvider (Core Infrastructure)

**Purpose:** Provides global loading state management through React Context, enabling any component in the application to trigger and respond to loading states for navigation, data fetching, or manual operations.

**Key Features:**

1. **Centralized Loading State**
   - `isNavigating` (boolean): Indicates route navigation in progress
   - `isGlobalLoading` (boolean): Manual loading state for operations
   - `loadingMessage` (string, optional): Descriptive message for user
   - `setGlobalLoading` (function): Programmatically trigger loading state

2. **Navigation Loading Indicators**
   - Automatically shows PageTransitionSkeleton during route navigation
   - Fixed position overlay prevents interaction during transitions
   - Integrates with TanStack Router (placeholder for future integration)
   - Non-blocking visual feedback

3. **Global Loading Overlay**
   - Full-screen backdrop with blur effect (bg-black/20 backdrop-blur-sm)
   - Centered spinner with loading message
   - Z-index 50 ensures visibility above all content
   - White card container with shadow for prominence
   - Custom message support or fallback "Loading..."

4. **Provider Pattern**
   - Wraps entire application in App.tsx or main entry point
   - Makes loading state available to all descendant components
   - Context value includes all state and updater functions
   - Throws error if hooks used outside provider (safety check)

**LoadingProvider Props:**
- `children` (ReactNode, required): Application component tree

**Context Value Structure:**
- `isNavigating` (boolean): Route transition state
- `isGlobalLoading` (boolean): Manual loading state
- `loadingMessage` (string, optional): Current loading message
- `setGlobalLoading` (function): (loading: boolean, message?: string) => void

**Integration Points:**
- TanStack Router: useRouter hook (currently placeholder)
- PageTransitionSkeleton: Imported from skeletons module
- Logger: Development logging for debugging

**Visual Loading States:**

**Navigation Loading:**
- PageTransitionSkeleton component displayed
- Appears during route transitions
- Prevents layout shift during navigation

**Global Loading:**
- Full-screen overlay with backdrop
- Centered spinner (8x8 with border animation)
- Loading message in small text below spinner
- White card container (max-width sm, padding 6)

---

### useLoading (Core Hook)

**Purpose:** Primary hook for accessing loading state and triggering loading indicators from any component within the LoadingProvider tree.

**Key Features:**

1. **State Access**
   - Read current navigation state (isNavigating)
   - Read current global loading state (isGlobalLoading)
   - Access current loading message
   - No prop drilling required

2. **Loading Control**
   - Trigger global loading state programmatically
   - Set custom loading messages
   - Control loading duration manually
   - Integrate with async operations

3. **Error Safety**
   - Throws descriptive error if used outside LoadingProvider
   - Prevents silent failures and undefined context errors
   - Helps developers catch integration mistakes early

**Hook Return Value:**
- `isNavigating` (boolean): True during route transitions
- `isGlobalLoading` (boolean): True when global loading active
- `loadingMessage` (string | undefined): Current loading message
- `setGlobalLoading` (function): Trigger loading state with optional message

**Usage Pattern:**
- Import useLoading hook in component
- Destructure needed values and functions
- Call setGlobalLoading before async operations
- Disable loading state after completion or error

**Error Handling:**
- Throws Error with message: "useLoading must be used within a LoadingProvider"
- Helps identify provider setup issues
- Ensures context is always available

---

### useQueryLoading (TanStack Query Integration)

**Purpose:** Simplified hook specifically designed for integrating TanStack Query operations with global loading indicators, providing convenient wrapper functions for query and mutation loading states.

**Key Features:**

1. **Simplified API**
   - `startLoading(message?)`: Show global loading indicator
   - `stopLoading()`: Hide global loading indicator
   - Cleaner than calling setGlobalLoading(true/false) directly

2. **Query Integration Pattern**
   - Call startLoading before manual query trigger
   - Call stopLoading in query onSuccess or onError callbacks
   - Works with both useQuery and useMutation hooks
   - Complements TanStack Query's built-in loading states

3. **Optional Loading Messages**
   - Provide contextual messages ("Saving booking...", "Uploading receipt...")
   - Falls back to generic "Loading..." if no message provided
   - Improves user understanding of current operation

**Hook Return Value:**
- `startLoading` (function): (message?: string) => void
- `stopLoading` (function): () => void

**When to Use:**
- Manual query refetch with loading indicator
- Mutation operations that need global loading
- Operations that don't have built-in loading UI
- Multi-step processes requiring loading feedback

**When NOT to Use:**
- TanStack Query already provides component-level loading states
- Most queries should use query.isLoading directly in UI
- Only use for operations requiring full-page loading

---

### LoadingLink (Enhanced Link Component)

**Purpose:** Drop-in replacement for TanStack Router's Link component that automatically shows loading indicators during navigation, providing visual feedback for route transitions.

**Key Features:**

1. **Automatic Loading Indication**
   - Shows global loading overlay on link click
   - Configurable delay to prevent flashing on fast navigation
   - Default delay: 150ms (prevents flicker for instant navigations)
   - Message: "Navigating..." during transition

2. **Configurable Behavior**
   - `showLoading` prop to enable/disable loading (default: true)
   - `loadingDelay` prop to set delay before indicator appears (default: 150ms)
   - Original onClick prop supported (runs after loading trigger)
   - All standard Link props pass through

3. **Performance Optimization**
   - Delay prevents unnecessary loading indicators on fast navigations
   - Loading indicator appears only if navigation takes longer than delay
   - Reduces visual noise and flashing on modern browsers
   - Improves perceived performance

4. **Event Handling**
   - Uses onMouseDown instead of onClick for earlier trigger
   - Starts loading before navigation begins
   - Provides immediate feedback to user action
   - Supports custom onClick handlers

**Component Props:**
- `children` (ReactNode, required): Link content
- `showLoading` (boolean, optional, default: true): Enable loading indicator
- `loadingDelay` (number, optional, default: 150): Delay in ms before showing indicator
- `onClick` (function, optional): Custom click handler
- `...props` (LinkProps): All standard TanStack Router Link props

**Usage Pattern:**
- Import LoadingLink instead of Link from TanStack Router
- Use exactly like standard Link component
- Loading indication automatic on navigation
- Customize delay or disable if needed

**Best Practices:**
- Use for major navigation (page-to-page transitions)
- Consider disabling for tab/section switches
- Adjust delay based on typical navigation speed
- Use custom messages for specific routes

---

### usePerformanceMonitoring (Performance Tracking)

**Purpose:** Development and analytics hook that tracks navigation performance metrics, helping identify slow routes, measure skeleton display time, and optimize loading experiences.

**Key Features:**

1. **Navigation Timing**
   - Captures navigation start timestamp (performance.now())
   - Records navigation end timestamp
   - Calculates total load time (end - start)
   - High-precision timing using Performance API

2. **Metrics Collection**
   - `navigationStart` (number): Timestamp when navigation began
   - `navigationEnd` (number): Timestamp when navigation completed
   - `skeletonDisplayTime` (number): Duration skeleton was visible
   - `totalLoadTime` (number): Complete navigation duration

3. **Development Logging**
   - Logs metrics to console in development mode
   - Uses logger utility for structured logging
   - Helps identify performance bottlenecks
   - Silent in production (NODE_ENV check)

4. **Analytics Integration Ready**
   - Metrics object ready for analytics platforms
   - Can be sent to monitoring services (e.g., Sentry, DataDog)
   - Useful for identifying slow routes
   - Supports A/B testing loading strategies

**Hook Return Value:**
- `metrics` (PerformanceMetrics | null): Current metrics object or null
- `startNavigation` (function): Returns object with end() method

**Metrics Structure:**
- `navigationStart` (number): Start time in milliseconds
- `navigationEnd` (number): End time in milliseconds
- `skeletonDisplayTime` (number): Skeleton display duration
- `totalLoadTime` (number): Total navigation time

**Usage Pattern:**
- Call startNavigation() at navigation start
- Store returned object with end() method
- Call end() when navigation completes
- Metrics automatically logged and stored

**Analytics Use Cases:**
- Track P50/P95/P99 navigation times
- Identify slow routes needing optimization
- Compare skeleton strategies effectiveness
- Monitor impact of code changes on performance

---

### useAdaptiveLoading (Network-Aware Strategies)

**Purpose:** Intelligent hook that detects user's network conditions and recommends optimal loading strategies, ensuring excellent experiences on both slow Philippine 2G/3G networks and fast 4G/5G connections.

**Key Features:**

1. **Network Detection**
   - Uses Network Information API (navigator.connection)
   - Detects effective connection type (slow-2g, 2g, 3g, 4g)
   - Monitors downlink speed (Mbps)
   - Tracks round-trip time (RTT in ms)

2. **Automatic Network Monitoring**
   - Listens for connection changes
   - Updates strategy when network conditions change
   - Handles offline/online transitions
   - Cleans up event listeners on unmount

3. **Adaptive Loading Strategies**
   - **Slow Networks (slow-2g, 2g, <1 Mbps):**
     - Skeleton min duration: 500ms (allow more time for loading)
     - Progressive loading: enabled (load essential first)
     - Reduced animations: true (save bandwidth)
     - Priority: essential data only

   - **Fast Networks (4g, >10 Mbps):**
     - Skeleton min duration: 100ms (minimize delay)
     - Progressive loading: disabled (load all at once)
     - Reduced animations: false (full experience)
     - Priority: full data

   - **Moderate Networks (3g, 1-10 Mbps):**
     - Skeleton min duration: 200ms (balanced)
     - Progressive loading: enabled
     - Reduced animations: false
     - Priority: balanced approach

4. **Graceful Degradation**
   - Falls back to default strategy if API unavailable
   - Handles browsers without Network Information API
   - Provides reasonable defaults for unknown conditions
   - No errors on unsupported browsers

**Hook Return Value:**
- `networkCondition` (NetworkCondition): Current network state
- `getOptimalLoadingStrategy` (function): Returns recommended strategy

**NetworkCondition Structure:**
- `effectiveType` (string | undefined): "slow-2g" | "2g" | "3g" | "4g"
- `downlink` (number): Download speed in Mbps
- `rtt` (number): Round-trip time in milliseconds

**LoadingStrategy Structure:**
- `skeletonMinDuration` (number): Minimum skeleton display time in ms
- `enableProgressive` (boolean): Load data progressively
- `reducedAnimations` (boolean): Disable heavy animations
- `priority` (string): "essential" | "balanced" | "full"

**Philippine Network Context:**
- Many users on 3G networks (especially outside Metro Manila)
- Some areas still on 2G or slow connections
- 4G+ increasingly common in urban areas
- Adaptive strategies critical for good UX

**Usage Pattern:**
- Call useAdaptiveLoading in parent components
- Get current network condition
- Call getOptimalLoadingStrategy() for recommendations
- Apply strategy to skeleton duration, data fetching, animations

---

## Technical Implementation

### Provider Setup

**Application Setup:**
- Wrap root component with LoadingProvider in App.tsx or main.tsx
- Provider must be above all components using loading hooks
- Typically placed high in component tree (below Router, above Routes)
- Ensures loading state available throughout application

**Provider Hierarchy:**
Recommended provider order in application setup:
1. TanStack Router RouterProvider
2. TanStack Query QueryClientProvider
3. LoadingProvider (this module)
4. Application routes and components

### State Management Architecture

**Context-Based State:**
- Uses React Context API for global state distribution
- State stored in LoadingProvider component
- Accessed via useLoading hook in descendant components
- No external state management library required

**State Updates:**
- setGlobalLoading updates local state in provider
- State changes trigger re-renders of consuming components
- Context value memoization could be added for optimization
- Simple, predictable state flow

**Integration with Router:**
- Currently placeholder for TanStack Router integration
- TODO: Connect to router.state.isLoading
- Will enable automatic navigation loading indicators
- Currently manual via LoadingLink component

### Performance Optimization

**Loading Delay Strategy:**
- 150ms delay prevents flashing on fast navigations
- Balance between immediate feedback and avoiding flicker
- Configurable per-link for flexibility
- Based on human perception research (100-300ms is ideal)

**Network-Aware Loading:**
- Adapts skeleton duration to network speed
- Prevents premature skeleton dismissal on slow networks
- Reduces skeleton display on fast networks
- Improves perceived performance across all connection types

**Progressive Loading:**
- Enabled for slow/moderate networks
- Loads essential data first, secondary data later
- Reduces initial payload size
- Faster time to interactive on slow connections

**Animation Reduction:**
- Disables heavy animations on slow networks
- Reduces CPU/GPU usage on low-end devices
- Saves bandwidth (fewer animation frames)
- Improves performance without sacrificing functionality

### Browser Compatibility

**Network Information API:**
- Supported: Chrome, Edge, Opera, Samsung Internet
- Partial support: Android browsers
- Not supported: Safari, Firefox, IE
- Graceful fallback: Default strategy used if API unavailable

**Performance API:**
- performance.now() supported in all modern browsers
- High precision timing (sub-millisecond accuracy)
- No fallback needed (API universally available)

**Context API:**
- React Context supported in React 16.3+
- No compatibility issues with current React versions

---

## Usage Examples

### Basic Provider Setup

The LoadingProvider should wrap the entire application to provide loading state access to all components.

**Typical setup in main.tsx or App.tsx:**
- Import LoadingProvider from providers module
- Wrap application component tree
- Place above all components that will use loading state
- Ensure provider is below Router and QueryClient providers

### Using Loading State in Components

Components can access loading state and control loading indicators using the useLoading hook.

**Common pattern for async operations:**
1. Import useLoading hook
2. Destructure setGlobalLoading function
3. Call setGlobalLoading(true, "Message") before async operation
4. Perform async operation (API call, navigation, etc.)
5. Call setGlobalLoading(false) in finally block or after completion

**Error handling pattern:**
- Always use try/finally to ensure loading state cleared
- Set loading true in try block start
- Perform async work
- Catch errors appropriately
- Set loading false in finally block (always runs)

### TanStack Query Integration

The useQueryLoading hook provides convenient integration with TanStack Query mutations and manual query triggers.

**Mutation pattern:**
- Import useQueryLoading hook
- Destructure startLoading and stopLoading functions
- Call startLoading in mutation onMutate callback
- Call stopLoading in mutation onSuccess and onError callbacks
- Provides full-page loading for critical mutations

**Manual query refetch pattern:**
- Call startLoading before query.refetch()
- Wait for refetch promise
- Call stopLoading after completion
- Useful for pull-to-refresh patterns

### Navigation with Loading Indicators

The LoadingLink component provides automatic loading indicators for route navigation.

**Basic usage:**
- Replace Link imports with LoadingLink
- Use identical props to standard Link
- Loading indicator appears automatically on click
- Customizable delay and message

**Custom delay example:**
- For instant local navigation: loadingDelay={300} (longer to prevent flicker)
- For slow route navigation: loadingDelay={50} (shorter for immediate feedback)
- For tab switches: showLoading={false} (disable loading)

### Performance Monitoring

The usePerformanceMonitoring hook tracks navigation performance for analytics and optimization.

**Basic pattern:**
- Call usePerformanceMonitoring to get startNavigation function
- Call startNavigation() at navigation start, store returned object
- Call object.end() when navigation completes
- Metrics logged automatically in development
- Send metrics to analytics platform in production

**Analytics integration:**
- Extract metrics from returned object
- Send to Sentry, DataDog, Google Analytics, etc.
- Track over time to identify performance regressions
- Compare across routes to identify slow pages

### Adaptive Loading Strategies

The useAdaptiveLoading hook provides network-aware loading recommendations.

**Basic usage:**
- Call useAdaptiveLoading in parent component
- Get optimal strategy with getOptimalLoadingStrategy()
- Apply strategy to skeleton duration, data fetching, animations
- Strategy updates automatically when network changes

**Applying strategies:**
- Skeleton duration: Use strategy.skeletonMinDuration for minimum display time
- Progressive loading: Enable if strategy.enableProgressive is true
- Animations: Disable heavy animations if strategy.reducedAnimations is true
- Data fetching: Prioritize essential data if strategy.priority is "essential"

---

## Best Practices

### ✅ DO:

1. **Wrap application with LoadingProvider early in component tree**
   - Place below Router and QueryClient providers
   - Above all components that need loading state
   - Ensures universal access to loading context

2. **Use LoadingLink for major route navigations**
   - Provides consistent loading experience
   - Reduces boilerplate code
   - Customizable per navigation

3. **Set descriptive loading messages**
   - "Saving booking...", "Uploading receipt...", "Deleting guest..."
   - Helps users understand current operation
   - Improves perceived performance

4. **Always clear loading state in finally blocks**
   - Ensures loading state cleared even on errors
   - Prevents stuck loading indicators
   - Critical for good user experience

5. **Use adaptive loading strategies for Philippine users**
   - Many users on slower 3G/2G connections
   - Adaptive strategies improve experience for all
   - Especially important outside Metro Manila

6. **Monitor performance metrics in development**
   - Use usePerformanceMonitoring to identify slow routes
   - Log metrics to console for debugging
   - Optimize routes that consistently take >1-2 seconds

7. **Configure loading delays based on operation type**
   - Fast operations: higher delay (300ms) to prevent flicker
   - Slow operations: lower delay (50ms) for immediate feedback
   - Balance perceived performance with visual noise

### ❌ DON'T:

1. **Don't use loading provider for every small interaction**
   - Reserve global loading for significant operations
   - Use component-level loading states for small actions
   - Avoid overusing global overlay (annoying for users)

2. **Don't forget to clear loading state**
   - Always pair setGlobalLoading(true) with setGlobalLoading(false)
   - Use try/finally to ensure cleanup
   - Stuck loading overlays block entire application

3. **Don't show loading for operations <100ms**
   - Flashing loading indicators are jarring
   - Use delay parameter to prevent flicker
   - Consider showing nothing for very fast operations

4. **Don't block user interactions unnecessarily**
   - Use loading overlays only when interaction should be prevented
   - Consider inline loading states for non-blocking operations
   - Reserve full-screen overlay for critical operations

5. **Don't ignore network conditions**
   - Slow networks need longer skeleton display times
   - Fast networks can handle immediate data loading
   - Use adaptive strategies for best experience

6. **Don't use useLoading outside LoadingProvider**
   - Hook will throw error if context unavailable
   - Always ensure provider wraps consuming components
   - Check error messages for provider setup issues

7. **Don't rely on Network Information API exclusively**
   - API not supported in all browsers
   - Always provide fallback strategy
   - Test on browsers without API support

---

## Integration with Other Systems

### TanStack Router Integration

**Current Status:**
- Placeholder for router.state.isLoading integration
- Manual loading via LoadingLink component works now
- Future: Automatic loading indicators on all navigations

**Future Integration:**
- Use useRouterState hook to access isLoading
- Set isNavigating based on router state
- Automatic PageTransitionSkeleton on all route changes
- No need for manual LoadingLink usage

### TanStack Query Integration

**useQueryLoading Hook:**
- Provides convenient wrapper for query loading states
- Use for manual query triggers (refetch, invalidateQueries)
- Complements query.isLoading for component-level states
- Best for operations requiring full-page loading

**Mutation Integration:**
- Call startLoading in onMutate callback
- Call stopLoading in onSuccess/onError callbacks
- Provides consistent loading experience across mutations
- Prevents interaction during critical operations

### Skeleton System Integration

**PageTransitionSkeleton:**
- Imported from skeletons module
- Shown during navigation (isNavigating state)
- Provides consistent loading experience
- Prevents layout shift during transitions

**Future Skeleton Integration:**
- Adaptive skeleton duration based on network
- Different skeleton types for different routes
- Progressive skeleton reveal on slow networks

### Analytics Integration

**Performance Metrics:**
- usePerformanceMonitoring provides metrics object
- Send to analytics platform (Sentry, DataDog, etc.)
- Track navigation performance over time
- Identify slow routes and regressions

**Loading State Tracking:**
- Track frequency of global loading usage
- Monitor loading duration distribution
- Identify operations that could be optimized
- A/B test different loading strategies

---

## Future Enhancements

### Planned Features

- ⬜ **Automatic TanStack Router Integration:** Connect to router.state.isLoading
- ⬜ **Loading State Queue:** Handle multiple simultaneous loading operations
- ⬜ **Custom Loading Components:** Allow custom spinner/skeleton components
- ⬜ **Loading Priority System:** Priority queue for loading states
- ⬜ **Offline Detection:** Show offline indicator when network unavailable
- ⬜ **Loading Timeout Handling:** Auto-clear loading after timeout
- ⬜ **Loading State History:** Track loading state changes for debugging
- ⬜ **Preload Route Data:** Prefetch data on link hover
- ⬜ **Service Worker Integration:** Offline-first loading strategies
- ⬜ **Stale-While-Revalidate UI:** Show stale data while refetching
- ⬜ **Loading Cancellation:** Allow user to cancel long-running operations
- ⬜ **Progressive Skeleton Reveal:** Gradual skeleton replacement with data

### Performance Improvements

- ⬜ **Context Value Memoization:** Prevent unnecessary re-renders
- ⬜ **Debounced Loading State:** Prevent rapid loading state changes
- ⬜ **Smart Delay Calculation:** Automatically calculate optimal delay
- ⬜ **Predictive Loading:** Start loading before user action (link hover)
- ⬜ **Resource Hints:** Add preload/prefetch for predicted navigations
- ⬜ **Bundle Size Optimization:** Tree-shake unused adaptive loading code
- ⬜ **Lazy-load Performance Monitoring:** Only load monitoring in development

### UX Enhancements

- ⬜ **Loading Progress Bar:** Show progress for long operations
- ⬜ **Estimated Time Remaining:** Display time estimate for slow operations
- ⬜ **Loading Animation Variants:** Multiple spinner/skeleton styles
- ⬜ **Haptic Feedback:** Vibration on loading start/end (mobile)
- ⬜ **Loading Sound Effects:** Optional audio feedback
- ⬜ **Loading Confetti:** Celebration animation on success
- ⬜ **Dark Mode Loading:** Respect color scheme preference
- ⬜ **Reduced Motion Support:** Disable animations for prefers-reduced-motion

### Developer Experience

- ⬜ **DevTools Integration:** React DevTools loading state inspector
- ⬜ **Loading State Debugger:** Visual tool to debug loading issues
- ⬜ **Performance Dashboard:** Real-time performance metrics view
- ⬜ **Network Simulator:** Test adaptive strategies with simulated networks
- ⬜ **Loading State Logs:** Detailed logging of loading state changes
- ⬜ **TypeScript Strict Mode:** Full type safety across module
- ⬜ **Storybook Stories:** Visual documentation of loading states

---

## Maintenance Notes

### Known Issues

**Router Integration Incomplete:**
- isNavigating currently hardcoded to false
- LoadingLink provides manual navigation loading
- TODO: Integrate with router.state.isLoading
- Workaround: Use LoadingLink for all navigation links

**Network Information API Limited:**
- Not supported in Safari or Firefox
- Falls back to default strategy on unsupported browsers
- Philippine users mostly on Chrome/Android (good support)

### Browser Compatibility

**Tested and Supported:**
- ✅ Chrome 90+ (full Network Information API support)
- ✅ Edge 90+ (full support)
- ✅ Android Chrome (full support)
- ✅ Opera (full support)
- ⚠️ Safari 14+ (works, no Network Information API)
- ⚠️ Firefox 88+ (works, no Network Information API)

**Known Limitations:**
- Network Information API: Not in Safari/Firefox
- Falls back gracefully to default strategy
- All core functionality works across browsers

### Performance Considerations

**Context Re-Renders:**
- Context updates trigger re-renders in all consuming components
- Consider memoization for context value if performance issues
- Most apps won't notice impact (loading state changes infrequent)

**Event Listener Cleanup:**
- Network change listeners cleaned up on unmount
- No memory leaks in single-page app usage
- Proper cleanup in useEffect return functions

### Monitoring Recommendations

**Metrics to Track:**
1. Average loading state duration
2. Frequency of global loading usage
3. Navigation performance (P50, P95, P99)
4. Network condition distribution (2g, 3g, 4g)
5. Loading state errors (stuck loading indicators)

**Alerts to Configure:**
1. Loading state duration >10 seconds (stuck loading)
2. High frequency of global loading (overuse)
3. Slow navigation performance (>2 seconds)
4. Increase in error rates during loading

### Update Procedures

**When Adding New Loading States:**
1. Extend LoadingState interface with new properties
2. Update context value and provider state
3. Export new state access via useLoading hook
4. Document new state in README
5. Add tests for new functionality

**When Integrating with Router:**
1. Import useRouterState hook from TanStack Router
2. Replace hardcoded isNavigating with router.state.isLoading
3. Remove TODO comments
4. Update tests to mock router state
5. Update README to reflect automatic navigation loading

**When Optimizing Performance:**
1. Add memoization to context value
2. Debounce rapid loading state changes
3. Profile with React DevTools
4. Measure impact on re-renders
5. Document performance improvements

---

**Last Updated:** 2025-01-05
**Module Version:** 1.0.0
**Maintainer:** Okaeri Development Team
**Status:** ✅ Production Ready (with future enhancements planned)
