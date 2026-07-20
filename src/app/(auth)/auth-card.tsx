import { Card, CardContent } from "@/components/ui/card";
import { AuthTabs } from "./auth-tabs";

export function AuthCard({
  active,
  children,
}: {
  active: "login" | "register";
  children: React.ReactNode;
}) {
  return (
    <Card className="border-none bg-card/45 shadow-2xl shadow-black/40 backdrop-blur-xl">
      <CardContent className="flex flex-col gap-6 px-6 py-8 sm:px-8 sm:py-10">
        <span className="font-heading text-xl font-medium tracking-tight text-foreground">
          Story Tide
        </span>
        <AuthTabs active={active} />
        {children}
      </CardContent>
    </Card>
  );
}
