export default async function handler(req, res) {
res.setHeader("Cache-Control", "no-store");

if (req.method !== "POST") {
return res.status(405).json({ error: "Method not allowed" });
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PAYSTACK_SECRET_KEY) {
console.error("Missing required environment variables");
return res.status(500).json({ error: "Payment service is not configured." });
}

try {
const authHeader = req.headers.authorization || "";
const accessToken = authHeader.startsWith("Bearer ")
? authHeader.slice(7)
: "";

if (!accessToken) {
  return res.status(401).json({ error: "Please log in again." });
}

// Confirm the logged-in user with Supabase Auth.
const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
  headers: {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${accessToken}`
  }
});

if (!userResponse.ok) {
  return res.status(401).json({ error: "Your login session is invalid." });
}

const user = await userResponse.json();
const reference = req.body?.reference;

if (typeof reference !== "string" || !/^campusora_[A-Za-z0-9_-]+_\d+$/.test(reference)) {
  return res.status(400).json({ error: "Invalid payment reference." });
}

// Find the campaign belonging to this user and matching this reference.
const campaignResponse = await fetch(
  `${SUPABASE_URL}/rest/v1/sponsored_campaigns?user_id=eq.${encodeURIComponent(user.id)}&payment_reference=eq.${encodeURIComponent(reference)}&select=id,user_id,duration_days,amount_kobo,status,payment_verified,payment_reference`,
  {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  }
);

if (!campaignResponse.ok) {
  console.error("Could not retrieve campaign:", await campaignResponse.text());
  return res.status(500).json({ error: "Could not check your campaign." });
}

const campaigns = await campaignResponse.json();
const campaign = campaigns[0];

if (!campaign) {
  return res.status(404).json({ error: "No campaign matches this payment reference." });
}

// If already verified, return success without changing anything again.
if (campaign.payment_verified === true) {
  return res.status(200).json({
    success: true,
    message: "Payment was already verified."
  });
}

const prices = {
  1: 100000,
  3: 250000,
  7: 500000,
  14: 800000,
  30: 1500000
};

const expectedAmount = prices[campaign.duration_days];

if (!expectedAmount || Number(campaign.amount_kobo) !== expectedAmount) {
  return res.status(400).json({ error: "The campaign price could not be validated." });
}

// Ask Paystack directly whether this exact transaction succeeded.
const paystackResponse = await fetch(
  `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
  {
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
    }
  }
);

const paystackData = await paystackResponse.json();

if (
  !paystackResponse.ok ||
  !paystackData.status ||
  paystackData.data?.status !== "success" ||
  paystackData.data?.reference !== reference ||
  paystackData.data?.currency !== "NGN" ||
  Number(paystackData.data?.amount) !== expectedAmount
) {
  return res.status(400).json({
    success: false,
    error: "Paystack has not confirmed a successful payment for this campaign."
  });
}

// Check transaction metadata when Paystack provides it.
const metadata = paystackData.data.metadata || {};

if (
  String(metadata.campaign_id || "") !== String(campaign.id) ||
  String(metadata.user_id || "") !== String(user.id)
) {
  return res.status(400).json({
    success: false,
    error: "The payment details do not match this campaign."
  });
}

// Mark paid campaigns as awaiting admin review, never automatically live.
const updateResponse = await fetch(
  `${SUPABASE_URL}/rest/v1/sponsored_campaigns?id=eq.${encodeURIComponent(campaign.id)}&user_id=eq.${encodeURIComponent(user.id)}&payment_reference=eq.${encodeURIComponent(reference)}&payment_verified=eq.false&status=eq.pending_payment`,
  {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      payment_verified: true,
      status: "pending_review"
    })
  }
);

if (!updateResponse.ok) {
  console.error("Campaign update failed:", await updateResponse.text());
  return res.status(500).json({
    error: "Payment was confirmed, but the campaign status could not be updated. Please contact support."
  });
}

const updatedCampaigns = await updateResponse.json();

if (updatedCampaigns.length !== 1) {
  return res.status(409).json({
    error: "The campaign was not updated. Please refresh and check its status."
  });
}

return res.status(200).json({
  success: true,
  message: "Payment verified. Your campaign is awaiting admin review."
});

} catch (error) {
console.error("Payment verification error:", error);
return res.status(500).json({
error: "An unexpected payment verification error occurred."
});
}
  }
