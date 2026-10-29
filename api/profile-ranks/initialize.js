export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY;
    const PAYSTACK_SECRET_KEY =
      process.env.PAYSTACK_SECRET_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY || !PAYSTACK_SECRET_KEY) {
      return res.status(500).json({
        error: "Payment service is not configured."
      });
    }

    // Authenticate the user
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";

    if (!token) {
      return res.status(401).json({
        error: "Please sign in first."
      });
    }

    const userResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!userResponse.ok) {
      return res.status(401).json({
        error: "Your session is invalid. Please sign in again."
      });
    }

    const user = await userResponse.json();

    if (!user.id || !user.email) {
      return res.status(400).json({
        error: "Your account email could not be verified."
      });
    }

    // Prices are controlled by the server.
    const plans = {
      queen: {
        name: "Queen",
        amount: 200000
      },
      king: {
        name: "King",
        amount: 300000
      },
      grand_master: {
        name: "Grand Master",
        amount: 500000
      }
    };

    const rankType = req.body?.rank_type;
    const plan = plans[rankType];

    if (!plan) {
      return res.status(400).json({
        error: "Please select a valid rank."
      });
    }

    // Generate a unique reference before creating the payment.
    const reference =
      `CAMPUSORA-RANK-${Date.now()}-` +
      Math.random().toString(36).slice(2, 10);

    // Create a pending purchase.
    const insertResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profile_ranks`,
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
          rank_type: rankType,
          amount_kobo: plan.amount,
          payment_reference: reference,
          payment_verified: false,
          status: "pending"
        })
      }
    );

    const insertData = await insertResponse.json();

    if (!insertResponse.ok) {
      console.error("Rank purchase insert failed:", insertData);

      return res.status(500).json({
        error: "Could not create your rank purchase. Please try again."
      });
    }

    const purchase = Array.isArray(insertData)
      ? insertData[0]
      : null;

    if (!purchase?.id) {
      return res.status(500).json({
        error: "Could not confirm your rank purchase."
      });
    }

    // Initialize payment with Paystack.
    const paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: user.email,
          amount: plan.amount,
          reference,
          callback_url:
            "https://campusora-sigma.vercel.app/profile-ranks.html",
          metadata: {
            purpose: "campusora_profile_rank",
            purchase_id: purchase.id,
            user_id: user.id,
            rank_type: rankType
          }
        })
      }
    );

    const paystackData = await paystackResponse.json();

    if (!paystackResponse.ok || !paystackData.status) {
      console.error("Paystack initialization failed:", paystackData);

      // Keep the failed initialization from becoming an active rank.
      await fetch(
        `${SUPABASE_URL}/rest/v1/profile_ranks?id=eq.${encodeURIComponent(purchase.id)}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            status: "failed"
          })
        }
      );

      return res.status(502).json({
        error: "Paystack could not start the payment. Please try again."
      });
    }

    return res.status(200).json({
      authorization_url: paystackData.data.authorization_url,
      reference: paystackData.data.reference
    });

  } catch (error) {
    console.error("Rank initialization error:", error);

    return res.status(500).json({
      error: "Something went wrong while starting your payment."
    });
  }
            }
