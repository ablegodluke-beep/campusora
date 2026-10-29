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

    // Authenticate the current user.
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
      !/^CAMPUSORA-RANK-\d+-[A-Za-z0-9]+$/.test(reference)
    ) {
      return res.status(400).json({
        error: "Invalid rank payment reference."
      });
    }

    // Find this user's purchase using the unique payment reference.
    const purchaseResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profile_ranks` +
      `?user_id=eq.${encodeURIComponent(user.id)}` +
      `&payment_reference=eq.${encodeURIComponent(reference)}` +
      `&select=id,user_id,rank_type,amount_kobo,payment_reference,payment_verified,status`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!purchaseResponse.ok) {
      console.error(
        "Rank purchase lookup failed:",
        await purchaseResponse.text()
      );

      return res.status(500).json({
        error: "Could not check your rank purchase."
      });
    }

    const purchases = await purchaseResponse.json();
    const purchase = purchases[0];

    if (!purchase) {
      return res.status(404).json({
        error: "Rank purchase not found."
      });
    }

    // A completed purchase must not be activated a second time.
    if (purchase.payment_verified === true) {
      return res.status(200).json({
        success: true,
        active: purchase.status === "active",
        rank_type: purchase.rank_type,
        message: purchase.status === "active"
          ? "Your rank is already active."
          : "This payment was already processed. Your rank is not currently active."
      });
    }

    if (purchase.status !== "pending") {
      return res.status(409).json({
        error: "This rank purchase is not awaiting payment verification."
      });
    }

    // Prices are checked against the server's fixed price list.
    const prices = {
      queen: 200000,
      king: 300000,
      grand_master: 500000
    };

    const expectedAmount = prices[purchase.rank_type];

    if (
      !expectedAmount ||
      Number(purchase.amount_kobo) !== expectedAmount
    ) {
      return res.status(400).json({
        error: "The rank price could not be validated."
      });
    }

    // Verify the transaction directly with Paystack.
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
        error: "Paystack has not confirmed this rank payment."
      });
    }

    // Confirm that the transaction belongs to this purchase and user.
    const metadata = transaction.metadata || {};

    if (
      metadata.purpose !== "campusora_profile_rank" ||
      String(metadata.purchase_id || "") !== String(purchase.id) ||
      String(metadata.user_id || "") !== String(user.id) ||
      metadata.rank_type !== purchase.rank_type
    ) {
      return res.status(400).json({
        success: false,
        error: "The payment details do not match this rank purchase."
      });
    }

    // Mark older active ranks as replaced before activating the new rank.
    // Only verified, active ranks belonging to this user are affected.
    const replaceResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profile_ranks` +
      `?user_id=eq.${encodeURIComponent(user.id)}` +
      `&status=eq.active&payment_verified=eq.true` +
      `&id=neq.${encodeURIComponent(purchase.id)}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: "replaced",
          updated_at: new Date().toISOString()
        })
      }
    );

    if (!replaceResponse.ok) {
      console.error(
        "Could not replace previous rank:",
        await replaceResponse.text()
      );

      return res.status(500).json({
        error: "Payment was verified, but rank activation could not continue. Please contact support before paying again."
      });
    }

    // Activate only this user's matching pending purchase.
    const now = new Date().toISOString();

    const activateResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profile_ranks` +
      `?id=eq.${encodeURIComponent(purchase.id)}` +
      `&user_id=eq.${encodeURIComponent(user.id)}` +
      `&payment_reference=eq.${encodeURIComponent(reference)}` +
      `&payment_verified=eq.false&status=eq.pending`,
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
          updated_at: now
        })
      }
    );

    if (!activateResponse.ok) {
      console.error(
        "Rank activation failed:",
        await activateResponse.text()
      );

      return res.status(500).json({
        error: "Payment was verified, but rank activation failed. Please contact support before paying again."
      });
    }

    const activatedPurchases = await activateResponse.json();

    if (activatedPurchases.length !== 1) {
      return res.status(409).json({
        error: "The rank was not activated. Please contact support before paying again."
      });
    }

    return res.status(200).json({
      success: true,
      active: true,
      rank_type: purchase.rank_type,
      message: "Your Campusora rank is now active!"
    });

  } catch (error) {
    console.error("Rank verification error:", error);

    return res.status(500).json({
      error: "An unexpected rank verification error occurred."
    });
  }
        }
