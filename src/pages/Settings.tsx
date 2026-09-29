import { useNavigate } from "react-router";
import { useState } from "react";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/local-auth";
import { useSettings } from "@/lib/app-state";
import { useTheme } from "@/hooks/use-theme";

function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-4 last:border-0">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} />
    </div>
  );
}

export default function Settings() {
  const { user, signOut, updateProfile } = useAuth();
  const { settings, update } = useSettings();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? "");
  const [saved, setSaved] = useState(false);

  const handleSaveProfile = () => {
    updateProfile({ name: name.trim() || user?.name });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const initials = (user?.name ?? "N T")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">Profile, notifications, AI agent and appearance.</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your public display inside NextTrade.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="text-base font-semibold text-black" style={{ backgroundColor: user?.avatarColor ?? "#E9BC3F" }}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="settings-name">Name</Label>
                <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-email">Email</Label>
                <Input id="settings-email" value={user?.email ?? ""} disabled />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={handleSaveProfile}>Save profile</Button>
            {saved && <span className="text-sm text-up">Saved.</span>}
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Choose which alert categories reach your notification center.</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <ToggleRow
            title="AI alerts"
            description="Unusual moves, volume spikes and momentum signals from the agent."
            checked={settings.alertsAI}
            onCheckedChange={(v) => update({ alertsAI: v })}
          />
          <ToggleRow
            title="Price alerts"
            description="Volume-driven and price-level notifications for watched stocks."
            checked={settings.alertsPrice}
            onCheckedChange={(v) => update({ alertsPrice: v })}
          />
          <ToggleRow
            title="Market alerts"
            description="Broad-market notes such as rising volatility."
            checked={settings.alertsMarket}
            onCheckedChange={(v) => update({ alertsMarket: v })}
          />
        </CardContent>
      </Card>

      {/* AI Agent */}
      <Card>
        <CardHeader>
          <CardTitle>AI Agent</CardTitle>
          <CardDescription>Control monitoring behaviour and alert sensitivity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <ToggleRow
            title="Enable AI monitoring"
            description="Run the agent against the monitored stock list every few seconds."
            checked={settings.agentEnabled}
            onCheckedChange={(v) => update({ agentEnabled: v })}
          />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Alert sensitivity</p>
              <p className="text-xs text-muted-foreground">Higher sensitivity fires more alerts on smaller moves.</p>
            </div>
            <Tabs value={settings.sensitivity} onValueChange={(v) => update({ sensitivity: v as typeof settings.sensitivity })}>
              <TabsList>
                <TabsTrigger value="low">Low</TabsTrigger>
                <TabsTrigger value="medium">Medium</TabsTrigger>
                <TabsTrigger value="high">High</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Dark mode is the default NextTrade experience.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {theme === "dark" ? <Moon className="size-4 text-gold" /> : <Sun className="size-4 text-gold" />}
              <div>
                <p className="text-sm font-medium">{theme === "dark" ? "Dark mode" : "Light mode"}</p>
                <p className="text-xs text-muted-foreground"><Monitor className="mr-1 inline size-3" />Applies instantly across the app.</p>
              </div>
            </div>
            <Tabs value={theme} onValueChange={(v) => setTheme(v as "dark" | "light")}>
              <TabsList>
                <TabsTrigger value="dark" className="gap-1.5"><Moon className="size-3.5" /> Dark</TabsTrigger>
                <TabsTrigger value="light" className="gap-1.5"><Sun className="size-3.5" /> Light</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Sign out of this device. Your mock data stays on this browser.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="border-down/40 text-down hover:bg-down/10 hover:text-down"
            onClick={async () => {
              signOut();
              navigate("/", { replace: true });
            }}
          >
            <LogOut className="size-4" /> Log out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
