import webpush from "web-push";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  const action = req.query?.action ||
    new URL(req.url, "https://campusora-sigma.vercel.app").searchParams.get("action");

  if (action === "subscribe") {
    return handleSubscribe(req, res);
  }

  if (action === "send") {
    return handleSend(req, res);
  }

  if (action === "class-reminder") {
    return handleClassReminder(req, res);
  }

  return res.status(400).json({
    error: "Invalid push action."
  });
}


/* DEVICE REGISTRATION */

async function handleSubscribe(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({
      error: "Push service is not configured."
    });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";

    if (!token) {
      return res.status(401).json({
        error: "Please log in first."
      });
    }

    const authResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!authResponse.ok) {
      return res.status(401).json({
        error: "Your login session is invalid."
      });
    }

    const user = await authResponse.json();
    const subscription = req.body?.subscription;

    if (
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth ||
      !subscription.endpoint.startsWith("https://")
    ) {
      return res.status(400).json({
        error: "Invalid push subscription."
      });
    }

    const saveResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/campusora_push_subscriptions?on_conflict=endpoint`,
      {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          expiration_time: subscription.expirationTime || null,
          updated_at: new Date().toISOString()
        })
      }
    );

    if (!saveResponse.ok) {
      console.error(
        "Push subscription error:",
        await saveResponse.text()
      );

      return res.status(500).json({
        error: "Could not register this device."
      });
    }

    return res.status(200).json({
      success: true,
      message: "This device is registered for Campusora notifications."
    });

  } catch (error) {
    console.error("Push subscription error:", error);

    return res.status(500).json({
      error: "Could not register this device."
    });
  }
}


/* SEND PUSH NOTIFICATIONS */

async function handleSend(req, res) {
  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_SUBJECT,
    PUSH_WEBHOOK_SECRET
  } = process.env;

  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !VAPID_PUBLIC_KEY ||
    !VAPID_PRIVATE_KEY ||
    !VAPID_SUBJECT ||
    !PUSH_WEBHOOK_SECRET
  ) {
    return res.status(500).json({
      error: "Notification service is not configured."
    });
  }

  if (
    req.headers["x-campusora-push-secret"] !==
    PUSH_WEBHOOK_SECRET
  ) {
    return res.status(401).json({
      error: "Unauthorized."
    });
  }

  try {
    const event = req.body || {};
    const type = event.table;
    const record = event.record;

    if (
      event.type !== "INSERT" ||
      !record ||
      !["messages", "call_invitations", "notifications"].includes(type)
    ) {
      return res.status(400).json({
        error: "Invalid notification event."
      });
    }

    const headers = {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    };

    let recipients = [];
    let actorId = null;
    let title = "Campusora";
    let body = "You have a new update.";
    let url = "/notifications.html";

    if (type === "messages") {
      actorId = record.sender_id;

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/conversation_members?conversation_id=eq.${encodeURIComponent(record.conversation_id)}&user_id=neq.${encodeURIComponent(actorId)}&select=user_id`,
        { headers }
      );

      if (!response.ok) {
        throw new Error("Could not find message recipients.");
      }

      recipients = (await response.json()).map(row => row.user_id);
      title = "New message";
      body = "Someone sent you a message.";
      url = "/messages.html";

    } else if (type === "call_invitations") {
      if (record.status !== "ringing") {
        return res.status(200).json({
          success: true,
          skipped: true
        });
      }

      actorId = record.caller_id;
      recipients = [record.receiver_id];
      title = record.call_type === "video"
        ? "Incoming video call"
        : "Incoming voice call";

      body = "Someone is calling you on Campusora.";
      url = "/messages.html";

    } else {
      recipients = [record.recipient_id];
      actorId = record.actor_id;
      title = "Campusora notification";
      body = "You have a new notification.";
      url = "/notifications.html";
    }

    recipients = [...new Set(recipients)].filter(Boolean);

    if (!recipients.length) {
      return res.status(200).json({
        success: true,
        sent: 0
      });
    }

    let actorName = "Someone";

    if (actorId) {
      const profileResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(actorId)}&select=full_name,username&limit=1`,
        { headers }
      );

      if (profileResponse.ok) {
        const profiles = await profileResponse.json();

        if (profiles[0]) {
          actorName =
            profiles[0].full_name ||
            profiles[0].username ||
            "Someone";
        }
      }
    }

    if (type === "messages") {
      body = `${actorName} sent you a message.`;
    }

    if (type === "call_invitations") {
      body = `${actorName} is calling you.`;
    }

    if (type === "notifications") {
      body = `${actorName} interacted with you.`;
    }

    webpush.setVapidDetails(
      VAPID_SUBJECT,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    let sent = 0;

    for (const userId of recipients) {
      const subscriptionsResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/campusora_push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=id,endpoint,p256dh,auth`,
        { headers }
      );

      if (!subscriptionsResponse.ok) continue;

      const subscriptions = await subscriptionsResponse.json();

      for (const sub of subscriptions) {
        const subscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        try {
          await webpush.sendNotification(
            subscription,
            JSON.stringify({
              title,
              body,
              icon: "/icon-192-1.png",
              badge: "/icon-192-1.png",
              tag: `${type}-${record.id || Date.now()}`,
              data: { url }
            })
          );

          sent++;

        } catch (error) {
          if (
            error.statusCode === 404 ||
            error.statusCode === 410
          ) {
            await fetch(
              `${SUPABASE_URL}/rest/v1/campusora_push_subscriptions?id=eq.${encodeURIComponent(sub.id)}`,
              {
                method: "DELETE",
                headers
              }
            );
          } else {
            console.error("Push delivery error:", error);
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      sent
    });

  } catch (error) {
    console.error("Push service error:", error);

    return res.status(500).json({
      error: "Could not send notification."
    });
  }
}


