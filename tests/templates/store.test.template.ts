/**
 * TDD Zustand Store Test Template
 * 
 * This template provides a comprehensive structure for Test-Driven Development
 * of Zustand stores in the Okaeri Resort Management System.
 * 
 * USAGE:
 * 1. Copy this template to your store's test file
 * 2. Replace [STORE_NAME] with your actual store name (e.g., BookingStore, PaymentStore)
 * 3. Replace [ENTITY] with your entity type (e.g., Booking, Payment, Expense)
 * 4. Follow the Red-Green-Refactor cycle for each test
 * 5. Update imports and types as needed
 * 
 * TDD CYCLE GUIDE:
 * 🔴 RED: Write a failing test
 * 🟢 GREEN: Write minimal code to make test pass  
 * 🔄 REFACTOR: Improve code while keeping tests green
 * 
 * @author Claude Code Assistant
 * @version 1.0.0
 * @since Phase 1.7 - TDD Integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { 
  BookingTestBuilder,
  PaymentTestBuilder,
  ExpenseTestBuilder,
  PhilippineDataGenerator,
  TDDWorkflow,
  TDD_CONSTANTS,
} from '@tests/utils/tdd-helpers';

// ====================================
// IMPORTS - UPDATE THESE FOR YOUR STORE
// ====================================

// Replace with your actual store imports
// import { use[STORE_NAME]Store } from '@/stores/[store-file]';

// Replace with your entity types
// type [ENTITY] = Booking | Payment | Expense;
// type Create[ENTITY]Input = CreateBookingInput | CreatePaymentInput | CreateExpenseInput;
// type Update[ENTITY]Input = UpdateBookingInput | UpdatePaymentInput | UpdateExpenseInput;

// Mock store interface for initial failing tests
interface [STORE_NAME]State {
  // 🔴 RED: Define basic state shape first
  items: any[]; // Replace 'any' with your entity type
  selectedItem: any | null;
  isLoading: boolean;
  error: string | null;
  
  // Pagination
  currentPage: number;
  totalPages: number;
  totalItems: number;
  
  // Filters
  filters: Record<string, any>;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface [STORE_NAME]Actions {
  // CRUD operations
  fetchItems: (options?: any) => Promise<void>;
  createItem: (data: any) => Promise<void>; // Replace 'any' with Create[ENTITY]Input
  updateItem: (id: string, data: any) => Promise<void>; // Replace 'any' with Update[ENTITY]Input
  deleteItem: (id: string) => Promise<void>;
  
  // Selection
  selectItem: (item: any | null) => void; // Replace 'any' with your entity type
  clearSelection: () => void;
  
  // Pagination
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  
  // Filtering and sorting
  setFilters: (filters: Record<string, any>) => void;
  clearFilters: () => void;
  setSorting: (field: string, order: 'asc' | 'desc') => void;
  
  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

// Mock store implementation for RED phase
const use[STORE_NAME]Store = create<[STORE_NAME]State & [STORE_NAME]Actions>()(
  devtools(
    immer((set, get) => ({
      // 🔴 RED: Initial state - start minimal
      items: [],
      selectedItem: null,
      isLoading: false,
      error: null,
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      filters: {},
      sortBy: 'createdAt',
      sortOrder: 'desc',

      // 🔴 RED: Actions that initially throw or do nothing
      fetchItems: async () => {
        throw new Error('Not implemented');
      },
      createItem: async () => {
        throw new Error('Not implemented');
      },
      updateItem: async () => {
        throw new Error('Not implemented');
      },
      deleteItem: async () => {
        throw new Error('Not implemented');
      },
      selectItem: () => {
        // No-op initially
      },
      clearSelection: () => {
        // No-op initially
      },
      setPage: () => {
        // No-op initially
      },
      setPageSize: () => {
        // No-op initially
      },
      setFilters: () => {
        // No-op initially
      },
      clearFilters: () => {
        // No-op initially
      },
      setSorting: () => {
        // No-op initially
      },
      setLoading: () => {
        // No-op initially
      },
      setError: () => {
        // No-op initially
      },
      clearError: () => {
        // No-op initially
      },
      reset: () => {
        // No-op initially
      },
    })),
    {
      name: '[STORE_NAME]Store',
    }
  )
);

// ====================================
// TEST SETUP
// ====================================

describe('[STORE_NAME] Store', () => {
  // Mock API client
  const mockApiClient = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };

  // Test data builders
  let mockItem: any; // Replace with your entity type
  let mockItems: any[]; // Replace with your entity type array

  beforeEach(() => {
    // 🔧 SETUP: Reset mocks and create fresh test data
    vi.clearAllMocks();
    
    // Create test data using builders
    mockItem = BookingTestBuilder.create().withDefaults().build(); // Replace with appropriate builder
    mockItems = BookingTestBuilder.create().buildMany(5); // Replace with appropriate builder
    
    // Reset store state
    act(() => {
      use[STORE_NAME]Store.getState().reset();
    });
    
    // Mock successful API responses by default
    mockApiClient.get.mockResolvedValue({ data: mockItems, meta: { total: mockItems.length } });
    mockApiClient.post.mockResolvedValue({ data: mockItem });
    mockApiClient.patch.mockResolvedValue({ data: mockItem });
    mockApiClient.delete.mockResolvedValue({});
  });

  afterEach(() => {
    // 🧹 CLEANUP: Clean up after each test
    vi.restoreAllMocks();
  });

  // ====================================
  // RED-GREEN-REFACTOR: INITIAL STATE
  // ====================================

  describe('🔴🟢🔄 Initial State', () => {
    it('🔴 RED: should fail with incorrect initial state', () => {
      const tddCycle = TDDWorkflow.createTDDCycle('Initial State');
      
      tddCycle.red('has correct initial state', () => {
        const { result } = renderHook(() => use[STORE_NAME]Store());
        
        // This should fail initially if state structure is wrong
        expect(result.current.items).toEqual([]);
        expect(result.current.selectedItem).toBeNull();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.currentPage).toBe(1);
        expect(result.current.totalPages).toBe(1);
        expect(result.current.totalItems).toBe(0);
        expect(result.current.filters).toEqual({});
        expect(result.current.sortBy).toBe('createdAt');
        expect(result.current.sortOrder).toBe('desc');
      });
    });

    it('🟢 GREEN: should have correct initial state after implementation', () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      expect(result.current.items).toEqual([]);
      expect(result.current.selectedItem).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.currentPage).toBe(1);
      expect(result.current.totalPages).toBe(1);
      expect(result.current.totalItems).toBe(0);
      expect(result.current.filters).toEqual({});
      expect(result.current.sortBy).toBe('createdAt');
      expect(result.current.sortOrder).toBe('desc');
    });

    it('🔄 REFACTOR: should initialize with TypeScript-safe state', () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      const state = result.current;
      
      // Verify types are enforced
      expect(Array.isArray(state.items)).toBe(true);
      expect(typeof state.isLoading).toBe('boolean');
      expect(typeof state.currentPage).toBe('number');
      expect(['asc', 'desc'].includes(state.sortOrder)).toBe(true);
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: FETCH OPERATIONS
  // ====================================

  describe('🔴🟢🔄 Fetch Operations', () => {
    it('🔴 RED: should fail to fetch items initially', async () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      // This should fail initially due to not implemented error
      await expect(result.current.fetchItems()).rejects.toThrow('Not implemented');
    });

    it('🟢 GREEN: should fetch items successfully', async () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      await act(async () => {
        await result.current.fetchItems();
      });
      
      expect(result.current.items).toHaveLength(mockItems.length);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('🔄 REFACTOR: should handle loading states correctly', async () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      // Mock slow API response
      mockApiClient.get.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: mockItems }), 100))
      );
      
      const fetchPromise = act(async () => {
        await result.current.fetchItems();
      });
      
      // Should be loading
      expect(result.current.isLoading).toBe(true);
      
      await fetchPromise;
      
      // Should complete loading
      expect(result.current.isLoading).toBe(false);
      expect(result.current.items).toHaveLength(mockItems.length);
    });

    it('🔄 REFACTOR: should handle fetch errors gracefully', async () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      const errorMessage = 'Failed to fetch items';
      
      mockApiClient.get.mockRejectedValue(new Error(errorMessage));
      
      await act(async () => {
        try {
          await result.current.fetchItems();
        } catch (error) {
          // Expected to throw
        }
      });
      
      expect(result.current.items).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(errorMessage);
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: CREATE OPERATIONS
  // ====================================

  describe('🔴🟢🔄 Create Operations', () => {
    it('🔴 RED: should fail to create item initially', async () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      const newItemData = mockItem;
      
      // This should fail initially
      await expect(result.current.createItem(newItemData)).rejects.toThrow('Not implemented');
    });

    it('🟢 GREEN: should create item successfully', async () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      const newItemData = mockItem;
      
      await act(async () => {
        await result.current.createItem(newItemData);
      });
      
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/[entity-endpoint]', newItemData); // Update endpoint
      expect(result.current.items).toContain(mockItem);
    });

    it('🔄 REFACTOR: should validate Philippine-specific data when creating', async () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      // Test with Philippine phone number
      const itemWithPhoneData = {
        ...mockItem,
        guestPhone: PhilippineDataGenerator.mobileNumber(),
      };
      
      await act(async () => {
        await result.current.createItem(itemWithPhoneData);
      });
      
      expect(itemWithPhoneData.guestPhone).toBeValidPhilippinePhone();
      expect(result.current.error).toBeNull();
    });

    it('🔄 REFACTOR: should handle create errors with proper error states', async () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      const errorMessage = 'Validation failed';
      
      mockApiClient.post.mockRejectedValue(new Error(errorMessage));
      
      await act(async () => {
        try {
          await result.current.createItem(mockItem);
        } catch (error) {
          // Expected to throw
        }
      });
      
      expect(result.current.error).toBe(errorMessage);
      expect(result.current.isLoading).toBe(false);
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: UPDATE OPERATIONS
  // ====================================

  describe('🔴🟢🔄 Update Operations', () => {
    beforeEach(async () => {
      // Set up initial items
      const { result } = renderHook(() => use[STORE_NAME]Store());
      await act(async () => {
        await result.current.fetchItems();
      });
    });

    it('🔴 RED: should fail to update item initially', async () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      const updateData = { guestName: 'Updated Name' };
      
      await expect(result.current.updateItem(mockItem.id, updateData)).rejects.toThrow('Not implemented');
    });

    it('🟢 GREEN: should update item successfully', async () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      const updateData = { guestName: 'Updated Name' };
      const updatedItem = { ...mockItem, ...updateData };
      
      mockApiClient.patch.mockResolvedValue({ data: updatedItem });
      
      await act(async () => {
        await result.current.updateItem(mockItem.id, updateData);
      });
      
      expect(mockApiClient.patch).toHaveBeenCalledWith(`/api/[entity-endpoint]/${mockItem.id}`, updateData);
    });

    it('🔄 REFACTOR: should optimistically update UI before API call', async () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      const updateData = { guestName: 'Updated Name' };
      
      // Mock slow API to test optimistic update
      mockApiClient.patch.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: { ...mockItem, ...updateData } }), 100))
      );
      
      act(() => {
        result.current.updateItem(mockItem.id, updateData);
      });
      
      // Should show optimistic update immediately
      const updatedItem = result.current.items.find(item => item.id === mockItem.id);
      expect(updatedItem?.guestName).toBe('Updated Name');
    });

    it('🔄 REFACTOR: should rollback on update failure', async () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      const updateData = { guestName: 'Updated Name' };
      const originalName = mockItem.guestName;
      
      mockApiClient.patch.mockRejectedValue(new Error('Update failed'));
      
      await act(async () => {
        try {
          await result.current.updateItem(mockItem.id, updateData);
        } catch (error) {
          // Expected to fail
        }
      });
      
      // Should rollback to original state
      const item = result.current.items.find(item => item.id === mockItem.id);
      expect(item?.guestName).toBe(originalName);
      expect(result.current.error).toBe('Update failed');
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: DELETE OPERATIONS
  // ====================================

  describe('🔴🟢🔄 Delete Operations', () => {
    beforeEach(async () => {
      // Set up initial items
      const { result } = renderHook(() => use[STORE_NAME]Store());
      await act(async () => {
        await result.current.fetchItems();
      });
    });

    it('🔴 RED: should fail to delete item initially', async () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      await expect(result.current.deleteItem(mockItem.id)).rejects.toThrow('Not implemented');
    });

    it('🟢 GREEN: should delete item successfully', async () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      const initialCount = result.current.items.length;
      
      await act(async () => {
        await result.current.deleteItem(mockItem.id);
      });
      
      expect(mockApiClient.delete).toHaveBeenCalledWith(`/api/[entity-endpoint]/${mockItem.id}`);
      expect(result.current.items).toHaveLength(initialCount - 1);
      expect(result.current.items.find(item => item.id === mockItem.id)).toBeUndefined();
    });

    it('🔄 REFACTOR: should optimistically remove item before API call', async () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      const initialCount = result.current.items.length;
      
      // Mock slow API
      mockApiClient.delete.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({}), 100))
      );
      
      act(() => {
        result.current.deleteItem(mockItem.id);
      });
      
      // Should remove optimistically
      expect(result.current.items).toHaveLength(initialCount - 1);
    });

    it('🔄 REFACTOR: should restore item on delete failure', async () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      const initialCount = result.current.items.length;
      
      mockApiClient.delete.mockRejectedValue(new Error('Delete failed'));
      
      await act(async () => {
        try {
          await result.current.deleteItem(mockItem.id);
        } catch (error) {
          // Expected to fail
        }
      });
      
      // Should restore item
      expect(result.current.items).toHaveLength(initialCount);
      expect(result.current.items.find(item => item.id === mockItem.id)).toBeDefined();
      expect(result.current.error).toBe('Delete failed');
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: SELECTION MANAGEMENT
  // ====================================

  describe('🔴🟢🔄 Selection Management', () => {
    it('🔴 RED: should fail to select item initially', () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      act(() => {
        result.current.selectItem(mockItem);
      });
      
      // This might fail if selectItem is not implemented
      expect(result.current.selectedItem).toEqual(mockItem);
    });

    it('🟢 GREEN: should select and clear item selection', () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      act(() => {
        result.current.selectItem(mockItem);
      });
      
      expect(result.current.selectedItem).toEqual(mockItem);
      
      act(() => {
        result.current.clearSelection();
      });
      
      expect(result.current.selectedItem).toBeNull();
    });

    it('🔄 REFACTOR: should handle selection with type safety', () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      act(() => {
        result.current.selectItem(mockItem);
      });
      
      expect(result.current.selectedItem).toEqual(mockItem);
      expect(result.current.selectedItem?.id).toBe(mockItem.id);
      
      // Should handle null selection
      act(() => {
        result.current.selectItem(null);
      });
      
      expect(result.current.selectedItem).toBeNull();
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: PAGINATION
  // ====================================

  describe('🔴🟢🔄 Pagination', () => {
    it('🔴 RED: should fail to handle pagination initially', () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      act(() => {
        result.current.setPage(2);
      });
      
      // This might fail if setPage is not implemented
      expect(result.current.currentPage).toBe(2);
    });

    it('🟢 GREEN: should handle page changes', async () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      act(() => {
        result.current.setPage(3);
      });
      
      expect(result.current.currentPage).toBe(3);
    });

    it('🔄 REFACTOR: should fetch new data when page changes', async () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      // Mock paginated response
      mockApiClient.get.mockResolvedValue({
        data: mockItems.slice(5, 10),
        meta: { total: 20, page: 2, limit: 5 }
      });
      
      await act(async () => {
        result.current.setPage(2);
        await result.current.fetchItems();
      });
      
      expect(result.current.currentPage).toBe(2);
      expect(result.current.totalItems).toBe(20);
      expect(result.current.totalPages).toBe(4); // 20 / 5
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: FILTERING & SORTING
  // ====================================

  describe('🔴🟢🔄 Filtering & Sorting', () => {
    it('🔴 RED: should fail to handle filters initially', () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      const filters = { status: 'confirmed', guestCount: { min: 2, max: 6 } };
      
      act(() => {
        result.current.setFilters(filters);
      });
      
      expect(result.current.filters).toEqual(filters);
    });

    it('🟢 GREEN: should set and clear filters', () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      const filters = { status: 'confirmed' };
      
      act(() => {
        result.current.setFilters(filters);
      });
      
      expect(result.current.filters).toEqual(filters);
      
      act(() => {
        result.current.clearFilters();
      });
      
      expect(result.current.filters).toEqual({});
    });

    it('🔄 REFACTOR: should handle Philippine-specific filters', () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      const filters = {
        dateRange: {
          start: '2024-12-01',
          end: '2024-12-31'
        },
        amountRange: {
          min: '5000.00',
          max: '25000.00'
        },
        paymentMethod: 'GCASH'
      };
      
      act(() => {
        result.current.setFilters(filters);
      });
      
      expect(result.current.filters.amountRange.min).toBeValidPhpAmount();
      expect(result.current.filters.amountRange.max).toBeValidPhpAmount();
      expect(result.current.filters.paymentMethod).toHaveValidPaymentMethod();
    });

    it('🔄 REFACTOR: should handle sorting correctly', () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      act(() => {
        result.current.setSorting('guestName', 'asc');
      });
      
      expect(result.current.sortBy).toBe('guestName');
      expect(result.current.sortOrder).toBe('asc');
      
      act(() => {
        result.current.setSorting('totalAmount', 'desc');
      });
      
      expect(result.current.sortBy).toBe('totalAmount');
      expect(result.current.sortOrder).toBe('desc');
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: ERROR HANDLING
  // ====================================

  describe('🔴🟢🔄 Error Handling', () => {
    it('🔴 RED: should fail to handle errors initially', () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      const errorMessage = 'Test error';
      
      act(() => {
        result.current.setError(errorMessage);
      });
      
      expect(result.current.error).toBe(errorMessage);
    });

    it('🟢 GREEN: should set and clear errors', () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      const errorMessage = 'Test error';
      
      act(() => {
        result.current.setError(errorMessage);
      });
      
      expect(result.current.error).toBe(errorMessage);
      
      act(() => {
        result.current.clearError();
      });
      
      expect(result.current.error).toBeNull();
    });

    it('🔄 REFACTOR: should handle Philippine business rule errors', () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      // Test validation errors for Philippine context
      const validationErrors = [
        'Invalid Philippine mobile number format',
        'Amount must be in Philippine pesos (₱)',
        'Check-in date must be at least 24 hours in advance',
      ];
      
      validationErrors.forEach(error => {
        act(() => {
          result.current.setError(error);
        });
        
        expect(result.current.error).toBe(error);
        
        act(() => {
          result.current.clearError();
        });
      });
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: ASYNC OPERATIONS
  // ====================================

  describe('🔴🟢🔄 Async Operations', () => {
    it('🔴 RED: should fail async operations initially', async () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      await expect(async () => {
        await act(async () => {
          await result.current.fetchItems();
        });
      }).rejects.toThrow();
    });

    it('🟢 GREEN: should handle concurrent async operations', async () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      // Mock different responses for concurrent calls
      mockApiClient.get.mockResolvedValueOnce({ data: mockItems.slice(0, 2) });
      mockApiClient.post.mockResolvedValueOnce({ data: mockItem });
      
      await act(async () => {
        const [fetchResult, createResult] = await Promise.all([
          result.current.fetchItems(),
          result.current.createItem(mockItem)
        ]);
      });
      
      expect(result.current.items.length).toBeGreaterThan(0);
      expect(result.current.error).toBeNull();
    });

    it('🔄 REFACTOR: should handle race conditions properly', async () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      // Simulate race condition with delayed responses
      let resolveFirst: (value: any) => void;
      let resolveSecond: (value: any) => void;
      
      const firstPromise = new Promise(resolve => { resolveFirst = resolve; });
      const secondPromise = new Promise(resolve => { resolveSecond = resolve; });
      
      mockApiClient.get
        .mockReturnValueOnce(firstPromise)
        .mockReturnValueOnce(secondPromise);
      
      // Start both requests
      const firstFetch = result.current.fetchItems();
      const secondFetch = result.current.fetchItems();
      
      // Resolve second request first
      resolveSecond({ data: [mockItem] });
      await act(async () => await secondFetch);
      
      // Then resolve first request
      resolveFirst({ data: mockItems });
      await act(async () => await firstFetch);
      
      // Should use the latest response
      expect(result.current.items).toHaveLength(mockItems.length);
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: STATE MUTATIONS
  // ====================================

  describe('🔴🟢🔄 State Mutations', () => {
    it('🔴 RED: should fail to track state mutations initially', () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      const initialState = result.current;
      
      act(() => {
        result.current.setLoading(true);
      });
      
      // Should not mutate original state
      expect(initialState.isLoading).toBe(false);
      expect(result.current.isLoading).toBe(true);
    });

    it('🟢 GREEN: should handle state mutations immutably', () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      act(() => {
        result.current.setLoading(true);
      });
      
      expect(result.current.isLoading).toBe(true);
      
      act(() => {
        result.current.setError('Test error');
      });
      
      expect(result.current.isLoading).toBe(true); // Should preserve previous state
      expect(result.current.error).toBe('Test error');
    });

    it('🔄 REFACTOR: should ensure state integrity with Immer', () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      // Get initial reference
      const initialItems = result.current.items;
      
      act(() => {
        // This should create a new array reference due to Immer
        result.current.setLoading(true);
      });
      
      // References should be different (immutable update)
      expect(result.current.items).toBe(initialItems); // Same reference since items didn't change
      
      // But loading should be updated
      expect(result.current.isLoading).toBe(true);
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: STORE PERSISTENCE (if applicable)
  // ====================================

  describe('🔴🟢🔄 Store Persistence', () => {
    it('🔴 RED: should fail to persist state initially', () => {
      // This section applies if you have persistence middleware
      // const { result } = renderHook(() => use[STORE_NAME]Store());
      
      // Test persistence logic here
    });

    it('🟢 GREEN: should persist critical state', () => {
      // Test persistence implementation
    });

    it('🔄 REFACTOR: should handle persistence errors gracefully', () => {
      // Test error handling in persistence
    });
  });

  // ====================================
  // INTEGRATION TESTING
  // ====================================

  describe('🔗 Store Integration', () => {
    it('should integrate with TanStack Query', async () => {
      // Test integration with React Query if applicable
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      // Mock query client integration
      await act(async () => {
        await result.current.fetchItems();
      });
      
      expect(result.current.items).toHaveLength(mockItems.length);
    });

    it('should integrate with other stores', () => {
      // Test inter-store communication if applicable
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      // Test store integration logic
      expect(result.current).toBeDefined();
    });
  });

  // ====================================
  // PERFORMANCE TESTING
  // ====================================

  describe('🚀 Performance', () => {
    it('should handle large datasets efficiently', () => {
      const largeDataset = BookingTestBuilder.create().buildMany(1000);
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      const start = performance.now();
      
      act(() => {
        result.current.setItems?.(largeDataset); // Add this method if needed
      });
      
      const end = performance.now();
      
      expect(end - start).toBeLessThan(TDD_CONSTANTS.TIMEOUTS.MEDIUM);
    });

    it('should debounce frequent updates', async () => {
      const { result } = renderHook(() => use[STORE_NAME]Store());
      
      // Test debouncing logic if implemented
      const updates = Array.from({ length: 10 }, (_, i) => ({
        guestName: `Guest ${i}`,
      }));
      
      updates.forEach(update => {
        act(() => {
          result.current.setFilters?.(update);
        });
      });
      
      // Should only trigger final update
      expect(result.current.filters?.guestName).toBe('Guest 9');
    });
  });
});

// ====================================
// HELPER FUNCTIONS FOR STORE TESTING
// ====================================

/**
 * Helper to wait for async store operations
 */
