/**
 * Admin Section Access Middleware
 * Verifies that admin has OTP-verified access to admin management section
 */

const AdminSectionAccess = require('../models/AdminSectionAccess');

const checkAdminSectionAccess = async (req, res, next) => {
    try {
        // Check if user has active admin section access
        const accessRecord = await AdminSectionAccess.findOne({
            admin: req.user._id
        });
        
        if (!accessRecord) {
            return res.status(403).json({ 
                error: 'Admin section access denied. OTP verification required.',
                requiresOTP: true,
                code: 'ADMIN_SECTION_OTP_REQUIRED'
            });
        }
        
        // Attach access info to request
        req.adminSectionAccess = accessRecord;
        next();
    } catch (error) {
        console.error('[ADMIN-ACCESS-CHECK] Error:', error.message);
        res.status(500).json({ error: 'Failed to verify admin section access' });
    }
};

module.exports = { checkAdminSectionAccess };
