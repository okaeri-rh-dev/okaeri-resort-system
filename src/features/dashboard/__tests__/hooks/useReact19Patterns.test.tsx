import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { Suspense, useOptimistic, useActionState, startTransition } from "react";

// Use existing test utilities
import { DashboardTestProvider } from "../../../../../tests/utils/dashboard-providers";
import { DashboardMockDataGenerator } from "../../../../../tests/utils/dashboard-mocks";

// These components/hooks don't exist yet - RED phase of TDD
import { DashboardWithOptimistic } from "../../../components/DashboardWithOptimistic";
import { useOptimisticBooking } from "../../../hooks/useOptimisticBooking";
import { useActionStateForm } from "../../../hooks/useActionStateForm";
import { useDeferredMetrics } from "../../../hooks/useDeferredMetrics";

describe("React 19 Patterns - useOptimistic, useActionState, Concurrent Features", () => {
  const mockGenerator = new DashboardMockDataGenerator();
  const user = userEvent.setup();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("useOptimistic Hook Pattern (7 tests)", () => {
    it("should apply optimistic updates immediately", async () => {
      const TestComponent = () => {
        const [bookings, setBookings] = React.useState([
          { id: "1", guest: "Juan", status: "pending" },
        ]);

        const [optimisticBookings, addOptimisticBooking] = useOptimistic(
          bookings,
          (state, newBooking) => [...state, newBooking]
        );

        const handleAddBooking = async () => {
          const newBooking = { id: "2", guest: "Maria", status: "pending" };

          startTransition(() => {
            addOptimisticBooking(newBooking);
          });

          // Simulate API call
          await new Promise((resolve) => setTimeout(resolve, 1000));
          setBookings((prev) => [...prev, { ...newBooking, status: "confirmed" }]);
        };

        return (
          <div>
            {optimisticBookings.map((booking) => (
              <div key={booking.id} data-testid={`booking-${booking.id}`}>
                {booking.guest} - {booking.status}
              </div>
            ))}
            <button onClick={handleAddBooking}>Add Booking</button>
          </div>
        );
      };

      render(
        <DashboardTestProvider>
          <TestComponent />
        </DashboardTestProvider>
      );

      expect(screen.getAllByTestId(/booking-/)).toHaveLength(1);

      await user.click(screen.getByRole("button", { name: "Add Booking" }));

      // Optimistic update should be immediate
      expect(screen.getAllByTestId(/booking-/)).toHaveLength(2);
      expect(screen.getByTestId("booking-2")).toHaveTextContent("Maria - pending");

      // Wait for actual update
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByTestId("booking-2")).toHaveTextContent("Maria - confirmed");
      });
    });

    it("should rollback optimistic updates on error", async () => {
      const TestComponent = () => {
        const [bookings, setBookings] = React.useState([{ id: "1", guest: "Pedro", room: "101" }]);

        const [optimisticBookings, addOptimistic] = useOptimistic(bookings, (state, newBooking) => [
          ...state,
          newBooking,
        ]);

        const handleAdd = async () => {
          const newBooking = { id: "2", guest: "Ana", room: "102" };

          startTransition(() => {
            addOptimistic(newBooking);
          });

          // Simulate API failure
          await new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Server error")), 500)
          ).catch(() => {
            // Rollback by not updating state
          });
        };

        return (
          <div>
            <div data-testid="booking-count">{optimisticBookings.length}</div>
            <button onClick={handleAdd}>Add Booking</button>
          </div>
        );
      };

      render(
        <DashboardTestProvider>
          <TestComponent />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("booking-count")).toHaveTextContent("1");

      await user.click(screen.getByRole("button"));

      // Should show optimistic update
      expect(screen.getByTestId("booking-count")).toHaveTextContent("2");

      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should rollback after error
      await waitFor(() => {
        expect(screen.getByTestId("booking-count")).toHaveTextContent("1");
      });
    });

    it("should handle multiple concurrent optimistic updates", async () => {
      const { result } = renderHook(() => useOptimisticBooking());

      const initialBookings = mockGenerator.createBookingsList(3);

      act(() => {
        result.current.setBookings(initialBookings);
      });

      expect(result.current.optimisticBookings).toHaveLength(3);

      // Add multiple optimistic updates concurrently
      await act(async () => {
        result.current.addOptimisticBooking({
          id: "4",
          guest: "Carlos",
          status: "pending",
        });

        result.current.addOptimisticBooking({
          id: "5",
          guest: "Elena",
          status: "pending",
        });
      });

      expect(result.current.optimisticBookings).toHaveLength(5);
      expect(result.current.pendingCount).toBe(2);
    });

    it("should merge optimistic state with server state", async () => {
      const TestComponent = () => {
        const [serverMetrics, setServerMetrics] = React.useState({
          occupancy: 75,
          revenue: 100000,
        });

        const [optimisticMetrics, updateOptimistic] = useOptimistic(
          serverMetrics,
          (state, updates) => ({ ...state, ...updates })
        );

        const handleUpdate = async (field: string, value: number) => {
          startTransition(() => {
            updateOptimistic({ [field]: value });
          });

          // Simulate server update
          await new Promise((resolve) => setTimeout(resolve, 500));
          setServerMetrics((prev) => ({ ...prev, [field]: value }));
        };

        return (
          <div>
            <div data-testid="occupancy">{optimisticMetrics.occupancy}%</div>
            <div data-testid="revenue">₱{optimisticMetrics.revenue}</div>
            <button onClick={() => handleUpdate("occupancy", 85)}>Update Occupancy</button>
          </div>
        );
      };

      render(<TestComponent />);

      expect(screen.getByTestId("occupancy")).toHaveTextContent("75%");

      await user.click(screen.getByRole("button"));

      // Immediate optimistic update
      expect(screen.getByTestId("occupancy")).toHaveTextContent("85%");

      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Server state merged
      await waitFor(() => {
        expect(screen.getByTestId("occupancy")).toHaveTextContent("85%");
      });
    });

    it("should handle optimistic updates with validation", async () => {
      const TestComponent = () => {
        const [rooms, setRooms] = React.useState([{ id: "101", occupied: false }]);

        const [optimisticRooms, updateRoom] = useOptimistic(rooms, (state, update) => {
          // Validation: can't occupy already occupied room
          const room = state.find((r) => r.id === update.id);
          if (room?.occupied && update.occupied) {
            return state; // No change
          }
          return state.map((r) => (r.id === update.id ? { ...r, ...update } : r));
        });

        return (
          <div>
            {optimisticRooms.map((room) => (
              <div key={room.id} data-testid={`room-${room.id}`}>
                {room.occupied ? "Occupied" : "Available"}
              </div>
            ))}
            <button onClick={() => updateRoom({ id: "101", occupied: true })}>Occupy Room</button>
          </div>
        );
      };

      render(<TestComponent />);

      expect(screen.getByTestId("room-101")).toHaveTextContent("Available");

      await user.click(screen.getByRole("button"));
      expect(screen.getByTestId("room-101")).toHaveTextContent("Occupied");

      // Try to occupy again (should fail validation)
      await user.click(screen.getByRole("button"));
      expect(screen.getByTestId("room-101")).toHaveTextContent("Occupied");
    });

    it("should coordinate optimistic updates with Suspense", async () => {
      const TestComponent = () => {
        const [data, setData] = React.useState(null);
        const [optimisticData, addOptimistic] = useOptimistic(data, (_, newData) => newData);

        const loadData = () => {
          startTransition(() => {
            addOptimistic({ loading: true });
          });

          // Simulate async data loading
          setTimeout(() => {
            setData({ loaded: true, value: "Success" });
          }, 100);
        };

        return (
          <Suspense fallback={<div>Loading...</div>}>
            <div>
              {optimisticData?.loading && <div>Optimistic Loading</div>}
              {optimisticData?.loaded && <div>{optimisticData.value}</div>}
              <button onClick={loadData}>Load Data</button>
            </div>
          </Suspense>
        );
      };

      render(<TestComponent />);

      await user.click(screen.getByRole("button"));

      expect(screen.getByText("Optimistic Loading")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(screen.getByText("Success")).toBeInTheDocument();
      });
    });

    it("should handle optimistic delete operations", async () => {
      const TestComponent = () => {
        const [expenses, setExpenses] = React.useState([
          { id: "1", amount: 5000, description: "Supplies" },
          { id: "2", amount: 3000, description: "Utilities" },
        ]);

        const [optimisticExpenses, deleteOptimistic] = useOptimistic(expenses, (state, deleteId) =>
          state.filter((e) => e.id !== deleteId)
        );

        const handleDelete = async (id: string) => {
          startTransition(() => {
            deleteOptimistic(id);
          });

          // Simulate API call
          await new Promise((resolve) => setTimeout(resolve, 500));
          setExpenses((prev) => prev.filter((e) => e.id !== id));
        };

        return (
          <div>
            <div data-testid="expense-count">{optimisticExpenses.length}</div>
            {optimisticExpenses.map((expense) => (
              <div key={expense.id} data-testid={`expense-${expense.id}`}>
                {expense.description}: ₱{expense.amount}
                <button onClick={() => handleDelete(expense.id)}>Delete</button>
              </div>
            ))}
          </div>
        );
      };

      render(<TestComponent />);

      expect(screen.getByTestId("expense-count")).toHaveTextContent("2");

      const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
      await user.click(deleteButtons[0]);

      // Optimistic deletion
      expect(screen.getByTestId("expense-count")).toHaveTextContent("1");
      expect(screen.queryByTestId("expense-1")).not.toBeInTheDocument();
    });
  });

  describe("useActionState Hook Pattern (7 tests)", () => {
    it("should manage form submission with useActionState", async () => {
      const TestComponent = () => {
        const submitAction = async (prevState: any, formData: FormData) => {
          const guest = formData.get("guest");
          const room = formData.get("room");

          // Simulate API call
          await new Promise((resolve) => setTimeout(resolve, 500));

          return {
            success: true,
            booking: { guest, room, id: Date.now() },
          };
        };

        const [state, formAction] = useActionState(submitAction, {
          success: false,
          booking: null,
        });

        return (
          <form action={formAction}>
            <input name="guest" placeholder="Guest Name" />
            <input name="room" placeholder="Room Number" />
            <button type="submit">Book Room</button>
            {state.success && (
              <div data-testid="success">
                Booked: {state.booking?.guest} in room {state.booking?.room}
              </div>
            )}
          </form>
        );
      };

      render(<TestComponent />);

      await user.type(screen.getByPlaceholderText("Guest Name"), "Roberto");
      await user.type(screen.getByPlaceholderText("Room Number"), "305");
      await user.click(screen.getByRole("button", { name: "Book Room" }));

      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(screen.getByTestId("success")).toHaveTextContent("Booked: Roberto in room 305");
      });
    });

    it("should handle validation in useActionState", async () => {
      const TestComponent = () => {
        const validateAndSubmit = async (prevState: any, formData: FormData) => {
          const amount = formData.get("amount");

          // Validation
          if (!amount || Number(amount) <= 0) {
            return {
              error: "Amount must be greater than 0",
              success: false,
            };
          }

          await new Promise((resolve) => setTimeout(resolve, 300));

          return {
            success: true,
            expense: { amount: Number(amount), id: Date.now() },
          };
        };

        const [state, formAction] = useActionState(validateAndSubmit, {
          error: null,
          success: false,
        });

        return (
          <form action={formAction}>
            <input name="amount" type="number" placeholder="Amount" />
            <button type="submit">Log Expense</button>
            {state.error && (
              <div data-testid="error" role="alert">
                {state.error}
              </div>
            )}
            {state.success && (
              <div data-testid="success">Expense logged: ₱{state.expense?.amount}</div>
            )}
          </form>
        );
      };

      render(<TestComponent />);

      // Submit with invalid amount
      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Amount must be greater than 0");
      });

      // Submit with valid amount
      await user.clear(screen.getByPlaceholderText("Amount"));
      await user.type(screen.getByPlaceholderText("Amount"), "2500");
      await user.click(screen.getByRole("button"));

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByTestId("success")).toHaveTextContent("Expense logged: ₱2500");
      });
    });

    it("should handle progressive enhancement with useActionState", async () => {
      const serverAction = async (formData: FormData) => {
        // This would run on the server
        return { success: true };
      };

      const TestComponent = () => {
        const [state, formAction, isPending] = useActionState(serverAction, { success: false });

        return (
          <form action={formAction}>
            <input name="email" type="email" required />
            <button type="submit" disabled={isPending}>
              {isPending ? "Subscribing..." : "Subscribe"}
            </button>
            {state.success && <div data-testid="success">Subscribed!</div>}
          </form>
        );
      };

      render(<TestComponent />);

      await user.type(screen.getByRole("textbox"), "test@okaeri.ph");

      const button = screen.getByRole("button");
      expect(button).toHaveTextContent("Subscribe");

      await user.click(button);

      // Should show pending state
      expect(button).toHaveTextContent("Subscribing...");
      expect(button).toBeDisabled();
    });

    it("should handle complex state transitions with useActionState", async () => {
      const TestComponent = () => {
        const bookingStateMachine = async (state: any, action: any) => {
          switch (action.type) {
            case "START_BOOKING":
              return { ...state, step: "room_selection", loading: false };
            case "SELECT_ROOM":
              return { ...state, step: "guest_details", room: action.room };
            case "ENTER_DETAILS":
              return { ...state, step: "payment", guest: action.guest };
            case "COMPLETE":
              await new Promise((resolve) => setTimeout(resolve, 500));
              return { ...state, step: "confirmed", booking: action.booking };
            default:
              return state;
          }
        };

        const [state, dispatch] = useActionState(bookingStateMachine, {
          step: "idle",
          loading: false,
        });

        return (
          <div>
            <div data-testid="current-step">{state.step}</div>
            {state.step === "idle" && (
              <button onClick={() => dispatch({ type: "START_BOOKING" })}>Start Booking</button>
            )}
            {state.step === "room_selection" && (
              <button onClick={() => dispatch({ type: "SELECT_ROOM", room: "201" })}>
                Select Room 201
              </button>
            )}
            {state.step === "guest_details" && (
              <button onClick={() => dispatch({ type: "ENTER_DETAILS", guest: "Lisa" })}>
                Enter Guest Details
              </button>
            )}
            {state.step === "payment" && (
              <button onClick={() => dispatch({ type: "COMPLETE", booking: { id: "123" } })}>
                Complete Payment
              </button>
            )}
          </div>
        );
      };

      render(<TestComponent />);

      expect(screen.getByTestId("current-step")).toHaveTextContent("idle");

      // Navigate through state machine
      await user.click(screen.getByRole("button", { name: "Start Booking" }));
      expect(screen.getByTestId("current-step")).toHaveTextContent("room_selection");

      await user.click(screen.getByRole("button", { name: "Select Room 201" }));
      expect(screen.getByTestId("current-step")).toHaveTextContent("guest_details");

      await user.click(screen.getByRole("button", { name: "Enter Guest Details" }));
      expect(screen.getByTestId("current-step")).toHaveTextContent("payment");

      await user.click(screen.getByRole("button", { name: "Complete Payment" }));

      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("confirmed");
      });
    });

    it("should integrate useActionState with optimistic updates", async () => {
      const TestComponent = () => {
        const [expenses, setExpenses] = React.useState<any[]>([]);

        const [optimisticExpenses, addOptimistic] = useOptimistic(expenses, (state, newExpense) => [
          ...state,
          newExpense,
        ]);

        const submitExpense = async (prevState: any, formData: FormData) => {
          const expense = {
            id: Date.now(),
            amount: Number(formData.get("amount")),
            category: formData.get("category"),
          };

          startTransition(() => {
            addOptimistic({ ...expense, pending: true });
          });

          await new Promise((resolve) => setTimeout(resolve, 500));

          setExpenses((prev) => [...prev, expense]);

          return { success: true, expense };
        };

        const [state, formAction] = useActionState(submitExpense, {});

        return (
          <div>
            <form action={formAction}>
              <input name="amount" type="number" placeholder="Amount" />
              <input name="category" placeholder="Category" />
              <button type="submit">Add Expense</button>
            </form>
            <div data-testid="expense-list">
              {optimisticExpenses.map((expense) => (
                <div key={expense.id} data-testid={`expense-${expense.id}`}>
                  ₱{expense.amount} - {expense.category}
                  {expense.pending && " (pending)"}
                </div>
              ))}
            </div>
          </div>
        );
      };

      render(<TestComponent />);

      await user.type(screen.getByPlaceholderText("Amount"), "1500");
      await user.type(screen.getByPlaceholderText("Category"), "Supplies");
      await user.click(screen.getByRole("button"));

      // Should show optimistic update immediately
      expect(screen.getByTestId("expense-list")).toHaveTextContent("₱1500 - Supplies (pending)");

      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should remove pending state
      await waitFor(() => {
        expect(screen.getByTestId("expense-list")).toHaveTextContent("₱1500 - Supplies");
        expect(screen.getByTestId("expense-list")).not.toHaveTextContent("pending");
      });
    });

    it("should handle error states in useActionState", async () => {
      const TestComponent = () => {
        const submitWithError = async (prevState: any, formData: FormData) => {
          const room = formData.get("room");

          // Simulate error for specific room
          if (room === "404") {
            throw new Error("Room not found");
          }

          await new Promise((resolve) => setTimeout(resolve, 300));
          return { success: true, room };
        };

        const [state, formAction] = useActionState(
          async (prev, formData) => {
            try {
              return await submitWithError(prev, formData);
            } catch (error) {
              return { error: error.message, success: false };
            }
          },
          { error: null, success: false }
        );

        return (
          <form action={formAction}>
            <input name="room" placeholder="Room Number" />
            <button type="submit">Check Room</button>
            {state.error && <div data-testid="error">{state.error}</div>}
            {state.success && <div data-testid="success">Room {state.room} available</div>}
          </form>
        );
      };

      render(<TestComponent />);

      // Test error case
      await user.type(screen.getByPlaceholderText("Room Number"), "404");
      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Room not found");
      });

      // Test success case
      await user.clear(screen.getByPlaceholderText("Room Number"));
      await user.type(screen.getByPlaceholderText("Room Number"), "202");
      await user.click(screen.getByRole("button"));

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByTestId("success")).toHaveTextContent("Room 202 available");
      });
    });

    it("should support abort and reset in useActionState", async () => {
      const TestComponent = () => {
        const [abortController, setAbortController] = React.useState<AbortController | null>(null);

        const longRunningAction = async (prevState: any, formData: FormData) => {
          const controller = new AbortController();
          setAbortController(controller);

          try {
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(resolve, 5000);
              controller.signal.addEventListener("abort", () => {
                clearTimeout(timeout);
                reject(new Error("Aborted"));
              });
            });

            return { success: true, data: "Complete" };
          } catch (error) {
            return { success: false, error: error.message };
          }
        };

        const [state, formAction, isPending, reset] = useActionState(longRunningAction, {
          success: false,
          error: null,
        });

        return (
          <div>
            <form action={formAction}>
              <button type="submit" disabled={isPending}>
                Start Long Task
              </button>
            </form>
            {isPending && <button onClick={() => abortController?.abort()}>Abort</button>}
            {state.error && <div data-testid="error">{state.error}</div>}
            {(state.success || state.error) && <button onClick={reset}>Reset</button>}
          </div>
        );
      };

      render(<TestComponent />);

      await user.click(screen.getByRole("button", { name: "Start Long Task" }));

      // Task is pending, abort button should appear
      expect(screen.getByRole("button", { name: "Abort" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Abort" }));

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Aborted");
      });

      // Reset state
      await user.click(screen.getByRole("button", { name: "Reset" }));

      expect(screen.queryByTestId("error")).not.toBeInTheDocument();
    });
  });

  describe("Concurrent Features and Suspense (6 tests)", () => {
    it("should use startTransition for non-urgent updates", async () => {
      const TestComponent = () => {
        const [search, setSearch] = React.useState("");
        const [results, setResults] = React.useState<string[]>([]);
        const [isSearching, setIsSearching] = React.useState(false);

        const handleSearch = (value: string) => {
          setSearch(value); // Urgent update

          startTransition(() => {
            setIsSearching(true);
            // Simulate expensive search
            setTimeout(() => {
              const filtered = ["Room 101", "Room 102", "Room 201"].filter((room) =>
                room.toLowerCase().includes(value.toLowerCase())
              );
              setResults(filtered);
              setIsSearching(false);
            }, 100);
          });
        };

        return (
          <div>
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search rooms"
            />
            <div data-testid="search-status">
              {isSearching ? "Searching..." : `Found ${results.length} rooms`}
            </div>
            {results.map((room) => (
              <div key={room} data-testid={`result-${room}`}>
                {room}
              </div>
            ))}
          </div>
        );
      };

      render(<TestComponent />);

      await user.type(screen.getByPlaceholderText("Search rooms"), "10");

      // Input should update immediately (urgent)
      expect(screen.getByPlaceholderText("Search rooms")).toHaveValue("10");

      // Search should be in transition
      expect(screen.getByTestId("search-status")).toHaveTextContent("Searching...");

      act(() => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(screen.getByTestId("search-status")).toHaveTextContent("Found 2 rooms");
        expect(screen.getByTestId("result-Room 101")).toBeInTheDocument();
        expect(screen.getByTestId("result-Room 102")).toBeInTheDocument();
      });
    });

    it("should implement Suspense boundaries for data fetching", async () => {
      const fetchDashboardData = () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              occupancy: 85,
              revenue: 125000,
              checkIns: 12,
            });
          }, 500);
        });
      };

      const DashboardContent = () => {
        const data = React.use(fetchDashboardData());

        return (
          <div>
            <div data-testid="occupancy">Occupancy: {data.occupancy}%</div>
            <div data-testid="revenue">Revenue: ₱{data.revenue}</div>
            <div data-testid="checkIns">Check-ins: {data.checkIns}</div>
          </div>
        );
      };

      const TestComponent = () => {
        return (
          <Suspense fallback={<div data-testid="loading">Loading dashboard...</div>}>
            <DashboardContent />
          </Suspense>
        );
      };

      render(<TestComponent />);

      // Should show loading state
      expect(screen.getByTestId("loading")).toHaveTextContent("Loading dashboard...");

      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should show data after loading
      await waitFor(() => {
        expect(screen.getByTestId("occupancy")).toHaveTextContent("Occupancy: 85%");
        expect(screen.getByTestId("revenue")).toHaveTextContent("Revenue: ₱125000");
        expect(screen.getByTestId("checkIns")).toHaveTextContent("Check-ins: 12");
      });
    });

    it("should handle error boundaries with Suspense", async () => {
      const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
        const [hasError, setHasError] = React.useState(false);

        React.useEffect(() => {
          const handleError = () => setHasError(true);
          window.addEventListener("error", handleError);
          return () => window.removeEventListener("error", handleError);
        }, []);

        if (hasError) {
          return <div data-testid="error-boundary">Something went wrong</div>;
        }

        return <>{children}</>;
      };

      const FailingComponent = () => {
        throw new Error("Dashboard failed to load");
      };

      const TestComponent = () => {
        return (
          <ErrorBoundary>
            <Suspense fallback={<div>Loading...</div>}>
              <FailingComponent />
            </Suspense>
          </ErrorBoundary>
        );
      };

      render(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId("error-boundary")).toHaveTextContent("Something went wrong");
      });
    });

    it("should use useDeferredValue for expensive computations", async () => {
      const TestComponent = () => {
        const [input, setInput] = React.useState("");
        const deferredInput = React.useDeferredValue(input);

        // Simulate expensive filtering
        const filteredBookings = React.useMemo(() => {
          const bookings = Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            guest: `Guest ${i}`,
            room: `${100 + (i % 50)}`,
          }));

          if (!deferredInput) return bookings.slice(0, 10);

          return bookings
            .filter((b) => b.guest.toLowerCase().includes(deferredInput.toLowerCase()))
            .slice(0, 10);
        }, [deferredInput]);

        return (
          <div>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Filter bookings"
            />
            <div data-testid="filter-status">
              {input !== deferredInput ? "Filtering..." : "Ready"}
            </div>
            <div data-testid="result-count">{filteredBookings.length} results</div>
          </div>
        );
      };

      render(<TestComponent />);

      await user.type(screen.getByPlaceholderText("Filter bookings"), "Guest 10");

      // Input updates immediately but computation is deferred
      expect(screen.getByPlaceholderText("Filter bookings")).toHaveValue("Guest 10");

      await waitFor(() => {
        expect(screen.getByTestId("filter-status")).toHaveTextContent("Ready");
      });
    });

    it("should handle streaming SSR with Suspense", async () => {
      // Simulate server streaming
      const streamData = async function* () {
        yield { type: "metrics", data: { occupancy: 85 } };
        await new Promise((resolve) => setTimeout(resolve, 100));
        yield { type: "bookings", data: { today: 5 } };
        await new Promise((resolve) => setTimeout(resolve, 100));
        yield { type: "revenue", data: { total: 75000 } };
      };

      const StreamingDashboard = () => {
        const [data, setData] = React.useState<any>({});

        React.useEffect(() => {
          const processStream = async () => {
            for await (const chunk of streamData()) {
              setData((prev: any) => ({
                ...prev,
                [chunk.type]: chunk.data,
              }));
            }
          };
          processStream();
        }, []);

        return (
          <div>
            {data.metrics && <div data-testid="metrics">Occupancy: {data.metrics.occupancy}%</div>}
            {data.bookings && <div data-testid="bookings">Bookings: {data.bookings.today}</div>}
            {data.revenue && <div data-testid="revenue">Revenue: ₱{data.revenue.total}</div>}
          </div>
        );
      };

      render(
        <Suspense fallback={<div>Loading...</div>}>
          <StreamingDashboard />
        </Suspense>
      );

      // Data should stream in progressively
      await waitFor(() => {
        expect(screen.getByTestId("metrics")).toBeInTheDocument();
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(screen.getByTestId("bookings")).toBeInTheDocument();
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(screen.getByTestId("revenue")).toBeInTheDocument();
      });
    });

    it("should implement progressive hydration patterns", async () => {
      const HeavyComponent = React.lazy(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                default: () => <div data-testid="heavy">Heavy Component Loaded</div>,
              });
            }, 500);
          })
      );

      const TestComponent = () => {
        const [shouldLoad, setShouldLoad] = React.useState(false);

        return (
          <div>
            <div data-testid="light">Light Content (Hydrated First)</div>
            <button onClick={() => setShouldLoad(true)}>Load Heavy Component</button>
            {shouldLoad && (
              <Suspense
                fallback={<div data-testid="loading-heavy">Loading heavy component...</div>}
              >
                <HeavyComponent />
              </Suspense>
            )}
          </div>
        );
      };

      render(<TestComponent />);

      // Light content should be immediately available
      expect(screen.getByTestId("light")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Load Heavy Component" }));

      // Should show loading state for heavy component
      expect(screen.getByTestId("loading-heavy")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Heavy component should load
      await waitFor(() => {
        expect(screen.getByTestId("heavy")).toHaveTextContent("Heavy Component Loaded");
      });
    });
  });
});