async function waitForStoreOperation(storeFn: () => Promise<void>) {
  await act(async () => {
    await storeFn();
  });
}

/**
 * Helper to mock API responses for different scenarios
 */
function mockApiResponses(scenario: 'success' | 'error' | 'loading') {
  switch (scenario) {
    case 'success':
      mockApiClient.get.mockResolvedValue({ data: mockItems });
      mockApiClient.post.mockResolvedValue({ data: mockItem });
      mockApiClient.patch.mockResolvedValue({ data: mockItem });
      mockApiClient.delete.mockResolvedValue({});
      break;
    
    case 'error':
      mockApiClient.get.mockRejectedValue(new Error('API Error'));
      mockApiClient.post.mockRejectedValue(new Error('API Error'));
      mockApiClient.patch.mockRejectedValue(new Error('API Error'));
      mockApiClient.delete.mockRejectedValue(new Error('API Error'));
      break;
    
    case 'loading':
      mockApiClient.get.mockImplementation(() => new Promise(() => {})); // Never resolves
      mockApiClient.post.mockImplementation(() => new Promise(() => {}));
      mockApiClient.patch.mockImplementation(() => new Promise(() => {}));
      mockApiClient.delete.mockImplementation(() => new Promise(() => {}));
      break;
  }
}

/**
 * Helper to create store with initial state
 */
