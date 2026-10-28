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

    // Verify the logged-in user.
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

    if (!user.id || !user.email) {
      return res.status(400).json({
        error: "Your account email is unavailable."
      });
    }

    // Accept only plans defined by the server.
    const planType = req.body?.plan_type;

    const plans = {
      permanent: {
        amount: 1000000,
        label: "Permanent Premium"
      },
      monthly: {
        amount: 200000,
        label: "Monthly Premium"
      }
    };

    const plan = plans[planType];

    if (!plan) {
      return res.status(400).json({
        error: "Please select a valid Premium plan."
      });
    }

    // Check whether this user already has active Premium.
    const existingResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/premium_memberships` +
      `?user_id=eq.${encodeURIComponent(user.id)}` +
      `&status=eq.active` +
      `&payment_verified=eq.true` +
      `&select=plan_type,expires_at`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!existingResponse.ok) {
      return res.status(500).json({
        error: "Could not check your current membership."
      });
    }

    const existingMemberships = await existingResponse.json();

    const hasActivePremium = existingMemberships.some(member => {
      if (member.plan_type === "permanent") {
        return true;
      }

      return (
        member.plan_type === "monthly" &&
        member.expires_at &&
        new Date(member.expires_at).getTime() > Date.now()
      );
    });

    if (hasActivePremium) {
      return res.status(409).json({
        error: "You already have active Premium."
      });
    }

    // Create a unique reference before initializing checkout.
    const reference =
      `premium_${user.id}_${Date.now()}`;

    // Create a pending membership record.
    const membershipResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/premium_memberships`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          user_id: user.id,
          plan_type: planType,
          amount_kobo: plan.amount,
          payment_reference: reference,
          payment_verified: false,
          status: "pending"
        })
      }
    );

    if (!membershipResponse.ok) {
      console.error(
        "Membership creation failed:",
        await membershipResponse.text()
      );

      return res.status(500).json({
        error: "Could not prepare your Premium purchase."
      });
    }

    const memberships = await membershipResponse.json();
    const membership = memberships[0];

    if (!membership?.id) {
      return res.status(500).json({
        error: "Could not create the membership record."
      });
    }

    // Initialize payment using the server-controlled price.
    const paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: user.email,
          amount: plan.amount,
          currency: "NGN",
          reference,
          callback_url:
            "https://campusora-sigma.vercel.app/profile.html",
          metadata: {
            purpose: "campusora_premium",
            membership_id: membership.id,
            user_id: user.id,
            plan_type: planType
          }
        })
      }
    );

    const payment = await paystackResponse.json();

    if (
      !paystackResponse.ok ||
      !payment.status ||
      !payment.data?.authorization_url
    ) {
      console.error(
        "Premium checkout initialization failed:",
        payment
      );

      // Mark the unsuccessful checkout as cancelled.
      await fetch(
        `${SUPABASE_URL}/rest/v1/premium_memberships` +
        `?id=eq.${encodeURIComponent(membership.id)}` +
        `&user_id=eq.${encodeURIComponent(user.id)}` +
        `&status=eq.pending`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            status: "cancelled",
            updated_at: new Date().toISOString()
          })
        }
      );

      return res.status(502).json({
        error: "Could not start Premium checkout. Please try again."
      });
    }

    return res.status(200).json({
      success: true,
      authorization_url: payment.data.authorization_url,
      reference,
      plan_type: planType
    });

  } catch (error) {
    console.error("Premium initialization error:", error);

    return res.status(500).json({
      error: "An unexpected payment error occurred."
    });
  }
        }
