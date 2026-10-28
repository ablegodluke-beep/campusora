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
// Authenticate the logged-in sender.
const authHeader = req.headers.authorization || "";
const token = authHeader.startsWith("Bearer ")
? authHeader.slice(7)
: "";

if (!token) {
  return res.status(401).json({
    success: false,
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
    success: false,
    error: "Your login session is invalid."
  });
}

const user = await authResponse.json();

if (!user.id) {
  return res.status(401).json({
    success: false,
    error: "Could not identify your account."
  });
}

const reference = req.body?.reference;

if (
  typeof reference !== "string" ||
  !/^CGIFT_[a-f0-9]{32}$/.test(reference)
) {
  return res.status(400).json({
    success: false,
    error: "Invalid gift payment reference."
  });
}

// Find the payment belonging to this sender.
const paymentResponse = await fetch(
  `${SUPABASE_URL}/rest/v1/campusora_gift_payments` +
  `?paystack_reference=eq.${encodeURIComponent(reference)}` +
  `&sender_id=eq.${encodeURIComponent(user.id)}` +
  `&select=id,sender_id,recipient_id,gift_id,amount_kobo,currency,status,paystack_reference`,
  {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  }
);

if (!paymentResponse.ok) {
  console.error(
    "Gift payment lookup failed:",
    await paymentResponse.text()
  );

  return res.status(500).json({
    success: false,
    error: "Could not check the gift payment."
  });
}

const payments = await paymentResponse.json();
const giftPayment = payments[0];

if (!giftPayment) {
  return res.status(404).json({
    success: false,
    error: "Gift payment not found for this account."
  });
}

if (giftPayment.status === "failed") {
  return res.status(409).json({
    success: false,
    error: "This gift payment has been marked as failed."
  });
}

// Validate the gift against the official catalog.
const catalogResponse = await fetch(
  `${SUPABASE_URL}/rest/v1/campusora_gift_catalog` +
  `?id=eq.${encodeURIComponent(giftPayment.gift_id)}` +
  `&select=id,name,price_ngn,amount_kobo,active`,
  {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  }
);

if (!catalogResponse.ok) {
  console.error(
    "Gift catalog lookup failed:",
    await catalogResponse.text()
  );

  return res.status(500).json({
    success: false,
    error: "Could not validate the selected gift."
  });
}

const catalogItems = await catalogResponse.json();
const catalogGift = catalogItems[0];

const expectedPrices = {
  rose: 500,
  love: 500,
  golden_star: 1000,
  diamond: 1500,
  royal_crown: 2000,
  premium_heart: 5000
};

const expectedPrice = expectedPrices[giftPayment.gift_id];

if (
  !catalogGift ||
  !expectedPrice ||
  Number(catalogGift.price_ngn) !== expectedPrice ||
  Number(catalogGift.amount_kobo) !== expectedPrice * 100 ||
  Number(giftPayment.amount_kobo) !== expectedPrice * 100 ||
  giftPayment.currency !== "NGN"
) {
  return res.status(400).json({
    success: false,
    error: "The gift price or payment currency could not be validated."
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

const paystackResult = await paystackResponse.json();
const transaction = paystackResult.data;

if (
  !paystackResponse.ok ||
  !paystackResult.status ||
  transaction?.status !== "success" ||
  transaction?.reference !== reference ||
  transaction?.currency !== "NGN" ||
  Number(transaction?.amount) !== Number(giftPayment.amount_kobo)
) {
  return res.status(400).json({
    success: false,
    error: "Paystack has not confirmed this gift payment."
  });
}

// Match the transaction metadata to the stored payment.
const metadata = transaction.metadata || {};

if (
  metadata.purpose !== "campusora_gift" ||
  String(metadata.payment_id || "") !== String(giftPayment.id) ||
  String(metadata.sender_id || "") !== String(giftPayment.sender_id) ||
  String(metadata.recipient_id || "") !== String(giftPayment.recipient_id) ||
  String(metadata.gift_id || "") !== String(giftPayment.gift_id)
) {
  return res.status(400).json({
    success: false,
    error: "The verified payment does not match this gift."
  });
}

// Finalize payment and create the received-gift record.
const finalizeResponse = await fetch(
  `${SUPABASE_URL}/rest/v1/rpc/campusora_finalize_gift_payment`,
  {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      p_payment_id: giftPayment.id,
      p_paid_at: transaction.paid_at
        ? new Date(transaction.paid_at).toISOString()
        : new Date().toISOString()
    })
  }
);

if (!finalizeResponse.ok) {
  console.error(
    "Gift finalization failed:",
    await finalizeResponse.text()
  );

  return res.status(500).json({
    success: false,
    error: "Payment was verified, but gift delivery could not be confirmed. Please contact support before paying again."
  });
}

const finalized = await finalizeResponse.json();

// The database function returns the recorded gift as JSON.
// Confirm that it matches the payment we just verified.
if (
  !finalized ||
  typeof finalized !== "object" ||
  Array.isArray(finalized) ||
  String(finalized.payment_id || "") !== String(giftPayment.id) ||
  String(finalized.sender_id || "") !== String(giftPayment.sender_id) ||
  String(finalized.recipient_id || "") !== String(giftPayment.recipient_id) ||
  String(finalized.gift_id || "") !== String(giftPayment.gift_id)
) {
  console.error(
    "Gift finalization returned an unexpected record:",
    finalized
  );

  return res.status(500).json({
    success: false,
    error: "Payment was verified, but the recorded gift could not be confirmed. Please contact support before paying again."
  });
}

return res.status(200).json({
  success: true,
  message: "Gift payment verified and gift recorded successfully.",
  gift: {
    id: catalogGift.id,
    name: catalogGift.name,
    sender_id: giftPayment.sender_id,
    recipient_id: giftPayment.recipient_id,
    payment_id: giftPayment.id
  }
});

} catch (error) {
console.error("Gift verification error:", error);

return res.status(500).json({
  success: false,
  error: "An unexpected gift verification error occurred."
});

}
    }
