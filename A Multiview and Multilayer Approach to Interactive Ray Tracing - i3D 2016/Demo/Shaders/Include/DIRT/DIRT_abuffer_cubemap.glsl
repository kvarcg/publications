// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the code for per-tile tracing:
// 1. rayTriangleIntersect - Ray-triangle intersection
// 2. ray_hit_a_buffer_search - Hi-Z skipping and bucket tracing (Algorithm 1 in the paper) 

#line 8

// rayTriangleIntersect
// Code downloaded and modified from:
// http://graphicscodex.com/Sample2-RayTriangleIntersection.pdf
// If ray P + tw hits triangle V[0], V[1], V[2], then the
// function returns true, stores the barycentric coordinates in
// b[], and stores the distance to the intersection in t.
// Otherwise returns false and the other output parameters are
// undefined.
// Parameters:
// P 		- the ray origin in world space coordinates
// w 		- the ray direction in world space coordinates
// primitive_id - the primitive id
// b		- stores the barycentric coordinates
// Returns the intersection distance, otherwise -1

#define FLT_MAX 3.402823466e+38f
uint start_primitive_id;
#if defined (TEST_VISIBILITY_RAYS) || defined (TEST_SHADOW_RAYS)
float rayTriangleIntersect(const uint primitive_id) 
{	
vec2 b = vec2(0);
#else
float rayTriangleIntersect(const uint primitive_id, out vec2 b) 
{	
#endif
	// First check. avoid self intersection by checking with the same primitive
	if (primitive_id == start_primitive_id) return -1;

	NodeTypePrimitive prim = nodes_primitives[primitive_id];
	// Face normal
	vec3 q	= cross(ray_dir_wcs, prim.e_2.xyz);
	float a = dot(prim.e_1.xyz, q);
	vec3 s	= (ray_origin_wcs - prim.vertex1.xyz) / a;
	vec3 r	= cross(s, prim.e_1.xyz);
	b		= vec2(dot(s, q), dot(r, ray_dir_wcs));
	return any(bvec3(b.x < 0.0, b.y < 0.0, b.x + b.y > 1.0)) ? -1.0 : 
#if defined (TEST_VISIBILITY_RAYS)
	1.0
#else
	dot(prim.e_2.xyz, r)
#endif // TEST_VISIBILITY_RAYS
	;
}

// ray_hit_a_buffer_search
// Analytic intersection tests
// Steps: 
// 1. first check for any intersections with the HiZ texture based on the current lod level
// 2. if there is an intersection, check if we are in the lowest lod level, otherwise return and refine (reduce the lod level)
// 3. if there is an intersection and we are at the lowest lod level
// 4. find the buckets the ray intersects
// 5. find the direction of traversal and start traversal based on this
// 6. traverse all intersected buckets in the id buffer and look for ray primitive intersections.
// An intersection has occured only when both of the conditions have met:
// a) there is an intersection with a primitive and is the shortest one (t_hit > 0, t_hit < t_min).
// b) the intersection has occured at the sample pixel we currently are.
// If an intersection has been found within a bucket, gather the hit record data, skip any remaining buckets and return.
// Parameters:
// coords 		- the pixel coordinates that are traced (in high resolution)
// minZ, maxZ 	- the rays Z extents
// divstep		- a scalar value transforming the high resolution coord to low resolution (1.0 / int(pow(2, lod)))
// lod 			- the current HiZ lod level
// cubemapindex - the view index currently traced
// increment 	- a scalar value indicating the ray direction. It is positive if the ray is moving in the direction of the camera, 
// negative towards the camera
// Returns 1 for a valid intersection, otherwise -1
// The hit record data containing the barycentric coordinates, the primitive id and the intersection position 
// are stored in the global variables out_hit_barycentric, out_primitive_id, out_hit_wcs respectively
// in order to avoid passing them around functions
// The uniform variables used are:
// uniform_ab_mipmap, which denotes the lod level of the downscaled id buffer e.g. for a tile of 1x1 uniform_ab_mipmap = 0, for a tile of 2x2 uniform_ab_mipmap = 1, etc.
// This is used since the Trace pass can potentially occur in a higher resolution than the id buffer
// uniform_view_pixel_proj, an array containing the tranformation from world to pixel space for all views
// The global variables used are:
// ray_origin_wcs, containing the ray origin in world space
// ray_dir_wcs, containing the ray direction in world space
// out_hit_wcs, containing the intersection location in world space
int ray_hit_a_buffer_search(vec2 coords, float minZ, float maxZ, float divstep, int lod, int cubemapindex
#ifdef SKIP_REMAINING_BUCKETS
, int increment
#endif // SKIP_REMAINING_BUCKETS
)
{
#ifdef STATISTICS
	vec4 val2 = loadStatistics(ivec2(gl_FragCoord.xy));
	val2.z++;
	storeStatistics(ivec2(gl_FragCoord.xy), vec4(val2));
	int num_layers = 1;
#endif

	// all buckets are stored linearly, so offset by the view to retrieve the storage location of the first bucket
	// e.g. for 10 buckets, view0=0, view1=10, etc
	int cube_offset = cubemapindex * BUCKET_SIZE;

	// retrieve the coordinates in the depth mipmap texture
	ivec2 coords_lod    = ivec2(coords*divstep);
	vec2  depths		= texelFetch(tex_depth_bounds, ivec3(coords_lod, cubemapindex), 
#if CONSERVATIVE == 1
	lod - uniform_ab_mipmap
#else
	lod
#endif // CONSERVATIVE
).rg;

	// HiZ early skip if the rays extents are outside the depth bounds
	float	depth_near	= -depths.r;
#if EARLY_SKIP == 1
	if (minZ >= -depth_near) return invalid_result;
#endif // EARLY_SKIP

	float	depth_far	= depths.g;
#if EARLY_SKIP == 1
	if (maxZ <= -depth_far) return invalid_result;
#endif // EARLY_SKIP

	// if we have an intersection, return and refine to lower lod levels
	if(lod > uniform_ab_mipmap) return invalid_lod;

	// if we have reached the lowest lod level, we need to traverse the ID buffer
	// find the bucket range by checking the buckets intersected by the ray's Z extents 
	float	depth_length = depth_near - depth_far;
	int		b0 = (maxZ >= -depth_near)						  ? cube_offset + 0			     : cube_offset + max(min(int((float(BUCKET_SIZE)*((depth_near + maxZ) / depth_length))), BUCKET_SIZE_1n),0);
	int		b1 = (b0 == BUCKET_SIZE_1n || minZ <= -depth_far) ? cube_offset + BUCKET_SIZE_1n : cube_offset + max(min(int((float(BUCKET_SIZE)*((depth_near + minZ) / depth_length))), BUCKET_SIZE_1n),0);

#ifndef USE_BUCKETS
	b0 = 0;
	b1 = 1;
#endif

	// initialize variables
	uint index = 0u;
	float t_min = 100000;
	vec4 hit_pixel;
	vec4 hit_wcs = vec4(0,0,0,1);
	vec2 barycentric = vec2(0);
	out_primitive_id = 0x7FFFFFFF;
	NodeTypeTrace node;
	float t_hit = 0.0;

	// traverse each intersected bucket in the id buffer
#ifdef SKIP_REMAINING_BUCKETS
	// Bucket skipping. Check the direction of the ray
	// increment is positive if the ray is moving in the direction of the camera, 
	// negative towards the camera (which must flip the search order)
	const bool	reverseZ = increment < 0;
	const int	inc		 = (reverseZ) ? -1 : 1;
		  int	b		 = (reverseZ) ? b1 : b0;
	const int	d		 = max(0, b1 - b0);
	for (int i = 0; i <= d && index == 0u
#ifdef TEST_VISIBILITY_RAYS
	&& out_primitive_id == 0x7FFFFFFF
#endif //TEST_VISIBILITY_RAYS
	; i++, b += inc)
#else
	for (int b = b0; b <= b1 
#ifdef TEST_VISIBILITY_RAYS
	&& out_primitive_id == 0x7FFFFFFF
#endif //TEST_VISIBILITY_RAYS
; b++)
#endif // SKIP_REMAINING_BUCKETS
	{
		// get the first node in the linked list for that bucket
		index = getPixelHeadidBuffer(ivec2(coords_lod), b);
		// traverse the bucket
		while (index != 0U  
#ifdef TEST_VISIBILITY_RAYS
	&& out_primitive_id == 0x7FFFFFFF
#endif //TEST_VISIBILITY_RAYS
)
		{
#ifdef STATISTICS
			num_layers++;
#endif
			node = nodes[index];
			
#if !defined (TEST_SHADOW_RAYS) && !defined (TEST_VISIBILITY_RAYS) // normal intersection test
			// validation 1: check if the intersection distance is the shortest so far
			t_hit = rayTriangleIntersect(node.primitive_id, barycentric);
			if (all(bvec2(t_hit > 0, t_hit < t_min)))
			{
				// validation 2: project the hit point to the id buffer resolution
				// and check if the intersected primitive is located there
				hit_wcs.xyz		= ray_origin_wcs + t_hit * ray_dir_wcs;
								
				hit_pixel		= uniform_view_pixel_proj_low_res[cubemapindex] * hit_wcs;
				hit_pixel.xy   /= hit_pixel.w;
				vec2 res = abs(vec2(coords_lod) -	vec2(hit_pixel.xy));
				if(all(lessThan(res, vec2(1))))
				{
					t_min = t_hit;
					out_primitive_id = node.primitive_id;
					out_hit_barycentric = barycentric;
				}
			}
#elif defined (TEST_VISIBILITY_RAYS)
			// check for ray-triangle intersection
			t_hit = rayTriangleIntersect(node.primitive_id);
			// validation 1: check if there is any hit
			if (t_hit > 0) out_primitive_id = 0U;
#elif defined (TEST_SHADOW_RAYS)
			// check for ray-triangle intersection
			t_hit = rayTriangleIntersect(node.primitive_id);
			// validation 1: check if the intersection distance is before the light source
			if (all(bvec2(t_hit > 0.0, t_hit < distance_to_light))) out_primitive_id = 0U;
#endif // TEST_RAYS
			index = node.next;
		}
	}

#ifdef STATISTICS
	float total_samples = 1;
	vec4 val = loadStatistics(ivec2(gl_FragCoord.xy));
	total_samples += val.w;
	float avg_layers = num_layers + val.x * val.w;
	avg_layers /= total_samples;
	val.x = avg_layers;
	val.w = total_samples;
	storeStatistics(ivec2(gl_FragCoord.xy), val);
#endif

#ifndef TEST_VISIBILITY_RAYS
	out_hit_wcs = ray_origin_wcs + t_min * ray_dir_wcs;
#endif // TEST_VISIBILITY_RAYS
	return (out_primitive_id == 0x7FFFFFFF) ? invalid_result : 1;
}