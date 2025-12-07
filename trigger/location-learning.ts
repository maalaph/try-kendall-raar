/**
 * Location Learning Background Jobs
 * Runs clustering and cleanup tasks for location data
 */

import { task, schedules } from "@trigger.dev/sdk/v3";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Run location clustering for a specific user
 * Groups nearby location points to identify home, work, frequent places
 */
export const clusterUserLocationsTask = task({
  id: "cluster-user-locations",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 5000,
  },
  run: async (payload: { userId: string; eps?: number; minPoints?: number }) => {
    const { userId, eps = 0.001, minPoints = 5 } = payload;
    
    console.log(`[CLUSTERING] Starting for user: ${userId}`);
    
    try {
      // Call the PostgreSQL clustering function
      const { data: rawClusters, error } = await supabase
        .rpc('cluster_user_locations', {
          p_user_id: userId,
          p_eps: eps,
          p_min_points: minPoints,
        });

      if (error) {
        console.error('[CLUSTERING] Database error:', error);
        throw error;
      }

      if (!rawClusters || rawClusters.length === 0) {
        console.log('[CLUSTERING] No clusters found for user');
        return { success: true, clustersFound: 0 };
      }

      console.log(`[CLUSTERING] Found ${rawClusters.length} clusters`);

      // Process and classify each cluster
      for (const cluster of rawClusters) {
        // Analyze cluster to determine type (home/work/frequent)
        const { data: points } = await supabase
          .from('user_locations')
          .select('created_at')
          .eq('user_id', userId)
          .gte('latitude', cluster.centroid_lat - 0.002)
          .lte('latitude', cluster.centroid_lat + 0.002)
          .gte('longitude', cluster.centroid_lng - 0.002)
          .lte('longitude', cluster.centroid_lng + 0.002)
          .order('created_at', { ascending: true });

        if (!points || points.length === 0) continue;

        // Analyze time patterns
        let nightHours = 0;
        let workHours = 0;
        let weekendCount = 0;
        
        for (const point of points) {
          const date = new Date(point.created_at);
          const hour = date.getHours();
          const day = date.getDay();
          
          if (hour >= 22 || hour < 6) nightHours++;
          if (hour >= 9 && hour < 17 && day >= 1 && day <= 5) workHours++;
          if (day === 0 || day === 6) weekendCount++;
        }
        
        const total = points.length;
        const nightRatio = nightHours / total;
        const workRatio = workHours / total;
        const weekendRatio = weekendCount / total;
        
        // Classify
        let clusterType = 'frequent';
        let confidence = 0.3;
        
        if (nightRatio > 0.3 && weekendRatio > 0.2) {
          clusterType = 'home';
          confidence = Math.min(1, nightRatio + weekendRatio);
        } else if (workRatio > 0.4 && weekendRatio < 0.3) {
          clusterType = 'work';
          confidence = Math.min(1, workRatio);
        }

        // Geocode the centroid
        let formattedAddress: string | undefined;
        try {
          const geocodeUrl = `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${cluster.centroid_lng}&latitude=${cluster.centroid_lat}&access_token=${process.env.MAPBOX_ACCESS_TOKEN}`;
          const geocodeRes = await fetch(geocodeUrl);
          if (geocodeRes.ok) {
            const geocodeData = await geocodeRes.json();
            const feature = geocodeData.features?.[0];
            if (feature) {
              formattedAddress = feature.properties?.full_address || feature.properties?.name;
            }
          }
        } catch (e) {
          console.warn('[CLUSTERING] Failed to geocode cluster:', e);
        }

        // Save cluster to database
        await supabase
          .from('location_clusters')
          .upsert({
            user_id: userId,
            cluster_id: cluster.cluster_id,
            cluster_type: clusterType,
            centroid_lat: cluster.centroid_lat,
            centroid_lng: cluster.centroid_lng,
            formatted_address: formattedAddress,
            point_count: cluster.point_count,
            confidence_score: confidence,
            first_seen_at: points[0]?.created_at,
            last_seen_at: points[points.length - 1]?.created_at,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,cluster_id',
          });

        console.log(`[CLUSTERING] Saved cluster ${cluster.cluster_id} as ${clusterType}`);

        // Create suggestion if confidence is high enough and location not already saved
        if (confidence >= 0.6 && cluster.point_count >= 5) {
          // Check if location is already saved
          const { data: existingSaved } = await supabase
            .rpc('is_location_already_saved', {
              p_user_id: userId,
              p_latitude: cluster.centroid_lat,
              p_longitude: cluster.centroid_lng,
              p_threshold_meters: 200,
            });

          if (!existingSaved) {
            // Check if similar location was previously rejected
            const { data: wasRejected } = await supabase
              .rpc('was_similar_location_rejected', {
                p_user_id: userId,
                p_latitude: cluster.centroid_lat,
                p_longitude: cluster.centroid_lng,
                p_threshold_meters: 200,
              });

            if (!wasRejected) {
              // Check if suggestion already exists
              const { data: existingSuggestion } = await supabase
                .from('location_suggestions')
                .select('id')
                .eq('user_id', userId)
                .eq('cluster_id', cluster.cluster_id)
                .eq('status', 'pending')
                .single();

              if (!existingSuggestion) {
                // Determine suggested label
                let suggestedLabel: string | undefined;
                if (clusterType === 'home') {
                  suggestedLabel = 'Home';
                } else if (clusterType === 'work') {
                  suggestedLabel = 'Work';
                } else {
                  suggestedLabel = 'Frequent Place';
                }

                // Create suggestion
                const { error: suggestionError } = await supabase
                  .from('location_suggestions')
                  .insert({
                    user_id: userId,
                    cluster_id: cluster.cluster_id,
                    suggested_label: suggestedLabel,
                    address: formattedAddress,
                    latitude: cluster.centroid_lat,
                    longitude: cluster.centroid_lng,
                    confidence_score: confidence,
                    visit_count: cluster.point_count,
                    status: 'pending',
                  });

                if (suggestionError) {
                  console.warn(`[CLUSTERING] Failed to create suggestion for cluster ${cluster.cluster_id}:`, suggestionError);
                } else {
                  console.log(`[CLUSTERING] Created suggestion for cluster ${cluster.cluster_id} (${suggestedLabel})`);
                }
              }
            }
          }
        }
      }

      return { success: true, clustersFound: rawClusters.length };
    } catch (error) {
      console.error('[CLUSTERING] Error:', error);
      throw error;
    }
  },
});

