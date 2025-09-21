import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function App() {
  return (
    <div className="bg-background min-h-screen p-8">
      <div className="container mx-auto max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Welcome to Your React App</CardTitle>
            <CardDescription>
              A clean starter with React, TypeScript, Tailwind CSS v4, and shadcn/ui components
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              This is a barebones setup with just the essentials. All UI components from shadcn/ui
              are preserved in the components/ui directory.
            </p>
            <div className="flex gap-4">
              <Button>Get Started</Button>
              <Button variant="outline">Learn More</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default App;