/* SCHEDULED CLASS REMINDERS */

async function handleClassReminder(req, res) {
  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_SUBJECT,
    PUSH_WEBHOOK_SECRET
  } = process.env;

  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !VAPID_PUBLIC_KEY ||
    !VAPID_PRIVATE_KEY ||
    !VAPID_SUBJECT ||
    !PUSH_WEBHOOK_SECRET
  ) {
    return res.status(500).json({
      error: "Push service is not configured."
    });
  }

  if (
    req.headers["x-campusora-push-secret"] !==
    PUSH_WEBHOOK_SECRET
  ) {
    return res.status(401).json({
      error: "Unauthorized."
    });
  }

  const {
    class_key,
    reminder_slot
  } = req.body || {};

  if (
    class_key !== "digital-skills-class-2026-11-22" ||
    !["30_minutes", "class_start"].includes(reminder_slot)
  ) {
    return res.status(400).json({
      error: "Invalid class reminder."
    });
  }

  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
  };

  try {
    const remindersResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/campusora_class_reminders?class_key=eq.${encodeURIComponent(class_key)}&remind_me=eq.true&select=user_id`,
      { headers }
    );

    if (!remindersResponse.ok) {
      throw new Error("Could not load class reminders.");
    }

    const reminders = await remindersResponse.json();

    webpush.setVapidDetails(
      VAPID_SUBJECT,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    let sent = 0;
    let skipped = 0;

    for (const reminder of reminders) {
      const userId = reminder.user_id;

      const subscriptionsResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/campusora_push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=id,endpoint,p256dh,auth`,
        { headers }
      );

      if (!subscriptionsResponse.ok) continue;

      const subscriptions = await subscriptionsResponse.json();

      if (!subscriptions.length) continue;

      const deliveryResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/campusora_class_reminder_deliveries`,
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
            Prefer: "return=minimal"
          },
          body: JSON.stringify({
            user_id: userId,
            class_key,
            reminder_slot
          })
        }
      );

      if (!deliveryResponse.ok) {
        skipped++;
        continue;
      }

      let userSent = 0;

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
              }
            },
            JSON.stringify({
              title: reminder_slot === "30_minutes"
                ? "Campusora class starts in 30 minutes"
                : "Your Campusora class is starting now",

              body: reminder_slot === "30_minutes"
                ? "Get ready! Your free digital skills class starts at 8:00 PM."
                : "It's time! Join your free digital skills class now.",

              icon: "/icon-192-1.png",
              badge: "/icon-192-1.png",

              tag: `campusora-class-${reminder_slot}`,

              data: {
                url: "/home-feed.html"
              }
            })
          );

          userSent++;
          sent++;

        } catch (error) {
          console.error("Class reminder delivery error:", error);

          if (
            error.statusCode === 404 ||
            error.statusCode === 410
          ) {
            await fetch(
              `${SUPABASE_URL}/rest/v1/campusora_push_subscriptions?id=eq.${encodeURIComponent(sub.id)}`,
              {
                method: "DELETE",
                headers
              }
            );
          }
        }
      }

      if (userSent === 0) {
        await fetch(
          `${SUPABASE_URL}/rest/v1/campusora_class_reminder_deliveries?user_id=eq.${encodeURIComponent(userId)}&class_key=eq.${encodeURIComponent(class_key)}&reminder_slot=eq.${encodeURIComponent(reminder_slot)}`,
          {
            method: "DELETE",
            headers
          }
        );
      }
    }

    return res.status(200).json({
      success: true,
      sent,
      skipped
    });

  } catch (error) {
    console.error("Scheduled class reminder error:", error);

    return res.status(500).json({
      error: "Could not send class reminders."
    });
  }
}
