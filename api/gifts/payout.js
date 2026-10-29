const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      success: false,
      message: "Method not allowed."
    });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !SUPABASE_KEY) {
    return res.status(500).json({
      success: false,
      message: "Server configuration is incomplete."
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
        message: "Please log in again."
      });
    }

    // Verify the signed-in user.
    const userResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`
        }
      }
    );

    const user = await userResponse.json().catch(() => ({}));

    if (!userResponse.ok || !user.id) {
      return res.status(401).json({
        success: false,
        message: "Your session is invalid. Please log in again."
      });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const amount = Number(body.amount);
    const accountName = String(body.account_name || "").trim();
    const bankName = String(body.bank_name || "").trim();
    const accountNumber = String(body.account_number || "").trim();

    if (!Number.isSafeInteger(amount) || amount < 5000) {
      return res.status(400).json({
        success: false,
        message: "The minimum payout is ₦5,000."
      });
    }

    if (
      !accountName ||
      !bankName ||
      !/^\d{10}$/.test(accountNumber)
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter your account name, bank name and valid 10-digit account number."
      });
    }

    // Call the secure database function using the user's token.
    // The function verifies identity, eligibility, balance and reservations.
    const rpcResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/campusora_request_gift_payout`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          p_creator_id: user.id,
          p_amount: amount,
          p_account_name: accountName,
          p_bank_name: bankName,
          p_account_number: accountNumber
        })
      }
    );

    const result = await rpcResponse.json().catch(() => ({}));

    if (!rpcResponse.ok) {
      const databaseMessage =
        result.message || result.details || result.hint || "";

      let message = "Unable to submit your payout request. Please try again.";

      if (databaseMessage.includes("eligible")) {
        message = "You are not yet eligible for Gift Earnings.";
      } else if (databaseMessage.includes("active payout")) {
        message = "You already have a payout request being processed.";
      } else if (databaseMessage.includes("Insufficient available earnings")) {
        message = "Your available earnings are not enough for this payout.";
      } else if (databaseMessage.includes("Minimum payout")) {
        message = "The minimum payout is ₦5,000.";
      } else if (
        databaseMessage.includes("account details") ||
        databaseMessage.includes("10-digit")
      ) {
        message = "Please check your bank account details.";
      }

      return res.status(400).json({
        success: false,
        message
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message || "Payout request submitted successfully.",
      payout_request_id: result.payout_request_id,
      amount: result.amount,
      status: result.status
    });
  } catch (error) {
    console.error("Gift payout API error:", error);

    return res.status(500).json({
      success: false,
      message: "A server error occurred. Please try again later."
    });
  }
};
