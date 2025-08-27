/**
 * SettingsPage Component
 * Comprehensive user settings page with Profile, Security, Preferences, and Account Actions sections
 */

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  User,
  Lock,
  Bell,
  Palette,
  Globe,
  Download,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Save,
  LogOut,
  Shield,
  Clock,
  Calendar,
  Languages,
  Moon,
  Sun,
  Monitor,
  CheckCircle,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/stores/uiStore";
import { useTheme } from "@/stores/uiStore";
import { ErrorBoundary } from "@/components/error-boundary";
import { useAsyncSubmit } from "@/hooks/useAsyncSubmit";
import { retryWithBackoff, simulateApiDelay } from "@/lib/api-utils";
import { mockUserProfile, mockLoginSessions, mockDefaultPreferences } from "@/mocks/settings-data";

// Validation schemas
const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^\+63\d{10}$/, "Invalid Philippine phone number (+63XXXXXXXXXX)"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const preferencesSchema = z.object({
  notifications: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    push: z.boolean(),
    bookings: z.boolean(),
    payments: z.boolean(),
    reports: z.boolean(),
  }),
  theme: z.enum(["light", "dark", "system"]),
  timezone: z.string(),
  language: z.enum(["en", "fil"]),
  dateFormat: z.enum(["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]),
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;
type PreferencesFormData = z.infer<typeof preferencesSchema>;

// Use mock data from fixtures
const mockUser = mockUserProfile;
const mockSessions = mockLoginSessions;

export function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLogoutAllDialog, setShowLogoutAllDialog] = useState(false);

  const toast = useToast();
  const { theme, setTheme } = useTheme();

  // Profile form
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: mockUser,
  });

  // Password form
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Preferences form
  const preferencesForm = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      ...mockDefaultPreferences,
      theme: theme,
    },
  });

  // Profile form submission using retry logic
  const profileSubmit = useAsyncSubmit<ProfileFormData>(
    async (data) => {
      await retryWithBackoff(async () => {
        await simulateApiDelay(800, 1200);
        // Mock API call
      });
    },
    {
      successMessage: "Profile updated successfully",
      errorMessage: "Failed to update profile",
    }
  );

  // Password form submission using retry logic
  const passwordSubmit = useAsyncSubmit<PasswordFormData>(
    async (data) => {
      await retryWithBackoff(async () => {
        await simulateApiDelay(800, 1200);
        // Mock API call
      });
    },
    {
      successMessage: "Password changed successfully",
      errorMessage: "Failed to change password",
      onSuccess: () => passwordForm.reset(),
    }
  );

  // Preferences form submission with proper cleanup
  const preferencesSubmit = useAsyncSubmit<PreferencesFormData>(
    async (data) => {
      return new Promise((resolve, reject) => {
        // Update theme immediately
        setTheme(data.theme);

        const timeoutId = setTimeout(async () => {
          try {
            await retryWithBackoff(async () => {
              await simulateApiDelay(800, 1200);
              // Mock API call
            });
            resolve(undefined);
          } catch (error) {
            reject(error);
          }
        }, 100);

        // Note: cleanup not returned in promise, but timeout is cleared
      });
    },
    {
      successMessage: "Preferences updated successfully",
      errorMessage: "Failed to update preferences",
    }
  );

  const logoutAllSubmit = useAsyncSubmit<void>(
    async () => {
      await retryWithBackoff(async () => {
        await simulateApiDelay(800, 1200);
        // Mock API call
      });
    },
    {
      successMessage: "Logged out from all sessions",
      errorMessage: "Failed to logout from all sessions",
      onSuccess: () => setShowLogoutAllDialog(false),
    }
  );

  const handleLogoutAllSessions = () => logoutAllSubmit.handleSubmit();

  const deleteAccountSubmit = useAsyncSubmit<void>(
    async () => {
      await retryWithBackoff(async () => {
        await simulateApiDelay(1500, 2500);
        // Mock API call
      });
    },
    {
      successMessage: "Account deletion initiated. You will receive a confirmation email.",
      errorMessage: "Failed to delete account",
      onSuccess: () => setShowDeleteDialog(false),
    }
  );

  const handleDeleteAccount = () => deleteAccountSubmit.handleSubmit();

  const exportDataSubmit = useAsyncSubmit<void>(
    async () => {
      await retryWithBackoff(async () => {
        await simulateApiDelay(1500, 2500);
        // Mock API call
      });
    },
    {
      successMessage: "Data export initiated. You will receive an email with the download link.",
      errorMessage: "Failed to export data",
    }
  );

  const handleExportData = () => exportDataSubmit.handleSubmit();

  // Calculate password strength
  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    return strength;
  };

  // Optimize password strength calculation with useMemo
  const watchedPassword = passwordForm.watch("newPassword");
  const passwordStrength = useMemo(
    () => getPasswordStrength(watchedPassword || ""),
    [watchedPassword]
  );
  const strengthLabels = ["Very Weak", "Weak", "Fair", "Good", "Strong"];
  const strengthColors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-blue-500",
    "bg-green-500",
  ];

  return (
    <div className="container mx-auto max-w-4xl p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-foreground text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your account settings and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Preferences</span>
          </TabsTrigger>
          <TabsTrigger value="account" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Account</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <ErrorBoundary level="section" name="ProfileSettings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>Update your account profile information</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={profileForm.handleSubmit(profileSubmit.handleSubmit)}
                  className="space-y-4"
                >
                  {/* Avatar Section */}
                  <div className="flex items-center gap-4 border-b pb-4">
                    <div className="bg-muted flex h-20 w-20 items-center justify-center rounded-full">
                      <User className="text-muted-foreground h-8 w-8" />
                    </div>
                    <div>
                      <Button type="button" variant="outline" size="sm" disabled>
                        Upload Avatar
                      </Button>
                      <p className="text-muted-foreground mt-1 text-sm">Coming soon</p>
                    </div>
                  </div>

                  {/* Profile Fields */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        {...profileForm.register("name")}
                        placeholder="Enter your full name"
                      />
                      {profileForm.formState.errors.name && (
                        <p className="text-sm text-red-500">
                          {profileForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        {...profileForm.register("email")}
                        placeholder="Enter your email address"
                      />
                      {profileForm.formState.errors.email && (
                        <p className="text-sm text-red-500">
                          {profileForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        {...profileForm.register("phone")}
                        placeholder="+639XXXXXXXXX"
                      />
                      {profileForm.formState.errors.phone && (
                        <p className="text-sm text-red-500">
                          {profileForm.formState.errors.phone.message}
                        </p>
                      )}
                      <p className="text-muted-foreground text-sm">
                        Philippine mobile number format
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={profileSubmit.isLoading}>
                      {profileSubmit.isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </ErrorBoundary>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <ErrorBoundary level="section" name="SecuritySettings">
            {/* Change Password */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Change Password
                </CardTitle>
                <CardDescription>Update your password to keep your account secure</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={passwordForm.handleSubmit(passwordSubmit.handleSubmit)}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        {...passwordForm.register("currentPassword")}
                        placeholder="Enter your current password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-1/2 right-2 -translate-y-1/2"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {passwordForm.formState.errors.currentPassword && (
                      <p className="text-sm text-red-500">
                        {passwordForm.formState.errors.currentPassword.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        {...passwordForm.register("newPassword")}
                        placeholder="Enter your new password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-1/2 right-2 -translate-y-1/2"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {passwordForm.formState.errors.newPassword && (
                      <p className="text-sm text-red-500">
                        {passwordForm.formState.errors.newPassword.message}
                      </p>
                    )}

                    {/* Password Strength Indicator */}
                    {passwordForm.watch("newPassword") && (
                      <div className="space-y-2">
                        <div className="flex gap-1">
                          {[...Array(5)].map((_, i) => (
                            <div
                              key={i}
                              className={`h-2 w-full rounded-full ${
                                i < passwordStrength
                                  ? strengthColors[passwordStrength - 1]
                                  : "bg-muted"
                              }`}
                            />
                          ))}
                        </div>
                        <p
                          className={`text-sm ${passwordStrength >= 3 ? "text-green-600" : "text-orange-600"}`}
                        >
                          Password strength: {strengthLabels[passwordStrength - 1] || "Very Weak"}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        {...passwordForm.register("confirmPassword")}
                        placeholder="Confirm your new password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-1/2 right-2 -translate-y-1/2"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {passwordForm.formState.errors.confirmPassword && (
                      <p className="text-sm text-red-500">
                        {passwordForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={passwordSubmit.isLoading}>
                      {passwordSubmit.isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Changing...
                        </>
                      ) : (
                        <>
                          <Lock className="mr-2 h-4 w-4" />
                          Change Password
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Active Sessions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Active Sessions
                </CardTitle>
                <CardDescription>Manage your active login sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
                          <Monitor className="text-muted-foreground h-4 w-4" />
                        </div>
                        <div>
                          <p className="flex items-center gap-2 font-medium">
                            {session.device}
                            {session.current && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">
                                <CheckCircle className="h-3 w-3" />
                                Current
                              </span>
                            )}
                          </p>
                          <p className="text-muted-foreground flex items-center gap-1 text-sm">
                            <Globe className="h-3 w-3" />
                            {session.location} " <Clock className="h-3 w-3" /> {session.lastActive}
                          </p>
                        </div>
                      </div>
                      {!session.current && (
                        <Button variant="outline" size="sm">
                          <LogOut className="mr-1 h-4 w-4" />
                          End Session
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 border-t pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowLogoutAllDialog(true)}
                    className="w-full"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout All Other Sessions
                  </Button>
                </div>
              </CardContent>
            </Card>
          </ErrorBoundary>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <ErrorBoundary level="section" name="PreferencesSettings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Preferences
                </CardTitle>
                <CardDescription>
                  Customize your experience and notification settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={preferencesForm.handleSubmit(preferencesSubmit.handleSubmit)}
                  className="space-y-6"
                >
                  {/* Notification Settings */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Notifications</h3>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Email Notifications</Label>
                          <p className="text-muted-foreground text-sm">
                            Receive notifications via email
                          </p>
                        </div>
                        <Switch {...preferencesForm.register("notifications.email")} />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>SMS Notifications</Label>
                          <p className="text-muted-foreground text-sm">
                            Receive notifications via SMS
                          </p>
                        </div>
                        <Switch {...preferencesForm.register("notifications.sms")} />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Push Notifications</Label>
                          <p className="text-muted-foreground text-sm">
                            Receive browser push notifications
                          </p>
                        </div>
                        <Switch {...preferencesForm.register("notifications.push")} />
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="mb-3 font-medium">Notification Categories</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Booking Updates</Label>
                          <Switch {...preferencesForm.register("notifications.bookings")} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>Payment Notifications</Label>
                          <Switch {...preferencesForm.register("notifications.payments")} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>Report Summaries</Label>
                          <Switch {...preferencesForm.register("notifications.reports")} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Theme Settings */}
                  <div className="space-y-4 border-t pt-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold">
                      <Palette className="h-5 w-5" />
                      Theme
                    </h3>

                    <div className="space-y-2">
                      <Label>Appearance</Label>
                      <Select
                        value={preferencesForm.watch("theme")}
                        onValueChange={(value: "light" | "dark" | "system") =>
                          preferencesForm.setValue("theme", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select theme" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">
                            <div className="flex items-center gap-2">
                              <Sun className="h-4 w-4" />
                              Light
                            </div>
                          </SelectItem>
                          <SelectItem value="dark">
                            <div className="flex items-center gap-2">
                              <Moon className="h-4 w-4" />
                              Dark
                            </div>
                          </SelectItem>
                          <SelectItem value="system">
                            <div className="flex items-center gap-2">
                              <Monitor className="h-4 w-4" />
                              System
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Localization Settings */}
                  <div className="space-y-4 border-t pt-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold">
                      <Globe className="h-5 w-5" />
                      Localization
                    </h3>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Timezone</Label>
                        <Select
                          value={preferencesForm.watch("timezone")}
                          onValueChange={(value) => preferencesForm.setValue("timezone", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Asia/Manila">Asia/Manila (GMT+8)</SelectItem>
                            <SelectItem value="Asia/Singapore">Asia/Singapore (GMT+8)</SelectItem>
                            <SelectItem value="Asia/Hong_Kong">Asia/Hong Kong (GMT+8)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Language</Label>
                        <Select
                          value={preferencesForm.watch("language")}
                          onValueChange={(value: "en" | "fil") =>
                            preferencesForm.setValue("language", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">
                              <div className="flex items-center gap-2">
                                <Languages className="h-4 w-4" />
                                English
                              </div>
                            </SelectItem>
                            <SelectItem value="fil">
                              <div className="flex items-center gap-2">
                                <Languages className="h-4 w-4" />
                                Filipino
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Date Format</Label>
                        <Select
                          value={preferencesForm.watch("dateFormat")}
                          onValueChange={(value: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD") =>
                            preferencesForm.setValue("dateFormat", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select date format" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MM/DD/YYYY">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                MM/DD/YYYY
                              </div>
                            </SelectItem>
                            <SelectItem value="DD/MM/YYYY">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                DD/MM/YYYY
                              </div>
                            </SelectItem>
                            <SelectItem value="YYYY-MM-DD">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                YYYY-MM-DD
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={preferencesSubmit.isLoading}>
                      {preferencesSubmit.isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Preferences
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </ErrorBoundary>
        </TabsContent>

        {/* Account Actions Tab */}
        <TabsContent value="account">
          <ErrorBoundary level="section" name="AccountActions">
            <div className="space-y-4">
              {/* Export Data */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Export Data
                  </CardTitle>
                  <CardDescription>Download a copy of your data</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4 text-sm">
                    Export all your data including bookings, guests, expenses, and account
                    information. You'll receive an email with a download link once the export is
                    ready.
                  </p>
                  <Button
                    onClick={handleExportData}
                    disabled={exportDataSubmit.isLoading}
                    variant="outline"
                  >
                    {exportDataSubmit.isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Preparing Export...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Export My Data
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Delete Account */}
              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <Trash2 className="h-5 w-5" />
                    Delete Account
                  </CardTitle>
                  <CardDescription>
                    Permanently delete your account and all associated data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4 text-sm">
                    This action cannot be undone. All your data including bookings, guests,
                    expenses, and account information will be permanently deleted.
                  </p>
                  <Button
                    onClick={() => setShowDeleteDialog(true)}
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete My Account
                  </Button>
                </CardContent>
              </Card>
            </div>
          </ErrorBoundary>
        </TabsContent>
      </Tabs>

      {/* Logout All Sessions Dialog */}
      <Dialog open={showLogoutAllDialog} onOpenChange={setShowLogoutAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Logout All Sessions</DialogTitle>
            <DialogDescription>
              This will log you out of all devices except this current session. You'll need to login
              again on other devices.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogoutAllDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleLogoutAllSessions} disabled={logoutAllSubmit.isLoading}>
              {logoutAllSubmit.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging out...
                </>
              ) : (
                "Logout All Sessions"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete your account? This action cannot be undone and will
              permanently remove all your data.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-red-50 p-4">
            <p className="text-sm text-red-800">
              <strong>This will delete:</strong>
            </p>
            <ul className="mt-2 list-inside list-disc text-sm text-red-700">
              <li>Your account and profile information</li>
              <li>All booking records and guest data</li>
              <li>Financial reports and expense records</li>
              <li>Project settings and configurations</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDeleteAccount}
              disabled={deleteAccountSubmit.isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteAccountSubmit.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Account
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
