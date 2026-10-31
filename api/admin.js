const checkHandler = require("../lib/admin/check");
const statsHandler = require("../lib/admin/stats");
const manageHandler = require("../lib/admin/manage");
const uploadHandler = require("../lib/admin/upload");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const action = String(req.query?.action || "manage")
    .trim()
    .toLowerCase();

  try {
    if (action === "check") {
      return await checkHandler(req, res);
    }

    if (action === "stats") {
      return await statsHandler(req, res);
    }

    if (action === "upload") {
      return await uploadHandler(req, res);
    }

    return await manageHandler(req, res);

  } catch (error) {
    console.error("Combined admin API error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Admin request failed."
      });
    }
  }
};
