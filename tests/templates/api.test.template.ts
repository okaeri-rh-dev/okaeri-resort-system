/**
 * TDD API Endpoint Test Template with MSW Integration
 * 
 * This template provides a comprehensive structure for Test-Driven Development
 * of API endpoints in the Okaeri Resort Management System using MSW for mocking.
 * 
 * USAGE:
 * 1. Copy this template to your API endpoint test file
 * 2. Replace [ENDPOINT_NAME] with your actual endpoint name (e.g., bookings, payments)
 * 3. Replace [ENTITY] with your entity type (e.g., Booking, Payment, Expense)
 * 4. Follow the Red-Green-Refactor cycle for each test
 * 5. Update imports, types, and MSW handlers as needed
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

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { 
  BookingTestBuilder,
  PaymentTestBuilder,
  PhilippineDataGenerator,
  TDDWorkflow,
  TDD_CONSTANTS,
} from '@tests/utils/tdd-helpers';
import { apiClient } from '@/lib/api-client';

// ====================================
// IMPORTS - UPDATE THESE FOR YOUR API
// ====================================

// Replace with your actual API types
// import type { 
//   [ENTITY], 
//   Create[ENTITY]Input, 
//   Update[ENTITY]Input,
//   PaginatedResult 
// } from '@/types/database';

// Replace with your actual API client or fetch implementation
// import { api[ENTITY]Client } from '@/api/endpoints/[endpoint]';

// Mock types for initial failing tests
type MockEntity = {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
};

type CreateMockEntityInput = Omit<MockEntity, 'id' | 'createdAt' | 'updatedAt'>;
type UpdateMockEntityInput = Partial<CreateMockEntityInput>;

// ====================================
// MSW HANDLERS SETUP
// ====================================

/**
 * MSW handlers for [ENDPOINT_NAME] API endpoints
 * These provide realistic API responses for testing
 */
const apiBaseUrl = 'http://localhost:3000/api'; // Update with your API base URL
const [endpoint]Handlers = [
  // 🔴 RED: Initially return errors to make tests fail
  
  // GET /api/[endpoint] - List items with pagination
  http.get(`${apiBaseUrl}/[endpoint]`, ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || '';
    
    // 🔴 RED: Initially return error
    return HttpResponse.json(
      { error: 'Not implemented' },
      { status: 501 }
    );
    
    // 🟢 GREEN: Replace with mock data
    // const mockData = BookingTestBuilder.create().buildMany(5);
    // return HttpResponse.json({
    //   data: mockData,
    //   meta: {
    //     total: mockData.length,
    //     page,
    //     limit,
    //     totalPages: Math.ceil(mockData.length / limit),
    //     hasNext: false,
    //     hasPrev: false,
    //   }
    // });
  }),

  // GET /api/[endpoint]/:id - Get single item
  http.get(`${apiBaseUrl}/[endpoint]/:id`, ({ params }) => {
    const { id } = params;
    
    // 🔴 RED: Initially return error
    return HttpResponse.json(
      { error: 'Not implemented' },
      { status: 501 }
    );
    
    // 🟢 GREEN: Replace with mock data
    // const mockData = BookingTestBuilder.create().withDefaults().build();
    // return HttpResponse.json({ data: { ...mockData, id } });
  }),

  // POST /api/[endpoint] - Create new item
  http.post(`${apiBaseUrl}/[endpoint]`, async ({ request }) => {
    const body = await request.json() as CreateMockEntityInput;
    
    // 🔴 RED: Initially return error
    return HttpResponse.json(
      { error: 'Not implemented' },
      { status: 501 }
    );
    
    // 🟢 GREEN: Replace with creation logic
    // const mockData = {
    //   ...body,
    //   id: crypto.randomUUID(),
    //   createdAt: new Date().toISOString(),
    //   updatedAt: new Date().toISOString(),
    // };
    // return HttpResponse.json({ data: mockData }, { status: 201 });
  }),

  // PATCH /api/[endpoint]/:id - Update item
  http.patch(`${apiBaseUrl}/[endpoint]/:id`, async ({ params, request }) => {
    const { id } = params;
    const body = await request.json() as UpdateMockEntityInput;
    
    // 🔴 RED: Initially return error
    return HttpResponse.json(
      { error: 'Not implemented' },
      { status: 501 }
    );
    
    // 🟢 GREEN: Replace with update logic
    // const mockData = BookingTestBuilder.create().withDefaults().build();
    // const updatedData = {
    //   ...mockData,
    //   ...body,
    //   id: id as string,
    //   updatedAt: new Date().toISOString(),
    // };
    // return HttpResponse.json({ data: updatedData });
  }),

  // DELETE /api/[endpoint]/:id - Delete item
  http.delete(`${apiBaseUrl}/[endpoint]/:id`, ({ params }) => {
    const { id } = params;
    
    // 🔴 RED: Initially return error
    return HttpResponse.json(
      { error: 'Not implemented' },
      { status: 501 }
    );
    
    // 🟢 GREEN: Replace with deletion logic
    // return HttpResponse.json({ message: 'Item deleted successfully' });
  }),

  // Error scenarios for testing
  http.get(`${apiBaseUrl}/[endpoint]/error-500`, () => {
    return HttpResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }),

  http.get(`${apiBaseUrl}/[endpoint]/error-timeout`, () => {
    // Simulate timeout by delaying indefinitely
    return new Promise(() => {});
  }),

  http.get(`${apiBaseUrl}/[endpoint]/error-network`, () => {
    return HttpResponse.error();
  }),

  // Rate limiting scenario
  http.post(`${apiBaseUrl}/[endpoint]/rate-limited`, () => {
    return HttpResponse.json(
      { 
        error: 'Too many requests',
        retryAfter: 60 
      },
      { 
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': (Date.now() + 60000).toString(),
        }
      }
    );
  }),
];

