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
      error: "Gift payment service is not configured."
    });
  }

  try {
    // Verify the logged-in user.
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";

    if (!token) {
      return res.status(401).json({
        error: "Please log in before sending a gift."
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

    if (!user.id || !user.email) {
      return res.status(400).json({
        error: "Your account email is unavailable."
      });
    }

    // Validate the recipient and selected gift.
    const recipientId = req.body?.recipient_id;
    const giftId = req.body?.gift_id;

    const validUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const validGiftIds = [
      "rose",
      "love",
      "golden_star",
      "diamond",
      "royal_crown",
      "premium_heart"
    ];

    if (!validUUID.test(recipientId || "")) {
      return res.status(400).json({
        error: "Invalid recipient profile."
      });
    }

    if (recipientId === user.id) {
      return res.status(400).json({
        error: "You cannot send a gift to yourself."
      });
    }

    if (!validGiftIds.includes(giftId)) {
      return res.status(400).json({
        error: "Please select a valid gift."
      });
    }

    // Get the official gift price from Supabase.
    const giftResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/campusora_gift_catalog` +
      `?id=eq.${encodeURIComponent(giftId)}` +
      `&active=eq.true` +
      `&select=id,name,price_ngn,amount_kobo`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!giftResponse.ok) {
      return res.status(500).json({
        error: "Could not load the selected gift."
      });
    }

    const gifts = await giftResponse.json();
    const gift = gifts[0];

    if (!gift) {
      return res.status(400).json({
        error: "This gift is currently unavailable."
      });
    }

    // Confirm that the recipient exists.
    const recipientResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles` +
      `?id=eq.${encodeURIComponent(recipientId)}` +
      `&select=id`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!recipientResponse.ok) {
      return res.status(500).json({
        error: "Could not verify the recipient profile."
      });
    }

    const recipients = await recipientResponse.json();

    if (!recipients.length) {
      return res.status(404).json({
        error: "Recipient profile not found."
      });
    }

    // Generate a unique payment reference.
    const randomPart = cryptoRandomId();

    const reference = `CGIFT_${randomPart}`;

    // Create a pending payment record.
    const paymentResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/campusora_gift_payments`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          sender_id: user.id,
          recipient_id: recipientId,
          gift_id: gift.id,
          amount_kobo: gift.amount_kobo,
          currency: "NGN",
          paystack_reference: reference,
          status: "pending"
        })
      }
    );

    if (!paymentResponse.ok) {
      console.error(
        "Gift record creation failed:",
        await paymentResponse.text()
      );

      return res.status(500).json({
        error: "Could not prepare your gift purchase."
      });
    }

    const paymentRecords = await paymentResponse.json();
    const paymentRecord = paymentRecords[0];

    if (!paymentRecord?.id) {
      return res.status(500).json({
        error: "Could not create the gift payment record."
      });
    }

    // Initialize Paystack checkout.
    const callbackURL = new URL(
      "https://campusora-sigma.vercel.app/profile.html"
    );

    callbackURL.searchParams.set("id", recipientId);
    callbackURL.searchParams.set("gift_payment", "1");

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
          amount: gift.amount_kobo,
          currency: "NGN",
          reference,
          callback_url: callbackURL.toString(),
          metadata: {
            purpose: "campusora_gift",
            payment_id: paymentRecord.id,
            sender_id: user.id,
            recipient_id: recipientId,
            gift_id: gift.id
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
        "Gift checkout initialization failed:",
        payment
      );

      await fetch(
        `${SUPABASE_URL}/rest/v1/campusora_gift_payments` +
        `?id=eq.${encodeURIComponent(paymentRecord.id)}` +
        `&status=eq.pending`,
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
        error: "Could not start gift payment. Please try again."
      });
    }

    return res.status(200).json({
      success: true,
      authorization_url: payment.data.authorization_url,
      reference,
      gift: {
        id: gift.id,
        name: gift.name,
        price_ngn: gift.price_ngn
      }
    });

  } catch (error) {
    console.error("Gift initialization error:", error);

    return res.status(500).json({
      error: "An unexpected gift payment error occurred."
    });
  }
}

function cryptoRandomId() {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(16)),
    byte => byte.toString(16).padStart(2, "0")
  ).join("");
}
