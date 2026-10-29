export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      success: false,
      error: "Method not allowed."
    });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;

  const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  const SUPABASE_PUBLIC_KEY =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !SUPABASE_PUBLIC_KEY
  ) {
    return res.status(500).json({
      success: false,
      error: "The payout API environment variables are incomplete."
    });
  }

  const baseUrl = SUPABASE_URL.replace(/\/+$/, "");

  const serviceHeaders = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json"
  };

  async function supabaseRequest(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        ...serviceHeaders,
        ...(options.headers || {})
      }
    });

    const text = await response.text();

    let data;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const message =
        data?.message ||
        data?.error_description ||
        data?.error ||
        "A database request failed.";

      throw new Error(message);
    }

    return data;
  }

  try {
    /*
      1. Verify the user's login token.
    */

    const authorization = req.headers.authorization || "";
    const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);

    if (!tokenMatch) {
      return res.status(401).json({
        success: false,
        error: "Please log in before requesting a payout."
      });
    }

    const accessToken = tokenMatch[1];

    const authResponse = await fetch(
      `${baseUrl}/auth/v1/user`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_PUBLIC_KEY,
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!authResponse.ok) {
      return res.status(401).json({
        success: false,
        error: "Your session is invalid or expired. Please log in again."
      });
    }

    const user = await authResponse.json();

    if (!user?.id) {
      return res.status(401).json({
        success: false,
        error: "Unable to verify your account."
      });
    }

    const creatorId = user.id;

    /*
      2. Validate the requested amount and bank details.
    */

    const body = req.body || {};

    const amount = Number(body.amount);

    const accountName = String(
      body.account_name || ""
    ).trim();

    const bankName = String(
      body.bank_name || ""
    ).trim();

    const accountNumber = String(
      body.account_number || ""
    ).trim();

    if (
      !Number.isSafeInteger(amount) ||
      amount < 5000
    ) {
      return res.status(400).json({
        success: false,
        error: "The minimum payout request is ₦5,000."
      });
    }

    if (
      accountName.length < 2 ||
      accountName.length > 100
    ) {
      return res.status(400).json({
        success: false,
        error: "Enter a valid account name."
      });
    }

    if (
      bankName.length < 2 ||
      bankName.length > 100
    ) {
      return res.status(400).json({
        success: false,
        error: "Enter a valid bank name."
      });
    }

    if (!/^\d{10}$/.test(accountNumber)) {
      return res.status(400).json({
        success: false,
        error: "Enter a valid 10-digit Nigerian bank account number."
      });
    }

    /*
      3. Refresh eligibility using the logged-in user's token.

      The database function checks follower count and Premium status.
    */

    const eligibilityResponse = await fetch(
      `${baseUrl}/rest/v1/rpc/campusora_refresh_gift_earnings_eligibility`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_PUBLIC_KEY,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      }
    );

    if (!eligibilityResponse.ok) {
      const errorText = await eligibilityResponse.text();

      console.error(
        "Payout eligibility check failed:",
        errorText
      );

      return res.status(400).json({
        success: false,
        error: "We could not verify your eligibility. Please try again."
      });
    }

    const eligibility = await supabaseRequest(
      "/rest/v1/campusora_gift_earnings_eligibility" +
      "?select=creator_id,follower_count,premium_active,eligible" +
      "&creator_id=eq." + encodeURIComponent(creatorId) +
      "&limit=1"
    );

    if (
      !eligibility ||
      !eligibility.length ||
      eligibility[0].eligible !== true
    ) {
      return res.status(403).json({
        success: false,
        error: "You need at least 500 followers and active Premium membership to request Gift Earnings payouts."
      });
    }

    /*
      4. Prevent another active payout request.

      A creator must wait until the previous request is paid
      or rejected before submitting another request.
    */

    const existingRequests = await supabaseRequest(
      "/rest/v1/campusora_gift_payout_requests" +
      "?select=id,status" +
      "&creator_id=eq." + encodeURIComponent(creatorId) +
      "&status=in.(pending,approved,processing)" +
      "&limit=1"
    );

    if (existingRequests && existingRequests.length > 0) {
      return res.status(409).json({
        success: false,
        error: "You already have a payout request awaiting processing."
      });
    }

    /*
      5. Read available creator earnings.
    */

    const earnings = await supabaseRequest(
      "/rest/v1/campusora_gift_earnings" +
      "?select=creator_earning,status" +
      "&creator_id=eq." + encodeURIComponent(creatorId) +
      "&status=eq.available"
    );

    const availableBalance = (earnings || []).reduce(
      (sum, row) => {
        const value = Number(row.creator_earning || 0);

        return sum + (
          Number.isFinite(value) && value > 0
            ? value
            : 0
        );
      },
      0
    );

    if (availableBalance < 5000) {
      return res.status(400).json({
        success: false,
        error: "You need at least ₦5,000 in available earnings before requesting a payout."
      });
    }

    if (amount > availableBalance) {
      return res.status(400).json({
        success: false,
        error: "Your requested amount exceeds your available earnings.",
        available_balance: availableBalance
      });
    }

    /*
      6. Create the payout request.

      The request remains pending for admin review.
      This endpoint does not initiate a bank transfer.
    */

    const inserted = await supabaseRequest(
      "/rest/v1/campusora_gift_payout_requests",
      {
        method: "POST",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          creator_id: creatorId,
          amount,
          payout_method: "bank_transfer",
          account_name: accountName,
          bank_name: bankName,
          account_number: accountNumber,
          currency: "NGN",
          status: "pending",
          requested_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
    );

    const payout = Array.isArray(inserted)
      ? inserted[0]
      : inserted;

    return res.status(201).json({
      success: true,
      message: "Your payout request has been submitted for review.",
      payout: {
        id: payout?.id,
        amount,
        currency: "NGN",
        status: "pending",
        requested_at: payout?.requested_at
      }
    });

  } catch (error) {
    console.error(
      "Campusora payout API error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      error: "We could not submit your payout request. Please try again later."
    });
  }
          }
