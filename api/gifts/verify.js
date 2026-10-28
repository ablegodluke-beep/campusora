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
    success: false,
    error: "Please log in first."
  });
}

// Authenticate the logged-in sender.
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

// Find the payment using the reference.
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
    error: "Gift payment not found."
  });
}

// Confirm that the stored amount matches the active gift catalog.
const catalogResponse = await fetch(
  `${SUPABASE_URL}/rest/v1/campusora_gift_catalog` +
  `?id=eq.${encodeURIComponent(giftPayment.gift_id)}` +
  `&active=eq.true` +
  `&select=id,slug,name,price_ngn,amount_kobo`,
  {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  }
);

if (!catalogResponse.ok) {
  return res.status(500).json({
    success: false,
    error: "Could not validate the gift price."
  });
}

const catalogItems = await catalogResponse.json();
const catalogGift = catalogItems[0];

if (
  !catalogGift ||
  Number(giftPayment.amount_kobo) !== Number(catalogGift.amount_kobo) ||
  giftPayment.currency !== "NGN"
) {
  return res.status(400).json({
    success: false,
    error: "The gift price could not be validated."
  });
}

// Ask Paystack to confirm the transaction.
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

// Match Paystack metadata to the database payment.
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
    error: "The payment details do not match this gift."
  });
}

// Finalize the gift through the protected database function.
// The function prevents duplicate gift delivery.
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
    error: "Payment was confirmed, but gift delivery could not be completed. Please contact support before trying to pay again."
  });
}

const finalized = await finalizeResponse.json();

if (
  finalized?.success === false ||
  finalized?.error
) {
  return res.status(500).json({
    success: false,
    error: "Gift delivery could not be confirmed."
  });
}

return res.status(200).json({
  success: true,
  message: "Gift payment verified successfully.",
  gift: {
    id: catalogGift.id,
    name: catalogGift.name,
    recipient_id: giftPayment.recipient_id
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
