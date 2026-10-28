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
const campaignId = req.body?.campaign_id;

if (!campaignId || typeof campaignId !== "string") {
  return res.status(400).json({ error: "Missing campaign ID." });
}

const campaignResponse = await fetch(
  `${SUPABASE_URL}/rest/v1/sponsored_campaigns?id=eq.${encodeURIComponent(campaignId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,user_id,duration_days,amount_kobo,status,payment_verified,payment_reference`,
  {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  }
);

if (!campaignResponse.ok) {
  console.error("Could not read campaign:", await campaignResponse.text());
  return res.status(500).json({ error: "Could not check your campaign." });
}

const campaigns = await campaignResponse.json();
const campaign = campaigns[0];

if (!campaign) {
  return res.status(404).json({ error: "Campaign not found for this account." });
}

if (campaign.payment_verified || campaign.status !== "pending_payment") {
  return res.status(409).json({ error: "This campaign is not awaiting payment." });
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

if (campaign.payment_reference) {
  return res.status(409).json({
    error: "A payment reference already exists for this campaign. Please verify its status before trying again."
  });
}

const reference = `campusora_${campaign.id}_${Date.now()}`;

const initResponse = await fetch("https://api.paystack.co/transaction/initialize", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    email: user.email,
    amount: expectedAmount,
    currency: "NGN",
    reference,
    callback_url: "https://campusora-sigma.vercel.app/advertise.html",
    metadata: {
      campaign_id: campaign.id,
      user_id: user.id,
      duration_days: campaign.duration_days
    }
  })
});

const initData = await initResponse.json();

if (!initResponse.ok || !initData.status || !initData.data?.authorization_url) {
  console.error("Paystack initialization failed:", initData);
  return res.status(502).json({ error: "Paystack could not start checkout. Please try again later." });
}

const saveResponse = await fetch(
  `${SUPABASE_URL}/rest/v1/sponsored_campaigns?id=eq.${encodeURIComponent(campaign.id)}&user_id=eq.${encodeURIComponent(user.id)}&payment_reference=is.null&payment_verified=eq.false`,
  {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({ payment_reference: reference })
  }
);

const savedCampaigns = saveResponse.ok ? await saveResponse.json() : [];

if (!saveResponse.ok || savedCampaigns.length !== 1) {
  console.error("Could not safely save payment reference:", await saveResponse.text().catch(() => ""));
  return res.status(500).json({
    error: "Checkout was initialized, but the payment reference could not be saved. Do not pay yet; contact support."
  });
}

return res.status(200).json({
  authorization_url: initData.data.authorization_url,
  reference
});

} catch (error) {
console.error("Payment initialization error:", error);
return res.status(500).json({ error: "An unexpected payment service error occurred." });
}
    }
