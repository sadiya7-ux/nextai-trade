import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertRow } from "@/components/market/StockRow";
import { useNotifications } from "@/lib/app-state";

export default function Notifications() {
  const { alerts, unreadCount, markRead, markAllRead, remove } = useNotifications();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Notifications</h2>
          <p className="text-sm text-muted-foreground">
            AI alerts and market updates. {unreadCount > 0 ? `${unreadCount} unread.` : "All caught up."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
            <CheckCheck className="size-3.5" /> Mark all read
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4 text-gold" /> Alert center
          </CardTitle>
          <CardDescription>Generated locally by the NextTrade AI agent (mock).</CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="mx-auto size-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">No notifications. New AI alerts will land here.</p>
            </div>
          ) : (
            alerts.map((a) => (
              <AlertRow
                key={a.id}
                alert={a}
                actions={
                  <>
                    {!a.read && (
                      <Button variant="ghost" size="icon-sm" aria-label="Mark as read" onClick={() => markRead(a.id)}>
                        <CheckCheck className="size-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon-sm" aria-label="Delete notification" onClick={() => remove(a.id)}>
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  </>
                }
              />
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-xs leading-5 text-muted-foreground">
        Browser push notifications are not enabled in this version — the notification layer is structured so a
        push provider can be added later without UI changes.
      </p>
    </div>
  );
}
