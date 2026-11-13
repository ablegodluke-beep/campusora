import { createHmac, createHash } from "crypto";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    LIVEKIT_URL,
    LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET
  } = process.env;

  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
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

    const authResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
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

    const conversationId = req.body?.conversation_id;
    const invitationId = req.body?.call_invitation_id;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
      !uuidPattern.test(conversationId || "") ||
      !uuidPattern.test(invitationId || "")
    ) {
      return res.status(400).json({
        error: "Invalid call request."
      });
    }

    const headers = {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    };

    // Only participants in an accepted invitation can join.
    const invitationResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/call_invitations` +
      `?id=eq.${encodeURIComponent(invitationId)}` +
      `&conversation_id=eq.${encodeURIComponent(conversationId)}` +
      `&status=eq.accepted` +
      `&select=id,conversation_id,caller_id,receiver_id,status` +
      `&limit=1`,
      { headers }
    );

    if (!invitationResponse.ok) {
      return res.status(500).json({
        error: "Could not verify the call invitation."
      });
    }

    const invitations = await invitationResponse.json();
    const invitation = invitations[0];

    if (!invitation) {
      return res.status(403).json({
        error: "This call has not been accepted."
      });
    }

    if (
      user.id !== invitation.caller_id &&
      user.id !== invitation.receiver_id
    ) {
      return res.status(403).json({
        error: "You are not part of this call."
      });
    }

    // Confirm that the user still belongs to the conversation.
    const membershipResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/conversation_members` +
      `?conversation_id=eq.${encodeURIComponent(conversationId)}` +
      `&user_id=eq.${encodeURIComponent(user.id)}` +
      `&select=user_id&limit=1`,
      { headers }
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

    // Each invitation receives its own private LiveKit room.
    const roomHash = createHash("sha256")
      .update(invitationId)
      .digest("hex")
      .slice(0, 32);

    const roomName = `campusora-call-${roomHash}`;

    const now = Math.floor(Date.now() / 1000);

    const payload = {
      iss: LIVEKIT_API_KEY,
      sub: user.id,
      nbf: now - 5,
      exp: now + 3600,
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
      room_name: roomName,
      call_invitation_id: invitationId
    });

  } catch (error) {
    console.error("LiveKit token error:", error);

    return res.status(500).json({
      error: "Could not prepare your call."
    });
  }
}