function createStoreWithState(initialState: Partial<[STORE_NAME]State>) {
  // Implementation depends on your store structure
  return use[STORE_NAME]Store;
}

// ====================================
// TDD CHECKLIST FOR STORE IMPLEMENTATION
// ====================================

/**
 * TDD IMPLEMENTATION CHECKLIST FOR ZUSTAND STORES:
 * 
 * 🔴 RED PHASE:
 * □ Write failing test for initial state structure
 * □ Write failing test for each action (fetch, create, update, delete)
 * □ Write failing test for state mutations
 * □ Write failing test for error handling
 * □ Write failing test for async operations
 * 
 * 🟢 GREEN PHASE:
 * □ Implement minimal store structure with required state
 * □ Implement basic actions that make tests pass
 * □ Add minimal error handling
 * □ Add basic async operation handling
 * □ Ensure all tests pass with minimal implementation
 * 
 * 🔄 REFACTOR PHASE:
 * □ Add comprehensive TypeScript types
 * □ Implement Immer middleware for immutable updates
 * □ Add devtools integration
 * □ Implement optimistic updates
 * □ Add proper error handling and rollback logic
 * □ Add Philippine-specific business rule validations
 * □ Add performance optimizations (debouncing, memoization)
 * □ Add integration with TanStack Query if needed
 * □ Add proper loading and error state management
 * □ Add state persistence if required
 * 
 * QUALITY GATES:
 * □ All tests passing
 * □ TypeScript compilation successful
 * □ No console errors or warnings
 * □ Performance within acceptable limits
 * □ Code coverage > 80%
 * □ Store properly integrated with components
 * □ Devtools working correctly
 */