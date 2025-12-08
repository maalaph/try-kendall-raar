/**
 * Location Clustering Service
 * Uses PostGIS ST_ClusterDBSCAN to identify location patterns (home, work, frequent places)
 */

import { supabase } from '@/lib/supabase';

export interface LocationCluster {
  cluster_id: number;
  cluster_type: 'unknown' | 'home' | 'work' | 'frequent';
  centroid_lat: number;
  centroid_lng: number;
  formatted_address?: string;
  point_count: number;
  avg_duration_hours?: number;
  primary_time_of_day?: string;
  primary_day_of_week?: string;
  confidence_score: number;
  first_seen_at?: string;
  last_seen_at?: string;
}

export interface ClusteringResult {
  clusters: LocationCluster[];
  home?: LocationCluster;
  work?: LocationCluster;
  frequent_places: LocationCluster[];
}

/**
 * Run DBSCAN clustering on user's location history
 * @param userId - User's record ID
 * @param eps - Distance threshold in degrees (~111m per 0.001 degrees)
 * @param minPoints - Minimum points to form a cluster
 */
export async function clusterUserLocations(
  userId: string,
  eps: number = 0.001,
  minPoints: number = 5
): Promise<ClusteringResult> {
  try {
    console.log('[CLUSTERING] Starting clustering for user:', userId);

    // Call the PostgreSQL function we created
    const { data: rawClusters, error } = await supabase
      .rpc('cluster_user_locations', {
        p_user_id: userId,
        p_eps: eps,
        p_min_points: minPoints,
      });

    if (error) {
      console.error('[CLUSTERING] Error running clustering:', error);
      throw error;
    }

    if (!rawClusters || rawClusters.length === 0) {
      console.log('[CLUSTERING] No clusters found for user:', userId);
      return {
        clusters: [],
        frequent_places: [],
      };
    }

    console.log('[CLUSTERING] Found', rawClusters.length, 'raw clusters');

    // Analyze each cluster to determine type
    const clusters: LocationCluster[] = [];
    
    for (const raw of rawClusters) {
      // Get detailed stats for this cluster
      const stats = await analyzeCluster(userId, raw.cluster_id, raw.centroid_lat, raw.centroid_lng);
      
      const cluster: LocationCluster = {
        cluster_id: raw.cluster_id,
        cluster_type: stats.inferred_type,
        centroid_lat: raw.centroid_lat,
        centroid_lng: raw.centroid_lng,
        point_count: raw.point_count,
        avg_duration_hours: stats.avg_duration_hours,
        primary_time_of_day: stats.primary_time_of_day,
        primary_day_of_week: stats.primary_day_of_week,
        confidence_score: stats.confidence_score,
        first_seen_at: stats.first_seen_at,
        last_seen_at: stats.last_seen_at,
      };

      // Geocode the centroid
      try {
        const geocodeResponse = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/geocode?latitude=${raw.centroid_lat}&longitude=${raw.centroid_lng}&permanent=true&userId=${userId}`
        );
        if (geocodeResponse.ok) {
          const geocodeData = await geocodeResponse.json();
          cluster.formatted_address = geocodeData.result?.formatted_address;
        }
      } catch (e) {
        console.warn('[CLUSTERING] Failed to geocode cluster centroid:', e);
      }

      clusters.push(cluster);
    }

    // Save clusters to database
    for (const cluster of clusters) {
      await supabase
        .from('location_clusters')
        .upsert({
          user_id: userId,
          cluster_id: cluster.cluster_id,
          cluster_type: cluster.cluster_type,
          centroid_lat: cluster.centroid_lat,
          centroid_lng: cluster.centroid_lng,
          formatted_address: cluster.formatted_address,
          point_count: cluster.point_count,
          avg_duration_hours: cluster.avg_duration_hours,
          primary_time_of_day: cluster.primary_time_of_day,
          primary_day_of_week: cluster.primary_day_of_week,
          confidence_score: cluster.confidence_score,
          first_seen_at: cluster.first_seen_at,
          last_seen_at: cluster.last_seen_at,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,cluster_id',
        });
    }

    // Identify home and work
    const home = clusters.find(c => c.cluster_type === 'home');
    const work = clusters.find(c => c.cluster_type === 'work');
    const frequent_places = clusters.filter(c => c.cluster_type === 'frequent');

    console.log('[CLUSTERING] Results:', {
      total: clusters.length,
      home: home ? 'found' : 'not found',
      work: work ? 'found' : 'not found',
      frequent: frequent_places.length,
    });

    return {
      clusters,
      home,
      work,
      frequent_places,
    };
  } catch (error) {
    console.error('[CLUSTERING] Error:', error);
    throw error;
  }
}

/**
 * Analyze a cluster to determine its type and characteristics
 */
async function analyzeCluster(
  userId: string,
  clusterId: number,
  centroidLat: number,
  centroidLng: number
): Promise<{
  inferred_type: 'home' | 'work' | 'frequent' | 'unknown';
  avg_duration_hours: number;
  primary_time_of_day: string;
  primary_day_of_week: string;
  confidence_score: number;
  first_seen_at?: string;
  last_seen_at?: string;
}> {
  // Get all points near this cluster's centroid
  const { data: points, error } = await supabase
    .from('user_locations')
    .select('created_at, accuracy')
    .eq('user_id', userId)
    .gte('latitude', centroidLat - 0.002)
    .lte('latitude', centroidLat + 0.002)
    .gte('longitude', centroidLng - 0.002)
    .lte('longitude', centroidLng + 0.002)
    .order('created_at', { ascending: true });

  if (error || !points || points.length === 0) {
    return {
      inferred_type: 'unknown',
      avg_duration_hours: 0,
      primary_time_of_day: 'unknown',
      primary_day_of_week: 'unknown',
      confidence_score: 0,
    };
  }

  // Analyze time patterns
  const timeOfDayCount: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  const dayOfWeekCount: Record<string, number> = { weekday: 0, weekend: 0 };
  
  let nightHours = 0;
  let workHours = 0;
  
  for (const point of points) {
    const date = new Date(point.created_at);
    const hour = date.getHours();
    const day = date.getDay();
    
    // Time of day
    if (hour >= 6 && hour < 12) timeOfDayCount.morning++;
    else if (hour >= 12 && hour < 17) timeOfDayCount.afternoon++;
    else if (hour >= 17 && hour < 21) timeOfDayCount.evening++;
    else timeOfDayCount.night++;
    
    // Day of week
    if (day === 0 || day === 6) dayOfWeekCount.weekend++;
    else dayOfWeekCount.weekday++;
    
    // Track night and work hours
    if (hour >= 22 || hour < 6) nightHours++;
    if (hour >= 9 && hour < 17 && day >= 1 && day <= 5) workHours++;
  }
  
  const totalPoints = points.length;
  const nightRatio = nightHours / totalPoints;
  const workRatio = workHours / totalPoints;
  
  // Determine primary time and day
  const primary_time_of_day = Object.entries(timeOfDayCount)
    .sort((a, b) => b[1] - a[1])[0][0];
  const primary_day_of_week = dayOfWeekCount.weekday > dayOfWeekCount.weekend ? 'weekday' : 'weekend';
  
  // Infer location type
  let inferred_type: 'home' | 'work' | 'frequent' | 'unknown' = 'unknown';
  let confidence_score = 0;
  
  // Home: High night presence, present on weekends
  if (nightRatio > 0.3 && dayOfWeekCount.weekend > totalPoints * 0.2) {
    inferred_type = 'home';
    confidence_score = Math.min(1, nightRatio + (dayOfWeekCount.weekend / totalPoints));
  }
  // Work: High weekday daytime presence
  else if (workRatio > 0.4 && dayOfWeekCount.weekday > totalPoints * 0.6) {
    inferred_type = 'work';
    confidence_score = Math.min(1, workRatio + (dayOfWeekCount.weekday / totalPoints) - 0.3);
  }
  // Frequent: Regular visits but not home/work
  else if (totalPoints >= 5) {
    inferred_type = 'frequent';
    confidence_score = Math.min(1, totalPoints / 20);
  }
  
  // Calculate average duration (rough estimate based on consecutive points)
  let totalDuration = 0;
  for (let i = 1; i < points.length; i++) {
    const diff = new Date(points[i].created_at).getTime() - new Date(points[i-1].created_at).getTime();
    if (diff < 12 * 60 * 60 * 1000) { // Less than 12 hours apart
      totalDuration += diff;
    }
  }
  const avg_duration_hours = (totalDuration / points.length) / (1000 * 60 * 60);
  
  return {
    inferred_type,
    avg_duration_hours,
    primary_time_of_day,
    primary_day_of_week,
    confidence_score,
    first_seen_at: points[0]?.created_at,
    last_seen_at: points[points.length - 1]?.created_at,
  };
}

/**
 * Get user's learned locations (home, work, frequent)
 */
export async function getUserLearnedLocations(userId: string): Promise<ClusteringResult> {
  const { data: clusters, error } = await supabase
    .from('location_clusters')
    .select('*')
    .eq('user_id', userId)
    .order('confidence_score', { ascending: false });

  if (error || !clusters) {
    return {
      clusters: [],
      frequent_places: [],
    };
  }

  const home = clusters.find(c => c.cluster_type === 'home');
  const work = clusters.find(c => c.cluster_type === 'work');
  const frequent_places = clusters.filter(c => c.cluster_type === 'frequent');

  return {
    clusters: clusters.map(c => ({
      cluster_id: c.cluster_id,
      cluster_type: c.cluster_type,
      centroid_lat: c.centroid_lat,
      centroid_lng: c.centroid_lng,
      formatted_address: c.formatted_address,
      point_count: c.point_count,
      avg_duration_hours: c.avg_duration_hours,
      primary_time_of_day: c.primary_time_of_day,
      primary_day_of_week: c.primary_day_of_week,
      confidence_score: c.confidence_score,
      first_seen_at: c.first_seen_at,
      last_seen_at: c.last_seen_at,
    })),
    home: home ? {
      cluster_id: home.cluster_id,
      cluster_type: 'home',
      centroid_lat: home.centroid_lat,
      centroid_lng: home.centroid_lng,
      formatted_address: home.formatted_address,
      point_count: home.point_count,
      confidence_score: home.confidence_score,
    } : undefined,
    work: work ? {
      cluster_id: work.cluster_id,
      cluster_type: 'work',
      centroid_lat: work.centroid_lat,
      centroid_lng: work.centroid_lng,
      formatted_address: work.formatted_address,
      point_count: work.point_count,
      confidence_score: work.confidence_score,
    } : undefined,
    frequent_places: frequent_places.map(f => ({
      cluster_id: f.cluster_id,
      cluster_type: 'frequent',
      centroid_lat: f.centroid_lat,
      centroid_lng: f.centroid_lng,
      formatted_address: f.formatted_address,
      point_count: f.point_count,
      confidence_score: f.confidence_score,
    })),
  };
}

/**
 * Build location context string for AI system prompt
 */
export async function buildLocationContext(userId: string): Promise<string> {
  // Check if location is enabled (Ghost Mode)
  const { data: user } = await supabase
    .from('users')
    .select('location_enabled')
    .eq('record_id', userId)
    .single();

  if (user && user.location_enabled === false) {
    return ''; // Ghost Mode - don't include any location context
  }

  const learned = await getUserLearnedLocations(userId);
  
  const parts: string[] = [];
  
  if (learned.home) {
    parts.push(`User's home: ${learned.home.formatted_address || `${learned.home.centroid_lat.toFixed(4)}, ${learned.home.centroid_lng.toFixed(4)}`}`);
  }
  
  if (learned.work) {
    parts.push(`User's work: ${learned.work.formatted_address || `${learned.work.centroid_lat.toFixed(4)}, ${learned.work.centroid_lng.toFixed(4)}`}`);
  }
  
  if (learned.frequent_places.length > 0) {
    const frequentList = learned.frequent_places
      .slice(0, 3)
      .map(f => f.formatted_address || `${f.centroid_lat.toFixed(4)}, ${f.centroid_lng.toFixed(4)}`)
      .join(', ');
    parts.push(`Frequently visited places: ${frequentList}`);
  }
  
  if (parts.length === 0) {
    return '';
  }
  
  return `\n=== LEARNED LOCATIONS ===\n${parts.join('\n')}\nUse this information to provide personalized location-based assistance.\n`;
}



