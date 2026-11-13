import { createHmac, createHash } from "crypto";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const LIVEKIT_URL = process.env.LIVEKIT_URL;
  const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
  const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

  if (
    !SUPABASE_URL ||
    !SUPABASE_KEY ||
    !LIVEKIT_URL ||
    !LIVEKIT_API_KEY ||
    !LIVEKIT_API_SECRET
  ) {
    return res.status(500).json({
      error: "Calling service is not configured."
    });
  }

  try {
    const authHeader = req.headers.authorization || "";

    const userToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";

    if (!userToken) {
      return res.status(401).json({
        error: "Please log in first."
      });
    }

    // Verify the logged-in Campusora user.
    const authResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${userToken}`
        }
      }
    );

    if (!authResponse.ok) {
      return res.status(401).json({
        error: "Your login session is invalid."
      });
    }

    const user = await authResponse.json();

    if (!user.id) {
      return res.status(401).json({
        error: "Could not identify your account."
      });
    }

    const conversationId = req.body?.conversation_id;

    if (
      typeof conversationId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId)
    ) {
      return res.status(400).json({
        error: "Invalid conversation."
      });
    }

    // Confirm that this user belongs to the conversation.
    const membershipResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/conversation_members` +
      `?conversation_id=eq.${encodeURIComponent(conversationId)}` +
      `&user_id=eq.${encodeURIComponent(user.id)}` +
      `&select=user_id&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!membershipResponse.ok) {
      return res.status(500).json({
        error: "Could not verify conversation access."
      });
    }

    const memberships = await membershipResponse.json();

    if (!memberships.length) {
      return res.status(403).json({
        error: "You are not a member of this conversation."
      });
    }

    // Create a private room name without exposing the conversation ID.
    const roomHash = createHash("sha256")
      .update(conversationId)
      .digest("hex")
      .slice(0, 32);

    const roomName = `campusora-${roomHash}`;

    // Generate a short-lived LiveKit access token.
    const now = Math.floor(Date.now() / 1000);

    const payload = {
      iss: LIVEKIT_API_KEY,
      sub: user.id,
      nbf: now - 5,
      exp: now + 600,

      video: {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true
      }
    };

    const encode = value =>
      Buffer.from(JSON.stringify(value)).toString("base64url");

    const unsignedToken =
      `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}`;

    const signature = createHmac(
      "sha256",
      LIVEKIT_API_SECRET
    )
      .update(unsignedToken)
      .digest("base64url");

    const participantToken =
      `${unsignedToken}.${signature}`;

    return res.status(200).json({
      success: true,
      server_url: LIVEKIT_URL,
      participant_token: participantToken,
      room_name: roomName
    });

  } catch (error) {
    console.error("LiveKit token error:", error);

    return res.status(500).json({
      error: "Could not prepare your call."
    });
  }
}
