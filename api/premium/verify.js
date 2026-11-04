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

  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json"
  };

  // Automatically resend all saved pending messages.
  async function resendPendingMessages(userId) {
    let resent = 0;
    let alreadySent = 0;
    let failed = 0;
    let batches = 0;

    while (batches < 100) {
      batches++;

      const pendingResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/campusora_pending_messages` +
        `?user_id=eq.${encodeURIComponent(userId)}` +
        `&sent_at=is.null` +
        `&select=id` +
        `&order=created_at.asc` +
        `&limit=100`,
        { headers }
      );

      if (!pendingResponse.ok) {
        console.error(
          "Pending message lookup failed:",
          await pendingResponse.text()
        );

        return {
          resent,
          already_sent: alreadySent,
          failed: failed + 1
        };
      }

      const pendingMessages = await pendingResponse.json();

      if (!pendingMessages.length) {
        break;
      }

      let successfulInBatch = 0;

      for (const pending of pendingMessages) {
        const resendResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/rpc/campusora_resend_pending_message`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              p_pending_id: pending.id,
              p_user_id: userId
            })
          }
        );

        if (!resendResponse.ok) {
          console.error(
            "Pending message resend failed:",
            await resendResponse.text()
          );

          failed++;
          continue;
        }

        const result = await resendResponse.json();

        if (result.success && result.already_sent) {
          alreadySent++;
          successfulInBatch++;
        } else if (result.success) {
          resent++;
          successfulInBatch++;
        } else {
          failed++;
        }
      }

      // Avoid an endless loop if messages cannot be processed.
      if (successfulInBatch === 0) {
        break;
      }
    }

    return {
      resent,
      already_sent: alreadySent,
      failed
    };
  }

  try {
    // Authenticate the user.
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

    if (!user.id) {
      return res.status(401).json({
        error: "Could not identify your account."
      });
    }

    const reference = req.body?.reference;

    if (
      typeof reference !== "string" ||
      !/^premium_[A-Za-z0-9_-]+_\d+$/.test(reference)
    ) {
      return res.status(400).json({
        error: "Invalid Premium payment reference."
      });
    }

    // Find this user's membership.
    const membershipResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/premium_memberships` +
      `?user_id=eq.${encodeURIComponent(user.id)}` +
      `&payment_reference=eq.${encodeURIComponent(reference)}` +
      `&select=id,user_id,plan_type,amount_kobo,payment_reference,payment_verified,status,starts_at,expires_at`,
      { headers }
    );

    if (!membershipResponse.ok) {
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

    if (membership.status === "cancelled") {
      return res.status(409).json({
        error: "This Premium checkout was cancelled."
      });
    }

    // Check the plan price.
    const prices = {
      monthly: 200000,
      permanent: 1000000
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

    // If payment was verified before, check its current validity.
    if (membership.payment_verified === true) {
      const stillActive =
        membership.status === "active" &&
        (
          membership.plan_type === "permanent" ||
          (
            membership.plan_type === "monthly" &&
            membership.expires_at &&
            new Date(membership.expires_at).getTime() > Date.now()
          )
        );

      if (!stillActive) {
        return res.status(409).json({
          error: "Your Premium membership is no longer active."
        });
      }

      const resend = await resendPendingMessages(user.id);

      return res.status(200).json({
        success: true,
        active: true,
        plan_type: membership.plan_type,
        expires_at: membership.expires_at,
        resent_count: resend.resent,
        already_sent_count: resend.already_sent,
        failed_count: resend.failed,
        message: "Your Premium membership is active."
      });
    }

    if (membership.status !== "pending") {
      return res.status(409).json({
        error: "This membership is not awaiting payment verification."
      });
    }

    // Verify payment directly with Paystack.
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

    // Confirm the Paystack transaction belongs to this purchase.
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

    // Calculate the membership period.
    const startsAt = new Date();

    const expiresAt =
      membership.plan_type === "monthly"
        ? new Date(
            startsAt.getTime() + 30 * 24 * 60 * 60 * 1000
          ).toISOString()
        : null;

    // Activate only after successful Paystack verification.
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
          ...headers,
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
        "Membership activation failed:",
        await updateResponse.text()
      );

      return res.status(500).json({
        error: "Payment was verified, but activation failed."
      });
    }

    const updatedMemberships = await updateResponse.json();

    if (updatedMemberships.length !== 1) {
      return res.status(409).json({
        error: "Membership activation could not be confirmed. Please retry verification."
      });
    }

    // Automatically resend pending messages after activation.
    const resend = await resendPendingMessages(user.id);

    return res.status(200).json({
      success: true,
      active: true,
      plan_type: membership.plan_type,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt,
      resent_count: resend.resent,
      already_sent_count: resend.already_sent,
      failed_count: resend.failed,
      message: "Your Premium membership is now active!"
    });

  } catch (error) {
    console.error("Premium verification error:", error);

    return res.status(500).json({
      error: "An unexpected verification error occurred."
    });
  }
}
