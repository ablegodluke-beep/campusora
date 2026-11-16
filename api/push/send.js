import webpush from "web-push";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

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

  if (req.headers["x-campusora-push-secret"] !== PUSH_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  try {
    const { type, record } = req.body || {};

    if (!record || !["messages", "call_invitations", "notifications"].includes(type)) {
      return res.status(400).json({ error: "Invalid notification event." });
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

      if (!response.ok) throw new Error("Could not find message recipients.");

      recipients = (await response.json()).map(row => row.user_id);
      title = "New message";
      body = "Someone sent you a message.";
      url = "/messages.html";

    } else if (type === "call_invitations") {
      if (record.status !== "ringing") {
        return res.status(200).json({ success: true, skipped: true });
      }

      actorId = record.caller_id;
      recipients = [record.receiver_id];
      title = record.call_type === "video" ? "Incoming video call" : "Incoming voice call";
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
      return res.status(200).json({ success: true, sent: 0 });
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
          actorName = profiles[0].full_name || profiles[0].username || "Someone";
        }
      }
    }

    if (type === "messages") body = `${actorName} sent you a message.`;
    if (type === "call_invitations") body = `${actorName} is calling you.`;
    if (type === "notifications") body = `${actorName} interacted with you.`;

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
          if (error.statusCode === 404 || error.statusCode === 410) {
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
