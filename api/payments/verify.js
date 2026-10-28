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
return res.status(500).json({
error: "Payment service is not configured."
});
}

try {
const authHeader = req.headers.authorization || "";
const accessToken = authHeader.startsWith("Bearer ")
? authHeader.slice(7)
: "";

if (!accessToken) {
  return res.status(401).json({
    error: "Please log in again."
  });
}

// Confirm the logged-in user with Supabase Auth.
const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
  headers: {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${accessToken}`
  }
});

if (!userResponse.ok) {
  return res.status(401).json({
    error: "Your login session is invalid."
  });
}

const user = await userResponse.json();
const reference = req.body?.reference;

if (
  typeof reference !== "string" ||
  !/^campusora_[A-Za-z0-9_-]+_\d+$/.test(reference)
) {
  return res.status(400).json({
    error: "Invalid payment reference."
  });
}

// Retrieve the campaign belonging to this user.
const campaignResponse = await fetch(
  `${SUPABASE_URL}/rest/v1/sponsored_campaigns?user_id=eq.${encodeURIComponent(user.id)}&payment_reference=eq.${encodeURIComponent(reference)}&select=id,user_id,duration_days,amount_kobo,status,payment_verified,payment_reference,published_at,expires_at`,
  {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  }
);

if (!campaignResponse.ok) {
  console.error(
    "Could not retrieve campaign:",
    await campaignResponse.text()
  );

  return res.status(500).json({
    error: "Could not check your campaign."
  });
}

const campaigns = await campaignResponse.json();
const campaign = campaigns[0];

if (!campaign) {
  return res.status(404).json({
    error: "No campaign matches this payment reference."
  });
}

// Do not reactivate campaigns that have subsequently been paused,
// rejected, cancelled, or completed.
if (campaign.payment_verified === true) {
  if (
    campaign.status === "active" &&
    campaign.expires_at &&
    new Date(campaign.expires_at).getTime() > Date.now()
  ) {
    return res.status(200).json({
      success: true,
      published: true,
      message: "Your post has been published!",
      published_at: campaign.published_at,
      expires_at: campaign.expires_at
    });
  }

  if (
    campaign.status === "active" &&
    campaign.expires_at &&
    new Date(campaign.expires_at).getTime() <= Date.now()
  ) {
    // An expired campaign must not be reported as published.
    return res.status(200).json({
      success: false,
      published: false,
      expired: true,
      message: "This campaign has expired."
    });
  }

  return res.status(200).json({
    success: true,
    published: false,
    message: "Payment was already verified. Your campaign is not currently active.",
    status: campaign.status
  });
}

// Only unpaid campaigns waiting for payment can be published here.
if (campaign.status !== "pending_payment") {
  return res.status(409).json({
    error: "This campaign is not awaiting payment and cannot be published automatically."
  });
}

const prices = {
  1: 100000,
  3: 250000,
  7: 500000,
  14: 800000,
  30: 1500000
};

const durationDays = Number(campaign.duration_days);
const expectedAmount = prices[durationDays];

if (
  !expectedAmount ||
  Number(campaign.amount_kobo) !== expectedAmount
) {
  return res.status(400).json({
    error: "The campaign price could not be validated."
  });
}

// Verify the transaction directly with Paystack.
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

// Ensure the payment belongs to this exact campaign and user.
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

// Calculate the publication period using the server's clock.
const publishedAt = new Date();
const expiresAt = new Date(
  publishedAt.getTime() + durationDays * 24 * 60 * 60 * 1000
);

// Activate only the matching, still-unpaid campaign.
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
      status: "active",
      published_at: publishedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      updated_at: publishedAt.toISOString()
    })
  }
);

if (!updateResponse.ok) {
  console.error(
    "Campaign update failed:",
    await updateResponse.text()
  );

  return res.status(500).json({
    error: "Payment was confirmed, but publishing failed. Please contact support before attempting another payment."
  });
}

const updatedCampaigns = await updateResponse.json();

if (updatedCampaigns.length !== 1) {
  return res.status(409).json({
    error: "Payment was confirmed, but the campaign was not published. Please contact support before attempting another payment."
  });
}

return res.status(200).json({
  success: true,
  published: true,
  message: "Your post has been published!",
  published_at: publishedAt.toISOString(),
  expires_at: expiresAt.toISOString()
});

} catch (error) {
console.error("Payment verification error:", error);

return res.status(500).json({
  error: "An unexpected payment verification error occurred."
});

}
    }
