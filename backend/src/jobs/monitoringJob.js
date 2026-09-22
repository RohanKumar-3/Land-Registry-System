const cron       = require('node-cron');
const LandParcel = require('../models/LandParcel');
const mlService  = require('../services/mlService');

const startMonitoringJob = () => {
  // ── Job 1: Re-verify parcels every 30 days ────────────────────────────
  // Runs at 2:00 AM every day
  cron.schedule('0 2 * * *', async () => {
    console.log('\n🔄 [CRON] Starting periodic land monitoring...');

    try {
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      );

      // Find verified parcels that haven't been checked in 30 days
      const parcels = await LandParcel.find({
        isOnChain: true,
        $or: [
          { lastVerifiedAt: { $lt: thirtyDaysAgo } },
          { lastVerifiedAt: null }
        ]
      })
        .select('_id centerPoint landType verificationScore')
        .limit(20);  // Process 20 per run to avoid overloading GEE

      console.log(`📊 [CRON] ${parcels.length} parcels need re-verification`);

      let passed = 0, failed = 0;

      for (const parcel of parcels) {
        if (!parcel.centerPoint) continue;

        try {
          await mlService.verifyParcel(parcel._id, parcel.centerPoint);
          passed++;
          console.log(`  ✅ Re-verified: ${parcel._id}`);
        } catch (err) {
          failed++;
          console.error(`  ❌ Failed: ${parcel._id} — ${err.message}`);
        }

        // 5 second delay between each to not overwhelm GEE
        await new Promise(r => setTimeout(r, 5000));
      }

      console.log(
        `✅ [CRON] Done: ${passed} passed, ${failed} failed\n`
      );
    } catch (error) {
      console.error('❌ [CRON] Monitoring job error:', error.message);
    }
  });

  // ── Job 2: Flag stale pending parcels ─────────────────────────────────
  // Runs every Monday at 3:00 AM
  cron.schedule('0 3 * * 1', async () => {
    console.log('\n🔄 [CRON] Checking stale pending parcels...');
    try {
      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
      );

      // Parcels pending for > 7 days without government action
      const stale = await LandParcel.updateMany(
        {
          verificationStatus:  'pending',
          governmentApproved:  false,
          createdAt:           { $lt: sevenDaysAgo }
        },
        {
          verificationNotes: 'Auto-flagged: pending > 7 days without review'
        }
      );

      console.log(
        `✅ [CRON] Flagged ${stale.modifiedCount} stale parcels\n`
      );
    } catch (error) {
      console.error('❌ [CRON] Stale check error:', error.message);
    }
  });

  console.log('✅ Monitoring cron jobs scheduled');
  console.log('   Job 1: Re-verify parcels @ 2AM daily');
  console.log('   Job 2: Flag stale parcels @ 3AM Mondays');
};

module.exports = { startMonitoringJob };