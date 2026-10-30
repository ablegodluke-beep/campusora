module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed."
    });
  }

  const URL = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!URL || !KEY) {
    return res.status(500).json({
      success: false,
      message: "Admin service is not configured."
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
        message: "Please log in."
      });
    }

    // Verify the logged-in user.
    const userResponse = await fetch(`${URL}/auth/v1/user`, {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${token}`
      }
    });

    const user = await userResponse.json().catch(() => ({}));

    if (!userResponse.ok || !user.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid login session."
      });
    }

    // Confirm administrator access.
    const adminResponse = await fetch(
      `${URL}/rest/v1/campusora_admins?user_id=eq.${user.id}&select=user_id,admin_role`,
      {
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`
        }
      }
    );

    if (!adminResponse.ok) {
      return res.status(500).json({
        success: false,
        message: "Could not verify administrator access."
      });
    }

    const admins = await adminResponse.json();
    const admin = admins[0];

    if (!admin || !["admin", "super_admin"].includes(admin.admin_role)) {
      return res.status(403).json({
        success: false,
        message: "Administrator access required."
      });
    }

    // Count records in a table.
    async function countRows(table, filters = "") {
      try {
        const response = await fetch(
          `${URL}/rest/v1/${table}?select=id${filters}`,
          {
            method: "HEAD",
            headers: {
              apikey: KEY,
              Authorization: `Bearer ${KEY}`,
              Prefer: "count=exact",
              Range: "0-0"
            }
          }
        );

        if (!response.ok) return null;

        const range = response.headers.get("content-range");
        if (!range) return null;

        const total = range.split("/")[1];
        return total === "*" ? null : Number(total);
      } catch {
        return null;
      }
    }

    // Add up verified payments.
    async function paymentSummary(table) {
      try {
        const response = await fetch(
          `${URL}/rest/v1/${table}?select=amount_kobo&payment_verified=eq.true&limit=10000`,
          {
            headers: {
              apikey: KEY,
              Authorization: `Bearer ${KEY}`
            }
          }
        );

        if (!response.ok) {
          return { count: null, revenue: 0 };
        }

        const rows = await response.json();

        return {
          count: rows.length,
          revenue: rows.reduce(
            (total, row) => total + Number(row.amount_kobo || 0),
            0
          )
        };
      } catch {
        return { count: null, revenue: 0 };
      }
    }

    const [
      users,
      posts,
      videos,
      communities,
      events,
      campaigns,
      pendingReports,
      premiumPayments,
      rankPayments,
      campaignPayments
    ] = await Promise.all([
      countRows("profiles"),
      countRows("posts"),
      countRows("spotlight_videos"),
      countRows("communities"),
      countRows("events"),
      countRows("sponsored_campaigns", "&status=eq.active&payment_verified=eq.true"),
      countRows("content_reports", "&status=eq.pending"),
      paymentSummary("premium_memberships"),
      paymentSummary("profile_ranks"),
      paymentSummary("sponsored_campaigns")
    ]);

    const paymentCount =
      (premiumPayments.count || 0) +
      (rankPayments.count || 0) +
      (campaignPayments.count || 0);

    const revenueKobo =
      premiumPayments.revenue +
      rankPayments.revenue +
      campaignPayments.revenue;

    return res.status(200).json({
      success: true,
      statistics: {
        users,
        posts,
        videos,
        communities,
        events,
        payments: paymentCount,
        revenue: revenueKobo / 100,
        campaigns,
        pendingReports
      }
    });

  } catch (error) {
    console.error("Admin statistics error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not load dashboard statistics."
    });
  }
};