// Setup MSW server
const server = setupServer(...[endpoint]Handlers);

// ====================================
// TEST SETUP
// ====================================

describe('[ENDPOINT_NAME] API Endpoints', () => {
  // Test data builders
  let mockEntity: MockEntity;
  let mockEntities: MockEntity[];
  let createInput: CreateMockEntityInput;
  let updateInput: UpdateMockEntityInput;

  beforeAll(() => {
    // Start MSW server before all tests
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    // Clean up MSW server after all tests
    server.close();
  });

  beforeEach(() => {
    // 🔧 SETUP: Reset mocks and create fresh test data
    vi.clearAllMocks();
    
    // Create test data using builders
    const builder = BookingTestBuilder.create().withDefaults(); // Replace with appropriate builder
    mockEntity = {
      ...builder.build(),
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    mockEntities = Array.from({ length: 5 }, () => ({
      ...BookingTestBuilder.create().withDefaults().build(),
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    createInput = builder.build();
    updateInput = { guestName: 'Updated Name' }; // Update with relevant fields
  });

  afterEach(() => {
    // Reset MSW handlers after each test
    server.resetHandlers();
  });

  // ====================================
  // RED-GREEN-REFACTOR: GET ENDPOINTS
  // ====================================

  describe('🔴🟢🔄 GET /api/[endpoint] - List Items', () => {
    it('🔴 RED: should fail to fetch items initially', async () => {
      const tddCycle = TDDWorkflow.createTDDCycle('List Items');
      
      await tddCycle.red('fetches items list', async () => {
        // This should fail initially due to not implemented error
        const response = await fetch(`${apiBaseUrl}/[endpoint]`);
        expect(response.status).toBe(200);
        
        const data = await response.json();
        expect(data.data).toBeInstanceOf(Array);
      });
    });

    it('🟢 GREEN: should fetch items successfully after implementation', async () => {
      // Update MSW handler to return success
      server.use(
        http.get(`${apiBaseUrl}/[endpoint]`, () => {
          return HttpResponse.json({
            data: mockEntities,
            meta: {
              total: mockEntities.length,
              page: 1,
              limit: 20,
              totalPages: 1,
              hasNext: false,
              hasPrev: false,
            }
          });
        })
      );

      const response = await fetch(`${apiBaseUrl}/[endpoint]`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.data).toHaveLength(mockEntities.length);
      expect(data.meta.total).toBe(mockEntities.length);
    });

    it('🔄 REFACTOR: should support pagination parameters', async () => {
      const page = 2;
      const limit = 10;
      
      server.use(
        http.get(`${apiBaseUrl}/[endpoint]`, ({ request }) => {
          const url = new URL(request.url);
          const requestPage = parseInt(url.searchParams.get('page') || '1');
          const requestLimit = parseInt(url.searchParams.get('limit') || '20');
          
          expect(requestPage).toBe(page);
          expect(requestLimit).toBe(limit);
          
          return HttpResponse.json({
            data: mockEntities.slice((page - 1) * limit, page * limit),
            meta: {
              total: 50,
              page: requestPage,
              limit: requestLimit,
              totalPages: 5,
              hasNext: true,
              hasPrev: true,
            }
          });
        })
      );

      const response = await fetch(`${apiBaseUrl}/[endpoint]?page=${page}&limit=${limit}`);
      const data = await response.json();
      
      expect(data.meta.page).toBe(page);
      expect(data.meta.limit).toBe(limit);
      expect(data.meta.hasNext).toBe(true);
      expect(data.meta.hasPrev).toBe(true);
    });

    it('🔄 REFACTOR: should support search and filtering', async () => {
      const searchTerm = 'John Doe';
      const status = 'confirmed';
      
      server.use(
        http.get(`${apiBaseUrl}/[endpoint]`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('search')).toBe(searchTerm);
          expect(url.searchParams.get('status')).toBe(status);
          
          // Filter mock data based on search/filter parameters
          const filteredData = mockEntities.filter(entity => 
            entity.guestName?.includes(searchTerm) && entity.status === status
          );
          
          return HttpResponse.json({
            data: filteredData,
            meta: {
              total: filteredData.length,
              page: 1,
              limit: 20,
              totalPages: 1,
              hasNext: false,
              hasPrev: false,
            }
          });
        })
      );

      const response = await fetch(
        `${apiBaseUrl}/[endpoint]?search=${encodeURIComponent(searchTerm)}&status=${status}`
      );
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.data).toBeInstanceOf(Array);
    });

    it('🔄 REFACTOR: should handle Philippine-specific date filtering', async () => {
      const startDate = '2024-12-01';
      const endDate = '2024-12-31';
      const timezone = 'Asia/Manila';
      
      server.use(
        http.get(`${apiBaseUrl}/[endpoint]`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('startDate')).toBe(startDate);
          expect(url.searchParams.get('endDate')).toBe(endDate);
          expect(url.searchParams.get('timezone')).toBe(timezone);
          
          return HttpResponse.json({
            data: mockEntities,
            meta: { total: mockEntities.length, page: 1, limit: 20, totalPages: 1 }
          });
        })
      );

      const response = await fetch(
        `${apiBaseUrl}/[endpoint]?startDate=${startDate}&endDate=${endDate}&timezone=${timezone}`
      );
      
      expect(response.status).toBe(200);
    });
  });

  describe('🔴🟢🔄 GET /api/[endpoint]/:id - Get Single Item', () => {
    it('🔴 RED: should fail to fetch single item initially', async () => {
      const response = await fetch(`${apiBaseUrl}/[endpoint]/${mockEntity.id}`);
      
      // Should fail with not implemented error
      expect(response.status).toBe(501);
    });

    it('🟢 GREEN: should fetch single item successfully', async () => {
      server.use(
        http.get(`${apiBaseUrl}/[endpoint]/:id`, ({ params }) => {
          return HttpResponse.json({
            data: { ...mockEntity, id: params.id }
          });
        })
      );

      const response = await fetch(`${apiBaseUrl}/[endpoint]/${mockEntity.id}`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.data.id).toBe(mockEntity.id);
    });

    it('🔄 REFACTOR: should handle item not found', async () => {
      const nonExistentId = 'non-existent-id';
      
      server.use(
        http.get(`${apiBaseUrl}/[endpoint]/:id`, ({ params }) => {
          if (params.id === nonExistentId) {
            return HttpResponse.json(
              { error: 'Item not found' },
              { status: 404 }
            );
          }
          return HttpResponse.json({ data: mockEntity });
        })
      );

      const response = await fetch(`${apiBaseUrl}/[endpoint]/${nonExistentId}`);
      
      expect(response.status).toBe(404);
      
      const errorData = await response.json();
      expect(errorData.error).toBe('Item not found');
    });

    it('🔄 REFACTOR: should validate UUID format', async () => {
      const invalidId = 'invalid-id-format';
      
      server.use(
        http.get(`${apiBaseUrl}/[endpoint]/:id`, ({ params }) => {
          // Validate UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          
          if (!uuidRegex.test(params.id as string)) {
            return HttpResponse.json(
              { error: 'Invalid ID format' },
              { status: 400 }
            );
          }
          
          return HttpResponse.json({ data: mockEntity });
        })
      );

      const response = await fetch(`${apiBaseUrl}/[endpoint]/${invalidId}`);
      
      expect(response.status).toBe(400);
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: POST ENDPOINTS
  // ====================================

  describe('🔴🟢🔄 POST /api/[endpoint] - Create Item', () => {
    it('🔴 RED: should fail to create item initially', async () => {
      const response = await fetch(`${apiBaseUrl}/[endpoint]`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createInput),
      });
      
      // Should fail with not implemented error
      expect(response.status).toBe(501);
    });

    it('🟢 GREEN: should create item successfully', async () => {
      server.use(
        http.post(`${apiBaseUrl}/[endpoint]`, async ({ request }) => {
          const body = await request.json() as CreateMockEntityInput;
          
          const createdItem = {
            ...body,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          return HttpResponse.json(
            { data: createdItem },
            { status: 201 }
          );
        })
      );

      const response = await fetch(`${apiBaseUrl}/[endpoint]`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createInput),
      });
      
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.data.id).toBeDefined();
      expect(data.data.createdAt).toBeDefined();
      expect(data.data.guestName).toBe(createInput.guestName);
    });

    it('🔄 REFACTOR: should validate required fields', async () => {
      const invalidInput = { ...createInput };
      delete invalidInput.guestName; // Remove required field
      
      server.use(
        http.post(`${apiBaseUrl}/[endpoint]`, async ({ request }) => {
          const body = await request.json() as Partial<CreateMockEntityInput>;
          
          // Validate required fields
          const requiredFields = ['guestName', 'guestEmail', 'checkInDate', 'checkOutDate'];
          const missingFields = requiredFields.filter(field => !body[field]);
          
          if (missingFields.length > 0) {
            return HttpResponse.json(
              { 
                error: 'Validation failed',
                details: { missingFields }
              },
              { status: 400 }
            );
          }
          
          return HttpResponse.json({ data: body }, { status: 201 });
        })
      );

      const response = await fetch(`${apiBaseUrl}/[endpoint]`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidInput),
      });
      
      expect(response.status).toBe(400);
      
      const errorData = await response.json();
      expect(errorData.error).toBe('Validation failed');
      expect(errorData.details.missingFields).toContain('guestName');
    });

    it('🔄 REFACTOR: should validate Philippine-specific data', async () => {
      const inputWithPhilippineData = {
        ...createInput,
        guestPhone: PhilippineDataGenerator.mobileNumber(),
        guestAddress: PhilippineDataGenerator.address(),
        totalAmount: PhilippineDataGenerator.phpAmount(5000, 25000),
      };
      
      server.use(
        http.post(`${apiBaseUrl}/[endpoint]`, async ({ request }) => {
          const body = await request.json() as any;
          
          // Validate Philippine phone number
          const phoneRegex = /^(\+63|0|63)?[0-9]{10}$/;
          if (body.guestPhone && !phoneRegex.test(body.guestPhone)) {
            return HttpResponse.json(
              { error: 'Invalid Philippine phone number format' },
              { status: 400 }
            );
          }
          
          // Validate PHP amount format
          if (body.totalAmount && !/^\d+(\.\d{1,2})?$/.test(body.totalAmount)) {
            return HttpResponse.json(
              { error: 'Invalid amount format' },
              { status: 400 }
            );
          }
          
          return HttpResponse.json({
            data: {
              ...body,
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          }, { status: 201 });
        })
      );

      const response = await fetch(`${apiBaseUrl}/[endpoint]`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputWithPhilippineData),
      });
      
      expect(response.status).toBe(201);
      
      const data = await response.json();
      expect(data.data.guestPhone).toBeValidPhilippinePhone();
      expect(data.data.totalAmount).toBeValidPhpAmount();
    });

    it('🔄 REFACTOR: should handle duplicate creation attempts', async () => {
      const duplicateEmail = 'duplicate@example.com';
      
      server.use(
        http.post(`${apiBaseUrl}/[endpoint]`, async ({ request }) => {
          const body = await request.json() as CreateMockEntityInput;
          
          if (body.guestEmail === duplicateEmail) {
            return HttpResponse.json(
              { error: 'Guest with this email already has an active booking' },
              { status: 409 }
            );
          }
          
          return HttpResponse.json({
            data: {
              ...body,
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          }, { status: 201 });
        })
      );

      const duplicateInput = { ...createInput, guestEmail: duplicateEmail };
      
      const response = await fetch(`${apiBaseUrl}/[endpoint]`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicateInput),
      });
      
      expect(response.status).toBe(409);
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: PATCH ENDPOINTS
  // ====================================

  describe('🔴🟢🔄 PATCH /api/[endpoint]/:id - Update Item', () => {
    it('🔴 RED: should fail to update item initially', async () => {
      const response = await fetch(`${apiBaseUrl}/[endpoint]/${mockEntity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateInput),
      });
      
      expect(response.status).toBe(501);
    });

    it('🟢 GREEN: should update item successfully', async () => {
      server.use(
        http.patch(`${apiBaseUrl}/[endpoint]/:id`, async ({ params, request }) => {
          const body = await request.json() as UpdateMockEntityInput;
          
          const updatedItem = {
            ...mockEntity,
            ...body,
            id: params.id as string,
            updatedAt: new Date().toISOString(),
          };
          
          return HttpResponse.json({ data: updatedItem });
        })
      );

      const response = await fetch(`${apiBaseUrl}/[endpoint]/${mockEntity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateInput),
      });
      
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.data.id).toBe(mockEntity.id);
      expect(data.data.guestName).toBe(updateInput.guestName);
      expect(new Date(data.data.updatedAt).getTime()).toBeGreaterThan(
        new Date(mockEntity.updatedAt).getTime()
      );
    });

    it('🔄 REFACTOR: should handle partial updates correctly', async () => {
      const partialUpdate = { guestName: 'New Name Only' };
      
      server.use(
        http.patch(`${apiBaseUrl}/[endpoint]/:id`, async ({ params, request }) => {
          const body = await request.json() as Partial<UpdateMockEntityInput>;
          
          // Should only update provided fields
          const updatedItem = {
            ...mockEntity,
            ...body,
            id: params.id as string,
            updatedAt: new Date().toISOString(),
          };
          
          return HttpResponse.json({ data: updatedItem });
        })
      );

      const response = await fetch(`${apiBaseUrl}/[endpoint]/${mockEntity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partialUpdate),
      });
      
      const data = await response.json();
      
      expect(data.data.guestName).toBe(partialUpdate.guestName);
      expect(data.data.guestEmail).toBe(mockEntity.guestEmail); // Should remain unchanged
    });

    it('🔄 REFACTOR: should validate business rules for updates', async () => {
      const invalidUpdate = {
        checkInDate: new Date(Date.now() - 86400000).toISOString(), // Past date
      };
      
      server.use(
        http.patch(`${apiBaseUrl}/[endpoint]/:id`, async ({ params, request }) => {
          const body = await request.json() as UpdateMockEntityInput;
          
          // Business rule: cannot set check-in date in the past
          if (body.checkInDate && new Date(body.checkInDate) < new Date()) {
            return HttpResponse.json(
              { error: 'Check-in date cannot be in the past' },
              { status: 400 }
            );
          }
          
          return HttpResponse.json({ data: mockEntity });
        })
      );

      const response = await fetch(`${apiBaseUrl}/[endpoint]/${mockEntity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidUpdate),
      });
      
      expect(response.status).toBe(400);
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: DELETE ENDPOINTS
  // ====================================

  describe('🔴🟢🔄 DELETE /api/[endpoint]/:id - Delete Item', () => {
    it('🔴 RED: should fail to delete item initially', async () => {
      const response = await fetch(`${apiBaseUrl}/[endpoint]/${mockEntity.id}`, {
        method: 'DELETE',
      });
      
      expect(response.status).toBe(501);
    });

    it('🟢 GREEN: should delete item successfully', async () => {
      server.use(
        http.delete(`${apiBaseUrl}/[endpoint]/:id`, () => {
          return HttpResponse.json(
            { message: 'Item deleted successfully' }
          );
        })
      );

      const response = await fetch(`${apiBaseUrl}/[endpoint]/${mockEntity.id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.message).toBe('Item deleted successfully');
    });

    it('🔄 REFACTOR: should handle soft deletes', async () => {
      server.use(
        http.delete(`${apiBaseUrl}/[endpoint]/:id`, ({ params }) => {
          // Soft delete - mark as deleted instead of removing
          const softDeletedItem = {
            ...mockEntity,
            id: params.id as string,
            deletedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          return HttpResponse.json({
            data: softDeletedItem,
            message: 'Item soft deleted successfully'
          });
        })
      );

      const response = await fetch(`${apiBaseUrl}/[endpoint]/${mockEntity.id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.data.deletedAt).toBeDefined();
    });

    it('🔄 REFACTOR: should prevent deletion with existing references', async () => {
      const itemWithReferences = 'item-with-references';
      
      server.use(
        http.delete(`${apiBaseUrl}/[endpoint]/:id`, ({ params }) => {
          if (params.id === itemWithReferences) {
            return HttpResponse.json(
              { 
                error: 'Cannot delete item with existing references',
                details: { references: ['payments', 'timeline'] }
              },
              { status: 409 }
            );
          }
          
          return HttpResponse.json({ message: 'Item deleted successfully' });
        })
      );

      const response = await fetch(`${apiBaseUrl}/[endpoint]/${itemWithReferences}`, {
        method: 'DELETE',
      });
      
      expect(response.status).toBe(409);
      
      const errorData = await response.json();
      expect(errorData.details.references).toContain('payments');
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: ERROR HANDLING
  // ====================================

  describe('🔴🟢🔄 Error Handling', () => {
    it('🔴 RED: should fail to handle 500 errors initially', async () => {
      const response = await fetch(`${apiBaseUrl}/[endpoint]/error-500`);
      
      expect(response.status).toBe(500);
      
      const errorData = await response.json();
      expect(errorData.error).toBe('Internal server error');
    });

    it('🟢 GREEN: should handle server errors gracefully', async () => {
      const response = await fetch(`${apiBaseUrl}/[endpoint]/error-500`);
      
      expect(response.status).toBe(500);
      
      const errorData = await response.json();
      expect(errorData.error).toBeDefined();
    });

    it('🔄 REFACTOR: should provide structured error responses', async () => {
      server.use(
        http.get(`${apiBaseUrl}/[endpoint]/structured-error`, () => {
          return HttpResponse.json({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: {
              field: 'guestEmail',
              message: 'Invalid email format',
              value: 'invalid-email'
            },
            timestamp: new Date().toISOString(),
            requestId: crypto.randomUUID(),
          }, { status: 400 });
        })
      );

      const response = await fetch(`${apiBaseUrl}/[endpoint]/structured-error`);
      const errorData = await response.json();
      
      expect(response.status).toBe(400);
      expect(errorData.error).toBe('Validation failed');
      expect(errorData.code).toBe('VALIDATION_ERROR');
      expect(errorData.details.field).toBe('guestEmail');
      expect(errorData.timestamp).toBeDefined();
      expect(errorData.requestId).toBeDefined();
    });

    it('🔄 REFACTOR: should handle network errors', async () => {
      let networkError: Error | null = null;
      
      try {
        await fetch(`${apiBaseUrl}/[endpoint]/error-network`);
      } catch (error) {
        networkError = error as Error;
      }
      
      expect(networkError).toBeInstanceOf(Error);
    });

    it('🔄 REFACTOR: should handle timeout errors', async () => {
      const timeoutPromise = fetch(`${apiBaseUrl}/[endpoint]/error-timeout`, {
        signal: AbortSignal.timeout(1000) // 1 second timeout
      });
      
      await expect(timeoutPromise).rejects.toThrow();
    }, TDD_CONSTANTS.TIMEOUTS.MEDIUM);
  });

  // ====================================
  // RED-GREEN-REFACTOR: AUTHENTICATION & AUTHORIZATION
  // ====================================

  describe('🔴🟢🔄 Authentication & Authorization', () => {
    it('🔴 RED: should fail without authentication initially', async () => {
      server.use(
        http.get(`${apiBaseUrl}/[endpoint]/protected`, ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return HttpResponse.json(
              { error: 'Authentication required' },
              { status: 401 }
            );
          }
          
          return HttpResponse.json({ data: mockEntities });
        })
      );

      const response = await fetch(`${apiBaseUrl}/[endpoint]/protected`);
      
      expect(response.status).toBe(401);
    });

    it('🟢 GREEN: should accept valid authentication', async () => {
      const validToken = 'valid-bearer-token';
      
      server.use(
        http.get(`${apiBaseUrl}/[endpoint]/protected`, ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          
          if (authHeader === `Bearer ${validToken}`) {
            return HttpResponse.json({ data: mockEntities });
          }
          
          return HttpResponse.json(
            { error: 'Invalid token' },
            { status: 401 }
          );
        })
      );

      const response = await fetch(`${apiBaseUrl}/[endpoint]/protected`, {
        headers: {
          'Authorization': `Bearer ${validToken}`
        }
      });
      
      expect(response.status).toBe(200);
    });

    it('🔄 REFACTOR: should check user permissions', async () => {
      server.use(
        http.delete(`${apiBaseUrl}/[endpoint]/permission-check/:id`, ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          
          // Mock token payload (in real app, would decode JWT)
          const userRole = 'STAFF'; // Mock role from token
          
          if (userRole !== 'OWNER' && userRole !== 'MANAGER') {
            return HttpResponse.json(
              { error: 'Insufficient permissions for delete operation' },
              { status: 403 }
            );
          }
          
          return HttpResponse.json({ message: 'Deleted successfully' });
        })
      );

      const response = await fetch(`${apiBaseUrl}/[endpoint]/permission-check/${mockEntity.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer staff-token'
        }
      });
      
      expect(response.status).toBe(403);
    });
  });

  // ====================================
  // RED-GREEN-REFACTOR: RATE LIMITING
  // ====================================

  describe('🔴🟢🔄 Rate Limiting', () => {
    it('🔴 RED: should fail to handle rate limits initially', async () => {
      const response = await fetch(`${apiBaseUrl}/[endpoint]/rate-limited`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createInput),
      });
      
      expect(response.status).toBe(429);
    });

    it('🟢 GREEN: should return rate limit headers', async () => {
      const response = await fetch(`${apiBaseUrl}/[endpoint]/rate-limited`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createInput),
      });
      
      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('60');
      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    });

    it('🔄 REFACTOR: should provide rate limit information in response', async () => {
      const response = await fetch(`${apiBaseUrl}/[endpoint]/rate-limited`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createInput),
      });
      
      const errorData = await response.json();
      
      expect(errorData.error).toBe('Too many requests');
      expect(errorData.retryAfter).toBe(60);
      expect(typeof errorData.retryAfter).toBe('number');
    });
  });

  // ====================================
  // INTEGRATION TESTING
  // ====================================

  describe('🔗 API Client Integration', () => {
    it('should work with apiClient wrapper', async () => {
      server.use(
        http.get(`${apiBaseUrl}/[endpoint]`, () => {
          return HttpResponse.json({
            data: mockEntities,
            meta: { total: mockEntities.length }
          });
        })
      );

      // Test with your actual API client
      const response = await apiClient.get('/[endpoint]');
      
      expect(response.data.data).toHaveLength(mockEntities.length);
    });

    it('should handle API client error interceptors', async () => {
      server.use(
        http.get(`${apiBaseUrl}/[endpoint]/client-error`, () => {
          return HttpResponse.json(
            { error: 'Client error test' },
            { status: 400 }
          );
        })
      );

      await expect(apiClient.get('/[endpoint]/client-error')).rejects.toThrow();
    });
  });

  // ====================================
  // PERFORMANCE TESTING
  // ====================================

  describe('🚀 Performance', () => {
    it('should handle large response payloads efficiently', async () => {
      const largeDataset = BookingTestBuilder.create().buildMany(1000);
      
      server.use(
        http.get(`${apiBaseUrl}/[endpoint]/large-dataset`, () => {
          return HttpResponse.json({
            data: largeDataset,
            meta: { total: largeDataset.length }
          });
        })
      );

      const start = performance.now();
      const response = await fetch(`${apiBaseUrl}/[endpoint]/large-dataset`);
      await response.json();
      const end = performance.now();
      
      expect(end - start).toBeLessThan(TDD_CONSTANTS.TIMEOUTS.MEDIUM);
    });

    it('should handle concurrent requests', async () => {
      server.use(
        http.get(`${apiBaseUrl}/[endpoint]/concurrent`, () => {
          return HttpResponse.json({ data: mockEntity });
        })
      );

      const requests = Array.from({ length: 10 }, () =>
        fetch(`${apiBaseUrl}/[endpoint]/concurrent`)
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});

// ====================================
// HELPER FUNCTIONS FOR API TESTING
// ====================================

/**
 * Helper to create authenticated request headers
 */
function createAuthHeaders(token: string = 'valid-token') {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Helper to create Philippine-specific test data
 */
function createPhilippineTestData() {
  return {
    guestName: PhilippineDataGenerator.fullName(),
    guestPhone: PhilippineDataGenerator.mobileNumber(),
    guestAddress: PhilippineDataGenerator.address(),
    totalAmount: PhilippineDataGenerator.phpAmount(5000, 25000),
  };
}

/**
 * Helper to validate API response structure
 */
function validateApiResponse(response: any, expectedFields: string[]) {
  expect(response).toBeDefined();
  expect(response.data).toBeDefined();
  
  expectedFields.forEach(field => {
    expect(response.data[field]).toBeDefined();
  });
}

/**
 * Helper to test pagination response
 */
function validatePaginationResponse(response: any) {
  expect(response.data).toBeInstanceOf(Array);
  expect(response.meta).toBeDefined();
  expect(response.meta.total).toBeTypeOf('number');
  expect(response.meta.page).toBeTypeOf('number');
  expect(response.meta.limit).toBeTypeOf('number');
  expect(response.meta.totalPages).toBeTypeOf('number');
  expect(typeof response.meta.hasNext).toBe('boolean');
  expect(typeof response.meta.hasPrev).toBe('boolean');
}

// ====================================
// TDD CHECKLIST FOR API ENDPOINTS
// ====================================

/**
 * TDD IMPLEMENTATION CHECKLIST FOR API ENDPOINTS:
 * 
 * 🔴 RED PHASE:
 * □ Write failing test for GET endpoint (list)
 * □ Write failing test for GET endpoint (single item)
 * □ Write failing test for POST endpoint (create)
 * □ Write failing test for PATCH endpoint (update)
 * □ Write failing test for DELETE endpoint
 * □ Write failing test for error scenarios
 * □ Write failing test for authentication
 * □ Write failing test for validation
 * 
 * 🟢 GREEN PHASE:
 * □ Implement basic MSW handlers returning success
 * □ Add minimal validation logic
 * □ Add basic error responses
 * □ Add authentication checks
 * □ Ensure all tests pass with minimal implementation
 * 
 * 🔄 REFACTOR PHASE:
 * □ Add comprehensive input validation
 * □ Add Philippine-specific business rules
 * □ Add proper error handling and status codes
 * □ Add request/response logging
 * □ Add rate limiting
 * □ Add proper HTTP caching headers
 * □ Add API documentation/OpenAPI spec
 * □ Add performance optimizations
 * □ Add database transaction handling
 * □ Add audit logging
 * □ Add comprehensive test scenarios
 * 
 * QUALITY GATES:
 * □ All tests passing
 * □ Proper HTTP status codes
 * □ Comprehensive error handling
 * □ Input validation working
 * □ Authentication/authorization working  
 * □ Rate limiting functional
 * □ Performance within acceptable limits
 * □ API documentation complete
 * □ Security best practices implemented
 */