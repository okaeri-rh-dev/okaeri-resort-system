import { Card } from "@/components/ui/card";
import { Users, Plus, Mail, Phone, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TeamPage() {
  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage your team members and their permissions
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Team Member
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-start space-x-4">
            <div className="bg-primary/10 rounded-full p-3">
              <Users className="text-primary h-6 w-6" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="font-semibold">John Doe</h3>
              <p className="text-muted-foreground text-sm">Property Manager</p>
              <div className="space-y-1 pt-2">
                <div className="flex items-center text-sm">
                  <Mail className="mr-2 h-3 w-3" />
                  john.doe@example.com
                </div>
                <div className="flex items-center text-sm">
                  <Phone className="mr-2 h-3 w-3" />
                  +1 234 567 8900
                </div>
              </div>
              <div className="pt-2">
                <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                  <Shield className="mr-1 h-3 w-3" />
                  Full Access
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start space-x-4">
            <div className="bg-primary/10 rounded-full p-3">
              <Users className="text-primary h-6 w-6" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="font-semibold">Jane Smith</h3>
              <p className="text-muted-foreground text-sm">Receptionist</p>
              <div className="space-y-1 pt-2">
                <div className="flex items-center text-sm">
                  <Mail className="mr-2 h-3 w-3" />
                  jane.smith@example.com
                </div>
                <div className="flex items-center text-sm">
                  <Phone className="mr-2 h-3 w-3" />
                  +1 234 567 8901
                </div>
              </div>
              <div className="pt-2">
                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                  <Shield className="mr-1 h-3 w-3" />
                  Limited Access
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start space-x-4">
            <div className="bg-primary/10 rounded-full p-3">
              <Users className="text-primary h-6 w-6" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="font-semibold">Mike Johnson</h3>
              <p className="text-muted-foreground text-sm">Maintenance</p>
              <div className="space-y-1 pt-2">
                <div className="flex items-center text-sm">
                  <Mail className="mr-2 h-3 w-3" />
                  mike.j@example.com
                </div>
                <div className="flex items-center text-sm">
                  <Phone className="mr-2 h-3 w-3" />
                  +1 234 567 8902
                </div>
              </div>
              <div className="pt-2">
                <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700">
                  <Shield className="mr-1 h-3 w-3" />
                  View Only
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-6">
          <h2 className="mb-4 text-xl font-semibold">Permission Overview</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center space-x-3">
                <Shield className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">Full Access</p>
                  <p className="text-muted-foreground text-sm">
                    Complete control over all resort operations
                  </p>
                </div>
              </div>
              <span className="text-sm font-medium">1 member</span>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center space-x-3">
                <Shield className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium">Limited Access</p>
                  <p className="text-muted-foreground text-sm">
                    Can manage bookings and guest information
                  </p>
                </div>
              </div>
              <span className="text-sm font-medium">1 member</span>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center space-x-3">
                <Shield className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium">View Only</p>
                  <p className="text-muted-foreground text-sm">
                    Can view data but cannot make changes
                  </p>
                </div>
              </div>
              <span className="text-sm font-medium">1 member</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
