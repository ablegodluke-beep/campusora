import { randomBytes } from "node:crypto";

export default async function handler(req, res) {
res.setHeader("Cache-Control", "no-store");

if (req.method !== "POST") {
return res.status(405).json({
success: false,
error: "Method not allowed."
});
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAYSTACK_KEY = process.env.PAYSTACK_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !PAYSTACK_KEY) {
return res.status(500).json({
success: false,
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
    success: false,
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
    success: false,
    error: "Your login session is invalid."
  });
}

const user = await authResponse.json();

if (!user.id || !user.email) {
  return res.status(400).json({
    success: false,
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

if (
  typeof recipientId !== "string" ||
  !validUUID.test(recipientId)
) {
  return res.status(400).json({
    success: false,
    error: "Invalid recipient profile."
  });
}

if (recipientId === user.id) {
  return res.status(400).json({
    success: false,
    error: "You cannot send a gift to yourself."
  });
}

if (
  typeof giftId !== "string" ||
  !validGiftIds.includes(giftId)
) {
  return res.status(400).json({
    success: false,
    error: "Please select a valid gift."
  });
}

// Retrieve the official price from the gift catalog.
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
  console.error(
    "Gift catalog lookup failed:",
    await giftResponse.text()
  );

  return res.status(500).json({
    success: false,
    error: "Could not load the selected gift."
  });
}

const gifts = await giftResponse.json();
const gift = gifts[0];

if (!gift) {
  return res.status(400).json({
    success: false,
    error: "This gift is currently unavailable."
  });
}

const expectedPrices = {
  rose: 500,
  love: 500,
  golden_star: 1000,
  diamond: 1500,
  royal_crown: 2000,
  premium_heart: 5000
};

const expectedPrice = expectedPrices[gift.id];

if (
  !expectedPrice ||
  Number(gift.price_ngn) !== expectedPrice ||
  Number(gift.amount_kobo) !== expectedPrice * 100
) {
  console.error("Gift catalog price mismatch:", gift.id);

  return res.status(500).json({
    success: false,
    error: "The gift price could not be validated."
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
    success: false,
    error: "Could not verify the recipient profile."
  });
}

const recipients = await recipientResponse.json();

if (!recipients.length) {
  return res.status(404).json({
    success: false,
    error: "Recipient profile not found."
  });
}

// Generate a secure, unique Paystack reference.
const reference = `CGIFT_${randomBytes(16).toString("hex")}`;

// Create the pending gift payment record.
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
    "Gift payment record creation failed:",
    await paymentResponse.text()
  );

  return res.status(500).json({
    success: false,
    error: "Could not prepare your gift purchase."
  });
}

const paymentRecords = await paymentResponse.json();
const paymentRecord = paymentRecords[0];

if (!paymentRecord?.id) {
  return res.status(500).json({
    success: false,
    error: "Could not create the gift payment record."
  });
}

// Set the Paystack callback to the recipient's profile.
const callbackURL = new URL(
  "https://campusora-sigma.vercel.app/profile.html"
);

callbackURL.searchParams.set("id", recipientId);
callbackURL.searchParams.set("gift_payment", "1");

// Initialize Paystack using the server-verified price.
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
      amount: Number(gift.amount_kobo),
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

  // Mark the failed checkout attempt.
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
    success: false,
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
  success: false,
  error: "An unexpected gift payment error occurred."
});

}
}
