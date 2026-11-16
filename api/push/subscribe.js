export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

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