/**
 * Nightly job to run clustering for all active users
 */
export const nightlyClusteringTask = schedules.task({
  id: "nightly-location-clustering",
  cron: "0 3 * * *", // Run at 3 AM every day
  run: async () => {
    console.log('[NIGHTLY CLUSTERING] Starting...');
    
    try {
      // Get all users who have location data
      const { data: users, error } = await supabase
        .from('user_locations')
        .select('user_id')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1000);

      if (error) throw error;

      // Get unique user IDs
      const uniqueUserIds = [...new Set(users?.map(u => u.user_id) || [])];
      console.log(`[NIGHTLY CLUSTERING] Processing ${uniqueUserIds.length} users`);

      // Trigger clustering for each user
      for (const userId of uniqueUserIds) {
        await clusterUserLocationsTask.trigger({ userId });
      }

      return { success: true, usersProcessed: uniqueUserIds.length };
    } catch (error) {
      console.error('[NIGHTLY CLUSTERING] Error:', error);
      throw error;
    }
  },
});

/**
 * Cleanup old location data based on retention policy
 */
export const cleanupOldLocationsTask = schedules.task({
  id: "cleanup-old-locations",
  cron: "0 4 * * *", // Run at 4 AM every day
  run: async () => {
    console.log('[CLEANUP] Starting location data cleanup...');
    
    try {
      // Call the cleanup function
      const { data, error } = await supabase.rpc('cleanup_old_locations');
      
      if (error) {
        console.error('[CLEANUP] Error calling cleanup function:', error);
        throw error;
      }

      console.log(`[CLEANUP] Deleted ${data || 0} old location records`);

      // Also cleanup expired search cache
      const { data: cacheDeleted, error: cacheError } = await supabase
        .rpc('cleanup_expired_search_cache');

      if (cacheError) {
        console.warn('[CLEANUP] Failed to cleanup search cache:', cacheError);
      } else {
        console.log(`[CLEANUP] Deleted ${cacheDeleted || 0} expired cache entries`);
      }

      return { 
        success: true, 
        locationsDeleted: data || 0,
        cacheEntriesDeleted: cacheDeleted || 0,
      };
    } catch (error) {
      console.error('[CLEANUP] Error:', error);
      throw error;
    }
  },
});

