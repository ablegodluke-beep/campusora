module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      success: false,
      message: "Method not allowed."
    });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
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

    // Verify the user's Supabase session.
    const userResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${token}`
        }
      }
    );

    const user = await userResponse.json().catch(() => ({}));

    if (!userResponse.ok || !user.id) {
      return res.status(401).json({
        success: false,
        message: "Your login session is invalid."
      });
    }

    // Check the user's admin record.
    const adminResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/campusora_admins?user_id=eq.${encodeURIComponent(user.id)}&select=user_id,admin_role,permissions`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`
        }
      }
    );

    if (!adminResponse.ok) {
      console.error("Admin lookup failed:", await adminResponse.text());

      return res.status(500).json({
        success: false,
        message: "Could not verify admin permissions."
      });
    }

    const admins = await adminResponse.json();
    const admin = admins[0];

    if (
      !admin ||
      !["super_admin", "admin"].includes(admin.admin_role)
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this dashboard."
      });
    }

    return res.status(200).json({
      success: true,
      user_id: user.id,
      admin_role: admin.admin_role,
      permissions: admin.permissions
    });

  } catch (error) {
    console.error("Admin verification error:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred."
    });
  }
};
