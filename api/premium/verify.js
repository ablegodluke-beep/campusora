export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const PAYSTACK_KEY = process.env.PAYSTACK_SECRET_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY || !PAYSTACK_KEY) {
    return res.status(500).json({
      error: "Payment service is not configured."
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

    // Authenticate the user.
    const authResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey: SUPABASE_KEY,
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
    const reference = req.body?.reference;

    if (
      typeof reference !== "string" ||
      !/^premium_[A-Za-z0-9_-]+_\d+$/.test(reference)
    ) {
      return res.status(400).json({
        error: "Invalid Premium payment reference."
      });
    }

    // Find the pending membership belonging to this user.
    const membershipResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/premium_memberships` +
      `?user_id=eq.${encodeURIComponent(user.id)}` +
      `&payment_reference=eq.${encodeURIComponent(reference)}` +
      `&select=id,user_id,plan_type,amount_kobo,payment_reference,payment_verified,status,starts_at,expires_at`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!membershipResponse.ok) {
      console.error(
        "Membership lookup failed:",
        await membershipResponse.text()
      );

      return res.status(500).json({
        error: "Could not check your Premium membership."
      });
    }

    const memberships = await membershipResponse.json();
    const membership = memberships[0];

    if (!membership) {
      return res.status(404).json({
        error: "Premium membership not found."
      });
    }

    // Repeated verification must not activate a cancelled membership.
    if (membership.status === "cancelled") {
      return res.status(409).json({
        error: "This Premium checkout was cancelled."
      });
    }

    // Handle an already verified payment safely.
    if (membership.payment_verified === true) {
      const stillActive =
        membership.status === "active" &&
        (
          membership.plan_type === "permanent" ||
          (
            membership.expires_at &&
            new Date(membership.expires_at).getTime() > Date.now()
          )
        );

      return res.status(200).json({
        success: true,
        active: stillActive,
        plan_type: membership.plan_type,
        expires_at: membership.expires_at,
        message: stillActive
          ? "Your Premium membership is already active."
          : "This payment was already verified, but the membership is not currently active."
      });
    }

    if (membership.status !== "pending") {
      return res.status(409).json({
        error: "This membership is not awaiting payment verification."
      });
    }

    const prices = {
      permanent: 1000000,
      monthly: 200000
    };

    const expectedAmount = prices[membership.plan_type];

    if (
      !expectedAmount ||
      Number(membership.amount_kobo) !== expectedAmount
    ) {
      return res.status(400).json({
        error: "The Premium price could not be validated."
      });
    }

    // Ask Paystack directly whether the transaction succeeded.
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_KEY}`
        }
      }
    );

    const payment = await paystackResponse.json();
    const transaction = payment.data;

    if (
      !paystackResponse.ok ||
      !payment.status ||
      transaction?.status !== "success" ||
      transaction?.reference !== reference ||
      transaction?.currency !== "NGN" ||
      Number(transaction?.amount) !== expectedAmount
    ) {
      return res.status(400).json({
        success: false,
        error: "Paystack has not confirmed this Premium payment."
      });
    }

    // Match the verified transaction to this user and membership.
    const metadata = transaction.metadata || {};

    if (
      metadata.purpose !== "campusora_premium" ||
      String(metadata.membership_id || "") !== String(membership.id) ||
      String(metadata.user_id || "") !== String(user.id) ||
      metadata.plan_type !== membership.plan_type
    ) {
      return res.status(400).json({
        success: false,
        error: "The payment details do not match this membership."
      });
    }

    const startsAt = new Date();

    // Monthly Premium lasts 30 days from activation.
    // Permanent Premium has no expiry date.
    const expiresAt =
      membership.plan_type === "monthly"
        ? new Date(
            startsAt.getTime() + 30 * 24 * 60 * 60 * 1000
          ).toISOString()
        : null;

    // Activate only the matching pending membership.
    const updateResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/premium_memberships` +
      `?id=eq.${encodeURIComponent(membership.id)}` +
      `&user_id=eq.${encodeURIComponent(user.id)}` +
      `&payment_reference=eq.${encodeURIComponent(reference)}` +
      `&payment_verified=eq.false` +
      `&status=eq.pending`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          payment_verified: true,
          status: "active",
          starts_at: startsAt.toISOString(),
          expires_at: expiresAt,
          updated_at: startsAt.toISOString()
        })
      }
    );

    if (!updateResponse.ok) {
      console.error(
        "Premium activation failed:",
        await updateResponse.text()
      );

      return res.status(500).json({
        error: "Payment was verified, but activation failed. Contact support before paying again."
      });
    }

    const updatedMemberships = await updateResponse.json();

    if (updatedMemberships.length !== 1) {
      return res.status(409).json({
        error: "The membership was not activated. Please contact support before paying again."
      });
    }

    return res.status(200).json({
      success: true,
      active: true,
      plan_type: membership.plan_type,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt,
      message: "Your Campusora Premium membership is now active!"
    });

  } catch (error) {
    console.error("Premium verification error:", error);

    return res.status(500).json({
      error: "An unexpected verification error occurred."
    });
  }
      }
